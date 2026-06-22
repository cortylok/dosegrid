# Combination-med per-ingredient strengths + product variants — Design

**Date:** 2026-06-22
**Status:** Approved (design), pending spec review
**Area:** add-medication picker + config form (`js/ui.js`), dataset (`medications.json`), data helpers (`js/data.js`), ingredient safety tally (`js/ingredients.js`)

## Goal

When a user adds a combination medicine (e.g. Panadeine), the config form must capture a
**separate, labelled strength field per active ingredient** (Paracetamol + Codeine) instead of
one generic "strength" box. Searching a combo surfaces its **product variants** (Panadeine,
Panadeine Forte…); picking one **pre-fills the per-ingredient fields** with that product's recipe,
and the fields stay **editable** for edge cases. Single-ingredient meds gain **expanded
common-strength dropdowns** (e.g. paracetamol 500 / 665 mg). The per-ingredient values feed the
existing cross-med overdose tally so the paracetamol total is exactly what the user selected.

## Current state and the gaps this fixes

1. **One strength field for everything.** `dosingFieldsHtml(med, cur)` (js/ui.js:270) renders a
   single strength dropdown (when `med.strengths` exists) or a free-text box. A combo like
   "Paracetamol; Codeine" therefore captures one ambiguous number.
2. **Combos lump differing recipes.** The dataset's `Paracetamol; Codeine` med lists brands
   Panadeine (500/8), Panadeine Forte (500/30), Mersyndol (450/9.75), etc. under one entry, with a
   single hard-coded `components: [{ingredient:"paracetamol", mg:500}]`. The user can't say which
   product they actually have.
3. **The safety tally is currently inert for saved meds.** `js/ingredients.js` reads
   `med.components` from `loadMeds()`, but `openConfigForm` (js/ui.js:394) and `openCustomForm`
   (js/ui.js:430) **never persist `components`** onto the saved med. So no user-added med — single
   *or* combo — currently contributes to the cross-med paracetamol/ibuprofen/aspirin tally. This
   design persists `components` on save, making the tally actually work.

## Scope

In scope (decided with user):
- **10 tablet combos** get product variants + per-ingredient editable strength dropdowns:
  Paracetamol;Codeine, Paracetamol;Caffeine, Ibuprofen;Codeine, Orphenadrine;Paracetamol,
  Codeine;Pseudoephedrine;Paracetamol, Oxycodone;Naloxone, Buprenorphine;Naloxone,
  Ergotamine;Caffeine, Amoxicillin with clavulanate, Trimethoprim;Sulfamethoxazole.
  Of these, **Paracetamol;Caffeine is a new med to create** (not in the dataset today); the other
  9 already exist and are modified in place.
- **Single-ingredient meds** get expanded common-strength dropdowns (data only — the dropdown UI
  already exists). Persist their `components` so the tally works.
- **Persist `components` on save** for every med (single + combo).

Out of scope:
- The 4 non-tablet combos (Antacid Al/Mg, Alginate;antacid, Citric acid/Na citrate,
  Naphazoline/pheniramine eye drops) — they have no clean per-tablet mg; keep the single free-text
  strength field.
- Adding codeine / pseudoephedrine / etc. to `INGREDIENT_LIMITS` (tally still covers only
  paracetamol/ibuprofen/aspirin). The data captured makes a future addition trivial but it is not
  built now.
- Changing dose logging units (still "tablets"; one tablet = the selected recipe).

## Data model

### Combo meds (medications.json) — the 10 tablet combos

Each combo gains `kind: "combo"`, an `ingredients` array (defines the fields + dropdown options),
and a `variants` array (named products with their recipe). The old single `components` value on
these combos is removed (superseded by `ingredients` + per-save persistence).

```json
{
  "generic": "Paracetamol; Codeine",
  "brands": ["Panadeine", "Panadeine Forte", "Mersyndol", "Mersyndol Forte", "Panamax Co"],
  "category": "opioid",
  "kind": "combo",
  "ingredients": [
    { "name": "Paracetamol", "key": "paracetamol", "unit": "mg", "strengths": [500, 450, 665], "tallied": true },
    { "name": "Codeine",     "key": "codeine",     "unit": "mg", "strengths": [8, 9.75, 12.8, 15, 30] }
  ],
  "variants": [
    { "name": "Panadeine",       "mg": { "paracetamol": 500, "codeine": 15 } },
    { "name": "Panamax Co",      "mg": { "paracetamol": 500, "codeine": 8 } },
    { "name": "Panadeine Forte", "mg": { "paracetamol": 500, "codeine": 30 } },
    { "name": "Mersyndol",       "mg": { "paracetamol": 450, "codeine": 9.75 } },
    { "name": "Mersyndol Forte", "mg": { "paracetamol": 450, "codeine": 30 } }
  ],
  "defaultIntervalHours": 4,
  "defaultMaxPerDay": 8
}
```

Each combo keeps its existing `brands`, `category`, and `defaultIntervalHours`/`defaultMaxPerDay`
(unchanged). Per-ingredient `unit` lives on `ingredients[]`; the med-level `unit` stays as-is
(defaults to "mg" via `unitOf`).

Field rules:
- `ingredients[].key` for a tallied active MUST equal an `INGREDIENT_LIMITS` key
  (`paracetamol` / `ibuprofen` / `aspirin`); other ingredients use a plain lowercase key.
- `ingredients[].tallied: true` is set only on paracetamol/ibuprofen/aspirin ingredients.
- `variants[].mg` keys MUST match `ingredients[].key` values (every ingredient present).
- The first variant is the default pre-fill when a combo is opened without a chosen variant.

### Full variant / recipe tables (all 10 tablet combos)

Strengths listed are the dropdown options per ingredient; **bold** marks the tallied active.

1. **Paracetamol; Codeine** — **Paracetamol** [500, 450, 665] · Codeine [8, 9.75, 12.8, 15, 30]
   - Panadeine 500/15 · Panamax Co 500/8 · Panadeine Forte 500/30 · Mersyndol 450/9.75 · Mersyndol Forte 450/30
2. **Paracetamol; Caffeine** *(new med)* — **Paracetamol** [500, 665] · Caffeine [65]
   - Panadol Extra 500/65 (Optizorb same recipe)
3. **Ibuprofen; Codeine** — **Ibuprofen** [200, 400] · Codeine [12.8, 30]
   - Nurofen Plus 200/12.8
4. **Orphenadrine; Paracetamol** — Orphenadrine [35] · **Paracetamol** [450, 500]
   - Norgesic 35/450
5. **Codeine; Pseudoephedrine; Paracetamol** — Codeine [9.5] · Pseudoephedrine [30] · **Paracetamol** [500]
   - Codral Original Cold & Flu 9.5/30/500
6. **Oxycodone; Naloxone** — Oxycodone [5, 10, 20, 40] · Naloxone [2.5, 5, 10, 20]
   - Targin 5/2.5 · Targin 10/5 · Targin 20/10 · Targin 40/20
7. **Buprenorphine; Naloxone** — Buprenorphine [2, 8, 12, 16] · Naloxone [0.5, 2, 3, 4]
   - Suboxone 2/0.5 · Suboxone 8/2 · Suboxone 12/3 · Suboxone 16/4
8. **Ergotamine; Caffeine** — Ergotamine [1] · Caffeine [100]
   - Cafergot 1/100
9. **Amoxicillin with clavulanate** — Amoxicillin [500, 875] · Clavulanate [125]
   - Augmentin 500/125 · Augmentin Duo Forte 875/125
10. **Trimethoprim; Sulfamethoxazole** — Trimethoprim [80, 160] · Sulfamethoxazole [400, 800]
   - Bactrim 80/400 · Bactrim DS (Forte) 160/800

### Single-ingredient strength dropdowns (data only)

Expand the existing `strengths` arrays to the common selectable values:
- Paracetamol [500, 665] · Ibuprofen [200, 400] · Aspirin [100, 300] · Naproxen [250, 275, 550] ·
  Diclofenac [12.5, 25, 50] · Codeine [15, 30, 60].
- These already carry `components: [{ingredient, fromStrength: true}]` for paracetamol/ibuprofen/
  aspirin; leave that as-is. The form already renders a dropdown when `strengths` is present.

### Saved-med instance shape (unchanged keys + persisted `components`)

On save, a med stores `components` so the tally works:
- **Single-ingredient meds:** persist `components: picked.components || null` (the
  `fromStrength` form, which reads the saved `strength`).
- **Combos:** build `components` from the per-ingredient field values:
  `[{ingredient: "paracetamol", mg: 500}, {ingredient: "codeine", mg: 8}]`.
  `js/ingredients.js#unitMg` already returns `comp.mg` directly, so the tally is exact.
- `strength` (display string) for a combo is composed from the fields, e.g.
  `"Paracetamol 500 mg + Codeine 8 mg"`, used in the grid/dose sheet.
- The saved `name` defaults to the chosen variant name (e.g. "Panadeine Forte").

## Search / picker (js/ui.js `openPicker`, js/data.js)

Add a pure helper in `js/data.js`, `pickerItems(dataset, query)`, returning a flat list of
selectable rows:
- Non-combo med → one row `{ med, label: med.generic, sublabel: brandsHint }`.
- Combo med (`kind === "combo"`) → **one row per variant**
  `{ med, variant: v.name, label: v.name, sublabel: recipeText(med, v) }`,
  where `recipeText` is e.g. "paracetamol 500 + codeine 30 mg".
- Query matches against generic, brands, ingredient names, and variant names (so "panadeine"
  surfaces both Panadeine and Panadeine Forte; "codeine" surfaces the combo variants too).

`openPicker` renders these rows grouped by category. Clicking a combo row calls
`openConfigForm(med, variant)`; clicking a single calls `openConfigForm(med)`.

## Config form (js/ui.js `dosingFieldsHtml` / `wireDosingFields` / `readDosingFields`)

`dosingFieldsHtml(med, cur)` branches on `med.kind === "combo"`:

- **Single-ingredient (existing behaviour):** strength dropdown (`#f-strength-sel`) + custom box,
  unchanged except for the expanded `strengths` data.
- **Combo:** render
  1. a **variant selector** `#f-variant` listing `variants[].name` + "Custom…", pre-selected to
     the chosen variant (or first variant);
  2. for each ingredient, a labelled **strength dropdown** `#f-ing-<key>` with that ingredient's
     `strengths` as options + "Custom…", plus a hidden custom input `#f-ingc-<key>`, pre-filled
     from the selected variant's `mg`.

`wireDosingFields(med, autoInit)`:
- For combos, changing `#f-variant` writes each variant `mg` into the matching `#f-ing-<key>`
  dropdown (selecting "Custom…" if the recipe value isn't an option). Changing an ingredient
  dropdown to "Custom…" reveals its custom input. Editing an ingredient field flips the variant
  selector to "Custom" (the user has diverged from a named product).
- The notify toggle / reminder-times wiring is unchanged and shared.

`readDosingFields(med)`:
- For combos, returns `components` (array of `{ingredient: key, mg: number}` read from the
  per-ingredient fields, custom values parsed) and a composed `strength` display string, plus the
  existing `intervalHours` / `maxDailyUnits` / `doseType` / `notify` / `reminderTimes`.
- For singles, returns the existing shape plus `components: med.components || null` passthrough.

`openConfigForm(picked, variant)` / `openCustomForm`: persist `components` from `readDosingFields`
onto the pushed med object (the one new key). `openEditMed` keeps editing a saved combo working:
it reads `med.components`/`med.strength` back into the fields; if a saved combo predates this
feature (no `ingredients` on the saved instance) it falls back to the single free-text strength
box so nothing breaks.

## Safety tally integration (js/ingredients.js)

No engine change. Because combos now persist accurate per-ingredient `components`, `unitMg`
returns the user-selected mg, `ingredientTotals` sums it across meds, and `checkIngredients`
warns before exceeding `INGREDIENT_LIMITS`. The dose-sheet `ingNote` line ("Paracetamol today
(all medicines): X mg of 4000 mg") now reflects real combo contributions. (Persisting `components`
for single-ingredient meds is what makes plain paracetamol contribute at all.)

## Backward compatibility / migration

- Existing saved meds without `components` keep working (tally simply skips them, as today — no
  regression; new saves start contributing).
- Editing an old saved combo (no per-ingredient data) falls back to the single strength field.
- No storage migration is run; the model is additive.

## Testing

Pure unit tests (node --test):
- `pickerItems`: a combo expands to one row per variant; a single yields one row; query matches
  generic / brand / ingredient / variant name.
- combo `readDosingFields` mapping: variant "Panadeine Forte" → `components`
  `[{ingredient:"paracetamol",mg:500},{ingredient:"codeine",mg:30}]` and a sensible `strength`
  string; custom per-ingredient value is parsed.
- tally with user-selected mg: two meds sharing paracetamol (a combo at 500 + plain 665) sum
  correctly and trip `checkIngredients` at the 4000 mg ceiling; codeine (no limit) never trips.
- `medications.json` integrity: every combo `variants[].mg` key exists in `ingredients[].key`;
  every `tallied` ingredient key is in `INGREDIENT_LIMITS`.

Headless / manual smoke (documented, run in browser):
- Search "Panadeine" shows Panadeine + Panadeine Forte; selecting Forte pre-fills 500 / 30, both
  editable; Save creates a tile named "Panadeine Forte"; logging a dose adds 500 mg to the
  paracetamol tally; adding plain paracetamol 665 and dosing pushes the combined total toward the
  warning.

## Files touched

- `medications.json` — add `kind`/`ingredients`/`variants` to 9 existing combos, create the new
  `Paracetamol; Caffeine` (Panadol Extra) combo; expand single `strengths`.
- `js/data.js` — add `pickerItems` (+ `recipeText` helper); extend search matching.
- `js/ui.js` — combo branch in `dosingFieldsHtml`/`wireDosingFields`/`readDosingFields`; variant
  param + `components` persistence in `openConfigForm`/`openCustomForm`; edit fallback.
- `js/ingredients.js` — no logic change (verify only).
- `tests/` — new `combo-strengths.test.js` (+ extend dataset/data tests).
- `service-worker.js` — bump `CACHE` to `dosegrid-v16`.
- `css/styles.css` — minor: per-ingredient field grouping if needed.
