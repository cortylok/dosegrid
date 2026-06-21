# DoseGrid Dose Notifications — Design

**Date:** 2026-06-21
**Status:** Approved (design); pending spec review
**Scope:** Opt-in local dose notifications (Pro feature) on the native apps, via `@capacitor/local-notifications`. Sub-project **#4** (builds on the Capacitor shell from #2; independent of the native-IAP work #3 except that both gate on `js/pro.js`).

## Summary

Add per-medication dose reminders delivered as native local notifications:

- **PRN meds → interval permission notification:** when you log a dose, schedule one notification at `lastDose + intervalHours` reading **"You can take another {med} now"** — on-brand ("know when you *can*").
- **Scheduled/course meds → clock-time reminders:** daily-repeating notifications at user-set times reading **"Time for your {med}."**

Notifications are **Pro-gated** (the existing free safety warnings are unaffected — only proactive reminders are Pro). Each med is **opt-in** (default off). A user-adjustable **quiet-hours** window delivers notifications **silently with vibration only** (no sound) instead of suppressing them. All scheduling logic is pure and unit-tested; the native plugin is the only non-testable edge and is mocked in tests. On the web build (the retiring test surface) notifications are a **no-op**.

## Locked decisions

1. **Two flavors by `doseType`:** PRN → interval-based "you can take another now"; scheduled → daily clock-time reminders.
2. **Pro-gated** via `isPro()` (`js/pro.js`). Safety warnings stay free.
3. **Per-med opt-in**, default off.
4. **Quiet hours:** silent + vibration-only (not deferred/dropped); window user-adjustable; default 22:00–07:00.
5. **Reschedule-all** model: one `syncNotifications()` cancels all and reschedules from current state on every relevant change.
6. **Native-only:** web build is a no-op.

## Architecture

```
state (meds + doses + notifySettings + isPro)
        │
        ▼
notify-schedule.js  (PURE: build the desired notification set; quiet-hours classify; default times)
        │  desired: [{ id, medId, fireAt|repeatAt, channel, title, body }]
        ▼
notify.js  (NATIVE seam: permission, channels, cancel-all + (re)schedule via @capacitor/local-notifications)
        ▲
        │ syncNotifications() called from: dose log · med add/edit/remove · settings change · app resume/boot
   ui.js / app.js
```

The split keeps **all decision logic pure and testable** (`notify-schedule.js`) and isolates the untestable plugin calls in a thin `notify.js`.

### Components

**`js/notify-schedule.js` (new — pure, unit-tested)**
- `defaultReminderTimes(intervalHours) → ["HH:MM", …]` — `n = clamp(round(24 / intervalHours), 1, 6)` (standard dosing: 8h→3 TID, 12h→2 BID, 24h→1), then spread `n` times evenly across the 08:00–20:00 waking window: for `n>1`, `time_i = 08:00 + i·(12h/(n−1))`; for `n==1`, `["08:00"]`. e.g. 8h → `["08:00","14:00","20:00"]`, 12h → `["08:00","20:00"]`, 6h → `["08:00","12:00","16:00","20:00"]`.
- `inQuietHours(hhmm, settings) → boolean` — handles windows that cross midnight.
- `buildSchedule({ meds, doses, settings, now }) → DesiredNotification[]` — the core: for each med with `notify` true, emit:
  - PRN: a one-shot at `lastDose + intervalHours` (skip if no dose yet, or if the time is already past `now`), title med name, body "You can take another {med} now".
  - scheduled: one daily-repeating entry per `reminderTimes` value, body "Time for your {med}".
  - each entry tagged `channel: inQuietHours(fireTimeOfDay, settings) ? 'quiet' : 'default'`.
  - stable numeric `id` per (medId, slot) so reschedules are deterministic.
- Returns `[]` when `!pro` (caller passes `pro`).

**`js/notify.js` (new — native seam; web no-op)**
- `isSupported()` → `Capacitor?.isNativePlatform?.()`.
- `ensureChannels()` — Android: create `default` (sound+vibrate) and `quiet` (vibrate, no sound) channels. iOS: no-op (sound set per-notification).
- `requestPermission() → boolean` — calls the plugin's permission request; returns granted.
- `hasPermission() → boolean`.
- `syncNotifications()` — early-return if `!isSupported()` or `!isPro()`; else: load meds/doses/settings, `const desired = buildSchedule(...)`, cancel all previously-scheduled DoseGrid notifications, schedule `desired` (mapping `channel:'quiet'` → quiet channel / no iOS sound; daily entries use `schedule.repeats` with `on:{hour,minute}`; one-shots use `schedule.at`).
- All plugin calls wrapped in try/catch (no-throw).

**`js/storage.js` (modify)** — notification settings accessors:
- `loadNotifySettings()` / `saveNotifySettings(s)` for `dosegrid.notifySettings` (`{ quietStart, quietEnd }`, default `{quietStart:'22:00', quietEnd:'07:00'}`).
- Med objects gain optional `notify: boolean` and `reminderTimes: string[]` (persisted with the med via existing `saveMeds`; no storage API change needed beyond defaults).

**`js/ui.js` (modify)** — med config form + settings:
- In the dosing form: a **"Remind me"** toggle. For scheduled meds, reveal a reminder-times editor (chips of `HH:MM`, add/remove, seeded from `defaultReminderTimes`). For **free users**, the toggle is shown with a "Pro" badge and tapping it opens `openPaywall()` instead of enabling.
- On save: persist `notify`/`reminderTimes`; call `syncNotifications()`.
- A **notification settings sheet** (entry on the landing/menu): master note + quiet-hours start/end `<input type="time">`; saving calls `saveNotifySettings` + `syncNotifications()`.
- First time a user enables a reminder: call `requestPermission()`; if denied, show a gentle "Allow notifications in your device Settings" note.

**`js/app.js` (modify)** — call `syncNotifications()` on boot and on resume (`visibilitychange`/`resume`), alongside the existing re-renders.

**`package.json` (modify)** — add `@capacitor/local-notifications` dependency; `npx cap sync` after.

## Data model

| Key / field | Meaning |
|---|---|
| med.`notify` | per-med reminders on/off (default false) |
| med.`reminderTimes` | `["HH:MM"]` for scheduled meds (default from `defaultReminderTimes`) |
| `dosegrid.notifySettings` | `{ quietStart, quietEnd }` (default 22:00 / 07:00) |

(Reuses `dosegrid.pro` for gating; existing `dosegrid.meds`/`dosegrid.doses` unchanged in shape beyond the two optional med fields.)

## Notification limits & timing

- **iOS 64 pending cap:** scheduled reminders use **daily-repeating** entries (one per time slot, not one per day), and PRN reminders are single one-shots — so total pending stays small for realistic med counts.
- **DST / time zones:** clock-time reminders use local `on:{hour,minute}` repeats (the OS handles wall-clock). PRN one-shots use absolute timestamps.
- **Reschedule-all** keeps the OS state consistent with app state after every change; stale notifications can't linger because every sync cancels first.

## Testing

- **`node --test` (pure):**
  - `inQuietHours` — inside/outside, and a window crossing midnight (22:00–07:00).
  - `defaultReminderTimes` — 4h/8h/12h/24h produce sane, in-waking-hours slot counts.
  - `buildSchedule` — PRN med with a recent dose → one-shot at last+interval with the right body; PRN with no dose → nothing; scheduled med → one repeating entry per time with "Time for your…"; a slot in quiet hours → `channel:'quiet'`; `pro=false` → `[]`; `notify=false` med → excluded.
- **Native/manual (device or emulator):** enabling a reminder requests permission and schedules; a fired notification opens the app; a quiet-hours notification arrives silently (vibrate only).
- `notify.js` itself is a thin plugin wrapper verified manually; its logic lives in the tested `notify-schedule.js`.

## Risks / notes

- **Store optics:** medication reminders behind a paywall can draw scrutiny; mitigated by keeping **safety warnings free** and framing Pro reminders as convenience. (Product decision made by the owner.)
- **Permissions:** users may deny; the feature degrades gracefully (toggle stays on intent, but nothing fires until permission granted — surfaced via `hasPermission()`).
- **Web no-op:** keeps the test PWA simple; notifications only live on the native shell.
- **Seam discipline:** `notify.js` is the only file that touches the plugin; `notify-schedule.js` holds all logic; gating reuses `js/pro.js`.

## Out of scope

Pain check-in reminders; "missed dose" follow-up escalation; notification action buttons (e.g. "Log dose" from the notification) — all candidate future enhancements, not in this spec.
