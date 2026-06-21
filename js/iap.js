// js/iap.js — native in-app-purchase seam. Web build is a no-op.
// Accesses the plugin via the Capacitor global (no bundler). Only this file
// touches the purchase plugin; entitlement state itself lives in pro.js.
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
    return (p && p.priceString) || null;
  } catch { return null; }
}

// Non-intrusive ownership check (StoreKit 2 currentEntitlements / Play queryPurchases).
export async function isProOwned() {
  const np = NP(); if (!np) return false;
  try {
    const res = await np.getPurchases();
    const list = (res && res.purchases) || [];
    return list.some((t) => t.productIdentifier === PRO_PRODUCT_ID);
  } catch { return false; }
}

// Start the native purchase; true on a completed transaction, false on cancel/error.
export async function buyPro() {
  const np = NP(); if (!np) return false;
  try {
    const tx = await np.purchaseProduct({ productIdentifier: PRO_PRODUCT_ID });
    return !!tx;
  } catch { return false; }
}

// Replay store purchases (returns void), then report ownership.
export async function restorePro() {
  const np = NP(); if (!np) return false;
  try {
    try { await np.restorePurchases(); } catch { /* getPurchases is the real check */ }
    return await isProOwned();
  } catch { return false; }
}
