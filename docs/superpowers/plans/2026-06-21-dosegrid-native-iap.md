# DoseGrid Native IAP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a real one-time "DoseGrid Pro" purchase (`dosegrid_pro` non-consumable) into the `pro.js` entitlement seam via `@capgo/native-purchases`, with the paywall showing the store price.

**Architecture:** A thin `js/iap.js` wraps the `NativePurchases` plugin through the `window.Capacitor.Plugins` global (buildless-safe; web no-op). `pro.js` delegates `purchasePro`/`restorePurchases` to it on native and keeps the dev stub on web. Entitlement persists in the local `dosegrid.pro` flag (set on purchase/restore); Restore recovers it after reinstall.

**Tech Stack:** Capacitor 8 `@capgo/native-purchases`, vanilla ES modules, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-21-dosegrid-native-iap-design.md`

---

## File Structure

- **Create** `js/iap.js` — native purchase seam (web no-op).
- **Create** `tests/iap.test.js` — verifies the seam is inert on web/Node.
- **Modify** `js/pro.js` — delegate purchase/restore to `iap.js` on native.
- **Modify** `js/ui.js` (`openPaywall`) — show store price + purchase-result message.
- **Modify** `package.json` — add the plugin.
- **Modify** `service-worker.js` — precache `iap.js` + bump cache.
- **Modify** `README.md` — one-time-purchase note + store-setup checklist.

---

### Task 1: Install `@capgo/native-purchases`

**Files:** `package.json` (+ lock), native plugin-registration files

- [ ] **Step 1: Install**

Run: `npm install @capgo/native-purchases`
Expected: added under `dependencies`. (Needs internet.)

- [ ] **Step 2: Sync into native projects**

Run: `npm run sync`
Expected: `cap sync` lists `@capgo/native-purchases` for both android + ios. (CocoaPods note on Windows acceptable; Cap 8 iOS = SPM.)

- [ ] **Step 3: Tests still green**

Run: `node --test`
Expected: PASS — 69 tests, 0 fail.

- [ ] **Step 4: Stage the plugin registration too, then commit**

`cap sync` updates the native plugin-registration files. Stage them with the package files (do NOT add `node_modules`/`www`):

```bash
git add package.json package-lock.json android/app/capacitor.build.gradle android/capacitor.settings.gradle ios/App/CapApp-SPM/Package.swift
git commit -m "build: add @capgo/native-purchases plugin"
```

(If `git status` shows other tracked native files changed by sync, add those too; never commit gitignored `public/` build outputs.)

---

### Task 2: Native purchase seam `iap.js` (TDD for the web no-op)

**Files:** Create `js/iap.js`; Create `tests/iap.test.js`

- [ ] **Step 1: Confirm the plugin's real API shape**

Run: `ls node_modules/@capgo/native-purchases/dist/esm/ && sed -n '1,200p' node_modules/@capgo/native-purchases/dist/esm/definitions.d.ts`
Read the TypeScript definitions to confirm the exact method names (`getProducts`, `purchaseProduct`, `restorePurchases`), their option keys (`productIdentifiers` / `productIdentifier`), and the response shapes (product `priceString`/`price`; restore/transaction `productIdentifier`/`productId`). The implementation below uses defensive field access; if the definitions show different exact names, adjust the field reads in Step 3 to match. (No "ownership query" method exists — confirm this.)

- [ ] **Step 2: Write the failing test**

```javascript
// tests/iap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRO_PRODUCT_ID, isAvailable, getProPrice, buyPro, restorePro } from '../js/iap.js';

test('IAP seam is inert on web / without the native plugin', async () => {
  assert.equal(PRO_PRODUCT_ID, 'dosegrid_pro');
  assert.equal(isAvailable(), false);
  assert.equal(await getProPrice(), null);
  assert.equal(await buyPro(), false);
  assert.equal(await restorePro(), false);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test tests/iap.test.js`
Expected: FAIL — cannot import `../js/iap.js`.

- [ ] **Step 4: Write the implementation**

```javascript
// js/iap.js — native in-app-purchase seam. Web build is a no-op.
// Accesses the plugin via the Capacitor global (no bundler). Only this file
// touches the purchase plugin. Entitlement state itself lives in pro.js.
export const PRO_PRODUCT_ID = 'dosegrid_pro';

const NP = () => (typeof window !== 'undefined'
  && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases) || null;

export function isAvailable() {
  return !!(typeof window !== 'undefined' && window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform() && NP());
}

// Store-localized price string for the Pro product, or null on web/error.
export async function getProPrice() {
  const np = NP(); if (!np) return null;
  try {
    const res = await np.getProducts({ productIdentifiers: [PRO_PRODUCT_ID] });
    const p = res && res.products && res.products[0];
    return (p && (p.priceString || p.price)) || null;
  } catch { return null; }
}

// Start the native purchase; true on a completed transaction, false on cancel/error.
export async function buyPro() {
  const np = NP(); if (!np) return false;
  try {
    const tx = await np.purchaseProduct({ productIdentifier: PRO_PRODUCT_ID });
    return !!tx;
  } catch { return false; }
}

// Replay store purchases; true if dosegrid_pro is among them.
export async function restorePro() {
  const np = NP(); if (!np) return false;
  try {
    const res = await np.restorePurchases();
    const list = (res && (res.transactions || res.purchases)) || (Array.isArray(res) ? res : []);
    return list.some((t) => (t.productIdentifier || t.productId) === PRO_PRODUCT_ID);
  } catch { return false; }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/iap.test.js`
Expected: PASS — 1 test. Then `node --test` → 70 tests, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add js/iap.js tests/iap.test.js
git commit -m "feat(iap): add native purchase seam (web no-op)"
```

---

### Task 3: Delegate purchase/restore in `pro.js`

**Files:** Modify `js/pro.js`

- [ ] **Step 1: Add the import**

At the top of `js/pro.js` (after the `PRO_KEY` line), add:

```javascript
import { isAvailable, buyPro, restorePro } from './iap.js';
```

- [ ] **Step 2: Replace the two stubs**

Replace:

```javascript
// Stub for the test/web build: a "purchase" simply grants the entitlement.
export async function purchasePro() { setPro(true); return true; }

// Stub: there is nothing to restore on web beyond the local flag.
export async function restorePurchases() { return isPro(); }
```

with:

```javascript
// Native: run the real purchase and grant on success. Web/dev: grant directly.
export async function purchasePro() {
  if (isAvailable()) { const ok = await buyPro(); if (ok) setPro(true); return ok; }
  setPro(true);
  return true;
}

// Native: restore from the store and grant if owned. Web/dev: reflect the local flag.
export async function restorePurchases() {
  if (isAvailable()) { const ok = await restorePro(); if (ok) setPro(true); return ok; }
  return isPro();
}
```

- [ ] **Step 3: Verify (existing pro tests still pass — they exercise the web branch)**

Run: `node --check js/pro.js && node --test`
Expected: no syntax error; 70 tests pass, 0 fail. (In Node, `isAvailable()` is false, so `purchasePro()` still grants via the dev path and `tests/pro.test.js` stays green.)

- [ ] **Step 4: Commit**

```bash
git add js/pro.js
git commit -m "feat(pro): wire purchase/restore to native IAP (web dev stub kept)"
```

---

### Task 4: Paywall — store price + result message (`ui.js`)

**Files:** Modify `js/ui.js` (`openPaywall`, ~lines 527–564)

- [ ] **Step 1: Import the price getter**

Add to `js/ui.js` (next to the other seam imports, e.g. after the `notify.js` import):

```javascript
import { getProPrice } from './iap.js';
```

- [ ] **Step 2: Add an error line to the paywall markup**

In `openPaywall`, in the non-Pro `openSheet(...)` call, change the closing disclaimer line:

```javascript
    `<p class="disc muted">Your data already stays on your device. Pro only changes how much of it you can see.</p>`
```

to add an (initially empty) message line before it:

```javascript
    `<p class="pw-msg muted" id="pw-msg"></p>` +
    `<p class="disc muted">Your data already stays on your device. Pro only changes how much of it you can see.</p>`
```

- [ ] **Step 3: Fetch + show the real price, and handle results**

Replace the two button handlers at the end of `openPaywall`:

```javascript
  modalRoot().querySelector('#pw-buy').addEventListener('click', async () => {
    await purchasePro();
    closeModal();
    refreshViews();
  });
  modalRoot().querySelector('#pw-restore').addEventListener('click', async () => {
    const ok = await restorePurchases();
    closeModal();
    if (ok) refreshViews();
  });
```

with:

```javascript
  // Show the store-localized price when available (native); falls back to placeholder.
  getProPrice().then((price) => {
    if (!price) return;
    const buy = modalRoot().querySelector('#pw-buy');
    if (buy) buy.textContent = `Unlock — ${price}`;
  });
  const msg = () => modalRoot().querySelector('#pw-msg');
  modalRoot().querySelector('#pw-buy').addEventListener('click', async () => {
    const ok = await purchasePro();
    if (ok) { closeModal(); refreshViews(); }
    else if (msg()) msg().textContent = 'Purchase didn’t complete. You can try again.';
  });
  modalRoot().querySelector('#pw-restore').addEventListener('click', async () => {
    const ok = await restorePurchases();
    if (ok) { closeModal(); refreshViews(); }
    else if (msg()) msg().textContent = 'No previous purchase found to restore.';
  });
```

- [ ] **Step 4: Verify**

Run: `node --check js/ui.js && node --test`
Expected: no syntax error; 70 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): paywall shows store price + purchase/restore result"
```

---

### Task 5: Service worker, README + checklist, sync, final verify

**Files:** Modify `service-worker.js`, `README.md`

- [ ] **Step 1: Precache `iap.js` + bump the cache**

In `service-worker.js`: change `const CACHE = 'dosegrid-v11';` → `'dosegrid-v12';`, and add `'./js/iap.js',` to the `ASSETS` array (after the `'./js/notify.js', './js/notify-schedule.js',` line).

- [ ] **Step 2: Document the purchase + the owner store-setup checklist in `README.md`**

Append a section to `README.md`:

```markdown
## DoseGrid Pro in-app purchase

Pro is a one-time non-consumable unlock (`dosegrid_pro`) via `@capgo/native-purchases` (no backend — the app trusts the store). Entitlement is stored locally; **Restore** recovers it after a reinstall.

**Before release, in the stores (one-time setup):**
- **App Store Connect:** Paid Apps agreement active (tax/banking); create a **Non-Consumable** IAP, Product ID **`dosegrid_pro`**, set price + localized name/description, submit with the build; add a **Sandbox tester**.
- **Google Play Console:** upload to an internal/closed **test track**; create a one-time **in-app product**, Product ID **`dosegrid_pro`**, set price, activate; add a **license tester**.
- **Verify on a device** (sandbox/test account): purchase unlocks Pro; **Restore** re-unlocks after reinstall; the price shows in local currency.
```

- [ ] **Step 3: Sync**

Run: `npm run sync`
Expected: `build:www` + `cap sync` complete; `www/js/iap.js` copied; both platforms updated.

- [ ] **Step 4: Final verification**

Run: `node --test`
Expected: PASS — 70 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: precache iap.js, bump SW cache, document Pro IAP + store setup"
```

---

## Self-Review

**Spec coverage:**
- Plugin `@capgo/native-purchases` installed + native registration committed → Task 1. ✓
- `iap.js` seam (`isAvailable`/`getProPrice`/`buyPro`/`restorePro`, Capacitor global, web no-op) → Task 2. ✓
- `pro.js` delegates on native, dev stub on web; local flag persistence → Task 3. ✓
- No boot store query (entitlement = local flag; Restore recovers) → Tasks 3 (no boot call) + spec. ✓
- Paywall store price + result handling → Task 4. ✓
- No-server / trust-the-store → Tasks 2–3 (no validation calls). ✓
- Owner store-setup checklist → Task 5 (README). ✓
- Suite stays green; web branch unit-tested; native not unit-testable → Tasks 2–4. ✓

**Placeholder scan:** none. The `PRO_PRICE` placeholder in `openPaywall` is intentionally retained as the pre-price fallback (real price overrides it at runtime). Field-name "adjust if the .d.ts differs" in Task 2 is a concrete verification step, not a placeholder.

**Type/name consistency:** `isAvailable`/`getProPrice`/`buyPro`/`restorePro`/`PRO_PRODUCT_ID` defined in Task 2, consumed in Tasks 3 (`pro.js`) and 4 (`ui.js`, `getProPrice` only). `purchasePro`/`restorePurchases` signatures unchanged (callers in `ui.js` already use them). Product id `dosegrid_pro` consistent across `iap.js`, README, and the store checklist.

**Note for executor:** Tasks 1 & 5 run `npm run sync` (needs the Capacitor toolchain; CocoaPods note on Windows acceptable). Task 1 MUST commit the native plugin-registration files (`capacitor.build.gradle`, `capacitor.settings.gradle`, `Package.swift`) or the native build won't include the plugin. Test count is 70 from Task 2 onward (69 + 1 iap test). This feature can be fully built but only **verified on a real device with store sandbox + the owner's accounts** — do not attempt to test a real purchase here.
