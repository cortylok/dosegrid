# DoseGrid

DoseGrid — a pain-management tracker for as-needed (PRN) and short-course medicines: log your pain score over time and see it against when you medicated. It shows when you're *allowed* to take more, not when you should.

## Disclaimer

DoseGrid is a **personal logging tool, not medical advice**. It ships **no dosing recommendations** — there are no built-in intervals, maximums, or guidance about any medication. **You** set every dosing interval and daily maximum yourself for each medication you add. All data (your medication list and dose history) is stored **only on your device, in your browser** — nothing is sent to a server.

## Features

- Tile grid of your medications, one tile per med
- Tap a tile to log tablets taken: **½, 1, or 2 tablets**
- Each tile shows a live status: **Ready**, **Wait** (with countdown), or **Daily max**, plus the strength and limit (e.g. `200 mg · 6h · max 6 tabs/day`)
- Searchable, category-grouped list of 142 commonly-used medications with **Australian names** (generics and brands per AMH/TGA/PBS) — covering pain & fever, opioids, nerve/chronic pain, muscle relaxants, allergy, antibiotics, nausea, reflux, cough/cold, gut, migraine, sleep and more
- Per-medication editable **strength per tablet** (optional, e.g. "200 mg"), dosing interval, and **maximum tablets per day**
- Daily totals reset automatically at the start of each calendar day
- **Tablet-based counting** — the limit and history are tracked in tablets, so logging "2" toward a max of 6 leaves 4 for the day
- **Pain tracking (primary focus):** report a 0–10 pain score any time (coloured by severity), with an optional note. The app opens on the **Pain** view (Meds grid one tap away)
- **Pain overlay graph:** your pain plotted over time, each point coloured by severity, with medication doses marked on the timeline — across **1 day / 3 days / 1 week / 2 weeks** views
- 14-day dose history per medication, with the ability to edit a dose's time or delete an entry
- Works offline via a service worker (network-first: the latest version loads automatically when online, with the last-cached copy used offline)
- All data stored on-device only (browser local storage) — no accounts, no syncing, no servers

## Run locally

From the repo root, start a local web server:

```
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Note: the app must be served over `http://`, not opened directly as a `file://` URL, because it relies on ES module imports, `fetch`, and a service worker — none of which work correctly under `file://`.

## Run tests

From the repo root:

```
node --test
```

## Install on Android / sideload as a web link

1. Create a new GitHub repo and push this project to it.
2. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main`** (or your default branch) **→ folder `/ (root)` → Save**.
3. Wait about a minute; GitHub will show the live URL (e.g. `https://USERNAME.github.io/dosegrid/`).
4. On your Android phone, open that URL in Chrome.
5. Tap the Chrome menu (⋮) → **"Add to Home screen"** / **"Install app"** → confirm. DoseGrid now launches full-screen from your home screen and works offline.

## Manual test checklist

- [ ] Add a medication via search — results are grouped by category (Pain & fever, Allergy, …); both generic and brand names match.
- [ ] Picking a med pre-fills sensible interval / max defaults and the correct "When do you take it?" setting (e.g. Ibuprofen → As needed; Amoxicillin → Scheduled).
- [ ] "Add a medication not listed" creates a custom medication from a typed name.
- [ ] Tap a tile → log ½ / 1 / 2; a PRN tile shows "Ready when needed" / a countdown "… until next" / red "Daily max"; a scheduled tile shows "Due to take" / "Due in …" / "Done for today".
- [ ] Each tile shows the last-taken time.
- [ ] Long-press a tile → 14-day history shows a daily-dose bar graph by default with a dashed daily-max line; toggle to List to edit a dose time or delete an entry (graph and tile recompute).
- [ ] First launch shows the landing page ("Know when you can, not when you should") with a "Don't show this again" checkbox; the header ? button reopens it any time.
- [ ] App opens on the **Pain** view; the header toggle switches to the **Meds** grid and back.
- [ ] "＋ Log pain" → pick a 0–10 score (coloured by severity) + optional note → Save; the current-pain summary updates in the matching colour.
- [ ] The graph shows pain points coloured by severity with a connecting line, plus cyan ticks where doses were taken; switching 1 day / 3 days / 1 week / 2 weeks rescales the axis.
- [ ] Reload persists data; offline reload still loads the app (PWA).

## Project structure

- `index.html` — app shell and entry point
- `css/styles.css` — all styling
- `js/app.js` — startup logic (prunes old doses, renders the grid)
- `js/ui.js` — rendering, modals, and user interactions
- `js/dosing.js` — dose status logic (Ready / Wait / Daily max, countdowns)
- `js/storage.js` — local storage persistence for medications and dose history
- `js/data.js` — loads and searches the medication dataset
- `medications.json` — curated dataset of 142 medications (Australian generic and brand names), each tagged with a `category`, `form`, and sensible interval/max defaults
- `js/categories.js` — category ids/labels and the PRN-vs-scheduled dose-type helper
- `js/pain.js` — pure pain helpers (severity bands, time windows, in-window filters)
- `js/painview.js` — the Pain view: current-pain summary, log sheet, and the severity-coloured overlay graph
- `manifest.webmanifest` — PWA manifest (name, icons, display mode)
- `service-worker.js` — offline caching (network-first)
- `icons/` — app icons (192px and 512px)
- `tests/` — unit tests, run with `node --test`
