// tests/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchMeds, groupByCategory } from '../js/data.js';
import { resolveDoseType } from '../js/categories.js';

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

test('resolveDoseType: explicit doseType wins, else category default, else prn', () => {
  assert.equal(resolveDoseType({ category: 'antibiotic' }), 'scheduled');
  assert.equal(resolveDoseType({ category: 'pain-fever' }), 'prn');
  assert.equal(resolveDoseType({ category: 'reflux', doseType: 'scheduled' }), 'scheduled');
  assert.equal(resolveDoseType({ category: 'antibiotic', doseType: 'prn' }), 'prn');
  assert.equal(resolveDoseType({}), 'prn');
});
