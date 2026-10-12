// Cloudflare Pages Function: POST /api/send-confirmation
// Wires the real Firebase token check and the SendGrid API into the handler.
//
// Environment (Cloudflare Pages -> Settings -> Variables and Secrets):
//   SENDGRID_API_KEY        (secret)   SendGrid API key with "Mail Send" permission
//   SENDGRID_FROM_EMAIL                a sender verified in SendGrid
//   VITE_FIREBASE_PROJECT_ID           your Firebase project id (same value the app build uses)
import { jwtVerify, createRemoteJWKSet } from "jose";
import { rawEvents } from "../../src/data/events.js";
import { handleSendConfirmation } from "../../server/sendConfirmation.js";

// Google publishes the public keys that sign Firebase ID tokens here.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyToken(token, env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Firebase project id not configured");
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return payload;
}

async function sendMail(env, { to, subject, text, html, attachment }) {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
    const err = new Error("SendGrid is not configured");
    err.code = "not_configured";
    throw err;
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.SENDGRID_FROM_EMAIL, name: "GreenRoots Connect" },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      attachments: [{ ...attachment, disposition: "attachment" }],
    }),
  });
  if (res.status !== 202) throw new Error(`SendGrid responded ${res.status}`);
}

export function onRequestPost({ request, env }) {
  return handleSendConfirmation({ request, env, events: rawEvents, verifyToken, sendMail });
}
