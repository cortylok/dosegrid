# Combo Per-Ingredient Strengths + Product Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combination meds capture a labelled strength per active ingredient (pre-filled from a chosen product variant, editable), single meds get expanded strength dropdowns, and the per-ingredient values feed the cross-med overdose tally.

**Architecture:** `medications.json` gains `kind:"combo"` + `ingredients[]` + `variants[]` on 10 tablet combos. `js/data.js` adds `pickerItems`/`recipeText` to expand combos into per-variant picker rows. `js/ui.js` renders a per-ingredient strength form for combos and persists `components` on save (fixing the currently-inert tally). `js/ingredients.js` is unchanged.

**Tech Stack:** Vanilla ES modules, JSON dataset, `node --test`. No build step.

---

### Task 1: Transform medications.json (combo data + single strengths + Panadol Extra)

**Files:**
- Modify: `medications.json` (via one-off script)
- Test: `tests/combo-data.test.js` (new)

- [ ] **Step 1: Write the failing integrity test**

Create `tests/combo-data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INGREDIENT_LIMITS } from '../js/ingredients.js';

const meds = JSON.parse(await readFile(new URL('../medications.json', import.meta.url)));
const combos = meds.filter((m) => m.kind === 'combo');

test('every combo has ingredients + variants that line up', () => {
  assert.ok(combos.length >= 10, `only ${combos.length} combos`);
  for (const m of combos) {
    assert.ok(Array.isArray(m.ingredients) && m.ingredients.length >= 2, `${m.generic} ingredients`);
    assert.ok(Array.isArray(m.variants) && m.variants.length >= 1, `${m.generic} variants`);
    const keys = m.ingredients.map((i) => i.key);
    for (const ing of m.ingredients) {
      assert.ok(ing.name && ing.key, `${m.generic} ingredient name/key`);
      assert.ok(Array.isArray(ing.strengths) && ing.strengths.length, `${m.generic}/${ing.key} strengths`);
      if (ing.tallied) assert.ok(INGREDIENT_LIMITS[ing.key], `${ing.key} tallied but no limit`);
    }
    for (const v of m.variants) {
      for (const k of keys) assert.ok(typeof v.mg[k] === 'number', `${m.generic}/${v.name} missing ${k}`);
    }
  }
});

test('Panadol Extra (paracetamol + caffeine) exists', () => {
  const m = meds.find((x) => x.generic === 'Paracetamol; Caffeine');
  assert.ok(m, 'Paracetamol; Caffeine missing');
  assert.ok(m.variants.some((v) => v.name === 'Panadol Extra'));
  assert.ok(m.ingredients.find((i) => i.key === 'paracetamol')?.tallied);
});

test('single-ingredient strength dropdowns expanded', () => {
  const para = meds.find((m) => m.generic === 'Paracetamol');
  assert.ok(para.strengths.includes(665));
  assert.ok(meds.find((m) => m.generic === 'Aspirin').strengths.includes(100));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/combo-data.test.js`
Expected: FAIL — no combos have `kind:"combo"` yet.

- [ ] **Step 3: Write and run the one-off transform script**

Create `scripts/_combo-migrate.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
const meds = JSON.parse(await readFile('./medications.json'));

const COMBOS = {
  'Paracetamol; Codeine': {
    ingredients: [
      { name: 'Paracetamol', key: 'paracetamol', unit: 'mg', strengths: [500, 450, 665], tallied: true },
      { name: 'Codeine', key: 'codeine', unit: 'mg', strengths: [8, 9.75, 12.8, 15, 30] },
    ],
    variants: [
      { name: 'Panadeine', mg: { paracetamol: 500, codeine: 15 } },
      { name: 'Panamax Co', mg: { paracetamol: 500, codeine: 8 } },
      { name: 'Panadeine Forte', mg: { paracetamol: 500, codeine: 30 } },
      { name: 'Mersyndol', mg: { paracetamol: 450, codeine: 9.75 } },
      { name: 'Mersyndol Forte', mg: { paracetamol: 450, codeine: 30 } },
    ],
  },
  'Ibuprofen; Codeine': {
    ingredients: [
      { name: 'Ibuprofen', key: 'ibuprofen', unit: 'mg', strengths: [200, 400], tallied: true },
      { name: 'Codeine', key: 'codeine', unit: 'mg', strengths: [12.8, 30] },
    ],
    variants: [{ name: 'Nurofen Plus', mg: { ibuprofen: 200, codeine: 12.8 } }],
  },
  'Orphenadrine; Paracetamol': {
    ingredients: [
      { name: 'Orphenadrine', key: 'orphenadrine', unit: 'mg', strengths: [35] },
      { name: 'Paracetamol', key: 'paracetamol', unit: 'mg', strengths: [450, 500], tallied: true },
    ],
    variants: [{ name: 'Norgesic', mg: { orphenadrine: 35, paracetamol: 450 } }],
  },
  'Codeine; Pseudoephedrine; Paracetamol': {
    ingredients: [
      { name: 'Codeine', key: 'codeine', unit: 'mg', strengths: [9.5] },
      { name: 'Pseudoephedrine', key: 'pseudoephedrine', unit: 'mg', strengths: [30] },
      { name: 'Paracetamol', key: 'paracetamol', unit: 'mg', strengths: [500], tallied: true },
    ],
    variants: [{ name: 'Codral Cold & Flu', mg: { codeine: 9.5, pseudoephedrine: 30, paracetamol: 500 } }],
  },
  'Oxycodone; Naloxone': {
    ingredients: [
      { name: 'Oxycodone', key: 'oxycodone', unit: 'mg', strengths: [5, 10, 20, 40] },
      { name: 'Naloxone', key: 'naloxone', unit: 'mg', strengths: [2.5, 5, 10, 20] },
    ],
    variants: [
      { name: 'Targin 5/2.5', mg: { oxycodone: 5, naloxone: 2.5 } },
      { name: 'Targin 10/5', mg: { oxycodone: 10, naloxone: 5 } },
      { name: 'Targin 20/10', mg: { oxycodone: 20, naloxone: 10 } },
      { name: 'Targin 40/20', mg: { oxycodone: 40, naloxone: 20 } },
    ],
  },
  'Buprenorphine; Naloxone': {
    ingredients: [
      { name: 'Buprenorphine', key: 'buprenorphine', unit: 'mg', strengths: [2, 8, 12, 16] },
      { name: 'Naloxone', key: 'naloxone', unit: 'mg', strengths: [0.5, 2, 3, 4] },
    ],
    variants: [
      { name: 'Suboxone 2/0.5', mg: { buprenorphine: 2, naloxone: 0.5 } },
      { name: 'Suboxone 8/2', mg: { buprenorphine: 8, naloxone: 2 } },
      { name: 'Suboxone 12/3', mg: { buprenorphine: 12, naloxone: 3 } },
      { name: 'Suboxone 16/4', mg: { buprenorphine: 16, naloxone: 4 } },
    ],
  },
  'Ergotamine; Caffeine': {
    ingredients: [
      { name: 'Ergotamine', key: 'ergotamine', unit: 'mg', strengths: [1] },
      { name: 'Caffeine', key: 'caffeine', unit: 'mg', strengths: [100] },
    ],
    variants: [{ name: 'Cafergot', mg: { ergotamine: 1, caffeine: 100 } }],
  },
  'Amoxicillin with clavulanate': {
    ingredients: [
      { name: 'Amoxicillin', key: 'amoxicillin', unit: 'mg', strengths: [500, 875] },
      { name: 'Clavulanate', key: 'clavulanate', unit: 'mg', strengths: [125] },
    ],
    variants: [
      { name: 'Augmentin', mg: { amoxicillin: 500, clavulanate: 125 } },
      { name: 'Augmentin Duo Forte', mg: { amoxicillin: 875, clavulanate: 125 } },
    ],
  },
  'Trimethoprim; Sulfamethoxazole': {
    ingredients: [
      { name: 'Trimethoprim', key: 'trimethoprim', unit: 'mg', strengths: [80, 160] },
      { name: 'Sulfamethoxazole', key: 'sulfamethoxazole', unit: 'mg', strengths: [400, 800] },
    ],
    variants: [
      { name: 'Bactrim', mg: { trimethoprim: 80, sulfamethoxazole: 400 } },
      { name: 'Bactrim DS', mg: { trimethoprim: 160, sulfamethoxazole: 800 } },
    ],
  },
};

const SINGLE_STRENGTHS = { Paracetamol: [500, 665], Aspirin: [100, 300], Naproxen: [250, 275, 550] };

for (const m of meds) {
  if (COMBOS[m.generic]) {
    const def = COMBOS[m.generic];
    delete m.components;
    m.kind = 'combo';
    m.ingredients = def.ingredients;
    m.variants = def.variants;
  }
  if (SINGLE_STRENGTHS[m.generic]) m.strengths = SINGLE_STRENGTHS[m.generic];
}

// New combo: Panadol Extra (paracetamol + caffeine), modelled on Paracetamol.
if (!meds.some((m) => m.generic === 'Paracetamol; Caffeine')) {
  const para = meds.find((m) => m.generic === 'Paracetamol');
  const extra = {
    generic: 'Paracetamol; Caffeine',
    brands: ['Panadol Extra'],
    category: para.category,
    defaultIntervalHours: 4,
    defaultMaxPerDay: 8,
    form: 'tablet',
    unit: 'mg',
    kind: 'combo',
    ingredients: [
      { name: 'Paracetamol', key: 'paracetamol', unit: 'mg', strengths: [500, 665], tallied: true },
      { name: 'Caffeine', key: 'caffeine', unit: 'mg', strengths: [65] },
    ],
    variants: [{ name: 'Panadol Extra', mg: { paracetamol: 500, caffeine: 65 } }],
  };
  meds.splice(meds.indexOf(para) + 1, 0, extra);
}

await writeFile('./medications.json', JSON.stringify(meds, null, 2) + '\n');
console.log('combos:', meds.filter((m) => m.kind === 'combo').length, '| total:', meds.length);
```

Run: `node scripts/_combo-migrate.mjs`
Expected: `combos: 10 | total: 143`

- [ ] **Step 4: Delete the one-off script (data is now in the dataset)**

Run: `rm scripts/_combo-migrate.mjs`

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/combo-data.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add medications.json tests/combo-data.test.js
git commit -m "feat(combo): per-ingredient strengths + variants in dataset; expand single strengths; add Panadol Extra"
```

---

### Task 2: pickerItems + recipeText in data.js

**Files:**
- Modify: `js/data.js`
- Test: `tests/picker-items.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/picker-items.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickerItems, recipeText } from '../js/data.js';

const dataset = [
  { generic: 'Paracetamol', brands: ['Panadol'], category: 'pain' },
  {
    generic: 'Paracetamol; Codeine', brands: ['Panadeine'], category: 'opioid', kind: 'combo', unit: 'mg',
    ingredients: [
      { name: 'Paracetamol', key: 'paracetamol', strengths: [500] },
      { name: 'Codeine', key: 'codeine', strengths: [15, 30] },
    ],
    variants: [
      { name: 'Panadeine', mg: { paracetamol: 500, codeine: 15 } },
      { name: 'Panadeine Forte', mg: { paracetamol: 500, codeine: 30 } },
    ],
  },
];

test('recipeText lists each ingredient and its mg', () => {
  const m = dataset[1];
  assert.equal(recipeText(m, m.variants[1]), 'paracetamol 500 + codeine 30 mg');
});

test('combo expands to one row per variant', () => {
  const all = pickerItems(dataset, '');
  const labels = all.map((i) => i.label);
  assert.deepEqual(labels, ['Paracetamol', 'Panadeine', 'Panadeine Forte']);
  const forte = all.find((i) => i.label === 'Panadeine Forte');
  assert.equal(forte.variant.name, 'Panadeine Forte');
  assert.equal(forte.med.generic, 'Paracetamol; Codeine');
});

test('query matches generic, brand, ingredient and variant names', () => {
  assert.deepEqual(pickerItems(dataset, 'panadeine').map((i) => i.label), ['Panadeine', 'Panadeine Forte']);
  assert.deepEqual(pickerItems(dataset, 'forte').map((i) => i.label), ['Panadeine Forte']);
  assert.deepEqual(pickerItems(dataset, 'codeine').map((i) => i.label), ['Panadeine', 'Panadeine Forte']);
  assert.deepEqual(pickerItems(dataset, 'panadol').map((i) => i.label), ['Paracetamol']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/picker-items.test.js`
Expected: FAIL — `pickerItems`/`recipeText` not exported.

- [ ] **Step 3: Add the functions to `js/data.js`** (after `searchMeds`, before `groupByCategory`)

```js
// Text for a combo variant's recipe, e.g. "paracetamol 500 + codeine 30 mg".
export function recipeText(med, variant) {
  const body = (med.ingredients || [])
    .map((ing) => `${ing.name.toLowerCase()} ${variant.mg[ing.key]}`)
    .join(' + ');
  return `${body} ${med.unit || 'mg'}`;
}

// Flat list of pickable rows for the add-med picker. Combos expand into one row
// per product variant; everything else is a single row. Each item:
// { med, variant|null, label, sublabel|null, category }.
export function pickerItems(dataset, query) {
  const q = (query || '').trim().toLowerCase();
  const matchText = (m) =>
    m.generic.toLowerCase().includes(q) ||
    (m.brands || []).some((b) => b.toLowerCase().includes(q)) ||
    (m.ingredients || []).some((i) => i.name.toLowerCase().includes(q));
  const items = [];
  for (const m of dataset) {
    if (m.kind === 'combo' && m.variants && m.variants.length) {
      const medMatches = !q || matchText(m);
      for (const v of m.variants) {
        if (q && !medMatches && !v.name.toLowerCase().includes(q)) continue;
        items.push({ med: m, variant: v, label: v.name, sublabel: recipeText(m, v), category: m.category });
      }
    } else {
      if (q && !matchText(m)) continue;
      items.push({ med: m, variant: null, label: m.generic, sublabel: null, category: m.category });
    }
  }
  return items;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/picker-items.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/picker-items.test.js
git commit -m "feat(combo): pickerItems expands combos into per-variant rows"
```

---

### Task 3: Combo strength form in ui.js

**Files:**
- Modify: `js/ui.js` (`dosingFieldsHtml`, `wireDosingFields`, `readDosingFields` + 3 combo helpers)
- Modify: `css/styles.css` (combo custom input spacing — already inline; add nothing unless needed)

- [ ] **Step 1: Add the three combo helpers above `dosingFieldsHtml`**

Insert immediately before `function dosingFieldsHtml(med, cur) {` (js/ui.js:270):

```js
// Current per-ingredient mg for a combo form: saved components if editing, else
// the chosen variant's recipe, else the first variant.
function comboCurrentValues(med, cur) {
  if (cur.components && cur.components.length) {
    const o = {}; for (const c of cur.components) o[c.ingredient] = c.mg; return o;
  }
  const v = (med.variants || []).find((x) => x.name === cur.variant) || (med.variants || [])[0];
  return v ? { ...v.mg } : {};
}

// A labelled strength dropdown per ingredient (+ optional product selector).
function comboFieldsHtml(med, cur) {
  const variants = med.variants || [];
  const vals = comboCurrentValues(med, cur);
  const curVariant = cur.variant || (variants[0] && variants[0].name) || '';
  const isNamed = variants.some((v) => v.name === curVariant);
  const variantSel = variants.length
    ? `<div class="field"><label>Product</label><select id="f-variant">` +
      variants.map((v) => `<option value="${v.name}"${v.name === curVariant ? ' selected' : ''}>${v.name}</option>`).join('') +
      `<option value="__custom"${isNamed ? '' : ' selected'}>Custom…</option></select></div>`
    : '';
  const ingFields = med.ingredients.map((ing) => {
    const unit = ing.unit || med.unit || 'mg';
    const val = vals[ing.key];
    const known = ing.strengths.includes(val);
    const useCustom = val != null && !known;
    const opts = ing.strengths
      .map((sN) => `<option value="${sN}"${known && sN === val ? ' selected' : ''}>${sN} ${unit}</option>`).join('');
    return `<div class="field"><label>${ing.name} strength</label>` +
      `<select id="f-ing-${ing.key}" class="f-ing">${opts}<option value="__custom"${useCustom ? ' selected' : ''}>Custom…</option></select>` +
      `<input id="f-ingc-${ing.key}" class="f-ingc" placeholder="e.g. 500" value="${useCustom ? val : ''}" style="display:${useCustom ? '' : 'none'};margin-top:6px" /></div>`;
  }).join('');
  return variantSel + ingFields;
}
```

- [ ] **Step 2: Branch `dosingFieldsHtml` on combos**

In `dosingFieldsHtml` (js/ui.js:270), replace the strength-field block. Change:

```js
function dosingFieldsHtml(med, cur) {
  const unit = unitOf(med);
  let strengthField;
  if (med.strengths && med.strengths.length) {
```

to:

```js
function dosingFieldsHtml(med, cur) {
  const unit = unitOf(med);
  let strengthField;
  if (med.kind === 'combo' && med.ingredients && med.ingredients.length) {
    strengthField = comboFieldsHtml(med, cur);
  } else if (med.strengths && med.strengths.length) {
```

(The remaining `else`/`else` chain and the rest of the function are unchanged.)

- [ ] **Step 3: Wire combo fields in `wireDosingFields`**

At the very top of `wireDosingFields(med, autoInit)` (js/ui.js:326), before `const sel = ...`, add:

```js
  if (med.kind === 'combo' && med.ingredients) {
    const root = modalRoot();
    const variantSel = root.querySelector('#f-variant');
    const setIng = (key, mg) => {
      const sel2 = root.querySelector(`#f-ing-${key}`);
      const custom = root.querySelector(`#f-ingc-${key}`);
      const ing = med.ingredients.find((i) => i.key === key);
      if (ing.strengths.includes(mg)) { sel2.value = String(mg); custom.style.display = 'none'; }
      else { sel2.value = '__custom'; custom.style.display = ''; custom.value = mg; }
    };
    if (variantSel) variantSel.addEventListener('change', () => {
      if (variantSel.value === '__custom') return;
      const v = med.variants.find((x) => x.name === variantSel.value);
      if (v) med.ingredients.forEach((ing) => setIng(ing.key, v.mg[ing.key]));
    });
    med.ingredients.forEach((ing) => {
      const sel2 = root.querySelector(`#f-ing-${ing.key}`);
      const custom = root.querySelector(`#f-ingc-${ing.key}`);
      sel2.addEventListener('change', () => {
        custom.style.display = sel2.value === '__custom' ? '' : 'none';
        if (variantSel) variantSel.value = '__custom';
      });
      custom.addEventListener('input', () => { if (variantSel) variantSel.value = '__custom'; });
    });
    // wire the notify toggle (shared) then return — no strength dropdown here
    wireNotifyToggle();
    return;
  }
```

Then extract the existing notify-toggle wiring into a helper so both paths share it. Add this function right after `wireDosingFields` ends (js/ui.js:354):

```js
function wireNotifyToggle() {
  const notify = modalRoot().querySelector('#f-notify');
  if (!notify) return;
  notify.addEventListener('change', () => {
    if (notify.dataset.locked) { notify.checked = false; openPaywall(); return; }
    const w = modalRoot().querySelector('#f-times-wrap');
    const scheduled = modalRoot().querySelector('#f-dosetype')?.value === 'scheduled';
    if (w) w.style.display = notify.checked && scheduled ? '' : 'none';
    if (notify.checked) requestPermission();
  });
}
```

And in the existing body of `wireDosingFields`, replace the inline notify block:

```js
  const notify = modalRoot().querySelector('#f-notify');
  if (notify) {
    notify.addEventListener('change', () => {
      if (notify.dataset.locked) { notify.checked = false; openPaywall(); return; }
      const w = modalRoot().querySelector('#f-times-wrap');
      const scheduled = modalRoot().querySelector('#f-dosetype')?.value === 'scheduled';
      if (w) w.style.display = notify.checked && scheduled ? '' : 'none';
      if (notify.checked) requestPermission();
    });
  }
```

with:

```js
  wireNotifyToggle();
```

- [ ] **Step 4: Read combo values in `readDosingFields`**

Replace `readDosingFields` (js/ui.js:357-376) with:

```js
function readDosingFields(med) {
  const common = {
    intervalHours: parseFloat(modalRoot().querySelector('#f-int').value) || 0,
    maxDailyUnits: parseFloat(modalRoot().querySelector('#f-max').value) || 0,
    doseType: modalRoot().querySelector('#f-dosetype')?.value === 'scheduled' ? 'scheduled' : 'prn',
    notify: !!modalRoot().querySelector('#f-notify')?.checked,
    reminderTimes: Array.from(modalRoot().querySelectorAll('.f-time')).map((i) => i.value).filter(Boolean),
  };
  if (med.kind === 'combo' && med.ingredients) {
    const unit = unitOf(med);
    const components = med.ingredients.map((ing) => {
      const sel = modalRoot().querySelector(`#f-ing-${ing.key}`);
      const mg = sel.value === '__custom'
        ? parseFloat(modalRoot().querySelector(`#f-ingc-${ing.key}`).value)
        : parseFloat(sel.value);
      return { ingredient: ing.key, mg: Number.isFinite(mg) ? mg : 0 };
    });
    const strength = med.ingredients
      .map((ing, i) => `${ing.name} ${components[i].mg} ${unit}`).join(' + ');
    return { ...common, strength, components };
  }
  const sel = modalRoot().querySelector('#f-strength-sel');
  const unit = unitOf(med);
  let strength;
  if (sel) {
    strength = sel.value === 'custom'
      ? modalRoot().querySelector('#f-strength').value.trim()
      : `${sel.value} ${unit}`;
  } else {
    strength = modalRoot().querySelector('#f-strength').value.trim();
  }
  return { ...common, strength, components: med.components || null };
}
```

- [ ] **Step 5: Verify syntax and tests**

Run: `node --check js/ui.js && node --test`
Expected: no syntax error; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/ui.js
git commit -m "feat(combo): per-ingredient strength form (variant pre-fill, editable)"
```

---

### Task 4: Picker rows + save persistence in ui.js

**Files:**
- Modify: `js/ui.js` (`openPicker`, `openConfigForm`, `openCustomForm`, `openEditMed`)

- [ ] **Step 1: Import `pickerItems` + `recipeText` in `js/ui.js`**

Find the existing `import { ... } from './data.js';` line and add `pickerItems` (and `recipeText` if not already used) to it. If the current import is:

```js
import { loadDataset, loadCountryBrands, regionalBrands, searchMeds, groupByCategory } from './data.js';
```

change it to:

```js
import { loadDataset, loadCountryBrands, regionalBrands, searchMeds, pickerItems, groupByCategory } from './data.js';
```

- [ ] **Step 2: Render variant rows in `openPicker`**

Replace the `render` closure inside `openPicker` (js/ui.js:245-257) with:

```js
  const render = () => {
    const items = pickerItems(dataset, input.value).slice(0, 80);
    const groups = groupByCategory(items.map((it) => ({ ...it, category: it.category })));
    results.innerHTML = groups.map((g) =>
      `<li class="cat">${g.label}</li>` +
      g.meds.map((it, i) => {
        const idx = items.indexOf(it);
        const sub = it.sublabel || brandsFor(it.med).join(', ');
        return `<li data-idx="${idx}"><span>${it.label}</span><span class="muted">${sub}</span></li>`;
      }).join('')
    ).join('') || `<li class="muted">No matches — use “Add a medication not listed”.</li>`;
    results.querySelectorAll('li[data-idx]').forEach((li) =>
      li.addEventListener('click', () => {
        const it = items[+li.dataset.idx];
        openConfigForm(it.med, it.variant ? it.variant.name : null);
      }));
  };
```

(`groupByCategory` reads `.category` off each item, so passing items works directly.)

- [ ] **Step 3: Variant param + persist `components`/`kind`/`ingredients` in `openConfigForm`**

Replace `openConfigForm` (js/ui.js:378-414) with:

```js
function openConfigForm(picked, variant) {
  const isCombo = picked.kind === 'combo' && picked.ingredients;
  const title = variant || picked.generic;
  openSheet(
    `<h2>${title}</h2>` +
    `<div class="field"><label>Display name</label><input id="f-name" value="${title}" /></div>` +
    dosingFieldsHtml(picked, {
      intervalHours: picked.defaultIntervalHours,
      maxDailyUnits: picked.defaultMaxPerDay,
      doseType: resolveDoseType(picked),
      variant: variant || null,
    }) +
    `<div class="btn-row"><button class="btn secondary" id="cancel">Cancel</button><button class="btn" id="save">Save</button></div>`
  );
  wireDosingFields(picked, true);
  modalRoot().querySelector('#cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const meds = loadMeds();
    const vals = readDosingFields(picked);
    meds.push({
      id: uuid(),
      name: modalRoot().querySelector('#f-name').value.trim() || title,
      brands: picked.brands || [],
      strength: vals.strength,
      strengths: isCombo ? null : (picked.strengths || null),
      unit: picked.unit || null,
      maxPerDay: picked.maxPerDay || null,
      category: picked.category || 'custom',
      kind: isCombo ? 'combo' : null,
      ingredients: isCombo ? picked.ingredients : null,
      components: vals.components,
      doseType: vals.doseType,
      notify: vals.notify, reminderTimes: vals.reminderTimes,
      intervalHours: vals.intervalHours,
      maxDailyUnits: vals.maxDailyUnits,
      order: meds.length,
    });
    saveMeds(meds);
    syncNotifications();
    closeModal();
    renderGrid();
  });
}
```

- [ ] **Step 4: Persist `components` in `openCustomForm`**

In `openCustomForm` (js/ui.js:430), add `components: vals.components,` to the pushed object. Change:

```js
      id: uuid(), name, brands: [], strength: vals.strength,
      strengths: null, unit: null, maxPerDay: null, category: 'custom',
```

to:

```js
      id: uuid(), name, brands: [], strength: vals.strength,
      strengths: null, unit: null, maxPerDay: null, category: 'custom',
      kind: null, components: vals.components,
```

- [ ] **Step 5: Combo-aware edit in `openEditMed`**

In `openEditMed` (js/ui.js:444), the `dosingFieldsHtml(med, {...})` call must pass the saved combo components. Change:

```js
    dosingFieldsHtml(med, { strength: med.strength, intervalHours: med.intervalHours, maxDailyUnits: med.maxDailyUnits, doseType: resolveDoseType(med) }) +
```

to:

```js
    dosingFieldsHtml(med, { strength: med.strength, components: med.components, intervalHours: med.intervalHours, maxDailyUnits: med.maxDailyUnits, doseType: resolveDoseType(med) }) +
```

And in its save handler, persist edited components. Change:

```js
      m.name = modalRoot().querySelector('#f-name').value.trim() || m.name;
      m.strength = vals.strength;
      m.intervalHours = vals.intervalHours;
```

to:

```js
      m.name = modalRoot().querySelector('#f-name').value.trim() || m.name;
      m.strength = vals.strength;
      if (vals.components) m.components = vals.components;
      m.intervalHours = vals.intervalHours;
```

(A saved combo carries `kind:'combo'` + `ingredients`, so `dosingFieldsHtml`/`wireDosingFields`/`readDosingFields` all take the combo path; with no `variants` on the saved med the product selector is simply omitted and the per-ingredient dropdowns pre-fill from saved `components`. Old saved combos without `kind` fall back to the single free-text strength box.)

- [ ] **Step 6: Verify syntax and full suite**

Run: `node --check js/ui.js && node --test`
Expected: no syntax error; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add js/ui.js
git commit -m "feat(combo): picker variant rows + persist components/kind/ingredients on save"
```

---

### Task 5: Service-worker cache bump + final check

**Files:**
- Modify: `service-worker.js:6`

- [ ] **Step 1: Bump the cache version**

Change `service-worker.js` line 6 from `const CACHE = 'dosegrid-v16';` to `const CACHE = 'dosegrid-v17';`.

- [ ] **Step 2: Run the full suite**

Run: `node --test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add service-worker.js
git commit -m "chore: bump SW cache to v17 for combo strength fields"
```

---

## Self-Review notes

- **Spec coverage:** data model + 10 combos + Panadol Extra + single strengths (Task 1); pickerItems/recipeText (Task 2); combo per-ingredient form with variant pre-fill + editable (Task 3); picker variant rows + components persistence + edit fallback (Task 4); SW bump (Task 5). Tally engine unchanged (reads persisted `components`). All spec sections covered.
- **Manual smoke (browser, after Task 5):** Add med → search "Panadeine" → rows Panadeine + Panadeine Forte; pick Forte → Product=Panadeine Forte, Paracetamol 500, Codeine 30, all editable; Save → tile "Panadeine Forte"; open it → dose-sheet shows "Paracetamol today (all medicines)" using 500 mg; add plain Paracetamol 665 and dose both → combined paracetamol total climbs and warns near 4000 mg. `?pro=1`/`?pro=0` unaffected.
- **Type consistency:** `components: [{ingredient, mg}]` shape matches `js/ingredients.js#unitMg`; `kind:'combo'` + `ingredients[]` persisted and read by `dosingFieldsHtml`/`wireDosingFields`/`readDosingFields`; `pickerItems` item shape `{med, variant, label, sublabel, category}` consistent between Task 2 and Task 4; `openConfigForm(med, variantName)` signature matches the picker call.
