import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = (() => {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
})();

const { loadNotifySettings, saveNotifySettings } = await import('../js/storage.js');

beforeEach(() => localStorage.clear());

test('loadNotifySettings returns defaults when unset', () => {
  assert.deepEqual(loadNotifySettings(), { quietStart: '22:00', quietEnd: '07:00' });
});

test('saveNotifySettings round-trips and merges over defaults', () => {
  saveNotifySettings({ quietStart: '23:00' });
  assert.deepEqual(loadNotifySettings(), { quietStart: '23:00', quietEnd: '07:00' });
});
