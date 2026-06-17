# Early-Dose / Over-Max Safety Warning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a logged dose is earlier than the set interval or would exceed the daily max, show a confirm-before-logging card with the facts and country-appropriate help lines (nurse → poison → emergency), still allowing override.

**Architecture:** Pure `js/safety.js` `checkDose` over existing dose data; `js/helplines.js` data + lookup + country setting; `js/ui.js` runs the check in the dose sheet and renders the warning card + a country picker (added to the landing/About page). Free, on-device, no new deps.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), `localStorage`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-17-dosegrid-safety-warning-design.md`

---

## File Structure

- `js/safety.js` — **new** pure `checkDose(med, doses, addedUnits, now)`.
- `js/helplines.js` — **new** `HELP_LINES`, `helpLinesFor`, `COUNTRY_OPTIONS`, `getCountry`, `setCountry`.
- `js/ui.js` — run `checkDose` in the dose sheet; add `openDoseWarning`, `openCountryPicker`, `helpLinesHtml`, `fmtGap`; add a country `<select>` to `showLanding`.
- `css/styles.css` — warning-card styles.
- `service-worker.js` — precache the two new modules; bump cache `dosegrid-v6`.
- `tests/safety.test.js`, `tests/helplines.test.js` — new.

---

## Task 1: `js/safety.js` — `checkDose`

**Files:** Create `js/safety.js`; Test `tests/safety.test.js`.

- [ ] **Step 1: Create `tests/safety.test.js`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDose } from '../js/safety.js';

const HOUR = 3600 * 1000;
const med = { id: 'm', name: 'Ibuprofen', intervalHours: 6, maxDailyUnits: 6 };
const now = new Date('2026-06-17T15:00:00').getTime();
const todayDose = (hAgo, units) => ({ id: 'd' + hAgo, medId: 'm', timestamp: now - hAgo * HOUR, units });

test('null when interval elapsed and under max', () => {
  assert.equal(checkDose(med, [todayDose(8, 1)], 1, now), null);
});

test('early when within the interval', () => {
  const r = checkDose(med, [todayDose(2, 1)], 1, now);
  assert.equal(r.type, 'early');
  assert.equal(r.intervalHours, 6);
  assert.ok(r.gapMs >= 2 * HOUR - 1000 && r.gapMs <= 2 * HOUR + 1000);
});

test('over when resulting units exceed max', () => {
  const r = checkDose(med, [todayDose(8, 5)], 2, now); // 5 + 2 = 7 > 6, interval elapsed
  assert.equal(r.type, 'over');
  assert.equal(r.resultingUnits, 7);
  assert.equal(r.maxDailyUnits, 6);
});

test('null at exactly max (not over)', () => {
  assert.equal(checkDose(med, [todayDose(8, 5)], 1, now), null); // 5 + 1 = 6, not > 6
});

test('over takes precedence when both early and over', () => {
  const r = checkDose(med, [todayDose(2, 5)], 2, now); // early (2h<6h) AND 7>6
  assert.equal(r.type, 'over');
});
```

- [ ] **Step 2: Run `node --test tests/safety.test.js` → FAIL** (module missing).

- [ ] **Step 3: Create `js/safety.js`**

```javascript
// js/safety.js — pure pre-log dose safety check (no DOM).
import { lastDose, nextDoseTime, unitsToday } from './dosing.js';

// Returns null if the dose is fine, else a warning descriptor.
export function checkDose(med, doses, addedUnits, now) {
  const last = lastDose(doses, med.id);
  const next = nextDoseTime(doses, med.id, med.intervalHours);
  const units = unitsToday(doses, med.id, now);
  const resulting = units + addedUnits;
  const early = next != null && now < next;
  const over = resulting > med.maxDailyUnits;
  if (!early && !over) return null;
  return {
    type: over ? 'over' : 'early', // over takes precedence
    early, over,
    lastDoseTime: last ? last.timestamp : null,
    gapMs: last ? now - last.timestamp : null,
    intervalHours: med.intervalHours,
    unitsToday: units,
    resultingUnits: resulting,
    maxDailyUnits: med.maxDailyUnits,
  };
}
```

- [ ] **Step 4: Run `node --test tests/safety.test.js` → PASS.** Then full `node --test` → green.

- [ ] **Step 5: Commit**

```bash
git add js/safety.js tests/safety.test.js
git commit -m "feat: checkDose pre-log safety check (early / over-max)"
```

---

## Task 2: `js/helplines.js` — country help-line data

**Files:** Create `js/helplines.js`; Test `tests/helplines.test.js`.

- [ ] **Step 1: Create `tests/helplines.test.js`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_LINES, helpLinesFor, COUNTRY_OPTIONS } from '../js/helplines.js';

test('AU leads with a nurse advice line', () => {
  const au = helpLinesFor('AU');
  assert.equal(au.country, 'Australia');
  assert.equal(au.advice[0].kind, 'nurse');
  assert.equal(au.advice[0].number, '1800 022 222');
});

test('unknown code falls back to other (empty advice + directory)', () => {
  const o = helpLinesFor('ZZ');
  assert.equal(o, HELP_LINES.other);
  assert.equal(o.advice.length, 0);
  assert.ok(o.directory && o.directory.url.includes('who.int'));
});

test('every entry has advice array and an emergency object', () => {
  for (const [code, e] of Object.entries(HELP_LINES)) {
    assert.ok(Array.isArray(e.advice), code);
    assert.ok(e.emergency && 'number' in e.emergency, code);
  }
});

test('COUNTRY_OPTIONS covers the data + an Other entry', () => {
  const codes = COUNTRY_OPTIONS.map((o) => o[0]);
  assert.ok(codes.includes('AU') && codes.includes('other'));
});
```

- [ ] **Step 2: Run `node --test tests/helplines.test.js` → FAIL.**

- [ ] **Step 3: Create `js/helplines.js`**

```javascript
// js/helplines.js — vetted per-country drug-advice/poison help lines + country setting.
// Priority: on-call nurse line → poison information → emergency (only if no advice line).
// Comprehensive global source: WHO World Directory of Poisons Centres.

export const HELP_LINES = {
  AU: { country: 'Australia', advice: [
    { kind: 'nurse', label: 'healthdirect — 24/7 nurse line', number: '1800 022 222', note: 'General health advice' },
    { kind: 'poison', label: 'Poisons Information Centre', number: '13 11 26', note: 'Medicines & overdose, 24/7' },
  ], emergency: { label: 'Emergency', number: '000' } },
  NZ: { country: 'New Zealand', advice: [
    { kind: 'nurse', label: 'Healthline', number: '0800 611 116', note: '24/7 nurse advice' },
    { kind: 'poison', label: 'National Poisons Centre', number: '0800 764 766', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '111' } },
  UK: { country: 'United Kingdom', advice: [
    { kind: 'nurse', label: 'NHS 111', number: '111', note: 'Nurse-led advice, incl. poisoning' },
  ], emergency: { label: 'Emergency', number: '999' } },
  CA: { country: 'Canada', advice: [
    { kind: 'nurse', label: 'Health Link / Telehealth', number: '811', note: 'Most provinces' },
    { kind: 'poison', label: 'Poison Centres', number: '1-844-764-7669', note: 'Québec: 1-800-463-5060' },
  ], emergency: { label: 'Emergency', number: '911' } },
  US: { country: 'United States', advice: [
    { kind: 'poison', label: 'Poison Help', number: '1-800-222-1222', note: '24/7 medicines & overdose advice' },
  ], emergency: { label: 'Emergency', number: '911' } },
  IE: { country: 'Ireland', advice: [
    { kind: 'poison', label: 'National Poisons Information Centre', number: '01 809 2166' },
  ], emergency: { label: 'Emergency', number: '112' } },
  other: { country: 'Other / not listed', advice: [],
    directory: { label: 'WHO World Directory of Poisons Centres', url: 'https://apps.who.int/poisoncentres/' },
    emergency: { label: 'Local emergency number', number: null } },
};

export const COUNTRY_OPTIONS = [
  ['AU', 'Australia'], ['NZ', 'New Zealand'], ['UK', 'United Kingdom'],
  ['CA', 'Canada'], ['US', 'United States'], ['IE', 'Ireland'], ['other', 'Other / not listed'],
];

export function helpLinesFor(code) { return HELP_LINES[code] || HELP_LINES.other; }

const COUNTRY_KEY = 'dosegrid.country';
export function getCountry() { try { return localStorage.getItem(COUNTRY_KEY) || 'AU'; } catch { return 'AU'; } }
export function setCountry(code) { try { localStorage.setItem(COUNTRY_KEY, code); } catch { /* ignore */ } }
```

- [ ] **Step 4: Run `node --test tests/helplines.test.js` → PASS.** Full `node --test` → green.

- [ ] **Step 5: Commit**

```bash
git add js/helplines.js tests/helplines.test.js
git commit -m "feat: vetted per-country help lines + country setting"
```

---

## Task 3: Wire the warning into `js/ui.js`

**Files:** Modify `js/ui.js`.

- [ ] **Step 1: Add imports.** After the existing `import { resolveDoseType } from './categories.js';` line, add:

```javascript
import { checkDose } from './safety.js';
import { helpLinesFor, getCountry, setCountry, COUNTRY_OPTIONS } from './helplines.js';
```

- [ ] **Step 2: Replace the dose-amount handler in `openDoseSheet`.** Find:

```javascript
  modalRoot().querySelectorAll('[data-units]').forEach((b) =>
    b.addEventListener('click', () => {
      addDose(med.id, parseFloat(b.dataset.units));
      closeModal();
      renderGrid();
    })
  );
```

Replace with:

```javascript
  modalRoot().querySelectorAll('[data-units]').forEach((b) =>
    b.addEventListener('click', () => {
      const units = parseFloat(b.dataset.units);
      const commit = () => { addDose(med.id, units); closeModal(); renderGrid(); };
      const info = checkDose(med, loadDoses(), units, Date.now());
      if (info) openDoseWarning(med, units, info, commit); else commit();
    })
  );
```

- [ ] **Step 3: Add the warning + helpers.** Insert these functions immediately after the `openDoseSheet` function's closing `}`:

```javascript
function fmtGap(ms) {
  if (ms == null) return 'some time';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function helpLinesHtml(code) {
  const hl = helpLinesFor(code);
  let body;
  if (hl.advice.length) {
    body = hl.advice.map((a) =>
      `<a class="help-line" href="tel:${a.number.replace(/\s/g, '')}"><span>${a.label}` +
      `${a.note ? `<small>${a.note}</small>` : ''}</span><span class="num">${a.number}</span></a>`).join('');
  } else {
    body = `<a class="help-line" href="${hl.directory.url}" target="_blank" rel="noopener">` +
      `<span>${hl.directory.label}<small>Find your nearest centre</small></span><span class="num">↗</span></a>` +
      `<p class="caution">Or contact your doctor or pharmacist. In an emergency, call your local emergency number.</p>`;
  }
  return `<div class="help"><div class="h">Need advice?</div>${body}</div>`;
}

function openDoseWarning(med, units, info, onConfirm) {
  const code = getCountry();
  const over = info.type === 'over';
  const facts = over
    ? `This would make <b>${info.resultingUnits}</b> tablet${info.resultingUnits === 1 ? '' : 's'} of <b>${med.name}</b> today — more than your daily max of <b>${info.maxDailyUnits}</b>.`
    : `You last took <b>${med.name}</b> <b>${fmtGap(info.gapMs)}</b> ago. The minimum gap you set is <b>${info.intervalHours} h</b>.`;
  const caution = over
    ? `Going over your daily limit can be harmful. Please double-check the label, and get advice if you're unsure.`
    : `Taking doses closer together than directed can be unsafe. If you're unsure what to do, it's worth getting advice.`;
  openSheet(
    `<div class="warn-ico ${over ? 'over' : ''}">${over ? '🛑' : '⏱'}</div>` +
    `<h2>${over ? "That's over your daily limit" : "That's sooner than usual"}</h2>` +
    `<div class="facts">${facts}</div>` +
    `<p class="caution">${caution}</p>` +
    helpLinesHtml(code) +
    `<div class="btn-row"><button class="btn secondary" id="dw-cancel">Cancel</button>` +
    `<button class="btn ${over ? 'danger' : ''}" id="dw-go">Log it anyway</button></div>` +
    `<div class="country-note">Help lines for <b>${helpLinesFor(code).country}</b>. ` +
    `<a href="#" id="dw-country">Change country</a></div>`
  );
  modalRoot().querySelector('#dw-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#dw-go').addEventListener('click', () => onConfirm());
  modalRoot().querySelector('#dw-country').addEventListener('click', (e) => {
    e.preventDefault();
    openCountryPicker(() => openDoseWarning(med, units, info, onConfirm));
  });
}

function openCountryPicker(onDone) {
  const cur = getCountry();
  const opts = COUNTRY_OPTIONS.map(([c, name]) => `<option value="${c}"${c === cur ? ' selected' : ''}>${name}</option>`).join('');
  openSheet(
    `<h2>Your country</h2>` +
    `<p class="muted">Used to show the right help lines. Stored only on this device.</p>` +
    `<div class="field"><label>Country</label><select id="cp-sel">${opts}</select></div>` +
    `<div class="btn-row"><button class="btn secondary" id="cp-cancel">Cancel</button>` +
    `<button class="btn" id="cp-save">Save</button></div>`
  );
  modalRoot().querySelector('#cp-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#cp-save').addEventListener('click', () => {
    setCountry(modalRoot().querySelector('#cp-sel').value);
    closeModal();
    if (typeof onDone === 'function') onDone();
  });
}
```

- [ ] **Step 4: Add the country selector to the landing page.** In `showLanding`, find:

```javascript
    `<div class="pain-legend"><span>0 None</span><div class="grad"></div><span>10 Worst</span></div>` +
    dismissRow +
```

Replace with:

```javascript
    `<div class="pain-legend"><span>0 None</span><div class="grad"></div><span>10 Worst</span></div>` +
    `<div class="field"><label>Your country (for help lines)</label><select id="land-country">` +
    COUNTRY_OPTIONS.map(([c, name]) => `<option value="${c}"${c === getCountry() ? ' selected' : ''}>${name}</option>`).join('') +
    `</select></div>` +
    dismissRow +
```

Then find:

```javascript
  modalRoot().querySelector('#land-start').addEventListener('click', () => {
```

Insert immediately before it:

```javascript
  modalRoot().querySelector('#land-country')?.addEventListener('change', (e) => setCountry(e.target.value));
```

- [ ] **Step 5: Verify** — `node --check js/ui.js` → clean. `node --test` → green. Serve and check: logging a dose within the interval shows the amber "sooner than usual" card with the gap + AU help lines (nurse first); Cancel logs nothing; Log it anyway logs it. A dose taking you over the daily max shows the red "over your daily limit" card. "Change country" → picker → choosing US changes the help line to Poison Help. Landing page shows the country selector.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js
git commit -m "feat: confirm-before-logging safety warning + country picker"
```

---

## Task 4: Warning-card CSS

**Files:** Modify `css/styles.css`.

- [ ] **Step 1: Append to `css/styles.css`:**

```css
/* Dose safety warning */
.warn-ico { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(251,191,36,.16); box-shadow: 0 0 0 1px rgba(251,191,36,.4) inset; }
.warn-ico.over { background: rgba(248,113,113,.16); box-shadow: 0 0 0 1px rgba(248,113,113,.4) inset; }
.facts { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 0.9rem; line-height: 1.5; margin: 10px 0; }
.facts b { color: #f8fafc; }
.caution { font-size: 0.85rem; color: var(--muted); line-height: 1.5; margin: 8px 0; }
.help { border-top: 1px solid var(--line); margin-top: 12px; padding-top: 12px; }
.help .h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 8px; }
.help-line { display: flex; justify-content: space-between; gap: 10px; align-items: center; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; font-size: 0.9rem; }
.help-line .num { color: var(--accent); font-weight: 700; white-space: nowrap; }
.help-line small { color: var(--muted); display: block; font-size: 0.72rem; }
.country-note { font-size: 0.72rem; color: var(--muted); margin-top: 10px; }
.country-note a { color: var(--accent); }
```

- [ ] **Step 2: Verify** — reload; the warning card icon, facts box, and help-line rows are styled.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: safety warning card styling"
```

---

## Task 5: Service worker + README + verification

**Files:** Modify `service-worker.js`, `README.md`.

- [ ] **Step 1: SW** — change `const CACHE = 'dosegrid-v5';` to `const CACHE = 'dosegrid-v6';` and add `'./js/safety.js', './js/helplines.js'` to `ASSETS` (after `'./js/timeline.js'`).

- [ ] **Step 2: README** — add a feature bullet:
- **Safety check (free):** logging a dose sooner than your set interval, or over your daily max, shows a confirm card with the facts and your country's nurse / poison-information help lines — you can still log it. Set your country on the welcome screen.

And add to the structure list:
- `js/safety.js` — pre-log dose safety check (early / over-max)
- `js/helplines.js` — per-country drug-advice/poison help lines + country setting

- [ ] **Step 3: Full verification** — `node --test` → all green. `node --check js/*.js` → clean. Confirm `service-worker.js` has `dosegrid-v6` and lists both modules.

- [ ] **Step 4: Headless smoke** — serve; seed a med + a recent dose; tap a dose amount → confirm the early card renders with help lines and that "Log it anyway" calls through; seed near-max → over card; switch country → numbers change; a normal dose logs with no card.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: precache safety + helplines (SW v6); README"
```

---

## Self-Review (author check vs spec)

- **Confirm-before-logging, triggers early/over, over precedence, exactly-max ok** → Tasks 1 (`checkDose`), 3 (dose-sheet wiring).
- **Card: facts, caution, help lines, Cancel / Log it anyway, country footer** → Task 3 (`openDoseWarning`).
- **Priority nurse → poison → emergency-only-if-none** → Tasks 2 (data ordering + empty-advice `other`), 3 (`helpLinesHtml` renders advice; emergency not shown when advice present; directory + local-emergency text when advice empty).
- **Country setting, default AU, picker on landing + via warning** → Tasks 2 (`getCountry`/`setCountry`/`COUNTRY_OPTIONS`), 3 (`openCountryPicker`, landing `<select>`).
- **Vetted help-line data + WHO fallback** → Task 2.
- **Free / never gated** → no gating added anywhere.
- **SW/README** → Task 5.

Type/name consistency: `checkDose` (Task 1 → Task 3); `helpLinesFor`/`getCountry`/`setCountry`/`COUNTRY_OPTIONS` (Task 2 → Task 3); warning descriptor fields `type`/`gapMs`/`intervalHours`/`resultingUnits`/`maxDailyUnits` (Task 1 → read in Task 3 `openDoseWarning`); `openDoseWarning`/`openCountryPicker`/`helpLinesHtml`/`fmtGap` defined and used in Task 3; CSS classes `warn-ico`/`facts`/`caution`/`help`/`help-line`/`country-note` (Task 3 markup → Task 4 styles).
