// Firebase Auth + Firestore backend (BR D.1, and the role store for BR C.2).
//
// - Authentication (passwords, sessions, Google sign-in) is handled entirely
//   by Firebase Auth — this app never sees or stores a password.
// - Each account gets a Firestore document `users/{uid}` holding its role.
//   New accounts are ALWAYS created as "volunteer"; only an existing
//   coordinator can promote someone (enforced by firestore.rules, not just
//   by the UI). The first coordinator is set by hand in the Firebase console.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, updateDoc, collection } from "firebase/firestore";
import { auth, db } from "../../firebase.js";
import { sanitizeText } from "../../utils/sanitize.js";

export const supportsGoogle = true;

let ctx;
let pendingName = ""; // lets the auth-state listener use the name typed at sign-up

function friendlyError(err) {
  switch (err?.code) {
    // Deliberately one generic message for every "bad credentials" case so
    // login never reveals whether an email is registered.
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "That password is too weak. Use at least 8 characters including a number.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return "Something went wrong. Please try again.";
  }
}

async function ensureProfile(fbUser, preferredName) {
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const fallbackName = (fbUser.email || "").split("@")[0];
  const profile = {
    name: sanitizeText(preferredName || fbUser.displayName || fallbackName, { maxLength: 80 }) || "Volunteer",
    email: fbUser.email || "",
    role: "volunteer", // never anything else on creation — see firestore.rules
  };
  await setDoc(ref, profile);
  return profile;
}

function toUser(fbUser, profile) {
  return {
    id: fbUser.uid,
    name: profile.name,
    email: profile.email || fbUser.email || "",
    role: profile.role === "coordinator" ? "coordinator" : "volunteer",
    emailVerified: Boolean(fbUser.emailVerified),
  };
}

async function completeSignIn(fbUser, preferredName) {
  const profile = await ensureProfile(fbUser, preferredName);
  const user = toUser(fbUser, profile);
  ctx.setUser(user); // set explicitly so the router guard sees it immediately
  return user;
}

export function init(context) {
  ctx = context;
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      ctx.setUser(null);
      ctx.markReady();
      return;
    }
    try {
      await completeSignIn(fbUser, pendingName);
    } catch (err) {
      console.error("Could not load the user profile:", err);
      ctx.setError("Couldn't load your profile. Check that the Firestore rules are published.");
      await signOut(auth);
      ctx.setUser(null);
    }
    ctx.markReady();
  });
}

export async function register({ name, email, password }) {
  ctx.setError("");
  try {
    const cleanName = sanitizeText(name, { maxLength: 80 });
    pendingName = cleanName;
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: cleanName });
    await completeSignIn(cred.user, cleanName);
    sendEmailVerification(cred.user).catch(() => {});
    return true;
  } catch (err) {
    ctx.setError(friendlyError(err));
    return false;
  } finally {
    pendingName = "";
  }
}

export async function login({ email, password }) {
  ctx.setError("");
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await completeSignIn(cred.user);
    return true;
  } catch (err) {
    ctx.setError(friendlyError(err));
    return false;
  }
}

export async function loginWithGoogle() {
  ctx.setError("");
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await completeSignIn(cred.user);
    return true;
  } catch (err) {
    ctx.setError(friendlyError(err));
    return false;
  }
}

export async function logout() {
  await signOut(auth);
  ctx.setUser(null);
}

// Coordinator-only: Firestore rules reject these for anyone else.
export async function listUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(userId, role) {
  await updateDoc(doc(db, "users", userId), { role: role === "coordinator" ? "coordinator" : "volunteer" });
}

// A fresh ID token, sent to the server function so it can verify who is
// asking. reload() first so a just-verified email is reflected in the token.
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return user.getIdToken(true);
}

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}
