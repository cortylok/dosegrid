// js/pro.js — single entitlement seam.
// Native purchasing is delegated to js/iap.js; on web the dev stub grants directly.
import { isAvailable, buyPro, restorePro, isProOwned } from './iap.js';

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

// Native: sync the local entitlement from the store's ownership (non-intrusive).
// Called on boot so Pro auto-recovers after reinstall. No-op on web.
export async function refreshEntitlement() {
  if (isAvailable()) setPro(await isProOwned());
}
