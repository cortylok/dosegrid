import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDose } from '../js/safety.js';

const HOUR = 3600 * 1000;
const med = { id: 'm', name: 'Ibuprofen', intervalHours: 6, maxDailyUnits: 6 };
const now = new Date('2026-06-17T15:00:00').getTime();
const todayDose = (hAgo, units) => ({ id: 'd' + hAgo, medId: 'm', timestamp: now - hAgo * HOUR, units });

test('null when interval elapsed and under max', () => {
  assert.equal(checkDose(med, [todayDose(8, 1)], 1, now), null);
});

test('early when within the interval', () => {
  const r = checkDose(med, [todayDose(2, 1)], 1, now);
  assert.equal(r.type, 'early');
  assert.equal(r.intervalHours, 6);
  assert.ok(r.gapMs >= 2 * HOUR - 1000 && r.gapMs <= 2 * HOUR + 1000);
});

test('over when resulting units exceed max', () => {
  const r = checkDose(med, [todayDose(8, 5)], 2, now); // 5 + 2 = 7 > 6, interval elapsed
  assert.equal(r.type, 'over');
  assert.equal(r.resultingUnits, 7);
  assert.equal(r.maxDailyUnits, 6);
});

test('null at exactly max (not over)', () => {
  assert.equal(checkDose(med, [todayDose(8, 5)], 1, now), null); // 5 + 1 = 6, not > 6
});

test('over takes precedence when both early and over', () => {
  const r = checkDose(med, [todayDose(2, 5)], 2, now); // early (2h<6h) AND 7>6
  assert.equal(r.type, 'over');
});
