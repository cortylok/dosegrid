import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unitMg, ingredientTotals, checkIngredients, INGREDIENT_LIMITS } from '../js/ingredients.js';

const now = Date.now();
const dose = (medId, units, agoMs = 0) => ({ id: medId + agoMs, medId, units, timestamp: now - agoMs });

const PARA = { id: 'p', name: 'Paracetamol', strength: '500 mg', components: [{ ingredient: 'paracetamol', fromStrength: true }] };
const PANADEINE = { id: 'pc', name: 'Panadeine', components: [{ ingredient: 'paracetamol', mg: 500 }] };
const IBU = { id: 'i', name: 'Ibuprofen', strength: '400 mg', components: [{ ingredient: 'ibuprofen', fromStrength: true }] };

test('unitMg: combo uses fixed mg; single-ingredient reads strength; fallback otherwise', () => {
  assert.equal(unitMg(PANADEINE, 'paracetamol'), 500);
  assert.equal(unitMg(PARA, 'paracetamol'), 500);
  assert.equal(unitMg({ ...PARA, strength: '' }, 'paracetamol'), 500); // fallback default
  assert.equal(unitMg(IBU, 'ibuprofen'), 400);
  assert.equal(unitMg(PARA, 'ibuprofen'), 0); // not a component
});

test('ingredientTotals sums a shared ingredient across different meds', () => {
  const meds = [PARA, PANADEINE, IBU];
  const doses = [dose('p', 2), dose('pc', 4), dose('i', 1)]; // 2x500 + 4x500 para = 3000; 1x400 ibu
  const t = ingredientTotals(meds, doses, now);
  assert.equal(t.paracetamol, 3000);
  assert.equal(t.ibuprofen, 400);
});

test('checkIngredients warns when a shared ingredient would exceed its ceiling', () => {
  const meds = [PARA, PANADEINE];
  const doses = [dose('p', 6), dose('pc', 2)]; // 3000 + 1000 = 4000 (exactly at limit)
  assert.equal(checkIngredients(PARA, meds, doses, 0, now), null); // at limit, not over
  const w = checkIngredients(PARA, meds, doses, 1, now); // +500 → 4500
  assert.equal(w.type, 'ingredient');
  assert.equal(w.ingredient, 'paracetamol');
  assert.equal(w.totalMg, 4500);
  assert.equal(w.limitMg, INGREDIENT_LIMITS.paracetamol);
});

test('checkIngredients returns null for a med with no shared components', () => {
  const plain = { id: 'x', name: 'Cetirizine' };
  assert.equal(checkIngredients(plain, [plain], [dose('x', 1)], 5, now), null);
});

test('real dataset: paracetamol+codeine combo tallies paracetamol per ingredient', async () => {
  const meds = JSON.parse(await readFile(new URL('../medications.json', import.meta.url)));
  const combo = meds.find((m) => m.generic === 'Paracetamol; Codeine');
  assert.ok(combo, 'combo present');
  const para = (combo.ingredients || []).find((i) => i.key === 'paracetamol');
  assert.ok(para && para.tallied, 'paracetamol ingredient is tallied');
  assert.ok(combo.variants.every((v) => typeof v.mg.paracetamol === 'number'), 'each variant has a paracetamol mg');
  const plain = meds.find((m) => m.generic === 'Paracetamol');
  assert.ok((plain.components || []).some((c) => c.ingredient === 'paracetamol'), 'plain paracetamol tagged');
});
