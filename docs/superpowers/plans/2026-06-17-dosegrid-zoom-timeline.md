# Zoomable Pain + Dose Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pain view's fixed window tabs with one continuous pinch-zoom + scrollable timeline (unlimited history, fortnight max on screen) that level-of-detail switches between per-dose detail and a summarised overview, with click-to-inspect and day/hour background banding.

**Architecture:** Pure, tested helpers live in `js/pain.js`. The interactive chart is its own module `js/timeline.js` (`createTimeline(host,{onPainClick,onDoseClick})` → `{render}`), reading `loadPain/loadDoses/loadMeds` directly. `js/painview.js` hosts the timeline plus the existing summary + log sheet, and gains `openDoseDetail`. Vanilla JS, inline SVG, no libs.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), inline SVG, Pointer Events, `localStorage`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-17-dosegrid-zoom-timeline-design.md`

---

## File Structure

- `js/pain.js` — pure helpers; **remove** `WINDOWS`/`painInWindow`/`dosesInWindow`; **keep** `severity`/`latestPain`; **add** `painColor`, `medColor`, `lodMode`, `startOfDay`, `isEarlyDose`, `medDayTotals`.
- `js/timeline.js` — **new** zoomable chart module.
- `js/painview.js` — host the timeline; drop window-tab UI / `painGraphSvg` / `medNameMap` / local `painColor`; add `openDoseDetail`.
- `css/styles.css` — timeline host + mode chip + zoom buttons; remove `.win-tabs`.
- `service-worker.js` — precache `js/timeline.js`; bump cache to `dosegrid-v5`.
- `tests/pain.test.js` — drop removed-helper tests; add helper tests.

---

## Task 1: Refactor `js/pain.js` pure helpers

**Files:** Modify `js/pain.js`; Modify `tests/pain.test.js`.

- [ ] **Step 1: Replace `tests/pain.test.js` entirely**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { severity, latestPain, painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals } from '../js/pain.js';

test('severity boundaries', () => {
  assert.equal(severity(0), 'none');
  assert.equal(severity(3), 'mild');
  assert.equal(severity(4), 'moderate');
  assert.equal(severity(6), 'moderate');
  assert.equal(severity(7), 'severe');
  assert.equal(severity(10), 'severe');
});

test('latestPain returns most recent or null', () => {
  assert.equal(latestPain([]), null);
  const now = Date.now();
  assert.equal(latestPain([{ id:'a', timestamp: now-5000, score:2 }, { id:'b', timestamp: now, score:9 }]).id, 'b');
});

test('painColor ramps green→red, distinct per score', () => {
  assert.match(painColor(0), /hsl\(140/);
  assert.match(painColor(10), /hsl\(0/);
  assert.notEqual(painColor(2), painColor(8));
});

test('medColor is deterministic and distinct for first colours', () => {
  assert.equal(medColor(0), medColor(0));
  assert.notEqual(medColor(0), medColor(1));
  assert.equal(typeof medColor(0), 'string');
  assert.equal(medColor(0), medColor(8)); // palette of 8 cycles
});

test('lodMode switches at threshold', () => {
  assert.equal(lodMode(120), 'detail');
  assert.equal(lodMode(40), 'overview');
  assert.equal(lodMode(90), 'detail');   // >= threshold
  assert.equal(lodMode(89), 'overview');
});

test('startOfDay returns local midnight', () => {
  const t = new Date('2026-06-17T14:30:00').getTime();
  const s = new Date(startOfDay(t));
  assert.equal(s.getHours(), 0);
  assert.equal(s.getMinutes(), 0);
  assert.ok(startOfDay(t) <= t);
});

test('isEarlyDose true when gap under interval', () => {
  const now = Date.now();
  assert.equal(isEarlyDose(now, now - 2*3600*1000, 6), true);   // 2h < 6h
  assert.equal(isEarlyDose(now, now - 7*3600*1000, 6), false);  // 7h >= 6h
  assert.equal(isEarlyDose(now, null, 6), false);               // no previous dose
});

test('medDayTotals sums per med per calendar day', () => {
  const d0 = new Date('2026-06-17T08:00:00').getTime();
  const d0b = new Date('2026-06-17T20:00:00').getTime();
  const d1 = new Date('2026-06-18T08:00:00').getTime();
  const map = medDayTotals([
    { medId:'a', timestamp:d0, units:1 },
    { medId:'a', timestamp:d0b, units:2 },
    { medId:'b', timestamp:d0, units:1 },
    { medId:'a', timestamp:d1, units:1 },
  ]);
  const day0 = startOfDay(d0), day1 = startOfDay(d1);
  assert.equal(map.get(day0).a, 3);
  assert.equal(map.get(day0).b, 1);
  assert.equal(map.get(day1).a, 1);
});
```

- [ ] **Step 2: Run `node --test tests/pain.test.js` → confirm FAIL** (new helpers not exported; removed helpers gone).

- [ ] **Step 3: Replace `js/pain.js` entirely**

```javascript
// js/pain.js — pure helpers for pain tracking (no DOM)

// 0 none · 1-3 mild · 4-6 moderate · 7-10 severe
export function severity(score) {
  if (score <= 0) return 'none';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  return 'severe';
}

export function latestPain(pain) {
  if (!pain.length) return null;
  return pain.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
}

// Smooth green→red gradient: each 0–10 score gets its own colour (140° green → 0° red).
export function painColor(score) {
  const s = Math.max(0, Math.min(10, score));
  return `hsl(${140 - (140 * s) / 10}, 75%, 52%)`;
}

const MED_PALETTE = ['#38bdf8', '#a78bfa', '#f472b6', '#f59e0b', '#34d399', '#fb7185', '#60a5fa', '#c084fc'];
export function medColor(index) {
  const i = ((index % MED_PALETTE.length) + MED_PALETTE.length) % MED_PALETTE.length;
  return MED_PALETTE[i];
}

export const DETAIL_PXDAY = 90; // px-per-day at/above which the chart shows full detail
export function lodMode(pxPerDay) {
  return pxPerDay >= DETAIL_PXDAY ? 'detail' : 'overview';
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isEarlyDose(curTs, prevTs, intervalHours) {
  return prevTs != null && (curTs - prevTs) < intervalHours * 3600 * 1000;
}

// Map<dayStartMs, { [medId]: totalUnits }>
export function medDayTotals(doses) {
  const map = new Map();
  for (const d of doses) {
    const ds = startOfDay(d.timestamp);
    if (!map.has(ds)) map.set(ds, {});
    const m = map.get(ds);
    m[d.medId] = (m[d.medId] || 0) + d.units;
  }
  return map;
}
```

- [ ] **Step 4: Run `node --test tests/pain.test.js` → PASS.** Then full `node --test` will FAIL in `painview` import only at runtime (browser) — not in node tests, since painview isn't imported by tests. Confirm the node suite passes (storage/dosing/data/dataset/pain). Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add js/pain.js tests/pain.test.js
git commit -m "refactor: pain.js pure helpers for the zoomable timeline (colour, lod, day totals)"
```

---

## Task 2: New `js/timeline.js` chart module

**Files:** Create `js/timeline.js`.

- [ ] **Step 1: Create `js/timeline.js`**

```javascript
// js/timeline.js — zoomable, scrollable pain + dose timeline with level-of-detail.
import { loadPain, loadDoses, loadMeds } from './storage.js';
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals, DETAIL_PXDAY } from './pain.js';

const DAY = 864e5, HOUR = 36e5;
const padL = 30, padR = 12;
const painTop = 14, painBot = 150, laneTop = 182, laneBot = 292, axisY = 308, H = 320;
const MAX_SPAN = 14 * DAY;   // most zoomed-out = a fortnight on screen
const MIN_SPAN = 12 * HOUR;  // deepest zoom

const fmtClock = t => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const fmtDay = t => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const startOfHour = t => { const d = new Date(t); d.setMinutes(0, 0, 0); return d.getTime(); };

export function createTimeline(host, { onPainClick, onDoseClick } = {}) {
  let scale = 1, t0 = 0, W = 600;
  let dragging = false, dragMoved = false, lastX = 0;
  const pointers = new Map(); let pinchDist = 0;
  let doseById = new Map();

  function range() {
    const now = Date.now();
    const ts = [...loadPain().map(p => p.timestamp), ...loadDoses().map(d => d.timestamp)];
    const min = ts.length ? Math.min(...ts) : now - MAX_SPAN;
    return { start: Math.min(min, now - MAX_SPAN), end: now };
  }
  function fit() { W = host.clientWidth; scale = (W - padL - padR) / MAX_SPAN; t0 = Date.now() - MAX_SPAN; }
  const pxDay = () => scale * DAY;
  function clamp() {
    W = host.clientWidth;
    const { start, end } = range();
    const sMin = (W - padL - padR) / MAX_SPAN, sMax = (W - padL - padR) / MIN_SPAN;
    scale = Math.max(sMin, Math.min(sMax, scale));
    const span = (W - padL - padR) / scale;
    const lo = start, hi = end - span;
    t0 = hi <= lo ? hi : Math.max(lo, Math.min(hi, t0));
  }
  const X = t => padL + (t - t0) * scale;
  const tR = () => t0 + (W - padL - padR) / scale;

  function medLookup() {
    const map = {};
    loadMeds().forEach((m) => { map[m.id] = { name: m.name, color: medColor(m.order || 0), max: m.maxDailyUnits || 0, interval: m.intervalHours || 0 }; });
    return map;
  }

  function render() {
    clamp();
    W = host.clientWidth;
    const span = tR() - t0;
    const detail = lodMode(pxDay()) === 'detail';
    const meds = medLookup();
    const pain = loadPain(), doses = loadDoses().slice().sort((a, b) => a.timestamp - b.timestamp);
    doseById = new Map(doses.map(d => [d.id, d]));
    const vis = pain.filter(p => p.timestamp >= t0 - DAY && p.timestamp <= tR() + DAY).sort((a, b) => a.timestamp - b.timestamp);
    const visDoses = doses.filter(d => d.timestamp >= t0 - DAY && d.timestamp <= tR() + DAY);
    const Y = v => painBot - (v / 10) * (painBot - painTop);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="tl-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

    // ---- background banding: day stripes (always) + hour stripes (fade in) ----
    const bandH = laneBot - painTop, ref = startOfDay(range().start);
    for (let dd = startOfDay(t0); dd < tR(); dd += DAY) {
      const x1 = Math.max(padL, X(dd)), x2 = Math.min(W - padR, X(dd + DAY));
      if (x2 > x1 && Math.round((dd - ref) / DAY) % 2 === 0)
        s += `<rect x="${x1.toFixed(1)}" y="${painTop}" width="${(x2 - x1).toFixed(1)}" height="${bandH}" fill="rgba(148,163,184,0.05)"/>`;
      const mx = X(dd);
      if (mx >= padL && mx <= W - padR)
        s += `<line x1="${mx.toFixed(1)}" y1="${painTop}" x2="${mx.toFixed(1)}" y2="${laneBot}" stroke="rgba(148,163,184,0.22)" stroke-width="1"/>`;
    }
    const hourAlpha = Math.max(0, Math.min(1, (scale * HOUR - 7) / 22));
    if (hourAlpha > 0.02) for (let hh = startOfHour(t0); hh < tR(); hh += HOUR) {
      const x1 = Math.max(padL, X(hh)), x2 = Math.min(W - padR, X(hh + HOUR));
      if (x2 > x1 && new Date(hh).getHours() % 2 === 0)
        s += `<rect x="${x1.toFixed(1)}" y="${painTop}" width="${(x2 - x1).toFixed(1)}" height="${bandH}" fill="rgba(34,211,238,${(hourAlpha * 0.06).toFixed(3)})"/>`;
    }

    // ---- pain gridlines ----
    for (const [v, y] of [[10, painTop], [5, (painTop + painBot) / 2], [0, painBot]]) {
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#334155"/><text x="${padL - 4}" y="${y + 3}" font-size="9" fill="#94a3b8" text-anchor="end">${v}</text>`;
    }

    // ---- pain ----
    if (detail) {
      if (vis.length > 1) s += `<polyline points="${vis.map(p => `${X(p.timestamp).toFixed(1)},${Y(p.score).toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(34,211,238,.45)" stroke-width="1.5"/>`;
      for (const p of vis) {
        const cx = X(p.timestamp).toFixed(1), cy = Y(p.score).toFixed(1);
        const ring = p.note ? ' stroke="#f8fafc" stroke-width="2"' : '';
        s += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${painColor(p.score)}"${ring}/>`;
        s += `<circle cx="${cx}" cy="${cy}" r="13" fill="transparent" data-pain="${p.id}" style="cursor:pointer"/>`;
      }
    } else {
      for (let i = 1; i < vis.length; i++) {
        const a = vis[i - 1], b = vis[i];
        s += `<line x1="${X(a.timestamp).toFixed(1)}" y1="${Y(a.score).toFixed(1)}" x2="${X(b.timestamp).toFixed(1)}" y2="${Y(b.score).toFixed(1)}" stroke="${painColor((a.score + b.score) / 2)}" stroke-width="2.5"/>`;
      }
      for (const p of vis) if (p.note) {
        const cx = X(p.timestamp).toFixed(1), cy = Y(p.score).toFixed(1);
        s += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="#f8fafc"/><circle cx="${cx}" cy="${cy}" r="13" fill="transparent" data-pain="${p.id}" style="cursor:pointer"/>`;
      }
    }

    // ---- dose lane ----
    const laneH = laneBot - laneTop;
    s += `<text x="${padL}" y="${laneTop - 6}" font-size="8" fill="#64748b">DOSES — ${detail ? 'each dose, height = share of daily limit' : 'per-med daily totals vs each med’s max'}</text>`;
    s += `<line x1="${padL}" y1="${laneTop}" x2="${W - padR}" y2="${laneTop}" stroke="#f87171" stroke-width="1" stroke-dasharray="3 3"/><text x="${padL - 4}" y="${laneTop + 3}" font-size="7" fill="#f87171" text-anchor="end">max</text>`;
    s += `<line x1="${padL}" y1="${laneBot}" x2="${W - padR}" y2="${laneBot}" stroke="#475569"/>`;
    if (detail) {
      const cum = {}, lastTs = {};
      for (const d of visDoses) {
        const m = meds[d.medId] || { color: '#94a3b8', max: 0, interval: 0 };
        const dk = d.medId + '|' + startOfDay(d.timestamp);
        cum[dk] = (cum[dk] || 0) + d.units;
        const share = m.max ? Math.min(cum[dk] / m.max, 1.3) : 0.2;
        const top = laneBot - share * laneH;
        const early = isEarlyDose(d.timestamp, lastTs[d.medId] ?? null, m.interval);
        lastTs[d.medId] = d.timestamp;
        const x = X(d.timestamp).toFixed(1);
        s += `<line x1="${x}" y1="${laneBot}" x2="${x}" y2="${top.toFixed(1)}" stroke="${m.color}" stroke-width="3"/>`;
        s += `<circle cx="${x}" cy="${top.toFixed(1)}" r="7" fill="${m.color}"${early ? ' stroke="#fbbf24" stroke-width="2"' : ''} data-dose="${d.id}" style="cursor:pointer"/>`;
        s += `<text x="${x}" y="${(top + 3).toFixed(1)}" font-size="8" fill="#06222a" text-anchor="middle" font-weight="700" pointer-events="none">${d.units}</text>`;
      }
    } else {
      const totals = medDayTotals(visDoses);
      const order = loadMeds();
      const BW = 7;
      for (const [ds, perMed] of totals) {
        const present = order.filter(m => perMed[m.id]);
        let bx = X(ds + 12 * HOUR) - (present.length * BW) / 2;
        for (const m of present) {
          const mm = meds[m.id], tabs = perMed[m.id], share = mm.max ? tabs / mm.max : 0.3;
          const h = Math.min(share, 1.3) * laneH;
          s += `<rect x="${bx.toFixed(1)}" y="${(laneBot - h).toFixed(1)}" width="${BW - 1}" height="${h.toFixed(1)}" rx="1.5" fill="${mm.color}" data-day="${ds}" data-med="${m.id}" style="cursor:pointer"/>`;
          bx += BW;
        }
      }
    }

    // ---- time axis ----
    for (let i = 0; i <= 5; i++) {
      const t = t0 + (span * i / 5), x = padL + (W - padL - padR) * i / 5;
      const label = span <= 2 * DAY ? new Date(t).toLocaleTimeString([], { hour: 'numeric' })
        : span <= 9 * DAY ? new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric' })
        : new Date(t).getDate() + '/' + (new Date(t).getMonth() + 1);
      s += `<text x="${x.toFixed(1)}" y="${axisY}" font-size="9" fill="#94a3b8" text-anchor="middle">${label}</text>`;
    }
    s += `</svg>`;
    host.innerHTML = s;
  }

  // ---- interaction ----
  function zoomAt(px, factor) { const tf = t0 + (px - padL) / scale; scale *= factor; clamp(); t0 = tf - (px - padL) / scale; clamp(); render(); }
  host.addEventListener('wheel', e => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e.clientX); if (pointers.size === 1) { dragging = true; dragMoved = false; lastX = e.clientX; } if (pointers.size === 2) { const xs = [...pointers.values()]; pinchDist = Math.abs(xs[0] - xs[1]); } });
  host.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e.clientX);
    if (pointers.size === 2) { const xs = [...pointers.values()]; const d = Math.abs(xs[0] - xs[1]); const r = host.getBoundingClientRect(); if (pinchDist) zoomAt((xs[0] + xs[1]) / 2 - r.left, d / pinchDist); pinchDist = d; return; }
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; if (Math.abs(dx) > 2) dragMoved = true; t0 -= dx / scale; render(); }
  });
  function up(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (pointers.size === 0) dragging = false; }
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', e => {
    if (dragMoved) return;
    const pa = e.target.closest('[data-pain]'); if (pa) { onPainClick && onPainClick(pa.dataset.pain); return; }
    const dz = e.target.closest('[data-dose]'); if (dz) { onDoseClick && onDoseClick(doseById.get(dz.dataset.dose)); return; }
  });
  window.addEventListener('resize', () => { fit(); render(); });

  fit();
  return { render };
}
```

- [ ] **Step 2: Syntax-check** — Run `node --check js/timeline.js` → expect clean (no output).

- [ ] **Step 3: Commit**

```bash
git add js/timeline.js
git commit -m "feat: zoomable scrollable pain+dose timeline module"
```

---

## Task 3: Integrate the timeline into `js/painview.js`

**Files:** Modify `js/painview.js`.

- [ ] **Step 1: Replace the import lines + drop window state.**

Find:
```javascript
import { loadPain, savePain, addPain, loadDoses, loadMeds } from './storage.js';
import { WINDOWS, severity, painInWindow, dosesInWindow, latestPain } from './pain.js';
import { openSheet, closeModal, modalRoot } from './ui.js';

let currentWindow = '1d';

const painViewEl = () => document.getElementById('pain-view');

// Smooth green→red gradient: each 0–10 score gets its own colour along an HSL ramp
// (140° green at 0 → 0° red at 10).
function painColor(score) {
  const s = Math.max(0, Math.min(10, score));
  const hue = 140 - (140 * s) / 10;
  return `hsl(${hue}, 75%, 52%)`;
}
```

Replace with:
```javascript
import { loadPain, savePain, addPain, loadMeds } from './storage.js';
import { severity, latestPain, painColor } from './pain.js';
import { openSheet, closeModal, modalRoot } from './ui.js';
import { createTimeline } from './timeline.js';

const painViewEl = () => document.getElementById('pain-view');
let timeline = null;
```

- [ ] **Step 2: Replace `renderPainView` (build through to the end of the function) so it hosts the timeline.**

Find the whole `export function renderPainView() { ... }` block (from `export function renderPainView()` to its closing `}` before `export function openPainDetail`) and replace with:

```javascript
export function renderPainView() {
  const pain = loadPain();
  const last = latestPain(pain);
  const summary = last
    ? `<div class="pain-now"><div class="pain-score" style="color:${painColor(last.score)}">${last.score}<span>/10</span></div>` +
      `<div class="pain-meta">${severity(last.score)} · logged ${fmtRelative(last.timestamp)}${last.note ? `<br><span class="muted">“${last.note}”</span>` : ''}</div></div>`
    : `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;

  painViewEl().innerHTML =
    summary +
    `<button class="btn pain-log-btn" id="log-pain">＋ Log pain</button>` +
    `<div class="tl-bar"><span class="tl-hint">Drag to scroll · pinch / scroll to zoom</span>` +
      `<span style="flex:1"></span><button class="zb" id="tl-out">–</button><button class="zb" id="tl-in">+</button></div>` +
    `<div class="tl-host" id="tl-host"></div>`;

  painViewEl().querySelector('#log-pain').addEventListener('click', openPainLog);
  const hostEl = painViewEl().querySelector('#tl-host');
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail });
  timeline.render();
  painViewEl().querySelector('#tl-in').addEventListener('click', () => { hostEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: hostEl.getBoundingClientRect().left + hostEl.clientWidth / 2 })); });
  painViewEl().querySelector('#tl-out').addEventListener('click', () => { hostEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, clientX: hostEl.getBoundingClientRect().left + hostEl.clientWidth / 2 })); });
}
```

- [ ] **Step 3: Add `openDoseDetail` after `openPainDetail`.**

Insert immediately after the closing `}` of `openPainDetail`:

```javascript
export function openDoseDetail(dose) {
  if (!dose) return;
  const med = loadMeds().find((m) => m.id === dose.medId);
  const when = new Date(dose.timestamp).toLocaleString([],
    { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  openSheet(
    `<h2>${med ? med.name : 'Dose'}</h2>` +
    `<p class="muted">${when}</p>` +
    `<p>${dose.units} tablet${dose.units === 1 ? '' : 's'}${med && med.maxDailyUnits ? ` · max ${med.maxDailyUnits}/day` : ''}</p>` +
    `<div class="btn-row"><button class="btn" id="dd-close">Close</button></div>`
  );
  modalRoot().querySelector('#dd-close').addEventListener('click', closeModal);
}
```

- [ ] **Step 4: Remove the now-dead `medNameMap` and `painGraphSvg` functions and the `fmtClock` helper.**

Delete the entire `function medNameMap() { ... }` block and the entire `function painGraphSvg(...) { ... }` block at the end of the file, and delete the `function fmtClock(ts) { ... }` helper near the top (no longer referenced). Keep `fmtRelative` (still used by the summary).

- [ ] **Step 5: Verify** — Run `node --check js/painview.js` → clean. Run `node --test` → all green (painview isn't imported by tests). Then serve (`python -m http.server 8000`) and load: pain view shows the summary, Log pain, and the timeline; drag/zoom works; clicking a pain dot opens its detail (real note), clicking a dose opens dose detail.

- [ ] **Step 6: Commit**

```bash
git add js/painview.js
git commit -m "feat: host the zoomable timeline in the pain view; add dose detail sheet"
```

---

## Task 4: CSS — timeline host + controls; remove window tabs

**Files:** Modify `css/styles.css`.

- [ ] **Step 1: Remove the obsolete `.win-tabs` rules.** Delete the two lines:
```css
.win-tabs { display: flex; gap: 6px; margin: 16px 0 8px; }
.win-tabs button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font: inherit; font-size: 0.8rem; cursor: pointer; }
.win-tabs button.active { color: var(--accent); border-color: var(--accent); }
```
(If a `.win-tabs button.active` line is on its own, delete that too.)

- [ ] **Step 2: Add timeline styles** (append after the `.pain-graph` rules, or anywhere in the pain section):
```css
/* Zoomable timeline */
.tl-bar { display: flex; align-items: center; gap: 8px; margin: 16px 0 8px; }
.tl-hint { color: var(--muted); font-size: 0.72rem; }
.zb { background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 8px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; }
.tl-host { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; touch-action: none; overflow: hidden; cursor: grab; }
.tl-host:active { cursor: grabbing; }
.tl-svg { width: 100%; height: auto; display: block; }
```

- [ ] **Step 3: Verify** — reload the served app; the timeline card and the `– / +` buttons are styled, no leftover window tabs.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "feat: timeline host + zoom-control styling; drop window tabs"
```

---

## Task 5: Service worker + README + full verification

**Files:** Modify `service-worker.js`, `README.md`.

- [ ] **Step 1: SW** — in `service-worker.js` change `const CACHE = 'dosegrid-v4';` to `const CACHE = 'dosegrid-v5';` and add `'./js/timeline.js'` to the `ASSETS` array (after `'./js/painview.js'`).

- [ ] **Step 2: README** — update the pain bullets to describe the timeline. Replace the two pain/graph checklist bullets with:
- The Pain view shows one **zoomable, scrollable timeline** (drag to pan, pinch/scroll to zoom): zoom in for individual pain dots + per-dose lollipops, out for a coloured pain line + per-med daily bars. History is unlimited; the most zoomed-out view is a fortnight.
- Tapping a pain point shows its score/time/note; tapping a dose shows the med, time and amount.

- [ ] **Step 3: Full suite** — `node --test` → all green. `node --check js/*.js` → clean. Confirm `service-worker.js` has `dosegrid-v5` and lists `./js/timeline.js`.

- [ ] **Step 4: Headless smoke** — serve and load the app; with seeded pain + doses confirm: timeline renders in Overview at a fortnight; zooming in flips to Detail (lollipops + dots); clicking a pain dot and a dose opens their sheets; day banding present.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: precache timeline.js, bump SW cache; update README for the timeline"
```

---

## Self-Review (author check vs spec)

- **One zoomable/scrollable timeline, unlimited history, fortnight max, deepest ~12h** → Task 2 (`MAX_SPAN`, `MIN_SPAN`, `clamp`, `range`).
- **LOD detail/overview, width-adaptive** → Tasks 1 (`lodMode`/`DETAIL_PXDAY`), 2.
- **Detail: severity dots + lollipops (share of limit, early ring, tablet label)** → Task 2.
- **Overview: coloured pain line + note marks + fixed-width per-calendar-day per-med bars** → Tasks 1 (`medDayTotals`), 2.
- **Click → detail (pain real note, dose info)** → Tasks 2 (callbacks), 3 (`openPainDetail`/`openDoseDetail`).
- **Wide hit targets** → Task 2 (r=13 transparent circles).
- **Day + hour banding (hour fades in)** → Task 2.
- **Per-med colour (deterministic)** → Task 1 (`medColor`), 2 (`medLookup`).
- **SW/README** → Task 5.

Type/name consistency: `painColor`/`medColor`/`lodMode`/`startOfDay`/`isEarlyDose`/`medDayTotals`/`DETAIL_PXDAY` defined in Task 1, imported in Task 2; `createTimeline(host,{onPainClick,onDoseClick})` defined Task 2, used Task 3; `openDoseDetail` defined Task 3, passed to timeline Task 3; med fields `order`/`maxDailyUnits`/`intervalHours` read in Task 2. Removed `WINDOWS`/`painInWindow`/`dosesInWindow` no longer referenced (painview rewritten Task 3, tests updated Task 1).
