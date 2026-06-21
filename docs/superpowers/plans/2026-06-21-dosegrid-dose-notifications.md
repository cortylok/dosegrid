# DoseGrid Dose Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in, Pro-gated native dose reminders — PRN "you can take another now" (interval) and scheduled clock-time reminders — with quiet-hours silent/vibrate delivery.

**Architecture:** All decision logic is a pure module (`notify-schedule.js`, unit-tested); a thin native seam (`notify.js`) talks to `@capacitor/local-notifications` via the `window.Capacitor.Plugins` global (buildless-safe; web no-op). A single `syncNotifications()` cancels all and reschedules from current state on every relevant change.

**Tech Stack:** Capacitor 8 `@capacitor/local-notifications`, vanilla ES modules, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-21-dosegrid-dose-notifications-design.md`

---

## File Structure

- **Create** `js/notify-schedule.js` — pure: `inQuietHours`, `defaultReminderTimes`, `buildSchedule`.
- **Create** `tests/notify-schedule.test.js`.
- **Create** `js/notify.js` — native seam (web no-op): permission, channels, `syncNotifications`.
- **Modify** `js/storage.js` — `loadNotifySettings`/`saveNotifySettings`.
- **Modify** `js/ui.js` — "Remind me" toggle + reminder-times editor (Pro-gated); notification settings sheet; sync on dose-log/med-save.
- **Modify** `js/app.js` — `syncNotifications()` on boot + resume.
- **Modify** `package.json` — add `@capacitor/local-notifications`.
- **Modify** `service-worker.js` — precache new JS + bump cache.
- **Modify** `README.md` — note the feature.

---

### Task 1: Install the local-notifications plugin

**Files:** `package.json` (+ `package-lock.json`)

- [ ] **Step 1: Install the plugin**

Run: `npm install @capacitor/local-notifications`
Expected: installs `@capacitor/local-notifications` (Capacitor 8-compatible); appears under `dependencies` in `package.json`.

- [ ] **Step 2: Sync into native projects**

Run: `npm run sync`
Expected: `build:www` runs, then `cap sync` reports updating `android` + `ios` and lists `@capacitor/local-notifications` among plugins. (CocoaPods note on Windows is acceptable.)

- [ ] **Step 3: Tests still green**

Run: `node --test`
Expected: PASS — 57 tests, 0 fail (no logic changed yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @capacitor/local-notifications plugin"
```

---

### Task 2: `inQuietHours` (TDD)

**Files:** Create `js/notify-schedule.js`; Create `tests/notify-schedule.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/notify-schedule.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inQuietHours } from '../js/notify-schedule.js';

const Q = { quietStart: '22:00', quietEnd: '07:00' };

test('inQuietHours: window crossing midnight', () => {
  assert.equal(inQuietHours('23:30', Q), true);
  assert.equal(inQuietHours('03:00', Q), true);
  assert.equal(inQuietHours('07:00', Q), false); // end exclusive
  assert.equal(inQuietHours('12:00', Q), false);
  assert.equal(inQuietHours('22:00', Q), true);  // start inclusive
});

test('inQuietHours: same-day window', () => {
  const day = { quietStart: '01:00', quietEnd: '06:00' };
  assert.equal(inQuietHours('03:00', day), true);
  assert.equal(inQuietHours('08:00', day), false);
});

test('inQuietHours: empty window (start==end) is never quiet', () => {
  assert.equal(inQuietHours('03:00', { quietStart: '00:00', quietEnd: '00:00' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/notify-schedule.test.js`
Expected: FAIL — cannot import `../js/notify-schedule.js`.

- [ ] **Step 3: Write the implementation**

```javascript
// js/notify-schedule.js — pure scheduling logic for dose notifications (no plugin calls).
import { lastDose } from './dosing.js';
import { resolveDoseType } from './categories.js';

function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

// Is a HH:MM time inside the quiet window? Handles windows that cross midnight.
export function inQuietHours(hhmm, settings) {
  const t = toMin(hhmm), s = toMin(settings.quietStart), e = toMin(settings.quietEnd);
  if (s === e) return false;
  return s < e ? (t >= s && t < e) : (t >= s || t < e);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/notify-schedule.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add js/notify-schedule.js tests/notify-schedule.test.js
git commit -m "feat(notify): add inQuietHours (quiet-window classifier)"
```

---

### Task 3: `defaultReminderTimes` (TDD)

**Files:** Modify `js/notify-schedule.js`; Modify `tests/notify-schedule.test.js`

- [ ] **Step 1: Add the failing test**

Append to `tests/notify-schedule.test.js`:

```javascript
import { defaultReminderTimes } from '../js/notify-schedule.js';

test('defaultReminderTimes: standard dosing maps to sensible slots', () => {
  assert.deepEqual(defaultReminderTimes(24), ['08:00']);              // once daily
  assert.deepEqual(defaultReminderTimes(12), ['08:00', '20:00']);     // BID
  assert.deepEqual(defaultReminderTimes(8),  ['08:00', '14:00', '20:00']); // TID
  assert.deepEqual(defaultReminderTimes(6),  ['08:00', '12:00', '16:00', '20:00']); // QID
});

test('defaultReminderTimes: clamps and handles missing interval', () => {
  assert.equal(defaultReminderTimes(undefined).length, 1); // → ['08:00']
  assert.ok(defaultReminderTimes(1).length <= 6);          // clamp upper bound
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/notify-schedule.test.js`
Expected: FAIL — `defaultReminderTimes` is not exported.

- [ ] **Step 3: Add the implementation**

Add to `js/notify-schedule.js`:

```javascript
const WAKE_START = 8, WAKE_END = 20; // spread reminders across 08:00–20:00

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Default clock times for a scheduled med, from its interval (standard dosing:
// 24h→1, 12h→2, 8h→3, 6h→4), spread evenly across the waking window.
export function defaultReminderTimes(intervalHours) {
  const n = Math.max(1, Math.min(6, Math.round(24 / (intervalHours || 24))));
  if (n === 1) return [fmt(WAKE_START * 60)];
  const spanMin = (WAKE_END - WAKE_START) * 60;
  const out = [];
  for (let i = 0; i < n; i++) out.push(fmt(Math.round(WAKE_START * 60 + (i * spanMin) / (n - 1))));
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/notify-schedule.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add js/notify-schedule.js tests/notify-schedule.test.js
git commit -m "feat(notify): add defaultReminderTimes (interval → clock slots)"
```

---

### Task 4: `buildSchedule` (TDD)

**Files:** Modify `js/notify-schedule.js`; Modify `tests/notify-schedule.test.js`

- [ ] **Step 1: Add the failing test**

Append to `tests/notify-schedule.test.js`:

```javascript
import { buildSchedule } from '../js/notify-schedule.js';

const SET = { quietStart: '22:00', quietEnd: '07:00' };
const noon = new Date('2026-06-21T12:00:00').getTime();

test('buildSchedule: returns [] when not Pro', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  assert.deepEqual(buildSchedule({ meds, doses: [{ medId: 'm1', timestamp: noon, units: 1 }], settings: SET, now: noon, pro: false }), []);
});

test('buildSchedule: PRN med schedules one-shot at last+interval', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  const doses = [{ medId: 'm1', timestamp: noon, units: 1 }];
  const out = buildSchedule({ meds, doses, settings: SET, now: noon, pro: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].fireAt, noon + 6 * 3600 * 1000); // 18:00
  assert.equal(out[0].body, 'You can take another Ibuprofen now.');
  assert.equal(out[0].channel, 'default'); // 18:00 not quiet
});

test('buildSchedule: PRN with no dose, or already-allowed, schedules nothing', () => {
  const meds = [{ id: 'm1', name: 'Ibuprofen', doseType: 'prn', notify: true, intervalHours: 6 }];
  assert.equal(buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true }).length, 0);
  const old = [{ medId: 'm1', timestamp: noon - 7 * 3600 * 1000, units: 1 }]; // interval already elapsed
  assert.equal(buildSchedule({ meds, doses: old, settings: SET, now: noon, pro: true }).length, 0);
});

test('buildSchedule: scheduled med makes one repeating entry per reminder time', () => {
  const meds = [{ id: 'm2', name: 'Amoxicillin', doseType: 'scheduled', notify: true, intervalHours: 8, reminderTimes: ['08:00', '23:00'] }];
  const out = buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].repeatAt, { hour: 8, minute: 0 });
  assert.equal(out[0].body, 'Time for your Amoxicillin.');
  assert.equal(out[0].channel, 'default');
  assert.equal(out[1].channel, 'quiet'); // 23:00 is in quiet hours
});

test('buildSchedule: notify=false meds are excluded; ids are stable & unique', () => {
  const meds = [
    { id: 'm1', name: 'A', doseType: 'prn', notify: false, intervalHours: 6 },
    { id: 'm2', name: 'B', doseType: 'scheduled', notify: true, intervalHours: 12, reminderTimes: ['08:00', '20:00'] },
  ];
  const out = buildSchedule({ meds, doses: [], settings: SET, now: noon, pro: true });
  assert.equal(out.length, 2);
  assert.equal(new Set(out.map((o) => o.id)).size, 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/notify-schedule.test.js`
Expected: FAIL — `buildSchedule` is not exported.

- [ ] **Step 3: Add the implementation**

Add to `js/notify-schedule.js`:

```javascript
function toHHMM(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Stable positive integer id per (med, slot) so reschedules are deterministic.
function notifId(medId, slot) {
  let h = 0;
  for (let i = 0; i < medId.length; i++) h = (h * 31 + medId.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000000) * 10 + slot;
}

// Build the desired notification set from current state. Pure; native layer schedules it.
export function buildSchedule({ meds, doses, settings, now, pro }) {
  if (!pro) return [];
  const out = [];
  for (const med of meds) {
    if (!med.notify) continue;
    if (resolveDoseType(med) === 'scheduled') {
      const times = (med.reminderTimes && med.reminderTimes.length)
        ? med.reminderTimes : defaultReminderTimes(med.intervalHours);
      times.forEach((hhmm, slot) => {
        const [hour, minute] = hhmm.split(':').map(Number);
        out.push({
          id: notifId(med.id, slot), medId: med.id,
          repeatAt: { hour, minute },
          channel: inQuietHours(hhmm, settings) ? 'quiet' : 'default',
          title: med.name, body: `Time for your ${med.name}.`,
        });
      });
    } else {
      const last = lastDose(doses, med.id);
      if (!last) continue;
      const fireAt = last.timestamp + (med.intervalHours || 0) * 3600 * 1000;
      if (fireAt <= now) continue;
      out.push({
        id: notifId(med.id, 0), medId: med.id, fireAt,
        channel: inQuietHours(toHHMM(fireAt), settings) ? 'quiet' : 'default',
        title: med.name, body: `You can take another ${med.name} now.`,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/notify-schedule.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add js/notify-schedule.js tests/notify-schedule.test.js
git commit -m "feat(notify): add buildSchedule (desired notification set)"
```

---

### Task 5: Notification settings in storage (TDD)

**Files:** Modify `js/storage.js`; Create `tests/notify-settings.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/notify-settings.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = (() => {
  let s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; }, clear: () => { s = {}; } };
})();

const { loadNotifySettings, saveNotifySettings } = await import('../js/storage.js');

beforeEach(() => localStorage.clear());

test('loadNotifySettings returns defaults when unset', () => {
  assert.deepEqual(loadNotifySettings(), { quietStart: '22:00', quietEnd: '07:00' });
});

test('saveNotifySettings round-trips and merges over defaults', () => {
  saveNotifySettings({ quietStart: '23:00' });
  assert.deepEqual(loadNotifySettings(), { quietStart: '23:00', quietEnd: '07:00' });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/notify-settings.test.js`
Expected: FAIL — `loadNotifySettings` not exported.

- [ ] **Step 3: Add to `js/storage.js`**

Append:

```javascript
const NOTIFY_KEY = 'dosegrid.notifySettings';
const NOTIFY_DEFAULTS = { quietStart: '22:00', quietEnd: '07:00' };

export function loadNotifySettings() {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    return raw ? { ...NOTIFY_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIFY_DEFAULTS };
  } catch { return { ...NOTIFY_DEFAULTS }; }
}
export function saveNotifySettings(patch) {
  const merged = { ...loadNotifySettings(), ...patch };
  try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  return merged;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/notify-settings.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/notify-settings.test.js
git commit -m "feat(storage): add notification settings (quiet hours)"
```

---

### Task 6: Native seam `notify.js` (web no-op)

**Files:** Create `js/notify.js`

This file is the only one that touches the plugin. It accesses it via the `window.Capacitor.Plugins` global (the app has no bundler, so a bare `import '@capacitor/local-notifications'` would break the browser). No unit test — verified by suite staying green + `node --check` + manual device testing.

- [ ] **Step 1: Create `js/notify.js`**

```javascript
// js/notify.js — native seam for dose notifications. Web build is a no-op.
// Accesses the plugin via the Capacitor global (no bundler in this project).
import { loadMeds, loadDoses, loadNotifySettings } from './storage.js';
import { isPro } from './pro.js';
import { buildSchedule } from './notify-schedule.js';

const LN = () => (typeof window !== 'undefined'
  && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;

export function isSupported() {
  return !!(typeof window !== 'undefined' && window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform() && LN());
}

async function ensureChannels() {
  const ln = LN();
  if (!ln || !ln.createChannel) return; // iOS / web: no channels
  try {
    await ln.createChannel({ id: 'default', name: 'Dose reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await ln.createChannel({ id: 'quiet', name: 'Quiet dose reminders', importance: 3, vibration: true, visibility: 1 });
  } catch { /* ignore */ }
}

export async function requestPermission() {
  const ln = LN(); if (!ln) return false;
  try { const r = await ln.requestPermissions(); return r.display === 'granted'; } catch { return false; }
}
export async function hasPermission() {
  const ln = LN(); if (!ln) return false;
  try { const r = await ln.checkPermissions(); return r.display === 'granted'; } catch { return false; }
}

// Cancel everything and reschedule from current state. No-op on web or when not Pro.
export async function syncNotifications() {
  const ln = LN();
  if (!isSupported() || !isPro()) return;
  try {
    await ensureChannels();
    const pending = await ln.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const desired = buildSchedule({
      meds: loadMeds(), doses: loadDoses(), settings: loadNotifySettings(), now: Date.now(), pro: isPro(),
    });
    if (!desired.length) return;
    const notifications = desired.map((d) => ({
      id: d.id, title: d.title, body: d.body,
      channelId: d.channel,                                   // Android channel
      sound: d.channel === 'quiet' ? null : undefined,        // iOS: silence quiet ones
      schedule: d.repeatAt
        ? { on: d.repeatAt, repeats: true, allowWhileIdle: true }
        : { at: new Date(d.fireAt), allowWhileIdle: true },
    }));
    await ln.schedule({ notifications });
  } catch { /* ignore */ }
}
```

- [ ] **Step 2: Verify syntax and that the suite is unaffected**

Run: `node --check js/notify.js && node --test`
Expected: no syntax error; PASS — 64 tests (57 prior + 3 inQuietHours + 2 defaultReminderTimes − wait, count is cumulative: 57 + 3 + 2 + 5 buildSchedule batch + 2 settings... see note). Confirm 0 fail.

> Test-count note: after Tasks 2–5 the suite has 57 + 10 (notify-schedule) + 2 (notify-settings) = **69 tests**. Use "69 pass, 0 fail" as the expectation from Task 6 onward.

- [ ] **Step 3: Commit**

```bash
git add js/notify.js
git commit -m "feat(notify): add native notification seam (web no-op)"
```

---

### Task 7: Med form — "Remind me" toggle + reminder times (ui.js)

**Files:** Modify `js/ui.js`

- [ ] **Step 1: Add imports**

After the gating import line in `js/ui.js` (the `import { visibleWindow, hiddenCount } from './gating.js';` line), add:

```javascript
import { defaultReminderTimes } from './notify-schedule.js';
import { syncNotifications, requestPermission } from './notify.js';
```

- [ ] **Step 2: Add the toggle + times editor to `dosingFieldsHtml`**

In `dosingFieldsHtml`, change the final `return (...)` so the reminder controls render after `doseTypeField`. Replace:

```javascript
  return (
    strengthField +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="${cur.intervalHours ?? 6}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="${cur.maxDailyUnits ?? 6}" />${maxNote}</div>` +
    doseTypeField
  );
```

with:

```javascript
  const pro = isPro();
  const notifyOn = !!cur.notify;
  const isScheduled = curType === 'scheduled';
  const times = (cur.reminderTimes && cur.reminderTimes.length) ? cur.reminderTimes : defaultReminderTimes(cur.intervalHours ?? 6);
  const timesEditor = `<div class="field" id="f-times-wrap" style="display:${notifyOn && isScheduled ? '' : 'none'}">` +
    `<label>Reminder times</label><div id="f-times">` +
    times.map((t) => `<input type="time" class="f-time" value="${t}" />`).join('') +
    `</div></div>`;
  const notifyField =
    `<div class="field"><label>Reminders ${pro ? '' : '<span class="pro-badge">PRO</span>'}</label>` +
    `<label class="switch"><input type="checkbox" id="f-notify" ${notifyOn ? 'checked' : ''} ${pro ? '' : 'data-locked="1"'} /> ` +
    `${isScheduled ? 'Remind me at set times' : 'Tell me when I can take another'}</label></div>` +
    timesEditor;
  return (
    strengthField +
    `<div class="field"><label>Min hours between doses</label><input id="f-int" type="number" min="0" step="0.5" value="${cur.intervalHours ?? 6}" /></div>` +
    `<div class="field"><label>Max tablets per day</label><input id="f-max" type="number" min="0" step="0.5" value="${cur.maxDailyUnits ?? 6}" />${maxNote}</div>` +
    doseTypeField +
    notifyField
  );
```

- [ ] **Step 3: Wire the toggle (Pro gate + reveal times) inside `wireDosingFields`**

At the end of `wireDosingFields` (before its closing `}`), add:

```javascript
  const notify = modalRoot().querySelector('#f-notify');
  if (notify) {
    notify.addEventListener('change', () => {
      if (notify.dataset.locked) { notify.checked = false; openPaywall(); return; }
      const w = modalRoot().querySelector('#f-times-wrap');
      const scheduled = modalRoot().querySelector('#f-dosetype')?.value === 'scheduled';
      if (w) w.style.display = notify.checked && scheduled ? '' : 'none';
      if (notify.checked) requestPermission();
    });
  }
```

- [ ] **Step 4: Persist the fields in `readDosingFields`**

In `readDosingFields`, change the returned object to include notify + reminderTimes:

```javascript
  return {
    strength,
    intervalHours: parseFloat(modalRoot().querySelector('#f-int').value) || 0,
    maxDailyUnits: parseFloat(modalRoot().querySelector('#f-max').value) || 0,
    doseType: modalRoot().querySelector('#f-dosetype')?.value === 'scheduled' ? 'scheduled' : 'prn',
    notify: !!modalRoot().querySelector('#f-notify')?.checked,
    reminderTimes: Array.from(modalRoot().querySelectorAll('.f-time')).map((i) => i.value).filter(Boolean),
  };
```

- [ ] **Step 5: Save the new fields + sync, in both save handlers**

In `openConfigForm`'s save handler, add `notify: vals.notify, reminderTimes: vals.reminderTimes,` to the pushed med object, and add `syncNotifications();` immediately before `renderGrid();`.
In `openCustomForm`'s save handler, likewise add `notify: vals.notify, reminderTimes: vals.reminderTimes,` to its pushed med object and `syncNotifications();` before its `renderGrid();`/close.

(The med object literals already spread `vals.doseType` etc.; add the two fields next to `doseType`.)

- [ ] **Step 6: Add minimal styles**

Append to `css/styles.css`:

```css
.pro-badge { font-size:10px; font-weight:700; color:#06222a; background:#67e8f9; border-radius:6px; padding:1px 5px; vertical-align:middle; }
.switch { display:flex; align-items:center; gap:8px; font-size:14px; }
#f-times { display:flex; flex-wrap:wrap; gap:6px; }
```

- [ ] **Step 7: Verify**

Run: `node --check js/ui.js && node --test`
Expected: no syntax error; 69 tests pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add js/ui.js css/styles.css
git commit -m "feat(ui): per-med reminder toggle + times (Pro-gated)"
```

---

### Task 8: Notification settings sheet + landing entry (ui.js)

**Files:** Modify `js/ui.js`

- [ ] **Step 1: Add the settings import**

Add to the storage import at the top of `js/ui.js` (the `import { ... } from './storage.js';` line) the two new functions: `loadNotifySettings, saveNotifySettings`.

- [ ] **Step 2: Add `openNotifySettings`**

Add near `openPaywall` in `js/ui.js`:

```javascript
export function openNotifySettings() {
  const s = loadNotifySettings();
  openSheet(
    `<h2>Reminders</h2>` +
    `<p class="muted">During quiet hours, reminders still arrive but silently (vibrate only).</p>` +
    `<div class="field"><label>Quiet hours start</label><input id="ns-start" type="time" value="${s.quietStart}" /></div>` +
    `<div class="field"><label>Quiet hours end</label><input id="ns-end" type="time" value="${s.quietEnd}" /></div>` +
    `<div class="btn-row"><button class="btn secondary" id="ns-cancel">Cancel</button>` +
    `<button class="btn" id="ns-save">Save</button></div>`
  );
  modalRoot().querySelector('#ns-cancel').addEventListener('click', closeModal);
  modalRoot().querySelector('#ns-save').addEventListener('click', () => {
    saveNotifySettings({
      quietStart: modalRoot().querySelector('#ns-start').value || '22:00',
      quietEnd: modalRoot().querySelector('#ns-end').value || '07:00',
    });
    closeModal();
    syncNotifications();
  });
}
```

- [ ] **Step 3: Add a "Reminders" entry to the landing sheet**

In `showLanding`, immediately after the `#land-pro` button row added previously, add another row:

```javascript
    `<div class="btn-row"><button class="btn secondary" id="land-reminders">Reminder settings</button></div>` +
```

and after the `#land-pro` listener, add:

```javascript
  modalRoot().querySelector('#land-reminders')?.addEventListener('click', () => { closeModal(); openNotifySettings(); });
```

- [ ] **Step 4: Verify**

Run: `node --check js/ui.js && node --test`
Expected: no syntax error; 69 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): reminder settings sheet (quiet hours)"
```

---

### Task 9: Sync triggers — dose log + boot/resume

**Files:** Modify `js/ui.js`, `js/app.js`

- [ ] **Step 1: Sync after a dose is logged (ui.js)**

In `openDoseSheet`, change the dose commit (currently `const commit = () => { addDose(med.id, units); closeModal(); renderGrid(); };`) to:

```javascript
      const commit = () => { addDose(med.id, units); closeModal(); renderGrid(); syncNotifications(); };
```

- [ ] **Step 2: Sync on boot + resume (app.js)**

Add to the imports at the top of `js/app.js`:

```javascript
import { syncNotifications } from './notify.js';
```

After the existing `recordUsageDay();` line, add:

```javascript
syncNotifications();
```

And change the existing `visibilitychange` handler to also sync:

```javascript
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderGrid(); renderPainView(); syncNotifications(); } });
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js && node --check js/ui.js && node --test`
Expected: no syntax errors; 69 tests pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat(notify): resync notifications on dose log, boot, and resume"
```

---

### Task 10: Service worker, README, sync, final verify

**Files:** Modify `service-worker.js`, `README.md`

- [ ] **Step 1: Precache the new modules + bump the cache**

In `service-worker.js`, change `const CACHE = 'dosegrid-v10';` to `const CACHE = 'dosegrid-v11';`, and add `'./js/notify.js', './js/notify-schedule.js',` to the `ASSETS` array (after the `'./js/pro.js', './js/gating.js',` line).

- [ ] **Step 2: Document the feature in `README.md`**

Add a bullet to the Features list, after the Free/Pro bullet:

```markdown
- **Dose reminders (Pro, native apps):** opt-in per medication — PRN meds notify when you *can* take another (interval elapsed); scheduled/course meds remind you at set times. A quiet-hours window delivers them silently (vibrate only). Safety warnings remain free.
```

- [ ] **Step 3: Sync into native projects**

Run: `npm run sync`
Expected: `build:www` + `cap sync` complete; `www/js/notify.js` and `www/js/notify-schedule.js` are copied; both platforms updated.

- [ ] **Step 4: Full verification**

Run: `node --test`
Expected: PASS — 69 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add service-worker.js README.md
git commit -m "chore: precache notify modules, bump SW cache, document reminders"
```

---

## Self-Review

**Spec coverage:**
- PRN interval "you can take another now" → Task 4 (`buildSchedule` prn branch). ✓
- Scheduled clock-time reminders → Task 4 (scheduled branch) + Task 7 (times editor). ✓
- `defaultReminderTimes` from interval → Task 3. ✓
- Quiet hours silent/vibrate (channels) → Task 2 (`inQuietHours`), Task 6 (`quiet` channel / iOS `sound:null`). ✓
- Pro gate (safety stays free) → Task 4 (`pro` guard) + Task 6 (`isPro` guard) + Task 7 (toggle Pro badge → paywall). ✓
- Per-med opt-in default off → Task 7 (`f-notify`, default unchecked). ✓
- Settings (quiet hours) storage + UI → Tasks 5, 8. ✓
- Native seam via Capacitor global, web no-op → Task 6. ✓
- Reschedule-all on dose log / med change / settings / boot / resume → Tasks 7 (save), 8 (settings), 9 (dose log, boot, resume). ✓
- Permission on first enable → Task 7 (`requestPermission` on toggle on). ✓
- iOS 64 cap via daily repeats → Task 4 (`repeatAt`) + Task 6 (`repeats:true`). ✓
- Plugin dep + sync + SW + README → Tasks 1, 10. ✓

**Placeholder scan:** none. Test-count note (69) is explicit from Task 6.

**Type/name consistency:** `buildSchedule({meds,doses,settings,now,pro})` returns `{id, medId, fireAt|repeatAt, channel, title, body}` — produced in Task 4, consumed in Task 6. `inQuietHours(hhmm, settings)` / `defaultReminderTimes(intervalHours)` consistent across Tasks 2–4, 7. `loadNotifySettings`/`saveNotifySettings` consistent Tasks 5, 6, 8. `syncNotifications`/`requestPermission` consistent Tasks 6, 7, 8, 9. Med fields `notify`/`reminderTimes` consistent Tasks 4, 7.

**Note for executor:** Tasks 1 & 10 run `npm run sync` (needs the Capacitor toolchain from sub-project #2; CocoaPods note on Windows is acceptable). `notify.js` deliberately does NOT `import` the plugin — it uses `window.Capacitor.Plugins.LocalNotifications` so the buildless web app doesn't break. Cumulative test count is 69 from Task 6 on.
