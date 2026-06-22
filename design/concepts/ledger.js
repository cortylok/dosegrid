/* Ledger concept — editorial data table + FT-style index chart. */
(function () {
  var D = window.DEMO; window.CONCEPTS = window.CONCEPTS || {};

  function t24(ts) { var d = new Date(ts); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
  function dailyCounts(id) {
    var out = [];
    for (var d = 9; d >= 0; d--) { var st = new Date(D.NOW - d * D.DAY); st.setHours(0, 0, 0, 0); var s = st.getTime(), e = s + D.DAY, c = 0; D.doses.forEach(function (x) { if (x.medId === id && x.t >= s && x.t < e) c += x.units; }); out.push(c); }
    return out;
  }
  function spark(counts) {
    var w = 70, h = 26, n = counts.length, bw = w / n, max = Math.max(1, Math.max.apply(null, counts));
    var bars = counts.map(function (c, i) { var bh = c ? Math.max(2, (c / max) * (h - 4)) : 1; return '<rect x="' + (i * bw + 0.5).toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + (bw - 1.6).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + (i === n - 1 ? '#1a1813' : 'rgba(26,24,19,.4)') + '"/>'; }).join('');
    return '<svg class="lg-spark" viewBox="0 0 ' + w + ' ' + h + '">' + bars + '</svg>';
  }
  function statusMap(m) {
    switch (m.status.state) {
      case 'ready': return { num: 'NOW', tag: 'available' };
      case 'wait': return { num: t24(m.status.until), tag: 'next dose' };
      case 'hold': return { num: 'HOLD', tag: 'shared limit', alert: true };
      case 'daily_max': return { num: 'MAX', tag: 'daily limit', alert: true };
      case 'due': return { num: 'DUE', tag: 'scheduled' };
      case 'done': return { num: '—', tag: 'done today' };
    }
    return { num: '', tag: '' };
  }
  function availFor(m) {
    var s = m.status;
    switch (s.state) {
      case 'ready': return { v: 'Yes', note: 'Last taken ' + D.fmtAgo(s.lastAgo) + '.' };
      case 'wait': return { v: t24(s.until), klass: 'big', note: 'Minimum ' + m.intervalH + ' h between doses.' };
      case 'hold': return { v: 'NOT YET', klass: 'big signal', note: 'You ' + s.note + '. Max 1000 mg of paracetamol in 4 h.' };
      case 'daily_max': return { v: 'NOT TODAY', klass: 'big signal', note: 'Daily max reached (' + m.maxDay + ' tablets).' };
      case 'due': return { v: 'DUE NOW', klass: 'big', note: 'Scheduled for ' + (s.times || []).join(' & ') + '.' };
      case 'done': return { v: 'DONE', klass: 'big', note: 'Both scheduled doses taken.' };
    }
    return { v: 'Yes' };
  }

  function row(m) {
    var st = statusMap(m);
    return '<button class="lg-row' + (st.alert ? ' alert' : '') + '" data-med="' + m.id + '">' +
      '<div class="lg-main"><div class="lg-name">' + m.name + ' <i>' + m.strength + '</i></div>' +
      '<div class="lg-sub">' + m.brand + ' · max ' + m.maxDay + '/day</div></div>' +
      spark(dailyCounts(m.id)) +
      '<div class="lg-val"><div class="lg-num">' + st.num + '</div><div class="lg-tag">' + st.tag + '</div></div></button>';
  }

  function renderApp() {
    var date = new Date(D.NOW).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return '' +
      '<div class="lg-mast"><div class="lg-kick">Medication &amp; Pain Ledger</div><h1>DoseGrid</h1>' +
      '<div class="row2"><span>' + date.toUpperCase() + '</span><span>PAIN 4 · MODERATE</span></div></div>' +
      '<div class="lg-sec"><span>Pain Index</span><span>last 10 days</span></div>' +
      '<div class="lg-chart"><div class="lg-chartbar"><div class="now"><b>4.0</b> now · <i>“easing off”</i></div>' +
      '<div class="tl-controls"><button class="zbtn" data-z="today">1D</button><button class="zbtn" data-z="week">1W</button>' +
      '<button class="zbtn" data-z="fortnight">2W</button><button class="zbtn solid" data-z="zoomIn">+</button></div></div>' +
      '<div class="tl-host"></div></div>' +
      '<div class="lg-sec"><span>Medicines</span><span>' + D.meds.length + ' active</span></div>' +
      '<div class="lg-head"><span>Medicine</span><span>10-day</span><span>Available</span></div>' +
      '<div class="lg-list">' + D.meds.map(row).join('') + '</div>' +
      '<div class="lg-foot">Not medical advice — always follow your label.</div>';
  }

  function timelineRenderer(v) {
    var b = v.bands, pts = v.painPts, s = '';
    [[10, b.painTop], [5, (b.painTop + b.painBot) / 2], [0, b.painBot]].forEach(function (g) {
      s += '<line x1="26" y1="' + g[1].toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + g[1].toFixed(1) + '" stroke="rgba(26,24,19,.12)"/>' +
        '<text x="20" y="' + (g[1] + 3).toFixed(1) + '" font-size="9" fill="#8b8578" font-family="IBM Plex Mono, monospace" text-anchor="end">' + g[0] + '</text>';
    });
    v.dayTicks.forEach(function (t) { if (t.x > 26 && t.x < v.W - 12) s += '<line x1="' + t.x.toFixed(1) + '" y1="' + b.painTop + '" x2="' + t.x.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(26,24,19,.07)"/>'; });
    if (pts.length > 1) s += '<polyline points="' + pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ') + '" fill="none" stroke="#1a1813" stroke-width="1.5"/>';
    pts.forEach(function (p) { var hi = p.score >= 7; s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (hi ? 3.2 : v.detail ? 2.4 : 1.8) + '" fill="' + (hi ? '#cf3a18' : '#1a1813') + '"' + (p.note ? ' stroke="#f5f3ec" stroke-width="1.5"' : '') + '/>'; });
    s += '<line x1="26" y1="' + b.laneBot.toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(26,24,19,.3)"/>';
    s += '<text x="26" y="' + (b.laneTop - 2).toFixed(1) + '" font-size="8.5" fill="#8b8578" font-family="IBM Plex Mono, monospace" letter-spacing=".1em">DOSES</text>';
    v.doseItems.forEach(function (d) { var hh = 6 + Math.min(1, d.units / 2) * ((b.laneBot - b.laneTop) * 0.7); s += '<line x1="' + d.x.toFixed(1) + '" y1="' + b.laneBot.toFixed(1) + '" x2="' + d.x.toFixed(1) + '" y2="' + (b.laneBot - hh).toFixed(1) + '" stroke="rgba(26,24,19,.5)" stroke-width="1.4"/>'; });
    s += '<line x1="' + v.nowX.toFixed(1) + '" y1="' + b.painTop + '" x2="' + v.nowX.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="#cf3a18" stroke-width="1" stroke-dasharray="1 3"/>';
    v.axisTicks.forEach(function (t) { s += '<text x="' + t.x.toFixed(1) + '" y="' + b.axisY.toFixed(1) + '" font-size="9" fill="#8b8578" font-family="IBM Plex Mono, monospace" text-anchor="middle">' + t.label + '</text>'; });
    return s;
  }

  function renderSheet(m) {
    var av = availFor(m);
    return '<div class="lg-sheet"><div class="grabber"></div>' +
      '<div class="lg-sh-head"><div class="lg-sh-name">' + m.name + '</div>' +
      '<div class="lg-sh-strength">' + m.brand.toUpperCase() + ' · ' + m.strength + ' · MAX ' + m.maxDay + '/DAY</div></div>' +
      '<div class="lg-dl">' +
      '<div class="kv"><div class="k">Last taken</div><div class="v">' + (m.status.lastAgo != null ? D.fmtAgo(m.status.lastAgo) : '—') + '</div></div>' +
      '<div class="kv"><div class="k">OK to take now</div><div class="v ' + (av.klass || '') + '">' + av.v + (av.note ? '<small>' + av.note + '</small>' : '') + '</div></div>' +
      '<div class="kv"><div class="k">Today</div><div class="v big">' + m.status.takenToday + ' / ' + m.maxDay + '</div></div></div>' +
      '<div class="lg-take">Log dose</div>' +
      '<div class="lg-doses"><button>½<small>TAB</small></button><button>1<small>TAB</small></button><button>2<small>TABS</small></button></div>' +
      '<div class="lg-srow"><button>History</button><button>Edit</button><button data-close>Close</button></div></div>';
  }

  window.CONCEPTS.ledger = {
    label: 'Ledger', tagline: 'Your medicines as an editorial data table.',
    notes: 'Swiss/financial restraint: ink on warm paper, hairline rules, big tabular numerals, a single vermilion signal reserved for what needs attention. The timeline reads like an index chart; each medicine is a ledger line with a 10-day dose sparkline.',
    meta: { type: 'Newsreader serif · IBM Plex Mono', palette: 'Newsprint cream · ink · vermilion', idea: 'Status by weight & numerals, not colour' },
    span: 7 * D.DAY, renderApp: renderApp, timelineRenderer: timelineRenderer, renderSheet: renderSheet
  };
})();
