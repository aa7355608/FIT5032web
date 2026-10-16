<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEvents } from "../composables/useEvents.js";
import { useAuth } from "../composables/useAuth.js";
import PaginationNav from "../components/PaginationNav.vue";
import { paginate, totalPages } from "../utils/tableLogic.js";
import {
  MELBOURNE_WEST,
  ROUTE_MODES,
  isValidLatLng,
  withDistance,
  formatDistance,
  formatDuration,
} from "../utils/geo.js";
import { searchPlaces, fetchRoute } from "../services/geoService.js";

// Map features (BR E.2):
//  1. Events map: every planting event as a keyboard-reachable pin with a popup.
//  2. Find near me: pick a starting point (search a place, use device location,
//     or click the map); events re-sort nearest-first with distances + a radius filter.
//  3. Directions: turn-by-turn walking / cycling / driving route to an event,
//     drawn on the map and listed as text steps.
// The event list is the text alternative to the map (WCAG 1.1.1 / 2.1.1).

const { publishedEvents } = useEvents();
const { getIdToken } = useAuth();

const PAGE_SIZE = 5;

const mapEl = ref(null);
const routeBlockEl = ref(null);
const routeHeadingEl = ref(null);
const noticeEl = ref(null);
const query = ref("");
const placeResults = ref([]);
const searching = ref(false);
const origin = ref(null); // { lat, lng, label }
const radius = ref("any");
const mode = ref("walk");
const selectedId = ref("");
const route = ref(null);
const routeLoading = ref(false);
const status = ref("");
const notice = ref(null); // { kind: "origin" | "error", text } — shown right above the event list
const pickMode = ref(false);
const listPage = ref(1);

let map = null;
let markerLayer = null;
let originMarker = null;
let routeLine = null;
let markersById = {};
let routeRequestId = 0;
let pendingDirections = null; // an event the user asked directions to before choosing a start

const SEARCH_ERRORS = {
  not_signed_in:
    "Place search needs a Firebase sign-in (it isn't available in demo mode). Use \"Use my location\" or \"Pick start on map\" instead.",
  unavailable:
    "Place search runs on the serverless function, which isn't available here. It works on the deployed site. Meanwhile, use \"Use my location\" or \"Pick start on map\".",
  timeout: "The place search took too long. Please try again.",
  network: "Couldn't reach the place search. Check your connection.",
  bad_query: "Enter a suburb or address (2 to 120 characters).",
  default: "The place search is busy right now. Please try again shortly.",
};

const ROUTE_ERRORS = {
  timeout: "Directions are taking too long. Please try again.",
  network: "Couldn't reach the directions service. Please try again in a moment.",
  no_route:
    "No route was found between your starting point and this event for that travel mode. Try a different starting point or travel mode.",
  unavailable: "Couldn't reach the directions service, and the backup service isn't available here. Please try again in a moment.",
};

function routeErrorText(reason) {
  if (ROUTE_ERRORS[reason]) return ROUTE_ERRORS[reason];
  const m = /^http_(\d+)$/.exec(reason || "");
  if (m) return `The directions service returned an error (${m[1]}). Please try again in a moment.`;
  return ROUTE_ERRORS.network;
}

const listedEvents = computed(() => {
  let list = withDistance(
    publishedEvents.value.filter((e) => isValidLatLng(e.lat, e.lng)),
    origin.value
  );
  if (origin.value && radius.value !== "any") {
    list = list.filter((e) => e.distanceKm <= Number(radius.value));
  }
  return list.sort((a, b) => (origin.value ? a.distanceKm - b.distanceKm : a.date.localeCompare(b.date)));
});

// The list is paged; pin numbers and list numbers both use the rank in the FULL list.
const pages = computed(() => totalPages(listedEvents.value.length, PAGE_SIZE));
const currentPage = computed(() => Math.min(listPage.value, pages.value));
const pageStart = computed(() => (currentPage.value - 1) * PAGE_SIZE);
const pagedList = computed(() => paginate(listedEvents.value, currentPage.value, PAGE_SIZE));
const rangeText = computed(() => {
  const total = listedEvents.value.length;
  if (!total) return "";
  const from = pageStart.value + 1;
  const to = Math.min(pageStart.value + PAGE_SIZE, total);
  return pages.value > 1 ? `Showing ${from}\u2013${to} of ${total} events` : `${total} event${total === 1 ? "" : "s"}`;
});

const shortLabel = (name) => name.split(",").slice(0, 2).join(",").trim();
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrowLayout = () => window.matchMedia("(max-width: 900px)").matches;

// ---------- map drawing ----------

function buildPopup(e) {
  const wrap = document.createElement("div");
  wrap.className = "map-popup";
  const h = document.createElement("h3");
  h.textContent = e.title; // textContent, never innerHTML: nothing here can inject markup
  const when = document.createElement("p");
  when.textContent = `${fmtDate(e.date)} · ${e.time}`;
  const spots = document.createElement("p");
  spots.textContent = `${e.spotsTotal - e.spotsTaken} of ${e.spotsTotal} spots left`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "popup-btn";
  btn.textContent = "Get directions";
  btn.addEventListener("click", () => getDirections(e));
  wrap.append(h, when, spots, btn);
  return wrap;
}

function showEventInList(e) {
  const idx = listedEvents.value.findIndex((x) => x.id === e.id);
  if (idx >= 0) listPage.value = Math.floor(idx / PAGE_SIZE) + 1;
}

function renderMarkers() {
  if (!map) return;
  markerLayer.clearLayers();
  markersById = {};
  listedEvents.value.forEach((e, i) => {
    const marker = L.marker([e.lat, e.lng], {
      icon: L.divIcon({
        className: "ev-pin",
        html: `<span aria-hidden="true">${i + 1}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      }),
      keyboard: true,
      title: e.title,
    });
    marker.bindPopup(() => buildPopup(e), { minWidth: 210 });
    marker.on("click", () => {
      selectedId.value = e.id;
      showEventInList(e); // jump the list to this event's page
    });
    marker.addTo(markerLayer);
    marker.getElement()?.setAttribute("aria-label", `${i + 1}. ${e.title}, ${e.suburb}`);
    markersById[e.id] = marker;
  });
  markSelected();
}

function markSelected() {
  for (const [id, marker] of Object.entries(markersById)) {
    marker.getElement()?.classList.toggle("is-selected", id === selectedId.value);
  }
}

function fitView() {
  if (!map) return;
  const points = listedEvents.value.map((e) => [e.lat, e.lng]);
  if (origin.value) points.push([origin.value.lat, origin.value.lng]);
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
}

function clearRoute() {
  routeRequestId++;
  routeLoading.value = false;
  route.value = null;
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
  }
}

function setOrigin(o) {
  origin.value = o;
  placeResults.value = [];
  notice.value = null;
  originMarker?.remove();
  originMarker = L.marker([o.lat, o.lng], {
    icon: L.divIcon({ className: "origin-pin", html: "<span>You</span>", iconSize: [46, 26], iconAnchor: [23, 13] }),
    interactive: false,
    keyboard: false,
  }).addTo(map);
  originMarker.getElement()?.setAttribute("aria-hidden", "true"); // announced in the panel and status text instead
  clearRoute();
  nextTick(() => {
    renderMarkers();
    fitView();
    status.value = `Starting point set to ${shortLabel(o.label)}. ${listedEvents.value.length} event${
      listedEvents.value.length === 1 ? "" : "s"
    } shown, nearest first.`;
    // The user already asked for directions: carry on automatically.
    if (pendingDirections) {
      const e = pendingDirections;
      pendingDirections = null;
      getDirections(e);
    }
  });
}

function clearOrigin() {
  origin.value = null;
  originMarker?.remove();
  originMarker = null;
  pendingDirections = null;
  clearRoute();
  radius.value = "any";
  nextTick(() => {
    renderMarkers();
    fitView();
    status.value = "Starting point cleared.";
  });
}

// ---------- choosing a starting point ----------

async function runSearch() {
  const q = query.value.trim();
  if (q.length < 2) {
    status.value = SEARCH_ERRORS.bad_query;
    return;
  }
  searching.value = true;
  placeResults.value = [];
  status.value = "Searching…";
  const res = await searchPlaces(await getIdToken(), q);
  searching.value = false;
  if (!res.ok) {
    status.value = SEARCH_ERRORS[res.reason] || SEARCH_ERRORS.default;
    return;
  }
  if (res.results.length === 0) {
    status.value = `No places found for "${q}" in Greater Melbourne.`;
    return;
  }
  placeResults.value = res.results;
  status.value = `${res.results.length} place${res.results.length === 1 ? "" : "s"} found. Choose one to use as your starting point.`;
}

function useMyLocation() {
  if (!("geolocation" in navigator)) {
    status.value = "Your browser doesn't support location. Try \"Pick start on map\" instead.";
    return;
  }
  status.value = "Finding your location…";
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" }),
    (err) => {
      status.value =
        err.code === 1
          ? "Location permission was denied. Try \"Pick start on map\" or search for a place instead."
          : "Couldn't get your location (many desktop computers can't). Try \"Pick start on map\" or search for a place instead.";
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function onMapPick(ev) {
  pickMode.value = false;
  map.getContainer().classList.remove("picking");
  setOrigin({ lat: ev.latlng.lat, lng: ev.latlng.lng, label: "Point you picked on the map" });
}

function startPick() {
  pickMode.value = true;
  map.getContainer().classList.add("picking");
  map.once("click", onMapPick);
  status.value = "Click anywhere on the map to set your starting point.";
  if (isNarrowLayout()) mapEl.value?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
}

function cancelPick() {
  pickMode.value = false;
  map.off("click", onMapPick);
  map.getContainer().classList.remove("picking");
  status.value = "Picking cancelled.";
}

function focusSearch() {
  const el = document.getElementById("place-q");
  el?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  el?.focus({ preventScroll: true });
}

// ---------- events & directions ----------

function focusEvent(e) {
  selectedId.value = e.id;
  map.setView([e.lat, e.lng], Math.max(map.getZoom(), 13));
  markersById[e.id]?.openPopup();
}

function showNotice(next) {
  notice.value = next;
  nextTick(() => noticeEl.value?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }));
}

function revealRoute() {
  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  // Phone layout: the map sits above the list, so bring it into view. Desktop: the map is sticky, show the steps.
  if (isNarrowLayout()) mapEl.value?.scrollIntoView({ behavior, block: "center" });
  else routeBlockEl.value?.scrollIntoView({ behavior, block: "nearest" });
  routeHeadingEl.value?.focus({ preventScroll: true });
}

async function getDirections(e) {
  if (!origin.value) {
    // Remember what they wanted, and make the next step obvious instead of failing quietly.
    pendingDirections = e;
    status.value = "Choose a starting point first.";
    showNotice({ kind: "origin", text: `To get directions to "${e.title}", we need to know where you're starting from.` });
    return;
  }
  notice.value = null;
  selectedId.value = e.id;
  showEventInList(e);
  const myRequest = ++routeRequestId;
  routeLoading.value = true;
  status.value = `Finding ${ROUTE_MODES[mode.value].label.toLowerCase()} directions to ${e.title}…`;
  const res = await fetchRoute(mode.value, origin.value, e, getIdToken);
  if (myRequest !== routeRequestId) return; // a newer request replaced this one
  routeLoading.value = false;
  if (!res.ok) {
    route.value = null;
    routeLine?.remove();
    routeLine = null;
    const text = routeErrorText(res.reason);
    status.value = text;
    showNotice({ kind: "error", text });
    return;
  }
  route.value = { ...res.route, event: e, mode: mode.value };
  routeLine?.remove();
  routeLine = L.polyline(res.route.path, { color: "#1f3d2b", weight: 6, opacity: 0.85, interactive: false }).addTo(map);
  map.closePopup();
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  status.value = `${ROUTE_MODES[mode.value].label} route to ${e.title}: ${formatDistance(res.route.distanceKm)}, about ${formatDuration(res.route.durationS)}.`;
  await nextTick();
  revealRoute();
}

// ---------- reactivity & lifecycle ----------

watch(listedEvents, renderMarkers);
watch(selectedId, markSelected);
watch([origin, radius], () => (listPage.value = 1)); // a new starting point or filter restarts the list at page 1
watch(radius, () => nextTick(fitView));
watch(mode, () => {
  if (route.value) getDirections(route.value.event);
});

onMounted(() => {
  map = L.map(mapEl.value, { center: MELBOURNE_WEST, zoom: 11 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  renderMarkers();
  fitView();
});

onBeforeUnmount(() => {
  routeRequestId++;
  map?.remove();
  map = null;
});
</script>

<template>
  <section class="map-page">
    <div class="container">
      <p class="eyebrow">Explore the map</p>
      <h1>Find a planting day near you</h1>
      <p class="intro">
        Pins show upcoming events. Choose a starting point to see which are closest, then get walking,
        cycling or driving directions. The event list works as a text version of the map.
      </p>

      <div class="layout">
        <div class="search-block">
          <form role="search" aria-label="Find a place" class="search" @submit.prevent="runSearch">
            <label for="place-q">Search a suburb or address</label>
            <div class="search-row">
              <input
                id="place-q"
                v-model="query"
                type="search"
                maxlength="120"
                autocomplete="off"
                placeholder="e.g. Footscray"
              />
              <button type="submit" class="btn btn-primary" :disabled="searching">
                {{ searching ? "Searching…" : "Search" }}
              </button>
            </div>
            <div class="alt-row">
              <button type="button" class="btn btn-ghost small" @click="useMyLocation">Use my location</button>
              <button
                type="button"
                class="btn btn-ghost small"
                :aria-pressed="pickMode"
                @click="pickMode ? cancelPick() : startPick()"
              >
                {{ pickMode ? "Cancel picking" : "Pick start on map" }}
              </button>
            </div>
          </form>

          <p class="status" role="status" aria-live="polite">{{ status }}</p>

          <ul v-if="placeResults.length" class="place-results" aria-label="Place search results">
            <li v-for="r in placeResults" :key="`${r.lat},${r.lng}`">
              <button type="button" @click="setOrigin({ lat: r.lat, lng: r.lng, label: r.name })">{{ r.name }}</button>
            </li>
          </ul>

          <p v-if="origin" class="origin-line">
            <strong>Starting point:</strong> {{ shortLabel(origin.label) }}
            <button type="button" class="link-btn" @click="clearOrigin">Clear</button>
          </p>

          <fieldset class="opts" :disabled="!origin">
            <legend>Show events within</legend>
            <label v-for="r in ['5', '10', '25', 'any']" :key="r" class="opt">
              <input v-model="radius" type="radio" name="radius" :value="r" />
              {{ r === "any" ? "Any distance" : `${r} km` }}
            </label>
            <p v-if="!origin" class="hint">Set a starting point to use this filter.</p>
          </fieldset>

          <fieldset class="opts">
            <legend>Travel mode for directions</legend>
            <label v-for="(m, key) in ROUTE_MODES" :key="key" class="opt">
              <input v-model="mode" type="radio" name="mode" :value="key" />
              {{ m.label }}
            </label>
          </fieldset>
        </div>

        <div class="map-block">
          <div
            ref="mapEl"
            class="map"
            role="region"
            aria-label="Map of upcoming planting events. Arrow keys pan and plus or minus zoom. The event list has the same information as text."
          ></div>
        </div>

        <div class="route-block">
          <section v-if="route" ref="routeBlockEl" class="route-card" aria-labelledby="route-heading">
            <h2 id="route-heading" ref="routeHeadingEl" tabindex="-1">
              {{ ROUTE_MODES[route.mode].label }} directions to {{ route.event.title }}
            </h2>
            <p class="route-summary">
              {{ formatDistance(route.distanceKm) }} · about {{ formatDuration(route.durationS) }}
            </p>
            <ol class="steps">
              <li v-for="(s, i) in route.steps" :key="i">
                {{ s.text }}
                <span v-if="s.distanceM" class="step-dist">({{ formatDistance(s.distanceM / 1000) }})</span>
              </li>
            </ol>
            <button type="button" class="btn btn-ghost small" @click="clearRoute">Clear route</button>
          </section>
        </div>

        <div class="list-block">
          <h2 id="events-heading">{{ origin ? "Events, nearest first" : "Upcoming events" }}</h2>

          <div v-if="notice" ref="noticeEl" class="notice" :class="notice.kind" role="alert">
            <p>
              <strong>{{ notice.kind === "origin" ? "Choose a starting point first." : "Couldn't get directions." }}</strong>
              {{ notice.text }}
            </p>
            <div v-if="notice.kind === 'origin'" class="notice-actions">
              <button type="button" class="btn btn-primary small" @click="useMyLocation">Use my location</button>
              <button type="button" class="btn btn-ghost small" @click="startPick">Pick on map</button>
              <button type="button" class="btn btn-ghost small" @click="focusSearch">Search a place</button>
            </div>
            <button v-else type="button" class="link-btn" @click="notice = null">Dismiss</button>
          </div>

          <p v-if="listedEvents.length === 0" class="hint">No events match. Try a larger distance.</p>
          <p v-else class="hint" role="status">{{ rangeText }}</p>

          <ol
            class="event-list"
            aria-labelledby="events-heading"
            :start="pageStart + 1"
            :style="{ counterReset: `pin ${pageStart}` }"
          >
            <li v-for="e in pagedList" :key="e.id" :class="{ active: selectedId === e.id }">
              <button type="button" class="event-btn" @click="focusEvent(e)">{{ e.title }}</button>
              <p class="meta">
                {{ e.suburb }} · {{ fmtDate(e.date) }}
                <span v-if="e.distanceKm != null"> · {{ formatDistance(e.distanceKm) }} away</span>
              </p>
              <button
                type="button"
                class="btn btn-ghost small"
                :disabled="routeLoading"
                :aria-label="`Get directions to ${e.title}`"
                @click="getDirections(e)"
              >
                {{ routeLoading && selectedId === e.id ? "Finding route…" : "Directions" }}
              </button>
            </li>
          </ol>

          <PaginationNav v-model:page="listPage" :pages="pages" label="Events" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-page {
  padding: 56px 0 56px;
}

h1 {
  font-size: clamp(26px, 3.4vw, 38px);
  max-width: 24ch;
}

.intro {
  color: var(--ink-soft);
  max-width: 64ch;
  margin-bottom: 28px;
}

.layout {
  display: grid;
  grid-template-columns: 370px minmax(0, 1fr);
  grid-template-areas:
    "search map"
    "route map"
    "list map";
  grid-template-rows: auto auto 1fr;
  column-gap: 28px;
  align-items: start;
}

.search-block {
  grid-area: search;
  min-width: 0;
  margin-bottom: 24px;
}

/* On desktop the map stays in view while you scroll the event list */
.map-block {
  grid-area: map;
  min-width: 0;
  position: sticky;
  top: 84px;
  align-self: start;
}

.route-block {
  grid-area: route;
  min-width: 0;
}

.route-block:empty {
  display: none;
}

.list-block {
  grid-area: list;
  min-width: 0;
}

.search {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search label {
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-row input {
  flex: 1;
  min-width: 0;
  border: 1.5px solid var(--control-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 15px;
  background: var(--white);
  color: var(--ink);
  font-family: var(--font-body);
}

.alt-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.alt-row .btn {
  flex: 1;
  min-width: 140px;
}

.status {
  min-height: 1.5em;
  font-size: 13.5px;
  color: var(--ink);
  margin: 12px 0;
}

.place-results {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-sm);
  background: var(--white);
}

.place-results li + li {
  border-top: 1px solid var(--line);
}

.place-results button {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 10px 12px;
  font-size: 13.5px;
  color: var(--ink);
  cursor: pointer;
}

.place-results button:hover {
  background: var(--cream-deep);
}

.origin-line {
  font-size: 14px;
  margin: 0 0 14px;
}

.link-btn {
  background: none;
  border: none;
  color: var(--forest);
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
}

.opts {
  min-width: 0; /* fieldsets default to min-content width, which overflows small screens */
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 14px 12px;
  margin: 0 0 14px;
  background: var(--white);
}

.opts legend {
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  padding: 0 6px;
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 4px 14px 4px 0;
  font-size: 14px;
  cursor: pointer;
}

.opts:disabled .opt {
  color: var(--ink-soft);
  cursor: not-allowed;
}

.hint {
  font-size: 13px;
  color: var(--ink-soft);
  margin: 6px 0 10px;
}

.map {
  height: clamp(340px, calc(100vh - 150px), 620px);
  border: 1px solid var(--control-border);
  border-radius: var(--radius-md);
  position: relative;
  z-index: 0;
  isolation: isolate; /* keeps Leaflet's high z-index panes below the sticky nav */
}

.route-card {
  margin: 0 0 24px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  box-shadow: var(--shadow-card);
}

.route-card h2 {
  font-size: 19px;
  margin-bottom: 4px;
}

.route-summary {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--moss);
  margin: 0 0 12px;
}

.steps {
  margin: 0 0 14px;
  padding-left: 22px;
  font-size: 14px;
  max-height: 300px;
  overflow-y: auto;
}

.steps li {
  margin-bottom: 6px;
}

.step-dist {
  color: var(--ink-soft);
}

.notice {
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  margin: 0 0 14px;
  font-size: 14px;
  border: 1px solid;
}

.notice p {
  margin: 0 0 10px;
}

.notice.origin {
  background: var(--ochre-light);
  border-color: #b98a2e;
  color: #4d3208;
}

.notice.error {
  background: #fbf1ee;
  border-color: var(--error);
  color: #6b2418;
}

.notice-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.event-list li {
  counter-increment: pin;
  position: relative;
  padding: 12px 12px 12px 46px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--white);
  margin-bottom: 10px;
}

.event-list li::before {
  content: counter(pin);
  position: absolute;
  left: 12px;
  top: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--forest);
  color: var(--white);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-list li.active {
  border-color: var(--forest);
  box-shadow: 0 0 0 1px var(--forest);
}

.event-btn {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--forest-deep);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: var(--moss-light);
  text-underline-offset: 3px;
}

.meta {
  font-size: 13px;
  color: var(--ink-soft);
  margin: 4px 0 8px;
}

.btn.small {
  padding: 8px 14px;
  font-size: 13px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "search"
      "map"
      "route"
      "list";
    grid-template-rows: auto;
  }

  .map-block {
    position: static;
    margin-bottom: 24px;
  }

  .map {
    height: 380px;
  }
}
</style>

<style>
/* Leaflet creates these elements itself, so these rules can't be scoped. */
.leaflet-container {
  font-family: var(--font-body);
}

.leaflet-container.picking {
  cursor: crosshair;
}

.ev-pin span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--forest);
  color: var(--white);
  border: 3px solid var(--white);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  font-weight: 700;
  font-size: 14px;
}

.ev-pin.is-selected span {
  background: #8a3b12;
  transform: scale(1.18);
}

.origin-pin span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border-radius: 13px;
  background: #0b4f6c;
  color: #fff;
  border: 2px solid #fff;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.leaflet-control-attribution a {
  color: #0b4f6c;
}

.map-popup h3 {
  font-size: 15px;
  margin: 0 0 6px;
}

.map-popup p {
  margin: 0 0 4px;
  font-size: 13px;
}

.popup-btn {
  margin-top: 8px;
  background: var(--forest);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
