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

// --- Shared dosing form widget (strength picker + interval + max tablets) ---
function unitOf(med) { return med.unit || 'mg'; }

// Builds the strength / interval / max-tablets fields. `cur` carries current
// values when editing; empty when adding. If the med has a known `strengths`
// list it renders a dropdown (+ Custom), otherwise a free-text strength box.
function dosingFieldsHtml(med, cur) {
  const unit = unitOf(med);
  let strengthField;
  if (med.strengths && med.strengths.length) {
    const curNum = cur.strength ? parseFloat(cur.strength) : null;
    const isKnown = curNum != null && med.strengths.includes(curNum);
    const useCustom = !!cur.strength && !isKnown;
    const opts = med.strengths
      .map((s) => `<option value="${s}" ${isKnown && curNum === s ? 'selected' : ''}>${s} ${unit}</option>`)
      .join('');
    strengthField =
      `<div class="field"><label>Strength per tablet</label>` +
      `<select id="f-strength-sel">${opts}<option value="custom" ${useCustom ? 'selected' : ''}>Custom…</option></select></div>` +
      `<div class="field" id="f-custom-wrap" style="display:${useCustom ? '' : 'none'}"><label>Custom strength</label>` +
      `<input id="f-strength" placeholder="e.g. 250 mg" value="${useCustom ? cur.strength : ''}" /></div>`;
  } else {
    strengthField =
      `<div class="field"><label>Strength per tablet (optional, e.g. 200 mg)</label>` +
      `<input id="f-strength" placeholder="200 mg" value="${cur.strength || ''}" /></div>`;
  }
  const maxNote = med.strengths && med.maxPerDay ? `<div class="muted" id="f-maxnote"></div>` : '';
  return (
    strengthField +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="${cur.intervalHours ?? 6}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="${cur.maxDailyUnits ?? 6}" />${maxNote}</div>`
  );
}

// Wires the strength dropdown: toggles the custom box and auto-fills max
// tablets/day = floor(maxPerDay / chosen strength) when max data is known.
// `autoInit` recomputes max tablets for the pre-selected strength when the form
// opens. Pass true when adding (no user value yet); pass false when editing so a
// user's customised max isn't clobbered (it still recomputes if they change the
// strength).
function wireDosingFields(med, autoInit) {
  const sel = modalRoot().querySelector('#f-strength-sel');
  if (!sel) return;
  const unit = unitOf(med);
  const customWrap = modalRoot().querySelector('#f-custom-wrap');
  const maxInput = modalRoot().querySelector('#f-max');
  const note = modalRoot().querySelector('#f-maxnote');
  const update = () => {
    if (sel.value === 'custom') { customWrap.style.display = ''; return; }
    customWrap.style.display = 'none';
    if (med.maxPerDay) {
      const tabs = Math.floor(med.maxPerDay / parseFloat(sel.value));
      maxInput.value = tabs;
      if (note) note.textContent = `Max ${med.maxPerDay} ${unit}/day ≈ ${tabs} × ${sel.value} ${unit} (editable — check your label)`;
    }
  };
  sel.addEventListener('change', update);
  if (autoInit) update();
}

// Reads the strength/interval/max values back out of the form.
function readDosingFields(med) {
  const sel = modalRoot().querySelector('#f-strength-sel');
  const unit = unitOf(med);
  let strength;
  if (sel) {
    strength = sel.value === 'custom'
      ? modalRoot().querySelector('#f-strength').value.trim()
      : `${sel.value} ${unit}`;
  } else {
    strength = modalRoot().querySelector('#f-strength').value.trim();
  }
  return {
    strength,
    intervalHours: parseFloat(modalRoot().querySelector('#f-int').value) || 0,
    maxDailyUnits: parseFloat(modalRoot().querySelector('#f-max').value) || 0,
  };
}

function openConfigForm(picked) {
  openSheet(
    `<h2>${picked.generic}</h2>` +
    `<div class="field"><label>Display name</label><input id="f-name" value="${picked.generic}" /></div>` +
    dosingFieldsHtml(picked, {}) +
    `<div class="btn-row"><button class="btn secondary" id="cancel">Cancel</button><button class="btn" id="save">Save</button></div>`
  );
  wireDosingFields(picked, true);
  modalRoot().querySelector('#cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const meds = loadMeds();
    const vals = readDosingFields(picked);
    meds.push({
      id: uuid(),
      name: modalRoot().querySelector('#f-name').value.trim() || picked.generic,
      brands: picked.brands || [],
      strength: vals.strength,
      strengths: picked.strengths || null,
      unit: picked.unit || null,
      maxPerDay: picked.maxPerDay || null,
      intervalHours: vals.intervalHours,
      maxDailyUnits: vals.maxDailyUnits,
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
    `<div class="field"><label>Display name</label><input id="f-name" value="${med.name}" /></div>` +
    dosingFieldsHtml(med, { strength: med.strength, intervalHours: med.intervalHours, maxDailyUnits: med.maxDailyUnits }) +
    `<div class="btn-row"><button class="btn danger" id="del">Delete tile</button><button class="btn" id="save">Save</button></div>`
  );
  wireDosingFields(med, false);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const meds = loadMeds();
    const m = meds.find((x) => x.id === med.id);
    if (m) {
      const vals = readDosingFields(med);
      m.name = modalRoot().querySelector('#f-name').value.trim() || m.name;
      m.strength = vals.strength;
      m.intervalHours = vals.intervalHours;
      m.maxDailyUnits = vals.maxDailyUnits;
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
