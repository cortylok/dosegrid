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
