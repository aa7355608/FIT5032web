import test from "node:test";
import assert from "node:assert/strict";
import {
  haversineKm, withDistance, formatDistance, formatDuration, buildRouteUrl, describeStep, parseRoute, isValidLatLng,
} from "../src/utils/geo.js";
import { rawEvents } from "../src/data/events.js";

const flinders = { lat: -37.8183, lng: 144.9671 };
const sunshine = { lat: -37.7889, lng: 144.8325 };

test("haversine distance is plausible (Flinders St -> Sunshine is about 12 km)", () => {
  const d = haversineKm(flinders, sunshine);
  assert.ok(d > 11 && d < 13.5, `got ${d}`);
  assert.equal(haversineKm(flinders, flinders), 0);
});

test("every event has valid coordinates inside Greater Melbourne", () => {
  for (const e of rawEvents) {
    assert.ok(isValidLatLng(e.lat, e.lng), e.id);
    assert.ok(e.lat < -37.4 && e.lat > -38.5 && e.lng > 144.4 && e.lng < 145.6, `${e.id} outside Melbourne`);
  }
});

test("withDistance adds km only when there is an origin, and sorting by it works", () => {
  assert.equal(withDistance(rawEvents, null)[0].distanceKm, null);
  const sorted = withDistance(rawEvents, sunshine).sort((a, b) => a.distanceKm - b.distanceKm);
  assert.equal(sorted[0].id, "evt-001"); // Sunshine Reserve is the closest to Sunshine
  assert.ok(sorted[0].distanceKm < 0.5);
});

test("distance and duration formatting", () => {
  assert.equal(formatDistance(0.853), "850 m");
  assert.equal(formatDistance(3.24), "3.2 km");
  assert.equal(formatDistance(null), "");
  assert.equal(formatDuration(20), "1 min");
  assert.equal(formatDuration(25 * 60), "25 min");
  assert.equal(formatDuration(65 * 60), "1 h 5 min");
});

test("route URL uses lng,lat order, the right server per mode, and rejects bad input", () => {
  const u = buildRouteUrl("cycle", flinders, sunshine);
  assert.ok(u.includes("routed-bike"));
  assert.ok(u.includes(`${flinders.lng},${flinders.lat};${sunshine.lng},${sunshine.lat}`));
  assert.ok(buildRouteUrl("walk", flinders, sunshine).includes("routed-foot"));
  assert.ok(buildRouteUrl("drive", flinders, sunshine).includes("routed-car"));
  assert.throws(() => buildRouteUrl("teleport", flinders, sunshine), /unknown_mode/);
  assert.throws(() => buildRouteUrl("walk", { lat: NaN, lng: 1 }, sunshine), /bad_coordinates/);
});

test("step descriptions read naturally", () => {
  assert.equal(describeStep({ name: "Ballarat Road", maneuver: { type: "depart" } }), "Start on Ballarat Road");
  assert.equal(describeStep({ name: "Hampshire Road", maneuver: { type: "turn", modifier: "left" } }), "Turn left onto Hampshire Road");
  assert.equal(describeStep({ name: "", maneuver: { type: "turn", modifier: "slight right" } }), "Turn slightly right");
  assert.equal(describeStep({ name: "", maneuver: { type: "arrive" } }), "Arrive at your destination");
  assert.equal(describeStep({ name: "Main St", maneuver: { type: "roundabout", exit: 2 } }), "At the roundabout, take exit 2 onto Main St");
});

const osrmFixture = {
  code: "Ok",
  routes: [{
    distance: 1234.5, duration: 900,
    geometry: { coordinates: [[144.83, -37.78], [144.84, -37.79], [144.85, -37.8]] },
    legs: [{ steps: [
      { distance: 500, name: "Ballarat Road", maneuver: { type: "depart" } },
      { distance: 734.5, name: "", maneuver: { type: "arrive" } },
    ] }],
  }],
};

test("parseRoute converts OSRM output (lng,lat -> lat,lng) and builds steps", () => {
  const r = parseRoute(osrmFixture);
  assert.equal(r.distanceKm, 1.2345);
  assert.equal(r.durationS, 900);
  assert.deepEqual(r.path[0], [-37.78, 144.83]);
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0].text, "Start on Ballarat Road");
});

test("parseRoute rejects 'no route' and malformed responses", () => {
  assert.throws(() => parseRoute({ code: "NoRoute", routes: [] }), /no_route/);
  assert.throws(() => parseRoute({}), /no_route/);
  assert.throws(() => parseRoute({ code: "Ok", routes: [{ geometry: { coordinates: [] } }] }), /no_route/);
});
