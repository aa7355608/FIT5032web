# GreenRoots Connect

A community web app for a Melbourne urban-greening & tree-planting NFP, built
with **Vue 3** and the **Composition API**. Volunteers can browse upcoming
planting events, filter/sort them, save favourites, and register their
interest through a validated form.

> Client, organisation and events are fictional, developed for an academic
> assessment (FIT5120/FIT5122).

## Requirements covered

| Requirement | Where it lives |
|---|---|
| **VueJS 3 / Composition API** | Every component uses `<script setup>`. State/derived logic lives in `src/composables/useEvents.js`. |
| **Responsiveness** | Hand-written CSS with flex/grid + media queries (no framework) — see `src/components/NavBar.vue` (hamburger menu) and `src/components/EventList.vue` / `EventCard.vue` (grid reflows 3 → 2 → 1 columns). |
| **Two types of input validation** | `src/components/VolunteerForm.vue`: (1) **required-field validation** on name/event, (2) **format/pattern (regex) validation** on email and (optionally) phone. Both validate live and block submission until resolved. |
| **Dynamic data from JS data structures** | `src/data/events.js` holds the raw event data; `src/composables/useEvents.js` loads it through a simulated async fetch into reactive state, which `EventList`/`EventCard` render and derive (spots left, average rating, status) from. Saved/favourited events persist to `localStorage` so they survive a refresh. |

## Getting started

```bash
npm install
npm run dev       # start the dev server (usually http://localhost:5173)
npm run build      # production build to /dist
npm run preview    # serve the production build locally
```

## Project structure

```
src/
  App.vue                     # wires sections together, holds top-level state
  main.js                     # app entry point
  style.css                   # design tokens & global styles
  data/
    events.js                 # the underlying "JSON-like" data structure
  composables/
    useEvents.js              # simulated fetch, filtering helpers, localStorage
  components/
    NavBar.vue                # responsive nav with animated hamburger menu
    HeroSection.vue            # landing hero + live stats
    EventList.vue              # search/filter/sort + responsive card grid
    EventCard.vue               # single event card (computed spots/rating)
    VolunteerForm.vue          # registration form with two validation types
    MapTeaser.vue              # illustrative map + about section
    SiteFooter.vue             # footer
```

## Notes for markers

- Try resizing the browser (or opening dev tools' device toolbar) to see the
  nav collapse into a hamburger menu and the event grid reflow.
- Try the **search box / suburb filter / sort dropdown** above the event grid
  — the list re-renders from the same reactive array, nothing is re-fetched.
- Submit the **Register** form empty to see required-field validation; type an
  invalid email (e.g. `test@test`) to see format validation.
- Click the bookmark icon on a card — it's saved to `localStorage` under the
  key `greenroots.savedEvents` and will still be marked saved after a refresh.
