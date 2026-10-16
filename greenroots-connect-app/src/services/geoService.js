// Client side of the map features (BR E.2).
//  - Place search goes through OUR serverless function (/api/geocode).
//  - Directions are fetched straight from the public routing servers (CORS-enabled).
import { buildRouteUrl, parseRoute } from "../utils/geo.js";

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Always calls the function and lets the SERVER decide whether the caller is
// allowed (it answers 401 without a valid Firebase login).
export async function searchPlaces(idToken, query) {
  try {
    const res = await fetchWithTimeout(`/api/geocode?q=${encodeURIComponent(query)}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON — e.g. a dev server returning index.html */
    }
    if (res.ok && Array.isArray(data?.results)) return { ok: true, results: data.results };
    if (res.status === 401) return { ok: false, reason: "not_signed_in" };
    if (data?.error) return { ok: false, reason: data.error };
    return { ok: false, reason: "unavailable" };
  } catch (err) {
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "network" };
  }
}

// OSRM answers "no road route" with these codes; anything else going wrong is a service problem.
const NO_ROUTE_CODES = new Set(["NoRoute", "NoSegment"]);

// Step 1: ask the public routing server straight from the browser.
async function fetchRouteDirect(mode, from, to) {
  let url;
  try {
    url = buildRouteUrl(mode, from, to);
  } catch {
    return { ok: false, reason: "bad_input" };
  }
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "network" };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.ok && data) {
    try {
      return { ok: true, route: parseRoute(data) };
    } catch {
      return { ok: false, reason: "no_route" };
    }
  }
  if (data && NO_ROUTE_CODES.has(data.code)) return { ok: false, reason: "no_route" };
  // e.g. 429 (rate limited) or 503 — report it as what it is, not as "no route"
  return { ok: false, reason: `http_${res.status}` };
}

// Step 2 (fallback): ask OUR serverless function, which fetches the route server-side.
async function fetchRouteViaServer(idToken, mode, from, to) {
  const qs = new URLSearchParams({ mode, from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}` });
  try {
    const res = await fetchWithTimeout(`/api/route?${qs}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON — e.g. a dev server returning index.html */
    }
    if (res.ok && Array.isArray(data?.route?.path)) return { ok: true, route: data.route };
    if (data?.error === "no_route") return { ok: false, reason: "no_route" };
    return { ok: false, reason: "unavailable" };
  } catch (err) {
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "network" };
  }
}

// getToken is only called if the fallback is needed (fetching a fresh Firebase
// token costs a network round trip, so we don't do it on the normal path).
export async function fetchRoute(mode, from, to, getToken = null) {
  const direct = await fetchRouteDirect(mode, from, to);
  if (direct.ok || direct.reason === "no_route" || direct.reason === "bad_input") return direct;

  const viaServer = await fetchRouteViaServer(getToken ? await getToken() : null, mode, from, to);
  if (viaServer.ok || viaServer.reason === "no_route") return viaServer;
  return direct; // report the original failure: it is the most informative one
}
