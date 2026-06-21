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
