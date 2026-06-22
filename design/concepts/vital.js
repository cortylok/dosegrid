/* Vital concept — data-dense bento, mono numerics, multi-series timeline. */
(function () {
  var D = window.DEMO; window.CONCEPTS = window.CONCEPTS || {};

  function shortAgo(ms) { if (ms == null) return '—'; var h = ms / 36e5; return h >= 1 ? Math.round(h) + 'h ago' : Math.round(ms / 6e4) + 'm ago'; }
  function dailyCounts(id) {
    var out = [];
    for (var d = 9; d >= 0; d--) { var st = new Date(D.NOW - d * D.DAY); st.setHours(0, 0, 0, 0); var s = st.getTime(), e = s + D.DAY, c = 0; D.doses.forEach(function (x) { if (x.medId === id && x.t >= s && x.t < e) c += x.units; }); out.push(c); }
    return out;
  }
  function sparkline(counts, color) {
    var w = 46, h = 18, n = counts.length, max = Math.max(1, Math.max.apply(null, counts));
    var pts = counts.map(function (c, i) { return (i / (n - 1) * (w - 2) + 1).toFixed(1) + ',' + (h - 1 - (c / max) * (h - 3)).toFixed(1); }).join(' ');
    return '<svg class="vt-spark" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  function statusMap(m) {
    switch (m.status.state) {
      case 'ready': return { big: 'NOW' };
      case 'wait': return { big: D.fmtRemaining(m.status.until - D.NOW) };
      case 'hold': return { big: 'HOLD', note: 'Contains ' + m.status.ingredient + ' — also in your other meds' };
      case 'daily_max': return { big: 'MAX' };
      case 'due': return { big: 'DUE' };
      case 'done': return { big: 'DONE' };
    }
    return { big: '' };
  }
  function availFor(m) {
    var s = m.status;
    switch (s.state) {
      case 'ready': return { k: 'ok', a: 'Yes', d: 'Last taken ' + D.fmtAgo(s.lastAgo) + '.' };
      case 'wait': return { a: 'Not until ' + D.fmtClock(s.until), d: 'Minimum ' + m.intervalH + ' h between doses.' };
      case 'hold': return { k: 'warn', a: 'Not yet', d: 'You ' + s.note + '. Max 1000 mg of paracetamol in 4 h.' };
      case 'daily_max': return { k: 'warn', a: 'Not today', d: 'Daily max reached (' + m.maxDay + ' tablets).' };
      case 'due': return { k: 'ok', a: 'Due now', d: 'Scheduled for ' + (s.times || []).join(' & ') + '.' };
      case 'done': return { k: 'ok', a: 'Done', d: 'Both scheduled doses taken.' };
    }
    return { a: 'Yes' };
  }

  function cell(m) {
    var st = statusMap(m), wide = m.status.state === 'hold';
    var w = Math.round(m.status.takenToday / m.maxDay * 100);
    var tag = m.type === 'scheduled' ? 'SCHED' : 'PRN';
    var col = 'hsl(' + m.hue + ' 70% 60%)';
    return '<button class="vt-cell s-' + m.status.state + (wide ? ' vt-span2' : '') + '" data-med="' + m.id + '">' +
      '<span class="vt-corner"></span>' +
      '<div class="vt-h"><span class="vt-nm">' + m.name + '</span><span class="vt-tag">' + tag + '</span></div>' +
      '<div class="vt-strength">' + m.strength + ' · ' + m.brand + '</div>' +
      '<div class="vt-big">' + st.big + '</div>' +
      '<div class="vt-foot"><div class="vt-prog"><i style="width:' + Math.max(4, w) + '%;background:' + col + '"></i></div>' + sparkline(dailyCounts(m.id), col) + '</div>' +
      '<div class="vt-sub">' + m.status.takenToday + '/' + m.maxDay + ' today · ' + shortAgo(m.status.lastAgo) + '</div>' +
      (wide && st.note ? '<div class="vt-note">' + st.note + '</div>' : '') + '</button>';
  }

  function renderApp() {
    var today = 0, ds = new Date(D.NOW); ds.setHours(0, 0, 0, 0);
    D.doses.forEach(function (x) { if (x.t >= ds.getTime()) today += x.units; });
    return '' +
      '<div class="vt-top"><div class="vt-brand"><span class="logo"></span>DoseGrid</div>' +
      '<div class="vt-chips"><span class="vt-chip">Pain<b>4</b></span><span class="vt-chip">Today<b>' + today + '</b></span></div></div>' +
      '<div class="vt-bento">' +
      '<div class="vt-cell vt-tl"><div class="vt-tlhead"><div class="ttl">Timeline<span>pain &amp; doses · 3d</span></div>' +
      '<div class="tl-controls"><button class="zbtn" data-z="today">1D</button><button class="zbtn" data-z="week">1W</button>' +
      '<button class="zbtn" data-z="zoomOut">−</button><button class="zbtn solid" data-z="zoomIn">+</button></div></div>' +
      '<div class="tl-host"></div></div>' +
      D.meds.map(cell).join('') + '</div>';
  }

  function timelineRenderer(v) {
    var b = v.bands, pts = v.painPts, s = '';
    s += '<defs><linearGradient id="vtArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e8bff" stop-opacity=".22"/><stop offset="1" stop-color="#6e8bff" stop-opacity="0"/></linearGradient></defs>';
    [[10, b.painTop], [5, (b.painTop + b.painBot) / 2], [0, b.painBot]].forEach(function (g) {
      s += '<line x1="26" y1="' + g[1].toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + g[1].toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>' +
        '<text x="18" y="' + (g[1] + 3).toFixed(1) + '" font-size="9" fill="#5f6878" text-anchor="end" font-family="JetBrains Mono, monospace">' + g[0] + '</text>';
    });
    v.dayTicks.forEach(function (t) { if (t.x > 26 && t.x < v.W - 12) s += '<line x1="' + t.x.toFixed(1) + '" y1="' + b.painTop + '" x2="' + t.x.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(255,255,255,.045)"/>'; });
    if (pts.length) {
      var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
      for (var i = 1; i < pts.length; i++) d += ' L' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
      s += '<path d="' + d + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + b.painBot + ' L' + pts[0].x.toFixed(1) + ' ' + b.painBot + ' Z" fill="url(#vtArea)"/>';
      s += '<path d="' + d + '" fill="none" stroke="#8aa0ff" stroke-width="1.6"/>';
    }
    pts.forEach(function (p) { var hi = p.score >= 7, sz = hi ? 4 : v.detail ? 3 : 0; if (sz) s += '<rect x="' + (p.x - sz / 2).toFixed(1) + '" y="' + (p.y - sz / 2).toFixed(1) + '" width="' + sz + '" height="' + sz + '" fill="' + (hi ? '#ff5d6e' : '#8aa0ff') + '"/>'; });
    s += '<text x="26" y="' + (b.laneTop - 4).toFixed(1) + '" font-size="8.5" fill="#5f6878" letter-spacing=".12em" font-family="JetBrains Mono, monospace">DOSES</text>';
    s += '<line x1="26" y1="' + b.laneBot.toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(255,255,255,.1)"/>';
    v.doseItems.forEach(function (dz) { var hh = 5 + Math.min(1, dz.units / 2) * ((b.laneBot - b.laneTop) * 0.8); s += '<rect x="' + (dz.x - 1.4).toFixed(1) + '" y="' + (b.laneBot - hh).toFixed(1) + '" width="2.8" height="' + hh.toFixed(1) + '" rx="1.2" fill="hsl(' + dz.hue + ' 72% 62%)"/>'; });
    s += '<line x1="' + v.nowX.toFixed(1) + '" y1="' + b.painTop + '" x2="' + v.nowX.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="#6e8bff" stroke-width="1" stroke-dasharray="2 2"/>';
    v.axisTicks.forEach(function (t) { s += '<text x="' + t.x.toFixed(1) + '" y="' + b.axisY.toFixed(1) + '" font-size="9" fill="#697587" text-anchor="middle" font-family="JetBrains Mono, monospace">' + t.label + '</text>'; });
    return s;
  }

  function renderSheet(m) {
    var av = availFor(m);
    return '<div class="vt-sheet"><div class="grabber"></div>' +
      '<div class="vt-sh-head"><div class="vt-sh-name">' + m.name + '</div><div class="vt-sh-strength">' + m.strength + ' · MAX ' + m.maxDay + '/D</div></div>' +
      '<div class="vt-stats">' +
      '<div class="vt-stat"><div class="l">Today</div><div class="v">' + m.status.takenToday + '/' + m.maxDay + '</div></div>' +
      '<div class="vt-stat"><div class="l">Last</div><div class="v">' + (m.status.lastAgo != null ? Math.round(m.status.lastAgo / 36e5) + 'h' : '—') + '</div></div>' +
      '<div class="vt-stat"><div class="l">Interval</div><div class="v">' + m.intervalH + 'h</div></div>' +
      '<div class="vt-stat full ' + (av.k || '') + '"><div class="l">OK to take now?</div><div class="v">' + av.a + (av.d ? '<small>' + av.d + '</small>' : '') + '</div></div></div>' +
      '<div class="vt-doses"><button>0.5<small>tab</small></button><button>1<small>tab</small></button><button>2<small>tabs</small></button></div>' +
      '<div class="vt-srow"><button>History</button><button>Edit</button><button data-close>Close</button></div></div>';
  }

  window.CONCEPTS.vital = {
    label: 'Vital', tagline: 'A precision dashboard. Dense, fast, monospaced.',
    notes: 'For people who want their data tight and legible. A dark bento grid mixes tile sizes, every number set in monospace, each medicine carrying a live progress bar and a 10-day dose sparkline. The alert (shared-ingredient) cell widens to explain itself.',
    meta: { type: 'Hanken Grotesk · JetBrains Mono', palette: 'Graphite · indigo · cyan', idea: 'Bento density, monospaced truth' },
    span: 3 * D.DAY, renderApp: renderApp, timelineRenderer: timelineRenderer, renderSheet: renderSheet
  };
})();
