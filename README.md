# DoseGrid

A simple, offline-capable PWA for tracking when you last took a medication and when you can take it again.

## Disclaimer

DoseGrid is a **personal logging tool, not medical advice**. It ships **no dosing recommendations** — there are no built-in intervals, maximums, or guidance about any medication. **You** set every dosing interval and daily maximum yourself for each medication you add. All data (your medication list and dose history) is stored **only on your device, in your browser** — nothing is sent to a server.

## Features

- Tile grid of your medications, one tile per med
- Tap a tile to log a ½, 1, or 2 dose
- Each tile shows a live status: **Ready**, **Wait** (with countdown), or **Daily max**
- Searchable list of 728 medications, including brand names (e.g. searching "advil" finds ibuprofen)
- Per-medication editable dosing interval and daily maximum (in units)
- Daily totals reset automatically at the start of each calendar day
- Units-based dose counting (½ / 1 / 2 units per log)
- 48-hour dose history per medication, with the ability to edit a dose's time or delete an entry
- Works offline via a service worker
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

- [ ] Add a med via search — confirm both a generic (e.g. "ibuprofen") and a brand (e.g. "advil") find it.
- [ ] Tap a tile → log ½ / 1 / 2 — tile shows "Wait" with a countdown.
- [ ] Reach the daily max — tile shows a red "Daily max" status.
- [ ] Long-press a tile → 48h history lists doses; edit a dose's time; delete an entry.
- [ ] Reload the page — data persists.
- [ ] Go offline (DevTools → Network → Offline, or airplane mode after install) — app still loads.

## Project structure

- `index.html` — app shell and entry point
- `css/styles.css` — all styling
- `js/app.js` — startup logic (prunes old doses, renders the grid)
- `js/ui.js` — rendering, modals, and user interactions
- `js/dosing.js` — dose status logic (Ready / Wait / Daily max, countdowns)
- `js/storage.js` — local storage persistence for medications and dose history
- `js/data.js` — loads and searches the medication dataset
- `medications.json` — dataset of 728 medications (generic and brand names)
- `manifest.webmanifest` — PWA manifest (name, icons, display mode)
- `service-worker.js` — offline caching
- `icons/` — app icons (192px and 512px)
- `tests/` — unit tests, run with `node --test`
