import test from "node:test";
import assert from "node:assert/strict";
import { handleRoute, parseLatLng } from "../server/routing.js";

const osrmOk = {
  code: "Ok",
  routes: [{
    distance: 5000, duration: 600,
    geometry: { coordinates: [[144.9, -37.8], [144.83, -37.79]] },
    legs: [{ steps: [{ distance: 5000, name: "Ballarat Road", maneuver: { type: "depart" } }] }],
  }],
};

function setup(over = {}) {
  const calls = [];
  const store = new Map();
  return {
    calls,
    deps: {
      env: {},
      verifyToken: async (t) => { if (t !== "good") throw new Error("bad"); return { uid: "u" }; },
      fetchImpl: async (url, opts) => { calls.push({ url, opts }); return new Response(JSON.stringify(osrmOk), { status: 200 }); },
      cache: { match: async (k) => store.get(k.url), put: async (k, r) => { store.set(k.url, r); } },
      ...over,
    },
  };
}
const q = "mode=walk&from=-37.8183,144.9671&to=-37.7889,144.8325";
const req = (query = q, token = "good") =>
  new Request(`https://x.test/api/route?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test("parseLatLng accepts valid pairs and rejects junk", () => {
  assert.deepEqual(parseLatLng("-37.8,144.9"), { lat: -37.8, lng: 144.9 });
  assert.equal(parseLatLng("abc"), null);
  assert.equal(parseLatLng("-37.8;144.9"), null);
  assert.equal(parseLatLng("200,144"), null);
  assert.equal(parseLatLng(null), null);
});

test("requires login: no token and forged token are 401 and nothing is fetched", async () => {
  const { deps, calls } = setup();
  assert.equal((await handleRoute({ request: req(q, ""), ...deps })).status, 401);
  assert.equal((await handleRoute({ request: req(q, "forged"), ...deps })).status, 401);
  assert.equal(calls.length, 0);
});

test("rejects bad mode, bad coordinates and places outside Australia", async () => {
  const { deps, calls } = setup();
  assert.equal((await handleRoute({ request: req("mode=teleport&from=-37.8,144.9&to=-37.7,144.8"), ...deps })).status, 400);
  assert.equal((await handleRoute({ request: req("mode=walk&from=nope&to=-37.7,144.8"), ...deps })).status, 400);
  const far = await handleRoute({ request: req("mode=walk&from=51.5,-0.12&to=48.85,2.35"), ...deps }); // London -> Paris
  assert.equal(far.status, 400);
  assert.equal((await far.json()).error, "out_of_area");
  assert.equal(calls.length, 0);
});

test("happy path: asks the right routing server (per mode) and returns a parsed route", async () => {
  const { deps, calls } = setup();
  const res = await handleRoute({ request: req("mode=cycle&from=-37.8183,144.9671&to=-37.7889,144.8325"), ...deps });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.route.distanceKm, 5);
  assert.deepEqual(body.route.path[0], [-37.8, 144.9]);
  assert.ok(calls[0].url.includes("routed-bike"));
  assert.match(calls[0].opts.headers["User-Agent"], /GreenRootsConnect/);
});

test("repeat requests (to ~11 m) are served from cache", async () => {
  const { deps, calls } = setup();
  await handleRoute({ request: req("mode=walk&from=-37.81831,144.96711&to=-37.7889,144.8325"), ...deps });
  const second = await handleRoute({ request: req("mode=walk&from=-37.81832,144.96712&to=-37.7889,144.8325"), ...deps });
  assert.equal(calls.length, 1);
  assert.equal(second.headers.get("X-Cache"), "HIT");
});

test("'no route' is 422; rate limiting / server errors are 502; timeouts are 504 — never confused", async () => {
  const noRoute = setup({ fetchImpl: async () => new Response(JSON.stringify({ code: "NoRoute" }), { status: 400 }) });
  const r1 = await handleRoute({ request: req(), ...noRoute.deps });
  assert.equal(r1.status, 422);
  assert.equal((await r1.json()).error, "no_route");
  const limited = setup({ fetchImpl: async () => new Response("slow down", { status: 429 }) });
  assert.equal((await handleRoute({ request: req(), ...limited.deps })).status, 502);
  const slow = setup({ fetchImpl: async () => { throw new DOMException("t", "TimeoutError"); } });
  assert.equal((await handleRoute({ request: req(), ...slow.deps })).status, 504);
});
