// js/app.js
import { renderGrid, showLanding } from './ui.js';
import { renderPainView } from './painview.js';
import { setPro, refreshEntitlement } from './pro.js';
import { recordUsageDay } from './gating.js';
import { syncNotifications } from './notify.js';
import { loadDataset, backfillComponents } from './data.js';
import { loadMeds, saveMeds } from './storage.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Freemium: all data is retained on-device; the view is gated to 24h for free
// users (see gating.js). We deliberately no longer prune on boot.

// Dev/test entitlement toggle (web build only): ?pro=1 unlocks, ?pro=0 clears.
const params = new URLSearchParams(location.search);
if (params.has('pro')) setPro(params.get('pro') !== '0');

// Track distinct days of use (drives the one-off upgrade nudge).
recordUsageDay();
syncNotifications();

// On native, sync Pro entitlement from the store (auto-recovers after reinstall),
// then re-render + resync notifications once ownership is known. No-op on web.
refreshEntitlement().then(() => { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); syncNotifications(); });

// Re-render both views whenever entitlement changes (e.g. after purchase/restore).
document.addEventListener('dosegrid:refresh', () => { renderGrid(); renderPainView(); });

// Render both views (Meds view starts hidden; Pain is the default focus)
renderGrid();
renderPainView();

// Backfill ingredient components onto meds saved before per-ingredient tracking
// existed, so the cross-med overdose tally counts them. One-time: once a med has
// components it's skipped, so this is a no-op on later boots.
loadDataset().then((ds) => {
  const meds = loadMeds();
  if (backfillComponents(meds, ds)) { saveMeds(meds); renderGrid(); renderPainView(); }
});

function setView(view) {
  const pain = view === 'pain';
  document.getElementById('pain-view').hidden = !pain;
  document.getElementById('meds-view').hidden = pain;
  document.getElementById('tab-pain').classList.toggle('active', pain);
  document.getElementById('tab-meds').classList.toggle('active', !pain);
  if (pain) renderPainView(); else renderGrid();
}
document.getElementById('tab-pain').addEventListener('click', () => setView('pain'));
document.getElementById('tab-meds').addEventListener('click', () => setView('meds'));

// Start on the Meds grid by default
setView('meds');

// First launch → landing page (unchanged)
if (!localStorage.getItem(ONBOARD_KEY)) {
  showLanding({ showDismiss: true, onDismiss: () => localStorage.setItem(ONBOARD_KEY, '1') });
}
document.getElementById('about-btn').addEventListener('click', () => showLanding());

// Keep dose countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderPainView(); syncNotifications(); } });

// Register the service worker on the web only. In a Capacitor native build the
// app is bundled locally (offline already works), and a network-first SW against
// the capacitor:// scheme can misbehave, so we skip it there.
const isNativePlatform = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
if (!isNativePlatform && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
