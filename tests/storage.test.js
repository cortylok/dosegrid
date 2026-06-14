// tests/storage.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim for Node test env
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const { loadMeds, saveMeds, loadDoses, addDose, pruneDoses, uuid } =
  await import('../js/storage.js');

beforeEach(() => localStorage.clear());

test('saveMeds then loadMeds round-trips', () => {
  const meds = [{ id: '1', name: 'Ibuprofen', brands: [], intervalHours: 6, maxDailyUnits: 4, order: 0 }];
  saveMeds(meds);
  assert.deepEqual(loadMeds(), meds);
});

test('loadMeds returns [] when empty/corrupt', () => {
  assert.deepEqual(loadMeds(), []);
  localStorage.setItem('dosegrid.meds', '{not json');
  assert.deepEqual(loadMeds(), []);
});

test('pruneDoses drops entries older than 48h', () => {
  const now = Date.now();
  const doses = [
    { id: 'a', medId: 'm', timestamp: now - 1000, units: 1 },
    { id: 'b', medId: 'm', timestamp: now - 49 * 3600 * 1000, units: 1 },
  ];
  assert.deepEqual(pruneDoses(doses, now).map((d) => d.id), ['a']);
});

test('uuid returns unique strings', () => {
  assert.notEqual(uuid(), uuid());
});
