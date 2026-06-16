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

export function dailyDoseTotals(doses, medId, now, days = 14) {
  const todayStart = startOfLocalDay(now);
  const day = 24 * 3600 * 1000;
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    buckets.push({ dayStart: todayStart - i * day, units: 0 });
  }
  const windowStart = todayStart - (days - 1) * day;
  for (const d of doses) {
    if (d.medId !== medId || d.timestamp < windowStart) continue;
    const idx = Math.floor((startOfLocalDay(d.timestamp) - windowStart) / day);
    if (idx >= 0 && idx < days) buckets[idx].units += d.units;
  }
  return buckets;
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
