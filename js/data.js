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

// Text for a combo variant's recipe, e.g. "paracetamol 500 + codeine 30 mg".
export function recipeText(med, variant) {
  const body = (med.ingredients || [])
    .map((ing) => `${ing.name.toLowerCase()} ${variant.mg[ing.key]}`)
    .join(' + ');
  return `${body} ${med.unit || 'mg'}`;
}

// Flat list of pickable rows for the add-med picker. Combos expand into one row
// per product variant; everything else is a single row. Each item:
// { med, variant|null, label, sublabel|null, category }.
export function pickerItems(dataset, query) {
  const q = (query || '').trim().toLowerCase();
  const matchText = (m) =>
    m.generic.toLowerCase().includes(q) ||
    (m.brands || []).some((b) => b.toLowerCase().includes(q)) ||
    (m.ingredients || []).some((i) => i.name.toLowerCase().includes(q));
  const items = [];
  for (const m of dataset) {
    if (m.kind === 'combo' && m.variants && m.variants.length) {
      const medMatches = !q || matchText(m);
      for (const v of m.variants) {
        if (q && !medMatches && !v.name.toLowerCase().includes(q)) continue;
        items.push({ med: m, variant: v, label: v.name, sublabel: recipeText(m, v), category: m.category });
      }
    } else {
      if (q && !matchText(m)) continue;
      items.push({ med: m, variant: null, label: m.generic, sublabel: null, category: m.category });
    }
  }
  return items;
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
