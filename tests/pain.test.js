import { test } from 'node:test';
import assert from 'node:assert/strict';
import { severity, latestPain, painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals } from '../js/pain.js';

test('severity boundaries', () => {
  assert.equal(severity(0), 'none');
  assert.equal(severity(3), 'mild');
  assert.equal(severity(4), 'moderate');
  assert.equal(severity(6), 'moderate');
  assert.equal(severity(7), 'severe');
  assert.equal(severity(10), 'severe');
});

test('latestPain returns most recent or null', () => {
  assert.equal(latestPain([]), null);
  const now = Date.now();
  assert.equal(latestPain([{ id: 'a', timestamp: now - 5000, score: 2 }, { id: 'b', timestamp: now, score: 9 }]).id, 'b');
});

test('painColor ramps green→red, distinct per score', () => {
  assert.match(painColor(0), /hsl\(140/);
  assert.match(painColor(10), /hsl\(0/);
  assert.notEqual(painColor(2), painColor(8));
});

test('medColor is deterministic and distinct for first colours', () => {
  assert.equal(medColor(0), medColor(0));
  assert.notEqual(medColor(0), medColor(1));
  assert.equal(typeof medColor(0), 'string');
  assert.equal(medColor(0), medColor(8)); // palette of 8 cycles
});

test('lodMode switches at threshold', () => {
  assert.equal(lodMode(120), 'detail');
  assert.equal(lodMode(40), 'overview');
  assert.equal(lodMode(90), 'detail');   // >= threshold
  assert.equal(lodMode(89), 'overview');
});

test('startOfDay returns local midnight', () => {
  const t = new Date('2026-06-17T14:30:00').getTime();
  const s = new Date(startOfDay(t));
  assert.equal(s.getHours(), 0);
  assert.equal(s.getMinutes(), 0);
  assert.ok(startOfDay(t) <= t);
});

test('isEarlyDose true when gap under interval', () => {
  const now = Date.now();
  assert.equal(isEarlyDose(now, now - 2 * 3600 * 1000, 6), true);   // 2h < 6h
  assert.equal(isEarlyDose(now, now - 7 * 3600 * 1000, 6), false);  // 7h >= 6h
  assert.equal(isEarlyDose(now, null, 6), false);                   // no previous dose
});

test('medDayTotals sums per med per calendar day', () => {
  const d0 = new Date('2026-06-17T08:00:00').getTime();
  const d0b = new Date('2026-06-17T20:00:00').getTime();
  const d1 = new Date('2026-06-18T08:00:00').getTime();
  const map = medDayTotals([
    { medId: 'a', timestamp: d0, units: 1 },
    { medId: 'a', timestamp: d0b, units: 2 },
    { medId: 'b', timestamp: d0, units: 1 },
    { medId: 'a', timestamp: d1, units: 1 },
  ]);
  const day0 = startOfDay(d0), day1 = startOfDay(d1);
  assert.equal(map.get(day0).a, 3);
  assert.equal(map.get(day0).b, 1);
  assert.equal(map.get(day1).a, 1);
});
