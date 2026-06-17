// js/storage.js
const MEDS_KEY = 'dosegrid.meds';
const DOSES_KEY = 'dosegrid.doses';
const PAIN_KEY = 'dosegrid.pain';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export function loadMeds() { return read(MEDS_KEY); }
export function saveMeds(meds) { localStorage.setItem(MEDS_KEY, JSON.stringify(meds)); }

export function loadDoses() { return read(DOSES_KEY); }
export function saveDoses(doses) { localStorage.setItem(DOSES_KEY, JSON.stringify(doses)); }

export function pruneDoses(doses, now = Date.now()) {
  const cutoff = now - 14 * 24 * 3600 * 1000;
  return doses.filter((d) => d.timestamp >= cutoff);
}

export function addDose(medId, units, timestamp = Date.now()) {
  const doses = loadDoses();
  doses.push({ id: uuid(), medId, timestamp, units });
  saveDoses(doses);
  return doses;
}

export function loadPain() { return read(PAIN_KEY); }
export function savePain(pain) { localStorage.setItem(PAIN_KEY, JSON.stringify(pain)); }

export function prunePain(pain, now = Date.now()) {
  const cutoff = now - 90 * 24 * 3600 * 1000;
  return pain.filter((p) => p.timestamp >= cutoff);
}

export function addPain(score, note = '', timestamp = Date.now()) {
  const pain = loadPain();
  const entry = { id: uuid(), timestamp, score };
  if (note) entry.note = note;
  pain.push(entry);
  savePain(pain);
  return pain;
}
