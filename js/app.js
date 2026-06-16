// js/app.js
import { loadDoses, saveDoses, pruneDoses } from './storage.js';
import { renderGrid, showLanding } from './ui.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Prune doses older than 14 days on startup
saveDoses(pruneDoses(loadDoses()));

renderGrid();

// Auto-show the landing page on launch until the user ticks "Don't show this again"
if (!localStorage.getItem(ONBOARD_KEY)) {
  showLanding({ showDismiss: true, onDismiss: () => localStorage.setItem(ONBOARD_KEY, '1') });
}

// Header button reopens the landing page any time (informational, no checkbox)
document.getElementById('about-btn').addEventListener('click', () => showLanding());

// Keep countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderGrid(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
