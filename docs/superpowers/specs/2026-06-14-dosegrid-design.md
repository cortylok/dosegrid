# DoseGrid — Medication Time Tracker (Design Spec)

**Date:** 2026-06-14
**Status:** Approved for planning
**Platform:** Installable PWA (Android-first), hosted on GitHub Pages

## Disclaimer
DoseGrid is a personal logging tool, **not medical advice**. It does not ship
clinical dosing recommendations. All intervals and daily maximums are entered by
the user. A short disclaimer is shown in the app (About/first run).

## 1. Overview
A single-page, installable PWA that shows a scrolling grid of medication tiles.
Each tile tracks when a medication was last taken, when it can be taken again,
and how much of the daily maximum has been used. Built with plain
HTML/CSS/JS — **no framework, no build step** — so it hosts on GitHub Pages and
runs offline. All data is stored on-device in `localStorage`.

## 2. Goals / Non-goals
**Goals**
- Fast tile grid; one-tap dose logging (½ / 1 / 2 units).
- Search/add meds from a bundled list of ~1000 common medications (generic +
  brand names), search-only.
- Per-med editable interval (hours) and max-daily (units).
- 48-hour per-med history with edit-time and delete.
- Offline-capable, installable, on-device only.

**Non-goals**
- No accounts, no cloud sync, no backend.
- No bundled clinical interval/max-dose defaults.
- No reminders/notifications in v1 (possible later).

## 3. Decisions (locked)
| Topic | Decision |
|---|---|
| Dose timing | Per-med editable interval (hours) + editable max-daily (units) |
| Daily-max reset | **Calendar day** — resets at local midnight |
| Dose counting | By **units**: ½=0.5, 1=1, 2=2, summed against max-daily |
| Dataset | ~1000 generic+brand names, **search only**; user sets timing per med |
| Install | PWA on GitHub Pages → Add to Home Screen |
| Storage | On-device only (`localStorage`) |
| History edits | Edit timestamp **and** delete entries |
| Grid | Scrolling, unlimited tiles, ~2 columns responsive |

## 4. Screens & Interactions

### 4.1 Home (tile grid)
- Responsive scrolling grid (~2 cols on phone, more on wide screens) of filled
  tiles plus one trailing **“+ Add”** tile.
- Each filled tile shows: medication name, configured dose label, and a **status**:
  - `Ready` (green dot) — interval elapsed and under daily max.
  - `Wait Xh Ym` (amber dot) — countdown to next allowed dose.
  - `Daily max` (red dot) — `unitsToday >= maxDaily`.
- Status text always paired with a colored dot AND words (color-independent a11y).
- Header: app name + small settings/About affordance.

### 4.2 Tap a tile → Dose sheet
- Shows: `Last taken: <time> (<units>)`, `Can take again: <time>` (or “now”),
  `Today: <unitsToday> of <maxDaily>`.
- Buttons: **½ / 1 / 2** → logs `{timestamp: now, units}`.
- If logging would exceed max-daily, show a non-blocking warning but still allow
  (user’s judgment); the tile then reflects `Daily max`.
- Secondary: “Edit medication”, “View history”.

### 4.3 Tap a blank/Add tile → Med picker
- Search box filters bundled list by generic OR brand substring (case-insensitive).
- Selecting a med opens a small form: display name (prefilled), **interval (h)**,
  **max-daily (units)**. Both required, both editable later. Saves a new tile.

### 4.4 Long-press a tile → 48-hour history
- List of dose entries within the last 48h: `time · units`.
- Each entry: **edit time** (time picker, same calendar day constraint relaxed —
  can move within last 48h) and **delete** (with confirm).
- Also reachable “Edit medication” (rename / interval / max-daily / delete tile).
- Long-press is implemented via a press-and-hold timer (~500ms) with touch +
  mouse fallback; suppresses the click that would otherwise open the dose sheet.

## 5. Dosing Logic
- `nextDoseTime = lastDose.timestamp + intervalHours`. If no doses, status = Ready.
- `unitsToday = Σ units of doses whose timestamp is in [local-midnight-today, now]`.
- Status:
  - `unitsToday >= maxDaily` → **Daily max** (red).
  - else if `now < nextDoseTime` → **Wait** (amber, show remaining).
  - else → **Ready** (green).
- Tiles re-render on a light interval (e.g. every 30s) and on visibility/focus so
  countdowns and the midnight reset stay current.

## 6. Data Model (`localStorage`, JSON)
```jsonc
// key: "dosegrid.meds"
[
  { "id": "uuid", "name": "Ibuprofen", "brands": ["Advil","Motrin"],
    "intervalHours": 6, "maxDailyUnits": 4, "order": 0 }
]

// key: "dosegrid.doses"
[
  { "id": "uuid", "medId": "uuid", "timestamp": 1718380440000, "units": 1 }
]

// key: "dosegrid.meta"  -> { "schemaVersion": 1 }
```
- Doses older than 48h are not shown in history; they are pruned on load except
  any needed for today’s daily-max sum (which by definition fall inside 24h, so
  pruning at 48h is always safe for the math).
- A bundled static **`medications.json`** ships with the app for search:
  ```jsonc
  [ { "generic": "Ibuprofen", "brands": ["Advil","Motrin","Nurofen"] }, ... ]
  ```
  ~1000 entries; used only to populate the picker.

## 7. Architecture / Files
Dependency-free static site:
- `index.html` — app shell + templates.
- `app.js` — state, rendering, event handling, dosing logic, storage wrapper.
- `styles.css` — clinical theme.
- `medications.json` — search dataset.
- `manifest.webmanifest` — name, icons, `display: standalone`, theme color.
- `service-worker.js` — cache app shell + dataset for offline.
- `icons/` — PWA icons (192/512).
- `README.md` — GitHub Pages sideload instructions.

Code organized into small, testable units within `app.js` (or split files):
- `storage` — load/save/prune.
- `dosing` — pure functions: `computeStatus(med, doses, now)`, `unitsToday(...)`,
  `nextDoseTime(...)`. Pure → unit-testable without DOM.
- `ui` — render grid/sheets/history, bind events.

## 8. Style
- Surfaces: white / very light gray (`#f7f9fb`), cards white with subtle shadow.
- Accent: calm medical teal (`#0e7c86`) / blue; status colors green/amber/red
  chosen for sufficient contrast.
- Typography: system UI stack / Inter; clear hierarchy; large tap targets (≥44px).
- Rounded cards, generous spacing, minimal chrome. Respects safe-area insets.

## 9. Error / Edge handling
- Empty state (no meds): friendly prompt + Add tile.
- Search no-results: clear message.
- Editing a dose time to outside last 48h: clamp or warn.
- Corrupt/missing localStorage: fall back to empty state, never crash.
- First run: show disclaimer once.

## 10. Testing
- Pure dosing functions unit-tested (Ready/Wait/Daily-max boundaries, midnight
  reset, ½/1/2 unit sums).
- Manual checklist for interactions (tap/long-press, picker, history edit/delete,
  offline install) in README.

## 11. Delivery
- Git repo `dosegrid`. Commit the working PWA + this spec.
- README documents: enable GitHub Pages on the repo, open the Pages URL on
  Android Chrome, Add to Home Screen.
