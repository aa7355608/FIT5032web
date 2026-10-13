import test from "node:test";
import assert from "node:assert/strict";
import { handleGeocode, normaliseQuery, buildNominatimUrl, parseNominatim, MELBOURNE_VIEWBOX } from "../server/geocode.js";

const nominatimFixture = [
  { display_name: "Footscray, Maribyrnong, Victoria, Australia", lat: "-37.8", lon: "144.9" },
  { display_name: "", lat: "-37.8", lon: "144.9" }, // dropped: no name
  { display_name: "Bad coords", lat: "abc", lon: "144.9" }, // dropped: not a number
];

function deps(over = {}) {
  const calls = [];
  const store = new Map();
  return {
    calls,
    deps: {
      env: { CONTACT_EMAIL: "me@example.com" },
      verifyToken: async (t) => { if (t !== "good") throw new Error("bad"); return { uid: "u1" }; },
      fetchImpl: async (url, opts) => { calls.push({ url, opts }); return new Response(JSON.stringify(nominatimFixture), { status: 200 }); },
      cache: { match: async (k) => store.get(k.url) ?? undefined, put: async (k, r) => { store.set(k.url, r); } },
      ...over,
    },
  };
}
const req = (q, token = "good") =>
  new Request(`https://x.test/api/geocode?q=${encodeURIComponent(q)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test("query normalisation: trims, collapses whitespace, enforces 2..120 chars", () => {
  assert.equal(normaliseQuery("  Foot   scray \n"), "Foot scray");
  assert.equal(normaliseQuery("a"), "");
  assert.equal(normaliseQuery("x".repeat(121)), "");
  assert.equal(normaliseQuery(null), "");
});

test("upstream URL is limited to Australia and the Melbourne box", () => {
  const u = new URL(buildNominatimUrl("Sunshine"));
  assert.equal(u.searchParams.get("countrycodes"), "au");
  assert.equal(u.searchParams.get("viewbox"), MELBOURNE_VIEWBOX);
  assert.equal(u.searchParams.get("bounded"), "1");
  assert.equal(u.searchParams.get("limit"), "5");
});

test("parseNominatim keeps only valid results with numeric coordinates", () => {
  const r = parseNominatim(nominatimFixture);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { name: "Footscray, Maribyrnong, Victoria, Australia", lat: -37.8, lng: 144.9 });
  assert.deepEqual(parseNominatim({ not: "an array" }), []);
});

test("requires a valid login: no token and a forged token are both 401, and nothing is fetched", async () => {
  const { deps: d, calls } = deps();
  assert.equal((await handleGeocode({ request: req("Footscray", ""), ...d })).status, 401);
  assert.equal((await handleGeocode({ request: req("Footscray", "forged"), ...d })).status, 401);
  assert.equal(calls.length, 0);
});

test("bad queries are rejected with 400 before any upstream call", async () => {
  const { deps: d, calls } = deps();
  assert.equal((await handleGeocode({ request: req("a"), ...d })).status, 400);
  assert.equal(calls.length, 0);
});

test("happy path: returns parsed results and identifies itself to the geocoder", async () => {
  const { deps: d, calls } = deps();
  const res = await handleGeocode({ request: req("Footscray"), ...d });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).results.length, 1);
  assert.match(calls[0].opts.headers["User-Agent"], /GreenRootsConnect.*me@example\.com/);
});

test("second identical search is served from cache (no second upstream call)", async () => {
  const { deps: d, calls } = deps();
  await handleGeocode({ request: req("Footscray"), ...d });
  const second = await handleGeocode({ request: req("Footscray"), ...d });
  assert.equal(calls.length, 1);
  assert.equal(second.headers.get("X-Cache"), "HIT");
});

test("upstream failure -> 502, upstream timeout -> 504 (never reported as success)", async () => {
  const bad = deps({ fetchImpl: async () => new Response("x", { status: 503 }) });
  assert.equal((await handleGeocode({ request: req("Footscray"), ...bad.deps })).status, 502);
  const slow = deps({ fetchImpl: async () => { throw new DOMException("timeout", "TimeoutError"); } });
  assert.equal((await handleGeocode({ request: req("Footscray"), ...slow.deps })).status, 504);
});
