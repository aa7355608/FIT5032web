# Accessibility statement (WCAG 2.1 AA) — GreenRoots Connect

Target: **WCAG 2.1 Level AA**. This documents what was built, how it was checked, and what has *not* been checked.
Automated tools find only a portion of real-world barriers, so this is evidence of good-faith testing, **not a certification**.

## What was built in

| WCAG area | What the app does |
|---|---|
| 1.1.1 Text alternatives | Decorative SVGs are `aria-hidden`; the map is a labelled region and **the numbered event list is a full text alternative** (same events, dates, distances); map pins have text names |
| 1.3.1 / 1.3.5 Structure & input purpose | Real `<label>`s on every field; `autocomplete` on name/email/password/phone; one `<h1>` per page with no skipped heading levels; table headings use `scope`, tables have captions; radio groups use `<fieldset>/<legend>` |
| 1.4.3 / 1.4.11 Contrast | Text colours tuned to ≥ 4.5:1 (e.g. green chips 4.78:1); field borders 3.65–3.95:1; focus ring 10.8:1; placeholder text 5.9:1 |
| 1.4.10 Reflow | No horizontal page scrolling at 320 px on any page (data tables scroll inside their own container, which the criterion permits) |
| 1.4.12 Text spacing | Verified no page overflow when the spec's spacing overrides are applied |
| 2.1.1 / 2.1.2 Keyboard | Everything operable by keyboard: map pins open on Enter, arrow keys pan the map, +/− zoom, table headers are buttons, pagination and exports are buttons. No keyboard trap on the map (Tab leaves it) |
| 2.4.1 / 2.4.2 / 2.4.3 / 2.4.7 | "Skip to main content" link; unique descriptive page `<title>` per route; focus moves to the main content after each navigation; a strong 3 px focus ring on every control |
| 3.3.1 / 3.3.3 Errors | Errors are text (not just colour), linked to their field with `aria-describedby`, flagged with `aria-invalid`, and a summary is announced with `role="alert"` |
| 4.1.2 / 4.1.3 Name & status | Every control has an accessible name (including the Coordinator dropdowns); search counts, map status, export results and ratings use `aria-live` / `role="status"` regions |
| Motion | `prefers-reduced-motion` is respected |

## How it was checked

1. **axe-core 4.x** (rule sets `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on `/login`, `/`, `/data`, `/map` (with a route and popup open) and `/coordinator`, at 1280 px and 390 px.
   Baseline before the work: **24 failing elements** (colour contrast on status chips; unnamed Coordinator dropdowns). After: **0 violations**.
2. **Keyboard-only walkthrough**: sign in without a mouse, skip link, focus order, focus ring present, map pin → popup, no trap.
3. **Reflow at 320 px** — this found two real failures (home and map pages overflowed) which were then fixed.
4. **Hand-computed contrast ratios** for colours axe can't evaluate (text over map tiles/pins, borders, focus ring).
5. Suggested next step (as the brief notes): run the deployed URL through https://www.accessibilitychecker.org/.

## Not covered / known limits

- **No screen-reader testing** (NVDA/JAWS/VoiceOver) was done; announcements are designed but not verified with real assistive tech.
- **Exported PDFs are untagged** (the PDF library can't produce tagged PDFs). The CSV export is the accessible alternative.
- **Map tiles and Leaflet's own `+` / `−` / `×` buttons** are third-party; they use symbol glyphs with text labels. Sighted pointer users can pan/zoom freely; keyboard and text-list alternatives exist.
- WCAG 2.2-only criteria (e.g. target size minimums, focus-not-obscured) were not formally tested.
- axe flagged a few items as "needs manual review" (contrast over map tiles; label-in-name on Leaflet's own controls). Contrast was checked by hand; the Leaflet controls are accepted as-is.
