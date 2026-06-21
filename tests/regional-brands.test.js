import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { regionalBrands } from '../js/data.js';

test('regionalBrands: country lookup, UK→GB alias, and null fallbacks', () => {
  const map = { GB: { Paracetamol: ['Panadol', 'Calpol'] }, FR: { Paracetamol: ['Doliprane'] } };
  assert.deepEqual(regionalBrands(map, 'GB', 'Paracetamol'), ['Panadol', 'Calpol']);
  assert.deepEqual(regionalBrands(map, 'UK', 'Paracetamol'), ['Panadol', 'Calpol']); // app 'UK' → research 'GB'
  assert.deepEqual(regionalBrands(map, 'FR', 'Paracetamol'), ['Doliprane']);
  assert.equal(regionalBrands(map, 'FR', 'Ibuprofen'), null);   // generic not listed for country
  assert.equal(regionalBrands(map, 'ZZ', 'Paracetamol'), null); // country not in map
  assert.equal(regionalBrands(null, 'GB', 'Paracetamol'), null);
});

test('country-brands.json: valid, broad coverage, correct flagship brands', async () => {
  const map = JSON.parse(await readFile(new URL('../country-brands.json', import.meta.url)));
  assert.ok(Object.keys(map).length > 40, `only ${Object.keys(map).length} countries`);
  assert.ok(map.GB?.Paracetamol?.includes('Panadol'));
  assert.ok(map.US?.Paracetamol?.includes('Tylenol'));
  assert.ok(map.FR?.Paracetamol?.includes('Doliprane'));
  assert.ok(map.IN?.Paracetamol?.includes('Crocin'));
});
