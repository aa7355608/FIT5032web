// Request handler for GET /api/geocode?q=...  (BR E.1 serverless + BR E.2 map search)
//
// Why a server function instead of calling the geocoder from the browser:
//   - the public Nominatim service requires an identifying User-Agent and
//     asks clients to cache results and avoid abuse — a server can do all of
//     that, a browser can't set User-Agent;
//   - only signed-in users may use it, so this can't become a free public
//     geocoding relay that gets our server blocked;
//   - input is validated and results are limited to Greater Melbourne.
//
// fetchImpl / cache / verifyToken are injected so it's unit-testable offline.

// left,top,right,bottom of Greater Melbourne.
export const MELBOURNE_VIEWBOX = "144.4,-37.4,145.6,-38.5";
const MAX_QUERY = 120;

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

export function normaliseQuery(raw) {
  const q = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return q.length >= 2 && q.length <= MAX_QUERY ? q : "";
}

export function buildNominatimUrl(q) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "5");
  u.searchParams.set("countrycodes", "au");
  u.searchParams.set("viewbox", MELBOURNE_VIEWBOX);
  u.searchParams.set("bounded", "1");
  u.searchParams.set("q", q);
  return u.toString();
}

export function parseNominatim(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map((r) => ({
      name: String(r.display_name ?? "").slice(0, 140),
      lat: Number.parseFloat(r.lat),
      lng: Number.parseFloat(r.lon),
    }))
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

export async function handleGeocode({ request, env, verifyToken, fetchImpl = fetch, cache = null }) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json(401, { error: "not_authenticated" });
  try {
    await verifyToken(token, env);
  } catch {
    return json(401, { error: "invalid_token" });
  }

  const q = normaliseQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return json(400, { error: "bad_query" });

  const upstream = buildNominatimUrl(q);
  const cacheKey = new Request(upstream);

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return json(200, await hit.json(), { "X-Cache": "HIT" });
  }

  let res;
  try {
    res = await fetchImpl(upstream, {
      headers: {
        "User-Agent": `GreenRootsConnect/1.0 (student project; ${env.CONTACT_EMAIL || "no contact set"})`,
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return json(504, { error: "upstream_timeout" });
  }
  if (!res.ok) return json(502, { error: "upstream_failed" });

  let results;
  try {
    results = parseNominatim(await res.json());
  } catch {
    return json(502, { error: "upstream_failed" });
  }

  const body = { results };
  if (cache) {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } })
    );
  }
  return json(200, body, { "X-Cache": "MISS" });
}
