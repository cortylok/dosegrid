# DoseGrid Freemium Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a freemium gate to DoseGrid — free users see the last 24 hours; a one-time Pro unlock reveals the full locally-stored history — routed through a single `isPro()` entitlement seam.

**Architecture:** A new `pro.js` holds the entitlement (and stubbed purchase calls the native IAP spec will later replace). A new `gating.js` holds the 24-hour rule (`visibleWindow`, `hiddenCount`, `shouldNudge`) in one place. Views (timeline, per-med history) ask `gating.js` for the window and render lock affordances that open a paywall. Boot stops pruning so all data is retained.

**Tech Stack:** Vanilla ES modules, `localStorage`, `node --test` (with a localStorage shim per test file), no build step.

**Spec:** `docs/superpowers/specs/2026-06-21-dosegrid-freemium-gating-design.md`

---

## File Structure

- **Create** `js/pro.js` — entitlement seam: `isPro`, `setPro`, `purchasePro`, `restorePurchases`.
- **Create** `js/gating.js` — 24h rule + nudge/usage tracking.
- **Create** `tests/pro.test.js`, `tests/gating.test.js`.
- **Modify** `js/app.js` — stop pruning; record usage day; `?pro=` dev toggle; `dosegrid:refresh` listener.
- **Modify** `js/ui.js` — `openPaywall`; gate per-med history; "Pro" entry on the landing sheet.
- **Modify** `js/timeline.js` — clamp free users to 24h + lock cap → `onUpgrade`.
- **Modify** `js/painview.js` — pass `onUpgrade: openPaywall`; show the one-off nudge banner.
- **Modify** `service-worker.js` — add new files to precache + bump cache.
- **Modify** `README.md` — note the free/Pro split.

---

### Task 1: Entitlement seam `pro.js`

**Files:**
- Create: `js/pro.js`
- Test: `tests/pro.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/pro.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const { isPro, setPro, purchasePro, restorePurchases } = await import('../js/pro.js');

beforeEach(() => localStorage.clear());

test('isPro defaults to false', () => {
  assert.equal(isPro(), false);
});

test('setPro(true) persists and isPro reflects it', () => {
  setPro(true);
  assert.equal(isPro(), true);
  assert.equal(localStorage.getItem('dosegrid.pro'), '1');
  setPro(false);
  assert.equal(isPro(), false);
});

test('purchasePro stub grants entitlement and resolves true', async () => {
  assert.equal(await purchasePro(), true);
  assert.equal(isPro(), true);
});

test('restorePurchases reflects current entitlement', async () => {
  assert.equal(await restorePurchases(), false);
  setPro(true);
  assert.equal(await restorePurchases(), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pro.test.js`
Expected: FAIL — cannot import `../js/pro.js` (module not found).

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/pro.js — single entitlement seam.
// The native in-app-purchase layer (separate spec) replaces purchasePro/restorePurchases;
// no other code in the app touches the store.
const PRO_KEY = 'dosegrid.pro';

export function isPro() {
  try { return localStorage.getItem(PRO_KEY) === '1'; } catch { return false; }
}

export function setPro(on) {
  try {
    if (on) localStorage.setItem(PRO_KEY, '1');
    else localStorage.removeItem(PRO_KEY);
  } catch { /* ignore */ }
}

// Stub for the test/web build: a "purchase" simply grants the entitlement.
export async function purchasePro() { setPro(true); return true; }

// Stub: there is nothing to restore on web beyond the local flag.
export async function restorePurchases() { return isPro(); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pro.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add js/pro.js tests/pro.test.js
git commit -m "feat(pro): add isPro entitlement seam with stubbed purchase"
```

---

### Task 2: Gating module `gating.js`

**Files:**
- Create: `js/gating.js`
- Test: `tests/gating.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/gating.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const {
  FREE_WINDOW_MS, visibleWindow, hiddenCount, shouldNudge,
  recordUsageDay, usageDayCount, nudgeSeen, markNudgeSeen,
} = await import('../js/gating.js');

beforeEach(() => localStorage.clear());

test('visibleWindow: Pro sees everything, free is clamped to 24h', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(visibleWindow(now, true), { fromTs: -Infinity, locked: false });
  assert.deepEqual(visibleWindow(now, false), { fromTs: now - FREE_WINDOW_MS, locked: true });
});

test('hiddenCount: counts entries older than 24h for free, 0 for Pro', () => {
  const now = 1_000_000_000_000;
  const entries = [
    { timestamp: now - 1000 },
    { timestamp: now - 2 * FREE_WINDOW_MS },
    { timestamp: now - 5 * FREE_WINDOW_MS },
  ];
  assert.equal(hiddenCount(entries, now, false), 2);
  assert.equal(hiddenCount(entries, now, true), 0);
});

test('shouldNudge: only when free + locked data + >=5 usage days + not seen', () => {
  const base = { pro: false, hasLockedData: true, usageDays: 5, nudgeSeen: false };
  assert.equal(shouldNudge(base), true);
  assert.equal(shouldNudge({ ...base, pro: true }), false);
  assert.equal(shouldNudge({ ...base, hasLockedData: false }), false);
  assert.equal(shouldNudge({ ...base, usageDays: 4 }), false);
  assert.equal(shouldNudge({ ...base, nudgeSeen: true }), false);
});

test('recordUsageDay counts distinct days only', () => {
  const day = 24 * 3600 * 1000;
  const t = 1_700_000_000_000;
  recordUsageDay(t);
  recordUsageDay(t + 3600 * 1000); // same day
  assert.equal(usageDayCount(), 1);
  recordUsageDay(t + day); // next day
  assert.equal(usageDayCount(), 2);
});

test('nudgeSeen flag round-trips', () => {
  assert.equal(nudgeSeen(), false);
  markNudgeSeen();
  assert.equal(nudgeSeen(), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/gating.test.js`
Expected: FAIL — cannot import `../js/gating.js`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/gating.js — single source of truth for the free/Pro 24-hour view window.
const USAGE_KEY = 'dosegrid.usageDays';
const NUDGE_KEY = 'dosegrid.proNudgeSeen';

export const FREE_WINDOW_HOURS = 24;
export const FREE_WINDOW_MS = FREE_WINDOW_HOURS * 3600 * 1000;

// The visible time-window and whether older data is locked.
export function visibleWindow(now, pro) {
  return { fromTs: pro ? -Infinity : now - FREE_WINDOW_MS, locked: !pro };
}

// How many entries fall outside the free window (0 for Pro). Drives "+N earlier" + the nudge.
export function hiddenCount(entries, now, pro) {
  if (pro) return 0;
  const cutoff = now - FREE_WINDOW_MS;
  return entries.reduce((n, e) => (e.timestamp < cutoff ? n + 1 : n), 0);
}

// Pure predicate for the one-off upgrade nudge.
export function shouldNudge({ pro, hasLockedData, usageDays, nudgeSeen }) {
  return !pro && hasLockedData && usageDays >= 5 && !nudgeSeen;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readDays() {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY)) || []; } catch { return []; }
}

export function recordUsageDay(now = Date.now()) {
  const days = readDays();
  const k = dayKey(now);
  if (!days.includes(k)) {
    days.push(k);
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(days)); } catch { /* ignore */ }
  }
  return days.length;
}
export function usageDayCount() { return readDays().length; }

export function nudgeSeen() {
  try { return localStorage.getItem(NUDGE_KEY) === '1'; } catch { return false; }
}
export function markNudgeSeen() {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/gating.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add js/gating.js tests/gating.test.js
git commit -m "feat(gating): add 24h window rule + usage-day and nudge tracking"
```

---

### Task 3: App wiring — stop pruning, usage day, dev toggle, refresh event

**Files:**
- Modify: `js/app.js`

This is a refactor task (no new unit test; verified by the full suite still passing + the headless check in Task 10).

- [ ] **Step 1: Replace the imports and boot block**

Replace lines 1–14 of `js/app.js`:

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
```

with:

```javascript
// js/app.js
import { renderGrid, showLanding } from './ui.js';
import { renderPainView } from './painview.js';
import { setPro } from './pro.js';
import { recordUsageDay } from './gating.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Freemium: all data is retained on-device; the view is gated to 24h for free
// users (see gating.js). We deliberately no longer prune on boot.

// Dev/test entitlement toggle (web build only): ?pro=1 unlocks, ?pro=0 clears.
const params = new URLSearchParams(location.search);
if (params.has('pro')) setPro(params.get('pro') !== '0');

// Track distinct days of use (drives the one-off upgrade nudge).
recordUsageDay();

// Re-render both views whenever entitlement changes (e.g. after purchase/restore).
document.addEventListener('dosegrid:refresh', () => { renderGrid(); renderPainView(); });

// Render both views (Meds view starts hidden; Pain is the default focus)
renderGrid();
renderPainView();
```

- [ ] **Step 2: Verify the existing suite still passes**

Run: `node --test`
Expected: PASS — all existing tests still green (47 + the 9 new from Tasks 1–2 = 56).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(app): retain all data, add usage tracking, dev toggle, refresh event"
```

---

### Task 4: Paywall sheet `openPaywall` (ui.js)

**Files:**
- Modify: `js/ui.js` (imports at top; add `openPaywall` near the other `openSheet` helpers)

- [ ] **Step 1: Add imports**

In `js/ui.js`, immediately after the existing helplines import (line 7), add:

```javascript
import { isPro, purchasePro, restorePurchases } from './pro.js';
```

- [ ] **Step 2: Add the paywall function**

Add this exported function in `js/ui.js` (e.g. directly above `export function showLanding`):

```javascript
const PRO_PRICE = '$4.99'; // placeholder until the store product is created

function refreshViews() { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); }

export function openPaywall() {
  if (isPro()) {
    openSheet(
      `<h2>DoseGrid Pro ✓</h2>` +
      `<p class="muted">Pro is active — your full history is unlocked.</p>` +
      `<div class="btn-row"><button class="btn" id="pw-close">Close</button></div>`
    );
    modalRoot().querySelector('#pw-close').addEventListener('click', closeModal);
    return;
  }
  openSheet(
    `<h2>DoseGrid Pro</h2>` +
    `<p class="lead">Keep your full medication &amp; pain history — not just the last 24 hours.</p>` +
    `<div class="pt"><div class="ic">📈</div><div><b>Unlimited history</b>` +
      `<span>Scroll and chart pain &amp; doses across weeks, months and years.</span></div></div>` +
    `<div class="pt"><div class="ic">🔓</div><div><b>One-time unlock</b>` +
      `<span>Pay once. No subscription.</span></div></div>` +
    `<div class="pt"><div class="ic">🛟</div><div><b>Safety stays free</b>` +
      `<span>Early-dose and daily-limit warnings are always free.</span></div></div>` +
    `<div class="btn-row"><button class="btn secondary" id="pw-restore">Restore</button>` +
      `<button class="btn" id="pw-buy">Unlock — ${PRO_PRICE}</button></div>` +
    `<p class="disc muted">Your data already stays on your device. Pro only changes how much of it you can see.</p>`
  );
  modalRoot().querySelector('#pw-buy').addEventListener('click', async () => {
    await purchasePro();
    closeModal();
    refreshViews();
  });
  modalRoot().querySelector('#pw-restore').addEventListener('click', async () => {
    const ok = await restorePurchases();
    closeModal();
    if (ok) refreshViews();
  });
}
```

- [ ] **Step 3: Verify it loads (no test — syntax/import check)**

Run: `node --input-type=module -e "import('./js/pro.js').then(()=>console.log('pro ok'))"`
Expected: prints `pro ok` (confirms `pro.js` imports cleanly; `ui.js` is exercised in the Task 10 headless check).

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): add DoseGrid Pro paywall sheet"
```

---

### Task 5: Gate the per-med history list (ui.js)

**Files:**
- Modify: `js/ui.js:407-451` (`openHistory`, `historyListHtml`)

Free users see only doses from the last 24h, with a footer linking to the paywall. Pro is unchanged.

- [ ] **Step 1: Add gating imports**

In `js/ui.js`, after the `pro.js` import added in Task 4, add:

```javascript
import { visibleWindow, hiddenCount } from './gating.js';
```

- [ ] **Step 2: Replace `openHistory` (lines 407-423)**

```javascript
function openHistory(med, view = 'graph') {
  const now = Date.now();
  const pro = isPro();
  // Free users get the 24h list only (the 14-day graph is a Pro view).
  if (!pro) view = 'list';
  const title = pro ? 'last 14 days' : 'last 24 hours';
  const sheetBody = view === 'graph' ? historyGraphHtml(med, now) : historyListHtml(med, now);
  openSheet(
    `<h2>${med.name} — ${title}</h2>` +
    (pro
      ? `<div class="hist-toggle">` +
        `<button data-v="graph" class="${view === 'graph' ? 'active' : ''}">Graph</button>` +
        `<button data-v="list" class="${view === 'list' ? 'active' : ''}">List</button>` +
        `</div>`
      : '') +
    `<div id="hist-body">${sheetBody}</div>` +
    `<div class="btn-row"><button class="btn secondary" id="close">Close</button></div>`
  );
  modalRoot().querySelector('#close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('.hist-toggle button').forEach((b) =>
    b.addEventListener('click', () => openHistory(med, b.dataset.v)));
  modalRoot().querySelector('#hist-unlock')?.addEventListener('click', openPaywall);
  if (view === 'list') wireHistoryList(med);
}
```

- [ ] **Step 3: Replace `historyListHtml` (lines 441-451)**

```javascript
function historyListHtml(med, now) {
  const pro = isPro();
  const { fromTs } = visibleWindow(now, pro);
  const all = loadDoses().filter((d) => d.medId === med.id);
  const entries = all.filter((d) => d.timestamp >= fromTs).sort((a, b) => b.timestamp - a.timestamp);
  const hidden = hiddenCount(all, now, pro);
  const footer = hidden > 0
    ? `<button class="hist-unlock" id="hist-unlock">🔒 +${hidden} earlier dose${hidden === 1 ? '' : 's'} — Unlock full history</button>`
    : '';
  if (!entries.length) {
    return `<ul class="list"><li class="muted">No doses in the ${pro ? 'last 14 days' : 'last 24 hours'}.</li></ul>${footer}`;
  }
  return `<ul class="list">` + entries.map((d) =>
    `<li data-id="${d.id}">` +
    `<span>${new Date(d.timestamp).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${d.units} tab${d.units === 1 ? '' : 's'}</span>` +
    `<span><button class="btn secondary" data-act="edit">Edit</button> ` +
    `<button class="btn danger" data-act="del">Del</button></span></li>`).join('') + `</ul>${footer}`;
}
```

- [ ] **Step 4: Add minimal style for the unlock footer**

In `css/styles.css`, append:

```css
.hist-unlock, .tl-lock { display:block; width:100%; margin-top:10px; padding:10px;
  background:rgba(34,211,238,0.08); color:#67e8f9; border:1px solid rgba(34,211,238,0.35);
  border-radius:10px; font-size:13px; text-align:center; cursor:pointer; }
```

- [ ] **Step 5: Verify the suite still passes**

Run: `node --test`
Expected: PASS — unchanged count (56); this task is UI-only and covered by the Task 10 headless check.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js css/styles.css
git commit -m "feat(ui): gate per-med history to 24h for free with unlock footer"
```

---

### Task 6: Gate the timeline to 24h for free (timeline.js)

**Files:**
- Modify: `js/timeline.js`

- [ ] **Step 1: Add imports + the effective max-span helper**

In `js/timeline.js`, change the import block (lines 2-3) to:

```javascript
import { loadPain, loadDoses, loadMeds } from './storage.js';
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals } from './pain.js';
import { isPro } from './pro.js';
import { FREE_WINDOW_MS, hiddenCount } from './gating.js';
```

Immediately after the `MIN_SPAN` constant (line 9), add:

```javascript
// Free users can pan/zoom no wider than the 24h free window.
const effMaxSpan = () => (isPro() ? MAX_SPAN : Math.min(MAX_SPAN, FREE_WINDOW_MS));
```

- [ ] **Step 2: Clamp the range, fit and scale to the free window**

Replace `range()` (lines 19-24):

```javascript
  function range() {
    const now = Date.now();
    const ts = [...loadPain().map(p => p.timestamp), ...loadDoses().map(d => d.timestamp)];
    const min = ts.length ? Math.min(...ts) : now - effMaxSpan();
    const floor = isPro() ? -Infinity : now - FREE_WINDOW_MS;
    return { start: Math.max(Math.min(min, now - effMaxSpan()), floor), end: now };
  }
```

Replace `fit()` (line 25):

```javascript
  function fit() { W = host.clientWidth; scale = (W - padL - padR) / effMaxSpan(); t0 = Date.now() - effMaxSpan(); }
```

In `clamp()` replace the `sMin` line (line 30):

```javascript
    const sMin = (W - padL - padR) / effMaxSpan(), sMax = (W - padL - padR) / MIN_SPAN;
```

- [ ] **Step 3: Accept and draw the lock cap**

Change the signature (line 13):

```javascript
export function createTimeline(host, { onPainClick, onDoseClick, onUpgrade } = {}) {
```

In `render()`, immediately before the closing `s += `</svg>`;` (line 145), insert:

```javascript
    // ---- free-tier lock cap (older history hidden) ----
    if (!isPro()) {
      const hidden = hiddenCount([...loadPain(), ...loadDoses()], Date.now(), false);
      if (hidden > 0) {
        const cy = (painTop + laneBot) / 2;
        s += `<g data-upgrade="1" style="cursor:pointer">` +
          `<rect x="${padL}" y="${painTop}" width="20" height="${laneBot - painTop}" fill="rgba(2,6,23,0.55)"/>` +
          `<text x="${padL + 10}" y="${cy}" font-size="10" fill="#67e8f9" text-anchor="middle" transform="rotate(-90 ${padL + 10} ${cy})">🔒 Unlock full history</text></g>`;
      }
    }
```

- [ ] **Step 4: Route taps on the lock cap to `onUpgrade`**

In the `click` handler (lines 161-165), add the upgrade check first:

```javascript
  host.addEventListener('click', e => {
    if (dragMoved) return;
    const upg = e.target.closest('[data-upgrade]'); if (upg) { onUpgrade && onUpgrade(); return; }
    const pa = e.target.closest('[data-pain]'); if (pa) { onPainClick && onPainClick(pa.dataset.pain); return; }
    const dz = e.target.closest('[data-dose]'); if (dz) { onDoseClick && onDoseClick(doseById.get(dz.dataset.dose)); return; }
  });
```

- [ ] **Step 5: Verify the suite still passes**

Run: `node --test`
Expected: PASS — unchanged (56); timeline is verified in the Task 10 headless check.

- [ ] **Step 6: Commit**

```bash
git add js/timeline.js
git commit -m "feat(timeline): clamp free users to 24h window with unlock cap"
```

---

### Task 7: Wire the timeline's upgrade callback (painview.js)

**Files:**
- Modify: `js/painview.js:4,42`

- [ ] **Step 1: Import the paywall**

Change line 4 of `js/painview.js`:

```javascript
import { openSheet, closeModal, modalRoot, openPaywall } from './ui.js';
```

- [ ] **Step 2: Pass `onUpgrade` to the timeline**

Change line 42:

```javascript
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail, onUpgrade: openPaywall });
```

- [ ] **Step 3: Verify the suite still passes**

Run: `node --test`
Expected: PASS — unchanged (56).

- [ ] **Step 4: Commit**

```bash
git add js/painview.js
git commit -m "feat(painview): open paywall when free user hits the 24h timeline cap"
```

---

### Task 8: Quiet "DoseGrid Pro" entry on the landing sheet (ui.js)

**Files:**
- Modify: `js/ui.js` (`showLanding`, around line 502-509)

- [ ] **Step 1: Add the Pro row**

In `showLanding`, replace the `dismissRow +` line (line 502) with:

```javascript
    `<div class="btn-row"><button class="btn secondary" id="land-pro">${isPro() ? 'DoseGrid Pro ✓ Active' : 'DoseGrid Pro ✦ — unlock full history'}</button></div>` +
    dismissRow +
```

- [ ] **Step 2: Wire it**

In `showLanding`, immediately after the `#land-country` change listener (line 509), add:

```javascript
  modalRoot().querySelector('#land-pro')?.addEventListener('click', () => { closeModal(); openPaywall(); });
```

- [ ] **Step 3: Verify the suite still passes**

Run: `node --test`
Expected: PASS — unchanged (56).

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): add DoseGrid Pro entry to the landing sheet"
```

---

### Task 9: One-off upgrade nudge banner (painview.js)

**Files:**
- Modify: `js/painview.js`

- [ ] **Step 1: Add imports**

In `js/painview.js`, after the `createTimeline` import (line 5), add:

```javascript
import { isPro } from './pro.js';
import { loadDoses } from './storage.js';
import { shouldNudge, hiddenCount, usageDayCount, nudgeSeen, markNudgeSeen } from './gating.js';
```

(Update the existing storage import on line 2 if `loadDoses` collides — it currently imports `{ loadPain, savePain, addPain, loadMeds }`; add `loadDoses` there instead of a second import line:)

```javascript
import { loadPain, savePain, addPain, loadMeds, loadDoses } from './storage.js';
```

…and drop the separate `import { loadDoses }` line so it is imported once.

- [ ] **Step 2: Compute and prepend the banner in `renderPainView`**

In `renderPainView`, immediately before the `painViewEl().innerHTML =` assignment (line 32), add:

```javascript
  const now = Date.now();
  const allEntries = [...loadPain(), ...loadDoses()];
  const nudge = shouldNudge({
    pro: isPro(),
    hasLockedData: hiddenCount(allEntries, now, isPro()) > 0,
    usageDays: usageDayCount(),
    nudgeSeen: nudgeSeen(),
  })
    ? `<div class="pro-nudge"><span>You've been building history that's locked to the last 24h. ` +
      `<a href="#" id="nudge-open">Unlock it with Pro →</a></span>` +
      `<button id="nudge-dismiss" aria-label="Dismiss">✕</button></div>`
    : '';
```

Then change the `painViewEl().innerHTML =` line (line 32-33) to prepend the banner:

```javascript
  painViewEl().innerHTML =
    nudge +
    summary +
```

- [ ] **Step 3: Wire the banner buttons**

In `renderPainView`, after the existing `#log-pain` listener (line 40), add:

```javascript
  painViewEl().querySelector('#nudge-open')?.addEventListener('click', (e) => { e.preventDefault(); openPaywall(); });
  painViewEl().querySelector('#nudge-dismiss')?.addEventListener('click', () => { markNudgeSeen(); renderPainView(); });
```

- [ ] **Step 4: Add banner styles**

In `css/styles.css`, append:

```css
.pro-nudge { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:9px 12px;
  background:rgba(34,211,238,0.08); border:1px solid rgba(34,211,238,0.3); border-radius:10px;
  font-size:13px; color:#cbd5e1; }
.pro-nudge a { color:#67e8f9; }
.pro-nudge button { margin-left:auto; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:14px; }
```

- [ ] **Step 5: Verify the suite still passes**

Run: `node --test`
Expected: PASS — unchanged (56).

- [ ] **Step 6: Commit**

```bash
git add js/painview.js css/styles.css
git commit -m "feat(painview): one-off upgrade nudge banner when locked history exists"
```

---

### Task 10: Service worker, README, and full verification

**Files:**
- Modify: `service-worker.js`, `README.md`

- [ ] **Step 1: Add the new files to precache + bump the cache**

In `service-worker.js`, change the cache constant:

```javascript
const CACHE = 'dosegrid-v10';
```

and add `./js/pro.js`, `./js/gating.js` to the `ASSETS` array (in the `js/` group line):

```javascript
  './js/pain.js', './js/painview.js', './js/timeline.js', './js/safety.js', './js/helplines.js',
  './js/pro.js', './js/gating.js',
```

- [ ] **Step 2: Note the freemium split in the README**

In `README.md`, add a bullet to the Features list (after the safety-check bullet):

```markdown
- **Free vs Pro:** the free tier logs everything and shows the **last 24 hours** of timeline, pain chart and per-med history. **DoseGrid Pro** is a one-time unlock that reveals your full history — nothing is deleted in the meantime, so upgrading instantly shows it all. Safety warnings are always free.
```

- [ ] **Step 3: Run the full test suite**

Run: `node --test`
Expected: PASS — 56 tests, 0 fail.

- [ ] **Step 4: Headless browser verification**

Serve and drive the app in headless Chrome (the project's usual manual check). Confirm:
1. Fresh load (free): the pain timeline can't pan/zoom earlier than 24h and shows the "🔒 Unlock full history" cap once there is data older than 24h; tapping it opens the paywall.
2. A med's history sheet shows only the last 24h with a "+N earlier doses — Unlock full history" footer that opens the paywall.
3. Reload with `?pro=1`: the cap and footer are gone, the timeline zooms out to a fortnight, and per-med history shows the Graph/List toggle again.
4. The landing sheet (header `?`) shows a "DoseGrid Pro" entry that opens the paywall; with `?pro=1` it reads "✓ Active".
5. Tapping **Unlock** in the paywall (test stub) removes the locks without reloading (via the `dosegrid:refresh` event).

To seed >24h data for the check, run in the page console before testing:
```javascript
const d = JSON.parse(localStorage['dosegrid.doses']||'[]');
d.push({ id:'old1', medId:(JSON.parse(localStorage['dosegrid.meds']||'[]')[0]||{}).id, timestamp: Date.now()-3*864e5, units:1 });
localStorage['dosegrid.doses'] = JSON.stringify(d); location.reload();
```

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: precache pro/gating modules, bump SW cache, document freemium split"
```

---

## Self-Review

**Spec coverage:**
- Store-all / stop-pruning → Task 3. ✓
- `pro.js` seam (`isPro`/`setPro`/`purchasePro`/`restorePurchases`) → Task 1. ✓
- `gating.js` (`visibleWindow`/`hiddenCount`/`shouldNudge`/usage-day) → Task 2. ✓
- Timeline + pain chart 24h gate with lock cap → Tasks 6, 7. ✓
- Per-med history 24h gate + "+N earlier" footer → Task 5. ✓
- Paywall (one-time price, Unlock, Restore, "safety free") → Task 4. ✓
- Contextual prompts (cap, footer) → Tasks 5, 6. ✓
- One-off nudge → Task 9. ✓
- Quiet menu entry → Task 8. ✓
- Dev toggle (`?pro=`) → Task 3. ✓
- Storage keys (`dosegrid.pro`, `.usageDays`, `.proNudgeSeen`) → Tasks 1, 2. ✓
- Tests for visibleWindow/hiddenCount/shouldNudge/usage/pro → Tasks 1, 2. ✓
- Safety warnings never gated → untouched (`safety.js`/`openDoseWarning` not modified). ✓

**Type/name consistency:** `openPaywall`, `purchasePro`, `restorePurchases`, `isPro`, `setPro`, `visibleWindow`, `hiddenCount`, `shouldNudge`, `recordUsageDay`, `usageDayCount`, `nudgeSeen`, `markNudgeSeen`, `effMaxSpan`, `FREE_WINDOW_MS`, the `dosegrid:refresh` event, and the `onUpgrade` timeline option are used consistently across tasks.

**Note for executor:** Tasks 5/8 both edit `js/ui.js`; Task 3 and (none other) edit `js/app.js`; Tasks 4/5/8 add imports to `js/ui.js` — keep a single consolidated import block at the top (don't duplicate the `pro.js` import added in Task 4).
