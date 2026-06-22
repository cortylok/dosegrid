# Timeline: tap-to-list + range presets + smooth zoom — Design

**Date:** 2026-06-22
**Status:** Approved (design), pending spec review
**Area:** `js/timeline.js`, `js/painview.js`, `js/pain.js`, tests, `service-worker.js`
**Branch:** `timeline-tap-presets` off `main` (independent of the combo-strengths work)

## Goal

Make logged doses on the pain/dose timeline easy to inspect even when they overlap, and give quick
range controls:

1. **Tap-to-list:** tapping overlapping doses (zoomed in) or a day's column (zoomed out) opens a
   flat, time-sorted list of the doses involved — same colours and info as today — with each row
   tapping through to the existing dose detail.
2. **Range presets:** "Today" and "Week" buttons jump the view to those ranges.
3. **Smooth zoom:** preset buttons (and the existing `–`/`+` zoom buttons) animate the
   zoom/pan transition instead of snapping.

## Current state

`js/timeline.js` `createTimeline(host, { onPainClick, onDoseClick, onUpgrade })`:
- **Detail (zoomed-in) mode** draws each dose as a marker plus an invisible 16px hit-circle
  `data-dose`. When doses are logged close together the hit-circles stack and only the topmost is
  tappable — the core complaint.
- **Bar (zoomed-out) mode** draws per-med daily total bars with `data-day`/`data-med`, but the
  click handler (timeline.js:176) only handles `data-upgrade` / `data-pain` / `data-dose` — so
  **tapping a bar does nothing today.**
- Zoom is via wheel/pinch and the `#tl-in` / `#tl-out` buttons (each dispatches one wheel step =
  an instant 1.15× jump).
- `onDoseClick(dose)` → `openDoseDetail(dose)` in `painview.js`: a read-only sheet (med name, time,
  units; no delete).
- Free users are limited to a 24h window: `effMaxSpan() = min(MAX_SPAN, FREE_WINDOW_MS)`, and a 🔒
  "Unlock full history" overlay calls `onUpgrade`.

Relevant existing pure helpers in `js/pain.js`: `startOfDay`, `medDayTotals`, `medColor`,
`isEarlyDose`.

## Feature 1 — Tap-to-list

### Grouping rules
- **Detail mode:** on a dose tap, build the cluster = all doses within ±`toleranceMs` of the
  tapped dose, where `toleranceMs = 18 / scale` (≈ the marker hit width in time units at the
  current zoom). One dose → `onDoseClick(dose)` (unchanged). Two or more → `onDoseGroup(cluster)`.
- **Bar mode:** render, for each day that has doses, an invisible full-height hit `<rect>` spanning
  that day's width across the dose lane (`y` from `laneTop` to `laneBot`) carrying `data-day="<ds>"`
  (ds = `startOfDay` ms). A tap → `onDoseGroup(dayDoses(allDoses, ds))`. The existing per-med bars
  remain (visual only); the invisible rect sits above them for hit-testing.

### Pure helpers (js/pain.js)
```js
// Doses within ±toleranceMs of centerTs, sorted ascending by timestamp.
export function dosesInCluster(doses, centerTs, toleranceMs) { /* filter + sort */ }

// Doses whose startOfDay equals dayStartMs, sorted ascending by timestamp.
export function dayDoses(doses, dayStartMs) { /* filter + sort */ }
```

### List sheet (js/painview.js `openDoseGroup(doses)`)
- Guard: empty → return; single → delegate to `openDoseDetail(doses[0])`.
- Title: `${doses.length} doses · ${dayLabel}` where dayLabel = e.g. "Mon 14 Jun" from the first
  dose (all in one cluster/day).
- Body: a `.list` of rows, one per dose (already time-sorted), each:
  `<li data-dose-id="…"><i class="sw" style="background:${medColor(order)}"></i>
   <span>${medName}</span><span class="muted">${time} · ${units} tablet(s)</span></li>`
  where `time` = `toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})`, med looked up via
  `loadMeds()` (name + `order` for colour; unknown med → grey "Dose").
- Row click → `closeModal()` then `openDoseDetail(dose)` (existing read-only detail).
- A "Close" button.

### Wiring (js/timeline.js)
- Add `onDoseGroup` to the options destructure.
- Detail-mode click branch: resolve tapped dose from `data-dose`, compute
  `cluster = dosesInCluster(visibleSortedDoses, dose.timestamp, 18/scale)`; `cluster.length > 1`
  → `onDoseGroup(cluster)`, else `onDoseClick(dose)`.
- New click branch: `const day = e.target.closest('[data-day]')` → `onDoseGroup(dayDoses(doses, +day.dataset.day))`.
- `painview.js` passes `onDoseGroup: openDoseGroup`.

## Feature 2 — Range presets (Today / Week)

### UI
Two buttons added to the existing `.tl-bar` next to `–`/`+`:
`<button class="zb" id="tl-today">Today</button><button class="zb" id="tl-week">Week</button>`.

### Behaviour
- **Today:** show midnight→now (`rangeForPreset('today', now)`). Always available.
- **Week:** show the last 7 days ending now (`rangeForPreset('week', now)`). Requires Pro.
- **Free-tier:** the free window is 24h, so Week needs Pro. `showWeek()` checks `isPro()`; if
  false it calls `onUpgrade()` and does nothing else (no animation). Today is always within the
  free window.

### Pure helper (js/pain.js)
```js
const DAY = 864e5;
// Desired time window for a preset. Pixel-independent; the timeline converts to scale/t0.
export function rangeForPreset(preset, now) {
  if (preset === 'week') return { start: now - 7 * DAY, end: now };
  return { start: startOfDay(now), end: now }; // 'today'
}
```

### Timeline API (js/timeline.js)
- `createTimeline` returns `{ render, showToday, showWeek }` (was `{ render }`).
- `showToday()` / `showWeek()`: compute `{start,end}` from `rangeForPreset`, derive desired
  `scale = (W - padL - padR) / (end - start)` and `t0 = start`, run the existing clamp math to get
  a valid target, then `animateTo(targetScale, targetT0)` (see Feature 3). `showWeek()` returns
  early via `onUpgrade()` when `!isPro()`.
- `painview.js` wires `#tl-today` → `timeline.showToday()`, `#tl-week` → `timeline.showWeek()`.

## Feature 3 — Smooth zoom animation

Add `animateTo(targetScale, targetT0, ms = 350)` to `createTimeline`:
- Cancel any in-flight animation (track a `rafId`).
- If `matchMedia('(prefers-reduced-motion: reduce)').matches` → set `scale`/`t0` to target,
  `clamp()`, `render()`, return (no animation).
- Capture `startScale`, `startT0`, `startTime = performance.now()`.
- Per `requestAnimationFrame` frame: `p = easeInOutCubic(min(1, (now - startTime)/ms))`;
  interpolate zoom geometrically `scale = startScale * (targetScale/startScale) ** p` (natural
  feel) and pan linearly `t0 = startT0 + (targetT0 - startT0) * p`; `render()`. At `p === 1` set
  exact target, `clamp()`, `render()`, stop.
- `easeInOutCubic(p) = p < 0.5 ? 4p³ : 1 - (-2p+2)³/2`.

Reuse for the zoom buttons: `#tl-in` / `#tl-out` call a small `zoomStep(factor)` that targets
`scale * factor` about the view centre and routes through `animateTo` (replacing today's instant
wheel-dispatch). Wheel/pinch gestures stay immediate (they're already continuous).

## Testing

Pure unit tests (`tests/timeline-cluster.test.js`, node --test):
- `dosesInCluster`: includes doses within tolerance, excludes those outside, returns ascending by
  timestamp, single in-range dose returns length 1, empty input returns `[]`.
- `dayDoses`: returns only the target day's doses sorted ascending; doses on adjacent days are
  excluded (boundary at `startOfDay`).
- `rangeForPreset`: `'today'` → `{start: startOfDay(now), end: now}`; `'week'` →
  `{start: now - 7*DAY, end: now}`; unknown preset falls back to today.

Manual smoke (documented):
- Log 3 doses within a couple of minutes; zoomed in, tap the cluster → list of all 3, time-sorted,
  correct colours; tap a row → that dose's detail.
- A lone dose still opens its detail directly.
- Zoom out; tap a day's column → that day's doses listed.
- "Today" animates to midnight→now; "Week" animates to 7 days for Pro; as a free user "Week" opens
  the paywall. `–`/`+` animate smoothly. With OS reduced-motion on, transitions are instant.

## Backward compatibility / scope

- Additive: existing single-dose and pain taps unchanged; no storage changes.
- **Doses only.** Pain markers live in the upper lane and don't have the overlap problem; not
  included.
- No dose deletion is added (dose detail stays read-only, as today).
- Free-tier history limits unchanged.

## Files touched

- `js/pain.js` — add `dosesInCluster`, `dayDoses`, `rangeForPreset` (pure).
- `js/timeline.js` — `onDoseGroup`; detail-mode cluster + `data-day` hit rects + click branch;
  `showToday`/`showWeek`/`animateTo`/`zoomStep`; return new methods.
- `js/painview.js` — `openDoseGroup`; wire `onDoseGroup` + Today/Week buttons; add buttons to markup.
- `css/styles.css` — list-row swatch (`.sw`) if not already covered by the legend style.
- `tests/timeline-cluster.test.js` — new.
- `service-worker.js` — bump `CACHE` (next free `dosegrid-vN`).
