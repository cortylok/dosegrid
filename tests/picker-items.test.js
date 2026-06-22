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
