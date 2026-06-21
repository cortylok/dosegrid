// js/pro.js — single entitlement seam.
// The native in-app-purchase layer (separate spec) replaces purchasePro/restorePurchases;
// no other code in the app touches the store.
const PRO_KEY = 'dosegrid.pro';

export function isPro() {
  try { return localStorage.getItem(PRO_KEY) === '1'; } catch { return false; }
}

export function setPro(on) {
  try {
    if (on) localStorage.setItem(PRO_KEY, '1');
    else localStorage.removeItem(PRO_KEY);
  } catch { /* ignore */ }
}

// Stub for the test/web build: a "purchase" simply grants the entitlement.
export async function purchasePro() { setPro(true); return true; }

// Stub: there is nothing to restore on web beyond the local flag.
export async function restorePurchases() { return isPro(); }
