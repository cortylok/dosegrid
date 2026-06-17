# DoseGrid — Early-Dose / Over-Max Safety Warning + Help Lines

**Date:** 2026-06-17
**Status:** Approved design, ready for planning
**Tier:** Free — safety features are never gated.

## Purpose

When a user logs a dose that is **earlier than their set interval** or that would take them
**over their daily maximum**, show a **confirm-before-logging** card that states the facts,
gives a brief caution, and surfaces **country-appropriate drug-advice / poison help lines** —
while still letting the user override ("Log it anyway"). Honours the app's ethos (track, don't
instruct) by informing rather than blocking, but adds a real safety nudge for the doubling-up case.

## Behaviour

- In the dose sheet, when the user taps a dose amount (½ / 1 / 2):
  - Run `checkDose(med, doses, addedUnits, now)`.
  - If it returns `null` → log immediately (current behaviour).
  - If it returns a warning → show the **confirm card**; **Cancel** aborts (nothing logged),
    **Log it anyway** records the dose and proceeds.
- **Triggers** (`checkDose`):
  - `early` — the med is still within its interval (`now < lastDoseTime + intervalHours`), i.e.
    `computeStatus` state is `wait`. Card shows the gap since the last dose vs the set interval.
  - `over` — `unitsToday + addedUnits > maxDailyUnits`. Card shows today's resulting total vs the
    set max. Reaching *exactly* the max does **not** warn.
  - If both apply, `over` takes precedence (the more serious message), but the card may note both.
- Card content: amber ⏱ for `early` / red 🛑 for `over`; a one-line headline; a **facts** box (real
  med name, numbers); a brief caution; a **help-lines** block for the selected country; **Cancel /
  Log it anyway**; a "Help lines for <Country> · Change country" footer.

## Country + help lines

- A `dosegrid.country` setting in `localStorage`, default `'AU'`. Chosen via a **country `<select>`**
  on the landing page and in About (the landing already shows on first launch — "pick once" with no
  extra wall).
- **Priority order (user decision):** prefer an **on-call nurse line** if the country has one,
  then a **poison/drug-information** line, and fall back to **emergency services only if neither
  exists**. Each country entry therefore carries an ordered `advice` list (nurse entries first,
  then poison) plus an `emergency` number; the card renders the `advice` list (nurse → poison),
  and shows the `emergency` number **only when `advice` is empty**.
- `js/helplines.js` exports `HELP_LINES` (code → `{ country, advice:[{label, number, note, kind}], emergency:{label, number} }`)
  and `helpLinesFor(code)` (falls back to the `other` entry). Vetted launch data:
  - **AU** — nurse: healthdirect **1800 022 222** (24/7); poison: Poisons Information Centre **13 11 26**; emergency **000**.
  - **NZ** — nurse: Healthline **0800 611 116** (24/7); poison: National Poisons Centre **0800 764 766**; emergency **111**.
  - **UK** — nurse: **NHS 111** (nurse-staffed, also handles poisoning for the public); emergency **999**.
  - **CA** — nurse: **811** (Health Link / Telehealth, most provinces); poison: Poison Centres **1-844-764-7669** (Québec **1-800-463-5060**); emergency **911**.
  - **US** — poison: Poison Help **1-800-222-1222** (24/7); emergency **911**. *(no single national nurse line — poison line is primary.)*
  - **IE** — poison: National Poisons Information Centre **01 809 2166**; emergency **112**. *(no national public nurse line — poison line is primary.)*
  - **other** — `advice` empty → the card shows: "Find your nearest poison/drug-advice centre at the
    **WHO World Directory of Poisons Centres** (apps.who.int/poisoncentres), or contact your doctor or
    pharmacist," plus the emergency fallback "In an emergency, call your local emergency number."
- Numbers render as `tel:` links (work as taps on the native build; harmless on web). The WHO-directory
  fallback renders as an `https:` link.
- This ordering applies to **both** triggers (`early` and `over`): nurse first where available, then
  poison; the headline/caution differ per trigger but the help-line list does not.

## Architecture (small, testable units)

- `js/safety.js` *(pure, no DOM)* — `checkDose(med, doses, addedUnits, now)` → `null | { type, lastDoseTime, gapMs, intervalHours, unitsToday, resultingUnits, maxDailyUnits }`. Reuses `computeStatus`/`unitsToday` from `dosing.js`.
- `js/helplines.js` *(data + lookup)* — `HELP_LINES`, `helpLinesFor(code)`.
- `js/ui.js` — dose-sheet amount handler runs `checkDose`; new `openDoseWarning(med, units, info, onConfirm)` sheet renders the card and wires Cancel / Log anyway; reads `dosegrid.country` for the help lines.
- Country setting: a small `getCountry()` / `setCountry(code)` (in `helplines.js` or `storage.js`); a `<select>` injected into the landing page (`showLanding`) and About, persisting `dosegrid.country`.
- No change to the dosing engine, the timeline, or storage shapes.

## Data flow

1. User taps a dose amount → `checkDose(med, loadDoses(), units, Date.now())`.
2. `null` → `addDose` + re-render (unchanged).
3. warning → `openDoseWarning(...)` with the country's help lines; **Log it anyway** → `addDose` + re-render; **Cancel** → close, nothing logged.
4. Country picker (landing/About) writes `dosegrid.country`; subsequent warnings show that country's lines.

## Testing

`node --test`:
- `checkDose` — `early` when within interval; `over` when `unitsToday+added > max`; `null` when ready and under max; `null` at exactly max; `over` precedence when both.
- `helpLinesFor` — returns the AU entry for `'AU'` with a **nurse** advice entry first; returns the `other` fallback (empty `advice`) for an unknown code; every entry has an `advice` array + an `emergency`; for AU the first `advice.kind` is `'nurse'`.

Browser/headless: tap an early dose → warning shows with correct gap; Log anyway logs it, Cancel doesn't; over-max dose → over card with poisons + emergency; switch country in About → numbers change; safety card never appears for a normal in-window/under-max dose.

## Out of scope

- Auto-detecting region (decided: explicit country picker, default AU).
- A full global number table (decided: vetted core + WHO-directory fallback).
- Notifications/reminders.
