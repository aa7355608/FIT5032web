import { ref, computed, onMounted } from "vue";
import { rawEvents } from "../data/events.js";

const SAVED_KEY = "greenroots.savedEvents";

/**
 * Encapsulates the app's one piece of "dynamic data" state (BR B.2):
 *  - events are loaded through a simulated async fetch rather than rendered
 *    straight from a static import, so the list, loading and empty states
 *    are all driven by reactive Vue state;
 *  - which events a visitor has saved is kept in a reactive Set and mirrored
 *    to localStorage, so it survives a page refresh (per the BR B.2 hint).
 */
export function useEvents() {
  const events = ref([]);
  const isLoading = ref(true);
  const loadError = ref(null);
  const savedIds = ref(new Set());

  function loadSavedFromStorage() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) savedIds.value = new Set(JSON.parse(raw));
    } catch (err) {
      // Corrupt/blocked storage shouldn't break the app.
      savedIds.value = new Set();
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...savedIds.value]));
    } catch (err) {
      /* localStorage may be unavailable (e.g. private browsing) — fail silently */
    }
  }

  // Simulates an async fetch (e.g. `fetch('/api/events')`) resolving from the
  // underlying JS data structure in src/data/events.js.
  function fetchEvents() {
    isLoading.value = true;
    loadError.value = null;
    return new Promise((resolve) => {
      setTimeout(() => {
        events.value = rawEvents;
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

  const savedEvents = computed(() => events.value.filter((e) => savedIds.value.has(e.id)));

  const suburbs = computed(() => [...new Set(events.value.map((e) => e.suburb))].sort());

  const treesTotal = computed(() =>
    events.value.reduce((sum, e) => sum + e.spotsTaken * 5, 0)
  );

  onMounted(() => {
    loadSavedFromStorage();
    fetchEvents();
  });

  return {
    events,
    isLoading,
    loadError,
    savedIds,
    savedEvents,
    suburbs,
    treesTotal,
    toggleSaved,
    fetchEvents,
  };
}
