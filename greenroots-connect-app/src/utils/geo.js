// Pure geo helpers for the map page (BR E.2). No Vue, no network — unit-tested
// in tests/geo.test.mjs.

export const MELBOURNE_WEST = [-37.8, 144.82]; // initial map centre

export function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Great-circle distance in kilometres.
export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Adds `distanceKm` (straight-line) to each event; null when there's no origin.
export function withDistance(events, origin) {
  return events.map((e) => ({
    ...e,
    distanceKm: origin && isValidLatLng(e.lat, e.lng) ? haversineKm(origin, e) : null,
  }));
}

export function formatDistance(km) {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`;
}

export function formatDuration(seconds) {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Directions come from the open FOSSGIS OSRM servers (one per travel mode).
export const ROUTE_MODES = {
  walk: { label: "Walk", base: "https://routing.openstreetmap.de/routed-foot" },
  cycle: { label: "Cycle", base: "https://routing.openstreetmap.de/routed-bike" },
  drive: { label: "Drive", base: "https://routing.openstreetmap.de/routed-car" },
};

export function buildRouteUrl(mode, from, to) {
  const m = ROUTE_MODES[mode];
  if (!m) throw new Error("unknown_mode");
  if (!isValidLatLng(from.lat, from.lng) || !isValidLatLng(to.lat, to.lng)) throw new Error("bad_coordinates");
  // OSRM wants lng,lat order. (These servers ignore the profile word in the path.)
  return `${m.base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
}

const TURN_WORDS = {
  left: "left",
  "slight left": "slightly left",
  "sharp left": "sharp left",
  right: "right",
  "slight right": "slightly right",
  "sharp right": "sharp right",
  straight: "straight ahead",
  uturn: "back (U-turn)",
};

export function describeStep(step) {
  const { type, modifier, exit } = step.maneuver || {};
  const road = step.name ? ` onto ${step.name}` : "";
  const turn = TURN_WORDS[modifier] || "";
  switch (type) {
    case "depart":
      return step.name ? `Start on ${step.name}` : "Start";
    case "arrive":
      return turn && modifier !== "straight" ? `Arrive: your destination is on the ${turn.replace("slightly ", "").replace("sharp ", "")}` : "Arrive at your destination";
    case "turn":
    case "end of road":
      return `Turn ${turn || "ahead"}${road}`;
    case "fork":
      return `Keep ${turn || "ahead"}${road}`;
    case "merge":
      return `Merge${road}`;
    case "on ramp":
    case "off ramp":
      return `Take the ramp${road}`;
    case "roundabout":
    case "rotary":
    case "exit roundabout":
      return `At the roundabout, take exit ${exit || ""}${road}`.replace("exit  ", "exit ");
    default:
      return `Continue${road}`;
  }
}

// Turns an OSRM route response into what the UI needs. Throws if there's no route.
export function parseRoute(json) {
  const route = json?.routes?.[0];
  if (json?.code !== "Ok" || !route) throw new Error("no_route");
  const coords = route.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) throw new Error("no_route");
  const steps = (route.legs || []).flatMap((leg) => leg.steps || []).map((s) => ({
    text: describeStep(s),
    distanceM: Math.round(s.distance || 0),
  }));
  return {
    distanceKm: route.distance / 1000,
    durationS: route.duration,
    path: coords.map(([lng, lat]) => [lat, lng]), // Leaflet wants [lat, lng]
    steps,
  };
}
