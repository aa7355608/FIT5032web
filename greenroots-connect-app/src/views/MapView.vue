<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEvents } from "../composables/useEvents.js";
import { useAuth } from "../composables/useAuth.js";
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
//  2. Find near me: search a place (serverless geocoder) or use device location;
//     events re-sort nearest-first with distances and a radius filter.
//  3. Directions: turn-by-turn walking / cycling / driving route to an event,
//     drawn on the map and listed as text steps.
// The event list is the text alternative to the map (WCAG 1.1.1 / 2.1.1).

const { publishedEvents } = useEvents();
const { getIdToken } = useAuth();

const mapEl = ref(null);
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

let map = null;
let markerLayer = null;
let originMarker = null;
let routeLine = null;
let markersById = {};
let routeRequestId = 0;

const SEARCH_ERRORS = {
  not_signed_in:
    "Place search needs a Firebase sign-in (it isn't available in demo mode). You can still use \"Use my location\".",
  unavailable:
    "Place search runs on the serverless function, which isn't available here. It works on the deployed site, or locally with npm run cf:dev.",
  timeout: "The place search took too long. Please try again.",
  network: "Couldn't reach the place search. Check your connection.",
  bad_query: "Enter a suburb or address (2 to 120 characters).",
  default: "The place search is busy right now. Please try again shortly.",
};

const ROUTE_ERRORS = {
  timeout: "Directions are taking too long. Please try again.",
  network: "Couldn't reach the directions service. Check your connection.",
  no_route: "No route was found to that event for this travel mode.",
};

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

const shortLabel = (name) => name.split(",").slice(0, 2).join(",").trim();
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });

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
    marker.on("click", () => (selectedId.value = e.id));
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
  route.value = null;
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
  }
}

function setOrigin(o) {
  origin.value = o;
  placeResults.value = [];
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
  });
}

function clearOrigin() {
  origin.value = null;
  originMarker?.remove();
  originMarker = null;
  clearRoute();
  radius.value = "any";
  nextTick(() => {
    renderMarkers();
    fitView();
    status.value = "Starting point cleared.";
  });
}

// ---------- actions ----------

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
    status.value = "Your browser doesn't support location. Search for a place instead.";
    return;
  }
  status.value = "Finding your location…";
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" }),
    (err) => {
      status.value =
        err.code === 1
          ? "Location permission was denied. You can search for a place instead."
          : "Couldn't get your location. Try searching for a place instead.";
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function focusEvent(e) {
  selectedId.value = e.id;
  map.setView([e.lat, e.lng], Math.max(map.getZoom(), 13));
  markersById[e.id]?.openPopup();
}

async function getDirections(e) {
  if (!origin.value) {
    status.value = "Set a starting point first: search for a place or use your location.";
    return;
  }
  selectedId.value = e.id;
  const myRequest = ++routeRequestId;
  routeLoading.value = true;
  status.value = `Finding ${ROUTE_MODES[mode.value].label.toLowerCase()} directions to ${e.title}…`;
  const res = await fetchRoute(mode.value, origin.value, e);
  if (myRequest !== routeRequestId) return; // a newer request replaced this one
  routeLoading.value = false;
  if (!res.ok) {
    route.value = null;
    routeLine?.remove();
    routeLine = null;
    status.value = ROUTE_ERRORS[res.reason] || ROUTE_ERRORS.network;
    return;
  }
  route.value = { ...res.route, event: e, mode: mode.value };
  routeLine?.remove();
  routeLine = L.polyline(res.route.path, { color: "#1f3d2b", weight: 6, opacity: 0.85, interactive: false }).addTo(map);
  map.closePopup();
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  status.value = `${ROUTE_MODES[mode.value].label} route to ${e.title}: ${formatDistance(res.route.distanceKm)}, about ${formatDuration(res.route.durationS)}.`;
}

// ---------- reactivity & lifecycle ----------

watch(listedEvents, renderMarkers);
watch(selectedId, markSelected);
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
        Pins show upcoming events. Search for a place or use your location to see which are closest, then
        get walking, cycling or driving directions. The event list works as a text version of the map.
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
            <button type="button" class="btn btn-ghost loc-btn" @click="useMyLocation">Use my location</button>
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

          <section v-if="route" class="route-card" aria-labelledby="route-heading">
            <h2 id="route-heading">{{ ROUTE_MODES[route.mode].label }} directions to {{ route.event.title }}</h2>
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
          <p v-if="listedEvents.length === 0" class="hint">No events match. Try a larger distance.</p>
          <ol class="event-list" aria-labelledby="events-heading">
            <li v-for="e in listedEvents" :key="e.id" :class="{ active: selectedId === e.id }">
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
                Directions
              </button>
            </li>
          </ol>
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
  grid-template-columns: 370px 1fr;
  grid-template-areas:
    "search map"
    "list map";
  gap: 24px 28px;
  align-items: start;
}

.search-block {
  grid-area: search;
  min-width: 0;
}
.map-block {
  grid-area: map;
  min-width: 0;
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

.loc-btn {
  width: 100%;
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
  margin: 6px 0 0;
}

.map {
  height: 560px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-md);
  position: relative;
  z-index: 0;
  isolation: isolate; /* keeps Leaflet's high z-index panes below the sticky nav */
}

.route-card {
  margin-top: 18px;
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
  max-height: 260px;
  overflow-y: auto;
}

.steps li {
  margin-bottom: 6px;
}

.step-dist {
  color: var(--ink-soft);
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: pin;
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
      "list";
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
