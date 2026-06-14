// js/ui.js
import { loadMeds, saveMeds, loadDoses, saveDoses, addDose, pruneDoses, uuid } from './storage.js';
import { computeStatus } from './dosing.js';
import { loadDataset, searchMeds } from './data.js';

const gridEl = () => document.getElementById('grid');
const modalRoot = () => document.getElementById('modal-root');

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtRemaining(ms) {
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
function fmtLastTaken(ts) {
  if (!ts) return 'Last taken: never';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Last taken: ${fmtTime(ts)}`
    : `Last taken: ${d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

export function renderGrid() {
  const meds = loadMeds().sort((a, b) => a.order - b.order);
  const doses = loadDoses();
  const now = Date.now();
  const grid = gridEl();
  grid.innerHTML = '';

  for (const med of meds) {
    const s = computeStatus(med, doses, now);
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.medId = med.id;
    const statusText =
      s.state === 'ready' ? 'Ready'
      : s.state === 'wait' ? `Wait ${fmtRemaining(s.msRemaining)}`
      : 'Daily max';
    tile.innerHTML =
      `<div><h2>${med.name}</h2>` +
      `<div class="dose-label">${med.strength ? med.strength + ' · ' : ''}${med.intervalHours}h · max ${med.maxDailyUnits} tabs/day</div>` +
      `<div class="dose-label">${fmtLastTaken(s.lastDoseTime)}</div></div>` +
      `<div class="status ${s.state}"><span class="dot"></span><span>${statusText}</span></div>`;
    attachTileHandlers(tile, med);
    grid.appendChild(tile);
  }

  const add = document.createElement('button');
  add.className = 'tile add';
  add.textContent = '+ Add medication';
  add.addEventListener('click', openPicker);
  grid.appendChild(add);
}

function attachTileHandlers(tile, med) {
  let timer = null;
  let longFired = false;
  const start = () => {
    longFired = false;
    timer = setTimeout(() => { longFired = true; openHistory(med); }, 500);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  tile.addEventListener('touchstart', start, { passive: true });
  tile.addEventListener('touchend', cancel);
  tile.addEventListener('touchmove', cancel);
  tile.addEventListener('mousedown', start);
  tile.addEventListener('mouseup', cancel);
  tile.addEventListener('mouseleave', cancel);
  tile.addEventListener('click', () => { if (longFired) { longFired = false; return; } openDoseSheet(med); });
}

function closeModal() { modalRoot().innerHTML = ''; }
function openSheet(html) {
  modalRoot().innerHTML = `<div class="scrim"><div class="sheet">${html}</div></div>`;
  modalRoot().querySelector('.scrim').addEventListener('click', (e) => {
    if (e.target.classList.contains('scrim')) closeModal();
  });
}

function openDoseSheet(med) {
  const doses = loadDoses();
  const s = computeStatus(med, doses, Date.now());
  const last = s.lastDoseTime ? fmtTime(s.lastDoseTime) : '—';
  const next = s.state === 'ready' ? 'now' : (s.nextDoseTime ? fmtTime(s.nextDoseTime) : 'now');
  const remaining = Math.max(0, med.maxDailyUnits - s.unitsToday);
  openSheet(
    `<h2>${med.name}${med.strength ? ` <span class="muted">${med.strength}</span>` : ''}</h2>` +
    `<p class="muted">Last taken: ${last}<br>Can take again: ${next}<br>` +
    `Today: ${s.unitsToday} of ${med.maxDailyUnits} tablets (${remaining} left)</p>` +
    `<p class="muted">Log tablets taken:</p>` +
    `<div class="btn-row">` +
      `<button class="btn" data-units="0.5">½ tab</button>` +
      `<button class="btn" data-units="1">1 tab</button>` +
      `<button class="btn" data-units="2">2 tabs</button>` +
    `</div>` +
    `<div class="btn-row">` +
      `<button class="btn secondary" id="edit-med">Edit</button>` +
      `<button class="btn secondary" id="view-hist">History</button>` +
    `</div>`
  );
  modalRoot().querySelectorAll('[data-units]').forEach((b) =>
    b.addEventListener('click', () => {
      addDose(med.id, parseFloat(b.dataset.units));
      closeModal();
      renderGrid();
    })
  );
  modalRoot().querySelector('#edit-med').addEventListener('click', () => openEditMed(med));
  modalRoot().querySelector('#view-hist').addEventListener('click', () => openHistory(med));
}

async function openPicker() {
  const dataset = await loadDataset();
  openSheet(
    `<h2>Add medication</h2>` +
    `<div class="field"><label>Search</label><input id="med-search" placeholder="Generic or brand name" /></div>` +
    `<ul class="list" id="med-results"></ul>`
  );
  const input = modalRoot().querySelector('#med-search');
  const results = modalRoot().querySelector('#med-results');
  const render = () => {
    const matches = searchMeds(input.value, dataset).slice(0, 50);
    results.innerHTML = matches
      .map((m, i) => `<li data-i="${i}"><span>${m.generic}</span>` +
        `<span class="muted">${(m.brands || []).join(', ')}</span></li>`)
      .join('');
    results.querySelectorAll('li').forEach((li) =>
      li.addEventListener('click', () => openConfigForm(matches[+li.dataset.i])));
  };
  input.addEventListener('input', render);
  render();
  input.focus();
}

function openConfigForm(picked) {
  openSheet(
    `<h2>${picked.generic}</h2>` +
    `<div class="field"><label>Display name</label><input id="f-name" value="${picked.generic}" /></div>` +
    `<div class="field"><label>Strength per tablet (optional, e.g. 200 mg)</label><input id="f-strength" placeholder="200 mg" /></div>` +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="6" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="6" /></div>` +
    `<div class="btn-row"><button class="btn secondary" id="cancel">Cancel</button><button class="btn" id="save">Save</button></div>`
  );
  modalRoot().querySelector('#cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const meds = loadMeds();
    meds.push({
      id: uuid(),
      name: modalRoot().querySelector('#f-name').value.trim() || picked.generic,
      brands: picked.brands || [],
      strength: modalRoot().querySelector('#f-strength').value.trim(),
      intervalHours: parseFloat(modalRoot().querySelector('#f-int').value) || 0,
      maxDailyUnits: parseFloat(modalRoot().querySelector('#f-max').value) || 0,
      order: meds.length,
    });
    saveMeds(meds);
    closeModal();
    renderGrid();
  });
}

function openEditMed(med) {
  openSheet(
    `<h2>Edit ${med.name}</h2>` +
    `<div class="field"><label>Display name</label><input id="e-name" value="${med.name}" /></div>` +
    `<div class="field"><label>Strength per tablet (optional, e.g. 200 mg)</label><input id="e-strength" value="${med.strength || ''}" placeholder="200 mg" /></div>` +
    `<div class="field"><label>Min hours between doses</label><input id="e-int" type="number" min="0" step="0.5" value="${med.intervalHours}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="e-max" type="number" min="0" step="0.5" value="${med.maxDailyUnits}" /></div>` +
    `<div class="btn-row"><button class="btn danger" id="del">Delete tile</button><button class="btn" id="save">Save</button></div>`
  );
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const meds = loadMeds();
    const m = meds.find((x) => x.id === med.id);
    if (m) {
      m.name = modalRoot().querySelector('#e-name').value.trim() || m.name;
      m.strength = modalRoot().querySelector('#e-strength').value.trim();
      m.intervalHours = parseFloat(modalRoot().querySelector('#e-int').value) || 0;
      m.maxDailyUnits = parseFloat(modalRoot().querySelector('#e-max').value) || 0;
      saveMeds(meds);
    }
    closeModal();
    renderGrid();
  });
  modalRoot().querySelector('#del').addEventListener('click', () => {
    if (!confirm(`Delete ${med.name}?`)) return;
    saveMeds(loadMeds().filter((x) => x.id !== med.id));
    closeModal();
    renderGrid();
  });
}

function openHistory(med) {
  const now = Date.now();
  const cutoff = now - 48 * 3600 * 1000;
  const entries = loadDoses()
    .filter((d) => d.medId === med.id && d.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
  const rows = entries.length
    ? entries.map((d) =>
        `<li data-id="${d.id}">` +
        `<span>${new Date(d.timestamp).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${d.units} tab${d.units === 1 ? '' : 's'}</span>` +
        `<span><button class="btn secondary" data-act="edit">Edit</button> ` +
        `<button class="btn danger" data-act="del">Del</button></span></li>`).join('')
    : `<li class="muted">No doses in the last 48 hours.</li>`;
  openSheet(`<h2>${med.name} — last 48h</h2><ul class="list">${rows}</ul>` +
    `<div class="btn-row"><button class="btn secondary" id="close">Close</button></div>`);
  modalRoot().querySelector('#close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('li[data-id]').forEach((li) => {
    const id = li.dataset.id;
    li.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      if (!confirm('Delete this dose entry?')) return;
      saveDoses(loadDoses().filter((d) => d.id !== id));
      openHistory(med);
      renderGrid();
    });
    li.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      const entry = loadDoses().find((d) => d.id === id);
      const current = new Date(entry.timestamp);
      const val = prompt('New time (HH:MM, today):', `${String(current.getHours()).padStart(2,'0')}:${String(current.getMinutes()).padStart(2,'0')}`);
      if (!val) return;
      const [h, m] = val.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const d = new Date(entry.timestamp); d.setHours(h, m, 0, 0);
      const doses = loadDoses();
      const target = doses.find((x) => x.id === id);
      target.timestamp = d.getTime();
      saveDoses(doses);
      openHistory(med);
      renderGrid();
    });
  });
}

export function showAbout() {
  openSheet(`<h2>About DoseGrid</h2><p class="muted">DoseGrid is a personal medication logging tool. ` +
    `It is <strong>not medical advice</strong> and ships no dosing recommendations — you set every interval and daily maximum yourself. ` +
    `All data is stored only on this device.</p><div class="btn-row"><button class="btn" id="ok">OK</button></div>`);
  modalRoot().querySelector('#ok').addEventListener('click', closeModal);
}
