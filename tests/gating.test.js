// tests/gating.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const {
  FREE_WINDOW_MS, visibleWindow, hiddenCount, shouldNudge,
  recordUsageDay, usageDayCount, nudgeSeen, markNudgeSeen,
} = await import('../js/gating.js');

beforeEach(() => localStorage.clear());

test('visibleWindow: Pro sees everything, free is clamped to 24h', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(visibleWindow(now, true), { fromTs: -Infinity, locked: false });
  assert.deepEqual(visibleWindow(now, false), { fromTs: now - FREE_WINDOW_MS, locked: true });
});

test('hiddenCount: counts entries older than 24h for free, 0 for Pro', () => {
  const now = 1_000_000_000_000;
  const entries = [
    { timestamp: now - 1000 },
    { timestamp: now - 2 * FREE_WINDOW_MS },
    { timestamp: now - 5 * FREE_WINDOW_MS },
  ];
  assert.equal(hiddenCount(entries, now, false), 2);
  assert.equal(hiddenCount(entries, now, true), 0);
});

test('shouldNudge: only when free + locked data + >=5 usage days + not seen', () => {
  const base = { pro: false, hasLockedData: true, usageDays: 5, nudgeSeen: false };
  assert.equal(shouldNudge(base), true);
  assert.equal(shouldNudge({ ...base, pro: true }), false);
  assert.equal(shouldNudge({ ...base, hasLockedData: false }), false);
  assert.equal(shouldNudge({ ...base, usageDays: 4 }), false);
  assert.equal(shouldNudge({ ...base, nudgeSeen: true }), false);
});

test('recordUsageDay counts distinct days only', () => {
  const day = 24 * 3600 * 1000;
  const t = 1_700_000_000_000;
  recordUsageDay(t);
  recordUsageDay(t + 3600 * 1000); // same day
  assert.equal(usageDayCount(), 1);
  recordUsageDay(t + day); // next day
  assert.equal(usageDayCount(), 2);
});

test('nudgeSeen flag round-trips', () => {
  assert.equal(nudgeSeen(), false);
  markNudgeSeen();
  assert.equal(nudgeSeen(), true);
});
