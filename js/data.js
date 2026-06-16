// js/data.js
import { CATEGORY_ORDER, CATEGORY_LABELS } from './categories.js';

let cache = null;

export async function loadDataset() {
  if (cache) return cache;
  const res = await fetch('./medications.json');
  cache = await res.json();
  return cache;
}

export function searchMeds(query, dataset) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return dataset.slice();
  return dataset.filter(
    (m) =>
      m.generic.toLowerCase().includes(q) ||
      (m.brands || []).some((b) => b.toLowerCase().includes(q))
  );
}

export function groupByCategory(meds) {
  const known = new Set(CATEGORY_ORDER);
  const byId = new Map();
  for (const m of meds) {
    const id = known.has(m.category) ? m.category : 'custom';
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(m);
  }
  return CATEGORY_ORDER
    .filter((id) => byId.has(id))
    .map((id) => ({ id, label: CATEGORY_LABELS[id], meds: byId.get(id) }));
}
