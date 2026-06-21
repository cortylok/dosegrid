// tests/pro.test.js
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

const { isPro, setPro, purchasePro, restorePurchases } = await import('../js/pro.js');

beforeEach(() => localStorage.clear());

test('isPro defaults to false', () => {
  assert.equal(isPro(), false);
});

test('setPro(true) persists and isPro reflects it', () => {
  setPro(true);
  assert.equal(isPro(), true);
  assert.equal(localStorage.getItem('dosegrid.pro'), '1');
  setPro(false);
  assert.equal(isPro(), false);
});

test('purchasePro stub grants entitlement and resolves true', async () => {
  assert.equal(await purchasePro(), true);
  assert.equal(isPro(), true);
});

test('restorePurchases reflects current entitlement', async () => {
  assert.equal(await restorePurchases(), false);
  setPro(true);
  assert.equal(await restorePurchases(), true);
});
