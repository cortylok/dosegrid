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
