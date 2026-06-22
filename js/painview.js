// js/painview.js — the Pain view: current-pain summary, log sheet, and zoomable timeline.
import { loadPain, savePain, addPain, loadMeds, loadDoses } from './storage.js';
import { severity, latestPain, painColor, medColor } from './pain.js';
import { openSheet, closeModal, modalRoot, openPaywall } from './ui.js';
import { createTimeline } from './timeline.js';
import { isPro } from './pro.js';
import { shouldNudge, hiddenCount, usageDayCount, nudgeSeen, markNudgeSeen } from './gating.js';

const homePainEl = () => document.getElementById('home-pain');
const timelineViewEl = () => document.getElementById('timeline-view');
let timeline = null;

// Re-render whatever pain-driven UI is mounted (used after a pain entry changes).
function afterPainChange() { renderHomePain(); if (timeline) timeline.render(); }

// Cheap re-render of the chart if it exists (used by app.js on refresh ticks).
export function refreshTimeline() { if (timeline) timeline.render(); }

function fmtRelative(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(ts).toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function renderHomePain() {
  const pain = loadPain();
  const last = latestPain(pain);
  const summary = last
    ? `<div class="pain-now"><div class="pain-score" style="color:${painColor(last.score)}">${last.score}<span>/10</span></div>` +
      `<div class="pain-meta">${severity(last.score)} · logged ${fmtRelative(last.timestamp)}${last.note ? `<br><span class="muted">“${last.note}”</span>` : ''}</div></div>`
    : `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;

  const now = Date.now();
  const allEntries = [...loadPain(), ...loadDoses()];
  const nudge = shouldNudge({
    pro: isPro(),
    hasLockedData: hiddenCount(allEntries, now, isPro()) > 0,
    usageDays: usageDayCount(),
    nudgeSeen: nudgeSeen(),
  })
    ? `<div class="pro-nudge"><span>You've been building history that's locked to the last 24h. ` +
      `<a href="#" id="nudge-open">Unlock it with Pro →</a></span>` +
      `<button id="nudge-dismiss" aria-label="Dismiss">✕</button></div>`
    : '';

  homePainEl().innerHTML =
    nudge + summary +
    `<button class="btn pain-log-btn" id="log-pain">＋ Log pain</button>`;

  homePainEl().querySelector('#log-pain').addEventListener('click', openPainLog);
  homePainEl().querySelector('#nudge-open')?.addEventListener('click', (e) => { e.preventDefault(); openPaywall(); });
  homePainEl().querySelector('#nudge-dismiss')?.addEventListener('click', () => { markNudgeSeen(); renderHomePain(); });
}

export function renderTimelineView() {
  const meds = loadMeds().slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const legend = meds.length
    ? `<div class="tl-legend">` + meds.map((m) => `<span><i style="background:${medColor(m.order || 0)}"></i>${m.name}</span>`).join('') + `</div>`
    : '';

  timelineViewEl().innerHTML =
    `<div class="tl-bar"><span class="tl-hint">Drag · pinch to zoom</span>` +
      `<span style="flex:1"></span>` +
      `<button class="zb" id="tl-today">Today</button><button class="zb" id="tl-week">Week</button>` +
      `<button class="zb" id="tl-out">–</button><button class="zb" id="tl-in">+</button></div>` +
    `<div class="tl-host" id="tl-host"></div>` +
    legend;

  const hostEl = timelineViewEl().querySelector('#tl-host');
  timeline = createTimeline(hostEl, { onPainClick: openPainDetail, onDoseClick: openDoseDetail, onDoseGroup: openDoseGroup, onUpgrade: openPaywall });
  timeline.render();
  timelineViewEl().querySelector('#tl-today').addEventListener('click', () => timeline.showToday());
  timelineViewEl().querySelector('#tl-week').addEventListener('click', () => timeline.showWeek());
  timelineViewEl().querySelector('#tl-in').addEventListener('click', () => timeline.zoomIn());
  timelineViewEl().querySelector('#tl-out').addEventListener('click', () => timeline.zoomOut());
}

export function openPainDetail(id) {
  const entry = loadPain().find((p) => p.id === id);
  if (!entry) return;
  const when = new Date(entry.timestamp).toLocaleString([],
    { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  openSheet(
    `<h2 style="color:${painColor(entry.score)}">Pain ${entry.score}/10 <span class="muted" style="color:var(--muted)">· ${severity(entry.score)}</span></h2>` +
    `<p class="muted">${when}</p>` +
    `<p>${entry.note ? entry.note.replace(/</g, '&lt;') : '<span class="muted">No note added.</span>'}</p>` +
    `<div class="btn-row"><button class="btn danger" id="pd-del">Delete</button>` +
    `<button class="btn" id="pd-close">Close</button></div>`
  );
  modalRoot().querySelector('#pd-close').addEventListener('click', closeModal);
  modalRoot().querySelector('#pd-del').addEventListener('click', () => {
    if (!confirm('Delete this pain entry?')) return;
    savePain(loadPain().filter((p) => p.id !== id));
    closeModal();
    afterPainChange();
  });
}

export function openDoseDetail(dose) {
  if (!dose) return;
  const med = loadMeds().find((m) => m.id === dose.medId);
  const when = new Date(dose.timestamp).toLocaleString([],
    { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  openSheet(
    `<h2>${med ? med.name : 'Dose'}</h2>` +
    `<p class="muted">${when}</p>` +
    `<p>${dose.units} tablet${dose.units === 1 ? '' : 's'}${med && med.maxDailyUnits ? ` · max ${med.maxDailyUnits}/day` : ''}</p>` +
    `<div class="btn-row"><button class="btn" id="dd-close">Close</button></div>`
  );
  modalRoot().querySelector('#dd-close').addEventListener('click', closeModal);
}

export function openDoseGroup(doses) {
  if (!doses || !doses.length) return;
  if (doses.length === 1) return openDoseDetail(doses[0]);
  const meds = loadMeds();
  const medOf = (id) => meds.find((m) => m.id === id);
  const dayLabel = new Date(doses[0].timestamp)
    .toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const rows = doses.map((d) => {
    const m = medOf(d.medId);
    const time = new Date(d.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const color = m ? medColor(m.order || 0) : '#94a3b8';
    const name = m ? m.name : 'Dose';
    return `<li data-dose-id="${d.id}"><i class="sw" style="background:${color}"></i>` +
      `<span>${name}</span>` +
      `<span class="muted">${time} · ${d.units} tablet${d.units === 1 ? '' : 's'}</span></li>`;
  }).join('');
  openSheet(
    `<h2>${doses.length} doses · ${dayLabel}</h2>` +
    `<ul class="list dose-group">${rows}</ul>` +
    `<div class="btn-row"><button class="btn" id="dg-close">Close</button></div>`
  );
  modalRoot().querySelector('#dg-close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('li[data-dose-id]').forEach((li) =>
    li.addEventListener('click', () => {
      const dose = doses.find((d) => d.id === li.dataset.doseId);
      openDoseDetail(dose); // replaces the list sheet in place (back/close still works)
    }));
}

export function openPainLog() {
  let selected = null;
  const scale = Array.from({ length: 11 }, (_, n) =>
    `<button class="pain-pick" data-score="${n}" style="--sev:${painColor(n)};border-color:${painColor(n)}">${n}</button>`).join('');
  openSheet(
    `<h2>How bad is your pain right now?</h2>` +
    `<div class="pain-scale">${scale}</div>` +
    `<div class="field"><label>Note (optional)</label><input id="pain-note" placeholder="e.g. after walking" /></div>` +
    `<div class="btn-row"><button class="btn secondary" id="pain-cancel">Cancel</button>` +
    `<button class="btn" id="pain-save" disabled>Save</button></div>`
  );
  const saveBtn = modalRoot().querySelector('#pain-save');
  modalRoot().querySelectorAll('.pain-pick').forEach((b) =>
    b.addEventListener('click', () => {
      selected = Number(b.dataset.score);
      modalRoot().querySelectorAll('.pain-pick').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      saveBtn.disabled = false;
    }));
  modalRoot().querySelector('#pain-cancel').addEventListener('click', closeModal);
  saveBtn.addEventListener('click', () => {
    if (selected === null) return;
    const note = modalRoot().querySelector('#pain-note').value.trim();
    addPain(selected, note);
    closeModal();
    afterPainChange();
  });
}

