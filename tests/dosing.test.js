// tests/dosing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitsToday } from '../js/dosing.js';

const midday = new Date('2026-06-14T12:00:00').getTime();
const earlyToday = new Date('2026-06-14T08:00:00').getTime();
const yesterday = new Date('2026-06-13T23:00:00').getTime();

test('unitsToday sums only doses on the local calendar day', () => {
  const doses = [
    { medId: 'a', timestamp: earlyToday, units: 1 },
    { medId: 'a', timestamp: midday, units: 0.5 },
    { medId: 'a', timestamp: yesterday, units: 2 }, // excluded
    { medId: 'b', timestamp: earlyToday, units: 1 }, // other med, excluded
  ];
  assert.equal(unitsToday(doses, 'a', midday), 1.5);
});

test('unitsToday is 0 when no doses today', () => {
  assert.equal(unitsToday([{ medId: 'a', timestamp: yesterday, units: 1 }], 'a', midday), 0);
});
