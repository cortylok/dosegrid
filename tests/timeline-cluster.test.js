import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dosesInCluster, dayDoses, rangeForPreset, startOfDay } from '../js/pain.js';

const DAY = 864e5;

test('dosesInCluster: within tolerance, sorted ascending, excludes outside', () => {
  const base = 1_700_000_000_000;
  const doses = [
    { id: 'a', timestamp: base + 60_000 },
    { id: 'b', timestamp: base },
    { id: 'c', timestamp: base + 5_000 },
    { id: 'd', timestamp: base + 10_000_000 },
  ];
  assert.deepEqual(dosesInCluster(doses, base, 120_000).map((d) => d.id), ['b', 'c', 'a']);
  assert.equal(dosesInCluster(doses, base, 1_000).length, 1);
  assert.deepEqual(dosesInCluster([], base, 1000), []);
});

test('dayDoses: only that day, sorted ascending', () => {
  const d0 = startOfDay(1_700_000_000_000);
  const doses = [
    { id: 'x', timestamp: d0 + 5 * 36e5 },
    { id: 'y', timestamp: d0 + 1 * 36e5 },
    { id: 'z', timestamp: d0 + DAY + 36e5 },
    { id: 'w', timestamp: d0 - 36e5 },
  ];
  assert.deepEqual(dayDoses(doses, d0).map((d) => d.id), ['y', 'x']);
});

test('rangeForPreset: today, week, and fallback', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(rangeForPreset('today', now), { start: startOfDay(now), end: now });
  assert.deepEqual(rangeForPreset('week', now), { start: now - 7 * DAY, end: now });
  assert.deepEqual(rangeForPreset('whatever', now), { start: startOfDay(now), end: now });
});
