# IA refactor — Home + Timeline tabs — Design

**Date:** 2026-06-23
**Status:** Approved (design), pending spec review
**Area:** `index.html`, `js/app.js`, `js/painview.js`, `js/ui.js`, `css/styles.css`, `service-worker.js`
**Branch:** `ia-refactor`
**Scope note:** This is sub-project A of a two-part effort. Sub-project B (theme system:
Classic + Aurora + Apothecary, light/dark) is a separate spec built on top of this new IA.

## Goal

Collapse the app's two tabs (`Pain` / `Meds`) into a clearer information architecture:
- **Home** — one "how am I / what can I take" surface: the pain summary + Log pain at the top,
  the medication grid below.
- **Timeline** — the zoomable pain+dose chart on its own tab, given the full screen to breathe.

Presentation/structure only. No change to dosing, safety, gating, notifications, or pain logic.

## Current state

- `index.html`: header has a `Pain | Meds` `.view-toggle`; `<main>` contains `#pain-view` (hidden)
  and `#meds-view` (which holds `#grid`).
- `js/app.js`: `setView('pain'|'meds')` toggles the two sections + tab `.active`; starts on **Meds**
  (`setView('meds')`). Also: `recordUsageDay`/`syncNotifications` on boot, `refreshEntitlement()` →
  `dosegrid:refresh` → re-renders, a `dosegrid:refresh` listener (`renderGrid()` + `renderPainView()`),
  a 30s `renderGrid` interval, and a `visibilitychange` handler refreshing both views.
- `js/painview.js`: `renderPainView()` builds, into `#pain-view`: the Pro **nudge** banner, the
  **pain-now summary**, the **Log pain** button, the timeline **controls bar** (`Today/Week/–/+`),
  the **timeline host**, and the med-colour **legend** — and wires the log button, nudge links,
  creates the timeline (`createTimeline(..., { onPainClick, onDoseClick, onDoseGroup, onUpgrade })`),
  and wires the zoom/preset buttons.
- `js/ui.js`: `renderGrid()` builds the med tiles into `#grid`.

## New information architecture

Two tabs in the header `.view-toggle`: **Home** (left, default) and **Timeline** (right).
The app opens on **Home** (was Meds). Header keeps `DoseGrid` + the `?` (About) button.

### Home view (`#home-view`)
Top to bottom:
1. **Pro nudge** banner (only when `shouldNudge(...)`), moved here because Home is the default,
   most-seen screen. Same copy and links (`#nudge-open` → paywall, `#nudge-dismiss` → mark seen).
2. **Pain summary** (`.pain-now`: latest score coloured by `painColor`, severity, relative time,
   optional note) — unchanged markup.
3. **Log pain** button (`#log-pain` → `openPainLog`) — unchanged.
4. The **med grid** (`#grid`, populated by the existing `renderGrid()`).

### Timeline view (`#timeline-view`)
The chart on its own, full height:
- The timeline **controls bar** (`Drag · pinch to zoom` hint + `Today` / `Week` / `–` / `+`).
- The **timeline host** (`#tl-host`) → `createTimeline(...)` with the same callbacks
  (`onPainClick`, `onDoseClick`, `onDoseGroup`, `onUpgrade`). Tap-to-list, presets, animated zoom,
  and the free-tier lock overlay all carry over unchanged.
- The med-colour **legend** (`.tl-legend`).

## Components / code changes

### `index.html`
```html
<div class="view-toggle" role="tablist" aria-label="View">
  <button id="tab-home" class="active">Home</button>
  <button id="tab-timeline">Timeline</button>
</div>
...
<main>
  <section id="home-view" aria-label="Home">
    <div id="home-pain"></div>
    <div id="grid" class="grid" aria-label="Medication grid"></div>
  </section>
  <section id="timeline-view" aria-label="Timeline" hidden></section>
</main>
```
(`#meds-view`/`#pain-view` are removed; `#grid` now lives inside `#home-view`.)

### `js/painview.js` — split `renderPainView` into two exports
- **`renderHomePain()`** → renders into `#home-pain`: the nudge + pain-now summary + Log pain
  button; wires `#log-pain` → `openPainLog`, `#nudge-open` → `openPaywall`,
  `#nudge-dismiss` → `markNudgeSeen()` then `renderHomePain()`. (No grid here — `renderGrid()`
  fills `#grid` separately.)
- **`renderTimelineView()`** → renders into `#timeline-view`: the controls bar + `#tl-host` +
  legend; creates the timeline and wires `#tl-today`/`#tl-week`/`#tl-out`/`#tl-in` to
  `timeline.showToday/showWeek/zoomOut/zoomIn`. Keeps the module-level `timeline` reference.
- `renderPainView()` is removed; its element helper `painViewEl()` is replaced by
  `homePainEl()` / `timelineViewEl()` (`document.getElementById('home-pain' | 'timeline-view')`).
- `openPainDetail`/`openDoseDetail`/`openDoseGroup`/`openPainLog` are unchanged, except the
  post-action re-render calls (`renderPainView()` after delete/save) become `renderHomePain()`
  (pain summary is on Home now).

### `js/app.js` — view system
- `setView('home'|'timeline')`: toggles `#home-view`/`#timeline-view` `hidden` + tab `.active`;
  on `home` → `renderHomePain()` + `renderGrid()`; on `timeline` → `renderTimelineView()`.
- Tab listeners: `#tab-home` → `setView('home')`, `#tab-timeline` → `setView('timeline')`.
- Boot default: `setView('home')` (replaces `setView('meds')`).
- `dosegrid:refresh` listener → `renderGrid()` + `renderHomePain()` + (if timeline tab active)
  `renderTimelineView()`.
- The 30s interval keeps refreshing `renderGrid()` (countdowns). `visibilitychange` → re-render the
  active view (`renderGrid()` + `renderHomePain()`, plus `renderTimelineView()` if on Timeline) +
  `syncNotifications()`.

### `js/ui.js`
`renderGrid()` is unchanged (still targets `#grid`, which now sits inside `#home-view`).

### `css/styles.css`
- `.view-toggle` keeps its current two-button styling (labels just change).
- Home: `#home-pain` spacing so the pain card + Log pain sit comfortably above `.grid`.
- `#timeline-view`: full-height layout; the `.tl-host` already sizes itself; ensure the legend and
  controls sit cleanly with the chart as the focus.
- Remove now-unused `#pain-view`/`#meds-view` rules if any are view-specific (keep `.pain-now`,
  `.tl-*`, `.grid`, tile rules — all reused).

### `service-worker.js`
Bump `CACHE` to the next `dosegrid-vN`.

## Backward compatibility

- All stores (`dosegrid.*`), dosing/safety/gating/notification logic, and the medications dataset
  are untouched. No data migration.
- First-launch landing (`showLanding`) and the `?` button are unchanged.
- The freemium lock overlay, nudge, and Pro flows behave identically (the nudge just lives on Home).

## Testing

- Pure-logic suites are untouched → all 103 `node --test` tests stay green (regression guard).
- This is a DOM/CSS restructure; verified by a documented manual smoke (browser):
  1. App opens on **Home**: nudge (if applicable) + pain summary + Log pain + med grid.
  2. **Log pain** opens the picker; saving updates the Home pain card immediately.
  3. Tapping a med tile opens its dose sheet; logging a dose updates tiles (incl. the ingredient
     hold state) — unchanged.
  4. **Timeline** tab shows the full-height chart; drag/pinch/`±`/`Today`/`Week` all work; tapping
     overlapping doses opens the dose list; a lone dose opens its detail.
  5. As a free user (`?pro=0`), the lock overlay still appears on the timeline and the nudge on Home;
     `?pro=1` clears them.
  6. Landing shows on first launch; `?` reopens it.

## Files touched

- `index.html` — header toggle (Home/Timeline) + `#home-view`(`#home-pain`+`#grid`)/`#timeline-view`.
- `js/painview.js` — split into `renderHomePain()` + `renderTimelineView()`; element helpers.
- `js/app.js` — `setView('home'|'timeline')`, default Home, refresh/visibility hooks.
- `js/ui.js` — unchanged behaviour (grid renders into `#grid`).
- `css/styles.css` — Home stacking + Timeline full-height; drop dead view rules.
- `service-worker.js` — cache bump.

## Out of scope (sub-project B)

The theme system (Classic + Aurora + Apothecary, light/dark, settings picker, theme-aware tile
rendering for dials/blisters) is a separate spec, designed against this finished IA.
