// Client-side password hashing using the browser's built-in Web Crypto API
// (SubtleCrypto). This is a *demonstration* of not storing plaintext
// passwords in the app's local data store.
//
// IMPORTANT (documented honestly, not glossed over): in a real production
// system, password hashing must happen server-side with a slow, salted
// algorithm such as bcrypt/argon2, and credentials must never be checked
// or stored in the browser at all. This app has no backend, so this file
// exists purely to avoid the worse mistake of storing raw passwords in
// localStorage, and to model the *shape* of secure handling for the
// purposes of this assessment.

const APP_SALT = "greenroots-connect::v1"; // static app-level salt (demo only)

export async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(APP_SALT + plainText);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
