/* DoseGrid design demo — shared sample data + helpers (classic script, global DEMO). */
(function () {
  var HOUR = 36e5, DAY = 864e5;
  // Fixed "now" so the demo is deterministic; the timeline is still fully zoomable.
  var NOW = new Date('2026-06-22T16:34:00').getTime();

  // Tiny seeded RNG for stable, realistic-looking history.
  function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
  var rnd = rng(20260622);

  // Each med carries a crafted demo "status" so every concept renders every state,
  // plus the data needed for tiles. Doses (for the timeline) are generated below.
  var meds = [
    { id: 'para', name: 'Paracetamol', brand: 'Panadol', strength: '500 mg', unit: 'mg',
      maxDay: 8, intervalH: 4, hue: 188, type: 'prn',
      status: { state: 'ready', takenToday: 2, lastAgo: 5.2 * HOUR } },
    { id: 'pana', name: 'Panadeine', brand: 'paracetamol + codeine', strength: '500 / 15 mg', unit: 'mg',
      maxDay: 8, intervalH: 4, hue: 268, type: 'prn',
      status: { state: 'hold', until: NOW + 3.1 * HOUR, ingredient: 'paracetamol',
                note: 'you took 2 Paracetamol 1 h 24 min ago', takenToday: 0, lastAgo: null } },
    { id: 'ibu', name: 'Ibuprofen', brand: 'Nurofen', strength: '400 mg', unit: 'mg',
      maxDay: 6, intervalH: 6, hue: 14, type: 'prn',
      status: { state: 'wait', until: NOW + 1.7 * HOUR, takenToday: 3, lastAgo: 4.3 * HOUR } },
    { id: 'napr', name: 'Naproxen', brand: 'Naprosyn', strength: '500 mg', unit: 'mg',
      maxDay: 2, intervalH: 12, hue: 150, type: 'prn',
      status: { state: 'ready', takenToday: 0, lastAgo: 19 * HOUR } },
    { id: 'suma', name: 'Sumatriptan', brand: 'Imigran', strength: '50 mg', unit: 'mg',
      maxDay: 2, intervalH: 2, hue: 332, type: 'prn',
      status: { state: 'wait', until: NOW + 0.6 * HOUR, takenToday: 1, lastAgo: 1.4 * HOUR } },
    { id: 'endo', name: 'Oxycodone', brand: 'Endone', strength: '5 mg', unit: 'mg',
      maxDay: 4, intervalH: 6, hue: 42, type: 'prn',
      status: { state: 'daily_max', takenToday: 4, lastAgo: 2.1 * HOUR } },
    { id: 'amox', name: 'Amoxicillin', brand: 'Augmentin', strength: '875 / 125 mg', unit: 'mg',
      maxDay: 2, intervalH: 12, hue: 96, type: 'scheduled',
      status: { state: 'due', until: NOW - 8 * 60000, takenToday: 1, lastAgo: 12.1 * HOUR, times: ['08:00', '20:00'] } },
    { id: 'pregab', name: 'Pregabalin', brand: 'Lyrica', strength: '75 mg', unit: 'mg',
      maxDay: 2, intervalH: 12, hue: 210, type: 'scheduled',
      status: { state: 'done', takenToday: 2, lastAgo: 3 * HOUR, times: ['08:00', '20:00'] } }
  ];
  meds.forEach(function (m, i) { m.order = i; m.color = 'hsl(' + m.hue + ' 80% 60%)'; });

  // ~10 days of doses across meds, clustered through waking hours.
  var doses = [];
  var did = 0;
  for (var d = 10; d >= 0; d--) {
    var dayStart = NOW - d * DAY;
    meds.forEach(function (m) {
      var n = m.type === 'scheduled' ? 2 : Math.floor(rnd() * (m.maxDay - 1) + (rnd() < 0.5 ? 0 : 1));
      if (m.id === 'suma') n = rnd() < 0.4 ? 1 : 0;
      for (var k = 0; k < n; k++) {
        var hour = m.type === 'scheduled' ? (k === 0 ? 8 : 20) : 8 + Math.floor(rnd() * 13);
        var min = m.type === 'scheduled' ? 0 : Math.floor(rnd() * 60);
        var t = new Date(dayStart).setHours(hour, min, 0, 0);
        if (t > NOW) continue;
        var units = m.type === 'scheduled' ? 1 : (rnd() < 0.25 ? 2 : rnd() < 0.2 ? 0.5 : 1);
        doses.push({ id: 'd' + (did++), medId: m.id, t: t, units: units });
      }
    });
  }
  // Today's doses to back the crafted statuses.
  doses.push({ id: 'tp1', medId: 'para', t: NOW - 5.2 * HOUR, units: 1 });
  doses.push({ id: 'tp2', medId: 'para', t: NOW - 1.4 * HOUR, units: 2 });
  doses.push({ id: 'te', medId: 'endo', t: NOW - 2.1 * HOUR, units: 1 });

  // Pain series — a few readings/day with a believable arc + a couple of notes.
  var pain = [];
  var pid = 0;
  for (var dd = 10; dd >= 0; dd--) {
    var base = 3 + 3 * Math.sin((10 - dd) / 2.4) + (rnd() * 2 - 1);
    var perDay = 2 + Math.floor(rnd() * 3);
    for (var j = 0; j < perDay; j++) {
      var hh = 7 + Math.floor(rnd() * 15);
      var pt = new Date(NOW - dd * DAY).setHours(hh, Math.floor(rnd() * 60), 0, 0);
      if (pt > NOW) continue;
      var score = Math.max(0, Math.min(10, Math.round(base + (rnd() * 3 - 1.5))));
      var note = (score >= 7 && rnd() < 0.5) ? 'flare after activity' : (score <= 2 && rnd() < 0.3 ? 'good morning' : null);
      pain.push({ id: 'p' + (pid++), t: pt, score: score, note: note });
    }
  }
  pain.push({ id: 'pnow', t: NOW - 40 * 60000, score: 4, note: 'easing off' });
  pain.sort(function (a, b) { return a.t - b.t; });
  doses.sort(function (a, b) { return a.t - b.t; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtClock(ts) {
    var dte = new Date(ts), h = dte.getHours(), m = dte.getMinutes();
    var ap = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }
  function fmtRemaining(ms) {
    if (ms <= 0) return 'now';
    var mins = Math.ceil(ms / 60000), h = Math.floor(mins / 60), mm = mins % 60;
    return h > 0 ? h + 'h ' + mm + 'm' : mm + 'm';
  }
  function fmtAgo(ms) {
    if (ms == null) return '—';
    var mins = Math.round(ms / 60000), h = Math.floor(mins / 60), mm = mins % 60;
    return h > 0 ? h + ' h ' + mm + ' min ago' : mm + ' min ago';
  }
  // Pain colour: smooth green→amber→red across 0–10.
  function painColor(s) { s = Math.max(0, Math.min(10, s)); return 'hsl(' + (145 - 145 * s / 10) + ' 72% 50%)'; }
  function medById(id) { return meds.find(function (m) { return m.id === id; }); }

  window.DEMO = {
    NOW: NOW, HOUR: HOUR, DAY: DAY, meds: meds, doses: doses, pain: pain,
    fmtClock: fmtClock, fmtRemaining: fmtRemaining, fmtAgo: fmtAgo, painColor: painColor, medById: medById
  };
})();
