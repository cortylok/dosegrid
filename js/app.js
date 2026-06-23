// js/app.js
import { renderGrid, showLanding } from './ui.js';
import { renderHomePain, renderTimelineView, refreshTimeline } from './painview.js';
import { setPro, refreshEntitlement } from './pro.js';
import { recordUsageDay } from './gating.js';
import { syncNotifications } from './notify.js';
import { loadDataset, backfillComponents } from './data.js';
import { loadMeds, saveMeds } from './storage.js';
import { applyTheme } from './theme.js';

applyTheme();

const ONBOARD_KEY = 'dosegrid.onboarded';

// Freemium: all data is retained on-device; the view is gated to 24h for free
// users (see gating.js). We deliberately no longer prune on boot.

// Dev/test entitlement toggle (web build only): ?pro=1 unlocks, ?pro=0 clears.
const params = new URLSearchParams(location.search);
if (params.has('pro')) setPro(params.get('pro') !== '0');

// Track distinct days of use (drives the one-off upgrade nudge).
recordUsageDay();
syncNotifications();

let currentView = 'home';

// On native, sync Pro entitlement from the store (auto-recovers after reinstall),
// then re-render + resync notifications once ownership is known. No-op on web.
refreshEntitlement().then(() => { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); syncNotifications(); });

// Re-render the mounted UI whenever entitlement changes (e.g. after purchase/restore).
document.addEventListener('dosegrid:refresh', () => { renderGrid(); renderHomePain(); refreshTimeline(); });

// Backfill ingredient components onto meds saved before per-ingredient tracking
// existed, so the cross-med overdose tally counts them. One-time: once a med has
// components it's skipped, so this is a no-op on later boots.
loadDataset().then((ds) => {
  const meds = loadMeds();
  if (backfillComponents(meds, ds)) { saveMeds(meds); renderGrid(); renderHomePain(); refreshTimeline(); }
});

function setView(view) {
  currentView = view;
  document.getElementById('home-view').hidden = view !== 'home';
  document.getElementById('timeline-view').hidden = view !== 'timeline';
  document.getElementById('tab-home').classList.toggle('active', view === 'home');
  document.getElementById('tab-timeline').classList.toggle('active', view === 'timeline');
  if (view === 'home') { renderHomePain(); renderGrid(); } else { renderTimelineView(); }
}
document.getElementById('tab-home').addEventListener('click', () => setView('home'));
document.getElementById('tab-timeline').addEventListener('click', () => setView('timeline'));

// Start on Home (pain summary + Log pain + med grid)
setView('home');

// First launch → landing page (unchanged)
if (!localStorage.getItem(ONBOARD_KEY)) {
  showLanding({ showDismiss: true, onDismiss: () => localStorage.setItem(ONBOARD_KEY, '1') });
}
document.getElementById('about-btn').addEventListener('click', () => showLanding());

// Keep dose countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderHomePain(); refreshTimeline(); syncNotifications(); } });

// Register the service worker on the web only. In a Capacitor native build the
// app is bundled locally (offline already works), and a network-first SW against
// the capacitor:// scheme can misbehave, so we skip it there.
const isNativePlatform = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
if (!isNativePlatform && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
