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

export async function fetchRoute(mode, from, to) {
  try {
    const res = await fetchWithTimeout(buildRouteUrl(mode, from, to));
    if (!res.ok) return { ok: false, reason: "no_route" };
    return { ok: true, route: parseRoute(await res.json()) };
  } catch (err) {
    if (err?.name === "AbortError") return { ok: false, reason: "timeout" };
    if (err?.message === "no_route") return { ok: false, reason: "no_route" };
    return { ok: false, reason: "network" };
  }
}
