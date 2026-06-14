// js/app.js
import { loadDoses, saveDoses, pruneDoses } from './storage.js';
import { renderGrid, showAbout } from './ui.js';

// Prune doses older than 48h on startup
saveDoses(pruneDoses(loadDoses()));

renderGrid();
document.getElementById('about-btn').addEventListener('click', showAbout);

// Keep countdowns + midnight reset fresh
setInterval(renderGrid, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderGrid(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
