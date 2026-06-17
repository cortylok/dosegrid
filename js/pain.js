// js/pain.js — pure helpers for pain tracking (no DOM)

export const WINDOWS = [
  { key: '1d', label: '1 day', ms: 24 * 3600 * 1000 },
  { key: '3d', label: '3 days', ms: 3 * 24 * 3600 * 1000 },
  { key: '1w', label: '1 week', ms: 7 * 24 * 3600 * 1000 },
  { key: '2w', label: '2 weeks', ms: 14 * 24 * 3600 * 1000 },
];

// 0 none · 1-3 mild · 4-6 moderate · 7-10 severe
export function severity(score) {
  if (score <= 0) return 'none';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  return 'severe';
}

export function painInWindow(pain, windowMs, now) {
  const cutoff = now - windowMs;
  return pain.filter((p) => p.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
}

export function dosesInWindow(doses, windowMs, now) {
  const cutoff = now - windowMs;
  return doses.filter((d) => d.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
}

export function latestPain(pain) {
  if (!pain.length) return null;
  return pain.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
}
