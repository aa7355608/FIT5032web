// Defense-in-depth input sanitisation (Business Requirement C.4).
//
// Vue already escapes every `{{ }}` text interpolation by default, which is
// the primary XSS defence in this app — no component in this project uses
// `v-html` on user-supplied content, so the browser never parses a user's
// text as markup in the first place.
//
// On top of that baseline, free-text fields the user controls (their name,
// review/rating comments, etc.) are run through this sanitiser before being
// written into the app's local data store. It strips HTML tags and
// dangerous characters/protocols so that even if that value were ever
// rendered somewhere less safe (e.g. exported, copied into an email, or a
// future `v-html` usage introduced by mistake), it cannot carry an
// executable payload.
export function sanitizeText(input, { maxLength = 200 } = {}) {
  if (typeof input !== "string") return "";

  return input
    .replace(/<[^>]*>/g, "") // strip any HTML/script tags
    .replace(/javascript:/gi, "") // strip dangerous pseudo-protocols
    .replace(/on\w+\s*=/gi, "") // strip inline event handlers (onclick=, onerror=...)
    .replace(/[<>]/g, "") // strip any stray angle brackets
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}
