import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inQuietHours } from '../js/notify-schedule.js';

const Q = { quietStart: '22:00', quietEnd: '07:00' };

test('inQuietHours: window crossing midnight', () => {
  assert.equal(inQuietHours('23:30', Q), true);
  assert.equal(inQuietHours('03:00', Q), true);
  assert.equal(inQuietHours('07:00', Q), false); // end exclusive
  assert.equal(inQuietHours('12:00', Q), false);
  assert.equal(inQuietHours('22:00', Q), true);  // start inclusive
});

test('inQuietHours: same-day window', () => {
  const day = { quietStart: '01:00', quietEnd: '06:00' };
  assert.equal(inQuietHours('03:00', day), true);
  assert.equal(inQuietHours('08:00', day), false);
});

test('inQuietHours: empty window (start==end) is never quiet', () => {
  assert.equal(inQuietHours('03:00', { quietStart: '00:00', quietEnd: '00:00' }), false);
});

import { defaultReminderTimes } from '../js/notify-schedule.js';

test('defaultReminderTimes: standard dosing maps to sensible slots', () => {
  assert.deepEqual(defaultReminderTimes(24), ['08:00']);              // once daily
  assert.deepEqual(defaultReminderTimes(12), ['08:00', '20:00']);     // BID
  assert.deepEqual(defaultReminderTimes(8),  ['08:00', '14:00', '20:00']); // TID
  assert.deepEqual(defaultReminderTimes(6),  ['08:00', '12:00', '16:00', '20:00']); // QID
});

test('defaultReminderTimes: clamps and handles missing interval', () => {
  assert.equal(defaultReminderTimes(undefined).length, 1); // → ['08:00']
  assert.ok(defaultReminderTimes(1).length <= 6);          // clamp upper bound
});
