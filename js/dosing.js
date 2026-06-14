// js/dosing.js
function startOfLocalDay(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function unitsToday(doses, medId, now) {
  const dayStart = startOfLocalDay(now);
  return doses
    .filter((d) => d.medId === medId && d.timestamp >= dayStart && d.timestamp <= now)
    .reduce((sum, d) => sum + d.units, 0);
}

export function lastDose(doses, medId) {
  return doses
    .filter((d) => d.medId === medId)
    .reduce((latest, d) => (!latest || d.timestamp > latest.timestamp ? d : latest), null);
}

export function nextDoseTime(doses, medId, intervalHours) {
  const last = lastDose(doses, medId);
  return last ? last.timestamp + intervalHours * 3600 * 1000 : null;
}

export function computeStatus(med, doses, now) {
  const units = unitsToday(doses, med.id, now);
  const next = nextDoseTime(doses, med.id, med.intervalHours);
  const last = lastDose(doses, med.id);
  const base = { unitsToday: units, nextDoseTime: next, lastDoseTime: last ? last.timestamp : null };

  if (units >= med.maxDailyUnits) {
    return { ...base, state: 'daily_max', msRemaining: 0 };
  }
  if (next && now < next) {
    return { ...base, state: 'wait', msRemaining: next - now };
  }
  return { ...base, state: 'ready', msRemaining: 0 };
}
