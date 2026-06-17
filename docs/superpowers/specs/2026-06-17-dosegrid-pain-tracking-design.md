# DoseGrid — Pain Tracking & Pain-First Focus

**Date:** 2026-06-17
**Status:** Approved design (autonomous goal), ready for planning
**Builds on:** `2026-06-16-dosegrid-prn-redesign-design.md` (dark theme, dose-type model, history graph all reused)

## Purpose

Reposition DoseGrid so **pain management is the primary focus**, without removing any
existing medication-tracking capability. Add the ability to **report a pain score at any
time** and see it on a **severity-coloured graph that overlays medication doses**, so the
user can see how pain trends against when they medicated. The graph offers four time
windows: **1 day, 3 days, 1 week, 1 fortnight**.

This makes DoseGrid a pain diary you can hand to a GP or pain specialist: "here's my pain
over the last fortnight and exactly when I took what."

Out of scope (YAGNI for this iteration): reminders/notifications, exporting/printing,
cloud sync, pain location/body-map, multiple pain scales. All data stays in
`localStorage` on-device.

## What is reused unchanged

- `storage.js` key/value pattern, `uuid`, dose store + `pruneDoses` (14-day), `addDose`.
- `dosing.js` dose engine and `dailyDoseTotals` (per-med history graph is untouched).
- Bold Dark theme, dose-type tile wording, the curated dataset, the landing page.
- The existing med grid (`renderGrid`) and per-med long-press 14-day history are kept
  exactly as they are — they move into a "Meds" view.

## New data model

A new `localStorage` store `dosegrid.pain`, holding pain reports:

```jsonc
{ "id": "uuid", "timestamp": 1718600000000, "score": 7, "note": "after walking" }
```

- `score`: integer 0–10 (Numeric Rating Scale). Required.
- `note`: optional short free-text string (may be absent or empty).
- Pruned at **90 days** (entries are tiny; this keeps headroom beyond the 2-week graph for
  possible future longer views, while the graph itself never shows more than a fortnight).

New `storage.js` exports: `loadPain()`, `savePain(list)`, `addPain(score, note, timestamp = Date.now())`,
`prunePain(list, now = Date.now())` (90-day cutoff). Same try/catch `read` helper as doses.

## New module: `js/pain.js` (pure, testable, no DOM)

- `SEVERITY = { none: 0, mild: 3, moderate: 6 }` thresholds; helper:
  `severity(score)` → `'none'` (0) | `'mild'` (1–3) | `'moderate'` (4–6) | `'severe'` (7–10).
- `WINDOWS` — ordered list mapping a key to a label + milliseconds:
  `[{key:'1d',label:'1 day',ms:864e5}, {key:'3d',label:'3 days',ms:3*864e5}, {key:'1w',label:'1 week',ms:7*864e5}, {key:'2w',label:'2 weeks',ms:14*864e5}]`.
- `painInWindow(pain, windowMs, now)` → pain entries with `timestamp >= now - windowMs`,
  sorted ascending by timestamp.
- `dosesInWindow(doses, windowMs, now)` → doses with `timestamp >= now - windowMs`,
  sorted ascending.
- `latestPain(pain)` → most recent entry or `null` (for the "current pain" summary).

These are the units the graph and summary consume; each is independently unit-tested.

## UI structure — Pain-first, two views

The single-screen layout becomes two switchable views under one header.

**Header:** title + a segmented **toggle `[ Pain | Meds ]`** + the existing `?` button.
Default view on launch is **Pain**.

**Pain view (`#pain-view`, default):**
1. **Current pain summary** — latest score as a big number with severity colour and "logged
   <relative time>", or a gentle empty state ("No pain logged yet").
2. **"＋ Log pain" button** — prominent; opens the pain-log sheet.
3. **Overlay graph** with the four window tabs (1 day / 3 days / 1 week / 2 weeks).

**Meds view (`#meds-view`):** the existing med grid (`#grid`) exactly as today (tap to log
dose, long-press for per-med history, add medication).

Switching views toggles section visibility (no routing library); the selected toggle button
is highlighted. The med grid keeps rendering into `#grid`; pain content renders into
`#pain-view`.

## Pain-log sheet

Opened from "＋ Log pain". Contents:
- Prompt "How bad is your pain right now?"
- A row/grid of **0–10 buttons** (large, thumb-friendly), each tinted by its severity colour;
  tapping selects a score (selected state highlighted).
- Optional one-line **note** input ("e.g. after walking — optional").
- **Save** (disabled until a score is chosen) → `addPain(score, note)` → close → re-render
  the pain view (summary + graph). **Cancel** closes without saving.

(The 0–10 buttons double as the colour legend, so no separate legend is needed.)

## The overlay graph (centrepiece)

Rendered as inline **SVG** (vanilla, no chart library), into the pain view. Inputs:
the selected window (default `1d`), pain entries, and doses — both filtered via the
`pain.js` window helpers.

**Layout (single `viewBox`, responsive width):**
- Y-axis: pain **0–10**, with light gridlines/labels at 0, 5, 10.
- X-axis: time from `now − window` to `now`. A few time ticks appropriate to the window
  (e.g. hours for 1d, day labels for 1w/2w).
- **Pain series:** a connecting polyline through the points (subtle, semi-transparent),
  plus a filled **dot at each entry coloured by severity** (green/amber/red). This is the
  primary visual — severity reads at a glance.
- **Dose markers:** short vertical **ticks along the baseline** at each dose's time (cyan
  accent). Each tick carries a `<title>` = "<med name> · <time> · <n> tab(s)" for
  hover/tap. They sit on the time axis so you can line a dose up against the pain curve
  above it.
- **Window tabs** above the graph switch the window and re-render.
- **Empty state:** if no pain in the window, show "No pain logged in this window — tap Log
  pain." (Dose ticks may still render.)

A pure helper builds the geometry where practical, but SVG string assembly lives in `ui.js`
alongside the other render functions. Keep the pain-graph builder in its own function
(`painGraphSvg(painEntries, doses, windowMs, now)`) so it stays focused.

## Data flow

1. Launch → `prunePain` + `pruneDoses` on load → render Pain view (default) and prime Meds
   grid. Landing page still shows first-run (unchanged).
2. Toggle Pain/Meds → show/hide the two sections.
3. Log pain → sheet → `addPain` → re-render summary + graph.
4. Change window tab → re-render graph for that window.
5. Logging a dose in Meds view also feeds the overlay (doses are shared) — next time the
   graph renders it reflects new doses.

## Testing

`node --test`, extending the existing suite. New unit tests:

- `prunePain` — keeps entries within 90 days, drops older.
- `severity` — boundaries: 0→none, 3→mild, 4→moderate, 6→moderate, 7→severe, 10→severe.
- `painInWindow` — filters to the window and sorts ascending; ignores older entries.
- `dosesInWindow` — filters to the window; ignores other-window doses.
- `latestPain` — returns the most recent entry; `null` when empty.
- `addPain`/`loadPain` round-trip (with and without a note).

Manual checklist (browser + headless): log a pain score (with and without note); summary
updates with the right colour; graph shows the coloured point; switch all four windows;
log a med dose in Meds view → a dose tick appears on the overlay at the right time; reload
persists; Pain is the default view; Meds toggle still logs doses and shows per-med history;
offline still loads.

## Deployment

Same as today: merge to `main`, `git push` → GitHub Pages rebuilds. Bump the
`service-worker.js` cache name and add `./js/pain.js` to its precache list.
