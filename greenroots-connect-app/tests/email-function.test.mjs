import test from "node:test";
import assert from "node:assert/strict";
import { buildIcs, escapeIcsText, parseTimeRange, foldLine } from "../server/ics.js";
import { handleSendConfirmation, cleanText, escapeHtml } from "../server/sendConfirmation.js";
import { rawEvents } from "../src/data/events.js";

const event = rawEvents[0];

test("time range parses to 24h", () => {
  assert.deepEqual(parseTimeRange("9:00 AM \u2013 12:00 PM"), { start: [9, 0], end: [12, 0] });
  assert.deepEqual(parseTimeRange("1:00 PM \u2013 4:00 PM"), { start: [13, 0], end: [16, 0] });
  assert.equal(parseTimeRange("all day"), null);
});

test("ICS text escaping blocks field injection", () => {
  assert.equal(escapeIcsText("a,b;c\nd"), "a\\,b\\;c\\nd");
});

test("long ICS lines are folded to <= 75 chars", () => {
  const folded = foldLine("X".repeat(200)).split("\r\n");
  assert.ok(folded.every((l) => l.length <= 75));
});

test("ICS is a valid-looking calendar for the event", () => {
  const ics = buildIcs(event, { now: new Date("2026-10-01T00:00:00Z") });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes(`DTSTART:${event.date.replaceAll("-", "")}T090000`));
  assert.ok(ics.includes(`DTEND:${event.date.replaceAll("-", "")}T120000`));
  assert.ok(ics.includes("DTSTAMP:20261001T000000Z"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
});

const goodClaims = { email: "amara@example.com", email_verified: true };
function makeDeps(overrides = {}) {
  const sent = [];
  return {
    sent,
    deps: {
      env: {},
      events: rawEvents,
      verifyToken: async (t) => {
        if (t !== "good-token") throw new Error("bad");
        return goodClaims;
      },
      sendMail: async (_env, mail) => sent.push(mail),
      ...overrides,
    },
  };
}
const req = (body, token = "good-token") =>
  new Request("https://x.test/api/send-confirmation", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("rejects requests with no token (401)", async () => {
  const { deps } = makeDeps();
  const res = await handleSendConfirmation({ request: req({ eventId: event.id }, ""), ...deps });
  assert.equal(res.status, 401);
});

test("rejects a token that fails verification (401)", async () => {
  const { deps, sent } = makeDeps();
  const res = await handleSendConfirmation({ request: req({ eventId: event.id }, "forged"), ...deps });
  assert.equal(res.status, 401);
  assert.equal(sent.length, 0);
});

test("rejects unverified email addresses (403)", async () => {
  const { deps, sent } = makeDeps({ verifyToken: async () => ({ email: "a@b.co", email_verified: false }) });
  const res = await handleSendConfirmation({ request: req({ eventId: event.id }), ...deps });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "email_not_verified");
  assert.equal(sent.length, 0);
});

test("sends ONE email, to the verified account address only, with an .ics attachment", async () => {
  const { deps, sent } = makeDeps();
  const res = await handleSendConfirmation({
    request: req({ eventId: event.id, name: "Amara", to: "victim@evil.example" }), // attacker-supplied "to" must be ignored
    ...deps,
  });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "amara@example.com");
  assert.equal(sent[0].attachment.filename, "event.ics");
  assert.equal(sent[0].attachment.type, "text/calendar");
  const decoded = Buffer.from(sent[0].attachment.content, "base64").toString("utf8");
  assert.ok(decoded.includes("BEGIN:VCALENDAR"));
  assert.ok(decoded.includes(event.title));
});

test("unknown event ids are rejected (400) — event data comes from the server, not the client", async () => {
  const { deps, sent } = makeDeps();
  const res = await handleSendConfirmation({ request: req({ eventId: "evt-999" }), ...deps });
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
});

test("malformed and oversized bodies are rejected", async () => {
  const { deps } = makeDeps();
  assert.equal((await handleSendConfirmation({ request: req("{not json"), ...deps })).status, 400);
  assert.equal((await handleSendConfirmation({ request: req("x".repeat(5000)), ...deps })).status, 413);
});

test("HTML in the name cannot inject markup into the email", async () => {
  const { deps, sent } = makeDeps();
  await handleSendConfirmation({ request: req({ eventId: event.id, name: '<img src=x onerror=alert(1)>Eve' }), ...deps });
  assert.ok(!sent[0].html.includes("<img"));
  assert.equal(cleanText("<b>Hi</b>"), "Hi");
  assert.equal(escapeHtml('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
});

test("a SendGrid failure is reported as 502, not as success", async () => {
  const { deps } = makeDeps({ sendMail: async () => { throw new Error("SendGrid responded 401"); } });
  const res = await handleSendConfirmation({ request: req({ eventId: event.id }), ...deps });
  assert.equal(res.status, 502);
});

test("missing SendGrid config is reported as 503 email_not_configured", async () => {
  const { deps } = makeDeps({ sendMail: async () => { const e = new Error("x"); e.code = "not_configured"; throw e; } });
  const res = await handleSendConfirmation({ request: req({ eventId: event.id }), ...deps });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "email_not_configured");
});
