import { test } from 'node:test';
import assert from 'node:assert/strict';
import { severity, WINDOWS, painInWindow, dosesInWindow, latestPain } from '../js/pain.js';

test('severity boundaries', () => {
  assert.equal(severity(0), 'none');
  assert.equal(severity(1), 'mild');
  assert.equal(severity(3), 'mild');
  assert.equal(severity(4), 'moderate');
  assert.equal(severity(6), 'moderate');
  assert.equal(severity(7), 'severe');
  assert.equal(severity(10), 'severe');
});

test('WINDOWS keys in order', () => {
  assert.deepEqual(WINDOWS.map((w) => w.key), ['1d', '3d', '1w', '2w']);
});

test('painInWindow filters to window and sorts ascending', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const pain = [
    { id: 'a', timestamp: now - 2 * day, score: 5 },
    { id: 'b', timestamp: now - 1000, score: 8 },
    { id: 'c', timestamp: now - 10 * day, score: 3 },
  ];
  assert.deepEqual(painInWindow(pain, 3 * day, now).map((p) => p.id), ['a', 'b']);
});

test('dosesInWindow filters to window', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: 'd1', medId: 'm', timestamp: now - 2 * day, units: 1 },
    { id: 'd2', medId: 'm', timestamp: now - 20 * day, units: 1 },
  ];
  assert.deepEqual(dosesInWindow(doses, 7 * day, now).map((d) => d.id), ['d1']);
});

test('latestPain returns most recent or null', () => {
  assert.equal(latestPain([]), null);
  const now = Date.now();
  const pain = [{ id: 'a', timestamp: now - 5000, score: 2 }, { id: 'b', timestamp: now, score: 9 }];
  assert.equal(latestPain(pain).id, 'b');
});
