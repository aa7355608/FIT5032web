<script setup>
import { reactive, computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const router = useRouter();
const route = useRoute();
const { register, login, authError } = useAuth();

const mode = ref("register"); // "register" | "login"
const submitting = ref(false);
const touched = reactive({ name: false, email: false, password: false });

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "volunteer",
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
      ? await register({ name: form.name, email: form.email, password: form.password, role: form.role })
      : await login({ email: form.email, password: form.password });
  submitting.value = false;

  if (ok) {
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    router.push(redirect);
  }
}
</script>

<template>
  <section class="auth-section">
    <div class="container auth-shell">
      <div class="card">
        <h1>{{ mode === "register" ? "Create your account" : "Welcome back" }}</h1>

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
              :class="{ invalid: touched.name && nameError }"
              @blur="markTouched('name')"
            />
            <p v-if="touched.name && nameError" class="field-error">{{ nameError }}</p>
          </div>

          <div class="row">
            <label for="email">Email address</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              :class="{ invalid: touched.email && emailError }"
              @blur="markTouched('email')"
            />
            <p v-if="touched.email && emailError" class="field-error">{{ emailError }}</p>
          </div>

          <div class="row">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              :class="{ invalid: touched.password && passwordError }"
              @blur="markTouched('password')"
            />
            <p v-if="touched.password && passwordError" class="field-error">{{ passwordError }}</p>
            <p v-if="mode === 'register'" class="hint">
              At least 8 characters, including a number (client-side format validation).
            </p>
          </div>

          <div v-if="mode === 'register'" class="row">
            <label>I am registering as</label>
            <div class="role-choice">
              <label class="role-option" :class="{ selected: form.role === 'volunteer' }">
                <input type="radio" value="volunteer" v-model="form.role" />
                Volunteer
              </label>
              <label class="role-option" :class="{ selected: form.role === 'coordinator' }">
                <input type="radio" value="coordinator" v-model="form.role" />
                Coordinator
              </label>
            </div>
            <p class="hint">Role determines which pages your account can access after login.</p>
          </div>

          <p v-if="authError" class="form-error" role="alert">{{ authError }}</p>

          <button class="btn btn-primary submit-btn" type="submit" :disabled="submitting">
            {{ mode === "register" ? "Create account" : "Log in" }}
          </button>
        </form>

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

        <div class="demo-accounts">
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
  border: 1.5px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  font-size: 15px;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-body);
}

input:focus-visible {
  outline: 2px solid var(--ochre);
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

.role-choice {
  display: flex;
  gap: 10px;
}

.role-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1.5px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-family: var(--font-body);
  text-transform: none;
  letter-spacing: 0;
  font-size: 13.5px;
  color: var(--ink);
  cursor: pointer;
}

.role-option.selected {
  border-color: var(--moss);
  background: #eef4ee;
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
