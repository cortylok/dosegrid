// js/data.js
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
