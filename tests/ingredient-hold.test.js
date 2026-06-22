import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientHold, recentIngredientDose } from '../js/ingredients.js';

const now = new Date('2026-06-22T13:00:00').getTime();
const HOUR = 3600e3, MIN = 60e3;

const panadeine = { id: 'pan', name: 'Panadeine', components: [{ ingredient: 'paracetamol', mg: 500 }, { ingredient: 'codeine', mg: 15 }] };
const para = { id: 'p', name: 'Paracetamol', strength: '500 mg', components: [{ ingredient: 'paracetamol', fromStrength: true }] };
const ibu = { id: 'i', name: 'Ibuprofen', strength: '400 mg', components: [{ ingredient: 'ibuprofen', fromStrength: true }] };
const meds = [panadeine, para, ibu];

test('blocks a combo when the shared ingredient window is full', () => {
  // 1000 mg paracetamol (2 plain) 10 min ago → a Panadeine tab (+500) would hit 1500 / 4h.
  const doses = [{ id: 'a', medId: 'p', units: 2, timestamp: now - 10 * MIN }];
  const hold = ingredientHold(panadeine, meds, doses, now);
  assert.equal(hold.blocked, true);
  assert.equal(hold.ingredient, 'paracetamol');
  // frees when the 1000 mg dose ages out of the 4h window
  assert.equal(hold.until, now - 10 * MIN + 4 * HOUR);
});

test('does NOT block when a normal single dose still fits the window', () => {
  // only 500 mg in the window → +500 = 1000 = at cap, allowed
  const doses = [{ id: 'a', medId: 'p', units: 1, timestamp: now - 10 * MIN }];
  assert.equal(ingredientHold(panadeine, meds, doses, now).blocked, false);
});

test('blocks via the daily ceiling and frees at midnight', () => {
  // 4000 mg paracetamol spread earlier today, all > 4h ago (no window block)
  const doses = [];
  for (let i = 0; i < 8; i++) doses.push({ id: 'd' + i, medId: 'p', units: 1, timestamp: now - (5 * HOUR + i * 20 * MIN) });
  const hold = ingredientHold(para, meds, doses, now);
  assert.equal(hold.blocked, true);
  const midnight = new Date('2026-06-23T00:00:00').getTime();
  assert.equal(hold.until, midnight);
});

test('no block when nothing shares the ingredient recently', () => {
  assert.equal(ingredientHold(panadeine, meds, [], now).blocked, false);
  assert.equal(ingredientHold(ibu, meds, [{ id: 'a', medId: 'p', units: 2, timestamp: now }], now).blocked, false);
});

test('hold reports reason; recentIngredientDose names the contributing dose', () => {
  const doses = [{ id: 'a', medId: 'p', units: 2, timestamp: now - 10 * MIN }];
  assert.equal(ingredientHold(panadeine, meds, doses, now).reason, 'window');
  const rd = recentIngredientDose(meds, doses, 'paracetamol', now);
  assert.equal(rd.medName, 'Paracetamol');
  assert.equal(rd.units, 2);
  assert.equal(rd.timestamp, now - 10 * MIN);
  assert.equal(recentIngredientDose(meds, [], 'paracetamol', now), null);
});
