# DoseGrid — Zoomable Pain + Dose Timeline

**Date:** 2026-06-17
**Status:** Approved (via interactive prototype), ready for planning
**Replaces:** the four fixed window tabs (1d/3d/1w/2w) from `2026-06-17-dosegrid-pain-tracking-design.md`

## Purpose

Replace the pain view's fixed-window graph with a single **continuous, pinch-zoom + horizontally-scrollable timeline** that shows pain scores and medication doses against one shared time axis, with **level-of-detail (LOD)** switching: zoom in for per-dose / per-score detail, zoom out for a summarised overview. Validated end-to-end as an interactive prototype the user approved ("love everything").

This is the **free, un-gated** release. Monetization and the safety warning are explicitly deferred (see "Out of scope / future").

## Approved behaviour (from the prototype)

- **One timeline**, pain (0–10) on top against a dose lane below, sharing a time axis.
- **Pan** by dragging; **zoom** by wheel / pinch / +–. **Unlimited history** — scroll back as far as data exists; **most zoomed-out view = a fortnight on screen**; deepest zoom ≈ 12h (so 24h frames easily).
- **LOD switch** at a width-adaptive threshold (~5–7 days on screen; `DETAIL_PXDAY ≈ 90`):
  - **Detail:** every pain score as a severity-coloured dot (notes ringed) + connecting line; every dose as a lollipop whose height = that dose's *running share of the med's daily limit*, coloured per med, early doses ringed amber, dot labelled with tablet count.
  - **Overview:** pain as one continuous line coloured per segment by value (green→red); notes as small marks; meds as **fixed-width per-med bars summed by calendar day** (all paracetamol together, etc.), height = that day's total ÷ that med's daily max, capped ~1.3× so over-max pokes above the dashed limit line.
- **Click/tap** any pain dot, note mark, dose lollipop, or daily bar → a detail popup with exact time and amount/score (real note text for pain). Pain dots + note marks carry oversized invisible hit-circles for easy tapping.
- **Background banding:** alternating **day** shades (slate) with a faint midnight divider line, always on; alternating **hour** shades (separate cyan tint) whose opacity **fades in as you zoom in**, so hour detail phases in seamlessly while day breaks stay legible.
- **Severity colour:** continuous green→red HSL ramp by score (existing `painColor`).
- **Per-med colour:** each medication gets a stable distinct colour (deterministic palette), shown in a legend.

## Architecture

Keep vanilla JS / no build / ES modules. Split the work so the chart is its own focused unit:

- `js/pain.js` (pure, unit-tested) — gains: `painColor(score)` (moved here from painview for reuse/testing), `medColor(index)` deterministic palette, `lodMode(pxPerDay)` → `'detail'|'overview'`, `medDayTotals(doses, now)` → per-med per-calendar-day tablet sums, `isEarlyDose(dose, prevSameMedTs, intervalHours)`. Existing `severity`, `latestPain` stay; the per-window helpers (`WINDOWS`, `painInWindow`, `dosesInWindow`) are removed (no longer used).
- `js/timeline.js` (new) — the zoomable chart. Owns pan/zoom state (`scale`, `t0`), renders the SVG string each frame into a host element, handles pointer drag / wheel / pinch / buttons, day+hour banding, LOD rendering, and emits clicks via callbacks. Public: `createTimeline(hostEl, { onPainClick(id), onDoseClick(dose) })` returning `{ render() }`. It **imports `loadPain`/`loadDoses`/`loadMeds` from storage directly** (matching the rest of the app) and reads fresh on each `render()`.
- `js/painview.js` — hosts the timeline in `#pain-view` (current-pain summary + "＋ Log pain" + the timeline). Provides `openPainDetail(id)` (already exists; shows real note) and a new `openDoseDetail(dose)` sheet. Drops the window-tab UI and `currentWindow` state.
- `css/styles.css` — timeline host + controls (mode chip, zoom buttons) styling; remove now-unused `.win-tabs`.
- `service-worker.js` — precache `js/timeline.js`, bump cache.

Med colour is **derived on the fly** (no data migration): `medColor(index)` applied to each med's stable index (its `order` field). Meds already carry `maxDailyUnits` (daily limit) and `intervalHours` (for early detection).

## Data flow

1. Pain view renders → summary + timeline. Timeline initial view = last 14 days (most zoomed-out), Overview.
2. Drag/zoom updates `scale`/`t0`, clamps (zoom-out ≤ fortnight, pan within data range, deepest ≈ 12h), re-renders.
3. LOD chosen from current `pxPerDay`.
4. Tap a pain element → `openPainDetail`; tap a dose element → `openDoseDetail` (or, in overview, a day-total bar → a day/med summary popup).
5. Logging pain or a dose elsewhere → on return/refresh the timeline reflects it.

## Testing

`node --test` extended. New pure-helper tests in `tests/pain.test.js`:
- `painColor` — distinct values at 0/5/10 (green→yellow→red ranges).
- `medColor` — deterministic, distinct for the first N indices.
- `lodMode` — returns `detail` above threshold, `overview` below.
- `medDayTotals` — sums each med's tablets within a calendar day; separates meds and days.
- `isEarlyDose` — true when gap < interval, false otherwise / when no previous dose.

Manual + headless verification (Chrome): pan back beyond a fortnight; zoom-out caps at 14 days; zoom in flips to Detail with lollipops + dots; click a pain dot shows its real note; click a dose shows time + tablets; day banding always visible, hour banding fades in near max zoom; per-med daily bars are fixed-width and summed by calendar day; offline still loads.

## Out of scope / future (recorded, not built here)

- **Native packaging:** the app will be wrapped with Capacitor and published to **Google Play + the iOS App Store** next (same pipeline as NEPT). The GitHub Pages repo is the dev workspace. Everything stays on-device, which works unchanged inside a Capacitor WebView. **Implication for this build:** keep the timeline free of web-only assumptions, and funnel any future tier check through a *single* `isPro()` boundary (one helper, default `true` for now) so the store-IAP gate can be added later without touching the chart.
- **Freemium model:** free tier = view only the last 24h, with **all data still stored on-device** (gate the view, not storage); Pro unlock reveals full history + notes. Enforcement = **native store in-app purchase** (confirmed direction). **Safety features must remain free.**
- **Doubling-up / early-dose safety warning** when a dose is logged before its interval or over the daily max — wording TBD, plus a **region-appropriate nurse/help line** surfaced without breaking the on-device/no-account model. Its own brainstorm.
- A **Meds-tab** detailed dose-history graph (mentioned earlier) — revisit after the timeline lands.
