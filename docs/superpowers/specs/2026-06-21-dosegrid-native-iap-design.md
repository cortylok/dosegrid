# DoseGrid Native IAP — Design

**Date:** 2026-06-21
**Status:** Approved (design); pending spec review
**Scope:** Wire a real one-time "DoseGrid Pro" in-app purchase into the existing `js/pro.js` entitlement seam, using `@capgo/native-purchases` (npm package name; GitHub repo `Cap-go/capacitor-native-purchases`; Capacitor global `NativePurchases`). Sub-project **#3** — the last build piece of the freemium/native track (#1 gating, #2 Capacitor, #4 notifications already shipped).

## Summary

`js/pro.js` already exposes the entitlement seam the whole app routes through (`isPro`/`setPro`/`purchasePro`/`restorePurchases`); `purchasePro`/`restorePurchases` are stubs. This sub-project replaces those stubs with real native purchasing of a single **non-consumable** product, `dosegrid_pro`, via a thin native seam `js/iap.js` (plugin accessed through the `window.Capacitor.Plugins.NativePurchases` global — buildless-safe; **web is a no-op** keeping the `?pro=1` dev toggle). No backend ("trust the store"). The plugin is minimal (`getProducts`/`purchaseProduct`/`restorePurchases`) with **no non-intrusive ownership query**, so the persistent entitlement is the local `dosegrid.pro` flag — set on a successful purchase or restore — and the **Restore** button recovers it after a reinstall. We deliberately do **not** query the store on boot (that would require an intrusive `restorePurchases` login prompt every launch). The paywall shows the **store-localized price** and surfaces purchase errors.

**Reality:** all the *code* ships here, but the feature is only *complete* once the owner creates the products in App Store Connect + Play Console and sandbox-tests on a device (needs their accounts). The spec includes that checklist.

## Locked decisions

1. **Plugin:** `@capgo/native-purchases` (Capacitor-native, free, no third-party service).
2. **Product:** one **non-consumable**, id **`dosegrid_pro`** (one-time lifetime unlock).
3. **Validation:** **no server** — trust StoreKit / Play Billing via the plugin's purchase/restore results.
4. **Seam:** new `js/iap.js` wraps the plugin; `js/pro.js` delegates to it on native, keeps the dev stub on web.
5. **Web build:** no-op IAP; existing `?pro=1`/`?pro=0` dev toggle + paywall stub-unlock unchanged.
6. **Persistence:** local `dosegrid.pro` flag is the durable entitlement (set on purchase/restore); **Restore** recovers it after reinstall. No store query on boot.

## Architecture

```
paywall (ui.js)  ── purchasePro / restorePurchases / getProPrice ──►  pro.js
app.js (boot)    ── refreshEntitlement ───────────────────────────►  pro.js
                                                                        │ native?
                                                          ┌─────────────┴─────────────┐
                                                       web: dev stub        native: iap.js
                                                       (setPro / isPro)      (window.Capacitor.Plugins.NativePurchases)
```

### Components

**`js/iap.js` (new — native seam; web no-op)**
- `PRO_PRODUCT_ID = 'dosegrid_pro'`.
- `LN()` → `window.Capacitor?.Plugins?.NativePurchases || null`; `isAvailable()` → native platform **and** plugin present.
- `getProPrice()` → returns the store-localized price string for `dosegrid_pro` (via the plugin's product query), or `null` if unavailable/web.
- `buyPro()` → calls `NativePurchases.purchaseProduct({ productIdentifier: 'dosegrid_pro', productType: <non-consumable> })`; resolves `true` if it returns a transaction, `false` on cancel/error. All plugin calls in try/catch (no throw).
- `restorePro()` → calls `NativePurchases.restorePurchases()` and resolves `true` if the returned transactions include `dosegrid_pro`.
- (`getProducts({ productIdentifiers: ['dosegrid_pro'] })` backs `getProPrice`. Exact field/enum names are pinned during implementation against the installed `@capgo/native-purchases` API; the seam's *exported* surface above is fixed. No ownership-query method exists in this plugin — by design, entitlement is the local flag.)

**`js/pro.js` (modify)** — keep `isPro`/`setPro` (localStorage cache) unchanged. Rewrite the two stubs:
- `purchasePro()` → `if (isAvailable()) { const ok = await buyPro(); if (ok) setPro(true); return ok; }` else the existing dev behavior (`setPro(true); return true;`).
- `restorePurchases()` → `if (isAvailable()) { const ok = await restorePro(); if (ok) setPro(true); return ok; }` else `return isPro();`.
- `pro.js` imports the seam from `iap.js` (one-way; `iap.js` imports nothing from `pro.js`). The persistent entitlement is the existing `dosegrid.pro` localStorage flag — no boot store query.

**`js/app.js` (modify)** — **no change needed for entitlement** (the localStorage flag persists across launches; `dosegrid:refresh` already re-renders after purchase/restore). (Listed for completeness: app.js is untouched by this sub-project.)

**`js/ui.js` (modify, `openPaywall`)** — already calls `purchasePro()`/`restorePurchases()`. Add: on open, `await getProPrice()` and show it in the Unlock button (fallback to the existing placeholder); show an inline error line if `purchasePro()` resolves false due to an error (distinguish silent cancel from error where the plugin allows).

**`package.json` (modify)** — add `@capgo/native-purchases`; `npx cap sync` to register it natively.

## Data flow

1. **Boot:** entitlement = local `dosegrid.pro` flag (persists across launches); no store call.
2. **Buy:** Unlock → `purchasePro()` → native purchase sheet → success → `setPro(true)` → `dosegrid:refresh` → locks gone. Cancel → nothing. Error → inline message, no grant.
3. **Restore (e.g. after reinstall):** Restore → `restorePurchases()` → if `dosegrid_pro` owned → `setPro(true)`.
4. **Web:** `isAvailable()` false everywhere → dev stub/toggle path; nothing changes from today.

## Owner's store-setup checklist (required to complete; not code)

- **App Store Connect:** active Paid Apps agreement (tax/banking); create a **Non-Consumable** in-app purchase, Product ID **`dosegrid_pro`**, set price, add localized name/description, submit with the app build; create a **Sandbox tester**.
- **Google Play Console:** upload the app to an internal/closed **test track**; create an **in-app product** (one-time), Product ID **`dosegrid_pro`**, set price, activate it; add a **license tester**.
- **Verify on a real device** (sandbox/test account): purchase succeeds and unlocks Pro; **Restore** re-unlocks after reinstall; price displays in the local currency.
- iOS build ships via Xcode Cloud; Android `.aab` via Gradle (existing #2 pipeline).

## Testing

- **`node --test`:** the suite stays green. `pro.js` web-path behavior remains unit-testable (the existing `tests/pro.test.js` exercises the stub/`setPro`/`isPro` path, which is the web branch — `isAvailable()` is false in Node, so `purchasePro()` still grants via the dev path; tests unchanged/green). `iap.js` native calls are not unit-testable (no plugin in Node) and are guarded to no-op.
- **Manual (device, REQUIRED):** sandbox purchase, restore-after-reinstall, localized price, error/cancel handling — the only way to truly verify IAP.

## Risks / notes

- **Cannot be fully verified in CI / on Windows** — store purchase flows require a real device + store sandbox + the owner's accounts. The plan delivers code + checklist; the owner finishes verification.
- **No-server trust:** minor piracy exposure, accepted for a low-price one-time unlock (decision made by owner).
- **Plugin API drift:** the exported `iap.js` surface is fixed; internal plugin method names are confirmed against the installed version during implementation.
- **Seam discipline preserved:** `iap.js` is the only file touching the purchase plugin; `pro.js` remains the single entitlement seam every other module already uses. Safety + free-tier behavior unaffected.

## Implementation note (2026-06-21, from the installed plugin's `.d.ts`)

`@capgo/native-purchases` **does** expose a non-intrusive ownership query — `getPurchases() → { purchases: Transaction[] }` (StoreKit 2 currentEntitlements / Play queryPurchases; no login prompt). This reverses the earlier "no ownership query" assumption. Final `iap.js` surface: `isAvailable()`, `getProPrice()` (`getProducts → products[0].priceString`), `buyPro()` (`purchaseProduct → Transaction`), `isProOwned()` (`getPurchases` includes `dosegrid_pro`), `restorePro()` (`restorePurchases()` [returns void] then `isProOwned()`). Because `isProOwned()` is non-intrusive, `pro.js` gains `refreshEntitlement()` (= `setPro(await isProOwned())`) called on **boot**, so Pro auto-recovers after reinstall / on the user's other devices; the **Restore** button remains as an explicit fallback.

## Out of scope

Subscriptions / multiple tiers; promo codes; server-side receipt validation; family sharing config — all future possibilities, not this spec.
