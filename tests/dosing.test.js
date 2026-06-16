// tests/dosing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitsToday, nextDoseTime, computeStatus, dailyDoseTotals } from '../js/dosing.js';

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

test('nextDoseTime adds intervalHours to last dose for the med', () => {
  const t = new Date('2026-06-14T12:00:00').getTime();
  const doses = [
    { medId: 'a', timestamp: new Date('2026-06-14T10:00:00').getTime(), units: 1 },
    { medId: 'a', timestamp: t, units: 1 }, // latest
    { medId: 'b', timestamp: t, units: 1 },
  ];
  assert.equal(nextDoseTime(doses, 'a', 6), t + 6 * 3600 * 1000);
});

test('nextDoseTime returns null when med has no doses', () => {
  assert.equal(nextDoseTime([], 'a', 6), null);
});

const med = { id: 'a', intervalHours: 6, maxDailyUnits: 4 };
const now = new Date('2026-06-14T12:00:00').getTime();

test('computeStatus READY when no doses', () => {
  const s = computeStatus(med, [], now);
  assert.equal(s.state, 'ready');
});

test('computeStatus DAILY_MAX when units today >= max', () => {
  const doses = [
    { medId: 'a', timestamp: new Date('2026-06-14T07:00:00').getTime(), units: 2 },
    { medId: 'a', timestamp: new Date('2026-06-14T09:00:00').getTime(), units: 2 },
  ];
  const s = computeStatus(med, doses, now);
  assert.equal(s.state, 'daily_max');
  assert.equal(s.unitsToday, 4);
});

test('computeStatus WAIT when interval not elapsed and under max', () => {
  const doses = [{ medId: 'a', timestamp: new Date('2026-06-14T10:00:00').getTime(), units: 1 }];
  const s = computeStatus(med, doses, now);
  assert.equal(s.state, 'wait');
  assert.equal(s.nextDoseTime, new Date('2026-06-14T16:00:00').getTime());
  assert.ok(s.msRemaining > 0);
});

test('computeStatus READY when interval elapsed and under max', () => {
  const doses = [{ medId: 'a', timestamp: new Date('2026-06-14T04:00:00').getTime(), units: 1 }];
  const s = computeStatus(med, doses, now);
  assert.equal(s.state, 'ready');
});

test('dailyDoseTotals returns one bucket per day, newest last, zero-filled', () => {
  const now = new Date('2026-06-16T10:00:00').getTime();
  const day = 24 * 3600 * 1000;
  const doses = [
    { id: '1', medId: 'm', timestamp: now, units: 1 },
    { id: '2', medId: 'm', timestamp: now - 1000, units: 0.5 },
    { id: '3', medId: 'm', timestamp: now - 2 * day, units: 2 },
    { id: '4', medId: 'other', timestamp: now, units: 5 },
  ];
  const out = dailyDoseTotals(doses, 'm', now, 14);
  assert.equal(out.length, 14);
  assert.equal(out[13].units, 1.5);          // today
  assert.equal(out[12].units, 0);            // yesterday empty
  assert.equal(out[11].units, 2);            // two days ago
  assert.ok(out[13].dayStart <= now);        // each bucket carries its day start
});

test('dailyDoseTotals ignores doses older than the window', () => {
  const now = new Date('2026-06-16T10:00:00').getTime();
  const day = 24 * 3600 * 1000;
  const doses = [{ id: '1', medId: 'm', timestamp: now - 20 * day, units: 9 }];
  const out = dailyDoseTotals(doses, 'm', now, 14);
  assert.equal(out.reduce((s, b) => s + b.units, 0), 0);
});
