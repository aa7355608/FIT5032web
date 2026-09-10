import { ref, computed } from "vue";
import { hashPassword } from "../utils/crypto.js";
import { sanitizeText, normalizeEmail } from "../utils/sanitize.js";

const USERS_KEY = "greenroots.users";
const SESSION_KEY = "greenroots.session";

// Module-level (singleton) reactive state so every component that calls
// useAuth() shares the same logged-in user — this is what lets the router
// guards, the nav bar and the dashboard all agree on who's signed in.
const currentUser = ref(null);
const authError = ref("");

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
    /* localStorage unavailable — fail silently, session just won't persist */
  }
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) currentUser.value = JSON.parse(raw);
  } catch {
    currentUser.value = null;
  }
}

function persistSession(user) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// Seed one demo account per role on first run purely so markers/reviewers
// can log in immediately without registering first.
function ensureSeedAccounts() {
  const users = loadUsers();
  if (users.length > 0) return;
  Promise.all([hashPassword("Volunteer1"), hashPassword("Coordinator1")]).then(
    ([volunteerHash, coordinatorHash]) => {
      saveUsers([
        {
          id: "seed-volunteer",
          name: "Amara Deng",
          email: "amara@example.com",
          passwordHash: volunteerHash,
          role: "volunteer",
        },
        {
          id: "seed-coordinator",
          name: "Priya Kaur",
          email: "priya@example.com",
          passwordHash: coordinatorHash,
          role: "coordinator",
        },
      ]);
    }
  );
}

restoreSession();
ensureSeedAccounts();

export function useAuth() {
  const isLoggedIn = computed(() => currentUser.value !== null);
  const isCoordinator = computed(() => currentUser.value?.role === "coordinator");

  async function register({ name, email, password, role }) {
    authError.value = "";
    const cleanName = sanitizeText(name, { maxLength: 80 });
    const cleanEmail = normalizeEmail(email);
    const users = loadUsers();

    if (users.some((u) => u.email === cleanEmail)) {
      authError.value = "An account with that email already exists.";
      return false;
    }

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: `user-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: role === "coordinator" ? "coordinator" : "volunteer",
    };

    saveUsers([...users, newUser]);
    const { passwordHash: _omit, ...publicUser } = newUser;
    currentUser.value = publicUser;
    persistSession(publicUser);
    return true;
  }

  async function login({ email, password }) {
    authError.value = "";
    const cleanEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    const users = loadUsers();
    const match = users.find((u) => u.email === cleanEmail && u.passwordHash === passwordHash);

    // Deliberately generic error message — never confirm whether the email
    // exists, which would leak account information to an attacker.
    if (!match) {
      authError.value = "Invalid email or password.";
      return false;
    }

    const { passwordHash: _omit, ...publicUser } = match;
    currentUser.value = publicUser;
    persistSession(publicUser);
    return true;
  }

  function logout() {
    currentUser.value = null;
    persistSession(null);
  }

  // Coordinator-only: list all registered users (never exposes password hashes)
  // and allow changing a user's role — backs the "Manage Users & Roles" screen.
  function listUsers() {
    return loadUsers().map(({ passwordHash: _omit, ...u }) => u);
  }

  function updateUserRole(userId, role) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    users[idx].role = role === "coordinator" ? "coordinator" : "volunteer";
    saveUsers(users);
    if (currentUser.value?.id === userId) {
      currentUser.value = { ...currentUser.value, role: users[idx].role };
      persistSession(currentUser.value);
    }
  }

  return {
    currentUser,
    isLoggedIn,
    isCoordinator,
    authError,
    register,
    login,
    logout,
    listUsers,
    updateUserRole,
  };
}
