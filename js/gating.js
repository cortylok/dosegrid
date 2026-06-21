// js/gating.js — single source of truth for the free/Pro 24-hour view window.
const USAGE_KEY = 'dosegrid.usageDays';
const NUDGE_KEY = 'dosegrid.proNudgeSeen';

export const FREE_WINDOW_HOURS = 24;
export const FREE_WINDOW_MS = FREE_WINDOW_HOURS * 3600 * 1000;

// The visible time-window and whether older data is locked.
export function visibleWindow(now, pro) {
  return { fromTs: pro ? -Infinity : now - FREE_WINDOW_MS, locked: !pro };
}

// How many entries fall outside the free window (0 for Pro). Drives "+N earlier" + the nudge.
export function hiddenCount(entries, now, pro) {
  if (pro) return 0;
  const cutoff = now - FREE_WINDOW_MS;
  return entries.reduce((n, e) => (e.timestamp < cutoff ? n + 1 : n), 0);
}

// Pure predicate for the one-off upgrade nudge.
export function shouldNudge({ pro, hasLockedData, usageDays, nudgeSeen }) {
  return !pro && hasLockedData && usageDays >= 5 && !nudgeSeen;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readDays() {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY)) || []; } catch { return []; }
}

export function recordUsageDay(now = Date.now()) {
  const days = readDays();
  const k = dayKey(now);
  if (!days.includes(k)) {
    days.push(k);
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(days)); } catch { /* ignore */ }
  }
  return days.length;
}
export function usageDayCount() { return readDays().length; }

export function nudgeSeen() {
  try { return localStorage.getItem(NUDGE_KEY) === '1'; } catch { return false; }
}
export function markNudgeSeen() {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* ignore */ }
}
