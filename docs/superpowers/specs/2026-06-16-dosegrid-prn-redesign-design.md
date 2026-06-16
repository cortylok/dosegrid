# DoseGrid — PRN / Short-Term Redesign

**Date:** 2026-06-16
**Status:** Approved design, ready for planning
**Supersedes parts of:** `2026-06-14-dosegrid-design.md` (dosing engine, storage, search are reused; dataset focus, theme, history window, and landing page change)

## Purpose

Reposition DoseGrid from a generic medication tracker into a focused tool for
**PRN ("as needed") and short-course medicines** — painkillers, antihistamines,
antibiotics, and the like. The app's single job: after you log a dose, show when
enough time has passed that you are **allowed** to take more *if you need to*, or
that you've reached the safe daily limit. It never instructs anyone to take a dose.

This redesign delivers four changes on top of the existing, working app:

1. A **curated PRN/short-term medication dataset** (replaces the broad 722-med list),
   plus a free-text "add custom medication" fallback.
2. A **Bold Dark visual theme** with redesigned tiles that include the last-taken time.
3. **14-day dose history** with a daily-bars graph as the default view and a list toggle.
4. A **landing page** that states the "when you *can*, not when you *should*" framing.

Out of scope: notifications/reminders, accounts/sync, cloud storage, multi-device.
All data stays in `localStorage` on-device, as today.

## What is reused unchanged

The core engine from the original build stays:

- `dosing.js` — `unitsToday`, `lastDose`, `nextDoseTime`, `computeStatus` (states
  `ready` / `wait` / `daily_max`). The status state machine is unchanged; only the
  tile that renders it gets restyled.
- `storage.js` — `localStorage` load/save for meds and doses, `uuid`, `addDose`.
  **One change:** the prune window grows from 48h to 14 days (see History).
- `data.js` `searchMeds` — substring match on generic + brand names. Reused for the
  curated dataset, which keeps the same searchable shape.
- Per-med editable `intervalHours` + `maxDailyUnits`; tablet-based dosing; calendar-day
  (local midnight) daily-max reset.

## 1. Curated PRN / short-term dataset

Replace `medications.json` with a hand-curated set scoped to medicines that are
genuinely taken as-needed or as a short defined course, and that have well-established,
conservative interval + daily-max defaults. **Confident entries only** — no speculative
clinical values; where a value isn't well-established, omit the default and let the user
set it.

**Naming:** Australian primary names with US/other names kept as search aliases
(continues the existing AU localisation decision). Emergency number is 000.

**Schema** (extends the current `{generic, brands[], strengths[], unit}`):

```jsonc
{
  "generic": "Ibuprofen",
  "brands": ["Nurofen", "Advil"],
  "category": "pain-fever",        // one of the category ids below
  "strengths": [200, 400],          // mg, optional
  "unit": "mg",
  "defaultIntervalHours": 6,        // seeds the picker; user-editable
  "defaultMaxPerDay": 6,            // tablets/doses per calendar day; user-editable
  "form": "tablet"                  // tablet | capsule | liquid | inhaler | cream | drops | spray | lozenge
}
```

`defaultIntervalHours` / `defaultMaxPerDay` pre-fill the add-medication picker so a
typical PRN med can be added in one tap; the user can still adjust both before saving.

**Categories** (PRN / short-term):

| id | Label | Examples |
|----|-------|----------|
| `pain-fever` | Pain & fever | paracetamol, ibuprofen, aspirin, naproxen, diclofenac, codeine combos, topical anti-inflammatory gels |
| `allergy` | Allergy | cetirizine, loratadine, fexofenadine, desloratadine, promethazine; allergy eye drops & nasal sprays |
| `antibiotic` | Antibiotics (short course) | amoxicillin, amoxicillin/clavulanate, cefalexin, doxycycline, flucloxacillin, trimethoprim, metronidazole, azithromycin, nitrofurantoin |
| `nausea` | Nausea & motion sickness | ondansetron, metoclopramide, prochlorperazine, domperidone; hyoscine, dimenhydrinate |
| `reflux` | Reflux & indigestion | antacids, alginate (Gaviscon), famotidine, short-term PPIs (omeprazole, pantoprazole, esomeprazole) |
| `cough-cold` | Cough, cold & decongestant | pseudoephedrine, phenylephrine, dextromethorphan, guaifenesin, bromhexine |
| `gut` | Diarrhoea & constipation | loperamide; macrogol, senna, docusate, lactulose, bisacodyl |
| `migraine` | Migraine | sumatriptan, rizatriptan, zolmitriptan, eletriptan |
| `cramps` | Cramps & period pain | hyoscine butylbromide (Buscopan), mebeverine, mefenamic acid |
| `steroid-short` | Short-course steroids | prednisolone, hydrocortisone cream, betamethasone cream |
| `sleep` | Sleep & short-term calm | melatonin, doxylamine, temazepam |
| `antifungal` | Antifungal (short course) | fluconazole, clotrimazole, terbinafine, miconazole |
| `antiviral` | Antiviral (short course) | aciclovir, valaciclovir, famciclovir |
| `reliever` | Reliever inhaler | salbutamol, terbutaline |
| `throat-mouth` | Throat & mouth | benzydamine (Difflam), choline salicylate (Bonjela), medicated lozenges |
| `skin` | Skin & topical relief | hydrocortisone cream, antihistamine/anti-itch cream, antiseptic, bite & sting relief |
| `urinary` | Cystitis relief | urinary alkalinisers (Ural) |
| `eye-ear` | Eye & ear (short course) | chloramphenicol eye drops, antihistamine eye drops, ear drops |

The picker groups search results by category (collapsible headings) so the list stays
navigable. Plain substring search still matches across all categories at once.

**Free-text fallback:** an "Add a medication not listed" option creates a med from a
typed name, with the picker's interval/max/form fields blank for the user to fill. These
custom meds carry `category: "custom"` and behave identically once saved.

## 2. Bold Dark theme + redesigned tile

Restyle the app to the approved dark direction (slate `#0f172a` field, `#1e293b` tiles,
cyan `#22d3ee` primary accent). This is a CSS + tile-markup change only; no logic changes.

**Tile contents** (per med):

- Name + strength/form sub-line (e.g. "Ibuprofen · 200mg · 1 tab").
- **Last taken** line — `🕑 Last taken 2:48 PM` (relative-friendly time). Hidden if never taken.
- Status, by `computeStatus` state, with glowing status colours:
  - `ready` → green pill "Ready now".
  - `wait` → amber pill with a large live countdown (e.g. `3:12 until next`).
  - `daily_max` → red pill "Daily max".

Tap → dose sheet (log ½/1/2 — unchanged logic). Long-press → history (now 14-day, below).
The countdown ticks live while the grid is visible.

## 3. 14-day history with default graph + list toggle

**Storage:** change `pruneDoses` cutoff from `48 * 3600 * 1000` to `14 * 24 * 3600 * 1000`
(14 days). Update the corresponding storage test.

**History view** (opened via long-press on a tile, scoped to that med):

- **Default — Daily dose bars:** one bar per day across the last 14 days; bar height =
  doses (units) logged that day. A dashed reference line marks that med's
  `maxDailyUnits`; bars render green normally, amber as they approach the max, red at/over
  it. X-axis labelled "2 wks ago → today". Rendered with plain DOM/SVG — **no chart
  library, no new dependencies.**
- **List toggle:** a "List" control switches to the existing chronological dose list,
  retaining per-entry **edit time** and **delete**. Edits/deletes recompute the graph and
  the tile status (same recompute path as today).
- A small toggle (Graph / List) sits at the top of the history sheet; Graph is selected by
  default on open.

Pure aggregation helper (testable, no DOM): `dailyDoseTotals(doses, medId, now, days=14)`
→ array of `{ dayStart, units }` for each of the last N calendar days (zero-filled).

## 4. Landing page

A dark, on-brand intro screen shown on first launch and reachable any time from the menu
(replaces/absorbs the current About). Content (approved copy):

- Wordmark "DoseGrid".
- Headline: **"Know when you *can*, not when you *should*."**
- Lead: *"DoseGrid tracks your as-needed and short-course medicines and shows when enough
  time has passed — or when you've reached the daily limit. It never tells you to take
  anything."*
- Three points: **See the wait** (each dose starts a countdown to when the next is
  allowed) · **Respect the max** (tiles turn red once you hit the safe daily limit) ·
  **Stays on your phone** (no account, no cloud).
- Primary button: **Get started →** (dismisses to the grid).
- Disclaimer: *"Not medical advice. DoseGrid is a personal tracking tool. Always follow
  the directions on your medicine label or the advice of your doctor or pharmacist. Never
  exceed the stated dose. In an emergency, call 000."*

**First-launch logic:** a `localStorage` flag (`dosegrid.onboarded`) gates auto-showing on
first run; "Get started" sets it. A menu entry ("About / How it works") reopens the page
on demand without affecting the flag.

## Data flow (unchanged shape)

1. App loads → `loadMeds()` / `loadDoses()` from `localStorage`; `pruneDoses` (now 14d) on load.
2. First run (no `dosegrid.onboarded`) → landing page; else → grid.
3. Add med → grouped picker over curated dataset (or custom) → seed interval/max from
   defaults → save med.
4. Tap tile → dose sheet → `addDose` → re-render tile via `computeStatus`.
5. Long-press tile → history sheet → `dailyDoseTotals` graph (default) or list (edit/delete).

## Testing

Reuse `node --test`. Existing dosing/storage/data tests stay green (adjusting the prune
test to 14 days). New unit tests:

- `dailyDoseTotals` — zero-fills empty days; sums units per calendar day; respects the
  N-day window; ignores other meds.
- `pruneDoses` — keeps entries within 14 days, drops older (updated expectation).
- Dataset sanity — every entry has a valid `category`; any `defaultIntervalHours`/
  `defaultMaxPerDay` present are positive numbers; brands is an array.

Manual checklist (browser, then on-device): add a curated med (search by brand + generic,
grouped by category); add a custom free-text med; log doses → Wait countdown ticks; reach
daily max → red; long-press → 14-day bar graph shows, toggle to list, edit a time + delete
→ graph and tile recompute; first launch shows landing page, "Get started" dismisses and
doesn't reappear on reload; menu reopens landing page; offline reload still works (PWA).

## Deployment

Same as today: commit + `git push` to `main`; GitHub Pages rebuilds
`https://cortylok.github.io/dosegrid/`. Bump the cache name in `service-worker.js` so the
restyled assets and new dataset are picked up.
