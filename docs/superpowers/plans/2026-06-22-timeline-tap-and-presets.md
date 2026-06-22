# Timeline Tap-to-List + Range Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make overlapping logged doses tappable via a flat list sheet (zoomed in = cluster, zoomed out = whole day), add Today/Week range buttons, and animate zoom transitions.

**Architecture:** Three new pure helpers in `js/pain.js` (`dosesInCluster`, `dayDoses`, `rangeForPreset`) carry the testable logic. `js/timeline.js` gains an `onDoseGroup` callback, a detail-mode cluster check, invisible per-day hit rects in overview mode, and `showToday`/`showWeek`/`zoomIn`/`zoomOut` methods backed by an `animateTo` tween. `js/painview.js` adds the list sheet (`openDoseGroup`) and wires the new buttons.

**Tech Stack:** Vanilla ES modules, SVG, `node --test`. No build step. Run tests with `node --test`.

---

### Task 1: Pure helpers in pain.js

**Files:**
- Modify: `js/pain.js` (add three exports)
- Test: `tests/timeline-cluster.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/timeline-cluster.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dosesInCluster, dayDoses, rangeForPreset, startOfDay } from '../js/pain.js';

const DAY = 864e5;

test('dosesInCluster: within tolerance, sorted ascending, excludes outside', () => {
  const base = 1_700_000_000_000;
  const doses = [
    { id: 'a', timestamp: base + 60_000 },
    { id: 'b', timestamp: base },
    { id: 'c', timestamp: base + 5_000 },
    { id: 'd', timestamp: base + 10_000_000 },
  ];
  assert.deepEqual(dosesInCluster(doses, base, 120_000).map((d) => d.id), ['b', 'c', 'a']);
  assert.equal(dosesInCluster(doses, base, 1_000).length, 1);
  assert.deepEqual(dosesInCluster([], base, 1000), []);
});

test('dayDoses: only that day, sorted ascending', () => {
  const d0 = startOfDay(1_700_000_000_000);
  const doses = [
    { id: 'x', timestamp: d0 + 5 * 36e5 },
    { id: 'y', timestamp: d0 + 1 * 36e5 },
    { id: 'z', timestamp: d0 + DAY + 36e5 },
    { id: 'w', timestamp: d0 - 36e5 },
  ];
  assert.deepEqual(dayDoses(doses, d0).map((d) => d.id), ['y', 'x']);
});

test('rangeForPreset: today, week, and fallback', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(rangeForPreset('today', now), { start: startOfDay(now), end: now });
  assert.deepEqual(rangeForPreset('week', now), { start: now - 7 * DAY, end: now });
  assert.deepEqual(rangeForPreset('whatever', now), { start: startOfDay(now), end: now });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/timeline-cluster.test.js`
Expected: FAIL — `dosesInCluster`/`dayDoses`/`rangeForPreset` are not exported.

- [ ] **Step 3: Add the helpers to `js/pain.js`**

Append at the end of `js/pain.js`:

```js
const MS_DAY = 864e5;

// Doses within ±toleranceMs of centerTs, sorted ascending by timestamp.
export function dosesInCluster(doses, centerTs, toleranceMs) {
  return (doses || [])
    .filter((d) => Math.abs(d.timestamp - centerTs) <= toleranceMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Doses whose calendar day equals dayStartMs, sorted ascending by timestamp.
export function dayDoses(doses, dayStartMs) {
  return (doses || [])
    .filter((d) => startOfDay(d.timestamp) === dayStartMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Desired {start,end} time window for a range preset; pixel-independent.
export function rangeForPreset(preset, now) {
  if (preset === 'week') return { start: now - 7 * MS_DAY, end: now };
  return { start: startOfDay(now), end: now };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/timeline-cluster.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/pain.js tests/timeline-cluster.test.js
git commit -m "feat(timeline): pure helpers for dose clusters + range presets"
```

---

### Task 2: Dose-group list sheet in painview.js

**Files:**
- Modify: `js/painview.js` (add `openDoseGroup`, import nothing new — `medColor`/`loadMeds`/`openSheet`/`closeModal`/`modalRoot`/`openDoseDetail` already in scope)
- Modify: `css/styles.css` (swatch + row layout)

- [ ] **Step 1: Add `openDoseGroup` to `js/painview.js`**

Insert immediately after the end of `openDoseDetail` (after its closing `}` near line 100):

```js
export function openDoseGroup(doses) {
  if (!doses || !doses.length) return;
  if (doses.length === 1) return openDoseDetail(doses[0]);
  const meds = loadMeds();
  const medOf = (id) => meds.find((m) => m.id === id);
  const dayLabel = new Date(doses[0].timestamp)
    .toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const rows = doses.map((d) => {
    const m = medOf(d.medId);
    const time = new Date(d.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const color = m ? medColor(m.order || 0) : '#94a3b8';
    const name = m ? m.name : 'Dose';
    return `<li data-dose-id="${d.id}"><i class="sw" style="background:${color}"></i>` +
      `<span>${name}</span>` +
      `<span class="muted">${time} · ${d.units} tablet${d.units === 1 ? '' : 's'}</span></li>`;
  }).join('');
  openSheet(
    `<h2>${doses.length} doses · ${dayLabel}</h2>` +
    `<ul class="list dose-group">${rows}</ul>` +
    `<div class="btn-row"><button class="btn" id="dg-close">Close</button></div>`
  );
  modalRoot().querySelector('#dg-close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('li[data-dose-id]').forEach((li) =>
    li.addEventListener('click', () => {
      const dose = doses.find((d) => d.id === li.dataset.doseId);
      closeModal();
      openDoseDetail(dose);
    }));
}
```

- [ ] **Step 2: Add CSS for the swatch + row layout**

Append to `css/styles.css`:

```css
.dose-group li { display: flex; align-items: center; gap: 8px; }
.dose-group .sw { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.dose-group li .muted { margin-left: auto; }
```

- [ ] **Step 3: Sanity-check it loads (no test yet — wired in Task 3)**

Run: `node --check js/painview.js`
Expected: no output (syntax OK). (`node --check` only validates syntax; the function is exercised manually after Task 3.)

- [ ] **Step 4: Commit**

```bash
git add js/painview.js css/styles.css
git commit -m "feat(timeline): dose-group list sheet"
```

---

### Task 3: Tap-to-list wiring in timeline.js

**Files:**
- Modify: `js/timeline.js` (imports, `onDoseGroup` option, `allDoses` closure, overview hit rects, click handler)
- Modify: `js/painview.js` (pass `onDoseGroup`)

- [ ] **Step 1: Extend the pain.js import in `js/timeline.js`**

Change line 3 from:

```js
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals } from './pain.js';
```

to:

```js
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals, dosesInCluster, dayDoses } from './pain.js';
```

- [ ] **Step 2: Add `onDoseGroup` to the options + an `allDoses` closure var**

Change the signature (line 17) from:

```js
export function createTimeline(host, { onPainClick, onDoseClick, onUpgrade } = {}) {
```

to:

```js
export function createTimeline(host, { onPainClick, onDoseClick, onDoseGroup, onUpgrade } = {}) {
```

Change line 21 from:

```js
  let doseById = new Map();
```

to:

```js
  let doseById = new Map();
  let allDoses = [];
```

In `render`, change line 57 area. After:

```js
    const pain = loadPain(), doses = loadDoses().slice().sort((a, b) => a.timestamp - b.timestamp);
    doseById = new Map(doses.map(d => [d.id, d]));
```

add:

```js
    allDoses = doses;
```

- [ ] **Step 3: Add invisible per-day hit rects in overview mode**

In the `else` (overview) branch of the dose lane, the loop ends at line 139 (`}` closing `for (const [ds, perMed] of totals)`). Immediately after that closing `}` and before the branch's closing `}`, add:

```js
      // whole-day tap targets (over the bars) so any tap in a day opens its dose list
      for (const [ds] of totals) {
        const x1 = Math.max(padL, X(ds)), x2 = Math.min(W - padR, X(ds + DAY));
        if (x2 > x1)
          s += `<rect x="${x1.toFixed(1)}" y="${laneTop}" width="${(x2 - x1).toFixed(1)}" height="${(laneBot - laneTop).toFixed(1)}" fill="transparent" data-day-hit="${ds}" style="cursor:pointer"/>`;
      }
```

- [ ] **Step 4: Update the click handler for clusters + day taps**

Replace the whole click handler (lines 176-181):

```js
  host.addEventListener('click', e => {
    if (dragMoved) return;
    const upg = e.target.closest('[data-upgrade]'); if (upg) { onUpgrade && onUpgrade(); return; }
    const pa = e.target.closest('[data-pain]'); if (pa) { onPainClick && onPainClick(pa.dataset.pain); return; }
    const dz = e.target.closest('[data-dose]'); if (dz) { onDoseClick && onDoseClick(doseById.get(dz.dataset.dose)); return; }
  });
```

with:

```js
  host.addEventListener('click', e => {
    if (dragMoved) return;
    const upg = e.target.closest('[data-upgrade]'); if (upg) { onUpgrade && onUpgrade(); return; }
    const pa = e.target.closest('[data-pain]'); if (pa) { onPainClick && onPainClick(pa.dataset.pain); return; }
    const day = e.target.closest('[data-day-hit]');
    if (day) { onDoseGroup && onDoseGroup(dayDoses(allDoses, +day.dataset.dayHit)); return; }
    const dz = e.target.closest('[data-dose]');
    if (dz) {
      const dose = doseById.get(dz.dataset.dose);
      const cluster = dosesInCluster(allDoses, dose.timestamp, 18 / scale);
      if (cluster.length > 1) { onDoseGroup && onDoseGroup(cluster); }
      else { onDoseClick && onDoseClick(dose); }
      return;
    }
  });
```

- [ ] **Step 5: Pass `onDoseGroup` from `js/painview.js`**

First add `openDoseGroup` to the import is unnecessary (it is defined in this same file). Change the `createTimeline` call (line 60) from:

```js
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail, onUpgrade: openPaywall });
```

to:

```js
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail, onDoseGroup: openDoseGroup, onUpgrade: openPaywall });
```

- [ ] **Step 6: Verify syntax and full test suite**

Run: `node --check js/timeline.js && node --check js/painview.js && node --test`
Expected: no syntax errors; all tests pass (including Task 1's).

- [ ] **Step 7: Commit**

```bash
git add js/timeline.js js/painview.js
git commit -m "feat(timeline): tap overlapping doses / a day to open dose list"
```

---

### Task 4: Range presets + smooth zoom in timeline.js

**Files:**
- Modify: `js/timeline.js` (import `rangeForPreset`, add `animateTo`/`zoomStep`/`showToday`/`showWeek`/`zoomIn`/`zoomOut`, extend return)
- Modify: `js/painview.js` (buttons markup + wiring)

- [ ] **Step 1: Import `rangeForPreset`**

Update the pain.js import line in `js/timeline.js` to also import `rangeForPreset`:

```js
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals, dosesInCluster, dayDoses, rangeForPreset } from './pain.js';
```

- [ ] **Step 2: Add animation + preset methods**

In `js/timeline.js`, immediately after the `zoomAt` function (line 165), add:

```js
  function easeInOutCubic(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  let rafId = 0;
  function animateTo(targetScale, targetT0, ms = 350) {
    if (rafId) cancelAnimationFrame(rafId);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scale = targetScale; t0 = targetT0; clamp(); render(); return;
    }
    const s0 = scale, p0 = t0, start = performance.now();
    const stepFn = (nowT) => {
      const p = easeInOutCubic(Math.min(1, (nowT - start) / ms));
      scale = s0 * Math.pow(targetScale / s0, p);
      t0 = p0 + (targetT0 - p0) * p;
      render();
      if (p < 1) { rafId = requestAnimationFrame(stepFn); }
      else { rafId = 0; scale = targetScale; t0 = targetT0; clamp(); render(); }
    };
    rafId = requestAnimationFrame(stepFn);
  }
  function zoomStep(factor) {
    W = host.clientWidth;
    const mid = (W - padL - padR) / 2;
    const center = t0 + mid / scale;
    const targetScale = scale * factor;
    animateTo(targetScale, center - mid / targetScale);
  }
  function zoomIn() { zoomStep(1.6); }
  function zoomOut() { zoomStep(1 / 1.6); }
  function viewRange({ start, end }) {
    W = host.clientWidth;
    const span = Math.max(MIN_SPAN, end - start);
    const targetScale = (W - padL - padR) / span;
    animateTo(targetScale, end - (W - padL - padR) / targetScale);
  }
  function showToday() { viewRange(rangeForPreset('today', Date.now())); }
  function showWeek() { if (!isPro()) { onUpgrade && onUpgrade(); return; } viewRange(rangeForPreset('week', Date.now())); }
```

- [ ] **Step 3: Extend the returned API**

Change the return (line 185) from:

```js
  fit();
  return { render };
```

to:

```js
  fit();
  return { render, showToday, showWeek, zoomIn, zoomOut };
```

- [ ] **Step 4: Add the buttons to the timeline bar markup in `js/painview.js`**

Replace the `.tl-bar` markup (line 51-52) from:

```js
    `<div class="tl-bar"><span class="tl-hint">Drag · pinch to zoom</span>` +
      `<span style="flex:1"></span><button class="zb" id="tl-out">–</button><button class="zb" id="tl-in">+</button></div>` +
```

with:

```js
    `<div class="tl-bar"><span class="tl-hint">Drag · pinch to zoom</span>` +
      `<span style="flex:1"></span>` +
      `<button class="zb" id="tl-today">Today</button><button class="zb" id="tl-week">Week</button>` +
      `<button class="zb" id="tl-out">–</button><button class="zb" id="tl-in">+</button></div>` +
```

- [ ] **Step 5: Replace the old zoom wiring with the new method calls**

In `js/painview.js`, replace lines 62-64:

```js
  const zoom = (deltaY) => hostEl.dispatchEvent(new WheelEvent('wheel', { deltaY, clientX: hostEl.getBoundingClientRect().left + hostEl.clientWidth / 2, cancelable: true }));
  painViewEl().querySelector('#tl-in').addEventListener('click', () => zoom(-240));
  painViewEl().querySelector('#tl-out').addEventListener('click', () => zoom(240));
```

with:

```js
  painViewEl().querySelector('#tl-today').addEventListener('click', () => timeline.showToday());
  painViewEl().querySelector('#tl-week').addEventListener('click', () => timeline.showWeek());
  painViewEl().querySelector('#tl-in').addEventListener('click', () => timeline.zoomIn());
  painViewEl().querySelector('#tl-out').addEventListener('click', () => timeline.zoomOut());
```

- [ ] **Step 6: Verify syntax and tests**

Run: `node --check js/timeline.js && node --check js/painview.js && node --test`
Expected: no syntax errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add js/timeline.js js/painview.js
git commit -m "feat(timeline): Today/Week presets + animated zoom buttons"
```

---

### Task 5: Service-worker cache bump

**Files:**
- Modify: `service-worker.js:6`

- [ ] **Step 1: Bump the cache version**

Change `service-worker.js` line 6 from:

```js
const CACHE = 'dosegrid-v15';
```

to:

```js
const CACHE = 'dosegrid-v16';
```

- [ ] **Step 2: Commit**

```bash
git add service-worker.js
git commit -m "chore: bump SW cache to v16 for timeline changes"
```

---

## Self-Review notes

- **Spec coverage:** tap-to-list cluster (Task 3 detail branch), whole-day tap (Task 3 overview rects + handler), list sheet (Task 2), Today/Week presets + free-tier gate (Task 4 `showWeek` `isPro` guard), smooth zoom + reduced-motion (Task 4 `animateTo`), pure helpers + tests (Task 1), SW bump (Task 5). All covered.
- **Manual smoke (run in browser after Task 5):** log 3 doses within ~2 min → zoomed in, tap cluster → list of 3 (sorted, coloured) → tap a row → dose detail; lone dose still opens detail directly; zoom out, tap a day column → that day's doses; Today animates to midnight→now; Week animates for Pro and opens paywall for free (`?pro=0`); `–`/`+` animate; OS reduced-motion makes transitions instant.
- **Type consistency:** `onDoseGroup` used in both files; `dosesInCluster(doses, centerTs, toleranceMs)` and `dayDoses(doses, dayStartMs)` signatures match Task 1; `data-day-hit` attribute consistent between render (Task 3 Step 3) and handler (Task 3 Step 4); returned methods `showToday/showWeek/zoomIn/zoomOut` match painview wiring (Task 4).
