import { ref, computed, onMounted } from "vue";
import { rawEvents } from "../data/events.js";

const SAVED_KEY = "greenroots.savedEvents";
const OVERRIDES_KEY = "greenroots.eventOverrides"; // per-event ratings/status added at runtime
const USER_VOTES_KEY = "greenroots.userVotes"; // which user already rated which event

/**
 * Encapsulates the app's dynamic-data state (BR B.2) plus the aggregated
 * rating feature (BR C.3):
 *  - events are loaded through a simulated async fetch rather than rendered
 *    straight from a static import;
 *  - runtime changes (new ratings, a coordinator publishing/deleting an
 *    event) are layered on top of the base data and persisted to
 *    localStorage, so they survive a page refresh.
 */
export function useEvents() {
  const events = ref([]);
  const isLoading = ref(true);
  const loadError = ref(null);
  const savedIds = ref(new Set());

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* localStorage may be unavailable (e.g. private browsing) */
    }
  }

  function loadSavedFromStorage() {
    savedIds.value = new Set(loadJSON(SAVED_KEY, []));
  }

  function persistSaved() {
    saveJSON(SAVED_KEY, [...savedIds.value]);
  }

  // Merge the static base data with any runtime overrides (extra ratings
  // pushed by users, a coordinator's publish/delete actions).
  function buildEventList() {
    const overrides = loadJSON(OVERRIDES_KEY, {});
    return rawEvents
      .filter((e) => !(overrides[e.id]?.deleted))
      .map((e) => {
        const o = overrides[e.id] || {};
        return {
          ...e,
          status: o.status || e.status || "published",
          ratings: o.ratings ? [...e.ratings, ...o.ratings] : [...e.ratings],
        };
      });
  }

  // Simulates an async fetch (e.g. `fetch('/api/events')`) resolving from
  // the underlying JS data structure in src/data/events.js.
  function fetchEvents() {
    isLoading.value = true;
    loadError.value = null;
    return new Promise((resolve) => {
      setTimeout(() => {
        events.value = buildEventList();
        isLoading.value = false;
        resolve(events.value);
      }, 450);
    });
  }

  function toggleSaved(id) {
    const next = new Set(savedIds.value);
    next.has(id) ? next.delete(id) : next.add(id);
    savedIds.value = next;
    persistSaved();
  }

  // ---------------- Aggregated rating feature (BR C.3) ----------------
  function hasUserRated(eventId, userId) {
    const votes = loadJSON(USER_VOTES_KEY, {});
    return Boolean(votes[userId]?.includes(eventId));
  }

  function submitRating(eventId, value, userId) {
    if (!userId) return { ok: false, reason: "You need to be logged in to rate an event." };
    if (hasUserRated(eventId, userId)) {
      return { ok: false, reason: "You've already rated this event." };
    }
    const score = Math.min(5, Math.max(1, Math.round(value)));

    const overrides = loadJSON(OVERRIDES_KEY, {});
    const entry = overrides[eventId] || {};
    entry.ratings = [...(entry.ratings || []), score];
    overrides[eventId] = entry;
    saveJSON(OVERRIDES_KEY, overrides);

    const votes = loadJSON(USER_VOTES_KEY, {});
    votes[userId] = [...(votes[userId] || []), eventId];
    saveJSON(USER_VOTES_KEY, votes);

    events.value = buildEventList();
    return { ok: true };
  }

  // ---------------- Coordinator management (BR C.2 support) -----------
  function setEventStatus(eventId, status) {
    const overrides = loadJSON(OVERRIDES_KEY, {});
    overrides[eventId] = { ...(overrides[eventId] || {}), status };
    saveJSON(OVERRIDES_KEY, overrides);
    events.value = buildEventList();
  }

  function deleteEvent(eventId) {
    const overrides = loadJSON(OVERRIDES_KEY, {});
    overrides[eventId] = { ...(overrides[eventId] || {}), deleted: true };
    saveJSON(OVERRIDES_KEY, overrides);
    events.value = buildEventList();
  }

  const savedEvents = computed(() => events.value.filter((e) => savedIds.value.has(e.id)));
  const publishedEvents = computed(() => events.value.filter((e) => e.status !== "draft"));
  const suburbs = computed(() => [...new Set(publishedEvents.value.map((e) => e.suburb))].sort());
  const treesTotal = computed(() =>
    publishedEvents.value.reduce((sum, e) => sum + e.spotsTaken * 5, 0)
  );

  onMounted(() => {
    loadSavedFromStorage();
    fetchEvents();
  });

  return {
    events,
    publishedEvents,
    isLoading,
    loadError,
    savedIds,
    savedEvents,
    suburbs,
    treesTotal,
    toggleSaved,
    fetchEvents,
    submitRating,
    hasUserRated,
    setEventStatus,
    deleteEvent,
  };
}
