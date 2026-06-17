// js/ui.js
import { loadMeds, saveMeds, loadDoses, saveDoses, addDose, pruneDoses, uuid } from './storage.js';
import { computeStatus, dailyDoseTotals } from './dosing.js';
import { loadDataset, searchMeds, groupByCategory } from './data.js';
import { resolveDoseType } from './categories.js';

const gridEl = () => document.getElementById('grid');
export const modalRoot = () => document.getElementById('modal-root');

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
  if (!ts) return '';
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const when = sameDay ? fmtTime(ts) : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return `🕑 Last taken ${when}`;
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
    const lastLine = fmtLastTaken(s.lastDoseTime);
    const scheduled = resolveDoseType(med) === 'scheduled';
    const count = `<span class="count">${fmtRemaining(s.msRemaining)}</span>`;
    const statusInner =
      s.state === 'ready' ? (scheduled ? 'Due to take' : 'Ready when needed')
      : s.state === 'wait' ? (scheduled ? `Due in&nbsp;${count}` : `${count}&nbsp;until next`)
      : (scheduled ? 'Done for today' : 'Daily max');
    tile.innerHTML =
      `<div><h2>${med.name}</h2>` +
      `<div class="dose-label">${med.strength ? med.strength + ' · ' : ''}max ${med.maxDailyUnits}/day</div>` +
      (lastLine ? `<div class="last">${lastLine}</div>` : '') +
      `</div>` +
      `<div class="status ${s.state}">${statusInner}</div>`;
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

export function closeModal() { modalRoot().innerHTML = ''; }
export function openSheet(html) {
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
    `<ul class="list" id="med-results"></ul>` +
    `<div class="btn-row"><button class="btn secondary" id="add-custom">+ Add a medication not listed</button></div>`
  );
  const input = modalRoot().querySelector('#med-search');
  const results = modalRoot().querySelector('#med-results');
  const render = () => {
    const matches = searchMeds(input.value, dataset).slice(0, 80);
    const groups = groupByCategory(matches);
    results.innerHTML = groups.map((g) =>
      `<li class="cat">${g.label}</li>` +
      g.meds.map((m) =>
        `<li data-gen="${m.generic}"><span>${m.generic}</span>` +
        `<span class="muted">${(m.brands || []).join(', ')}</span></li>`).join('')
    ).join('') || `<li class="muted">No matches — use “Add a medication not listed”.</li>`;
    results.querySelectorAll('li[data-gen]').forEach((li) =>
      li.addEventListener('click', () =>
        openConfigForm(matches.find((m) => m.generic === li.dataset.gen))));
  };
  input.addEventListener('input', render);
  modalRoot().querySelector('#add-custom').addEventListener('click', () => openCustomForm());
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
  const curType = cur.doseType || 'prn';
  const doseTypeField =
    `<div class="field"><label>When do you take it?</label>` +
    `<select id="f-dosetype">` +
    `<option value="prn"${curType === 'prn' ? ' selected' : ''}>As needed (PRN)</option>` +
    `<option value="scheduled"${curType === 'scheduled' ? ' selected' : ''}>Scheduled / course</option>` +
    `</select></div>`;
  return (
    strengthField +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="${cur.intervalHours ?? 6}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="${cur.maxDailyUnits ?? 6}" />${maxNote}</div>` +
    doseTypeField
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
    doseType: modalRoot().querySelector('#f-dosetype')?.value === 'scheduled' ? 'scheduled' : 'prn',
  };
}

function openConfigForm(picked) {
  openSheet(
    `<h2>${picked.generic}</h2>` +
    `<div class="field"><label>Display name</label><input id="f-name" value="${picked.generic}" /></div>` +
    dosingFieldsHtml(picked, {
      intervalHours: picked.defaultIntervalHours,
      maxDailyUnits: picked.defaultMaxPerDay,
      doseType: resolveDoseType(picked),
    }) +
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
      category: picked.category || 'custom',
      doseType: vals.doseType,
      intervalHours: vals.intervalHours,
      maxDailyUnits: vals.maxDailyUnits,
      order: meds.length,
    });
    saveMeds(meds);
    closeModal();
    renderGrid();
  });
}

function openCustomForm() {
  const picked = { generic: '', brands: [], category: 'custom' };
  openSheet(
    `<h2>Custom medication</h2>` +
    `<div class="field"><label>Name</label><input id="f-name" placeholder="Medication name" /></div>` +
    dosingFieldsHtml(picked, {}) +
    `<div class="btn-row"><button class="btn secondary" id="cancel">Cancel</button><button class="btn" id="save">Save</button></div>`
  );
  modalRoot().querySelector('#cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#save').addEventListener('click', () => {
    const name = modalRoot().querySelector('#f-name').value.trim();
    if (!name) return;
    const meds = loadMeds();
    const vals = readDosingFields(picked);
    meds.push({
      id: uuid(), name, brands: [], strength: vals.strength,
      strengths: null, unit: null, maxPerDay: null, category: 'custom',
      doseType: vals.doseType,
      intervalHours: vals.intervalHours, maxDailyUnits: vals.maxDailyUnits, order: meds.length,
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
    dosingFieldsHtml(med, { strength: med.strength, intervalHours: med.intervalHours, maxDailyUnits: med.maxDailyUnits, doseType: resolveDoseType(med) }) +
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
      m.doseType = vals.doseType;
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

function openHistory(med, view = 'graph') {
  const now = Date.now();
  const sheetBody = view === 'graph' ? historyGraphHtml(med, now) : historyListHtml(med, now);
  openSheet(
    `<h2>${med.name} — last 14 days</h2>` +
    `<div class="hist-toggle">` +
      `<button data-v="graph" class="${view === 'graph' ? 'active' : ''}">Graph</button>` +
      `<button data-v="list" class="${view === 'list' ? 'active' : ''}">List</button>` +
    `</div>` +
    `<div id="hist-body">${sheetBody}</div>` +
    `<div class="btn-row"><button class="btn secondary" id="close">Close</button></div>`
  );
  modalRoot().querySelector('#close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('.hist-toggle button').forEach((b) =>
    b.addEventListener('click', () => openHistory(med, b.dataset.v)));
  if (view === 'list') wireHistoryList(med);
}

function historyGraphHtml(med, now) {
  const buckets = dailyDoseTotals(loadDoses(), med.id, now, 14);
  const max = med.maxDailyUnits || 0;
  const peak = Math.max(max, ...buckets.map((b) => b.units), 1);
  const maxPct = max > 0 ? (max / peak) * 100 : null;
  const bars = buckets.map((b) => {
    const h = Math.round((b.units / peak) * 100);
    const cls = max && b.units >= max ? 'red' : max && b.units >= max * 0.75 ? 'amber' : '';
    return `<div class="bar ${cls}" style="height:${h}%" title="${b.units} on ${new Date(b.dayStart).toLocaleDateString()}"></div>`;
  }).join('');
  const maxline = maxPct != null
    ? `<div class="maxline" style="bottom:${maxPct}%"></div><div class="maxlbl" style="bottom:${maxPct}%">max ${max}</div>` : '';
  return `<div class="bars">${maxline}${bars}</div>` +
    `<div class="bars-axis"><span>2 wks ago</span><span>today</span></div>`;
}

function historyListHtml(med, now) {
  const entries = loadDoses()
    .filter((d) => d.medId === med.id)
    .sort((a, b) => b.timestamp - a.timestamp);
  if (!entries.length) return `<ul class="list"><li class="muted">No doses in the last 14 days.</li></ul>`;
  return `<ul class="list">` + entries.map((d) =>
    `<li data-id="${d.id}">` +
    `<span>${new Date(d.timestamp).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${d.units} tab${d.units === 1 ? '' : 's'}</span>` +
    `<span><button class="btn secondary" data-act="edit">Edit</button> ` +
    `<button class="btn danger" data-act="del">Del</button></span></li>`).join('') + `</ul>`;
}

function wireHistoryList(med) {
  modalRoot().querySelectorAll('li[data-id]').forEach((li) => {
    const id = li.dataset.id;
    li.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      if (!confirm('Delete this dose entry?')) return;
      saveDoses(loadDoses().filter((d) => d.id !== id));
      openHistory(med, 'list');
      renderGrid();
    });
    li.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      const entry = loadDoses().find((d) => d.id === id);
      const current = new Date(entry.timestamp);
      const val = prompt('New time (HH:MM, same day):', `${String(current.getHours()).padStart(2,'0')}:${String(current.getMinutes()).padStart(2,'0')}`);
      if (!val) return;
      const [h, m] = val.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const d = new Date(entry.timestamp); d.setHours(h, m, 0, 0);
      const doses = loadDoses();
      doses.find((x) => x.id === id).timestamp = d.getTime();
      saveDoses(doses);
      openHistory(med, 'list');
      renderGrid();
    });
  });
}

export function showLanding(opts = {}) {
  const dismissRow = opts.showDismiss
    ? `<label class="dismiss"><input type="checkbox" id="land-dismiss" /> Don't show this again</label>`
    : '';
  openSheet(
    `<div class="landing">` +
    `<div class="hero">Know when you <em>can</em>,<br>not when you <em>should</em>.</div>` +
    `<p class="lead">DoseGrid tracks your as-needed and short-course medicines and shows when ` +
    `enough time has passed — or when you've reached the daily limit. It never tells you to take anything.</p>` +
    `<div class="pt"><div class="ic">⏱</div><div><b>See the wait</b>` +
      `<span>Each dose starts a countdown to when the next one is allowed.</span></div></div>` +
    `<div class="pt"><div class="ic">🛑</div><div><b>Respect the max</b>` +
      `<span>Tiles turn red once you've hit the safe daily limit.</span></div></div>` +
    `<div class="pt"><div class="ic">🔒</div><div><b>Stays on your phone</b>` +
      `<span>No account, no cloud — your data never leaves the device.</span></div></div>` +
    dismissRow +
    `<div class="btn-row"><button class="btn" id="land-start">Get started →</button></div>` +
    `<p class="disc"><strong>Not medical advice.</strong> DoseGrid is a personal tracking tool. ` +
    `Always follow the directions on your medicine label or the advice of your doctor or pharmacist. ` +
    `Never exceed the stated dose. In an emergency, call <strong>000</strong>.</p>` +
    `</div>`
  );
  modalRoot().querySelector('#land-start').addEventListener('click', () => {
    const cb = modalRoot().querySelector('#land-dismiss');
    if (cb && cb.checked && typeof opts.onDismiss === 'function') opts.onDismiss();
    closeModal();
  });
}
