// Cloudflare Pages Function: GET /api/geocode?q=...  (BR E.1 / E.2)
// Optional env var: CONTACT_EMAIL — put in the User-Agent so the geocoding
// service can reach you if your usage ever causes a problem.
import { verifyFirebaseToken } from "../../server/firebaseAuth.js";
import { handleGeocode } from "../../server/geocode.js";

export function onRequestGet({ request, env }) {
  return handleGeocode({
    request,
    env,
    verifyToken: verifyFirebaseToken,
    cache: typeof caches !== "undefined" ? caches.default : null, // Cloudflare's edge cache
  });
}
