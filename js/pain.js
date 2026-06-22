// js/pain.js — pure helpers for pain tracking (no DOM)

// 0 none · 1-3 mild · 4-6 moderate · 7-10 severe
export function severity(score) {
  if (score <= 0) return 'none';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  return 'severe';
}

export function latestPain(pain) {
  if (!pain.length) return null;
  return pain.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
}

// Smooth green→red gradient: each 0–10 score gets its own colour (140° green → 0° red).
export function painColor(score) {
  const s = Math.max(0, Math.min(10, score));
  return `hsl(${140 - (140 * s) / 10}, 75%, 52%)`;
}

const MED_PALETTE = ['#38bdf8', '#a78bfa', '#f472b6', '#f59e0b', '#34d399', '#fb7185', '#60a5fa', '#c084fc'];
export function medColor(index) {
  const i = ((index % MED_PALETTE.length) + MED_PALETTE.length) % MED_PALETTE.length;
  return MED_PALETTE[i];
}

export const DETAIL_PXDAY = 90; // px-per-day at/above which the chart shows full detail
export function lodMode(pxPerDay) {
  return pxPerDay >= DETAIL_PXDAY ? 'detail' : 'overview';
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isEarlyDose(curTs, prevTs, intervalHours) {
  return prevTs != null && (curTs - prevTs) < intervalHours * 3600 * 1000;
}

// Map<dayStartMs, { [medId]: totalUnits }>
export function medDayTotals(doses) {
  const map = new Map();
  for (const d of doses) {
    const ds = startOfDay(d.timestamp);
    if (!map.has(ds)) map.set(ds, {});
    const m = map.get(ds);
    m[d.medId] = (m[d.medId] || 0) + d.units;
  }
  return map;
}

const MS_DAY = 864e5;

// Doses within ±toleranceMs of centerTs, sorted ascending by timestamp.
export function dosesInCluster(doses, centerTs, toleranceMs) {
  return (doses || [])
    .filter((d) => Math.abs(d.timestamp - centerTs) <= toleranceMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Doses whose calendar day equals dayStartMs, sorted ascending by timestamp.
export function dayDoses(doses, dayStartMs) {
  return (doses || [])
    .filter((d) => startOfDay(d.timestamp) === dayStartMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Desired {start,end} time window for a range preset; pixel-independent.
export function rangeForPreset(preset, now) {
  if (preset === 'week') return { start: now - 7 * MS_DAY, end: now };
  return { start: startOfDay(now), end: now };
}
