# DoseGrid Pain Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pain management DoseGrid's primary focus by adding pain-score reporting and a severity-coloured graph that overlays medication doses across 1-day / 3-day / 1-week / 2-week windows, without removing any existing med-tracking.

**Architecture:** Keep the vanilla-JS, no-build, ES-module structure. Add a `dosegrid.pain` store (parallel to doses) and a pure `js/pain.js` (windowing + severity helpers, unit-tested). The app becomes two toggled views — a new default **Pain** view (summary + log sheet + SVG overlay graph, in a focused `js/painview.js`) and the existing **Meds** grid. Reuse the modal sheet helpers from `ui.js`.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), inline SVG (no chart lib), `localStorage`, `node --test`, PWA.

**Spec:** `docs/superpowers/specs/2026-06-17-dosegrid-pain-tracking-design.md`

---

## File Structure

- `js/storage.js` — add: `loadPain`, `savePain`, `addPain`, `prunePain` (`dosegrid.pain`, 90-day).
- `js/pain.js` — create: pure helpers `WINDOWS`, `severity`, `painInWindow`, `dosesInWindow`, `latestPain`.
- `js/painview.js` — create: the Pain view — `renderPainView`, `openPainLog`, and the SVG builder `painGraphSvg`.
- `js/ui.js` — modify: export `openSheet`, `closeModal`, `modalRoot` for reuse (no behaviour change).
- `js/app.js` — modify: prune pain on load, render both views, Pain/Meds toggle (Pain default).
- `index.html` — modify: header view-toggle; split `<main>` into `#pain-view` + `#meds-view`.
- `css/styles.css` — modify: view toggle, pain summary, scale picker, window tabs, SVG graph.
- `service-worker.js` — modify: bump cache, precache `pain.js` + `painview.js`.
- `tests/storage.test.js`, `tests/pain.test.js` — add/adjust.

---

## Task 1: Pain store in `storage.js`

**Files:** Modify `js/storage.js`; Test `tests/storage.test.js`.

- [ ] **Step 1: Add failing tests**

In `tests/storage.test.js`, extend the import destructure line to include the new functions:

```javascript
const { loadMeds, saveMeds, loadDoses, addDose, pruneDoses, uuid, loadPain, addPain, prunePain } =
  await import('../js/storage.js');
```

Append these tests:

```javascript
test('addPain then loadPain round-trips, note optional', () => {
  addPain(7, 'after walking', 1000);
  addPain(3, '', 2000);
  const pain = loadPain();
  assert.equal(pain.length, 2);
  assert.equal(pain[0].score, 7);
  assert.equal(pain[0].note, 'after walking');
  assert.ok(!('note' in pain[1])); // empty note omitted
});

test('prunePain keeps entries within 90 days, drops older', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const pain = [
    { id: 'a', timestamp: now - 1000, score: 5 },
    { id: 'b', timestamp: now - 89 * day, score: 5 },
    { id: 'c', timestamp: now - 91 * day, score: 5 },
  ];
  assert.deepEqual(prunePain(pain, now).map((p) => p.id), ['a', 'b']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `addPain`/`loadPain`/`prunePain` are undefined.

- [ ] **Step 3: Implement in `js/storage.js`**

Add `const PAIN_KEY = 'dosegrid.pain';` next to the other key constants, and append:

```javascript
export function loadPain() { return read(PAIN_KEY); }
export function savePain(pain) { localStorage.setItem(PAIN_KEY, JSON.stringify(pain)); }

export function prunePain(pain, now = Date.now()) {
  const cutoff = now - 90 * 24 * 3600 * 1000;
  return pain.filter((p) => p.timestamp >= cutoff);
}

export function addPain(score, note = '', timestamp = Date.now()) {
  const pain = loadPain();
  const entry = { id: uuid(), timestamp, score };
  if (note) entry.note = note;
  pain.push(entry);
  savePain(pain);
  return pain;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: pain-score store (add/load/prune, 90-day)"
```

---

## Task 2: Pure pain helpers in `js/pain.js`

**Files:** Create `js/pain.js`; Test `tests/pain.test.js`.

- [ ] **Step 1: Write failing tests**

Create `tests/pain.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { severity, WINDOWS, painInWindow, dosesInWindow, latestPain } from '../js/pain.js';

test('severity boundaries', () => {
  assert.equal(severity(0), 'none');
  assert.equal(severity(1), 'mild');
  assert.equal(severity(3), 'mild');
  assert.equal(severity(4), 'moderate');
  assert.equal(severity(6), 'moderate');
  assert.equal(severity(7), 'severe');
  assert.equal(severity(10), 'severe');
});

test('WINDOWS keys in order', () => {
  assert.deepEqual(WINDOWS.map((w) => w.key), ['1d', '3d', '1w', '2w']);
});

test('painInWindow filters to window and sorts ascending', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const pain = [
    { id: 'a', timestamp: now - 2 * day, score: 5 },
    { id: 'b', timestamp: now - 1000, score: 8 },
    { id: 'c', timestamp: now - 10 * day, score: 3 },
  ];
  assert.deepEqual(painInWindow(pain, 3 * day, now).map((p) => p.id), ['a', 'b']);
});

test('dosesInWindow filters to window', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: 'd1', medId: 'm', timestamp: now - 2 * day, units: 1 },
    { id: 'd2', medId: 'm', timestamp: now - 20 * day, units: 1 },
  ];
  assert.deepEqual(dosesInWindow(doses, 7 * day, now).map((d) => d.id), ['d1']);
});

test('latestPain returns most recent or null', () => {
  assert.equal(latestPain([]), null);
  const now = Date.now();
  const pain = [{ id: 'a', timestamp: now - 5000, score: 2 }, { id: 'b', timestamp: now, score: 9 }];
  assert.equal(latestPain(pain).id, 'b');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pain.test.js`
Expected: FAIL — `../js/pain.js` does not exist / no exports.

- [ ] **Step 3: Create `js/pain.js`**

```javascript
// js/pain.js — pure helpers for pain tracking (no DOM)

export const WINDOWS = [
  { key: '1d', label: '1 day', ms: 24 * 3600 * 1000 },
  { key: '3d', label: '3 days', ms: 3 * 24 * 3600 * 1000 },
  { key: '1w', label: '1 week', ms: 7 * 24 * 3600 * 1000 },
  { key: '2w', label: '2 weeks', ms: 14 * 24 * 3600 * 1000 },
];

// 0 none · 1-3 mild · 4-6 moderate · 7-10 severe
export function severity(score) {
  if (score <= 0) return 'none';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  return 'severe';
}

export function painInWindow(pain, windowMs, now) {
  const cutoff = now - windowMs;
  return pain.filter((p) => p.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
}

export function dosesInWindow(doses, windowMs, now) {
  const cutoff = now - windowMs;
  return doses.filter((d) => d.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
}

export function latestPain(pain) {
  if (!pain.length) return null;
  return pain.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/pain.test.js`
Expected: PASS. Also run full `node --test` (no regressions).

- [ ] **Step 5: Commit**

```bash
git add js/pain.js tests/pain.test.js
git commit -m "feat: pure pain helpers (severity, windows, filters)"
```

---

## Task 3: Two-view HTML structure + CSS

**Files:** Modify `index.html`, `css/styles.css`. (No tests; run the suite to confirm no regression.)

- [ ] **Step 1: Restructure `index.html` body**

Replace the existing `<header>` … through the `<main id="grid">` line. Find:

```html
  <header class="app-header">
    <h1>DoseGrid</h1>
    <button id="about-btn" class="icon-btn" aria-label="About / How it works">?</button>
  </header>

  <main id="grid" class="grid" aria-label="Medication grid"></main>
```

Replace with:

```html
  <header class="app-header">
    <h1>DoseGrid</h1>
    <div class="view-toggle" role="tablist" aria-label="View">
      <button id="tab-pain" class="active">Pain</button>
      <button id="tab-meds">Meds</button>
    </div>
    <button id="about-btn" class="icon-btn" aria-label="About / How it works">?</button>
  </header>

  <main>
    <section id="pain-view" aria-label="Pain tracking"></section>
    <section id="meds-view" hidden>
      <div id="grid" class="grid" aria-label="Medication grid"></div>
    </section>
  </main>
```

- [ ] **Step 2: Append pain/view CSS to `css/styles.css`**

```css
/* View toggle (header) */
.view-toggle { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
.view-toggle button { border: none; background: transparent; color: var(--muted); font: inherit; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; border-radius: 999px; cursor: pointer; }
.view-toggle button.active { background: var(--accent); color: #06222a; }
/* Pain view */
#pain-view { padding: 14px; }
.pain-now { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; min-height: 72px; }
.pain-now.muted { color: var(--muted); }
.pain-score { font-size: 2.4rem; font-weight: 800; line-height: 1; }
.pain-score span { font-size: 1rem; color: var(--muted); font-weight: 600; }
.pain-meta { font-size: 0.85rem; color: var(--text); text-transform: capitalize; }
.pain-log-btn { width: 100%; margin-top: 14px; font-size: 1.05rem; }
.win-tabs { display: flex; gap: 6px; margin: 16px 0 8px; }
.win-tabs button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font: inherit; font-size: 0.8rem; cursor: pointer; }
.win-tabs button.active { color: var(--accent); border-color: var(--accent); }
.pain-graph { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; }
.pain-graph-placeholder { padding: 30px 10px; text-align: center; }
.pain-svg { width: 100%; height: auto; display: block; }
/* Pain scale picker (log sheet) */
.pain-scale { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 8px; }
.pain-pick { aspect-ratio: 1; border-radius: 10px; border: 2px solid var(--line); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.pain-pick.sel { border-color: var(--sev); background: var(--sev); color: #06222a; }
@media (min-width: 420px) { .pain-scale { grid-template-columns: repeat(11, 1fr); } }
```

- [ ] **Step 3: Verify**

Run: `node --test` → expect 28/28 PASS (Tasks 1-2 added 7 tests to the prior 21... exact count may vary; the point is no regressions). Serve (`python -m http.server 8000`) and confirm the page loads with the header showing a Pain | Meds toggle; `#pain-view` is empty for now (filled in Task 4), `#meds-view` hidden.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: two-view layout (Pain | Meds toggle) + pain-view styles"
```

---

## Task 4: Pain capture + summary (`painview.js`) + app wiring

**Files:** Modify `js/ui.js` (export helpers), create `js/painview.js`, modify `js/app.js`.

- [ ] **Step 1: Export the sheet helpers from `js/ui.js`**

(a) Find: `const modalRoot = () => document.getElementById('modal-root');`
Replace with: `export const modalRoot = () => document.getElementById('modal-root');`

(b) Find:
```javascript
function closeModal() { modalRoot().innerHTML = ''; }
function openSheet(html) {
```
Replace with:
```javascript
export function closeModal() { modalRoot().innerHTML = ''; }
export function openSheet(html) {
```

(No behaviour change — these are now importable.)

- [ ] **Step 2: Create `js/painview.js` (capture + summary; graph placeholder)**

```javascript
// js/painview.js — the Pain view: current-pain summary, log sheet, and (Task 5) overlay graph.
import { loadPain, addPain } from './storage.js';
import { WINDOWS, severity, latestPain } from './pain.js';
import { openSheet, closeModal, modalRoot } from './ui.js';

let currentWindow = '1d';

const painViewEl = () => document.getElementById('pain-view');

const SEV_COLOR = { none: '#4ade80', mild: '#4ade80', moderate: '#fbbf24', severe: '#f87171' };

function fmtRelative(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(ts).toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function renderPainView() {
  const pain = loadPain();
  const last = latestPain(pain);
  const summary = last
    ? `<div class="pain-now"><div class="pain-score" style="color:${SEV_COLOR[severity(last.score)]}">${last.score}<span>/10</span></div>` +
      `<div class="pain-meta">${severity(last.score)} · logged ${fmtRelative(last.timestamp)}${last.note ? `<br><span class="muted">“${last.note}”</span>` : ''}</div></div>`
    : `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;

  const tabs = WINDOWS.map((w) =>
    `<button data-win="${w.key}" class="${w.key === currentWindow ? 'active' : ''}">${w.label}</button>`).join('');

  const graph = `<div class="pain-graph-placeholder muted">Pain graph appears here.</div>`;

  painViewEl().innerHTML =
    summary +
    `<button class="btn pain-log-btn" id="log-pain">＋ Log pain</button>` +
    `<div class="win-tabs">${tabs}</div>` +
    `<div class="pain-graph">${graph}</div>`;

  painViewEl().querySelector('#log-pain').addEventListener('click', openPainLog);
  painViewEl().querySelectorAll('.win-tabs button').forEach((b) =>
    b.addEventListener('click', () => { currentWindow = b.dataset.win; renderPainView(); }));
}

export function openPainLog() {
  let selected = null;
  const scale = Array.from({ length: 11 }, (_, n) =>
    `<button class="pain-pick" data-score="${n}" style="--sev:${SEV_COLOR[severity(n)]}">${n}</button>`).join('');
  openSheet(
    `<h2>How bad is your pain right now?</h2>` +
    `<div class="pain-scale">${scale}</div>` +
    `<div class="field"><label>Note (optional)</label><input id="pain-note" placeholder="e.g. after walking" /></div>` +
    `<div class="btn-row"><button class="btn secondary" id="pain-cancel">Cancel</button>` +
    `<button class="btn" id="pain-save" disabled>Save</button></div>`
  );
  const saveBtn = modalRoot().querySelector('#pain-save');
  modalRoot().querySelectorAll('.pain-pick').forEach((b) =>
    b.addEventListener('click', () => {
      selected = Number(b.dataset.score);
      modalRoot().querySelectorAll('.pain-pick').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      saveBtn.disabled = false;
    }));
  modalRoot().querySelector('#pain-cancel').addEventListener('click', closeModal);
  saveBtn.addEventListener('click', () => {
    if (selected === null) return;
    const note = modalRoot().querySelector('#pain-note').value.trim();
    addPain(selected, note);
    closeModal();
    renderPainView();
  });
}
```

- [ ] **Step 3: Rewrite `js/app.js` to wire both views + toggle**

Replace the ENTIRE contents of `js/app.js` with:

```javascript
// js/app.js
import { loadDoses, saveDoses, pruneDoses, loadPain, savePain, prunePain } from './storage.js';
import { renderGrid, showLanding } from './ui.js';
import { renderPainView } from './painview.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Prune old data on startup (doses 14d, pain 90d)
saveDoses(pruneDoses(loadDoses()));
savePain(prunePain(loadPain()));

// Render both views (Meds view starts hidden; Pain is the default focus)
renderGrid();
renderPainView();

function setView(view) {
  const pain = view === 'pain';
  document.getElementById('pain-view').hidden = !pain;
  document.getElementById('meds-view').hidden = pain;
  document.getElementById('tab-pain').classList.toggle('active', pain);
  document.getElementById('tab-meds').classList.toggle('active', !pain);
  if (pain) renderPainView(); else renderGrid();
}
document.getElementById('tab-pain').addEventListener('click', () => setView('pain'));
document.getElementById('tab-meds').addEventListener('click', () => setView('meds'));

// First launch → landing page (unchanged)
if (!localStorage.getItem(ONBOARD_KEY)) {
  showLanding({ showDismiss: true, onDismiss: () => localStorage.setItem(ONBOARD_KEY, '1') });
}
document.getElementById('about-btn').addEventListener('click', () => showLanding());

// Keep dose countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderPainView(); } });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
```

- [ ] **Step 4: Verify**

Run: `node --check js/ui.js js/painview.js js/app.js` → clean. Run `node --test` → no regressions.
Serve and check: app opens on **Pain** view; "＋ Log pain" opens the 0–10 sheet; pick a score (Save enables), add a note, Save → summary shows the score in its severity colour and "logged just now". Toggle to **Meds** → grid still works (tap to dose, long-press history). Toggle back to Pain. Reload → pain persists. (Graph still a placeholder — Task 5.)

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/painview.js js/app.js
git commit -m "feat: pain capture + current-pain summary, Pain-first two-view app"
```

---

## Task 5: Severity-coloured overlay graph

**Files:** Modify `js/painview.js`.

- [ ] **Step 1: Extend the imports in `js/painview.js`**

(a) Find: `import { loadPain, addPain } from './storage.js';`
Replace with: `import { loadPain, addPain, loadDoses, loadMeds } from './storage.js';`

(b) Find: `import { WINDOWS, severity, latestPain } from './pain.js';`
Replace with: `import { WINDOWS, severity, painInWindow, dosesInWindow, latestPain } from './pain.js';`

- [ ] **Step 2: Replace the placeholder graph in `renderPainView`**

Find:
```javascript
  const graph = `<div class="pain-graph-placeholder muted">Pain graph appears here.</div>`;
```
Replace with:
```javascript
  const now = Date.now();
  const win = WINDOWS.find((w) => w.key === currentWindow) || WINDOWS[0];
  const graph = painGraphSvg(
    painInWindow(pain, win.ms, now),
    dosesInWindow(loadDoses(), win.ms, now),
    medNameMap(),
    win.ms,
    now
  );
```

- [ ] **Step 3: Add `medNameMap`, a clock formatter, and `painGraphSvg` to `js/painview.js`**

Append these at the end of the file:

```javascript
function medNameMap() {
  const map = {};
  for (const m of loadMeds()) map[m.id] = m.name;
  return map;
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function painGraphSvg(painEntries, doses, medNames, windowMs, now) {
  const W = 320, H = 180, padL = 24, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const start = now - windowMs;
  const x = (ts) => padL + Math.max(0, Math.min(1, (ts - start) / windowMs)) * plotW;
  const y = (score) => padT + (1 - score / 10) * plotH;

  let grid = '';
  for (const v of [0, 5, 10]) {
    const yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#334155" stroke-width="1"/>`;
    grid += `<text x="${padL - 4}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${v}</text>`;
  }

  const oneDay = 24 * 3600 * 1000;
  let xticks = '';
  for (let i = 0; i <= 4; i++) {
    const ts = start + (windowMs * i) / 4;
    const xx = padL + (plotW * i) / 4;
    const label = windowMs <= oneDay
      ? new Date(ts).toLocaleTimeString([], { hour: 'numeric' })
      : new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'numeric' });
    xticks += `<text x="${xx}" y="${H - padB + 12}" text-anchor="middle" font-size="8" fill="#64748b">${label}</text>`;
  }

  let line = '', dots = '';
  if (painEntries.length) {
    if (painEntries.length > 1) {
      const pts = painEntries.map((p) => `${x(p.timestamp)},${y(p.score)}`).join(' ');
      line = `<polyline points="${pts}" fill="none" stroke="rgba(34,211,238,0.5)" stroke-width="2"/>`;
    }
    dots = painEntries.map((p) =>
      `<circle cx="${x(p.timestamp)}" cy="${y(p.score)}" r="4" fill="${SEV_COLOR[severity(p.score)]}">` +
      `<title>Pain ${p.score}/10 · ${fmtClock(p.timestamp)}${p.note ? ` · ${p.note}` : ''}</title></circle>`).join('');
  }

  const baseY = H - padB;
  const ticks = doses.map((d) =>
    `<line x1="${x(d.timestamp)}" y1="${baseY}" x2="${x(d.timestamp)}" y2="${baseY - 9}" stroke="#22d3ee" stroke-width="2">` +
    `<title>${medNames[d.medId] || 'Dose'} · ${fmtClock(d.timestamp)} · ${d.units} tab${d.units === 1 ? '' : 's'}</title></line>`).join('');

  const empty = painEntries.length ? '' :
    `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="11" fill="#94a3b8">No pain logged in this window — tap Log pain.</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="pain-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pain over time with medication doses">` +
    grid + xticks + line + dots + ticks + empty + `</svg>`;
}
```

- [ ] **Step 4: Verify**

Run: `node --check js/painview.js` → clean. `node --test` → no regressions.
Serve and check: with a few pain scores logged across today, the **1 day** view shows coloured dots (green/amber/red by score) connected by a line, with 0/5/10 gridlines and hour labels. Log a med dose in Meds view, return to Pain → a cyan tick appears on the baseline at the dose time (hover shows the med name). Switch **3 days / 1 week / 2 weeks** — axis labels change to dates and points re-scale. Empty window shows the "No pain logged in this window" message.

- [ ] **Step 5: Commit**

```bash
git add js/painview.js
git commit -m "feat: severity-coloured pain overlay graph with dose markers + window tabs"
```

---

## Task 6: Service worker + README + final verification

**Files:** Modify `service-worker.js`, `README.md`.

- [ ] **Step 1: Bump SW cache + precache new modules**

In `service-worker.js`: change `const CACHE = 'dosegrid-v3';` to `const CACHE = 'dosegrid-v4';`, and add `'./js/pain.js'` and `'./js/painview.js'` to the `ASSETS` array (after `'./js/categories.js'`).

- [ ] **Step 2: Update `README.md`**

Update the top one-liner to: "DoseGrid — a pain-management tracker for as-needed (PRN) and short-course medicines: log your pain score over time and see it against when you medicated. It shows when you're *allowed* to take more, not when you should." Add these bullets to the manual test checklist:

- Open the app → it starts on the **Pain** view; toggle **Meds** for the medication grid.
- "＋ Log pain" → pick a 0–10 score (coloured by severity) + optional note → Save; the current-pain summary updates in the matching colour.
- The graph shows pain points coloured by severity with a line, and cyan ticks where doses were taken; switch 1 day / 3 days / 1 week / 2 weeks.

- [ ] **Step 3: Full verification**

Run: `node --test` → all green. `node --check js/*.js` → clean. Confirm `service-worker.js` has `dosegrid-v4` and lists both new modules. Serve and walk the full manual checklist (pain log, summary colour, all four windows, dose overlay, Meds toggle still logs doses + per-med history, landing page first-run, reload persists, offline loads).

- [ ] **Step 4: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: bump SW cache for pain tracking; update README"
```

---

## Self-Review (author check vs spec)

- **Pain store `dosegrid.pain`, 90-day prune, optional note** → Task 1.
- **Pure helpers (severity 0/1-3/4-6/7-10, WINDOWS 1d/3d/1w/2w, painInWindow, dosesInWindow, latestPain)** → Task 2.
- **Pain-first two views + header toggle (Pain default)** → Tasks 3 (structure), 4 (app wiring).
- **Pain-log sheet (0–10 NRS buttons + optional note, save disabled until chosen)** → Task 4.
- **Current-pain summary with severity colour** → Task 4.
- **Severity-coloured overlay graph (pain dots+line, dose ticks, 0/5/10 grid, time axis), 4 windows, empty state** → Task 5.
- **Meds grid + per-med history kept intact** → reused; lives in `#meds-view`.
- **SW cache + README** → Task 6.

Type/name consistency: `loadPain`/`savePain`/`addPain`/`prunePain` (Task 1 → used Tasks 4/5/app), `severity`/`WINDOWS`/`painInWindow`/`dosesInWindow`/`latestPain` (Task 2 → used Tasks 4/5), `renderPainView`/`openPainLog`/`painGraphSvg`/`medNameMap`/`SEV_COLOR` (Tasks 4/5), exported `openSheet`/`closeModal`/`modalRoot` from ui.js (Task 4 Step 1 → imported by painview.js). Pain entry shape `{id,timestamp,score,note?}` consistent across store, helpers, graph tooltips.
