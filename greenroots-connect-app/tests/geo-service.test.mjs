import test from "node:test";
import assert from "node:assert/strict";
import { fetchRoute, searchPlaces } from "../src/services/geoService.js";

const from = { lat: -37.8183, lng: 144.9671 };
const to = { lat: -37.7889, lng: 144.8325 };
const osrmOk = {
  code: "Ok",
  routes: [{ distance: 5000, duration: 600, geometry: { coordinates: [[144.9, -37.8], [144.83, -37.79]] }, legs: [{ steps: [] }] }],
};
const serverRoute = { route: { distanceKm: 5, durationS: 600, path: [[-37.8, 144.9], [-37.79, 144.83]], steps: [] } };

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

// Routes by URL so each test can script the direct call and the server fallback separately.
function mockFetch({ direct, server }) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const handler = String(url).startsWith("/api/route") ? server : direct;
    return handler(url);
  };
  return calls;
}
const jsonRes = (status, body) => new Response(JSON.stringify(body), { status });

test("direct success: no fallback call is made and no token is requested", async () => {
  const calls = mockFetch({ direct: () => jsonRes(200, osrmOk), server: () => { throw new Error("must not be called"); } });
  let tokenAsked = false;
  const res = await fetchRoute("walk", from, to, async () => { tokenAsked = true; return "t"; });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(tokenAsked, false);
});

test("a 429 is reported as http_429 (NOT 'no route')", async () => {
  mockFetch({ direct: () => new Response("busy", { status: 429 }), server: () => jsonRes(503, { error: "x" }) });
  const res = await fetchRoute("walk", from, to);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "http_429");
});

test("genuine 'no route' answers are reported as no_route and do NOT trigger the fallback", async () => {
  const calls = mockFetch({ direct: () => jsonRes(400, { code: "NoRoute" }), server: () => jsonRes(200, serverRoute) });
  const res = await fetchRoute("walk", from, to);
  assert.equal(res.reason, "no_route");
  assert.equal(calls.length, 1);
});

test("browser can't reach the routing server (network error) -> falls back to our serverless route", async () => {
  const calls = mockFetch({
    direct: () => { throw new TypeError("Failed to fetch"); }, // what a CORS/network block looks like
    server: () => jsonRes(200, serverRoute),
  });
  let sentToken = null;
  const res = await fetchRoute("walk", from, to, async () => "tok123");
  assert.equal(res.ok, true);
  assert.equal(res.route.distanceKm, 5);
  assert.ok(calls[1].startsWith("/api/route?mode=walk"));
  assert.ok(calls[1].includes("from=-37.8183%2C144.9671"));
});

test("both paths fail -> the ORIGINAL (most informative) reason is reported", async () => {
  mockFetch({ direct: () => new Response("x", { status: 503 }), server: () => new Response("<html>spa</html>", { status: 200 }) });
  const res = await fetchRoute("drive", from, to);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "http_503");
});

test("bad input never reaches the network", async () => {
  const calls = mockFetch({ direct: () => jsonRes(200, osrmOk), server: () => jsonRes(200, serverRoute) });
  const res = await fetchRoute("teleport", from, to);
  assert.equal(res.reason, "bad_input");
  assert.equal(calls.length, 0);
});

test("searchPlaces: 401 -> not_signed_in; HTML (dev server) -> unavailable; success -> results", async () => {
  globalThis.fetch = async () => jsonRes(401, { error: "not_authenticated" });
  assert.equal((await searchPlaces(null, "Footscray")).reason, "not_signed_in");
  globalThis.fetch = async () => new Response("<html></html>", { status: 200 });
  assert.equal((await searchPlaces("t", "Footscray")).reason, "unavailable");
  globalThis.fetch = async () => jsonRes(200, { results: [{ name: "Footscray", lat: -37.8, lng: 144.9 }] });
  assert.equal((await searchPlaces("t", "Footscray")).results.length, 1);
});
