// js/ingredients.js — cross-medication active-ingredient tallies + overdose check.
// Some meds share an active ingredient (e.g. paracetamol in a codeine combo AND
// plain paracetamol). Tracking each med alone misses the combined load, which is
// dangerous for paracetamol especially. This sums shared ingredients across all
// meds and warns before a dose would exceed a safe daily total. Pure (no DOM).
import { unitsToday } from './dosing.js';

// Conservative adult daily safety ceilings (mg) for shared OTC analgesics.
export const INGREDIENT_LIMITS = { paracetamol: 4000, ibuprofen: 2400, aspirin: 4000 };

// Short-window ceilings: the most that should be taken of a shared active within
// a rolling window (≈ a standard single dose + its minimum spacing). Catches
// cross-medicine overlaps (e.g. paracetamol in a codeine combo + plain
// paracetamol close together) that each med's own timing check would miss.
export const INGREDIENT_PERIOD = {
  paracetamol: { maxMg: 1000, windowHours: 4 },
  ibuprofen: { maxMg: 400, windowHours: 4 },
  aspirin: { maxMg: 900, windowHours: 4 },
};

// Fallback mg/unit when a single-ingredient med has no parseable strength.
const DEFAULT_MG = { paracetamol: 500, ibuprofen: 400, aspirin: 300 };

// mg of `ingredient` per unit (tablet) of `med`. Combination meds carry a fixed
// `mg`; single-ingredient meds tagged `{ fromStrength: true }` use the user's
// configured strength (e.g. "500 mg").
export function unitMg(med, ingredient) {
  const comp = (med.components || []).find((c) => c.ingredient === ingredient);
  if (!comp) return 0;
  if (typeof comp.mg === 'number') return comp.mg;
  if (comp.fromStrength) {
    const n = parseFloat(String(med.strength || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : (DEFAULT_MG[ingredient] || 0);
  }
  return 0;
}

// Total mg of each shared ingredient taken so far today, summed across every med.
export function ingredientTotals(meds, doses, now) {
  const totals = {};
  for (const med of meds) {
    const units = unitsToday(doses, med.id, now);
    if (!units) continue;
    for (const comp of med.components || []) {
      const mg = unitMg(med, comp.ingredient) * units;
      if (mg) totals[comp.ingredient] = (totals[comp.ingredient] || 0) + mg;
    }
  }
  return totals;
}

// Total mg of `ingredient` taken within the last `windowMs`, across all meds.
export function ingredientInWindow(meds, doses, ingredient, windowMs, now) {
  const from = now - windowMs;
  let mg = 0;
  for (const med of meds) {
    const per = unitMg(med, ingredient);
    if (!per) continue;
    for (const d of doses) {
      if (d.medId === med.id && d.timestamp > from && d.timestamp <= now) mg += per * d.units;
    }
  }
  return mg;
}

// If adding `addedUnits` of `med` would push a shared ingredient over a safe
// limit — its daily ceiling OR its short-window cap — return a warning
// descriptor for the worst overage; else null. Daily ceiling takes precedence.
export function checkIngredients(med, meds, doses, addedUnits, now) {
  const dayTotals = ingredientTotals(meds, doses, now);
  let daily = null, period = null;
  const keep = (slot, cand) => (!slot || cand.over > slot.over ? cand : slot);
  for (const comp of med.components || []) {
    const ing = comp.ingredient;
    const add = addedUnits * unitMg(med, ing);
    const dLimit = INGREDIENT_LIMITS[ing];
    if (dLimit) {
      const resulting = (dayTotals[ing] || 0) + add;
      if (resulting > dLimit)
        daily = keep(daily, { type: 'ingredient', scope: 'daily', ingredient: ing, totalMg: Math.round(resulting), limitMg: dLimit, over: resulting - dLimit });
    }
    const p = INGREDIENT_PERIOD[ing];
    if (p) {
      const windowMs = p.windowHours * 3600e3;
      const resulting = ingredientInWindow(meds, doses, ing, windowMs, now) + add;
      if (resulting > p.maxMg)
        period = keep(period, { type: 'ingredient', scope: 'period', ingredient: ing, totalMg: Math.round(resulting), limitMg: p.maxMg, windowHours: p.windowHours, over: resulting - p.maxMg });
    }
  }
  const worst = daily || period;
  if (worst) delete worst.over;
  return worst;
}
