<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  event: { type: Object, required: true },
  saved: { type: Boolean, default: false },
  isLoggedIn: { type: Boolean, default: false },
  alreadyRated: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-save", "select", "rate"]);

const hoverValue = ref(0);

// Everything here is derived (dynamically computed) from the event data
// object rather than being written by hand per-card.
const spotsLeft = computed(() => props.event.spotsTotal - props.event.spotsTaken);

const status = computed(() => {
  if (spotsLeft.value <= 0) return { label: "Full", tone: "full" };
  if (spotsLeft.value <= 5) return { label: "Almost full", tone: "low" };
  return { label: "Open", tone: "open" };
});

// Aggregated rating (BR C.3): the displayed average recalculates from the
// full ratings array every time a new rating is pushed into it.
const averageRating = computed(() => {
  const list = props.event.ratings || [];
  if (!list.length) return null;
  return list.reduce((sum, r) => sum + r, 0) / list.length;
});

const formattedDate = computed(() =>
  new Date(props.event.date).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
);

const fullStars = computed(() => Math.round(averageRating.value || 0));

function submitRating(value) {
  if (!props.isLoggedIn || props.alreadyRated) return;
  emit("rate", { eventId: props.event.id, value });
}
</script>

<template>
  <article class="card" :class="event.tone">
    <div class="card-top">
      <span class="date-chip">{{ formattedDate }}</span>
      <button
        class="save-btn"
        type="button"
        :aria-pressed="saved"
        :aria-label="saved ? 'Remove from saved events' : 'Save this event'"
        @click="emit('toggle-save', event.id)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z"
            :fill="saved ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.6"
          />
        </svg>
      </button>
    </div>

    <h3>{{ event.title }}</h3>
    <p class="meta">{{ event.suburb }} &middot; {{ event.time }}</p>
    <p class="desc">{{ event.description }}</p>

    <div class="card-foot">
      <div class="rating" v-if="averageRating">
        <span class="stars" aria-hidden="true">
          <svg v-for="n in 5" :key="n" viewBox="0 0 20 20" width="13" height="13">
            <path
              d="M10 1.5l2.6 5.4 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.7l6-.8L10 1.5Z"
              :fill="n <= fullStars ? 'var(--ochre)' : '#e6e0cc'"
            />
          </svg>
        </span>
        <span class="rating-value">{{ averageRating.toFixed(1) }} ({{ event.ratings.length }})</span>
      </div>
      <span v-else class="rating-value muted">No ratings yet</span>

      <span class="status" :class="status.tone">
        {{ status.label }} &middot; {{ spotsLeft }} / {{ event.spotsTotal }} spots
      </span>
    </div>

    <div class="rate-row">
      <span class="rate-label">Rate this event:</span>
      <span
        class="rate-stars"
        :class="{ disabled: !isLoggedIn || alreadyRated }"
        @mouseleave="hoverValue = 0"
      >
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          class="rate-star-btn"
          :disabled="!isLoggedIn || alreadyRated"
          :aria-label="`Rate ${n} out of 5`"
          @mouseenter="hoverValue = n"
          @click="submitRating(n)"
        >
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path
              d="M10 1.5l2.6 5.4 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.7l6-.8L10 1.5Z"
              :fill="n <= hoverValue ? 'var(--ochre)' : '#dcd6c1'"
            />
          </svg>
        </button>
      </span>
      <span v-if="alreadyRated" class="rate-note">You've rated this</span>
      <span v-else-if="!isLoggedIn" class="rate-note">
        <router-link to="/login">Log in</router-link> to rate
      </span>
    </div>

    <button class="btn btn-primary card-cta" type="button" :disabled="spotsLeft <= 0" @click="emit('select', event)">
      {{ spotsLeft <= 0 ? "Event full" : "Register interest" }}
    </button>
  </article>
</template>

<style scoped>
.card {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 22px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
  border-top: 4px solid var(--moss);
  animation: rise 0.5s ease both;
}

.card.ochre { border-top-color: var(--ochre); }
.card.forest { border-top-color: var(--forest); }

@keyframes rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.date-chip {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--forest);
  background: var(--cream-deep);
  padding: 5px 10px;
  border-radius: 999px;
}

.save-btn {
  background: none;
  border: none;
  color: var(--ink-soft);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s ease, transform 0.15s ease;
}

.save-btn:hover {
  color: var(--ochre);
  transform: scale(1.08);
}

.save-btn[aria-pressed="true"] {
  color: var(--ochre);
}

.save-btn:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

h3 {
  font-size: 19px;
  margin-bottom: 4px;
}

.meta {
  font-size: 13px;
  color: var(--moss);
  font-weight: 600;
  margin-bottom: 10px;
}

.desc {
  font-size: 14px;
  color: var(--ink-soft);
  flex-grow: 1;
  margin-bottom: 16px;
}

.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 10px;
  flex-wrap: wrap;
}

.rating {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stars {
  display: inline-flex;
  gap: 1px;
}

.rating-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-soft);
}

.rating-value.muted {
  color: #6b6657;
}

.status {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 4px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.status.open {
  background: #e4efe4;
  color: var(--moss);
}

.status.low {
  background: var(--ochre-light);
  color: #6d4510;
}

.status.full {
  background: #ecdcd7;
  color: var(--error);
}

.rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  padding: 10px;
  background: var(--cream-deep);
  border-radius: var(--radius-sm);
}

.rate-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
  text-transform: uppercase;
}

.rate-stars {
  display: inline-flex;
  gap: 2px;
}

.rate-stars.disabled {
  opacity: 0.6;
}

.rate-star-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  line-height: 0;
}

.rate-star-btn:disabled {
  cursor: not-allowed;
}

.rate-star-btn:focus-visible {
  outline: 2px solid var(--focus);
  border-radius: 3px;
}

.rate-note {
  font-size: 11.5px;
  color: var(--ink-soft);
  margin-left: auto;
}

.rate-note a {
  color: var(--forest);
  font-weight: 600;
}

.card-cta {
  width: 100%;
}
</style>
