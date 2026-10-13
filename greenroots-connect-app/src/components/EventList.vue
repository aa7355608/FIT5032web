<script setup>
import { ref, computed } from "vue";
import EventCard from "./EventCard.vue";

const props = defineProps({
  events: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  savedIds: { type: Set, required: true },
  suburbs: { type: Array, default: () => [] },
  isLoggedIn: { type: Boolean, default: false },
  currentUserId: { type: String, default: "" },
  hasUserRated: { type: Function, default: () => false },
});

const emit = defineEmits(["toggle-save", "select", "rate"]);

const query = ref("");
const suburbFilter = ref("all");
const sortBy = ref("soonest");

// Fully derived from reactive state — every keystroke/selection here
// recomputes what's rendered without touching the underlying data source.
const filteredEvents = computed(() => {
  let list = props.events.filter((e) => {
    const matchesQuery =
      !query.value.trim() ||
      e.title.toLowerCase().includes(query.value.toLowerCase()) ||
      e.suburb.toLowerCase().includes(query.value.toLowerCase());
    const matchesSuburb = suburbFilter.value === "all" || e.suburb === suburbFilter.value;
    return matchesQuery && matchesSuburb;
  });

  list = [...list].sort((a, b) => {
    if (sortBy.value === "soonest") return new Date(a.date) - new Date(b.date);
    if (sortBy.value === "spots") return b.spotsTotal - b.spotsTaken - (a.spotsTotal - a.spotsTaken);
    return 0;
  });

  return list;
});
</script>

<template>
  <section id="events" class="event-section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="eyebrow">Upcoming events</p>
          <h2>Find something happening near you</h2>
        </div>
        <p class="section-note">
          Data below is fetched asynchronously into reactive state, not hard-coded
          into the page &mdash; try filtering to see it re-render.
        </p>
      </div>

      <div class="controls">
        <div class="field">
          <label for="search">Search</label>
          <input
            id="search"
            v-model="query"
            type="search"
            placeholder="Search by event or suburb&hellip;"
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label for="suburb">Suburb</label>
          <select id="suburb" v-model="suburbFilter">
            <option value="all">All suburbs</option>
            <option v-for="s in suburbs" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="field">
          <label for="sort">Sort by</label>
          <select id="sort" v-model="sortBy">
            <option value="soonest">Soonest first</option>
            <option value="spots">Most spots left</option>
          </select>
        </div>
      </div>

      <p class="result-count" role="status">
        {{ isLoading ? "Loading events\u2026" : `${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"} found` }}
      </p>

      <div v-if="isLoading" class="grid">
        <div class="skeleton" v-for="n in 3" :key="n" aria-hidden="true"></div>
      </div>

      <div v-else-if="filteredEvents.length" class="grid">
        <EventCard
          v-for="event in filteredEvents"
          :key="event.id"
          :event="event"
          :saved="savedIds.has(event.id)"
          :is-logged-in="isLoggedIn"
          :already-rated="hasUserRated(event.id, currentUserId)"
          @toggle-save="emit('toggle-save', $event)"
          @select="emit('select', $event)"
          @rate="emit('rate', $event)"
        />
      </div>

      <div v-else class="empty">
        <p>No events match &ldquo;{{ query }}&rdquo; in {{ suburbFilter === "all" ? "any suburb" : suburbFilter }} right now.</p>
        <button class="btn btn-ghost" type="button" @click="query = ''; suburbFilter = 'all'">Clear filters</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.event-section {
  padding: 64px 0;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.section-head h2 {
  font-size: clamp(24px, 3vw, 32px);
  max-width: 20ch;
}

.section-note {
  max-width: 32ch;
  font-size: 13.5px;
  color: var(--ink-soft);
  font-style: italic;
  margin: 0;
}

.controls {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 18px;
  margin-bottom: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
}

.field input,
.field select {
  border: 1px solid var(--control-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 14.5px;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-body);
}

.field input:focus-visible,
.field select:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.result-count {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--moss);
  margin-bottom: 18px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

.skeleton {
  height: 320px;
  border-radius: var(--radius-md);
  background: linear-gradient(100deg, var(--cream-deep) 30%, #f8f6ec 50%, var(--cream-deep) 70%);
  background-size: 200% 100%;
  animation: shimmer 1.3s ease-in-out infinite;
  border: 1px solid var(--line);
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

.empty {
  text-align: center;
  padding: 48px 24px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--ink-soft);
}

@media (max-width: 980px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 720px) {
  .controls {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
