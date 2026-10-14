<script setup>
import { reactive, computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuth } from "../composables/useAuth.js";
import { AUTH_PERSISTENCE } from "../authConfig.js";

const router = useRouter();
const route = useRoute();
const { register, login, loginWithGoogle, authError, authMode, supportsGoogle } = useAuth();

const mode = ref("login"); // "register" | "login" — the site is login-gated, so start on Login
const submitting = ref(false);
const touched = reactive({ name: false, email: false, password: false });

const form = reactive({
  name: "",
  email: "",
  password: "",
});

function switchMode(next) {
  mode.value = next;
  touched.name = touched.email = touched.password = false;
  authError.value = "";
}

// --- Validation type 1: presence / required-field validation -------------
const nameError = computed(() => {
  if (mode.value === "login") return "";
  if (!form.name.trim()) return "Enter your full name.";
  if (form.name.trim().length < 2) return "Name looks too short.";
  return "";
});

// --- Validation type 2: format / pattern validation (regex) --------------
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailError = computed(() => {
  if (!form.email.trim()) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(form.email.trim())) return "Enter a valid email address.";
  return "";
});

// Password rule combines a required check with a pattern check: minimum
// length AND at least one digit — this is the second validation type
// (format/pattern), applied specifically at registration.
const PASSWORD_PATTERN = /^(?=.*\d).{8,}$/;
const passwordError = computed(() => {
  if (!form.password) return "Enter a password.";
  if (mode.value === "register" && !PASSWORD_PATTERN.test(form.password)) {
    return "Password must be at least 8 characters and include a number.";
  }
  return "";
});

const isValid = computed(() => {
  if (mode.value === "login") return !emailError.value && !passwordError.value;
  return !nameError.value && !emailError.value && !passwordError.value;
});

function markTouched(field) {
  touched[field] = true;
}

async function handleSubmit() {
  touched.name = touched.email = touched.password = true;
  if (!isValid.value) return;

  submitting.value = true;
  const ok =
    mode.value === "register"
      ? await register({ name: form.name, email: form.email, password: form.password })
      : await login({ email: form.email, password: form.password });
  submitting.value = false;

  if (ok) goAfterLogin();
}

// Only follow same-site, path-style redirects (blocks open-redirect tricks
// like ?redirect=//evil.example or ?redirect=https://evil.example).
function goAfterLogin() {
  const target = route.query.redirect;
  const safe = typeof target === "string" && target.startsWith("/") && !target.startsWith("//");
  router.push(safe ? target : "/");
}

async function handleGoogle() {
  submitting.value = true;
  const ok = await loginWithGoogle();
  submitting.value = false;
  if (ok) goAfterLogin();
}
</script>

<template>
  <section class="auth-section">
    <div class="container auth-shell">
      <div class="card">
        <h1>{{ mode === "register" ? "Create your account" : "Welcome back" }}</h1>
        <p class="gate-note">
          Please sign in to continue to GreenRoots Connect.
          <template v-if="AUTH_PERSISTENCE === 'none'">For your security you'll be asked to sign in each time you open the site.</template>
        </p>

        <p v-if="authMode === 'local'" class="demo-banner" role="note">
          <strong>Demo mode:</strong> Firebase isn't configured, so accounts are stored in this
          browser only. Add your Firebase keys (see README) to use real external authentication.
        </p>

        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'register'"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            Register
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            Login
          </button>
        </div>

        <form novalidate @submit.prevent="handleSubmit">
          <div v-if="mode === 'register'" class="row">
            <label for="name">Full name</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              autocomplete="name"
              aria-required="true"
              :aria-invalid="Boolean(touched.name && nameError)"
              :aria-describedby="[touched.name && nameError ? 'name-err' : '', ''].filter(Boolean).join(' ') || undefined"
              :class="{ invalid: touched.name && nameError }"
              @blur="markTouched('name')"
            />
            <p v-if="touched.name && nameError" id="name-err" class="field-error">{{ nameError }}</p>
          </div>

          <div class="row">
            <label for="email">Email address</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              aria-required="true"
              :aria-invalid="Boolean(touched.email && emailError)"
              :aria-describedby="[touched.email && emailError ? 'email-err' : '', ''].filter(Boolean).join(' ') || undefined"
              :class="{ invalid: touched.email && emailError }"
              @blur="markTouched('email')"
            />
            <p v-if="touched.email && emailError" id="email-err" class="field-error">{{ emailError }}</p>
          </div>

          <div class="row">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              aria-required="true"
              :aria-invalid="Boolean(touched.password && passwordError)"
              :aria-describedby="[touched.password && passwordError ? 'password-err' : '', mode === 'register' ? 'password-hint' : ''].filter(Boolean).join(' ') || undefined"
              :class="{ invalid: touched.password && passwordError }"
              @blur="markTouched('password')"
            />
            <p v-if="touched.password && passwordError" id="password-err" class="field-error">{{ passwordError }}</p>
            <p v-if="mode === 'register'" id="password-hint" class="hint">
              At least 8 characters, including a number (client-side format validation).
            </p>
          </div>

          <p v-if="authError" class="form-error" role="alert">{{ authError }}</p>

          <button class="btn btn-primary submit-btn" type="submit" :disabled="submitting">
            {{ mode === "register" ? "Create account" : "Log in" }}
          </button>
        </form>

        <template v-if="supportsGoogle">
          <div class="divider"><span>or</span></div>
          <button type="button" class="btn btn-ghost google-btn" :disabled="submitting" @click="handleGoogle">
            Continue with Google
          </button>
        </template>

        <p class="switch-line">
          <template v-if="mode === 'register'">
            Already have an account?
            <button type="button" class="link-btn" @click="switchMode('login')">Log in</button>
          </template>
          <template v-else>
            New here?
            <button type="button" class="link-btn" @click="switchMode('register')">Create an account</button>
          </template>
        </p>

        <div v-if="authMode === 'local'" class="demo-accounts">
          <p class="eyebrow">Demo accounts (for markers)</p>
          <code>amara@example.com / Volunteer1</code>
          <code>priya@example.com / Coordinator1</code>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-section {
  padding: 64px 0 90px;
  min-height: 70vh;
}

.auth-shell {
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 440px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 32px;
  box-shadow: var(--shadow-card);
}

h1 {
  text-align: center;
  font-size: 26px;
  margin-bottom: 22px;
}

.tabs {
  display: flex;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 24px;
}

.tabs button {
  flex: 1;
  padding: 11px;
  border: none;
  background: var(--cream);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
}

.tabs button.active {
  background: var(--forest);
  color: var(--white);
}

.row {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
}

label {
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  margin-bottom: 6px;
}

input[type="text"],
input[type="email"],
input[type="password"] {
  border: 1.5px solid var(--control-border);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  font-size: 15px;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-body);
}

input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-color: var(--moss);
}

input.invalid {
  border-color: var(--error);
  background: #fbf1ee;
}

.field-error {
  color: var(--error);
  font-size: 12.5px;
  margin: 6px 0 0;
}

.hint {
  font-size: 11.5px;
  color: var(--ink-soft);
  font-style: italic;
  margin: 6px 0 0;
}

.gate-note {
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
  margin: -12px 0 20px;
}

.demo-banner {
  background: var(--ochre-light);
  color: #6d4a12;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 12.5px;
  margin: 0 0 20px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 14px;
  color: var(--ink-soft);
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
}

.google-btn {
  width: 100%;
}

.form-error {
  color: var(--error);
  font-size: 13px;
  text-align: center;
  margin: 0 0 14px;
}

.submit-btn {
  width: 100%;
}

.switch-line {
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-soft);
  margin: 18px 0 0;
}

.link-btn {
  background: none;
  border: none;
  color: var(--forest);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  font-size: 13.5px;
}

.demo-accounts {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.demo-accounts code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink-soft);
}
</style>
