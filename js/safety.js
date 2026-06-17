// js/safety.js — pure pre-log dose safety check (no DOM).
import { lastDose, nextDoseTime, unitsToday } from './dosing.js';

// Returns null if the dose is fine, else a warning descriptor.
export function checkDose(med, doses, addedUnits, now) {
  const last = lastDose(doses, med.id);
  const next = nextDoseTime(doses, med.id, med.intervalHours);
  const units = unitsToday(doses, med.id, now);
  const resulting = units + addedUnits;
  const early = next != null && now < next;
  const over = resulting > med.maxDailyUnits;
  if (!early && !over) return null;
  return {
    type: over ? 'over' : 'early', // over takes precedence
    early, over,
    lastDoseTime: last ? last.timestamp : null,
    gapMs: last ? now - last.timestamp : null,
    intervalHours: med.intervalHours,
    unitsToday: units,
    resultingUnits: resulting,
    maxDailyUnits: med.maxDailyUnits,
  };
}
