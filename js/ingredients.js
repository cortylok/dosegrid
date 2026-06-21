// js/ingredients.js — cross-medication active-ingredient tallies + overdose check.
// Some meds share an active ingredient (e.g. paracetamol in a codeine combo AND
// plain paracetamol). Tracking each med alone misses the combined load, which is
// dangerous for paracetamol especially. This sums shared ingredients across all
// meds and warns before a dose would exceed a safe daily total. Pure (no DOM).
import { unitsToday } from './dosing.js';

// Conservative adult daily safety ceilings (mg) for shared OTC analgesics.
export const INGREDIENT_LIMITS = { paracetamol: 4000, ibuprofen: 2400, aspirin: 4000 };

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

// If adding `addedUnits` of `med` would push a shared ingredient over its safe
// daily ceiling, return a warning descriptor for the worst overage; else null.
export function checkIngredients(med, meds, doses, addedUnits, now) {
  const totals = ingredientTotals(meds, doses, now);
  let worst = null;
  for (const comp of med.components || []) {
    const ing = comp.ingredient;
    const limit = INGREDIENT_LIMITS[ing];
    if (!limit) continue;
    const resulting = (totals[ing] || 0) + addedUnits * unitMg(med, ing);
    if (resulting > limit) {
      const over = resulting - limit;
      if (!worst || over > worst.over) {
        worst = { type: 'ingredient', ingredient: ing, totalMg: Math.round(resulting), limitMg: limit, over };
      }
    }
  }
  if (worst) delete worst.over;
  return worst;
}
