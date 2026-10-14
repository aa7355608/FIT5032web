// Local DEMO backend — used only when Firebase isn't configured (no VITE_FIREBASE_*
// env vars). Accounts live in this browser's localStorage, so this is NOT real
// authentication; it exists so the app runs immediately after `npm install`.
// The login page shows a banner whenever this backend is active.
import { hashPassword } from "../../utils/crypto.js";
import { sanitizeText, normalizeEmail } from "../../utils/sanitize.js";
import { AUTH_PERSISTENCE } from "../../authConfig.js";

const USERS_KEY = "greenroots.users";
const SESSION_KEY = "greenroots.session";

export const supportsGoogle = false;

let ctx;

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable */
  }
}

// "none" keeps the login only in memory, so nothing is saved between page loads.
function sessionStore() {
  try {
    if (AUTH_PERSISTENCE === "tab") return sessionStorage;
    if (AUTH_PERSISTENCE === "browser") return localStorage;
  } catch {
    /* storage blocked */
  }
  return null;
}

// Saves/clears the login in whichever store the configured mode allows
// ("none" saves nothing, so a reload always starts logged out).
function persistSession(user) {
  const store = sessionStore();
  if (!store) return;
  try {
    if (user) store.setItem(SESSION_KEY, JSON.stringify(user));
    else store.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

function publicUser(u) {
  const { passwordHash: _omit, ...rest } = u;
  return { ...rest, emailVerified: true };
}

async function ensureSeedAccounts() {
  if (loadUsers().length > 0) return;
  const [volunteerHash, coordinatorHash] = await Promise.all([
    hashPassword("Volunteer1"),
    hashPassword("Coordinator1"),
  ]);
  saveUsers([
    { id: "seed-volunteer", name: "Amara Deng", email: "amara@example.com", passwordHash: volunteerHash, role: "volunteer" },
    { id: "seed-coordinator", name: "Priya Kaur", email: "priya@example.com", passwordHash: coordinatorHash, role: "coordinator" },
  ]);
}

export async function init(context) {
  ctx = context;
  const store = sessionStore();
  try {
    const raw = store?.getItem(SESSION_KEY);
    if (raw) ctx.setUser(JSON.parse(raw));
    // Drop any session left behind by an earlier build that saved logins.
    if (!store) {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    ctx.setUser(null);
  }
  await ensureSeedAccounts();
  ctx.markReady();
}

export async function register({ name, email, password }) {
  ctx.setError("");
  const cleanEmail = normalizeEmail(email);
  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    ctx.setError("An account with that email already exists.");
    return false;
  }
  const newUser = {
    id: `user-${Date.now()}`,
    name: sanitizeText(name, { maxLength: 80 }),
    email: cleanEmail,
    passwordHash: await hashPassword(password),
    role: "volunteer", // new accounts are always volunteers; a coordinator promotes them
  };
  saveUsers([...users, newUser]);
  const user = publicUser(newUser);
  ctx.setUser(user);
  persistSession(user);
  return true;
}

export async function login({ email, password }) {
  ctx.setError("");
  const cleanEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const match = loadUsers().find((u) => u.email === cleanEmail && u.passwordHash === passwordHash);
  if (!match) {
    ctx.setError("Invalid email or password.");
    return false;
  }
  const user = publicUser(match);
  ctx.setUser(user);
  persistSession(user);
  return true;
}

export async function logout() {
  ctx.setUser(null);
  persistSession(null);
}

export async function listUsers() {
  return loadUsers().map(publicUser);
}

export async function updateUserRole(userId, role) {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  users[idx].role = role === "coordinator" ? "coordinator" : "volunteer";
  saveUsers(users);
}

export async function getIdToken() {
  return null; // no server-verifiable identity in demo mode
}

export async function resendVerification() {}
