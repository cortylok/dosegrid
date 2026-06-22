# DoseGrid — Design Exploration (RESUMABLE)

**Goal:** A standalone demo presenting **5 genuinely distinct, modern, professional**
design directions for the **med grid tiles** + **dose sheet**, each also showing a
**fully zoomable timeline**. Functionality stays the same — this is presentation only.
No filler; all 5 must be worthy contenders. Branch: `design-explorations`.

**How to open:** open `design/index.html` in a browser. Top tabs switch concept.
Tap a med tile → that concept's dose sheet. Timeline: drag / wheel / pinch / ± to zoom.

## Architecture (so any concept can be built independently)
- `design/index.html` — shell: studio backdrop, concept tab bar, side rationale panel,
  phone frame. Wires the selected concept's `renderGrid` / `renderSheet` / timeline.
- `design/shared.css` — reset, studio frame, tab chrome (concept-agnostic).
- `design/data.js` — `DEMO` sample data (meds in every state, ~5 days of doses, pain
  series) + format/colour helpers. Global `DEMO`.
- `design/timeline.js` — reusable **zoomable engine** `TL.create(host,{renderer})`.
  Engine owns pan/zoom/pinch + geometry; calls `renderer(view) -> svgInnerMarkup`.
  Each concept supplies its own renderer → same interaction, totally different visuals.
- `design/concepts/<name>.css` + `<name>.js` — each registers
  `CONCEPTS['<name>'] = { label, blurb, gridClass, renderGrid(), renderSheet(med), timeline }`.

## The 5 directions (each a distinct aesthetic, not a recolour)
1. **Aurora** — calm health-OS. Soft frosted depth, **radial dose dials**, characterful
   serif display (Fraunces) + humanist body (Hanken Grotesk). Light, airy, premium.
   Timeline: smooth gradient pain area + glowing dose nodes.
2. **Ledger** — editorial / Swiss data. Monochrome ink + single signal accent, hairline
   rules, **big tabular numerals**, status by type-weight not colour blocks. Serif
   headline (Newsreader) + mono numerals (IBM Plex Mono). Timeline: minimalist stock-chart.
3. **Pulse** — timeline-first, dark & energetic. Compact status **rail** of tiles up top,
   the zoomable timeline is the **hero** with a glowing pain spine. Bricolage Grotesque +
   Spline Sans. Electric accent on near-black.
4. **Apothecary** — warm tactile / neo-physical. Cream + amber + clay, **blister-pack dose
   dots**, real bottom-sheet with grabber, soft tactile shadows. Spectral serif + Figtree.
   Timeline: warm analog strip-chart.
5. **Vital** — data-dense **bento** SaaS (Linear/Vercel energy). Mixed tile sizes, mono
   numerics (JetBrains Mono), sparklines + progress bars, crisp precise grid, dark.
   Timeline: a wide multi-series bento cell.

## Tile states each concept must show
ready · wait(until time) · hold(shared-ingredient, with note) · daily-max · scheduled(due).

## Checklist  (update + commit after each)
- [x] Scaffold: shared.css, data.js, timeline.js engine, index.html shell
- [x] Concept 1 — Aurora (concepts/aurora.css + .js)
- [x] Concept 2 — Ledger (concepts/ledger.css + .js)
- [x] Concept 3 — Pulse (concepts/pulse.css + .js)
- [x] Concept 4 — Apothecary (concepts/apothecary.css + .js)
- [x] Concept 5 — Vital (concepts/vital.css + .js)
- [x] Final polish pass (load transition, sheet wiring, rationale panel)
- [x] Pushed branch `design-explorations` for review

## STATUS: COMPLETE — all 5 directions built on branch `design-explorations`.
Open `design/index.html` in a browser to review. Each concept is isolated in
`concepts/<name>.{css,js}`; tweak one without touching the rest. Likely next step: user picks
1–2 favourites to refine, or asks to port a winner into the real app (js/ui.js + css/styles.css).

## Resume notes
Last action: **All 5 concepts + polish done, branch pushed.**
(concepts/*.css + *.js) that register nothing yet — replace each with the real concept.
To add a concept: implement `CONCEPTS.<name> = { label, tagline, notes, meta, span, renderApp(),
timelineRenderer(view), renderSheet(med) }` in its js, styles scoped under `.theme-<name>` in its css.
Reuse the engine via the shell (just include a `.tl-host` + `[data-z]` buttons + `[data-med]` tiles).
Aurora is the reference implementation. Commit after each concept; update this file's checklist.
