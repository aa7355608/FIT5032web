// How long a login lasts. Set VITE_AUTH_PERSISTENCE in .env (rebuild after changing):
//   none    (default) login is kept only in memory: EVERY time the page is opened or
//                     refreshed the visitor must log in again. Moving between pages
//                     inside the app does not log you out.
//   tab               login survives a refresh but ends when the tab is closed.
//   browser           login survives closing the browser (the usual "remember me").
export function normalisePersistence(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "tab" || v === "browser" ? v : "none";
}

export const AUTH_PERSISTENCE = normalisePersistence(import.meta.env?.VITE_AUTH_PERSISTENCE);
