// js/painview.js — the Pain view: current-pain summary, log sheet, and overlay graph.
import { loadPain, savePain, addPain, loadDoses, loadMeds } from './storage.js';
import { WINDOWS, severity, painInWindow, dosesInWindow, latestPain } from './pain.js';
import { openSheet, closeModal, modalRoot } from './ui.js';

let currentWindow = '1d';

const painViewEl = () => document.getElementById('pain-view');

// Smooth green→red gradient: each 0–10 score gets its own colour along an HSL ramp
// (140° green at 0 → 0° red at 10).
function painColor(score) {
  const s = Math.max(0, Math.min(10, score));
  const hue = 140 - (140 * s) / 10;
  return `hsl(${hue}, 75%, 52%)`;
}

function fmtRelative(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(ts).toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function renderPainView() {
  const pain = loadPain();
  const last = latestPain(pain);
  const summary = last
    ? `<div class="pain-now"><div class="pain-score" style="color:${painColor(last.score)}">${last.score}<span>/10</span></div>` +
      `<div class="pain-meta">${severity(last.score)} · logged ${fmtRelative(last.timestamp)}${last.note ? `<br><span class="muted">“${last.note}”</span>` : ''}</div></div>`
    : `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;

  const tabs = WINDOWS.map((w) =>
    `<button data-win="${w.key}" class="${w.key === currentWindow ? 'active' : ''}">${w.label}</button>`).join('');

  const now = Date.now();
  const win = WINDOWS.find((w) => w.key === currentWindow) || WINDOWS[0];
  const graph = painGraphSvg(
    painInWindow(pain, win.ms, now),
    dosesInWindow(loadDoses(), win.ms, now),
    medNameMap(),
    win.ms,
    now
  );

  painViewEl().innerHTML =
    summary +
    `<button class="btn pain-log-btn" id="log-pain">＋ Log pain</button>` +
    `<div class="win-tabs">${tabs}</div>` +
    `<div class="pain-graph">${graph}</div>`;

  painViewEl().querySelector('#log-pain').addEventListener('click', openPainLog);
  painViewEl().querySelectorAll('.win-tabs button').forEach((b) =>
    b.addEventListener('click', () => { currentWindow = b.dataset.win; renderPainView(); }));
  painViewEl().querySelectorAll('.pain-hit').forEach((el) =>
    el.addEventListener('click', () => openPainDetail(el.dataset.id)));
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
    renderPainView();
  });
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
    renderPainView();
  });
}

function medNameMap() {
  const map = {};
  for (const m of loadMeds()) map[m.id] = m.name;
  return map;
}

function painGraphSvg(painEntries, doses, medNames, windowMs, now) {
  const W = 320, H = 180, padL = 24, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const start = now - windowMs;
  const x = (ts) => padL + Math.max(0, Math.min(1, (ts - start) / windowMs)) * plotW;
  const y = (score) => padT + (1 - score / 10) * plotH;

  let grid = '';
  for (const v of [0, 5, 10]) {
    const yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#334155" stroke-width="1"/>`;
    grid += `<text x="${padL - 4}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${v}</text>`;
  }

  const oneDay = 24 * 3600 * 1000;
  let xticks = '';
  for (let i = 0; i <= 4; i++) {
    const ts = start + (windowMs * i) / 4;
    const xx = padL + (plotW * i) / 4;
    const label = windowMs <= oneDay
      ? new Date(ts).toLocaleTimeString([], { hour: 'numeric' })
      : new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'numeric' });
    xticks += `<text x="${xx}" y="${H - padB + 12}" text-anchor="middle" font-size="8" fill="#64748b">${label}</text>`;
  }

  let line = '', dots = '';
  if (painEntries.length) {
    if (painEntries.length > 1) {
      const pts = painEntries.map((p) => `${x(p.timestamp)},${y(p.score)}`).join(' ');
      line = `<polyline points="${pts}" fill="none" stroke="rgba(34,211,238,0.5)" stroke-width="2"/>`;
    }
    dots = painEntries.map((p) => {
      const cx = x(p.timestamp), cy = y(p.score);
      const ring = p.note ? ` stroke="#f8fafc" stroke-width="2"` : '';
      return `<circle cx="${cx}" cy="${cy}" r="5" fill="${painColor(p.score)}"${ring}/>` +
        `<circle class="pain-hit" data-id="${p.id}" cx="${cx}" cy="${cy}" r="11" fill="transparent" style="cursor:pointer">` +
        `<title>Pain ${p.score}/10 · ${fmtClock(p.timestamp)}${p.note ? ` · ${p.note}` : ' · (tap for details)'}</title></circle>`;
    }).join('');
  }

  const baseY = H - padB;
  const ticks = doses.map((d) =>
    `<line x1="${x(d.timestamp)}" y1="${baseY}" x2="${x(d.timestamp)}" y2="${baseY - 9}" stroke="#22d3ee" stroke-width="2">` +
    `<title>${medNames[d.medId] || 'Dose'} · ${fmtClock(d.timestamp)} · ${d.units} tab${d.units === 1 ? '' : 's'}</title></line>`).join('');

  const empty = painEntries.length ? '' :
    `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="11" fill="#94a3b8">No pain logged in this window — tap Log pain.</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="pain-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pain over time with medication doses">` +
    grid + xticks + line + dots + ticks + empty + `</svg>`;
}
