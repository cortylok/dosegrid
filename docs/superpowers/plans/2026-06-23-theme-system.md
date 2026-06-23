# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user-selectable theme system (Classic + Aurora + Apothecary, each light/dark) where the medication tiles, Home pain card and dose-sheet header are bespoke per theme and every other surface is token-themed (palette + fonts + shapes).

**Architecture:** A new `js/theme.js` holds theme/mode state and `applyTheme()` (sets `<html class="theme-x is-dark">` + fires `dosegrid:refresh`). A new pure `js/theme-render.js` turns a normalised view object into per-theme HTML for the signature surfaces. The app already paints from CSS variables, so three `css/theme-*.css` files (tokens for light + dark + the bespoke structures) recolour everything; the active theme wins by the `<html>` class. A landing "Appearance" picker drives it. No dosing/safety/pain logic changes.

**Tech Stack:** Vanilla ES modules, CSS custom properties, `node --test`. Verify with `node --check` (syntax) + `node --test` (pure-logic regression). Visual themes verified by manual smoke. The demo at `design/concepts/{aurora,apothecary}.{css,js}` is the visual reference for the bespoke pieces.

---

### Task 1: Theme/mode state module (`js/theme.js`)

**Files:**
- Create: `js/theme.js`
- Test: `tests/theme.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/theme.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvedDark, htmlClass, normTheme, normMode, THEMES, MODES } from '../js/theme.js';

test('resolvedDark: dark always, light never, auto follows system', () => {
  assert.equal(resolvedDark('dark', false), true);
  assert.equal(resolvedDark('light', true), false);
  assert.equal(resolvedDark('auto', true), true);
  assert.equal(resolvedDark('auto', false), false);
});

test('htmlClass composes theme + is-dark', () => {
  assert.equal(htmlClass('aurora', true), 'theme-aurora is-dark');
  assert.equal(htmlClass('classic', false), 'theme-classic');
});

test('normTheme / normMode reject unknown values', () => {
  assert.equal(normTheme('aurora'), 'aurora');
  assert.equal(normTheme('nope'), 'classic');
  assert.equal(normTheme(null), 'classic');
  assert.equal(normMode('dark'), 'dark');
  assert.equal(normMode('weird'), 'auto');
  assert.deepEqual(THEMES, ['classic', 'aurora', 'apothecary']);
  assert.deepEqual(MODES, ['auto', 'light', 'dark']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/theme.test.js`
Expected: FAIL — `../js/theme.js` cannot be resolved.

- [ ] **Step 3: Create `js/theme.js`**

```js
// js/theme.js — theme + light/dark mode state and application.
export const THEMES = ['classic', 'aurora', 'apothecary'];
export const MODES = ['auto', 'light', 'dark'];
export const THEME_LABELS = { classic: 'Classic', aurora: 'Aurora', apothecary: 'Apothecary' };
const THEME_BAR = { classic: '#0b1220', aurora: '#eef2f8', apothecary: '#efe6d6' };
const THEME_BAR_DARK = { classic: '#0b1220', aurora: '#0c1018', apothecary: '#16120e' };

const THEME_KEY = 'dosegrid.theme', MODE_KEY = 'dosegrid.mode';

export function normTheme(t) { return THEMES.includes(t) ? t : 'classic'; }
export function normMode(m) { return MODES.includes(m) ? m : 'auto'; }
export function resolvedDark(mode, systemDark) { return mode === 'dark' || (mode === 'auto' && !!systemDark); }
export function htmlClass(theme, dark) { return 'theme-' + theme + (dark ? ' is-dark' : ''); }

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, v) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

export function getTheme() { return normTheme(read(THEME_KEY)); }
export function getMode() { return normMode(read(MODE_KEY)); }
export function setTheme(t) { write(THEME_KEY, normTheme(t)); applyTheme(); }
export function setMode(m) { write(MODE_KEY, normMode(m)); applyTheme(); }

function systemDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme() {
  const theme = getTheme(), mode = getMode(), dark = resolvedDark(mode, systemDark());
  document.documentElement.className = htmlClass(theme, dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? THEME_BAR_DARK[theme] : THEME_BAR[theme]);
  document.dispatchEvent(new CustomEvent('dosegrid:refresh'));
}

// Re-apply when the OS scheme changes and we're in Auto.
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getMode() === 'auto') applyTheme(); });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/theme.test.js`
Expected: PASS (3 tests). (The pure exports are tested; `applyTheme`/`get*` touch DOM/localStorage and are exercised in the browser smoke.)

- [ ] **Step 5: Commit**

```bash
git add js/theme.js tests/theme.test.js
git commit -m "feat(theme): theme/mode state module"
```

---

### Task 2: Per-theme render module + Classic renderers (`js/theme-render.js`)

**Files:**
- Create: `js/theme-render.js`
- Test: `tests/theme-render.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/theme-render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileHtml, painCardHtml, doseHeaderHtml, timelinePalette } from '../js/theme-render.js';
import { setTheme } from '../js/theme.js';

// localStorage shim so setTheme works under node.
globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; })();
globalThis.document = { documentElement: {}, querySelector: () => null, dispatchEvent: () => {} };

const tv = { name: 'Paracetamol', strength: '500 mg', maxDay: 8, takenToday: 2, state: 'ready', scheduled: false, remainingText: '1h 40m', holdIng: null, lastLine: '2 h ago', color: '#38bdf8' };

for (const theme of ['classic', 'aurora', 'apothecary']) {
  test(`tileHtml renders for ${theme} across states`, () => {
    setTheme(theme);
    for (const state of ['ready', 'wait', 'hold', 'daily_max']) {
      const html = tileHtml({ ...tv, state, holdIng: state === 'hold' ? 'paracetamol' : null });
      assert.ok(html.length > 20, `${theme}/${state} produced output`);
      assert.ok(html.includes('Paracetamol'), `${theme}/${state} includes name`);
    }
  });
}

test('signature markers per theme', () => {
  setTheme('classic'); assert.ok(tileHtml(tv).includes('class="status'));
  setTheme('aurora'); assert.ok(tileHtml(tv).includes('au-dial'));
  setTheme('apothecary'); assert.ok(tileHtml(tv).includes('ap-blister'));
});

test('painCardHtml: data + empty state', () => {
  setTheme('classic');
  assert.ok(painCardHtml({ score: 4, color: '#f00', severity: 'moderate', relative: 'now', note: '' }).includes('4'));
  assert.ok(painCardHtml(null).toLowerCase().includes('no pain'));
});

test('doseHeaderHtml includes the name for each theme', () => {
  for (const theme of ['classic', 'aurora', 'apothecary']) {
    setTheme(theme);
    assert.ok(doseHeaderHtml({ name: 'Ibuprofen', strength: '400 mg', maxDay: 6, takenToday: 1, color: '#f00' }).includes('Ibuprofen'));
  }
});

test('timelinePalette returns keys with glow off', () => {
  const p = timelinePalette('aurora', true);
  ['pain', 'grid', 'axis', 'lane', 'now', 'band', 'ring'].forEach((k) => assert.ok(k in p));
  assert.equal(p.glow, false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/theme-render.test.js`
Expected: FAIL — `../js/theme-render.js` cannot be resolved.

- [ ] **Step 3: Create `js/theme-render.js` with the dispatch + Classic + helpers + stubs**

Create the file with the dispatch, the shared dial/blister SVG helpers, the **Classic** renderers (exact current markup), and Aurora/Apothecary renderers (filled in here — they are not stubs). Full file:

```js
// js/theme-render.js — per-theme HTML for the signature surfaces. Pure (view -> string).
import { getTheme } from './theme.js';

/* ---- shared SVG bits ---- */
const R = 42, CIRC = 2 * Math.PI * R;
function dial(color, frac) {
  const off = CIRC * (1 - Math.max(0.012, Math.min(1, frac)));
  return `<svg class="au-dial" viewBox="0 0 96 96"><circle class="au-track" cx="48" cy="48" r="${R}"/>` +
    `<circle class="au-prog" cx="48" cy="48" r="${R}" stroke="${color}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}
function blister(taken, max, cls) {
  let dots = '';
  for (let i = 0; i < max; i++) dots += `<i class="${i < taken ? 'on' : ''}"></i>`;
  return `<div class="${cls || 'ap-blister'}">${dots}</div>`;
}

/* ---- Classic (current markup) ---- */
function classicTile(v) {
  const count = `<span class="count">${v.remainingText}</span>`;
  const statusInner =
    v.state === 'ready' ? (v.scheduled ? 'Due to take' : 'Ready when needed')
    : v.state === 'wait' ? (v.scheduled ? `Due in&nbsp;${count}` : `${count}&nbsp;until next`)
    : v.state === 'hold' ? `Hold&nbsp;${count}`
    : (v.scheduled ? 'Done for today' : 'Daily max');
  return `<div><h2>${v.name}</h2>` +
    `<div class="dose-label">${v.strength ? v.strength + ' · ' : ''}max ${v.maxDay}/day</div>` +
    (v.holdIng ? `<div class="last hold-note">Contains ${v.holdIng} — shared limit reached</div>`
      : (v.lastLine ? `<div class="last">${v.lastLine}</div>` : '')) +
    `</div><div class="status ${v.state}">${statusInner}</div>`;
}
function classicPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  return `<div class="pain-now"><div class="pain-score" style="color:${v.color}">${v.score}<span>/10</span></div>` +
    `<div class="pain-meta">${v.severity} · logged ${v.relative}${v.note ? `<br><span class="muted">“${v.note}”</span>` : ''}</div></div>`;
}
function classicHeader(v) {
  return `<h2>${v.name}${v.strength ? ` <span class="muted">${v.strength}</span>` : ''}</h2>`;
}

/* ---- Aurora (dial) ---- */
function auroraStatus(v) {
  const n = `${v.takenToday} of ${v.maxDay} today`;
  switch (v.state) {
    case 'wait': return { top: 'Next in', big: v.remainingText, sm: true, chip: n };
    case 'hold': return { top: 'On hold', big: 'Hold', chip: 'Shared limit', holdNote: `Contains ${v.holdIng}` };
    case 'daily_max': return { top: 'Today', big: v.scheduled ? '✓' : 'Max', chip: `${v.takenToday} of ${v.maxDay} · done` };
    default: return { top: v.scheduled ? 'Due' : 'Ready', big: 'Now', chip: n };
  }
}
function auroraTile(v) {
  const st = auroraStatus(v), frac = v.takenToday / v.maxDay;
  return `<div class="au-dialwrap">${dial(v.color, frac)}` +
    `<div class="au-dialc"><div class="au-top">${st.top}</div><div class="au-big${st.sm ? ' sm' : ''}">${st.big}</div></div></div>` +
    `<div class="au-nm">${v.name}</div><div class="au-st">${st.chip}</div>` +
    (st.holdNote ? `<div class="au-holdnote">${st.holdNote}</div>` : '');
}
function auroraPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  const frac = v.score / 10;
  return `<div class="au-paincard"><div class="au-pscore">${dial('url(#auG)', frac)}` +
    `<svg width="0" height="0"><defs><linearGradient id="auG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15b886"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs></svg>` +
    `<div class="au-pv">${v.score}</div></div>` +
    `<div class="au-pmeta"><div class="au-plab">Pain right now</div><div class="au-psev">${v.severity}</div>` +
    `<div class="au-psince">${v.relative}${v.note ? ` · “${v.note}”` : ''}</div></div></div>`;
}
function auroraHeader(v) {
  return `<div class="au-shead"><div class="au-dialwrap sm">${dial(v.color, v.takenToday / v.maxDay)}</div>` +
    `<div><div class="au-sname">${v.name}</div><div class="au-sstrength">${v.strength} · max ${v.maxDay}/day</div></div></div>`;
}

/* ---- Apothecary (blister) ---- */
function apoStatus(v) {
  const n = `${v.takenToday} of ${v.maxDay} today`;
  switch (v.state) {
    case 'wait': return { icon: '◷', text: 'Next dose due soon', sub: v.remainingText };
    case 'hold': return { icon: '⊘', text: 'On hold', sub: `contains ${v.holdIng}` };
    case 'daily_max': return { icon: '●', text: v.scheduled ? 'Done for today' : 'Daily max reached', sub: '' };
    default: return { icon: '✓', text: v.scheduled ? 'Due now' : 'Ready now', sub: n };
  }
}
function apoTile(v) {
  const st = apoStatus(v);
  return `<div class="ap-head"><div><div class="ap-name">${v.name}</div>` +
    `<div class="ap-strength">${v.strength ? v.strength + ' · ' : ''}max ${v.maxDay}/day</div></div><div class="ap-icon">${st.icon}</div></div>` +
    blister(v.takenToday, v.maxDay) +
    `<div class="ap-status"><span class="d"></span>${st.text}${st.sub ? ` <small>${st.sub}</small>` : ''}</div>`;
}
function apoPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  return `<div class="ap-paincard"><div class="ap-pill"><b style="color:${v.color}">${v.score}</b><span>pain · ${v.severity}</span></div>` +
    `<div class="ap-pmeta">${v.relative}${v.note ? `<br><span class="muted">“${v.note}”</span>` : ''}</div></div>`;
}
function apoHeader(v) {
  return `<div class="ap-sname">${v.name}</div><div class="ap-sstrength">${v.strength} · max ${v.maxDay}/day</div>` +
    blister(v.takenToday, v.maxDay, 'ap-sh-blister');
}

/* ---- dispatch ---- */
const TILES = { classic: classicTile, aurora: auroraTile, apothecary: apoTile };
const PAINS = { classic: classicPain, aurora: auroraPain, apothecary: apoPain };
const HEADERS = { classic: classicHeader, aurora: auroraHeader, apothecary: apoHeader };
export function tileHtml(view) { return (TILES[getTheme()] || classicTile)(view); }
export function painCardHtml(view) { return (PAINS[getTheme()] || classicPain)(view); }
export function doseHeaderHtml(view) { return (HEADERS[getTheme()] || classicHeader)(view); }

/* ---- timeline palette (colours only; structure unchanged) ---- */
const PAL = {
  classic: { light: null, dark: { grid: 'rgba(148,163,184,.22)', gtext: '#94a3b8', lane: '#475569', now: 'rgba(148,163,184,.4)', band: 'rgba(148,163,184,.05)', ring: '#0b1220' } },
  aurora: {
    light: { grid: 'rgba(16,23,40,.08)', gtext: '#9aa3b4', lane: 'rgba(16,23,40,.12)', now: 'rgba(16,23,40,.25)', band: 'rgba(16,23,40,.025)', ring: '#fff' },
    dark: { grid: 'rgba(255,255,255,.08)', gtext: '#6b7488', lane: 'rgba(255,255,255,.12)', now: 'rgba(255,255,255,.28)', band: 'rgba(255,255,255,.03)', ring: '#0c1018' } },
  apothecary: {
    light: { grid: 'rgba(43,33,24,.1)', gtext: '#9a8c78', lane: 'rgba(43,33,24,.18)', now: 'rgba(191,91,57,.5)', band: 'rgba(43,33,24,.028)', ring: '#fbf6ec' },
    dark: { grid: 'rgba(255,255,255,.1)', gtext: '#9a8c78', lane: 'rgba(255,255,255,.18)', now: 'rgba(223,125,84,.6)', band: 'rgba(255,255,255,.028)', ring: '#221b14' } },
};
export function timelinePalette(theme, dark) {
  const t = PAL[theme] || PAL.classic;
  const p = (dark ? t.dark : t.light) || PAL.classic.dark;
  return { pain: null, area: null, glow: false, grid: p.grid, gtext: p.gtext, lane: p.lane, now: p.now, band: p.band, ring: p.ring, axis: p.gtext };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/theme-render.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/theme-render.js tests/theme-render.test.js
git commit -m "feat(theme): per-theme render module (Classic + Aurora + Apothecary)"
```

---

### Task 3: Wire the renderers into the app (`js/ui.js`, `js/painview.js`)

**Files:**
- Modify: `js/ui.js` (`renderGrid`, `openDoseSheet`)
- Modify: `js/painview.js` (`renderHomePain`)

- [ ] **Step 1: `renderGrid` delegates tile inner to `tileHtml`**

In `js/ui.js`, add to the imports near the top: `import { tileHtml, doseHeaderHtml } from './theme-render.js';` (and ensure `medColor` is imported from `./pain.js` — it is used by the grid view; if not already imported, add it).

Replace the tile-build block inside the `for (const med of meds)` loop:

```js
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.medId = med.id;
    const lastLine = fmtLastTaken(s.lastDoseTime);
    const scheduled = resolveDoseType(med) === 'scheduled';
    const count = `<span class="count">${fmtRemaining(msRemaining)}</span>`;
    const statusInner =
      state === 'ready' ? (scheduled ? 'Due to take' : 'Ready when needed')
      : state === 'wait' ? (scheduled ? `Due in&nbsp;${count}` : `${count}&nbsp;until next`)
      : state === 'hold' ? `Hold&nbsp;${count}`
      : (scheduled ? 'Done for today' : 'Daily max');
    tile.innerHTML =
      `<div><h2>${med.name}</h2>` +
      `<div class="dose-label">${med.strength ? med.strength + ' · ' : ''}max ${med.maxDailyUnits}/day</div>` +
      (holdIng ? `<div class="last hold-note">Contains ${holdIng} — shared limit reached</div>`
        : (lastLine ? `<div class="last">${lastLine}</div>` : '')) +
      `</div>` +
      `<div class="status ${state}">${statusInner}</div>`;
    attachTileHandlers(tile, med);
    grid.appendChild(tile);
```

with:

```js
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.medId = med.id;
    tile.innerHTML = tileHtml({
      name: med.name,
      strength: med.strength || '',
      maxDay: med.maxDailyUnits,
      takenToday: s.unitsToday,
      state,
      scheduled: resolveDoseType(med) === 'scheduled',
      remainingText: fmtRemaining(msRemaining),
      holdIng,
      lastLine: fmtLastTaken(s.lastDoseTime),
      color: medColor(med.order || 0),
    });
    attachTileHandlers(tile, med);
    grid.appendChild(tile);
```

- [ ] **Step 2: `openDoseSheet` uses the themed header**

In `js/ui.js` `openDoseSheet`, find the sheet's title line:

```js
    `<h2>${med.name}${med.strength ? ` <span class="muted">${med.strength}</span>` : ''}</h2>` +
```

replace with:

```js
    doseHeaderHtml({ name: med.name, strength: med.strength || '', maxDay: med.maxDailyUnits, takenToday: s.unitsToday, state: med.state, color: medColor(med.order || 0) }) +
```

(`s` is the `computeStatus` result already in scope; `medColor` is now imported.)

- [ ] **Step 3: `renderHomePain` uses the themed pain card**

In `js/painview.js`, add to imports: `import { painCardHtml } from './theme-render.js';` Replace the `const summary = last ? ... : ...;` block with:

```js
  const last = latestPain(pain);
  const summary = painCardHtml(last
    ? { score: last.score, color: painColor(last.score), severity: severity(last.score), relative: fmtRelative(last.timestamp), note: last.note || '' }
    : null);
```

(`pain`, `latestPain`, `painColor`, `severity`, `fmtRelative` are already imported/in scope.)

- [ ] **Step 4: Verify syntax + regression (Classic must look identical)**

Run: `node --check js/ui.js && node --check js/painview.js && node --test`
Expected: no syntax errors; all tests pass. (Classic markup is byte-identical to before, so the live app is unchanged until a theme class is applied.)

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/painview.js
git commit -m "feat(theme): delegate tile/pain-card/dose-header to theme-render"
```

---

### Task 4: CSS tokenisation + Classic theme file + boot apply

**Files:**
- Modify: `css/styles.css` (add font/shadow tokens; move Classic palette out of `:root`)
- Create: `css/theme-classic.css`
- Modify: `index.html` (link theme CSS; nothing else)
- Modify: `js/app.js` (`applyTheme()` on boot)

- [ ] **Step 1: Replace `:root` palette with structural-only tokens in `css/styles.css`**

Change the `:root { ... }` block at the top of `css/styles.css` from the current palette to structural defaults + font hooks:

```css
:root {
  --radius: 16px;
  --font-body: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-display: var(--font-body);
  --shadow: rgba(0, 0, 0, .4);
  font-family: var(--font-body);
}
```

Then make the body + headings use the font tokens. In `css/styles.css`, ensure `body { font-family: var(--font-body); }` (add it to the existing `body { ... }` rule) and add once near the top: `h1, h2, h3 { font-family: var(--font-display); }`.

- [ ] **Step 2: Create `css/theme-classic.css` with the palette (light + dark)**

```css
/* Classic — the original slate/cyan dark, plus a light variant. */
.theme-classic.is-dark, .theme-classic {
  --bg: #0b1220; --field: #0f172a; --surface: #1e293b; --line: #334155;
  --accent: #22d3ee; --text: #e2e8f0; --muted: #94a3b8;
  --ready: #4ade80; --wait: #fbbf24; --max: #f87171; --shadow: rgba(0, 0, 0, .5);
  --font-body: Inter, system-ui, sans-serif; --font-display: Inter, system-ui, sans-serif;
}
.theme-classic:not(.is-dark) {
  --bg: #f4f7fb; --field: #ffffff; --surface: #ffffff; --line: #dfe6ef;
  --accent: #0e9bb8; --text: #16202e; --muted: #5b6676;
  --ready: #15a05f; --wait: #c47d0a; --max: #d4493f; --shadow: rgba(16, 32, 46, .18);
}
```

(The default `.theme-classic` value above is the dark palette, so Classic is dark-by-default; `:not(.is-dark)` provides the light values.)

- [ ] **Step 3: Link the theme CSS in `index.html`**

In `index.html` `<head>`, after the existing `<link rel="stylesheet" href="./css/styles.css" />`, add:

```html
  <link rel="stylesheet" href="./css/theme-classic.css" />
  <link rel="stylesheet" href="./css/theme-aurora.css" />
  <link rel="stylesheet" href="./css/theme-apothecary.css" />
```

(`theme-aurora.css` / `theme-apothecary.css` are created in Tasks 5–6; a missing file 404s harmlessly until then.)

- [ ] **Step 4: Apply the theme on boot in `js/app.js`**

At the very top of `js/app.js` imports add: `import { applyTheme } from './theme.js';`
Immediately after the imports (before any render), add: `applyTheme();`

- [ ] **Step 5: Verify + manual check**

Run: `node --check js/app.js && node --test`
Expected: no errors; tests pass. Manual: open `index.html` — Classic dark looks exactly as before; setting `localStorage['dosegrid.mode']='light'` + reload shows the light Classic palette.

- [ ] **Step 6: Commit**

```bash
git add css/styles.css css/theme-classic.css index.html js/app.js
git commit -m "feat(theme): tokenise CSS, Classic light/dark, apply on boot"
```

---

### Task 5: Aurora theme CSS (`css/theme-aurora.css`)

**Files:**
- Create: `css/theme-aurora.css`

- [ ] **Step 1: Create `css/theme-aurora.css`**

Adapt `design/concepts/aurora.css` (already in the repo) to the app's class names. Concretely:
1. Keep the `@import` Fraunces line and the `.theme-aurora` / `.theme-aurora-dark` token blocks — but rename the dark selector to **`.theme-aurora.is-dark`** (not `-dark`), and add `--font-body`/`--font-display` (Hanken Grotesk / Fraunces) + `--shadow`.
2. Retarget the bespoke structures to the app's elements:
   - `.au-tile` rules → **`.theme-aurora .tile`** (frosted, centred, the dial-tile look).
   - keep `.au-dial/.au-track/.au-prog/.au-dialwrap/.au-dialc/.au-top/.au-big/.au-nm/.au-st/.au-holdnote` (these class names are emitted by `theme-render.js`).
   - `.au-now` → **`.theme-aurora .au-paincard`** and map the demo's `.pscore/.pv/.meta` to `.au-pscore/.au-pv/.au-pmeta/.au-plab/.au-psev/.au-psince`.
   - `.au-sheet` look → **`.theme-aurora .sheet`**; keep `.au-shead/.au-sname/.au-sstrength` (emitted by `doseHeaderHtml`).
   - the demo's `.zbtn`/controls map to the app's `.zb` and `.view-toggle`/`.tile.add` via `.theme-aurora .zb { … }` etc.
3. Theme the shared chrome with tokens: `.theme-aurora .app-header`, `.tile`, `.status`, `.btn`, `.sheet`, `.pain-now` already paint from `--bg/--surface/--text/--accent/...` which the token block sets — so most surfaces theme for free; only add structural overrides where Aurora needs rounder/frosted treatment.
Use the demo file as the source of the exact values; the only mechanical changes are the selector retargets above and `is-dark`.

- [ ] **Step 2: Verify it loads (syntax sanity)**

Run: `node -e "const c=require('fs').readFileSync('css/theme-aurora.css','utf8'); if(!c.includes('.theme-aurora')) throw new Error('missing theme scope'); if(c.includes('.theme-aurora-dark')) throw new Error('stale -dark selector'); console.log('aurora css ok');"`
Expected: `aurora css ok`

- [ ] **Step 3: Commit**

```bash
git add css/theme-aurora.css
git commit -m "feat(theme): Aurora theme CSS (dials, frosted, light/dark)"
```

---

### Task 6: Apothecary theme CSS (`css/theme-apothecary.css`)

**Files:**
- Create: `css/theme-apothecary.css`

- [ ] **Step 1: Create `css/theme-apothecary.css`**

Adapt `design/concepts/apothecary.css` the same way:
1. Keep `@import` Spectral + Figtree; keep the `.theme-apothecary` / rename `-dark` → **`.theme-apothecary.is-dark`** token blocks; add `--font-body` (Figtree) / `--font-display` (Spectral) / `--shadow`.
2. Retarget structures to app elements:
   - `.ap-tile` → **`.theme-apothecary .tile`** (warm tactile card; keep the two-column grid via `.theme-apothecary .grid { grid-template-columns: 1fr 1fr; }`).
   - keep `.ap-head/.ap-name/.ap-strength/.ap-icon/.ap-blister/.ap-blister i(.on)/.ap-status` (emitted by `theme-render.js`); keep the hardened `flex:none` + wrap rules on `.ap-blister`.
   - `.ap-top .pill-now` → **`.theme-apothecary .ap-paincard`** + `.ap-pill/.ap-pmeta`.
   - `.ap-sheet` → **`.theme-apothecary .sheet`**; keep `.ap-sname/.ap-sstrength/.ap-sh-blister`.
   - controls → `.theme-apothecary .zb`.
3. Shared chrome themes via the token block (cream/espresso), as with Aurora.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const c=require('fs').readFileSync('css/theme-apothecary.css','utf8'); if(!c.includes('.theme-apothecary')) throw new Error('missing scope'); if(c.includes('.theme-apothecary-dark')) throw new Error('stale -dark'); console.log('apothecary css ok');"`
Expected: `apothecary css ok`

- [ ] **Step 3: Commit**

```bash
git add css/theme-apothecary.css
git commit -m "feat(theme): Apothecary theme CSS (blisters, tactile, light/dark)"
```

---

### Task 7: Theme-aware timeline palette (`js/timeline.js`)

**Files:**
- Modify: `js/timeline.js`

- [ ] **Step 1: Import the palette + theme state**

At the top of `js/timeline.js` add:

```js
import { timelinePalette } from './theme-render.js';
import { getTheme, getMode, resolvedDark } from './theme.js';
```

- [ ] **Step 2: Resolve the palette at render and use it for chrome colours**

Inside the `render()` function (after `const meds = medLookup();` or near the top of building `s`), add:

```js
    const dark = resolvedDark(getMode(), typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
    const PAL = timelinePalette(getTheme(), dark);
```

Then replace the hard-coded slate chrome colours in the SVG string with `PAL.*`:
- day-band fill `rgba(148,163,184,0.05)` → `PAL.band`;
- midnight divider + gridline strokes `rgba(148,163,184,0.22)` / `#334155` → `PAL.grid`;
- axis + gridline `<text fill="#94a3b8">` → `PAL.gtext` (and the `axis` ticks);
- dose lane baseline `#475569` → `PAL.lane`;
- the "max" dashed line stays `#f87171` (semantic).
Pain dots/line keep `painColor(...)`, doses keep `medColor(...)`, the lock overlay keeps its cyan. Only the neutral chrome reads from `PAL`.

- [ ] **Step 3: Verify**

Run: `node --check js/timeline.js && node --test`
Expected: no errors; tests pass.

- [ ] **Step 4: Commit**

```bash
git add js/timeline.js
git commit -m "feat(theme): timeline chrome reads the theme palette"
```

---

### Task 8: Appearance picker on the landing (`js/ui.js`)

**Files:**
- Modify: `js/ui.js` (`showLanding`)
- Modify: `css/styles.css` (picker chrome)

- [ ] **Step 1: Import theme state into `js/ui.js`**

Add: `import { THEMES, MODES, THEME_LABELS, getTheme, getMode, setTheme, setMode } from './theme.js';`

- [ ] **Step 2: Add an Appearance section to `showLanding`**

In `showLanding(...)`, just before the `Reminder settings` button row (`<div class="btn-row"><button class="btn secondary" id="land-reminders">…`), insert this markup into the sheet HTML:

```js
    `<div class="field"><label>Appearance</label>` +
    `<div class="theme-chips" id="theme-chips">` +
      THEMES.map((t) => `<button class="theme-chip${t === getTheme() ? ' sel' : ''}" data-theme="${t}">${THEME_LABELS[t]}</button>`).join('') +
    `</div>` +
    `<div class="mode-seg" id="mode-seg">` +
      MODES.map((m) => `<button class="mode-opt${m === getMode() ? ' sel' : ''}" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('') +
    `</div></div>` +
```

Then wire them after the sheet is opened (next to the existing `#land-country` wiring):

```js
  modalRoot().querySelectorAll('#theme-chips .theme-chip').forEach((b) =>
    b.addEventListener('click', () => { setTheme(b.dataset.theme); showLanding(opts); }));
  modalRoot().querySelectorAll('#mode-seg .mode-opt').forEach((b) =>
    b.addEventListener('click', () => { setMode(b.dataset.mode); showLanding(opts); }));
```

(`setTheme`/`setMode` call `applyTheme()` which re-applies the class + fires `dosegrid:refresh`; re-opening the landing with `showLanding(opts)` refreshes the chips and renders the picker itself on-theme. `opts` is the existing `showLanding` parameter.)

- [ ] **Step 3: Picker styles in `css/styles.css`**

Append:

```css
.theme-chips { display: flex; gap: 8px; }
.theme-chip { flex: 1; appearance: none; font: inherit; font-weight: 600; font-size: .82rem; padding: 9px 6px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); cursor: pointer; }
.theme-chip.sel { border-color: var(--accent); color: var(--text); }
.mode-seg { display: flex; gap: 4px; margin-top: 8px; background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 3px; }
.mode-opt { flex: 1; appearance: none; font: inherit; font-size: .78rem; font-weight: 600; padding: 7px; border-radius: 8px; border: none; background: transparent; color: var(--muted); cursor: pointer; }
.mode-opt.sel { background: var(--accent); color: #06222a; }
```

- [ ] **Step 4: Verify**

Run: `node --check js/ui.js && node --test`
Expected: no errors; tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js css/styles.css
git commit -m "feat(theme): Appearance picker (theme chips + Auto/Light/Dark) on landing"
```

---

### Task 9: Service worker precache + cache bump + final verification

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Add the new assets + bump the cache**

In `service-worker.js`: bump `const CACHE = 'dosegrid-v23';` to `'dosegrid-v24'`. Add to the `ASSETS` array: `'./js/theme.js'`, `'./js/theme-render.js'`, `'./css/theme-classic.css'`, `'./css/theme-aurora.css'`, `'./css/theme-apothecary.css'` (alongside the existing js/css entries).

- [ ] **Step 2: Full regression + syntax sweep**

Run: `node --check js/theme.js && node --check js/theme-render.js && node --check js/ui.js && node --check js/painview.js && node --check js/app.js && node --check js/timeline.js && node --test`
Expected: no syntax errors; all tests pass (existing 103 + new theme + theme-render tests).

- [ ] **Step 3: Manual browser smoke (document results)**

Open `index.html`; from the `?` landing → Appearance:
1. **Classic** dark = unchanged; Classic light recolours the whole app.
2. **Aurora**: tiles become radial dials; Home pain card a radial ring; dose sheet frosted with a dial header; Fraunces/Hanken fonts; light + dark both legible; timeline chrome recolours.
3. **Apothecary**: tiles become blister cards (two-column); warm pill pain card; tactile dose sheet; Spectral/Figtree; light (cream) + dark (espresso).
4. The choice **persists** across reload; **Auto** follows the OS light/dark setting.
5. Logging a dose / pain, the ingredient hold state, warnings, history, paywall, notifications all behave exactly as before (only their look changes).

- [ ] **Step 4: Commit**

```bash
git add service-worker.js
git commit -m "chore: precache theme files + bump SW cache to v24"
```

---

## Self-Review notes

- **Spec coverage:** theme/mode state + applyTheme (Task 1); per-theme render incl. Classic/Aurora/Apothecary tile/painCard/doseHeader + timelinePalette (Task 2); wiring into renderGrid/openDoseSheet/renderHomePain (Task 3); CSS tokenisation + Classic light/dark + boot apply (Task 4); Aurora CSS (Task 5); Apothecary CSS (Task 6); timeline palette (Task 7); Appearance picker (Task 8); SW precache + bump + smoke (Task 9). All spec sections covered.
- **Type consistency:** the `view` object keys produced in Task 3 (`name, strength, maxDay, takenToday, state, scheduled, remainingText, holdIng, lastLine, color`) exactly match the keys consumed by `theme-render.js` in Task 2; `painCardHtml` view (`score,color,severity,relative,note`) and `doseHeaderHtml` view (`name,strength,maxDay,takenToday,color`) match producer↔consumer. Class names emitted by JS (`au-dial`, `au-dialwrap`, `au-paincard`, `ap-blister`, `ap-paincard`, `ap-sh-blister`, …) are exactly the ones the Task 5/6 CSS retargets keep.
- **Regression guard:** Classic tile/pain/header markup in Task 2 is byte-identical to the current app, so until a non-Classic theme class is applied the UI is unchanged; the 103 existing tests plus the new pure tests must stay green.
- **No placeholders:** JS steps carry complete code; CSS Tasks 5–6 give an exact selector-retarget recipe against in-repo demo source files (concrete, reproducible) rather than re-pasting ~80 lines twice.
