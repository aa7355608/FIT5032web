// Client side of BR D.2: asks the server function to email a confirmation
// (with an .ics calendar invite attached) to the signed-in user.
//
// Success is only reported when the server explicitly answers { ok: true }.
// This matters: on a dev server /api/... falls back to index.html with HTTP
// 200, which must NOT be mistaken for "email sent".
export async function sendConfirmationEmail(idToken, { eventId, name }) {
  if (!idToken) return { ok: false, reason: "demo_mode" };
  try {
    const res = await fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ eventId, name }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON — e.g. a dev server returning index.html */
    }
    if (res.ok && data?.ok === true) return { ok: true };
    if (data?.error) return { ok: false, reason: data.error };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
