// Cloudflare Pages Function: GET /api/route  (BR E.1 / E.2)
// Fallback for directions when the browser can't reach the routing servers itself.
import { verifyFirebaseToken } from "../../server/firebaseAuth.js";
import { handleRoute } from "../../server/routing.js";

export function onRequestGet({ request, env }) {
  return handleRoute({
    request,
    env,
    verifyToken: verifyFirebaseToken,
    cache: typeof caches !== "undefined" ? caches.default : null,
  });
}
