<script setup>
import { reactive, ref, computed, watch } from "vue";
import { sanitizeText } from "../utils/sanitize.js";
import { useAuth } from "../composables/useAuth.js";
import { sendConfirmationEmail } from "../services/emailService.js";

const props = defineProps({
  events: { type: Array, default: () => [] },
  preselectedEventId: { type: String, default: "" },
});

const { currentUser, getIdToken, resendVerification } = useAuth();

const form = reactive({
  name: currentUser.value?.name || "",
  phone: "",
  eventId: "",
});

// The confirmation email goes to the signed-in account's own (verified)
// address — the server enforces this too — so the field is read-only.
const accountEmail = computed(() => currentUser.value?.email || "");

const touched = reactive({ name: false, phone: false, eventId: false });
const submitted = ref(false);
const sending = ref(false);
const confirmation = ref(null);
const verificationSent = ref(false);

watch(
  () => props.preselectedEventId,
  (id) => {
    if (id) form.eventId = id;
  },
  { immediate: true }
);

// --- Validation type 1: presence / required-field validation -------------
const nameError = computed(() => {
  if (!form.name.trim()) return "Enter your full name.";
  if (form.name.trim().length < 2) return "Name looks too short.";
  return "";
});

const eventError = computed(() => (!form.eventId ? "Choose an event to register for." : ""));

// --- Validation type 2: format / pattern validation (regex) --------------
const PHONE_PATTERN = /^(\+?61|0)[2-478]\d{8}$/;
const phoneError = computed(() => {
  if (!form.phone.trim()) return ""; // optional field
  const digitsOnly = form.phone.replace(/\s/g, "");
  if (!PHONE_PATTERN.test(digitsOnly)) return "Enter a valid Australian phone number, e.g. 0412 345 678.";
  return "";
});

const isValid = computed(() => !nameError.value && !eventError.value && !phoneError.value);

function markTouched(field) {
  touched[field] = true;
}

const EMAIL_MESSAGES = {
  demo_mode: "Registered. Confirmation emails need Firebase sign-in, which isn't configured in demo mode.",
  email_not_verified: "Registered, but we couldn't email you: please verify your email address first.",
  email_not_configured: "Registered, but the email service isn't set up on this server yet.",
  unavailable: "Registered, but the email service isn't available here (it runs on the deployed site).",
  network: "Registered, but we couldn't reach the email service. Check your connection.",
};

async function handleSubmit() {
  submitted.value = true;
  touched.name = touched.phone = touched.eventId = true;
  if (!isValid.value || sending.value) return;

  const chosenEvent = props.events.find((e) => e.id === form.eventId);
  // Defense-in-depth (BR C.4): Vue escapes on render, and free text is also sanitised.
  const cleanName = sanitizeText(form.name.trim(), { maxLength: 80 });

  sending.value = true;
  const idToken = await getIdToken();
  const result = await sendConfirmationEmail(idToken, { eventId: form.eventId, name: cleanName });
  sending.value = false;

  confirmation.value = {
    name: cleanName,
    eventTitle: chosenEvent ? chosenEvent.title : "an upcoming event",
    emailSent: result.ok,
    email: accountEmail.value,
    needsVerification: result.reason === "email_not_verified",
    note: result.ok ? "" : EMAIL_MESSAGES[result.reason] || "Registered, but the confirmation email couldn't be sent.",
  };

  form.phone = "";
  form.eventId = "";
  submitted.value = false;
  touched.name = touched.phone = touched.eventId = false;
}

async function handleResend() {
  await resendVerification();
  verificationSent.value = true;
}
</script>

<template>
  <section id="volunteer" class="volunteer-section">
    <div class="container form-shell">
      <div class="form-intro">
        <p class="eyebrow">Register</p>
        <h2>Put your hand up for a planting day</h2>
        <p>
          Tell us who you are and which event suits you &mdash; we'll follow up with
          exact meeting points and what to bring. Fields are checked as you type,
          against two different rules: a required-field check and a
          format/pattern check. A confirmation email with a calendar invite
          attached is sent to your account address.
        </p>
      </div>

      <div class="form-col">
      <form class="form-card" novalidate @submit.prevent="handleSubmit">
        <div class="form-row">
          <label for="name">Full name</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            autocomplete="name"
            aria-required="true"
            :aria-describedby="touched.name && nameError ? 'name-err' : undefined"
            :aria-invalid="Boolean(touched.name && nameError)"
            :class="{ invalid: touched.name && nameError }"
            @blur="markTouched('name')"
          />
          <p v-if="touched.name && nameError" id="name-err" class="field-error">{{ nameError }}</p>
        </div>

        <div class="form-row two-col">
          <div>
            <label for="email">Email (your account)</label>
            <input id="email" :value="accountEmail" type="email" readonly class="locked" autocomplete="email" />
          </div>
          <div>
            <label for="phone">Phone <span class="optional">(optional)</span></label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              :aria-describedby="touched.phone && phoneError ? 'phone-err' : undefined"
              placeholder="04xx xxx xxx"
              :aria-invalid="Boolean(touched.phone && phoneError)"
              :class="{ invalid: touched.phone && phoneError }"
              @blur="markTouched('phone')"
            />
            <p v-if="touched.phone && phoneError" id="phone-err" class="field-error">{{ phoneError }}</p>
          </div>
        </div>

        <div class="form-row">
          <label for="event">Which event?</label>
          <select
            id="event"
            v-model="form.eventId"
            aria-required="true"
            :aria-describedby="touched.eventId && eventError ? 'event-err' : undefined"
            :aria-invalid="Boolean(touched.eventId && eventError)"
            :class="{ invalid: touched.eventId && eventError }"
            @blur="markTouched('eventId')"
          >
            <option value="" disabled>Select an upcoming event&hellip;</option>
            <option v-for="e in events" :key="e.id" :value="e.id">
              {{ e.title }} &mdash; {{ e.suburb }}
            </option>
          </select>
          <p v-if="touched.eventId && eventError" id="event-err" class="field-error">{{ eventError }}</p>
        </div>

        <button class="btn btn-primary submit-btn" type="submit" :disabled="sending">
          {{ sending ? "Registering\u2026" : "Register my interest" }}
        </button>
        <p class="email-note">
          We'll email a confirmation with a calendar invite (.ics) attached to your account address.
        </p>

        <p v-if="submitted && !isValid" class="form-summary-error" role="alert">
          Please fix the highlighted fields above before submitting.
        </p>
      </form>

      <transition name="fade">
        <div v-if="confirmation" class="confirmation" role="status">
          <strong>Thanks, {{ confirmation.name }}!</strong>
          <span v-if="confirmation.emailSent">
            You're registered for {{ confirmation.eventTitle }}. Confirmation sent to
            {{ confirmation.email }} with a calendar invite attached.
          </span>
          <span v-else>You're registered for {{ confirmation.eventTitle }}. {{ confirmation.note }}</span>
          <button
            v-if="confirmation.needsVerification && !verificationSent"
            type="button"
            class="resend"
            @click="handleResend"
          >
            Resend verification email
          </button>
          <span v-if="verificationSent">Verification email sent — check your inbox, then register again.</span>
          <button class="dismiss" type="button" @click="confirmation = null" aria-label="Dismiss">&times;</button>
        </div>
      </transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.volunteer-section {
  padding: 64px 0 88px;
  background: var(--cream-deep);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.form-shell {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 48px;
  align-items: start;
  position: relative;
}

.form-intro h2 {
  font-size: clamp(24px, 3vw, 30px);
  max-width: 16ch;
}

.form-intro p {
  color: var(--ink-soft);
  font-size: 14.5px;
  max-width: 40ch;
}

.form-col {
  min-width: 0;
}

.form-card {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 28px;
  box-shadow: var(--shadow-card);
}

.form-row {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.two-col > div {
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

.optional {
  text-transform: none;
  letter-spacing: 0;
  font-style: italic;
}

input,
select {
  width: 100%;
  min-width: 0;
  border: 1.5px solid var(--control-border);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  font-size: 15px;
  font-family: var(--font-body);
  background: var(--cream);
  color: var(--ink);
}

input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-color: var(--moss);
}

input.invalid,
select.invalid {
  border-color: var(--error);
  background: #fbf1ee;
}

.field-error {
  color: var(--error);
  font-size: 12.5px;
  margin: 6px 0 0;
}

.submit-btn {
  width: 100%;
  margin-top: 6px;
}

input.locked {
  background: var(--cream-deep);
  color: var(--ink-soft);
  cursor: not-allowed;
}

.email-note {
  font-size: 12px;
  color: var(--ink-soft);
  text-align: center;
  margin: 12px 0 0;
}

.confirmation :focus-visible {
  outline-color: var(--white);
}

.resend {
  align-self: flex-start;
  margin-top: 6px;
  background: none;
  border: 1px solid var(--moss-light);
  color: var(--white);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.form-summary-error {
  color: var(--error);
  font-size: 13px;
  text-align: center;
  margin: 12px 0 0;
}

.confirmation {
  position: relative;
  margin-top: 18px;
  background: var(--forest);
  color: var(--white);
  padding: 16px 40px 16px 18px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-card);
}

.confirmation span {
  font-size: 13px;
  opacity: 0.9;
}

.dismiss {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: var(--white);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 900px) {
  .form-shell {
    grid-template-columns: minmax(0, 1fr);
  }

}

@media (max-width: 560px) {
  .two-col {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
