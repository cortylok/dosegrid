# Theme system — Classic + Aurora + Apothecary (light/dark) — Design

**Date:** 2026-06-23
**Status:** Approved (design), pending spec review
**Area:** new `js/theme.js`, new `js/theme-render.js`, `js/ui.js`, `js/painview.js`, `js/timeline.js`,
`index.html`, `css/styles.css` + new `css/theme-classic.css` / `theme-aurora.css` / `theme-apothecary.css`,
`service-worker.js`
**Branch:** `theme-system`
**Scope note:** Sub-project B of the IA+themes work, built on the new Home/Timeline IA (sub-project A).

## Goal

Ship a real theme system: three fully-themed looks the user picks in settings, each with a light and
dark mode:
- **Classic** (default) — the current slate/cyan dark app, plus a light variant.
- **Aurora** — frosted health-OS; tiles are **radial dose dials**; Fraunces + Hanken Grotesk.
- **Apothecary** — warm tactile; tiles are **blister-pack dose dots**; Spectral + Figtree.

"Fully per-theme" means: the **signature surfaces** (med tiles, Home pain card, dose-sheet header)
get **bespoke per-theme structure**; **every other surface** (dose-sheet body, pain log, dose
detail, warnings, history, paywall, settings, landing, header/tabs, timeline) is **deeply themed
via design tokens** — palette, fonts, radii, shadows, button and sheet shapes — through one
structural code path each. No change to dosing, safety, gating, notifications, or pain logic.

## Theme + mode model (`js/theme.js`, new — pure + DOM apply)

State persisted in `localStorage`:
- `dosegrid.theme` ∈ `{classic, aurora, apothecary}` (default `classic`).
- `dosegrid.mode` ∈ `{auto, light, dark}` (default `auto`).

Pure helpers (unit-tested):
- `getTheme()` / `setTheme(t)` — validates against the allowed set; ignores unknown → keeps current.
- `getMode()` / `setMode(m)` — same validation.
- `resolvedDark(mode, systemDark)` → boolean: `mode==='dark' || (mode==='auto' && systemDark)`.
- `htmlClass(theme, dark)` → e.g. `"theme-aurora is-dark"` (the `<html>` className).
- `THEMES`, `MODES`, `THEME_LABELS` exported for the picker.

DOM apply (browser only):
- `applyTheme()` — reads theme+mode, computes `systemDark` via
  `matchMedia('(prefers-color-scheme: dark)').matches`, sets `document.documentElement.className`
  to `htmlClass(...)`, updates `<meta name="theme-color">` to the theme's bar colour, then dispatches
  `dosegrid:refresh` so mounted views re-render with the new theme's structure.
- A `matchMedia('(prefers-color-scheme: dark)')` change listener re-applies when mode is `auto`.

## Render delegation (`js/theme-render.js`, new — pure: view → HTML string)

Dispatches on `getTheme()`. Each function takes a normalised, pre-formatted **view object** (so this
module stays dependency-light and testable) and returns an HTML string:

- **`tileHtml(view)`** — the full `<button class="tile" data-med-id="…">…</button>` inner per theme.
  `view = { name, strength, maxDay, takenToday, state, scheduled, remainingText, holdIng, lastLine, color }`
  where `state ∈ {ready, wait, hold, daily_max}`, `remainingText` = `fmtRemaining(msRemaining)`,
  `color` = `medColor(med.order)`. Classic = current bars/status chip; Aurora = radial dial (ring =
  `takenToday/maxDay`, centre = the availability word/time); Apothecary = blister strip + status line.
- **`painCardHtml(view)`** — the Home pain summary. `view = { score, severity, relative, note }` or
  `null` (empty state). Classic = current `.pain-now`; Aurora = radial pain ring; Apothecary = warm pill.
- **`doseHeaderHtml(view)`** — the header block of the dose sheet (above the shared body).
  `view = { name, strength, maxDay, takenToday, state }`. Classic = name + strength; Aurora = dial +
  name; Apothecary = name + blister strip.
- **`timelinePalette(theme, dark)`** — `{ pain, area, grid, axis, lane, now, band, ring, glow:false }`
  consumed by `timeline.js` (colours only; structure unchanged; glow always off).

The signature renderers are adapted from the already-built demo (`design/concepts/aurora.js`,
`apothecary.js`) and the app's Classic markup.

## Wiring the existing renderers

- `js/ui.js` `renderGrid()`: build the `view` (it already computes `state`, `msRemaining`, `holdIng`,
  `lastLine`, `scheduled`, `unitsToday`), then `tile.innerHTML = tileHtml(view)` instead of the inline
  Classic markup. The `<button class="tile">` wrapper, `data-medId`, and `attachTileHandlers(tile, med)`
  stay (handlers shared across themes). The `+ Add medication` tile stays.
- `js/ui.js` `openDoseSheet()`: replace the inline `<h2>…</h2>` header with `doseHeaderHtml(view)`;
  the body (avail line, ingredient note, dose buttons, Edit/History) is unchanged and themed by CSS.
- `js/painview.js` `renderHomePain()`: replace the inline `.pain-now` summary with `painCardHtml(view)`;
  the nudge + Log pain button stay.
- `js/timeline.js`: its SVG renderer reads colours from `timelinePalette(getTheme(), resolvedDark(...))`
  instead of the current hard-coded values; per-med dose colours keep using `medColor`.

## CSS architecture

- `css/styles.css` stays the **shared** layout + structural rules + modal mechanics; it already paints
  everything from tokens (`--bg`, `--field`, `--surface`, `--line`, `--accent`, `--text`, `--muted`,
  `--ready`, `--wait`, `--max`, `--radius`). Add token hooks it doesn't have yet: `--font-display`,
  `--font-body`, `--shadow`, and apply `font-family: var(--font-body)` to body / `var(--font-display)`
  to headings.
- `css/theme-classic.css` — sets all tokens for `.theme-classic` (light) and `.theme-classic.is-dark`
  (the current dark values), font = Inter. Current `:root` palette moves here as the Classic dark values.
- `css/theme-aurora.css` — tokens for `.theme-aurora` / `.theme-aurora.is-dark` (porcelain ↔ deep
  navy aurora), `@import` Fraunces + Hanken; the dial tile + radial pain-card + frosted sheet structure
  (adapted from the demo's `aurora.css`, retargeted to `.theme-aurora .tile`, `.theme-aurora .pain-now`,
  `.theme-aurora .sheet`).
- `css/theme-apothecary.css` — tokens for `.theme-apothecary` / `.is-dark` (cream ↔ espresso),
  `@import` Spectral + Figtree; blister tile + warm pain-card + tactile sheet (from the demo's
  `apothecary.css`). Two-column med grid is already the app default.
- `index.html` `<head>` links all three theme CSS files after `styles.css`; the active one wins via the
  `<html class="theme-…">` set by `applyTheme()`. `:root` keeps only structural fallbacks.

## Picker UI (settings)

Add an **Appearance** section to `showLanding()` (settings, reachable any time via the `?` button):
- Three **theme chips** (Classic / Aurora / Apothecary) showing the active one selected.
- An **Auto / Light / Dark** segmented control.
- Changing either → `setTheme`/`setMode` → `applyTheme()` (which re-applies the class + fires
  `dosegrid:refresh`). The landing re-renders so the chips reflect the choice and the picker itself is
  on-theme.

## Boot

`js/app.js` calls `applyTheme()` once at the very top of boot (before the first render) so the correct
theme class is on `<html>` before anything paints. (Import `applyTheme` from `theme.js`.)

## Testing

Pure unit tests (`node --test`):
- `tests/theme.test.js` — `resolvedDark` truth table (auto+system, light, dark); `getTheme/getMode`
  defaults + invalid-value rejection (via a localStorage shim); `htmlClass(theme, dark)` strings;
  `THEMES`/`MODES` membership.
- `tests/theme-render.test.js` — for each theme, `tileHtml(view)` returns a non-empty string,
  contains the theme's signature marker (Classic → `class="status`, Aurora → `dial`, Apothecary →
  `blister`) and the med name; renders every `state` value without throwing; `painCardHtml(null)`
  yields the empty-state markup; `doseHeaderHtml` includes the med name for each theme;
  `timelinePalette(theme,dark)` returns the expected keys with `glow:false`.
- The existing 103 tests stay green (no logic touched).

Manual browser smoke (documented): pick each theme × each mode from the landing; confirm tiles show
the right structure (bars/dials/blisters), Home pain card + dose sheet + timeline + all modals adopt
the palette + fonts, the choice persists across reload, Auto follows the OS setting, and dosing/safety
behaviour is unchanged.

## Files touched

- New: `js/theme.js`, `js/theme-render.js`, `css/theme-classic.css`, `css/theme-aurora.css`,
  `css/theme-apothecary.css`, `tests/theme.test.js`, `tests/theme-render.test.js`.
- Modified: `index.html` (link theme CSS), `js/app.js` (`applyTheme()` on boot),
  `js/ui.js` (`renderGrid`/`openDoseSheet` delegate), `js/painview.js` (`renderHomePain` delegates),
  `js/timeline.js` (palette), `css/styles.css` (font/shadow tokens; move Classic palette out),
  `service-worker.js` (cache bump + precache the new files).

## Out of scope

- Per-theme **timeline structure** (kept shared, recoloured via palette) — a future deepening.
- Bundling theme fonts for the native build (loaded via the stylesheet for now; note for later).
- New themes beyond the three; Classic stays the default.
