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

import { buildSchedule } from '../js/notify-schedule.js';

const SET = { quietStart: '22:00', quietEnd: '07:00' };
const noon = new Date('2026-06-21T12:00:00').getTime();

test('buildSchedule: returns [] when not Pro', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  assert.deepEqual(buildSchedule({ meds, doses: [{ medId: 'm1', timestamp: noon, units: 1 }], settings: SET, now: noon, pro: false }), []);
});

test('buildSchedule: PRN med schedules one-shot at last+interval', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  const doses = [{ medId: 'm1', timestamp: noon, units: 1 }];
  const out = buildSchedule({ meds, doses, settings: SET, now: noon, pro: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].fireAt, noon + 6 * 3600 * 1000); // 18:00
  assert.equal(out[0].body, 'You can take another Ibuprofen now.');
  assert.equal(out[0].channel, 'default'); // 18:00 not quiet
});

test('buildSchedule: PRN with no dose, or already-allowed, schedules nothing', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  assert.equal(buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true }).length, 0);
  const old = [{ medId: 'm1', timestamp: noon - 7 * 3600 * 1000, units: 1 }]; // interval already elapsed
  assert.equal(buildSchedule({ meds, doses: old, settings: SET, now: noon, pro: true }).length, 0);
});

test('buildSchedule: scheduled med makes one repeating entry per reminder time', () => {
  const meds = [{ id: 'm2', name: 'Amoxicillin', doseType: 'scheduled', notify: true, intervalHours: 8, reminderTimes: ['08:00', '23:00'] }];
  const out = buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].repeatAt, { hour: 8, minute: 0 });
  assert.equal(out[0].body, 'Time for your Amoxicillin.');
  assert.equal(out[0].channel, 'default');
  assert.equal(out[1].channel, 'quiet'); // 23:00 is in quiet hours
});

test('buildSchedule: notify=false meds are excluded; ids are stable & unique', () => {
  const meds = [
    { id: 'm1', name: 'A', doseType: 'prn', notify: false, intervalHours: 6 },
    { id: 'm2', name: 'B', doseType: 'scheduled', notify: true, intervalHours: 12, reminderTimes: ['08:00', '20:00'] },
  ];
  const out = buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true });
  assert.equal(out.length, 2);
  assert.equal(new Set(out.map((o) => o.id)).size, 2);
});
