# GreenRoots Connect

A community web app for a Melbourne urban-greening & tree-planting NFP, built
with **Vue 3** and the **Composition API**. Residents can browse and rate
tree-planting events, register interest, and create an account; coordinator
staff get a role-gated portal to manage events and users.

> Client, organisation, events and user accounts are fictional, developed for
> an academic assessment (FIT5120/FIT5122). There is no real backend — see
> "How data is stored" below for exactly what that means and doesn't mean.

## Requirements covered

| # | Requirement | Where it lives |
|---|---|---|
| 1 | **VueJS 3 / Composition API** | Every component uses `<script setup>`. Shared logic lives in `src/composables/` (`useAuth.js`, `useEvents.js`). |
| 2 | **Responsiveness** | Hand-written CSS Grid/Flexbox + media queries (no framework) — `NavBar.vue` collapses to a hamburger menu, `EventList`/`EventCard` reflow 3 → 2 → 1 columns, forms and the dashboard stack on mobile. |
| 3 | **Two types of input validation** | `VolunteerForm.vue` and `AuthView.vue` both implement (a) **required-field validation** and (b) **format/pattern (regex) validation** — email format, a password rule (8+ chars + a digit), and an AU phone pattern. All validate live, on blur, and block submission until resolved. |
| 4 | **Dynamic data from JS data structures** | `src/data/events.js` is the underlying data; `useEvents.js` loads it through a *simulated async fetch* into reactive state, merges in runtime changes (new ratings, a coordinator's edits), and persists them to `localStorage`. |
| 5 | **Basic authentication (login/register)** | `useAuth.js` + `views/AuthView.vue`. Accounts are stored in `localStorage` (`greenroots.users`); the active session is kept in `sessionStorage`. Passwords are **never stored in plain text** — see `src/utils/crypto.js`. |
| 6 | **Role-based authentication (2+ roles)** | Two roles: `volunteer` and `coordinator`, chosen at registration. `src/router/index.js` has a **route guard** (`router.beforeEach`) that redirects anyone without the `coordinator` role away from `/coordinator` — including a logged-in volunteer who types the URL directly. |
| 7 | **Aggregated rating score** | `EventCard.vue`'s star widget + `useEvents.js`'s `submitRating()`. Any logged-in user can rate an event 1-5 once; the displayed average recalculates live from the full ratings array, and a duplicate vote from the same account is blocked. |
| 8 | **Basic security / XSS protection** | See "Security measures" below — input sanitisation, no `v-html` on user content, hashed passwords, a Content-Security-Policy header, and generic auth error messages. |

## Getting started

```bash
npm install
npm run dev       # start the dev server (usually http://localhost:5173)
npm run build      # production build to /dist
npm run preview    # serve the production build locally
```

### Demo accounts (seeded automatically on first run)

| Role | Email | Password |
|---|---|---|
| Volunteer | `amara@example.com` | `Volunteer1` |
| Coordinator | `priya@example.com` | `Coordinator1` |

Or register your own account and pick a role on the Register tab.

## Project structure

```
index.html                    # CSP + security headers, font loading
src/
  App.vue                     # shell: NavBar + <router-view/> + Footer
  main.js                     # app entry point, mounts the router
  style.css                   # design tokens & global styles
  data/
    events.js                 # the underlying "JSON-like" event data
  utils/
    crypto.js                 # SHA-256 password hashing (Web Crypto API)
    sanitize.js                # input sanitisation (XSS defence-in-depth)
  composables/
    useAuth.js                 # register/login/logout, roles, session state
    useEvents.js                # simulated fetch, ratings, coordinator edits
  router/
    index.js                    # routes + role-based navigation guard
  views/
    HomeView.vue                 # public landing page (hero, events, form)
    AuthView.vue                  # combined Login / Register screen
    CoordinatorView.vue            # role-gated dashboard
  components/
    NavBar.vue                      # responsive, auth-aware navigation
    HeroSection.vue                  # hero + live stats
    EventList.vue                     # search/filter/sort + card grid
    EventCard.vue                      # single event card + rating widget
    VolunteerForm.vue                   # interest-registration form
    MapTeaser.vue                        # illustrative map + about section
    SiteFooter.vue                        # footer
```

## How data is stored (read this before marking security)

This is a **frontend-only** prototype with no server, so "authentication"
here means the browser checking credentials against data it holds itself —
which is fundamentally different from, and weaker than, real server-side
auth. To be upfront about exactly what is and isn't demonstrated:

- **What's real:** passwords are hashed (SHA-256, not stored as plain text),
  Vue's default template escaping + an extra sanitisation layer stop stored
  XSS, the route guard genuinely blocks navigation to the coordinator portal
  by role, and duplicate-rating prevention actually works.
- **What's a deliberate simplification:** there's no server, so there's
  nothing stopping someone from opening dev tools and reading `localStorage`
  directly, and SHA-256 with a static salt is not how you'd hash passwords
  with a real backend (that needs a slow, per-user-salted algorithm like
  bcrypt/argon2, server-side only). This is documented in code comments in
  `src/utils/crypto.js` rather than glossed over.

## Security measures (BR: XSS / security best practice)

- **No `v-html` on user input anywhere in the app** — every user-supplied
  string (name, email, review text) is rendered through Vue's default `{{ }}`
  interpolation, which HTML-escapes it automatically. This is the primary
  XSS defence.
- **`src/utils/sanitize.js`** strips HTML tags, `javascript:` URIs and inline
  event-handler attributes from free-text fields as a second, defence-in-depth
  layer before that text is written into `localStorage`.
- **Password hashing** via the browser's Web Crypto API (see caveat above).
- **Generic auth errors** — a failed login always says "Invalid email or
  password," never "no account with that email," so the app doesn't leak
  which emails are registered.
- **Content-Security-Policy** meta tag in `index.html` restricting scripts to
  the app's own origin (blocks inline `<script>` injection), plus
  `X-Content-Type-Options: nosniff` and a strict `referrer` policy.
- **Role-based route guard** (`router/index.js`) is enforced on every
  navigation, not just hidden in the UI — visiting `/coordinator` by URL as a
  volunteer redirects you home.

## Notes for markers / manual test script

1. **Responsiveness** — resize the browser or open dev tools' device
   toolbar: the nav collapses to a hamburger, cards reflow 3 -> 2 -> 1 column.
2. **Validation** — go to `/login`, hit "Create account" empty (required-field
   errors), then try an email like `test@test` or a password under 8 chars
   (format/pattern errors).
3. **Auth + roles** — register as a **Volunteer**, note the "Coordinator
   Portal" nav link does **not** appear; log out, log in as
   `priya@example.com` / `Coordinator1`, note it now appears. Try visiting
   `/coordinator` directly while logged out or logged in as a volunteer —
   you'll be redirected.
4. **Ratings** — while logged in, click a star rating on any event card; the
   average and count update immediately, and the control disables with
   "You've rated this" if you try again.
5. **XSS check** — register with a name like `<script>alert(1)</script>Test`
   — it renders as harmless literal text in the nav ("...Test"), and nothing
   executes.
6. **Dynamic data** — use the search box / suburb filter / sort dropdown
   above the event grid; the list re-renders from reactive state without
   re-fetching anything.
