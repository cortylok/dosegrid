import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRO_PRODUCT_ID, isAvailable, getProPrice, isProOwned, buyPro, restorePro } from '../js/iap.js';

test('IAP seam is inert on web / without the native plugin', async () => {
  assert.equal(PRO_PRODUCT_ID, 'dosegrid_pro');
  assert.equal(isAvailable(), false);
  assert.equal(await getProPrice(), null);
  assert.equal(await isProOwned(), false);
  assert.equal(await buyPro(), false);
  assert.equal(await restorePro(), false);
});
