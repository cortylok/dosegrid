// js/app.js
import { loadDoses, saveDoses, pruneDoses, loadPain, savePain, prunePain } from './storage.js';
import { renderGrid, showLanding } from './ui.js';
import { renderPainView } from './painview.js';

const ONBOARD_KEY = 'dosegrid.onboarded';

// Prune old data on startup (doses 14d, pain 90d)
saveDoses(pruneDoses(loadDoses()));
savePain(prunePain(loadPain()));

// Render both views (Meds view starts hidden; Pain is the default focus)
renderGrid();
renderPainView();

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
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderPainView(); } });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
