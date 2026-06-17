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

const { loadMeds, saveMeds, loadDoses, addDose, pruneDoses, uuid, loadPain, addPain, prunePain } =
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

test('pruneDoses keeps entries within 14 days, drops older', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: 'a', medId: 'm', timestamp: now - 1000, units: 1 },
    { id: 'b', medId: 'm', timestamp: now - 13 * day, units: 1 },
    { id: 'c', medId: 'm', timestamp: now - 15 * day, units: 1 },
  ];
  assert.deepEqual(pruneDoses(doses, now).map((d) => d.id), ['a', 'b']);
});

test('uuid returns unique strings', () => {
  assert.notEqual(uuid(), uuid());
});

test('addPain then loadPain round-trips, note optional', () => {
  addPain(7, 'after walking', 1000);
  addPain(3, '', 2000);
  const pain = loadPain();
  assert.equal(pain.length, 2);
  assert.equal(pain[0].score, 7);
  assert.equal(pain[0].note, 'after walking');
  assert.ok(!('note' in pain[1])); // empty note omitted
});

test('prunePain keeps entries within 90 days, drops older', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const pain = [
    { id: 'a', timestamp: now - 1000, score: 5 },
    { id: 'b', timestamp: now - 89 * day, score: 5 },
    { id: 'c', timestamp: now - 91 * day, score: 5 },
  ];
  assert.deepEqual(prunePain(pain, now).map((p) => p.id), ['a', 'b']);
});
