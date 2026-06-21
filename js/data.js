// js/data.js
import { CATEGORY_ORDER, CATEGORY_LABELS } from './categories.js';

let cache = null;

export async function loadDataset() {
  if (cache) return cache;
  const res = await fetch('./medications.json');
  cache = await res.json();
  return cache;
}

let brandsCache = null;
// Per-country brand names, generated from docs/research/meds-*.md (see _parsebrands).
// Shape: { ISO2: { GenericName: [brand, ...] } }. Returns {} if missing/offline.
export async function loadCountryBrands() {
  if (brandsCache) return brandsCache;
  try { brandsCache = await (await fetch('./country-brands.json')).json(); }
  catch { brandsCache = {}; }
  return brandsCache;
}

// Region-appropriate brand names for a med, or null to fall back to the dataset's
// brands. App stores 'UK' where the research uses 'GB'.
const COUNTRY_ALIAS = { UK: 'GB' };
export function regionalBrands(map, country, generic) {
  if (!map || !country) return null;
  const c = map[country] || map[COUNTRY_ALIAS[country]] || null;
  const list = c && c[generic];
  return list && list.length ? list : null;
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
