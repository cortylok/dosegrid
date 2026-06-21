# DoseGrid Freemium Gating — Design

**Date:** 2026-06-21
**Status:** Approved (design); pending spec review
**Scope:** Web-app freemium gating + paywall, built against a stubbed entitlement seam. **Out of scope** (separate specs to follow): Capacitor native scaffolding (#2) and real native in-app-purchase wiring (#3).

## Summary

Introduce a freemium model to DoseGrid. The **free** tier is fully functional for day-to-day use but only **shows the last 24 hours** of logged history. **Pro** is a **one-time lifetime unlock** that reveals the complete, locally-stored history. All data is always stored on-device, so upgrading instantly reveals history that was being kept quietly the whole time — nothing is lost.

This spec covers the entire gate + paywall + prompts in the web app, routed through a single `isPro()` entitlement seam so the later native IAP work only has to implement one module.

## Locked product decisions

1. **Build order:** freemium gating first (this spec) → Capacitor scaffolding → native IAP.
2. **Storage model:** store *everything* on-device (stop the boot-time pruning). The free tier gates the **view**, not storage. Buying Pro reveals all retained history with no migration.
3. **What is gated:** *only* viewing/charting data older than 24 hours. Everything else is free:
   - logging doses, logging pain scores
   - current status tiles (ready / wait / daily-max)
   - the recent (≤24h) timeline, pain chart, and per-med history
   - editing/deleting entries, and notes on entries within the 24h window
   - **all safety warnings (early-dose / over-limit) are always free and never gated.**
4. **Purchase model:** a single **one-time lifetime unlock** (non-consumable). No subscriptions.
5. **Prompting:** contextual at the 24h boundary **plus** an occasional one-off nudge **plus** a quiet menu entry. No timed nags beyond the single nudge.
6. **Web tier:** the web/PWA is a **test surface only** and will be retired once the native apps ship. Entitlement is toggleable for testing; default is **free** so the gate is exercised.

## Architecture

Enforcement uses a **single gating module** as the source of truth (chosen over duplicating the 24h rule across views, or a dumb data-layer slice that can't signal "there's more, locked"). Every view asks `gating.js` for the visible window *and* the lock state, so the rule lives in exactly one place and is fully unit-testable.

```
pro.js  ──isPro()──►  gating.js  ──visibleWindow / hiddenCount / shouldNudge──►  views
  ▲                                                                              (timeline, painview, ui)
  └── setPro / purchasePro / restorePurchases  ◄── paywall (ui.js) / dev toggle / [native IAP later]
```

### Components

**`js/pro.js` (new) — entitlement seam**
- `isPro(): boolean` — reads `localStorage 'dosegrid.pro'`; default `false`.
- `setPro(on: boolean)` — persists the flag.
- `purchasePro(): Promise<boolean>` — **stub**: on the test/web build, resolves by `setPro(true)`. The native IAP layer (spec #3) replaces the body; no other caller changes.
- `restorePurchases(): Promise<boolean>` — **stub**: same shape; native layer replaces.
- Dev/test toggle to flip Pro: a hidden menu tap-target (primary), plus a `?pro=1` URL convenience. Test-only; ignored in production native builds (where the native IAP layer owns the entitlement).

**`js/gating.js` (new) — the 24h rule, in one place**
- `FREE_WINDOW_HOURS = 24`.
- `visibleWindow(now, pro) → { fromTs, locked }` — `fromTs = pro ? -Infinity : now - 24h`; `locked = !pro`.
- `hiddenCount(entries, now, pro) → number` — entries with `timestamp < fromTs` (0 when Pro). Drives "+N earlier" labels and the nudge.
- `shouldNudge(state, now) → boolean` — pure predicate: `!pro && hasLockedData && usageDays >= 5 && !nudgeSeen`.
- `recordUsageDay(now)` / usage-day tracking helper (counts distinct calendar days the app was opened, stored in `localStorage 'dosegrid.usageDays'`).

**`js/storage.js` + `js/app.js` — stop pruning**
- Remove the boot-time `pruneDoses`/`prunePain` calls so all history is retained. The `prune*` functions remain in the module (unused at boot; available for any future safety cap) but no longer delete in-window or historical data.
- **Caveat (documented, accepted):** data already deleted for existing users under the old 14d/90d windows cannot be recovered; full history accrues from this change forward.

**`js/timeline.js`, `js/painview.js`, `js/ui.js` — view gating**
- **Timeline / pain chart:** for free users the time axis is clamped to `[now-24h, now]`; pan/zoom cannot move earlier than `fromTs`. The left edge renders a tasteful **"🔒 Unlock full history"** cap that opens the paywall. Pro keeps today's unlimited, zoomable behavior unchanged.
- **Per-med history list** (long-press): free shows entries within 24h, followed by a footer **"+N earlier doses — Unlock full history"** (N from `hiddenCount`) that opens the paywall.
- All three derive the window and lock state from `gating.js`.

**`js/ui.js` — paywall + prompts**
- **Paywall sheet:** title "DoseGrid Pro — keep your full history"; feature list; one-time price shown from a placeholder constant (real price set on the store product later); **Unlock** button → `purchasePro()`; **Restore purchase** link → `restorePurchases()`; reassurance line "Safety warnings are always free." On success it re-renders and the locks disappear.
- **Contextual prompt:** the locked timeline cap and the per-med footer open the paywall.
- **Occasional nudge:** a one-off dismissible banner shown when `shouldNudge()` is true; dismissing sets `localStorage 'dosegrid.proNudgeSeen'`.
- **Quiet entry:** a "DoseGrid Pro ✦" item in the menu/landing that opens the paywall; shows "✓ Active" once Pro.

## Data flow

1. **Boot** (`app.js`): load all doses/pain (no prune); `recordUsageDay(now)`.
2. **Render:** each view calls `visibleWindow(now, isPro())`; free → filter to window + render lock affordances; Pro → full history. If `shouldNudge()` → show the one-off banner.
3. **Upgrade:** paywall **Unlock** → `purchasePro()` → `setPro(true)` → re-render → full history appears.

## Storage keys

| Key | Meaning |
|---|---|
| `dosegrid.pro` | entitlement flag (boolean) |
| `dosegrid.usageDays` | distinct calendar days opened (for the nudge) |
| `dosegrid.proNudgeSeen` | the one-off nudge has been shown/dismissed |

(Existing `dosegrid.doses`, `dosegrid.pain`, `dosegrid.country`, etc. unchanged.)

## Testing

- **`node --test` (pure logic):**
  - `visibleWindow` returns `fromTs` of `-Infinity` for Pro and `now-24h` for free; `locked` matches `!pro`.
  - `hiddenCount` counts only entries older than the window; `0` when Pro.
  - `shouldNudge` true only when free + has locked data + usageDays ≥ 5 + not yet seen; false otherwise (each condition flipped).
  - usage-day tracking records distinct days, not duplicates.
  - `pro.js`: `setPro`/`isPro` round-trip; `purchasePro` stub flips entitlement.
  - boot no longer drops in-window data (store-everything behavior).
- **Headless browser:** free timeline clamps at 24h with the lock cap; per-med footer shows "+N earlier"; toggle Pro → history appears and locks vanish; paywall opens from cap, footer, and menu entry; nudge banner appears under `shouldNudge` conditions and dismisses.

## Risks / notes

- **Store review:** safety features remaining free, and a transparent one-time unlock (no dark patterns), keep this clean for App Store / Play review.
- **Trust:** the single nudge + contextual prompts avoid nag-fatigue in a medical app.
- **Seam discipline:** nothing outside `pro.js` calls the store; `purchasePro`/`restorePurchases` are the only integration points for the native IAP spec.
