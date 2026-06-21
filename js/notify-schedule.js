// js/notify-schedule.js — pure scheduling logic for dose notifications (no plugin calls).
import { lastDose } from './dosing.js';
import { resolveDoseType } from './categories.js';

function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

// Is a HH:MM time inside the quiet window? Handles windows that cross midnight.
export function inQuietHours(hhmm, settings) {
  const t = toMin(hhmm), s = toMin(settings.quietStart), e = toMin(settings.quietEnd);
  if (s === e) return false;
  return s < e ? (t >= s && t < e) : (t >= s || t < e);
}

const WAKE_START = 8, WAKE_END = 20; // spread reminders across 08:00–20:00

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Default clock times for a scheduled med, from its interval (standard dosing:
// 24h→1, 12h→2, 8h→3, 6h→4), spread evenly across the waking window.
export function defaultReminderTimes(intervalHours) {
  const n = Math.max(1, Math.min(6, Math.round(24 / (intervalHours || 24))));
  if (n === 1) return [fmt(WAKE_START * 60)];
  const spanMin = (WAKE_END - WAKE_START) * 60;
  const out = [];
  for (let i = 0; i < n; i++) out.push(fmt(Math.round(WAKE_START * 60 + (i * spanMin) / (n - 1))));
  return out;
}
