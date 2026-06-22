import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backfillComponents } from '../js/data.js';

const dataset = [
  { generic: 'Paracetamol', brands: ['Panadol'], components: [{ ingredient: 'paracetamol', fromStrength: true }] },
  { generic: 'Amoxicillin', brands: ['Amoxil'] },
  {
    generic: 'Paracetamol; Codeine', kind: 'combo',
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

test('backfills single-ingredient components by generic name', () => {
  const meds = [{ id: '1', name: 'Paracetamol', strength: '500 mg' }];
  assert.equal(backfillComponents(meds, dataset), true);
  assert.deepEqual(meds[0].components, [{ ingredient: 'paracetamol', fromStrength: true }]);
  assert.equal(meds[0].generic, 'Paracetamol');
});

test('matches by brand name too', () => {
  const meds = [{ id: '2', name: 'Panadol' }];
  backfillComponents(meds, dataset);
  assert.deepEqual(meds[0].components, [{ ingredient: 'paracetamol', fromStrength: true }]);
});

test('backfills combo by variant name with that recipe', () => {
  const meds = [{ id: '3', name: 'Panadeine Forte' }];
  backfillComponents(meds, dataset);
  assert.equal(meds[0].kind, 'combo');
  assert.deepEqual(meds[0].components, [{ ingredient: 'paracetamol', mg: 500 }, { ingredient: 'codeine', mg: 30 }]);
});

test('backfills combo by generic name using the first variant', () => {
  const meds = [{ id: '4', name: 'Paracetamol; Codeine' }];
  backfillComponents(meds, dataset);
  assert.equal(meds[0].components.find((c) => c.ingredient === 'paracetamol').mg, 500);
});

test('leaves unmatched / no-component meds untouched and reports no change', () => {
  const meds = [{ id: '5', name: 'Amoxicillin' }, { id: '6', name: 'My Custom Thing' }];
  assert.equal(backfillComponents(meds, dataset), false);
  assert.equal(meds[0].components, undefined);
  assert.equal(meds[1].components, undefined);
});

test('skips meds that already have components', () => {
  const meds = [{ id: '7', name: 'Paracetamol', components: [{ ingredient: 'paracetamol', mg: 665 }] }];
  assert.equal(backfillComponents(meds, dataset), false);
  assert.deepEqual(meds[0].components, [{ ingredient: 'paracetamol', mg: 665 }]);
});
