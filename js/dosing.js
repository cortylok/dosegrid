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
