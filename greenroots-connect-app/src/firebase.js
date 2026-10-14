// Firebase initialisation (BR D.1 — external authentication).
//
// Config comes from Vite env vars (see .env.example). If they are missing,
// `isFirebaseConfigured` is false and the app falls back to the clearly
// labelled local demo auth, so the project still runs straight after
// `npm install`. Firebase web config values are identifiers, not secrets —
// access is protected by Firebase Auth + the Firestore rules in firestore.rules.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { AUTH_PERSISTENCE } from "./authConfig.js";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

const app = isFirebaseConfigured ? initializeApp(config) : null;

// Creating Auth with an explicit persistence means a login saved by an earlier
// visit is never read back, so with the default ("none") every page load starts logged out.
function createAuth() {
  const persistence = {
    none: inMemoryPersistence,
    tab: browserSessionPersistence,
    browser: [indexedDBLocalPersistence, browserLocalPersistence],
  }[AUTH_PERSISTENCE];
  try {
    return initializeAuth(app, { persistence, popupRedirectResolver: browserPopupRedirectResolver });
  } catch {
    return getAuth(app); // already initialised (e.g. dev hot-reload)
  }
}

export const auth = app ? createAuth() : null;
export const db = app ? getFirestore(app) : null;
