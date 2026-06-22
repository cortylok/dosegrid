// js/ui.js
import { loadMeds, saveMeds, loadDoses, saveDoses, addDose, pruneDoses, uuid, loadNotifySettings, saveNotifySettings } from './storage.js';
import { computeStatus, dailyDoseTotals } from './dosing.js';
import { loadDataset, searchMeds, groupByCategory, loadCountryBrands, regionalBrands } from './data.js';
import { resolveDoseType } from './categories.js';
import { checkDose } from './safety.js';
import { checkIngredients, ingredientTotals, INGREDIENT_LIMITS } from './ingredients.js';
import { helpLinesFor, getCountry, setCountry, COUNTRY_OPTIONS, WHO_DIRECTORY } from './helplines.js';
import { isPro, purchasePro, restorePurchases } from './pro.js';
import { getProPrice } from './iap.js';
import { visibleWindow, hiddenCount } from './gating.js';
import { defaultReminderTimes } from './notify-schedule.js';
import { syncNotifications, requestPermission } from './notify.js';

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
  // For meds that share an active ingredient (e.g. paracetamol in a codeine combo),
  // show the combined daily total across ALL medicines, not just this one.
  let ingNote = '';
  if (med.components && med.components.length) {
    const totals = ingredientTotals(loadMeds(), doses, Date.now());
    ingNote = med.components
      .filter((c) => INGREDIENT_LIMITS[c.ingredient])
      .map((c) => `<p class="muted ing-note">${c.ingredient.charAt(0).toUpperCase() + c.ingredient.slice(1)} today (all medicines): <b>${Math.round(totals[c.ingredient] || 0)} mg</b> of ${INGREDIENT_LIMITS[c.ingredient]} mg</p>`)
      .join('');
  }
  openSheet(
    `<h2>${med.name}${med.strength ? ` <span class="muted">${med.strength}</span>` : ''}</h2>` +
    `<p class="muted">Last taken: ${last}<br>Can take again: ${next}<br>` +
    `Today: ${s.unitsToday} of ${med.maxDailyUnits} tablets (${remaining} left)</p>` +
    ingNote +
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
      const units = parseFloat(b.dataset.units);
      const now = Date.now();
      const commit = () => { addDose(med.id, units); closeModal(); renderGrid(); syncNotifications(); };
      // A shared-ingredient overdose (e.g. paracetamol across combos) is the most
      // serious, so it takes precedence over the per-med early/over check.
      const ing = checkIngredients(med, loadMeds(), loadDoses(), units, now);
      const info = ing || checkDose(med, loadDoses(), units, now);
      if (info) openDoseWarning(med, units, info, commit); else commit();
    })
  );
  modalRoot().querySelector('#edit-med').addEventListener('click', () => openEditMed(med));
  modalRoot().querySelector('#view-hist').addEventListener('click', () => openHistory(med));
}

function fmtGap(ms) {
  if (ms == null) return 'some time';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function telLine(a) {
  return `<a class="help-line" href="tel:${String(a.number).replace(/\s/g, '')}"><span>${a.label}` +
    `${a.note ? `<small>${a.note}</small>` : ''}</span><span class="num">${a.number}</span></a>`;
}

function helpLinesHtml(code) {
  const hl = helpLinesFor(code);
  let body;
  if (hl.advice.length) {
    body = hl.advice.map(telLine).join('');
  } else {
    body = `<a class="help-line" href="${WHO_DIRECTORY.url}" target="_blank" rel="noopener">` +
      `<span>${WHO_DIRECTORY.label}<small>Find your nearest centre</small></span><span class="num">↗</span></a>` +
      `<p class="caution">Or contact your doctor or pharmacist.</p>`;
  }
  // Always offer the emergency number for the selected country.
  if (hl.emergency && hl.emergency.number) body += telLine(hl.emergency);
  return `<div class="help"><div class="h">Need advice?</div>${body}</div>`;
}

function openDoseWarning(med, units, info, onConfirm) {
  const code = getCountry();
  const type = info.type; // 'over' | 'early' | 'ingredient'
  const danger = type === 'over' || type === 'ingredient';
  let icon, title, facts, caution;
  if (type === 'ingredient') {
    const ing = info.ingredient;
    icon = '🛑';
    title = `That's a lot of ${ing}`;
    facts = `This would total about <b>${info.totalMg} mg</b> of <b>${ing}</b> today across all your medicines — more than the usual safe daily maximum of <b>${info.limitMg} mg</b>.`;
    caution = `More than one of your medicines contains ${ing}. Going over the combined daily total can be harmful${ing === 'paracetamol' ? ' (paracetamol can damage the liver)' : ''}. Check the labels and get advice if you're unsure.`;
  } else if (type === 'over') {
    icon = '🛑';
    title = "That's over your daily limit";
    facts = `This would make <b>${info.resultingUnits}</b> tablet${info.resultingUnits === 1 ? '' : 's'} of <b>${med.name}</b> today — more than your daily max of <b>${info.maxDailyUnits}</b>.`;
    caution = `Going over your daily limit can be harmful. Please double-check the label, and get advice if you're unsure.`;
  } else {
    icon = '⏱';
    title = "That's sooner than usual";
    facts = `You last took <b>${med.name}</b> <b>${fmtGap(info.gapMs)}</b> ago. The minimum gap you set is <b>${info.intervalHours} h</b>.`;
    caution = `Taking doses closer together than directed can be unsafe. If you're unsure what to do, it's worth getting advice.`;
  }
  openSheet(
    `<div class="warn-ico ${danger ? 'over' : ''}">${icon}</div>` +
    `<h2>${title}</h2>` +
    `<div class="facts">${facts}</div>` +
    `<p class="caution">${caution}</p>` +
    helpLinesHtml(code) +
    `<div class="btn-row"><button class="btn secondary" id="dw-cancel">Cancel</button>` +
    `<button class="btn ${danger ? 'danger' : ''}" id="dw-go">Log it anyway</button></div>` +
    `<div class="country-note">Help lines for <b>${helpLinesFor(code).country}</b>. ` +
    `<a href="#" id="dw-country">Change country</a></div>`
  );
  modalRoot().querySelector('#dw-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#dw-go').addEventListener('click', () => onConfirm());
  modalRoot().querySelector('#dw-country').addEventListener('click', (e) => {
    e.preventDefault();
    openCountryPicker(() => openDoseWarning(med, units, info, onConfirm));
  });
}

function openCountryPicker(onDone) {
  const cur = getCountry();
  const opts = COUNTRY_OPTIONS.map(([c, name]) => `<option value="${c}"${c === cur ? ' selected' : ''}>${name}</option>`).join('');
  openSheet(
    `<h2>Your country</h2>` +
    `<p class="muted">Used to show the right help lines. Stored only on this device.</p>` +
    `<div class="field"><label>Country</label><select id="cp-sel">${opts}</select></div>` +
    `<div class="btn-row"><button class="btn secondary" id="cp-cancel">Cancel</button>` +
    `<button class="btn" id="cp-save">Save</button></div>`
  );
  modalRoot().querySelector('#cp-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#cp-save').addEventListener('click', () => {
    setCountry(modalRoot().querySelector('#cp-sel').value);
    closeModal();
    if (typeof onDone === 'function') onDone();
  });
}

async function openPicker() {
  const dataset = await loadDataset();
  const countryBrands = await loadCountryBrands();
  const country = getCountry();
  // Show brand names common in the user's country (falls back to the dataset's).
  const brandsFor = (m) => regionalBrands(countryBrands, country, m.generic) || m.brands || [];
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
        `<span class="muted">${brandsFor(m).join(', ')}</span></li>`).join('')
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
// Current per-ingredient mg for a combo form: saved components if editing, else
// the chosen variant's recipe, else the first variant.
function comboCurrentValues(med, cur) {
  if (cur.components && cur.components.length) {
    const o = {}; for (const c of cur.components) o[c.ingredient] = c.mg; return o;
  }
  const v = (med.variants || []).find((x) => x.name === cur.variant) || (med.variants || [])[0];
  return v ? { ...v.mg } : {};
}

// A labelled strength dropdown per ingredient (+ optional product selector).
function comboFieldsHtml(med, cur) {
  const variants = med.variants || [];
  const vals = comboCurrentValues(med, cur);
  const curVariant = cur.variant || (variants[0] && variants[0].name) || '';
  const isNamed = variants.some((v) => v.name === curVariant);
  const variantSel = variants.length
    ? `<div class="field"><label>Product</label><select id="f-variant">` +
      variants.map((v) => `<option value="${v.name}"${v.name === curVariant ? ' selected' : ''}>${v.name}</option>`).join('') +
      `<option value="__custom"${isNamed ? '' : ' selected'}>Custom…</option></select></div>`
    : '';
  const ingFields = med.ingredients.map((ing) => {
    const unit = ing.unit || med.unit || 'mg';
    const val = vals[ing.key];
    const known = ing.strengths.includes(val);
    const useCustom = val != null && !known;
    const opts = ing.strengths
      .map((sN) => `<option value="${sN}"${known && sN === val ? ' selected' : ''}>${sN} ${unit}</option>`).join('');
    return `<div class="field"><label>${ing.name} strength</label>` +
      `<select id="f-ing-${ing.key}" class="f-ing">${opts}<option value="__custom"${useCustom ? ' selected' : ''}>Custom…</option></select>` +
      `<input id="f-ingc-${ing.key}" class="f-ingc" placeholder="e.g. 500" value="${useCustom ? val : ''}" style="display:${useCustom ? '' : 'none'};margin-top:6px" /></div>`;
  }).join('');
  return variantSel + ingFields;
}

function dosingFieldsHtml(med, cur) {
  const unit = unitOf(med);
  let strengthField;
  if (med.kind === 'combo' && med.ingredients && med.ingredients.length) {
    strengthField = comboFieldsHtml(med, cur);
  } else if (med.strengths && med.strengths.length) {
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
  const pro = isPro();
  const notifyOn = !!cur.notify;
  const isScheduled = curType === 'scheduled';
  const times = (cur.reminderTimes && cur.reminderTimes.length) ? cur.reminderTimes : defaultReminderTimes(cur.intervalHours ?? 6);
  const timesEditor = `<div class="field" id="f-times-wrap" style="display:${notifyOn && isScheduled ? '' : 'none'}">` +
    `<label>Reminder times</label><div id="f-times">` +
    times.map((t) => `<input type="time" class="f-time" value="${t}" />`).join('') +
    `</div></div>`;
  const notifyField =
    `<div class="field"><label>Reminders ${pro ? '' : '<span class="pro-badge">PRO</span>'}</label>` +
    `<label class="switch"><input type="checkbox" id="f-notify" ${notifyOn ? 'checked' : ''} ${pro ? '' : 'data-locked="1"'} /> ` +
    `${isScheduled ? 'Remind me at set times' : 'Tell me when I can take another'}</label></div>` +
    timesEditor;
  return (
    strengthField +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="${cur.intervalHours ?? 6}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="${cur.maxDailyUnits ?? 6}" />${maxNote}</div>` +
    doseTypeField +
    notifyField
  );
}

// Wires the strength dropdown: toggles the custom box and auto-fills max
// tablets/day = floor(maxPerDay / chosen strength) when max data is known.
// `autoInit` recomputes max tablets for the pre-selected strength when the form
// opens. Pass true when adding (no user value yet); pass false when editing so a
// user's customised max isn't clobbered (it still recomputes if they change the
// strength).
function wireNotifyToggle() {
  const notify = modalRoot().querySelector('#f-notify');
  if (!notify) return;
  notify.addEventListener('change', () => {
    if (notify.dataset.locked) { notify.checked = false; openPaywall(); return; }
    const w = modalRoot().querySelector('#f-times-wrap');
    const scheduled = modalRoot().querySelector('#f-dosetype')?.value === 'scheduled';
    if (w) w.style.display = notify.checked && scheduled ? '' : 'none';
    if (notify.checked) requestPermission();
  });
}

function wireDosingFields(med, autoInit) {
  if (med.kind === 'combo' && med.ingredients) {
    const root = modalRoot();
    const variantSel = root.querySelector('#f-variant');
    const setIng = (key, mg) => {
      const sel2 = root.querySelector(`#f-ing-${key}`);
      const custom = root.querySelector(`#f-ingc-${key}`);
      const ing = med.ingredients.find((i) => i.key === key);
      if (ing.strengths.includes(mg)) { sel2.value = String(mg); custom.style.display = 'none'; }
      else { sel2.value = '__custom'; custom.style.display = ''; custom.value = mg; }
    };
    if (variantSel) variantSel.addEventListener('change', () => {
      if (variantSel.value === '__custom') return;
      const v = med.variants.find((x) => x.name === variantSel.value);
      if (v) med.ingredients.forEach((ing) => setIng(ing.key, v.mg[ing.key]));
    });
    med.ingredients.forEach((ing) => {
      const sel2 = root.querySelector(`#f-ing-${ing.key}`);
      const custom = root.querySelector(`#f-ingc-${ing.key}`);
      sel2.addEventListener('change', () => {
        custom.style.display = sel2.value === '__custom' ? '' : 'none';
        if (variantSel) variantSel.value = '__custom';
      });
      custom.addEventListener('input', () => { if (variantSel) variantSel.value = '__custom'; });
    });
    wireNotifyToggle();
    return;
  }
  const sel = modalRoot().querySelector('#f-strength-sel');
  if (sel) {
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
  wireNotifyToggle();
}

// Reads the strength/interval/max values back out of the form.
function readDosingFields(med) {
  const common = {
    intervalHours: parseFloat(modalRoot().querySelector('#f-int').value) || 0,
    maxDailyUnits: parseFloat(modalRoot().querySelector('#f-max').value) || 0,
    doseType: modalRoot().querySelector('#f-dosetype')?.value === 'scheduled' ? 'scheduled' : 'prn',
    notify: !!modalRoot().querySelector('#f-notify')?.checked,
    reminderTimes: Array.from(modalRoot().querySelectorAll('.f-time')).map((i) => i.value).filter(Boolean),
  };
  if (med.kind === 'combo' && med.ingredients) {
    const unit = unitOf(med);
    const components = med.ingredients.map((ing) => {
      const sel = modalRoot().querySelector(`#f-ing-${ing.key}`);
      const mg = sel.value === '__custom'
        ? parseFloat(modalRoot().querySelector(`#f-ingc-${ing.key}`).value)
        : parseFloat(sel.value);
      return { ingredient: ing.key, mg: Number.isFinite(mg) ? mg : 0 };
    });
    const strength = med.ingredients
      .map((ing, i) => `${ing.name} ${components[i].mg} ${unit}`).join(' + ');
    return { ...common, strength, components };
  }
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
  return { ...common, strength, components: med.components || null };
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
      notify: vals.notify, reminderTimes: vals.reminderTimes,
      intervalHours: vals.intervalHours,
      maxDailyUnits: vals.maxDailyUnits,
      order: meds.length,
    });
    saveMeds(meds);
    syncNotifications();
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
      notify: vals.notify, reminderTimes: vals.reminderTimes,
      intervalHours: vals.intervalHours, maxDailyUnits: vals.maxDailyUnits, order: meds.length,
    });
    saveMeds(meds);
    syncNotifications();
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
  const pro = isPro();
  // Free users get the 24h list only (the 14-day graph is a Pro view).
  if (!pro) view = 'list';
  const title = pro ? 'last 14 days' : 'last 24 hours';
  const sheetBody = view === 'graph' ? historyGraphHtml(med, now) : historyListHtml(med, now);
  openSheet(
    `<h2>${med.name} — ${title}</h2>` +
    (pro
      ? `<div class="hist-toggle">` +
        `<button data-v="graph" class="${view === 'graph' ? 'active' : ''}">Graph</button>` +
        `<button data-v="list" class="${view === 'list' ? 'active' : ''}">List</button>` +
        `</div>`
      : '') +
    `<div id="hist-body">${sheetBody}</div>` +
    `<div class="btn-row"><button class="btn secondary" id="close">Close</button></div>`
  );
  modalRoot().querySelector('#close').addEventListener('click', closeModal);
  modalRoot().querySelectorAll('.hist-toggle button').forEach((b) =>
    b.addEventListener('click', () => openHistory(med, b.dataset.v)));
  modalRoot().querySelector('#hist-unlock')?.addEventListener('click', openPaywall);
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
  const pro = isPro();
  const { fromTs } = visibleWindow(now, pro);
  const all = loadDoses().filter((d) => d.medId === med.id);
  const entries = all.filter((d) => d.timestamp >= fromTs).sort((a, b) => b.timestamp - a.timestamp);
  const hidden = hiddenCount(all, now, pro);
  const footer = hidden > 0
    ? `<button class="hist-unlock" id="hist-unlock">🔒 +${hidden} earlier dose${hidden === 1 ? '' : 's'} — Unlock full history</button>`
    : '';
  if (!entries.length) {
    return `<ul class="list"><li class="muted">No doses in the ${pro ? 'last 14 days' : 'last 24 hours'}.</li></ul>${footer}`;
  }
  return `<ul class="list">` + entries.map((d) =>
    `<li data-id="${d.id}">` +
    `<span>${new Date(d.timestamp).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${d.units} tab${d.units === 1 ? '' : 's'}</span>` +
    `<span><button class="btn secondary" data-act="edit">Edit</button> ` +
    `<button class="btn danger" data-act="del">Del</button></span></li>`).join('') + `</ul>${footer}`;
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

const PRO_PRICE = '$4.99'; // placeholder until the store product is created

function refreshViews() { document.dispatchEvent(new CustomEvent('dosegrid:refresh')); }

export function openPaywall() {
  if (isPro()) {
    openSheet(
      `<h2>DoseGrid Pro ✓</h2>` +
      `<p class="muted">Pro is active — your full history is unlocked.</p>` +
      `<div class="btn-row"><button class="btn" id="pw-close">Close</button></div>`
    );
    modalRoot().querySelector('#pw-close').addEventListener('click', closeModal);
    return;
  }
  openSheet(
    `<h2>DoseGrid Pro</h2>` +
    `<p class="lead">Keep your full medication &amp; pain history — not just the last 24 hours.</p>` +
    `<div class="pt"><div class="ic">📈</div><div><b>Unlimited history</b>` +
      `<span>Scroll and chart pain &amp; doses across weeks, months and years.</span></div></div>` +
    `<div class="pt"><div class="ic">🔓</div><div><b>One-time unlock</b>` +
      `<span>Pay once. No subscription.</span></div></div>` +
    `<div class="pt"><div class="ic">🛟</div><div><b>Safety stays free</b>` +
      `<span>Early-dose and daily-limit warnings are always free.</span></div></div>` +
    `<div class="btn-row"><button class="btn secondary" id="pw-restore">Restore</button>` +
      `<button class="btn" id="pw-buy">Unlock — ${PRO_PRICE}</button></div>` +
    `<p class="pw-msg muted" id="pw-msg"></p>` +
    `<p class="disc muted">Your data already stays on your device. Pro only changes how much of it you can see.</p>`
  );
  // Show the store-localized price when available (native); falls back to the placeholder.
  getProPrice().then((price) => {
    if (!price) return;
    const buy = modalRoot().querySelector('#pw-buy');
    if (buy) buy.textContent = `Unlock — ${price}`;
  });
  const msg = () => modalRoot().querySelector('#pw-msg');
  modalRoot().querySelector('#pw-buy').addEventListener('click', async () => {
    const ok = await purchasePro();
    if (ok) { closeModal(); refreshViews(); }
    else if (msg()) msg().textContent = 'Purchase didn’t complete. You can try again.';
  });
  modalRoot().querySelector('#pw-restore').addEventListener('click', async () => {
    const ok = await restorePurchases();
    if (ok) { closeModal(); refreshViews(); }
    else if (msg()) msg().textContent = 'No previous purchase found to restore.';
  });
}

export function openNotifySettings() {
  const s = loadNotifySettings();
  openSheet(
    `<h2>Reminders</h2>` +
    `<p class="muted">During quiet hours, reminders still arrive but silently (vibrate only).</p>` +
    `<div class="field"><label>Quiet hours start</label><input id="ns-start" type="time" value="${s.quietStart}" /></div>` +
    `<div class="field"><label>Quiet hours end</label><input id="ns-end" type="time" value="${s.quietEnd}" /></div>` +
    `<div class="btn-row"><button class="btn secondary" id="ns-cancel">Cancel</button>` +
    `<button class="btn" id="ns-save">Save</button></div>`
  );
  modalRoot().querySelector('#ns-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#ns-save').addEventListener('click', () => {
    saveNotifySettings({
      quietStart: modalRoot().querySelector('#ns-start').value || '22:00',
      quietEnd: modalRoot().querySelector('#ns-end').value || '07:00',
    });
    closeModal();
    syncNotifications();
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
    `<div class="pt"><div class="ic">📈</div><div><b>Track your pain</b>` +
      `<span>Log a 0–10 pain score any time (0 = none, 10 = worst imaginable). The graph ` +
      `colours each score from green through to red and overlays your doses, so you can see ` +
      `pain against when you medicated — over 1 day, 3 days, 1 week or a fortnight.</span></div></div>` +
    `<div class="pt"><div class="ic">🔒</div><div><b>Stays on your phone</b>` +
      `<span>No account, no cloud — your data never leaves the device.</span></div></div>` +
    `<div class="pain-legend"><span>0 None</span><div class="grad"></div><span>10 Worst</span></div>` +
    `<div class="field"><label>Your country (for help lines)</label><select id="land-country">` +
    COUNTRY_OPTIONS.map(([c, name]) => `<option value="${c}"${c === getCountry() ? ' selected' : ''}>${name}</option>`).join('') +
    `</select></div>` +
    `<div class="btn-row"><button class="btn secondary" id="land-pro">${isPro() ? 'DoseGrid Pro ✓ Active' : 'DoseGrid Pro ✦ — unlock full history'}</button></div>` +
    `<div class="btn-row"><button class="btn secondary" id="land-reminders">Reminder settings</button></div>` +
    dismissRow +
    `<div class="btn-row"><button class="btn" id="land-start">Get started →</button></div>` +
    `<p class="disc"><strong>Not medical advice.</strong> DoseGrid is a personal tracking tool. ` +
    `Always follow the directions on your medicine label or the advice of your doctor or pharmacist. ` +
    `Never exceed the stated dose. In an emergency, call <strong>${helpLinesFor(getCountry()).emergency.number || 'your local emergency number'}</strong>.</p>` +
    `</div>`
  );
  modalRoot().querySelector('#land-country')?.addEventListener('change', (e) => setCountry(e.target.value));
  modalRoot().querySelector('#land-pro')?.addEventListener('click', () => { closeModal(); openPaywall(); });
  modalRoot().querySelector('#land-reminders')?.addEventListener('click', () => { closeModal(); openNotifySettings(); });
  modalRoot().querySelector('#land-start').addEventListener('click', () => {
    const cb = modalRoot().querySelector('#land-dismiss');
    if (cb && cb.checked && typeof opts.onDismiss === 'function') opts.onDismiss();
    closeModal();
  });
}
