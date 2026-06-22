/* Aurora concept — radial dose dials, frosted health-OS. */
(function () {
  var D = window.DEMO; window.CONCEPTS = window.CONCEPTS || {};
  var R = 42, C = 2 * Math.PI * R;

  function dial(hue, frac, grad) {
    var off = C * (1 - Math.max(0.012, Math.min(1, frac)));
    var stroke = grad ? 'url(#auG)' : 'hsl(' + hue + ' 78% 56%)';
    var defs = grad ? '<defs><linearGradient id="auG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15b886"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>' : '';
    return '<svg class="dial" viewBox="0 0 96 96">' + defs +
      '<circle class="track" cx="48" cy="48" r="' + R + '"/>' +
      '<circle class="prog" cx="48" cy="48" r="' + R + '" stroke="' + stroke + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>';
  }

  function statusMap(m) {
    var s = m.status, n = s.takenToday + ' of ' + m.maxDay + ' today';
    switch (s.state) {
      case 'ready': return { top: 'Ready', big: 'Now', chip: n };
      case 'wait': return { top: 'Next in', big: D.fmtRemaining(s.until - D.NOW), sm: true, chip: n };
      case 'hold': return { top: 'On hold', big: 'Hold', chip: 'Shared limit', holdNote: 'Contains ' + s.ingredient };
      case 'daily_max': return { top: 'Today', big: 'Max', chip: s.takenToday + ' of ' + m.maxDay + ' · done' };
      case 'due': return { top: 'Due', big: 'Now', chip: 'Scheduled ' + (s.times || []).join(' · ') };
      case 'done': return { top: 'Done', big: '✓', chip: n };
    }
    return { top: '', big: '', chip: n };
  }
  function availFor(m) {
    var s = m.status;
    switch (s.state) {
      case 'ready': return { klass: 'ok', a: 'Yes', detail: 'Last taken ' + D.fmtAgo(s.lastAgo) + '.' };
      case 'wait': return { a: 'Not until ' + D.fmtClock(s.until), detail: 'Minimum ' + m.intervalH + ' h between doses.' };
      case 'hold': return { klass: 'warn', a: 'Not yet', detail: 'You ' + s.note + '. Max 1000 mg of paracetamol in 4 h — excess paracetamol can damage the liver.' };
      case 'daily_max': return { klass: 'warn', a: 'Not today', detail: "You've reached the daily max of " + m.maxDay + ' tablets.' };
      case 'due': return { klass: 'ok', a: 'Due now', detail: 'Scheduled for ' + (s.times || []).join(' & ') + '.' };
      case 'done': return { klass: 'ok', a: 'Done for today', detail: 'Both scheduled doses taken.' };
    }
    return { a: 'Yes' };
  }

  function tile(m) {
    var st = statusMap(m), frac = m.status.takenToday / m.maxDay;
    return '<button class="au-tile s-' + m.status.state + '" data-med="' + m.id + '">' +
      '<div class="dialwrap">' + dial(m.hue, frac) +
      '<div class="dialc"><div class="top">' + st.top + '</div><div class="big' + (st.sm ? ' sm' : '') + '">' + st.big + '</div></div></div>' +
      '<div class="nm">' + m.name + '</div><div class="st">' + st.chip + '</div>' +
      (st.holdNote ? '<div class="hold-note">' + st.holdNote + '</div>' : '') + '</button>';
  }

  function renderApp() {
    var h = new Date(D.NOW).getHours();
    var greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var date = new Date(D.NOW).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    return '' +
      '<div class="au-top"><div><div class="hi">' + greet + '</div><div class="date">' + date + '</div></div>' +
      '<div class="gear">⚙</div></div>' +
      '<div class="au-now"><div class="pscore">' + dial(0, 0.4, true) + '<div class="pv">4</div></div>' +
      '<div class="meta"><div class="lab">Pain right now</div><div class="sev">Moderate</div>' +
      '<div class="since">40 min ago · “easing off”</div></div></div>' +
      '<div class="au-section"><h3>Timeline</h3><div class="more">pain &amp; doses</div></div>' +
      '<div class="au-card"><div class="au-tlbar"><div class="ttl">Drag · pinch to zoom</div>' +
      '<div class="tl-controls"><button class="zbtn" data-z="today">Today</button>' +
      '<button class="zbtn" data-z="week">Week</button>' +
      '<button class="zbtn round" data-z="zoomOut">−</button><button class="zbtn round solid" data-z="zoomIn">+</button>' +
      '</div></div><div class="tl-host"></div></div>' +
      '<div class="au-section"><h3>Medicines</h3><div class="more">' + D.meds.length + '</div></div>' +
      '<div class="au-grid">' + D.meds.map(tile).join('') + '</div>';
  }

  function smooth(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return 'M' + pts[0].x + ' ' + pts[0].y;
    var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  function timelineRenderer(v) {
    var b = v.bands, pts = v.painPts, s = '';
    var line = smooth(pts);
    var area = line && pts.length ? line + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + b.painBot + ' L' + pts[0].x.toFixed(1) + ' ' + b.painBot + ' Z' : '';
    s += '<defs>' +
      '<linearGradient id="auArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".3"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="auLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#15b886"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#7c6cf0"/></linearGradient>' +
      '<filter id="auGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    v.dayTicks.forEach(function (t, i) {
      if (i % 2 === 0) { var x2 = v.x(t.t + D.DAY), x1 = Math.max(0, t.x); s += '<rect x="' + x1.toFixed(1) + '" y="' + b.painTop + '" width="' + Math.max(0, Math.min(v.W, x2) - x1).toFixed(1) + '" height="' + (b.laneBot - b.painTop).toFixed(1) + '" fill="rgba(16,23,40,.025)"/>'; }
    });
    [[10, b.painTop], [5, (b.painTop + b.painBot) / 2], [0, b.painBot]].forEach(function (g) {
      s += '<line x1="22" y1="' + g[1].toFixed(1) + '" x2="' + (v.W - 10) + '" y2="' + g[1].toFixed(1) + '" stroke="rgba(16,23,40,.07)"/>' +
        '<text x="14" y="' + (g[1] + 3).toFixed(1) + '" font-size="9" fill="#9aa3b4" text-anchor="end">' + g[0] + '</text>';
    });
    if (area) s += '<path d="' + area + '" fill="url(#auArea)"/>';
    if (line) s += '<path d="' + line + '" fill="none" stroke="url(#auLine)" stroke-width="2.4" stroke-linecap="round" filter="url(#auGlow)"/>';
    pts.forEach(function (p) { var r = v.detail ? 4.4 : 3; s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '" fill="' + v.painColor(p.score) + '"' + (p.note ? ' stroke="#fff" stroke-width="2"' : '') + '/>'; });
    s += '<text x="22" y="' + (b.laneTop - 3).toFixed(1) + '" font-size="8.5" fill="#9aa3b4" letter-spacing=".1em">DOSES</text>';
    s += '<line x1="22" y1="' + b.laneBot.toFixed(1) + '" x2="' + (v.W - 10) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(16,23,40,.1)"/>';
    v.doseItems.forEach(function (d) {
      var h = (b.laneBot - b.laneTop) * Math.min(1, d.units / 2) * 0.82 + 6, cy = b.laneBot - h, r = d.units >= 2 ? 6 : d.units >= 1 ? 4.6 : 3.4;
      s += '<line x1="' + d.x.toFixed(1) + '" y1="' + b.laneBot.toFixed(1) + '" x2="' + d.x.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="hsl(' + d.hue + ' 80% 60% / .45)" stroke-width="2"/>' +
        '<circle cx="' + d.x.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="hsl(' + d.hue + ' 85% 62%)" filter="url(#auGlow)"/>';
    });
    s += '<line x1="' + v.nowX.toFixed(1) + '" y1="' + b.painTop + '" x2="' + v.nowX.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(16,23,40,.22)" stroke-dasharray="2 3"/>';
    v.axisTicks.forEach(function (t) { s += '<text x="' + t.x.toFixed(1) + '" y="' + b.axisY.toFixed(1) + '" font-size="9.5" fill="#8a93a6" text-anchor="middle">' + t.label + '</text>'; });
    return s;
  }

  function renderSheet(m) {
    var st = statusMap(m), frac = m.status.takenToday / m.maxDay, av = availFor(m);
    return '<div class="au-sheet"><div class="grabber"></div>' +
      '<div class="sh-head"><div class="dialwrap" style="width:84px;height:84px">' + dial(m.hue, frac) +
      '<div class="dialc"><div class="big' + (st.sm ? ' sm' : '') + '">' + st.big + '</div></div></div>' +
      '<div><div class="sh-name">' + m.name + '</div><div class="sh-strength">' + m.strength + ' · max ' + m.maxDay + '/day</div></div></div>' +
      '<div class="au-avail ' + (av.klass || '') + '"><div class="q">OK to take now?</div><div class="a">' + av.a + '</div>' +
      (av.detail ? '<div class="detail">' + av.detail + '</div>' : '') + '</div>' +
      '<div class="au-doses">' + [['½', 'tab'], ['1', 'tab'], ['2', 'tabs']].map(function (u) { return '<button><span class="u">' + u[0] + '</span><span class="l">' + u[1] + '</span></button>'; }).join('') + '</div>' +
      '<div class="au-row"><button>History</button><button>Edit</button><button data-close>Done</button></div></div>';
  }

  window.CONCEPTS.aurora = {
    label: 'Aurora', tagline: 'A calm health-OS — your medicines as living dials.',
    notes: 'Each medicine is a radial dial: the ring fills with today\'s doses, the centre answers “can I take it now?”. Frosted glass over a soft aurora wash keeps clinical data feeling weightless and premium.',
    meta: { type: 'Fraunces display · Hanken Grotesk', palette: 'Porcelain light · teal→violet aurora', idea: 'Status as a glanceable dial' },
    span: 3 * D.DAY, renderApp: renderApp, timelineRenderer: timelineRenderer, renderSheet: renderSheet
  };
})();
