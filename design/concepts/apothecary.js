/* Apothecary concept — warm tactile, blister-pack dose dots, analog strip-chart. */
(function () {
  var D = window.DEMO; window.CONCEPTS = window.CONCEPTS || {};

  function blister(taken, max, cls) {
    var dots = '';
    for (var i = 0; i < max; i++) dots += '<i class="' + (i < taken ? 'on' : '') + '"></i>';
    return '<div class="' + (cls || 'ap-blister') + '">' + dots + '</div>';
  }
  function statusMap(m) {
    var s = m.status, n = s.takenToday + ' of ' + m.maxDay + ' today';
    switch (s.state) {
      case 'ready': return { icon: '✓', text: 'Ready now', sub: n };
      case 'wait': return { icon: '◷', text: 'Next at ' + D.fmtClock(s.until), sub: '' };
      case 'hold': return { icon: '⊘', text: 'On hold', sub: 'contains ' + s.ingredient };
      case 'daily_max': return { icon: '●', text: 'Daily max reached', sub: '' };
      case 'due': return { icon: '◷', text: 'Due now', sub: 'scheduled ' + (s.times || []).join(' & ') };
      case 'done': return { icon: '✓', text: 'Done for today', sub: '' };
    }
    return { icon: '', text: '', sub: n };
  }
  function availFor(m) {
    var s = m.status;
    switch (s.state) {
      case 'ready': return { k: 'ok', a: 'Yes', d: 'Last taken ' + D.fmtAgo(s.lastAgo) + '.' };
      case 'wait': return { a: 'Not until ' + D.fmtClock(s.until), d: 'Minimum ' + m.intervalH + ' h between doses.' };
      case 'hold': return { k: 'warn', a: 'Not yet', d: 'You ' + s.note + '. Max 1000 mg of paracetamol in 4 h — excess paracetamol can damage the liver.' };
      case 'daily_max': return { k: 'warn', a: 'Not today', d: "You've reached the daily max of " + m.maxDay + ' tablets.' };
      case 'due': return { k: 'ok', a: 'Due now', d: 'Scheduled for ' + (s.times || []).join(' & ') + '.' };
      case 'done': return { k: 'ok', a: 'Done for today', d: 'Both scheduled doses taken.' };
    }
    return { a: 'Yes' };
  }

  function tile(m) {
    var st = statusMap(m);
    return '<button class="ap-tile s-' + m.status.state + '" data-med="' + m.id + '">' +
      '<div class="ap-head"><div><div class="ap-name">' + m.name + '</div>' +
      '<div class="ap-strength">' + m.strength + ' · ' + m.brand + '</div></div><div class="ap-icon">' + st.icon + '</div></div>' +
      blister(m.status.takenToday, m.maxDay) +
      '<div class="ap-status"><span class="d"></span>' + st.text + (st.sub ? ' <small>' + st.sub + '</small>' : '') + '</div></button>';
  }

  function renderApp() {
    var h = new Date(D.NOW).getHours();
    var greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var date = new Date(D.NOW).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    return '' +
      '<div class="ap-top"><div><div class="hi">' + greet + '</div><div class="date">' + date + '</div></div>' +
      '<div class="pill-now"><b>4</b><span>pain</span></div></div>' +
      '<div class="ap-sec"><h3>Timeline</h3><div class="m">pain &amp; doses</div></div>' +
      '<div class="ap-card"><div class="ap-tlbar"><div class="t">Drag · pinch to zoom</div>' +
      '<div class="tl-controls"><button class="zbtn" data-z="today">Today</button><button class="zbtn" data-z="week">Week</button>' +
      '<button class="zbtn" data-z="zoomOut">−</button><button class="zbtn solid" data-z="zoomIn">+</button></div></div>' +
      '<div class="tl-host"></div></div>' +
      '<div class="ap-sec"><h3>Medicines</h3><div class="m">' + D.meds.length + '</div></div>' +
      '<div class="ap-grid">' + D.meds.map(tile).join('') + '</div>';
  }

  function smooth(pts) {
    if (pts.length < 2) return pts.length ? 'M' + pts[0].x + ' ' + pts[0].y : '';
    var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) + ' ' +
        (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  function timelineRenderer(v) {
    var b = v.bands, pts = v.painPts, s = '';
    s += '<defs><linearGradient id="apArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bf5b39" stop-opacity=".2"/><stop offset="1" stop-color="#cf8b3c" stop-opacity="0"/></linearGradient></defs>';
    v.dayTicks.forEach(function (t, i) { if (i % 2 === 1) { var x2 = v.x(t.t + D.DAY), x1 = Math.max(0, t.x); s += '<rect x="' + x1.toFixed(1) + '" y="' + b.painTop + '" width="' + Math.max(0, Math.min(v.W, x2) - x1).toFixed(1) + '" height="' + (b.laneBot - b.painTop).toFixed(1) + '" fill="rgba(43,33,24,.025)"/>'; } });
    [[10, b.painTop], [5, (b.painTop + b.painBot) / 2], [0, b.painBot]].forEach(function (g) {
      s += '<line x1="24" y1="' + g[1].toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + g[1].toFixed(1) + '" stroke="rgba(43,33,24,.09)"/>' +
        '<text x="16" y="' + (g[1] + 3).toFixed(1) + '" font-size="9" fill="#9a8c78" text-anchor="end" font-family="Figtree, sans-serif">' + g[0] + '</text>';
    });
    var line = smooth(pts);
    if (line && pts.length) s += '<path d="' + line + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + b.painBot + ' L' + pts[0].x.toFixed(1) + ' ' + b.painBot + ' Z" fill="url(#apArea)"/>';
    if (line) s += '<path d="' + line + '" fill="none" stroke="#bf5b39" stroke-width="2.4" stroke-linecap="round"/>';
    pts.forEach(function (p) { var r = v.detail ? 4 : 2.8; s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '" fill="#bf5b39"' + (p.note ? ' stroke="#fbf6ec" stroke-width="2"' : '') + '/>'; });
    s += '<text x="24" y="' + (b.laneTop - 3).toFixed(1) + '" font-size="8.5" fill="#9a8c78" letter-spacing=".1em" font-family="Figtree, sans-serif">DOSES</text>';
    s += '<line x1="24" y1="' + b.laneBot.toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(43,33,24,.16)"/>';
    v.doseItems.forEach(function (d) {
      var hh = 8 + Math.min(1, d.units / 2) * ((b.laneBot - b.laneTop) * 0.7), cy = b.laneBot - hh, w = d.units >= 2 ? 8 : 6;
      s += '<line x1="' + d.x.toFixed(1) + '" y1="' + b.laneBot.toFixed(1) + '" x2="' + d.x.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="hsl(' + d.hue + ' 55% 52% / .5)" stroke-width="2"/>' +
        '<rect x="' + (d.x - w / 2).toFixed(1) + '" y="' + (cy - 5).toFixed(1) + '" width="' + w.toFixed(1) + '" height="10" rx="5" fill="hsl(' + d.hue + ' 58% 55%)"/>';
    });
    s += '<line x1="' + v.nowX.toFixed(1) + '" y1="' + b.painTop + '" x2="' + v.nowX.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(191,91,57,.5)" stroke-dasharray="2 3"/>';
    v.axisTicks.forEach(function (t) { s += '<text x="' + t.x.toFixed(1) + '" y="' + b.axisY.toFixed(1) + '" font-size="9.5" fill="#9a8c78" text-anchor="middle" font-family="Figtree, sans-serif">' + t.label + '</text>'; });
    return s;
  }

  function renderSheet(m) {
    var av = availFor(m);
    return '<div class="ap-sheet"><div class="grabber"></div>' +
      '<div class="ap-sh-name">' + m.name + '</div><div class="ap-sh-strength">' + m.brand + ' · ' + m.strength + ' · max ' + m.maxDay + '/day</div>' +
      blister(m.status.takenToday, m.maxDay, 'ap-sh-blister') +
      '<div class="ap-avail ' + (av.k || '') + '"><div class="q">OK to take now?</div><div class="a">' + av.a + '</div>' +
      (av.d ? '<div class="d">' + av.d + '</div>' : '') + '</div>' +
      '<div class="ap-doses"><button><b>½</b><small>tablet</small></button><button><b>1</b><small>tablet</small></button><button><b>2</b><small>tablets</small></button></div>' +
      '<div class="ap-srow"><button>History</button><button>Edit</button><button data-close>Done</button></div></div>';
  }

  window.CONCEPTS.apothecary = {
    label: 'Apothecary', tagline: 'Warm, tactile — your daily doses as a blister pack.',
    notes: 'A physical, reassuring feel: warm paper and amber, soft pressed shadows, and the signature move — each medicine\'s day shown as a blister strip of dose dots that fill as you take them. The timeline becomes a calm analog strip-chart.',
    meta: { type: 'Spectral serif · Figtree', palette: 'Warm cream · amber · clay', idea: 'Doses as a tactile blister pack' },
    span: 4 * D.DAY, renderApp: renderApp, timelineRenderer: timelineRenderer, renderSheet: renderSheet
  };
})();
