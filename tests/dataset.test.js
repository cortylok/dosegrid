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
