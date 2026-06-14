# DoseGrid

A simple, offline-capable PWA for tracking when you last took a medication and when you can take it again.

## Disclaimer

DoseGrid is a **personal logging tool, not medical advice**. It ships **no dosing recommendations** — there are no built-in intervals, maximums, or guidance about any medication. **You** set every dosing interval and daily maximum yourself for each medication you add. All data (your medication list and dose history) is stored **only on your device, in your browser** — nothing is sent to a server.

## Features

- Tile grid of your medications, one tile per med
- Tap a tile to log tablets taken: **½, 1, or 2 tablets**
- Each tile shows a live status: **Ready**, **Wait** (with countdown), or **Daily max**, plus the strength and limit (e.g. `200 mg · 6h · max 6 tabs/day`)
- Searchable list of 722 medications using **Australian names** (generics and brands per AMH/TGA/PBS, e.g. Paracetamol/Panadol, Salbutamol/Ventolin, Adrenaline) — US names are kept as search aliases, so "tylenol" still finds Paracetamol and "albuterol" still finds Salbutamol
- Per-medication editable **strength per tablet** (optional, e.g. "200 mg"), dosing interval, and **maximum tablets per day**
- Daily totals reset automatically at the start of each calendar day
- **Tablet-based counting** — the limit and history are tracked in tablets, so logging "2" toward a max of 6 leaves 4 for the day
- 48-hour dose history per medication, with the ability to edit a dose's time or delete an entry
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

- [ ] Add a med via search — confirm a generic (e.g. "paracetamol"), an AU brand (e.g. "panadol"), and a US alias (e.g. "tylenol") all find it.
- [ ] Set a strength (e.g. "500 mg") and max tablets/day — confirm the tile shows them.
- [ ] Tap a tile → log ½ / 1 / 2 tablets — tile shows "Wait" with a countdown and the sheet shows tablets left.
- [ ] Reach the daily max (in tablets) — tile shows a red "Daily max" status.
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
- `medications.json` — dataset of 722 medications (Australian generic and brand names, with US names as search aliases)
- `manifest.webmanifest` — PWA manifest (name, icons, display mode)
- `service-worker.js` — offline caching (network-first)
- `icons/` — app icons (192px and 512px)
- `tests/` — unit tests, run with `node --test`
