import { ref, computed } from "vue";
import { isFirebaseConfigured } from "../firebase.js";
import * as localBackend from "./auth/localBackend.js";
import * as firebaseBackend from "./auth/firebaseBackend.js";

// Firebase Auth (BR D.1) when configured; otherwise the labelled local demo.
const backend = isFirebaseConfigured ? firebaseBackend : localBackend;
export const authMode = isFirebaseConfigured ? "firebase" : "local";

// Module-level singleton state: the router guard, nav bar and every page
// share the same signed-in user.
const currentUser = ref(null);
const authError = ref("");

// Resolves once the initial sign-in state is known, so the router guard
// never makes a decision before Firebase has restored the session.
let markReady;
const authReady = new Promise((resolve) => (markReady = resolve));
setTimeout(() => markReady(), 6000); // safety net: never hang the app on a network stall

backend.init({
  setUser: (user) => (currentUser.value = user),
  setError: (message) => (authError.value = message),
  markReady: () => markReady(),
});

export function useAuth() {
  const isLoggedIn = computed(() => currentUser.value !== null);
  const isCoordinator = computed(() => currentUser.value?.role === "coordinator");

  async function updateUserRole(userId, role) {
    await backend.updateUserRole(userId, role);
    if (currentUser.value?.id === userId) {
      currentUser.value = { ...currentUser.value, role };
    }
  }

  return {
    currentUser,
    isLoggedIn,
    isCoordinator,
    authError,
    authReady,
    authMode,
    supportsGoogle: backend.supportsGoogle,
    register: backend.register,
    login: backend.login,
    loginWithGoogle: backend.loginWithGoogle || (async () => false),
    logout: backend.logout,
    listUsers: backend.listUsers,
    updateUserRole,
    getIdToken: backend.getIdToken,
    resendVerification: backend.resendVerification,
  };
}
