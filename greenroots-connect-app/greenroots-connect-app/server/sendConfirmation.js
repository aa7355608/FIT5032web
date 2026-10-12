// Request handler for POST /api/send-confirmation (BR D.2).
//
// Why this runs on a server and not in the browser: SendGrid needs a secret API
// key, which must never ship to the client, and SendGrid rejects browser
// (CORS) requests anyway.
//
// Abuse protection — an open "send an email" endpoint is a spam relay, so:
//   1. the caller must present a valid Firebase ID token;
//   2. the token's email must be verified;
//   3. mail goes ONLY to that verified address (never an address in the request);
//   4. event details come from our own event list, not from the request.
//
// verifyToken / sendMail are injected so this can be unit-tested without
// network access (tests/email-function.test.mjs).
import { buildIcs } from "./ics.js";

const MAX_BODY_BYTES = 4096;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Strip tags/control characters from free text we echo into the email.
export function cleanText(value, maxLength = 80) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildEmail(event, name) {
  const when = `${event.date}, ${event.time}`;
  const text =
    `Hi ${name},\n\n` +
    `You're registered for ${event.title}.\n\n` +
    `When: ${when}\nWhere: ${event.suburb}, VIC\n\n${event.description}\n\n` +
    `A calendar invite (event.ics) is attached — open it to add the event to your calendar.\n\n` +
    `See you there,\nGreenRoots Connect`;
  const html =
    `<p>Hi ${escapeHtml(name)},</p>` +
    `<p>You're registered for <strong>${escapeHtml(event.title)}</strong>.</p>` +
    `<p><strong>When:</strong> ${escapeHtml(when)}<br><strong>Where:</strong> ${escapeHtml(event.suburb)}, VIC</p>` +
    `<p>${escapeHtml(event.description)}</p>` +
    `<p>A calendar invite (<em>event.ics</em>) is attached &mdash; open it to add the event to your calendar.</p>` +
    `<p>See you there,<br>GreenRoots Connect</p>`;
  return { subject: `You're registered: ${event.title}`, text, html };
}

export async function handleSendConfirmation({ request, env, events, verifyToken, sendMail }) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json(401, { error: "not_authenticated" });

  let claims;
  try {
    claims = await verifyToken(token, env);
  } catch {
    return json(401, { error: "invalid_token" });
  }
  if (!claims.email) return json(403, { error: "no_email_on_account" });
  if (claims.email_verified !== true) return json(403, { error: "email_not_verified" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_json" });
  }

  const event = events.find((e) => e.id === body?.eventId);
  if (!event) return json(400, { error: "unknown_event" });

  const name = cleanText(body.name, 80) || "there";
  const email = buildEmail(event, name);
  const ics = buildIcs(event);

  try {
    await sendMail(env, {
      to: claims.email, // always the verified account email — never taken from the request
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachment: { filename: "event.ics", type: "text/calendar", content: toBase64(ics) },
    });
  } catch (err) {
    console.error("send failed:", err?.message);
    return json(err?.code === "not_configured" ? 503 : 502, {
      error: err?.code === "not_configured" ? "email_not_configured" : "send_failed",
    });
  }
  return json(200, { ok: true });
}
