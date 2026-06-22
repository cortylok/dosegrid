/* Pulse concept — timeline-first dark, glowing pain spine. */
(function () {
  var D = window.DEMO; window.CONCEPTS = window.CONCEPTS || {};

  function statusMap(m) {
    var s = m.status, n = s.takenToday + ' of ' + m.maxDay;
    switch (s.state) {
      case 'ready': return { value: 'NOW', footL: n + ' today', footR: 'ready' };
      case 'wait': return { value: D.fmtRemaining(s.until - D.NOW), footL: n + ' today', footR: 'next dose' };
      case 'hold': return { value: 'HOLD', footL: 'Contains ' + s.ingredient, footR: '' };
      case 'daily_max': return { value: 'MAX', footL: n + ' · done', footR: '' };
      case 'due': return { value: 'DUE', footL: 'Scheduled', footR: (s.times || []).join(' · ') };
      case 'done': return { value: 'DONE', footL: n + ' today', footR: '' };
    }
    return { value: '', footL: n };
  }
  function availFor(m) {
    var s = m.status;
    switch (s.state) {
      case 'ready': return { k: 'ok', a: 'Yes', d: 'Last taken ' + D.fmtAgo(s.lastAgo) + '.' };
      case 'wait': return { k: 'wait', a: 'Not until ' + D.fmtClock(s.until), d: 'Minimum ' + m.intervalH + ' h between doses.' };
      case 'hold': return { k: 'warn', a: 'Not yet', d: 'You ' + s.note + '. Max 1000 mg of paracetamol in 4 h — excess paracetamol can damage the liver.' };
      case 'daily_max': return { k: 'warn', a: 'Not today', d: "You've reached the daily max of " + m.maxDay + ' tablets.' };
      case 'due': return { k: 'ok', a: 'Due now', d: 'Scheduled for ' + (s.times || []).join(' & ') + '.' };
      case 'done': return { k: 'ok', a: 'Done for today', d: 'Both scheduled doses taken.' };
    }
    return { a: 'Yes' };
  }

  function tile(m) {
    var sm = statusMap(m), w = Math.round(m.status.takenToday / m.maxDay * 100);
    return '<button class="pl-tile s-' + m.status.state + '" data-med="' + m.id + '">' +
      '<div class="pl-nm">' + m.name + '</div><div class="pl-sub">' + m.strength + ' · ' + m.brand + '</div>' +
      '<div class="pl-state">' + sm.value + '</div>' +
      '<div class="pl-bar"><i style="width:' + Math.max(4, w) + '%;background:hsl(' + m.hue + ' 90% 60%);box-shadow:0 0 12px hsl(' + m.hue + ' 90% 60% / .7)"></i></div>' +
      '<div class="pl-foot"><span>' + sm.footL + '</span><span>' + (sm.footR || '') + '</span></div></button>';
  }

  function renderApp() {
    var waits = D.meds.filter(function (m) { return m.status.state === 'wait'; }).sort(function (a, b) { return a.status.until - b.status.until; });
    var nx = waits[0];
    var next = nx ? '<div class="pl-next"><div class="l">Next dose</div><div class="m">' + nx.name + '</div><div class="t">in ' + D.fmtRemaining(nx.status.until - D.NOW) + '</div></div>' : '';
    return '' +
      '<div class="pl-top"><div><div class="kick">Pain right now</div>' +
      '<div class="pain">4<small>/10</small></div><div class="sev">Moderate · “easing off”</div></div>' + next + '</div>' +
      '<div class="pl-hero"><div class="pl-herobar"><div class="ttl">Timeline<span>pain &amp; doses</span></div>' +
      '<div class="tl-controls"><button class="zbtn" data-z="today">Today</button><button class="zbtn" data-z="week">Week</button>' +
      '<button class="zbtn" data-z="zoomOut">−</button><button class="zbtn solid" data-z="zoomIn">+</button></div></div>' +
      '<div class="tl-host"></div></div>' +
      '<div class="pl-sec">Medicines<span>' + D.meds.length + ' active</span></div>' +
      '<div class="pl-grid">' + D.meds.map(tile).join('') + '</div>';
  }

  function timelineRenderer(v) {
    var b = v.bands, pts = v.painPts, s = '';
    s += '<defs>' +
      '<linearGradient id="plArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5d6e" stop-opacity=".34"/><stop offset=".5" stop-color="#ffb547" stop-opacity=".16"/><stop offset="1" stop-color="#b8ff3a" stop-opacity="0"/></linearGradient>' +
      '<filter id="plGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="plGlowSm" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    // faint gridlines
    [b.painTop, (b.painTop + b.painBot) / 2, b.painBot].forEach(function (y) { s += '<line x1="24" y1="' + y.toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>'; });
    [[10, b.painTop], [0, b.painBot]].forEach(function (g) { s += '<text x="16" y="' + (g[1] + 3).toFixed(1) + '" font-size="9" fill="#5d6679" text-anchor="end">' + g[0] + '</text>'; });
    // area
    if (pts.length) {
      var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
      for (var i = 1; i < pts.length; i++) d += ' L' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
      var area = d + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + b.painBot + ' L' + pts[0].x.toFixed(1) + ' ' + b.painBot + ' Z';
      s += '<path d="' + area + '" fill="url(#plArea)"/>';
    }
    // pain spine — per-segment colour by score, glowing
    for (var j = 1; j < pts.length; j++) {
      var a = pts[j - 1], c = pts[j], col = v.painColor((a.score + c.score) / 2);
      s += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + c.x.toFixed(1) + '" y2="' + c.y.toFixed(1) + '" stroke="' + col + '" stroke-width="3" stroke-linecap="round" filter="url(#plGlow)"/>';
    }
    pts.forEach(function (p) { var hi = p.score >= 7, r = hi ? 5 : v.detail ? 4 : 2.6; s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '" fill="' + v.painColor(p.score) + '" filter="url(#plGlowSm)"' + (p.note ? ' stroke="#0a0b12" stroke-width="1.5"' : '') + '/>'; });
    // dose lane
    s += '<text x="24" y="' + (b.laneTop - 4).toFixed(1) + '" font-size="9" fill="#5d6679" letter-spacing=".12em">DOSES</text>';
    s += '<line x1="24" y1="' + b.laneBot.toFixed(1) + '" x2="' + (v.W - 12) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="rgba(255,255,255,.1)"/>';
    v.doseItems.forEach(function (dz) {
      var h = 8 + Math.min(1, dz.units / 2) * ((b.laneBot - b.laneTop) * 0.74), cy = b.laneBot - h, w = dz.units >= 2 ? 9 : dz.units >= 1 ? 7 : 5;
      s += '<line x1="' + dz.x.toFixed(1) + '" y1="' + b.laneBot.toFixed(1) + '" x2="' + dz.x.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="hsl(' + dz.hue + ' 85% 62% / .4)" stroke-width="2"/>' +
        '<rect x="' + (dz.x - w / 2).toFixed(1) + '" y="' + (cy - 4).toFixed(1) + '" width="' + w.toFixed(1) + '" height="8" rx="4" fill="hsl(' + dz.hue + ' 88% 64%)" filter="url(#plGlowSm)"/>';
    });
    // now
    s += '<line x1="' + v.nowX.toFixed(1) + '" y1="' + (b.painTop - 4) + '" x2="' + v.nowX.toFixed(1) + '" y2="' + b.laneBot.toFixed(1) + '" stroke="#b8ff3a" stroke-width="1.4" filter="url(#plGlowSm)"/>' +
      '<circle cx="' + v.nowX.toFixed(1) + '" cy="' + (b.painTop - 4) + '" r="3.4" fill="#b8ff3a" filter="url(#plGlowSm)"/>';
    v.axisTicks.forEach(function (t) { s += '<text x="' + t.x.toFixed(1) + '" y="' + b.axisY.toFixed(1) + '" font-size="9.5" fill="#6b748a" text-anchor="middle">' + t.label + '</text>'; });
    return s;
  }

  function renderSheet(m) {
    var av = availFor(m);
    return '<div class="pl-sheet"><div class="grabber"></div>' +
      '<div class="pl-sh-head"><div class="pl-sh-name">' + m.name + '</div><div class="pl-sh-strength">' + m.strength + ' · max ' + m.maxDay + '/day</div></div>' +
      '<div class="pl-avail ' + (av.k || '') + '"><div class="q">OK to take now?</div><div class="a">' + av.a + '</div>' +
      (av.d ? '<div class="d">' + av.d + '</div>' : '') + '</div>' +
      '<div class="pl-doses"><button>½<small>tab</small></button><button>1<small>tab</small></button><button>2<small>tabs</small></button></div>' +
      '<div class="pl-srow"><button>History</button><button>Edit</button><button data-close>Done</button></div></div>';
  }

  window.CONCEPTS.pulse = {
    label: 'Pulse', tagline: 'Timeline-first. Your pain as a glowing spine.',
    notes: 'Built around the chart, not the list. A near-black canvas lets a colour-by-severity pain spine and glowing dose capsules carry the story, with an electric-lime accent for what you can act on now. Medicines drop to fast glow-tiles beneath the hero.',
    meta: { type: 'Bricolage Grotesque · Spline Sans', palette: 'Near-black · severity spectrum · lime', idea: 'The timeline is the interface' },
    span: 3 * D.DAY, renderApp: renderApp, timelineRenderer: timelineRenderer, renderSheet: renderSheet
  };
})();
