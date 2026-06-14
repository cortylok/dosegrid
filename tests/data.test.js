// tests/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchMeds } from '../js/data.js';

const dataset = [
  { generic: 'Ibuprofen', brands: ['Advil', 'Motrin'] },
  { generic: 'Acetaminophen', brands: ['Tylenol'] },
];

test('searchMeds matches generic name, case-insensitive', () => {
  const r = searchMeds('ibup', dataset);
  assert.equal(r.length, 1);
  assert.equal(r[0].generic, 'Ibuprofen');
});

test('searchMeds matches brand name', () => {
  const r = searchMeds('tylenol', dataset);
  assert.equal(r[0].generic, 'Acetaminophen');
});

test('searchMeds empty query returns all', () => {
  assert.equal(searchMeds('', dataset).length, 2);
});
