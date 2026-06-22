import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIngredients, ingredientInWindow, INGREDIENT_PERIOD } from '../js/ingredients.js';

const now = Date.now();
const MIN = 60 * 1000, HOUR = 60 * MIN;

// A combo: each tablet = 500 mg paracetamol (+ codeine, untallied for window).
const panadeine = {
  id: 'pan', name: 'Panadeine',
  components: [{ ingredient: 'paracetamol', mg: 500 }, { ingredient: 'codeine', mg: 15 }],
};
// Plain paracetamol, 500 mg/tablet via fromStrength.
const para = { id: 'p', name: 'Paracetamol', strength: '500 mg', components: [{ ingredient: 'paracetamol', fromStrength: true }] };
const meds = [panadeine, para];

test('INGREDIENT_PERIOD defines a paracetamol 1000 mg / 4 h cap', () => {
  assert.equal(INGREDIENT_PERIOD.paracetamol.maxMg, 1000);
  assert.equal(INGREDIENT_PERIOD.paracetamol.windowHours, 4);
});

test('ingredientInWindow sums shared ingredient across meds within the window', () => {
  const doses = [
    { id: 'a', medId: 'pan', units: 2, timestamp: now - 10 * MIN }, // 1000 mg, recent
    { id: 'b', medId: 'p', units: 2, timestamp: now - 6 * HOUR },   // 1000 mg, outside 4h
  ];
  assert.equal(ingredientInWindow(meds, doses, 'paracetamol', 4 * HOUR, now), 1000);
});

test('flags taking 2 paracetamol shortly after 2 Panadeine (2000 mg / 4 h)', () => {
  const doses = [{ id: 'a', medId: 'pan', units: 2, timestamp: now - 10 * MIN }]; // 1000 mg just now
  const info = checkIngredients(para, meds, doses, 2, now); // + 2 plain paracetamol = 1000 mg
  assert.ok(info, 'should warn');
  assert.equal(info.type, 'ingredient');
  assert.equal(info.scope, 'period');
  assert.equal(info.ingredient, 'paracetamol');
  assert.equal(info.totalMg, 2000);
  assert.equal(info.limitMg, 1000);
  assert.equal(info.windowHours, 4);
});

test('a single normal 1000 mg paracetamol dose does NOT trip the window cap', () => {
  const info = checkIngredients(para, meds, [], 2, now); // 1000 mg, nothing prior
  assert.equal(info, null);
});

test('doses spaced beyond the window do not trip it', () => {
  const doses = [{ id: 'a', medId: 'pan', units: 2, timestamp: now - 5 * HOUR }]; // outside 4h
  const info = checkIngredients(para, meds, doses, 2, now);
  assert.equal(info, null);
});

test('daily ceiling takes precedence when both daily and window are exceeded', () => {
  // 7 plain-paracetamol doses of 2 tabs (1000 mg) earlier today = 7000 mg already > 4000 daily.
  const doses = [];
  for (let i = 0; i < 7; i++) doses.push({ id: 'd' + i, medId: 'p', units: 2, timestamp: now - (i + 1) * 30 * MIN });
  const info = checkIngredients(para, meds, doses, 2, now);
  assert.ok(info);
  assert.equal(info.scope, 'daily');
  assert.equal(info.limitMg, 4000);
});
