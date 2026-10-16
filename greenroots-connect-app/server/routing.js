// Request handler for GET /api/route?mode=walk|cycle|drive&from=lat,lng&to=lat,lng
// (BR E.1 serverless, BR E.2 directions)
//
// The browser asks the public routing servers directly first. If that fails
// (blocked network, CORS, the server being down for the browser), the app falls
// back to this function, which fetches the route server-side. It also keeps an
// identifying User-Agent, validates input, and caches repeated routes.
// fetchImpl / cache / verifyToken are injected so it is unit-testable offline.
import { ROUTE_MODES, buildRouteUrl, parseRoute, isValidLatLng } from "../src/utils/geo.js";

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

// Only Australia: stops this being used as a free global routing relay.
const AU = { minLat: -44, maxLat: -10, minLng: 112, maxLng: 154 };

export function parseLatLng(text) {
  const m = /^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

const inAustralia = (p) => p.lat >= AU.minLat && p.lat <= AU.maxLat && p.lng >= AU.minLng && p.lng <= AU.maxLng;
// ~11 m precision: nearly identical requests share one cache entry.
const round4 = (p) => ({ lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 });

export async function handleRoute({ request, env, verifyToken, fetchImpl = fetch, cache = null }) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json(401, { error: "not_authenticated" });
  try {
    await verifyToken(token, env);
  } catch {
    return json(401, { error: "invalid_token" });
  }

  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");
  if (!ROUTE_MODES[mode]) return json(400, { error: "bad_mode" });
  const rawFrom = parseLatLng(params.get("from"));
  const rawTo = parseLatLng(params.get("to"));
  if (!rawFrom || !rawTo) return json(400, { error: "bad_coordinates" });
  if (!inAustralia(rawFrom) || !inAustralia(rawTo)) return json(400, { error: "out_of_area" });

  const upstream = buildRouteUrl(mode, round4(rawFrom), round4(rawTo));
  const cacheKey = new Request(upstream);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return json(200, await hit.json(), { "X-Cache": "HIT" });
  }

  let res;
  try {
    res = await fetchImpl(upstream, {
      headers: { "User-Agent": `GreenRootsConnect/1.0 (student project; ${env.CONTACT_EMAIL || "no contact set"})` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return json(504, { error: "upstream_timeout" });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (data && (data.code === "NoRoute" || data.code === "NoSegment")) return json(422, { error: "no_route" });
  if (!res.ok || !data) return json(502, { error: "upstream_failed", status: res.status });

  let route;
  try {
    route = parseRoute(data);
  } catch {
    return json(422, { error: "no_route" });
  }

  const body = { route };
  if (cache) {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } })
    );
  }
  return json(200, body, { "X-Cache": "MISS" });
}
