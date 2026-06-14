// js/storage.js
const MEDS_KEY = 'dosegrid.meds';
const DOSES_KEY = 'dosegrid.doses';

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
  const cutoff = now - 48 * 3600 * 1000;
  return doses.filter((d) => d.timestamp >= cutoff);
}

export function addDose(medId, units, timestamp = Date.now()) {
  const doses = loadDoses();
  doses.push({ id: uuid(), medId, timestamp, units });
  saveDoses(doses);
  return doses;
}
