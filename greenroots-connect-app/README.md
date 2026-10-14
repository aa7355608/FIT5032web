# GreenRoots Connect

A community web app for a Melbourne urban-greening & tree-planting NFP, built with
**Vue 3 (Composition API)**. The whole site sits behind login. Residents browse and rate
events, register interest (and get an email with a calendar invite), and explore impact
data in sortable, searchable tables; coordinators get a role-gated portal.

> Client, organisation, events, accounts and table data are fictional (FIT5120/FIT5122).

**Live site:** _add your Cloudflare Pages URL here after deploying (see "Deploy")_

## Requirements

| BR | Requirement | Where |
|---|---|---|
| A.1 | Vue 3 + Composition API | `<script setup>` everywhere; logic in `src/composables/` |
| A.2 | Responsive | Hand-written CSS grid/flex + media queries; tables scroll inside their own box on phones |
| B.1 | 2+ validation types | Required-field + regex/pattern checks on the login/register and registration forms |
| B.2 | Dynamic data | `src/data/events.js` loaded via simulated async fetch into reactive state; persisted in `localStorage` |
| C.1 | Login/register | `src/composables/useAuth.js`; whole site requires login (`src/router/index.js`) |
| C.2 | Role-based access | `volunteer` / `coordinator`; route guard on every navigation; roles enforced server-side by `firestore.rules` |
| C.3 | Aggregated rating | Star widget on event cards; live average; one vote per account per event |
| C.4 | Security / XSS | See "Security" below |
| D.1 | External authentication | **Firebase Auth** (email/password + Google) — `src/composables/auth/firebaseBackend.js` |
| D.2 | Email with attachment | **SendGrid** via a server function; confirmation email with an `.ics` calendar invite attached — `functions/api/send-confirmation.js`, `server/` |
| D.3 | Interactive tables | `/data`: two tables (planting records, volunteer activity) — sort, per-column search, search-all, 10 rows/page — `src/components/DataTable.vue` |
| D.4 | Cloud deployment | Cloudflare Pages (steps below) |
| E.1 | Serverless functions | Two Cloudflare Pages Functions: `/api/send-confirmation` (email) and `/api/geocode` (place search) — `functions/`, `server/` |
| E.2 | Geo location (map, 2+ features) | `/map`: events map, find-near-me (place search / device location, distance sort, radius filter), turn-by-turn directions — `src/views/MapView.vue` |
| E.3 | Accessibility (WCAG 2.1 AA) | Skip link, focus management, page titles, keyboard-operable map, contrast-checked colours, labelled forms — see `ACCESSIBILITY.md` |
| E.4 | Export | CSV and PDF export of both tables (respects search + sort, all matching rows) — `src/utils/exportTable.js` |

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 44 unit tests
npm run build
```

With no Firebase keys the app runs in **demo mode** (a yellow banner says so): accounts are stored
in the browser only. Demo logins: `amara@example.com` / `Volunteer1` (volunteer) and
`priya@example.com` / `Coordinator1` (coordinator). **Demo mode is not external authentication** — BR D.1
is only met once Firebase is configured (next section).

## Login on every visit

By default the app asks for a login **every time the page is opened or refreshed** — the login is kept only in memory
(Firebase `inMemoryPersistence`; nothing is saved in the browser), and moving between pages inside the app doesn't log you out.
Change it with `VITE_AUTH_PERSISTENCE` in `.env` (`none` | `tab` | `browser`, see `.env.example`) and rebuild.

## Set up Firebase (D.1)

1. [console.firebase.google.com](https://console.firebase.google.com) → create a project.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** (production mode).
4. Firestore **Rules** tab: paste the contents of `firestore.rules` → **Publish**.
5. **Project settings → General → Your apps → Web (`</>`)** → register an app, then copy the config
   into a new `.env` file (template: `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
6. Restart `npm run dev`. The demo banner disappears and a **Continue with Google** button appears.
7. **Make yourself the first coordinator:** register in the app, then in Firestore →
   `users` → your document → change `role` from `volunteer` to `coordinator`. After that you can
   promote others from the Coordinator Portal.

New accounts are always created as `volunteer`. Nobody can pick their own role — `firestore.rules`
rejects any attempt to create or change a role unless the caller is already a coordinator.

## Set up email (D.2)

The browser can't call SendGrid directly (the API key would be public, and SendGrid blocks browser
requests), so the app calls `/api/send-confirmation`, a Cloudflare Pages Function.

1. [sendgrid.com](https://sendgrid.com) → **Settings → Sender Authentication → Single Sender Verification**: verify the "from" address.
2. **Settings → API Keys → Create API Key** with **Mail Send** permission. Copy it once.
3. Set these in Cloudflare (see Deploy) — never commit them:
   `SENDGRID_API_KEY` (as a *secret*), `SENDGRID_FROM_EMAIL`, and `VITE_FIREBASE_PROJECT_ID`.

How it's protected from being used as a spam relay: the caller must send a valid Firebase ID token, the
account's email must be **verified** (a verification email is sent at sign-up; Google accounts are already
verified), the message goes **only** to that verified address, and event details come from the server's own
event list, not from the request.

To try the function locally: copy `.dev.vars.example` to `.dev.vars`, fill it in, then
`npm run build && npx wrangler pages dev dist`. (`npm run dev` doesn't run Pages Functions, so the form
reports "email service isn't available here" instead of pretending it worked.)

## Serverless functions (E.1)

Server-side work runs in **Cloudflare Pages Functions** (serverless: no server to manage, runs on demand at the edge —
the same model as Firebase Cloud Functions, but free and deployed together with the site):

| Endpoint | What it does on the server | Why it can't be browser code |
|---|---|---|
| `POST /api/send-confirmation` | Verifies the Firebase login, then emails a confirmation with an `.ics` attachment via SendGrid | The SendGrid API key must stay secret |
| `GET /api/geocode?q=` | Verifies the Firebase login, validates the query, searches places (limited to Greater Melbourne) with caching | Geocoder usage rules need an identifying User-Agent and caching; login-only so it can't be abused as a free relay |

Both share `server/firebaseAuth.js` (verifies the Firebase ID token's signature, issuer, audience and expiry). The handlers
in `server/` use the standard `Request`/`Response` API and are covered by unit tests, so if your unit insists on
Firebase Cloud Functions specifically, porting is a thin wrapper around the same handlers (note: Firebase Functions
needs the paid Blaze plan; Cloudflare's free tier doesn't).

Optional env var: `CONTACT_EMAIL` (put in the geocoder User-Agent so the service can contact you about heavy usage).

## Map (E.2)

`/map` (Leaflet + OpenStreetMap tiles). Three non-trivial features:

1. **Events map** — each upcoming event is a numbered pin (keyboard-focusable, with a popup: date, spots left, "Get directions").
2. **Find near me** — search a suburb/address (serverless geocoder) or use your device location; events re-sort nearest-first with
   distances, and a 5/10/25 km filter narrows the pins and list.
3. **Directions** — walking, cycling or driving route to any event (OSRM via routing.openstreetmap.de): the route is drawn on the
   map with distance, time and numbered turn-by-turn steps.

Place search needs the deployed functions + Firebase sign-in. With plain `npm run dev` it shows a clear message instead; the
map, pins, "Use my location" and directions still work. To run everything locally: `npm run build && npm run cf:dev`.

## Accessibility (E.3)

Summary below; full detail and the limits of what was tested are in `ACCESSIBILITY.md`.
Checked with axe-core (WCAG 2.0/2.1 A + AA rules) on every page at desktop and phone width (0 violations), plus
keyboard-only walkthroughs, 320 px reflow, text-spacing override, and hand-calculated contrast for colours axe can't measure.
After deploying, also run your live URL through https://www.accessibilitychecker.org/ as the brief suggests.

## Export (E.4)

Each table on `/data` has **CSV** and **PDF** buttons. Exports contain **every row matching the current search, in the current sort
order** (not just the visible page); the PDF notes which filters were applied. CSV cells that start with `=`, `+`, `-` or `@` are
prefixed so spreadsheets can't run them as formulas (CSV injection), and the file has a UTF-8 BOM so Excel opens it correctly.
The PDF library is loaded only when you click PDF.

## Deploy (D.4) — Cloudflare Pages

1. Push this project to GitHub (`.gitignore` already excludes `.env`, `.dev.vars`, `node_modules`).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings: **Build command** `npm run build`, **Build output directory** `dist`.
   If this app lives in a sub-folder of the repo (e.g. `FIT5032web/greenroots-connect-app`), set
   **Root directory** to that sub-folder.
4. **Environment variables** (Production): the four `VITE_FIREBASE_*` values, `SENDGRID_API_KEY` (encrypt it),
   `SENDGRID_FROM_EMAIL`, and (optional) `CONTACT_EMAIL`. Then deploy.
5. Copy your `https://<name>.pages.dev` URL into Firebase → **Authentication → Settings → Authorized domains → Add domain**.
   Without this, Google sign-in fails on the live site.
6. Put the live URL at the top of this README.

`public/_headers` adds production security headers (clickjacking protection, `nosniff`, referrer policy).

## Security (C.4)

- **XSS:** every user-supplied value is shown with Vue's escaping `{{ }}`; `v-html` is never used. Free text is
  also stripped of tags/handlers (`src/utils/sanitize.js`) before storage, and a Content-Security-Policy
  (`index.html`) blocks inline/third-party scripts.
- **Authentication:** with Firebase, passwords never touch this app's code or storage; login errors are generic.
- **Authorisation:** route guards on every navigation + Firestore rules enforcing roles server-side.
- **Email function:** token-verified, verified-address-only, input size-limited, no client-controlled recipient or event data.
- **Open-redirect safe:** the post-login `?redirect=` only accepts same-site paths.
- **Honest limits:** demo mode stores a SHA-256 password hash in `localStorage` — fine for a demo, not for real
  use. Ratings and event edits are still stored in the browser, so they are per-device, not shared between users.

## Manual test script

1. Open the site logged out → you're sent to `/login`; typing `/data` or `/coordinator` does the same.
2. Log in → you land on the page you asked for. **Refresh the page or open the site in a new tab → you must log in again.** Log out → back to `/login`.
3. `/data`: click a header to sort (arrow shows direction); type in a box under a column to filter just that
   column; use the top box to search everything; page through 10 rows at a time; "Clear filters" resets.
4. Home → Register interest → pick an event → submit. On the deployed site with Firebase + SendGrid set up,
   an email arrives with `event.ics` attached.
5. As a volunteer, visit `/coordinator` → redirected home. As a coordinator, it loads.
6. Rate an event (1–5 stars); try again → blocked. Resize to phone width → hamburger menu, single-column cards.
7. `/map`: press Tab to a numbered pin and Enter to open its popup; "Use my location" (allow the prompt) re-sorts events by distance;
   on the deployed site search "Footscray", pick a result, then **Directions** on an event and switch Walk/Cycle/Drive.
8. `/data`: filter a column, sort, then **CSV** and **PDF** — the file contains exactly the rows you see matching (all pages).
9. Keyboard only: first Tab on any page reveals "Skip to main content"; every control has a visible focus ring.
