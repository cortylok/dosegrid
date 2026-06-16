# DoseGrid PRN / Short-Term Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition DoseGrid as a PRN / short-term medication tracker: a curated dataset, a Bold Dark theme, 14-day history with a daily-bars graph, and a landing page that frames the app as "when you *can*, not when you *should*."

**Architecture:** Keep the existing vanilla-JS, no-build, ES-module structure. The dosing state machine (`dosing.js`), storage (`storage.js`), and search (`data.js`) are reused; we extend them. UI changes live in `ui.js` + `css/styles.css` + `index.html`. New pure helpers (`dailyDoseTotals`, category grouping) are unit-tested with `node --test`; the dataset gets a sanity test; visual changes are verified manually in-browser.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), `localStorage`, `node --test`, PWA (manifest + service worker), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-06-16-dosegrid-prn-redesign-design.md`

---

## File Structure

- `js/storage.js` — modify: prune window 48h → 14 days.
- `js/dosing.js` — add: `dailyDoseTotals(doses, medId, now, days)` pure aggregator.
- `js/data.js` — add: `groupByCategory(meds)` + `CATEGORY_LABELS` re-export helper for the picker.
- `js/categories.js` — create: ordered category id→label map (single source).
- `medications.json` — replace: curated PRN/short-term dataset with `category` + defaults.
- `css/styles.css` — replace: Bold Dark theme; new tile, graph, landing styles.
- `js/ui.js` — modify: tile markup (big countdown + last-taken), grouped picker + custom add, 14-day history with graph/list toggle, landing page renderer.
- `js/app.js` — modify: 14-day prune comment; first-launch landing gate; menu hook.
- `index.html` — modify: header button → menu/about that opens landing; theme-color.
- `service-worker.js` — modify: bump cache name.
- `tests/dosing.test.js`, `tests/storage.test.js`, `tests/data.test.js`, `tests/dataset.test.js` — add/adjust.

---

## Task 1: Storage — extend prune window to 14 days

**Files:**
- Modify: `js/storage.js:25-28`
- Test: `tests/storage.test.js:33-40`

- [ ] **Step 1: Update the failing test to expect a 14-day window**

Replace the `pruneDoses` test in `tests/storage.test.js`:

```javascript
test('pruneDoses keeps entries within 14 days, drops older', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: 'a', medId: 'm', timestamp: now - 1000, units: 1 },
    { id: 'b', medId: 'm', timestamp: now - 13 * day, units: 1 },
    { id: 'c', medId: 'm', timestamp: now - 15 * day, units: 1 },
  ];
  assert.deepEqual(pruneDoses(doses, now).map((d) => d.id), ['a', 'b']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage.test.js`
Expected: FAIL — entry `b` (13 days) dropped by the current 48h cutoff.

- [ ] **Step 3: Change the cutoff in `js/storage.js`**

```javascript
export function pruneDoses(doses, now = Date.now()) {
  const cutoff = now - 14 * 24 * 3600 * 1000;
  return doses.filter((d) => d.timestamp >= cutoff);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: extend dose history prune window to 14 days"
```

---

## Task 2: Dosing — `dailyDoseTotals` aggregator for the graph

**Files:**
- Modify: `js/dosing.js` (add function + helper)
- Test: `tests/dosing.test.js` (add cases)

- [ ] **Step 1: Write the failing tests**

Append to `tests/dosing.test.js`:

```javascript
import { dailyDoseTotals } from '../js/dosing.js';

test('dailyDoseTotals returns one bucket per day, newest last, zero-filled', () => {
  const now = new Date('2026-06-16T10:00:00').getTime();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: '1', medId: 'm', timestamp: now, units: 1 },
    { id: '2', medId: 'm', timestamp: now - 1000, units: 0.5 },
    { id: '3', medId: 'm', timestamp: now - 2 * day, units: 2 },
    { id: '4', medId: 'other', timestamp: now, units: 5 },
  ];
  const out = dailyDoseTotals(doses, 'm', now, 14);
  assert.equal(out.length, 14);
  assert.equal(out[13].units, 1.5);          // today
  assert.equal(out[12].units, 0);            // yesterday empty
  assert.equal(out[11].units, 2);            // two days ago
  assert.ok(out[13].dayStart <= now);        // each bucket carries its day start
});

test('dailyDoseTotals ignores doses older than the window', () => {
  const now = new Date('2026-06-16T10:00:00').getTime();
  const day = 24 * 3600 * 1000;
  const doses = [{ id: '1', medId: 'm', timestamp: now - 20 * day, units: 9 }];
  const out = dailyDoseTotals(doses, 'm', now, 14);
  assert.equal(out.reduce((s, b) => s + b.units, 0), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/dosing.test.js`
Expected: FAIL — `dailyDoseTotals` is not exported.

- [ ] **Step 3: Implement `dailyDoseTotals` in `js/dosing.js`**

Add below `unitsToday` (reusing the existing `startOfLocalDay` helper):

```javascript
export function dailyDoseTotals(doses, medId, now, days = 14) {
  const todayStart = startOfLocalDay(now);
  const day = 24 * 3600 * 1000;
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    buckets.push({ dayStart: todayStart - i * day, units: 0 });
  }
  const windowStart = todayStart - (days - 1) * day;
  for (const d of doses) {
    if (d.medId !== medId || d.timestamp < windowStart) continue;
    const idx = Math.floor((startOfLocalDay(d.timestamp) - windowStart) / day);
    if (idx >= 0 && idx < days) buckets[idx].units += d.units;
  }
  return buckets;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/dosing.test.js`
Expected: PASS (all existing dosing tests stay green).

- [ ] **Step 5: Commit**

```bash
git add js/dosing.js tests/dosing.test.js
git commit -m "feat: dailyDoseTotals aggregator for 14-day history graph"
```

---

## Task 3: Categories module + grouping helper

**Files:**
- Create: `js/categories.js`
- Modify: `js/data.js` (add `groupByCategory`)
- Test: `tests/data.test.js` (add cases)

- [ ] **Step 1: Create `js/categories.js`**

```javascript
// js/categories.js — ordered PRN/short-term category ids → labels (single source)
export const CATEGORIES = [
  { id: 'pain-fever', label: 'Pain & fever' },
  { id: 'allergy', label: 'Allergy' },
  { id: 'antibiotic', label: 'Antibiotics (short course)' },
  { id: 'nausea', label: 'Nausea & motion sickness' },
  { id: 'reflux', label: 'Reflux & indigestion' },
  { id: 'cough-cold', label: 'Cough, cold & decongestant' },
  { id: 'gut', label: 'Diarrhoea & constipation' },
  { id: 'migraine', label: 'Migraine' },
  { id: 'cramps', label: 'Cramps & period pain' },
  { id: 'steroid-short', label: 'Short-course steroids' },
  { id: 'sleep', label: 'Sleep & short-term calm' },
  { id: 'antifungal', label: 'Antifungal (short course)' },
  { id: 'antiviral', label: 'Antiviral (short course)' },
  { id: 'reliever', label: 'Reliever inhaler' },
  { id: 'throat-mouth', label: 'Throat & mouth' },
  { id: 'skin', label: 'Skin & topical relief' },
  { id: 'urinary', label: 'Cystitis relief' },
  { id: 'eye-ear', label: 'Eye & ear (short course)' },
  { id: 'custom', label: 'Other / custom' },
];
export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
export const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);
```

- [ ] **Step 2: Write the failing test**

Append to `tests/data.test.js`:

```javascript
import { groupByCategory } from '../js/data.js';

test('groupByCategory groups in category order and preserves member order', () => {
  const meds = [
    { generic: 'Cetirizine', category: 'allergy' },
    { generic: 'Paracetamol', category: 'pain-fever' },
    { generic: 'Ibuprofen', category: 'pain-fever' },
    { generic: 'Mystery', category: 'not-a-category' },
  ];
  const groups = groupByCategory(meds);
  assert.equal(groups[0].id, 'pain-fever');
  assert.deepEqual(groups[0].meds.map((m) => m.generic), ['Paracetamol', 'Ibuprofen']);
  assert.equal(groups[1].id, 'allergy');
  // unknown category falls under 'custom'
  assert.ok(groups.some((g) => g.id === 'custom' && g.meds[0].generic === 'Mystery'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/data.test.js`
Expected: FAIL — `groupByCategory` not exported.

- [ ] **Step 4: Implement `groupByCategory` in `js/data.js`**

Add at the top: `import { CATEGORY_ORDER, CATEGORY_LABELS } from './categories.js';`
Then append:

```javascript
export function groupByCategory(meds) {
  const known = new Set(CATEGORY_ORDER);
  const byId = new Map();
  for (const m of meds) {
    const id = known.has(m.category) ? m.category : 'custom';
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(m);
  }
  return CATEGORY_ORDER
    .filter((id) => byId.has(id))
    .map((id) => ({ id, label: CATEGORY_LABELS[id], meds: byId.get(id) }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/data.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/categories.js js/data.js tests/data.test.js
git commit -m "feat: PRN category module and groupByCategory helper"
```

---

## Task 4: Curated PRN dataset

**Files:**
- Replace: `medications.json`
- Test: `tests/dataset.test.js` (create)

- [ ] **Step 1: Write the dataset sanity test**

Create `tests/dataset.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATEGORY_ORDER } from '../js/categories.js';

const meds = JSON.parse(await readFile(new URL('../medications.json', import.meta.url)));
const valid = new Set(CATEGORY_ORDER.filter((id) => id !== 'custom'));

test('every med has a known category and array of brands', () => {
  for (const m of meds) {
    assert.ok(m.generic, `missing generic: ${JSON.stringify(m)}`);
    assert.ok(valid.has(m.category), `bad category "${m.category}" on ${m.generic}`);
    assert.ok(Array.isArray(m.brands), `brands not array on ${m.generic}`);
  }
});

test('any dosing defaults present are positive numbers', () => {
  for (const m of meds) {
    if ('defaultIntervalHours' in m) assert.ok(m.defaultIntervalHours > 0, m.generic);
    if ('defaultMaxPerDay' in m) assert.ok(m.defaultMaxPerDay > 0, m.generic);
  }
});

test('any doseType present is prn or scheduled', () => {
  for (const m of meds) {
    if ('doseType' in m) assert.ok(m.doseType === 'prn' || m.doseType === 'scheduled', m.generic);
  }
});

test('dataset covers a broad set of PRN categories', () => {
  const present = new Set(meds.map((m) => m.category));
  assert.ok(present.size >= 14, `only ${present.size} categories present`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dataset.test.js`
Expected: FAIL — current `medications.json` entries have no `category`.

- [ ] **Step 3: Replace `medications.json` with the curated dataset**

Write the complete file below. `unit` is mg unless noted; `form` ∈ tablet/capsule/liquid/inhaler/cream/drops/spray/lozenge/sachet. All defaults are conservative, well-established starting points and are user-editable ("check your label"). Omit defaults where a single safe value doesn't apply.

```json
[
  {"generic":"Paracetamol","brands":["Panadol","Dymadon","Panamax"],"category":"pain-fever","strengths":[500],"unit":"mg","defaultIntervalHours":4,"defaultMaxPerDay":8,"form":"tablet"},
  {"generic":"Ibuprofen","brands":["Nurofen","Advil","Brufen"],"category":"pain-fever","strengths":[200,400],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":6,"form":"tablet"},
  {"generic":"Aspirin","brands":["Aspro","Disprin"],"category":"pain-fever","strengths":[300],"unit":"mg","defaultIntervalHours":4,"defaultMaxPerDay":8,"form":"tablet"},
  {"generic":"Naproxen","brands":["Naprogesic","Aleve","Naprosyn"],"category":"pain-fever","strengths":[250,275],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Diclofenac","brands":["Voltaren","Fenac"],"category":"pain-fever","strengths":[12.5,25,50],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Paracetamol with codeine","brands":["Panadeine","Panadeine Forte"],"category":"pain-fever","defaultIntervalHours":4,"defaultMaxPerDay":8,"form":"tablet"},
  {"generic":"Ibuprofen with codeine","brands":["Nurofen Plus"],"category":"pain-fever","defaultIntervalHours":6,"defaultMaxPerDay":6,"form":"tablet"},
  {"generic":"Diclofenac topical gel","brands":["Voltaren Emulgel"],"category":"pain-fever","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"cream"},
  {"generic":"Cetirizine","brands":["Zyrtec","Zilarex"],"category":"allergy","strengths":[10],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Loratadine","brands":["Claratyne"],"category":"allergy","strengths":[10],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Fexofenadine","brands":["Telfast","Fexotabs"],"category":"allergy","strengths":[60,120,180],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Desloratadine","brands":["Aerius"],"category":"allergy","strengths":[5],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Promethazine","brands":["Phenergan"],"category":"allergy","strengths":[10,25],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Dexchlorpheniramine","brands":["Polaramine"],"category":"allergy","strengths":[2],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Amoxicillin","brands":["Amoxil","Alphamox"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"capsule"},
  {"generic":"Amoxicillin with clavulanate","brands":["Augmentin","Augmentin Duo Forte"],"category":"antibiotic","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Cefalexin","brands":["Keflex","Ibilex"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"capsule"},
  {"generic":"Doxycycline","brands":["Doryx","Vibramycin"],"category":"antibiotic","strengths":[50,100],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"capsule"},
  {"generic":"Flucloxacillin","brands":["Flopen","Staphylex"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"capsule"},
  {"generic":"Trimethoprim","brands":["Triprim","Alprim"],"category":"antibiotic","strengths":[300],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Nitrofurantoin","brands":["Macrodantin","Macrobid"],"category":"antibiotic","strengths":[50,100],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"capsule"},
  {"generic":"Metronidazole","brands":["Flagyl","Metrogyl"],"category":"antibiotic","strengths":[200,400],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Azithromycin","brands":["Zithromax","Zedd"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Clarithromycin","brands":["Klacid"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Roxithromycin","brands":["Rulide"],"category":"antibiotic","strengths":[150,300],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Phenoxymethylpenicillin","brands":["Cilicaine VK","Abbocillin VK"],"category":"antibiotic","strengths":[250,500],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Ondansetron","brands":["Zofran","Ondaz"],"category":"nausea","strengths":[4,8],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Metoclopramide","brands":["Maxolon"],"category":"nausea","strengths":[10],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Prochlorperazine","brands":["Stemetil","Stemzine"],"category":"nausea","strengths":[5],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Domperidone","brands":["Motilium"],"category":"nausea","strengths":[10],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Hyoscine hydrobromide","brands":["Kwells","Travacalm"],"category":"nausea","strengths":[0.3],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Dimenhydrinate","brands":["Andrews Antinauseant"],"category":"nausea","strengths":[50],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Antacid (aluminium/magnesium)","brands":["Mylanta","Gaviscon"],"category":"reflux","defaultIntervalHours":4,"defaultMaxPerDay":4,"form":"liquid"},
  {"generic":"Calcium carbonate","brands":["Quick-Eze","Rennie"],"category":"reflux","defaultIntervalHours":2,"defaultMaxPerDay":6,"form":"tablet"},
  {"generic":"Famotidine","brands":["Pepcidine","Pepzan"],"category":"reflux","strengths":[20,40],"unit":"mg","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Omeprazole","brands":["Losec","Acimax"],"category":"reflux","strengths":[10,20],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet","doseType":"scheduled"},
  {"generic":"Pantoprazole","brands":["Somac"],"category":"reflux","strengths":[20,40],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet","doseType":"scheduled"},
  {"generic":"Esomeprazole","brands":["Nexium"],"category":"reflux","strengths":[20,40],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet","doseType":"scheduled"},
  {"generic":"Rabeprazole","brands":["Pariet"],"category":"reflux","strengths":[10,20],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet","doseType":"scheduled"},
  {"generic":"Pseudoephedrine","brands":["Sudafed","Demazin"],"category":"cough-cold","strengths":[60],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Phenylephrine","brands":["Sudafed PE"],"category":"cough-cold","strengths":[10],"unit":"mg","defaultIntervalHours":4,"defaultMaxPerDay":6,"form":"tablet"},
  {"generic":"Dextromethorphan","brands":["Robitussin Dry","Bisolvon Dry"],"category":"cough-cold","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"liquid"},
  {"generic":"Guaifenesin","brands":["Bisolvon Chesty","Mucinex"],"category":"cough-cold","defaultIntervalHours":4,"defaultMaxPerDay":4,"form":"liquid"},
  {"generic":"Bromhexine","brands":["Bisolvon"],"category":"cough-cold","strengths":[8],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Loperamide","brands":["Imodium","Gastro-Stop"],"category":"gut","strengths":[2],"unit":"mg","defaultIntervalHours":2,"defaultMaxPerDay":8,"form":"capsule"},
  {"generic":"Macrogol","brands":["Movicol","OsmoLax"],"category":"gut","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"sachet"},
  {"generic":"Senna","brands":["Senokot"],"category":"gut","strengths":[7.5],"unit":"mg","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Docusate","brands":["Coloxyl"],"category":"gut","strengths":[50,120],"unit":"mg","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Bisacodyl","brands":["Dulcolax"],"category":"gut","strengths":[5],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Lactulose","brands":["Duphalac","Actilax"],"category":"gut","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"liquid"},
  {"generic":"Psyllium","brands":["Metamucil"],"category":"gut","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"sachet"},
  {"generic":"Sumatriptan","brands":["Imigran"],"category":"migraine","strengths":[50,100],"unit":"mg","defaultIntervalHours":2,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Rizatriptan","brands":["Maxalt"],"category":"migraine","strengths":[10],"unit":"mg","defaultIntervalHours":2,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Zolmitriptan","brands":["Zomig"],"category":"migraine","strengths":[2.5],"unit":"mg","defaultIntervalHours":2,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Eletriptan","brands":["Relpax"],"category":"migraine","strengths":[40],"unit":"mg","defaultIntervalHours":2,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Naratriptan","brands":["Naramig"],"category":"migraine","strengths":[2.5],"unit":"mg","defaultIntervalHours":4,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Hyoscine butylbromide","brands":["Buscopan"],"category":"cramps","strengths":[10],"unit":"mg","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"tablet"},
  {"generic":"Mebeverine","brands":["Colofac"],"category":"cramps","strengths":[135],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Mefenamic acid","brands":["Ponstan"],"category":"cramps","strengths":[250,500],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"capsule"},
  {"generic":"Prednisolone","brands":["Panafcort","Redipred","Solone"],"category":"steroid-short","strengths":[1,5,25],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Prednisone","brands":["Sone"],"category":"steroid-short","strengths":[1,5,25],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Hydrocortisone 1% cream","brands":["Sigmacort","DermAid"],"category":"steroid-short","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"cream"},
  {"generic":"Betamethasone cream","brands":["Diprosone"],"category":"steroid-short","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"cream"},
  {"generic":"Mometasone cream","brands":["Elocon"],"category":"steroid-short","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"cream"},
  {"generic":"Melatonin","brands":["Circadin"],"category":"sleep","strengths":[2],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Doxylamine","brands":["Restavit","Dozile"],"category":"sleep","strengths":[25],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Temazepam","brands":["Temaze","Normison"],"category":"sleep","strengths":[10],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Zolpidem","brands":["Stilnox"],"category":"sleep","strengths":[5,10],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Zopiclone","brands":["Imovane","Imrest"],"category":"sleep","strengths":[7.5],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Fluconazole","brands":["Diflucan","Canesten Oral"],"category":"antifungal","strengths":[150,200],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"capsule"},
  {"generic":"Clotrimazole cream","brands":["Canesten"],"category":"antifungal","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"cream"},
  {"generic":"Terbinafine","brands":["Lamisil"],"category":"antifungal","strengths":[250],"unit":"mg","defaultIntervalHours":24,"defaultMaxPerDay":1,"form":"tablet"},
  {"generic":"Miconazole gel","brands":["Daktarin"],"category":"antifungal","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"cream"},
  {"generic":"Aciclovir","brands":["Zovirax","Acivir"],"category":"antiviral","strengths":[200,400,800],"unit":"mg","defaultIntervalHours":4,"defaultMaxPerDay":5,"form":"tablet"},
  {"generic":"Aciclovir cold sore cream","brands":["Zovirax Cold Sore"],"category":"antiviral","defaultIntervalHours":4,"defaultMaxPerDay":5,"form":"cream"},
  {"generic":"Valaciclovir","brands":["Valtrex"],"category":"antiviral","strengths":[500],"unit":"mg","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"tablet"},
  {"generic":"Famciclovir","brands":["Famvir"],"category":"antiviral","strengths":[125,250,500],"unit":"mg","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"tablet"},
  {"generic":"Salbutamol","brands":["Ventolin","Asmol","Airomir"],"category":"reliever","defaultIntervalHours":4,"defaultMaxPerDay":4,"form":"inhaler"},
  {"generic":"Terbutaline","brands":["Bricanyl"],"category":"reliever","defaultIntervalHours":4,"defaultMaxPerDay":4,"form":"inhaler"},
  {"generic":"Ipratropium","brands":["Atrovent"],"category":"reliever","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"inhaler"},
  {"generic":"Benzydamine","brands":["Difflam"],"category":"throat-mouth","defaultIntervalHours":3,"defaultMaxPerDay":7,"form":"spray"},
  {"generic":"Choline salicylate gel","brands":["Bonjela"],"category":"throat-mouth","defaultIntervalHours":3,"defaultMaxPerDay":6,"form":"cream"},
  {"generic":"Hexylresorcinol lozenge","brands":["Strepsils"],"category":"throat-mouth","defaultIntervalHours":2,"defaultMaxPerDay":8,"form":"lozenge"},
  {"generic":"Povidone-iodine gargle","brands":["Betadine Sore Throat"],"category":"throat-mouth","defaultIntervalHours":4,"defaultMaxPerDay":4,"form":"liquid"},
  {"generic":"Calamine lotion","brands":["Calamine"],"category":"skin","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"liquid"},
  {"generic":"Crotamiton cream","brands":["Eurax"],"category":"skin","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"cream"},
  {"generic":"Antiseptic cream","brands":["Savlon"],"category":"skin","defaultIntervalHours":8,"defaultMaxPerDay":3,"form":"cream"},
  {"generic":"Aluminium sulfate spray","brands":["Stingose"],"category":"skin","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"spray"},
  {"generic":"Lidocaine gel","brands":["Xylocaine"],"category":"skin","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"cream"},
  {"generic":"Citric acid / sodium citrate","brands":["Ural","Citravescent"],"category":"urinary","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"sachet"},
  {"generic":"Chloramphenicol eye drops","brands":["Chlorsig"],"category":"eye-ear","defaultIntervalHours":4,"defaultMaxPerDay":6,"form":"drops","doseType":"scheduled"},
  {"generic":"Ketotifen eye drops","brands":["Zaditen"],"category":"eye-ear","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"drops"},
  {"generic":"Olopatadine eye drops","brands":["Patanol"],"category":"eye-ear","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"drops"},
  {"generic":"Naphazoline/pheniramine eye drops","brands":["Naphcon-A","Visine Allergy"],"category":"eye-ear","defaultIntervalHours":6,"defaultMaxPerDay":4,"form":"drops"},
  {"generic":"Carbamide peroxide ear drops","brands":["Ear Clear"],"category":"eye-ear","defaultIntervalHours":12,"defaultMaxPerDay":2,"form":"drops"}
]
```

- [ ] **Step 4: Run the dataset + data tests to verify they pass**

Run: `node --test tests/dataset.test.js tests/data.test.js`
Expected: PASS — valid categories, positive defaults, ≥14 categories present.

- [ ] **Step 5: Commit**

```bash
git add medications.json tests/dataset.test.js
git commit -m "feat: curated PRN/short-term medication dataset with categories + defaults"
```

---

## Task 5: Bold Dark theme

**Files:**
- Replace: `css/styles.css`
- Modify: `index.html:6` (theme-color)

- [ ] **Step 1: Replace `css/styles.css` with the dark theme**

```css
:root {
  --bg: #0b1220;
  --field: #0f172a;
  --surface: #1e293b;
  --line: #334155;
  --accent: #22d3ee;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --ready: #4ade80;
  --wait: #fbbf24;
  --max: #f87171;
  --radius: 16px;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; background: var(--field); border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 5;
}
.app-header h1 { font-size: 1.15rem; margin: 0; letter-spacing: 0.2px; color: #f8fafc; }
.icon-btn {
  width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line);
  background: var(--surface); color: var(--accent); font-weight: 700; cursor: pointer;
}
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 14px; }
@media (min-width: 620px) { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 900px) { .grid { grid-template-columns: repeat(4, 1fr); } }
.tile {
  background: var(--surface); border-radius: var(--radius); border: 1px solid var(--line);
  padding: 14px; min-height: 120px; display: flex; flex-direction: column; justify-content: space-between;
  cursor: pointer; user-select: none; -webkit-user-select: none; text-align: left; font: inherit; color: inherit;
}
.tile h2 { font-size: 1rem; margin: 0 0 4px; color: #f1f5f9; }
.tile .dose-label { color: var(--muted); font-size: 0.78rem; }
.tile .last { color: #cbd5e1; font-size: 0.74rem; margin-top: 6px; }
.status {
  display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700;
  margin-top: 10px; padding: 5px 10px; border-radius: 999px; align-self: flex-start;
}
.status.ready { color: var(--ready); background: rgba(74,222,128,.16); box-shadow: 0 0 0 1px rgba(74,222,128,.4); }
.status.wait  { color: var(--wait);  background: rgba(251,191,36,.16); box-shadow: 0 0 0 1px rgba(251,191,36,.4); }
.status.daily_max { color: var(--max); background: rgba(248,113,113,.18); box-shadow: 0 0 0 1px rgba(248,113,113,.4); }
.status.wait .count { font-size: 1.05rem; }
.tile.add {
  align-items: center; justify-content: center; color: var(--accent);
  border: 2px dashed var(--line); background: transparent; font-size: 1rem;
}
.disclaimer { color: var(--muted); font-size: 0.72rem; text-align: center; padding: 4px 16px 20px; }
/* Modal / sheet */
.scrim { position: fixed; inset: 0; background: rgba(2,6,23,.6); display: flex; align-items: flex-end; justify-content: center; z-index: 20; }
.sheet {
  background: var(--field); color: var(--text); width: 100%; max-width: 520px; border-radius: 16px 16px 0 0;
  padding: 20px; border: 1px solid var(--line); max-height: 88vh; overflow-y: auto;
}
@media (min-width: 620px) { .scrim { align-items: center; } .sheet { border-radius: 16px; } }
.sheet h2 { margin-top: 0; color: #f8fafc; }
.btn-row { display: flex; gap: 10px; margin-top: 14px; }
.btn {
  flex: 1; padding: 14px; border-radius: 12px; border: none; font-size: 1rem; cursor: pointer;
  background: var(--accent); color: #06222a; font-weight: 700; min-height: 44px;
}
.btn.secondary { background: var(--surface); color: var(--text); border: 1px solid var(--line); }
.btn.danger { background: var(--max); color: #2a0a0a; }
.field { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
.field label { font-size: 0.8rem; color: var(--muted); }
.field input, .field select {
  padding: 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 1rem;
  background: var(--surface); color: var(--text);
}
.list { list-style: none; margin: 12px 0 0; padding: 0; }
.list li { padding: 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.list li.cat { color: var(--muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: .05em; border: none; padding: 14px 2px 4px; }
.muted { color: var(--muted); font-size: 0.85rem; }
/* 14-day history graph */
.hist-toggle { display: flex; gap: 8px; margin: 4px 0 12px; }
.hist-toggle button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); cursor: pointer; }
.hist-toggle button.active { color: var(--accent); border-color: var(--accent); }
.bars { display: flex; align-items: flex-end; gap: 4px; height: 130px; position: relative; padding-top: 12px; border-bottom: 1px solid var(--line); }
.bars .maxline { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--max); }
.bars .maxlbl { position: absolute; right: 0; font-size: 10px; color: var(--max); transform: translateY(-12px); }
.bar { flex: 1; min-height: 2px; border-radius: 4px 4px 0 0; background: var(--ready); }
.bar.amber { background: var(--wait); } .bar.red { background: var(--max); }
.bars-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); margin-top: 6px; }
/* Landing page */
.landing { padding: 8px 4px 4px; }
.landing .hero { font-size: 1.7rem; line-height: 1.18; font-weight: 800; margin: 8px 0 12px; color: #f8fafc; }
.landing .hero em { color: var(--accent); font-style: normal; }
.landing .lead { color: var(--muted); font-size: 0.98rem; line-height: 1.5; }
.landing .pt { display: flex; gap: 12px; align-items: flex-start; margin-top: 14px; }
.landing .pt .ic { font-size: 18px; width: 34px; height: 34px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--surface); border-radius: 10px; }
.landing .pt b { color: #f1f5f9; } .landing .pt span { color: var(--muted); font-size: 0.85rem; display: block; }
.landing .disc { font-size: 0.72rem; line-height: 1.5; color: var(--muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 18px; }
.landing .dismiss { display: flex; align-items: center; gap: 8px; margin-top: 16px; color: var(--muted); font-size: 0.85rem; cursor: pointer; }
.landing .dismiss input { width: 18px; height: 18px; accent-color: var(--accent); }
```

- [ ] **Step 2: Update `index.html` theme-color**

Change line 6 to:

```html
  <meta name="theme-color" content="#0b1220" />
```

- [ ] **Step 3: Verify visually**

Run: `python -m http.server 8000` (from repo root), open `http://localhost:8000`.
Expected: dark UI; existing tiles render on dark theme without console errors. (Tiles refine in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add css/styles.css index.html
git commit -m "feat: Bold Dark theme"
```

---

## Task 6: Dose-type helper + redesigned tile (big countdown, last-taken, PRN/scheduled wording)

Medications fall into two models: **PRN / as-needed** (the interval is a minimum safe gap — you *may* redose if needed) and **scheduled / course** (the interval is a target schedule — you're *due* to take it). The tile wording differs per model.

**Files:**
- Modify: `js/categories.js` (add `SCHEDULED_CATEGORIES` + `resolveDoseType`)
- Modify: `js/ui.js` (`fmtLastTaken`, `renderGrid`, add categories import)
- Test: `tests/data.test.js` (add `resolveDoseType` cases)

- [ ] **Step 1: Add the dose-type helper to `js/categories.js` (TDD)**

Append this test to `tests/data.test.js` (add the import near the other imports):

```javascript
import { resolveDoseType } from '../js/categories.js';

test('resolveDoseType: explicit doseType wins, else category default, else prn', () => {
  assert.equal(resolveDoseType({ category: 'antibiotic' }), 'scheduled');
  assert.equal(resolveDoseType({ category: 'pain-fever' }), 'prn');
  assert.equal(resolveDoseType({ category: 'reflux', doseType: 'scheduled' }), 'scheduled');
  assert.equal(resolveDoseType({ category: 'antibiotic', doseType: 'prn' }), 'prn');
  assert.equal(resolveDoseType({}), 'prn');
});
```

Run `node --test tests/data.test.js` → FAIL (`resolveDoseType` not exported). Then append to `js/categories.js`:

```javascript
// Categories whose meds are taken on a schedule/course by default (vs as-needed).
export const SCHEDULED_CATEGORIES = new Set(['antibiotic', 'steroid-short', 'antiviral', 'antifungal']);

// Effective dosing model: explicit med.doseType wins, else category default, else 'prn'.
export function resolveDoseType(med) {
  if (med && (med.doseType === 'prn' || med.doseType === 'scheduled')) return med.doseType;
  return med && SCHEDULED_CATEGORIES.has(med.category) ? 'scheduled' : 'prn';
}
```

Run `node --test tests/data.test.js` → PASS.

- [ ] **Step 2: Import `resolveDoseType` in `js/ui.js`**

Add this import near the top of `js/ui.js` (with the other local imports):

```javascript
import { resolveDoseType } from './categories.js';
```

- [ ] **Step 3: Update `fmtLastTaken` to the short "Last taken" form**

Replace `fmtLastTaken` in `js/ui.js`:

```javascript
function fmtLastTaken(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const when = sameDay ? fmtTime(ts) : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return `🕑 Last taken ${when}`;
}
```

- [ ] **Step 4: Update the tile markup in `renderGrid` (dose-type-aware wording)**

Replace the tile-building block (the `statusText` + `tile.innerHTML` assignment) with:

```javascript
    const lastLine = fmtLastTaken(s.lastDoseTime);
    const scheduled = resolveDoseType(med) === 'scheduled';
    const count = `<span class="count">${fmtRemaining(s.msRemaining)}</span>`;
    const statusInner =
      s.state === 'ready' ? (scheduled ? 'Due to take' : 'Ready when needed')
      : s.state === 'wait' ? (scheduled ? `Due in&nbsp;${count}` : `${count}&nbsp;until next`)
      : (scheduled ? 'Done for today' : 'Daily max');
    tile.innerHTML =
      `<div><h2>${med.name}</h2>` +
      `<div class="dose-label">${med.strength ? med.strength + ' · ' : ''}max ${med.maxDailyUnits}/day</div>` +
      (lastLine ? `<div class="last">${lastLine}</div>` : '') +
      `</div>` +
      `<div class="status ${s.state}">${statusInner}</div>`;
```

- [ ] **Step 5: Verify visually**

Reload `http://localhost:8000`. Add a PRN med (e.g. Ibuprofen) and a scheduled med (e.g. Amoxicillin), log a dose of each.
Expected: PRN tile shows green "Ready when needed", amber "<countdown> until next", or red "Daily max". Scheduled tile shows green "Due to take", amber "Due in <countdown>", or red "Done for today". Both show `🕑 Last taken …`. Countdown updates within 30s.

- [ ] **Step 6: Run the full suite (no regressions)**

Run: `node --test`
Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add js/categories.js js/ui.js tests/data.test.js
git commit -m "feat: dose-type helper + dark tile with PRN/scheduled wording and last-taken"
```

---

## Task 7: Picker — category grouping + custom free-text add

**Files:**
- Modify: `js/ui.js` (`openPicker`, `openConfigForm`, add `openCustomForm`)

- [ ] **Step 1: Import the grouping helper**

In `js/ui.js`, update the data import line to:

```javascript
import { loadDataset, searchMeds, groupByCategory } from './data.js';
```

- [ ] **Step 2: Rewrite `openPicker` to group results and offer a custom add**

Replace `openPicker` with:

```javascript
async function openPicker() {
  const dataset = await loadDataset();
  openSheet(
    `<h2>Add medication</h2>` +
    `<div class="field"><label>Search</label><input id="med-search" placeholder="Generic or brand name" /></div>` +
    `<ul class="list" id="med-results"></ul>` +
    `<div class="btn-row"><button class="btn secondary" id="add-custom">+ Add a medication not listed</button></div>`
  );
  const input = modalRoot().querySelector('#med-search');
  const results = modalRoot().querySelector('#med-results');
  const render = () => {
    const matches = searchMeds(input.value, dataset).slice(0, 80);
    const groups = groupByCategory(matches);
    results.innerHTML = groups.map((g) =>
      `<li class="cat">${g.label}</li>` +
      g.meds.map((m) =>
        `<li data-gen="${m.generic}"><span>${m.generic}</span>` +
        `<span class="muted">${(m.brands || []).join(', ')}</span></li>`).join('')
    ).join('') || `<li class="muted">No matches — use “Add a medication not listed”.</li>`;
    results.querySelectorAll('li[data-gen]').forEach((li) =>
      li.addEventListener('click', () =>
        openConfigForm(matches.find((m) => m.generic === li.dataset.gen))));
  };
  input.addEventListener('input', render);
  modalRoot().querySelector('#add-custom').addEventListener('click', () => openCustomForm());
  render();
  input.focus();
}
```

- [ ] **Step 3: Add a "When do you take it?" selector to the shared dosing form**

In `dosingFieldsHtml(med, cur)`, append a dose-type select to the returned markup so every add/edit/custom form carries it. Change the function's final `return (...)` so the concatenation also includes this field (insert it before the closing of the returned string):

```javascript
  const curType = cur.doseType || 'prn';
  const doseTypeField =
    `<div class="field"><label>When do you take it?</label>` +
    `<select id="f-dosetype">` +
    `<option value="prn"${curType === 'prn' ? ' selected' : ''}>As needed (PRN)</option>` +
    `<option value="scheduled"${curType === 'scheduled' ? ' selected' : ''}>Scheduled / course</option>` +
    `</select></div>`;
```

Add `doseTypeField` to the returned string (e.g. append `+ doseTypeField` after the max-tablets field). Then in `readDosingFields(med)`, add `doseType` to the returned object:

```javascript
    doseType: modalRoot().querySelector('#f-dosetype')?.value === 'scheduled' ? 'scheduled' : 'prn',
```

- [ ] **Step 4: Seed defaults + dose-type in `openConfigForm`**

In `openConfigForm`, replace the `dosingFieldsHtml(picked, {})` call with one that pre-fills the dataset defaults and the resolved dose-type:

```javascript
    dosingFieldsHtml(picked, {
      intervalHours: picked.defaultIntervalHours,
      maxDailyUnits: picked.defaultMaxPerDay,
      doseType: resolveDoseType(picked),
    }) +
```

And in the `meds.push({...})` object add both the category and the chosen dose-type:

```javascript
      category: picked.category || 'custom',
      doseType: vals.doseType,
```

- [ ] **Step 5: Carry dose-type through `openEditMed`**

In `openEditMed`, update the `dosingFieldsHtml(med, {...})` call to also seed the current dose-type, and persist it on save. Change the `dosingFieldsHtml` call's `cur` object to include:

```javascript
      doseType: resolveDoseType(med),
```

and in the save handler (where `m.intervalHours`/`m.maxDailyUnits` are assigned) add:

```javascript
      m.doseType = vals.doseType;
```

- [ ] **Step 6: Add `openCustomForm` for free-text meds**

Add after `openConfigForm`:

```javascript
function openCustomForm() {
  const picked = { generic: '', brands: [], category: 'custom' };
  openSheet(
    `<h2>Custom medication</h2>` +
    `<div class="field"><label>Name</label><input id="f-name" placeholder="Medication name" /></div>` +
    dosingFieldsHtml(picked, {}) +
    `<div class="btn-row"><button class="btn secondary" id="cancel">Cancel</button><button class="btn" id="save">Save</button></div>`
  );
  modalRoot().querySelector('#cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const name = modalRoot().querySelector('#f-name').value.trim();
    if (!name) return;
    const meds = loadMeds();
    const vals = readDosingFields(picked);
    meds.push({
      id: uuid(), name, brands: [], strength: vals.strength,
      strengths: null, unit: null, maxPerDay: null, category: 'custom',
      doseType: vals.doseType,
      intervalHours: vals.intervalHours, maxDailyUnits: vals.maxDailyUnits, order: meds.length,
    });
    saveMeds(meds);
    closeModal();
    renderGrid();
  });
}
```

- [ ] **Step 7: Verify visually**

Reload. Open Add medication: results show category headings (Pain & fever, Allergy, …). Search "nurofen" → Ibuprofen under Pain & fever; picking it pre-fills 6h / 6 per day and the selector shows **As needed (PRN)**. Search "amoxil" → Amoxicillin pre-fills with **Scheduled / course** selected. "Add a medication not listed" → type a name → defaults to As needed → saves a tile. Edit a med → the selector reflects its stored dose-type and saving keeps it.

- [ ] **Step 8: Run the full suite + commit**

Run: `node --test` → PASS.

```bash
git add js/ui.js
git commit -m "feat: category-grouped picker, custom add, seeded defaults, dose-type selector"
```

---

## Task 8: 14-day history with graph default + list toggle

**Files:**
- Modify: `js/ui.js` (`openHistory`), import `dailyDoseTotals`

- [ ] **Step 1: Import the aggregator**

Update the dosing import in `js/ui.js`:

```javascript
import { computeStatus, dailyDoseTotals } from './dosing.js';
```

- [ ] **Step 2: Rewrite `openHistory` with a graph (default) and list toggle**

Replace the whole `openHistory` function with:

```javascript
function openHistory(med, view = 'graph') {
  const now = Date.now();
  const sheetBody = view === 'graph' ? historyGraphHtml(med, now) : historyListHtml(med, now);
  openSheet(
    `<h2>${med.name} — last 14 days</h2>` +
    `<div class="hist-toggle">` +
      `<button data-v="graph" class="${view === 'graph' ? 'active' : ''}">Graph</button>` +
      `<button data-v="list" class="${view === 'list' ? 'active' : ''}">List</button>` +
    `</div>` +
    `<div id="hist-body">${sheetBody}</div>` +
    `<div class="btn-row"><button class="btn secondary" id="close">Close</button></div>`
  );
  modalRoot().querySelector('#close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('.hist-toggle button').forEach((b) =>
    b.addEventListener('click', () => openHistory(med, b.dataset.v)));
  if (view === 'list') wireHistoryList(med);
}

function historyGraphHtml(med, now) {
  const buckets = dailyDoseTotals(loadDoses(), med.id, now, 14);
  const max = med.maxDailyUnits || 0;
  const peak = Math.max(max, ...buckets.map((b) => b.units), 1);
  const maxPct = max > 0 ? (max / peak) * 100 : null;
  const bars = buckets.map((b) => {
    const h = Math.round((b.units / peak) * 100);
    const cls = max && b.units >= max ? 'red' : max && b.units >= max * 0.75 ? 'amber' : '';
    return `<div class="bar ${cls}" style="height:${h}%" title="${b.units} on ${new Date(b.dayStart).toLocaleDateString()}"></div>`;
  }).join('');
  const maxline = maxPct != null
    ? `<div class="maxline" style="bottom:${maxPct}%"></div><div class="maxlbl" style="bottom:${maxPct}%">max ${max}</div>` : '';
  return `<div class="bars">${maxline}${bars}</div>` +
    `<div class="bars-axis"><span>2 wks ago</span><span>today</span></div>`;
}

function historyListHtml(med, now) {
  const entries = loadDoses()
    .filter((d) => d.medId === med.id)
    .sort((a, b) => b.timestamp - a.timestamp);
  if (!entries.length) return `<ul class="list"><li class="muted">No doses in the last 14 days.</li></ul>`;
  return `<ul class="list">` + entries.map((d) =>
    `<li data-id="${d.id}">` +
    `<span>${new Date(d.timestamp).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${d.units} tab${d.units === 1 ? '' : 's'}</span>` +
    `<span><button class="btn secondary" data-act="edit">Edit</button> ` +
    `<button class="btn danger" data-act="del">Del</button></span></li>`).join('') + `</ul>`;
}

function wireHistoryList(med) {
  modalRoot().querySelectorAll('li[data-id]').forEach((li) => {
    const id = li.dataset.id;
    li.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      if (!confirm('Delete this dose entry?')) return;
      saveDoses(loadDoses().filter((d) => d.id !== id));
      openHistory(med, 'list');
      renderGrid();
    });
    li.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      const entry = loadDoses().find((d) => d.id === id);
      const current = new Date(entry.timestamp);
      const val = prompt('New time (HH:MM, same day):', `${String(current.getHours()).padStart(2,'0')}:${String(current.getMinutes()).padStart(2,'0')}`);
      if (!val) return;
      const [h, m] = val.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const d = new Date(entry.timestamp); d.setHours(h, m, 0, 0);
      const doses = loadDoses();
      doses.find((x) => x.id === id).timestamp = d.getTime();
      saveDoses(doses);
      openHistory(med, 'list');
      renderGrid();
    });
  });
}
```

- [ ] **Step 3: Verify visually**

Reload. Log several doses for a med across the day. Long-press its tile (or Dose sheet → History).
Expected: Graph shows by default — bars over 14 days, dashed "max N" line, bars amber near / red at the limit. Toggle to List → chronological entries; edit a time and delete one → graph + tile recompute.

- [ ] **Step 4: Run the full suite + commit**

Run: `node --test` → PASS.

```bash
git add js/ui.js
git commit -m "feat: 14-day history with daily-bars graph default and list toggle"
```

---

## Task 9: Landing page (first-launch + menu)

**Files:**
- Modify: `js/ui.js` (replace `showAbout` with `showLanding`), `js/app.js`, `index.html`

- [ ] **Step 1: Replace `showAbout` with `showLanding` in `js/ui.js`**

`showLanding` accepts an options object. When `showDismiss` is true (auto-shown on
launch) it renders a "Don't show this again" checkbox; ticking it and pressing
"Get started" calls `onDismiss`. Opened from the `?` button (no options), the checkbox
is hidden and it's purely informational.

```javascript
export function showLanding(opts = {}) {
  const dismissRow = opts.showDismiss
    ? `<label class="dismiss"><input type="checkbox" id="land-dismiss" /> Don't show this again</label>`
    : '';
  openSheet(
    `<div class="landing">` +
    `<div class="hero">Know when you <em>can</em>,<br>not when you <em>should</em>.</div>` +
    `<p class="lead">DoseGrid tracks your as-needed and short-course medicines and shows when ` +
    `enough time has passed — or when you've reached the daily limit. It never tells you to take anything.</p>` +
    `<div class="pt"><div class="ic">⏱</div><div><b>See the wait</b>` +
      `<span>Each dose starts a countdown to when the next one is allowed.</span></div></div>` +
    `<div class="pt"><div class="ic">🛑</div><div><b>Respect the max</b>` +
      `<span>Tiles turn red once you've hit the safe daily limit.</span></div></div>` +
    `<div class="pt"><div class="ic">🔒</div><div><b>Stays on your phone</b>` +
      `<span>No account, no cloud — your data never leaves the device.</span></div></div>` +
    dismissRow +
    `<div class="btn-row"><button class="btn" id="land-start">Get started →</button></div>` +
    `<p class="disc"><strong>Not medical advice.</strong> DoseGrid is a personal tracking tool. ` +
    `Always follow the directions on your medicine label or the advice of your doctor or pharmacist. ` +
    `Never exceed the stated dose. In an emergency, call <strong>000</strong>.</p>` +
    `</div>`
  );
  modalRoot().querySelector('#land-start').addEventListener('click', () => {
    const cb = modalRoot().querySelector('#land-dismiss');
    if (cb && cb.checked && typeof opts.onDismiss === 'function') opts.onDismiss();
    closeModal();
  });
}
```

- [ ] **Step 2: Wire first-launch gate + menu in `js/app.js`**

Replace the body of `js/app.js` with:

```javascript
// js/app.js
import { loadDoses, saveDoses, pruneDoses } from './storage.js';
import { renderGrid, showLanding } from './ui.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Prune doses older than 14 days on startup
saveDoses(pruneDoses(loadDoses()));

renderGrid();

// Auto-show the landing page on launch until the user ticks "Don't show this again"
if (!localStorage.getItem(ONBOARD_KEY)) {
  showLanding({ showDismiss: true, onDismiss: () => localStorage.setItem(ONBOARD_KEY, '1') });
}

// Header button reopens the landing page any time (informational, no checkbox)
document.getElementById('about-btn').addEventListener('click', () => showLanding());

// Keep countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderGrid(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
```

- [ ] **Step 3: Update the header button label/aria in `index.html`**

Replace the header button (line 14) with:

```html
    <button id="about-btn" class="icon-btn" aria-label="About / How it works">?</button>
```

- [ ] **Step 4: Verify visually**

Clear site data (DevTools → Application → Clear storage) and reload.
Expected: landing page appears on load with a "Don't show this again" checkbox. "Get started" *without* ticking → it appears again on next reload. Tick the box then "Get started" → it does NOT appear on subsequent reloads. The header `?` reopens it any time (no checkbox shown).

- [ ] **Step 5: Run the full suite + commit**

Run: `node --test` → PASS.

```bash
git add js/ui.js js/app.js index.html
git commit -m "feat: landing page with first-launch gate and menu access"
```

---

## Task 10: Service worker cache bump + README + final verification

**Files:**
- Modify: `service-worker.js` (cache name + ensure `categories.js` cached), `README.md`

- [ ] **Step 1: Bump the cache name and precache the new module**

In `service-worker.js`: change `const CACHE = 'dosegrid-v2';` to `const CACHE = 'dosegrid-v3';`, and add `'./js/categories.js'` to the `ASSETS` array (after `'./js/data.js'`). `medications.json` is already listed. (Network-first already auto-refreshes, but the bump clears stale precaches and adds the new module for offline.)

- [ ] **Step 2: Update `README.md` test checklist**

Update the manual checklist section to reflect: dark theme, category-grouped picker + custom add, 14-day graph/list history, landing page on first launch. (Edit the existing checklist bullets to match.)

- [ ] **Step 3: Run the full test suite**

Run: `node --test`
Expected: PASS — all dosing, storage, data, and dataset tests green.

- [ ] **Step 4: Full manual smoke test**

Serve (`python -m http.server 8000`) and walk the spec's manual checklist:
add a curated med (brand + generic search, grouped); add a custom med; log doses → amber countdown ticks; hit daily max → red; long-press → 14-day bar graph, toggle to list, edit + delete recompute; first-launch landing shows once; `?` reopens it; reload offline still loads.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: bump SW cache for PRN redesign; update README checklist"
```

---

## Self-Review (author check vs spec)

- **Curated PRN dataset + categories** → Tasks 3, 4 (18 categories incl. custom; ~95 entries; AU naming; confident defaults; sanity test).
- **Free-text custom fallback** → Task 7 (`openCustomForm`, `category: 'custom'`).
- **Bold Dark theme** → Task 5.
- **PRN vs scheduled dose-type** → `resolveDoseType` + `SCHEDULED_CATEGORIES` (Task 6), dataset `doseType` outliers (Task 4: PPIs, chloramphenicol), form selector (Task 7). Tile wording: PRN = "Ready when needed" / "<cd> until next" / "Daily max"; scheduled = "Due to take" / "Due in <cd>" / "Done for today".
- **Tile + last-taken** → Task 6 (big countdown, `🕑 Last taken …`).
- **14-day history, graph default + list** → Tasks 1 (prune), 2 (`dailyDoseTotals`), 8 (graph/list, edit/delete preserved).
- **Landing page, first-launch + menu** → Task 9 (`showLanding`, `dosegrid.onboarded`, `?` button).
- **No new dependencies; PWA cache refresh** → Task 10.

Type/name consistency: `dailyDoseTotals` (defined Task 2, used Task 8), `groupByCategory` (Task 3 → Task 7), `CATEGORY_ORDER`/`CATEGORY_LABELS` (Task 3 → used in `data.js`/`dataset.test.js`), med field `category` written in Tasks 4/7 and read in Task 7 picker. `defaultIntervalHours`/`defaultMaxPerDay` written in Task 4, consumed in Task 7 to seed `intervalHours`/`maxDailyUnits`.
