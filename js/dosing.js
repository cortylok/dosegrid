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
