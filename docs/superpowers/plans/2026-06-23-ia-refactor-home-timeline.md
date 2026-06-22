# IA Refactor — Home + Timeline Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Pain | Meds` tabs with `Home` (pain summary + Log pain + med grid) and `Timeline` (the zoomable chart on its own tab).

**Architecture:** Pure presentation restructure. `js/painview.js`'s `renderPainView()` splits into `renderHomePain()` (→ `#home-pain`) and `renderTimelineView()` (→ `#timeline-view`); `js/app.js` gains `setView('home'|'timeline')`; `renderGrid()` is unchanged and renders into `#grid` inside Home. No dosing/safety/gating/pain logic changes, so the existing `node --test` suite is the regression guard.

**Tech Stack:** Vanilla ES modules, no build step. Verify with `node --check <file>` (syntax) and `node --test` (regression). Behaviour is DOM/CSS — a manual browser smoke is in the final task.

---

### Task 1: Restructure the app shell (`index.html`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the toggle + main sections**

In `index.html`, replace the `.view-toggle` block:

```html
    <div class="view-toggle" role="tablist" aria-label="View">
      <button id="tab-pain">Pain</button>
      <button id="tab-meds" class="active">Meds</button>
    </div>
```

with:

```html
    <div class="view-toggle" role="tablist" aria-label="View">
      <button id="tab-home" class="active">Home</button>
      <button id="tab-timeline">Timeline</button>
    </div>
```

And replace the `<main>` block:

```html
  <main>
    <section id="pain-view" aria-label="Pain tracking" hidden></section>
    <section id="meds-view">
      <div id="grid" class="grid" aria-label="Medication grid"></div>
    </section>
  </main>
```

with:

```html
  <main>
    <section id="home-view" aria-label="Home">
      <div id="home-pain"></div>
      <div id="grid" class="grid" aria-label="Medication grid"></div>
    </section>
    <section id="timeline-view" aria-label="Timeline" hidden></section>
  </main>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(ia): Home/Timeline shell in index.html"
```

(Visual check deferred to Task 5 — the JS in Tasks 2–3 populates these containers.)

---

### Task 2: Split `renderPainView` into Home + Timeline renderers (`js/painview.js`)

**Files:**
- Modify: `js/painview.js`

- [ ] **Step 1: Replace the element helper + `renderPainView` with the two split renderers**

In `js/painview.js`, replace this:

```js
const painViewEl = () => document.getElementById('pain-view');
let timeline = null;
```

with:

```js
const homePainEl = () => document.getElementById('home-pain');
const timelineViewEl = () => document.getElementById('timeline-view');
let timeline = null;

// Re-render whatever pain-driven UI is mounted (used after a pain entry changes).
function afterPainChange() { renderHomePain(); if (timeline) timeline.render(); }

// Cheap re-render of the chart if it exists (used by app.js on refresh ticks).
export function refreshTimeline() { if (timeline) timeline.render(); }
```

Then replace the entire `renderPainView()` function (the `export function renderPainView() { ... }` block) with these two functions:

```js
export function renderHomePain() {
  const pain = loadPain();
  const last = latestPain(pain);
  const summary = last
    ? `<div class="pain-now"><div class="pain-score" style="color:${painColor(last.score)}">${last.score}<span>/10</span></div>` +
      `<div class="pain-meta">${severity(last.score)} · logged ${fmtRelative(last.timestamp)}${last.note ? `<br><span class="muted">“${last.note}”</span>` : ''}</div></div>`
    : `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;

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

  homePainEl().innerHTML =
    nudge + summary +
    `<button class="btn pain-log-btn" id="log-pain">＋ Log pain</button>`;

  homePainEl().querySelector('#log-pain').addEventListener('click', openPainLog);
  homePainEl().querySelector('#nudge-open')?.addEventListener('click', (e) => { e.preventDefault(); openPaywall(); });
  homePainEl().querySelector('#nudge-dismiss')?.addEventListener('click', () => { markNudgeSeen(); renderHomePain(); });
}

export function renderTimelineView() {
  const meds = loadMeds().slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const legend = meds.length
    ? `<div class="tl-legend">` + meds.map((m) => `<span><i style="background:${medColor(m.order || 0)}"></i>${m.name}</span>`).join('') + `</div>`
    : '';

  timelineViewEl().innerHTML =
    `<div class="tl-bar"><span class="tl-hint">Drag · pinch to zoom</span>` +
      `<span style="flex:1"></span>` +
      `<button class="zb" id="tl-today">Today</button><button class="zb" id="tl-week">Week</button>` +
      `<button class="zb" id="tl-out">–</button><button class="zb" id="tl-in">+</button></div>` +
    `<div class="tl-host" id="tl-host"></div>` +
    legend;

  const hostEl = timelineViewEl().querySelector('#tl-host');
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail, onDoseGroup: openDoseGroup, onUpgrade: openPaywall });
  timeline.render();
  timelineViewEl().querySelector('#tl-today').addEventListener('click', () => timeline.showToday());
  timelineViewEl().querySelector('#tl-week').addEventListener('click', () => timeline.showWeek());
  timelineViewEl().querySelector('#tl-in').addEventListener('click', () => timeline.zoomIn());
  timelineViewEl().querySelector('#tl-out').addEventListener('click', () => timeline.zoomOut());
}
```

- [ ] **Step 2: Point the two post-change re-renders at `afterPainChange`**

In `openPainDetail`, the delete handler currently ends with `renderPainView();`. Change:

```js
    savePain(loadPain().filter((p) => p.id !== id));
    closeModal();
    renderPainView();
```

to:

```js
    savePain(loadPain().filter((p) => p.id !== id));
    closeModal();
    afterPainChange();
```

In `openPainLog`, the save handler currently ends with `renderPainView();`. Change:

```js
    addPain(selected, note);
    closeModal();
    renderPainView();
```

to:

```js
    addPain(selected, note);
    closeModal();
    afterPainChange();
```

- [ ] **Step 3: Verify syntax**

Run: `node --check js/painview.js`
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add js/painview.js
git commit -m "feat(ia): split painview into renderHomePain + renderTimelineView"
```

---

### Task 3: View system in `js/app.js`

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Update the import from `painview.js`**

Change:

```js
import { renderPainView } from './painview.js';
```

to:

```js
import { renderHomePain, renderTimelineView, refreshTimeline } from './painview.js';
```

- [ ] **Step 2: Replace the render + view-toggle block**

Replace this block:

```js
// On native, sync Pro entitlement from the store (auto-recovers after reinstall),
// then re-render + resync notifications once ownership is known. No-op on web.
refreshEntitlement().then(() => { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); syncNotifications(); });

// Re-render both views whenever entitlement changes (e.g. after purchase/restore).
document.addEventListener('dosegrid:refresh', () => { renderGrid(); renderPainView(); });

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

// Start on the Meds grid by default
setView('meds');
```

with:

```js
let currentView = 'home';

// On native, sync Pro entitlement from the store (auto-recovers after reinstall),
// then re-render + resync notifications once ownership is known. No-op on web.
refreshEntitlement().then(() => { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); syncNotifications(); });

// Re-render the mounted UI whenever entitlement changes (e.g. after purchase/restore).
document.addEventListener('dosegrid:refresh', () => { renderGrid(); renderHomePain(); refreshTimeline(); });

function setView(view) {
  currentView = view;
  document.getElementById('home-view').hidden = view !== 'home';
  document.getElementById('timeline-view').hidden = view !== 'timeline';
  document.getElementById('tab-home').classList.toggle('active', view === 'home');
  document.getElementById('tab-timeline').classList.toggle('active', view === 'timeline');
  if (view === 'home') { renderHomePain(); renderGrid(); } else { renderTimelineView(); }
}
document.getElementById('tab-home').addEventListener('click', () => setView('home'));
document.getElementById('tab-timeline').addEventListener('click', () => setView('timeline'));

// Start on Home (pain summary + Log pain + med grid)
setView('home');
```

- [ ] **Step 3: Update the visibility-change refresh**

Replace:

```js
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderPainView(); syncNotifications(); } });
```

with:

```js
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderHomePain(); refreshTimeline(); syncNotifications(); } });
```

(The 30s `setInterval(renderGrid, 30000)` line is unchanged — it keeps dose countdowns fresh on Home.)

- [ ] **Step 4: Verify syntax**

Run: `node --check js/app.js`
Expected: no output (syntax OK).

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat(ia): setView(home|timeline), default Home"
```

---

### Task 4: CSS for Home stacking + Timeline view (`css/styles.css`)

**Files:**
- Modify: `css/styles.css`

- [ ] **Step 1: Replace the `#pain-view` rule with `#home-pain` + `#timeline-view`**

Find:

```css
#pain-view { padding: 14px; }
```

Replace with:

```css
#home-pain { padding: 14px 14px 0; }
#timeline-view { padding: 14px; }
```

- [ ] **Step 2: Verify the file still parses (quick grep sanity)**

Run: `node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); if(c.includes('#pain-view')) throw new Error('stale #pain-view remains'); console.log('css ok, #home-pain present:', c.includes('#home-pain'));"`
Expected: `css ok, #home-pain present: true`

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat(ia): Home pain spacing + Timeline view padding"
```

---

### Task 5: Cache bump, regression run, and manual smoke

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Bump the cache version**

In `service-worker.js`, change `const CACHE = 'dosegrid-v22';` to `const CACHE = 'dosegrid-v23';`.

- [ ] **Step 2: Run the full regression suite + syntax checks**

Run: `node --check js/app.js && node --check js/painview.js && node --test`
Expected: no syntax errors; all 103 tests pass (no logic changed).

- [ ] **Step 3: Manual browser smoke (document results)**

Open `index.html` in a browser (or via the live Pages copy after merge) and confirm:
1. App opens on **Home**: pain summary card + `＋ Log pain` button + med grid (and the Pro nudge if `?pro=0` and enough usage).
2. **Log pain** → picker opens; saving updates the Home pain card immediately.
3. Tapping a med tile opens its dose sheet; logging a dose updates the tile (ready/wait/hold) — unchanged.
4. **Timeline** tab → full chart; drag / pinch / `–` / `+` / `Today` / `Week` all work; tapping clustered doses opens the dose list; a lone dose opens its detail; tapping a pain point opens its detail (and Delete there removes it from both the card and the chart).
5. `?pro=0` shows the timeline lock overlay + Home nudge; `?pro=1` clears them.
6. First launch shows the landing; `?` reopens it.

- [ ] **Step 4: Commit**

```bash
git add service-worker.js
git commit -m "chore: bump SW cache to v23 for Home/Timeline IA"
```

---

## Self-Review notes

- **Spec coverage:** Home shell + Timeline shell (Task 1); `renderHomePain`/`renderTimelineView` split incl. nudge-on-Home, legend-on-Timeline, post-change re-render (Task 2); `setView('home'|'timeline')` + default Home + refresh/visibility hooks (Task 3); CSS stacking/padding (Task 4); SW bump + regression + manual smoke (Task 5). `renderGrid()` intentionally unchanged. All spec sections covered.
- **Type consistency:** element ids `home-view`/`home-pain`/`timeline-view`/`grid`/`tab-home`/`tab-timeline` match across `index.html`, `painview.js`, and `app.js`. `painview.js` exports used by `app.js` = `renderHomePain`, `renderTimelineView`, `refreshTimeline` (all defined in Task 2). `afterPainChange` is internal to `painview.js`. The timeline callbacks (`onPainClick`/`onDoseClick`/`onDoseGroup`/`onUpgrade`) are unchanged.
- **No placeholders:** every step shows the exact replacement code/commands.
- **Regression guard:** no pure logic touched, so `node --test` (103 tests) must stay green; behaviour verified by the Task 5 smoke.
