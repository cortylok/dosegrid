/* Reusable zoomable timeline engine. One pan/zoom core; each concept supplies a
   renderer(view) -> SVG inner markup, so visuals differ but interaction is shared.
   Classic script, global TL. */
(function () {
  var HOUR = 36e5, DAY = 864e5;
  var MIN_SPAN = 12 * HOUR, MAX_SPAN = 14 * DAY;

  function create(host, opts) {
    opts = opts || {};
    var renderer = opts.renderer;
    var data = window.DEMO;
    var NOW = data.NOW;
    var W = host.clientWidth || 380, H = host.clientHeight || 300;
    var padL = opts.padL != null ? opts.padL : 30, padR = opts.padR != null ? opts.padR : 14;
    var scale, t0;

    var minT = Math.min(data.pain[0].t, data.doses[0].t) - DAY;
    function effW() { return Math.max(1, W - padL - padR); }
    function fit(span) { span = span || MAX_SPAN; scale = effW() / span; t0 = NOW - span; clamp(); }
    function clamp() {
      var sMin = effW() / MAX_SPAN, sMax = effW() / MIN_SPAN;
      scale = Math.max(sMin, Math.min(sMax, scale));
      var span = effW() / scale, lo = minT, hi = NOW - span;
      t0 = hi <= lo ? hi : Math.max(lo, Math.min(hi, t0));
    }
    function x(t) { return padL + (t - t0) * scale; }
    function t1() { return t0 + effW() / scale; }

    function bands() {
      return {
        painTop: H * 0.12, painBot: H * 0.56,
        laneTop: H * 0.63, laneBot: H * 0.86, axisY: H * 0.955, H: H, W: W, padL: padL, padR: padR
      };
    }

    function buildView() {
      var b = bands(), end = t1(), span = end - t0;
      var yPain = function (s) { return b.painBot - (Math.max(0, Math.min(10, s)) / 10) * (b.painBot - b.painTop); };
      var pad = DAY;
      var painPts = data.pain.filter(function (p) { return p.t >= t0 - pad && p.t <= end + pad; })
        .map(function (p) { return { t: p.t, score: p.score, note: p.note, x: x(p.t), y: yPain(p.score) }; });
      var doseItems = data.doses.filter(function (d) { return d.t >= t0 - pad && d.t <= end + pad; })
        .map(function (d) { var m = data.medById(d.medId); return { t: d.t, x: x(d.t), units: d.units, medId: d.medId, name: m.name, color: m.color, hue: m.hue }; });
      // day + hour ticks
      var ticks = [];
      var startDay = new Date(t0); startDay.setHours(0, 0, 0, 0);
      for (var dd = startDay.getTime(); dd < end; dd += DAY) {
        var dx = x(dd);
        ticks.push({ t: dd, x: dx, day: true, label: labelFor(dd, span) });
      }
      var pxPerDay = scale * DAY;
      var hourAlpha = Math.max(0, Math.min(1, (scale * HOUR - 7) / 22));
      var axisTicks = [];
      for (var i = 0; i <= 5; i++) { var tt = t0 + span * i / 5; axisTicks.push({ t: tt, x: padL + effW() * i / 5, label: labelFor(tt, span, true) }); }
      return {
        W: W, H: H, bands: b, t0: t0, t1: end, span: span, scale: scale, pxPerDay: pxPerDay,
        x: x, yPain: yPain, painPts: painPts, doseItems: doseItems, dayTicks: ticks, axisTicks: axisTicks,
        hourAlpha: hourAlpha, detail: pxPerDay >= 90, now: NOW, nowX: x(NOW),
        painColor: data.painColor, fmtClock: data.fmtClock, meds: data.meds
      };
    }
    function labelFor(t, span, axis) {
      var dte = new Date(t);
      if (span <= 2 * DAY) return axis ? dte.toLocaleTimeString([], { hour: 'numeric' }) : dte.toLocaleTimeString([], { hour: 'numeric' });
      if (span <= 9 * DAY) return dte.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
      return dte.getDate() + '/' + (dte.getMonth() + 1);
    }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tl-svg');
    svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
    svg.style.touchAction = 'none';
    host.appendChild(svg);

    function render() {
      W = host.clientWidth || W; H = host.clientHeight || H; clamp();
      var v = buildView();
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.innerHTML = renderer(v);
    }

    // interaction
    function zoomAt(px, factor) { var tf = t0 + (px - padL) / scale; scale *= factor; clamp(); t0 = tf - (px - padL) / scale; clamp(); render(); }
    host.addEventListener('wheel', function (e) { e.preventDefault(); var r = host.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.deltaY < 0 ? 1.16 : 1 / 1.16); }, { passive: false });
    var pointers = new Map(), pinch = 0, dragging = false, lastX = 0, moved = false;
    host.addEventListener('pointerdown', function (e) { host.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e.clientX); if (pointers.size === 1) { dragging = true; moved = false; lastX = e.clientX; } else if (pointers.size === 2) { var xs = Array.from(pointers.values()); pinch = Math.abs(xs[0] - xs[1]); } });
    host.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, e.clientX);
      if (pointers.size === 2) { var xs = Array.from(pointers.values()), dd = Math.abs(xs[0] - xs[1]), r = host.getBoundingClientRect(); if (pinch) zoomAt((xs[0] + xs[1]) / 2 - r.left, dd / pinch); pinch = dd; return; }
      if (dragging) { var dx = e.clientX - lastX; lastX = e.clientX; if (Math.abs(dx) > 2) moved = true; t0 -= dx / scale; clamp(); render(); }
    });
    function up(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (pointers.size === 0) dragging = false; }
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);

    // animated presets
    function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    var raf = 0;
    function animateTo(ts, tt) {
      if (raf) cancelAnimationFrame(raf);
      var s0 = scale, p0 = t0, start = performance.now();
      (function step(n) {
        var p = ease(Math.min(1, (n - start) / 360));
        scale = s0 * Math.pow(ts / s0, p); t0 = p0 + (tt - p0) * p; clamp(); render();
        if (p < 1) raf = requestAnimationFrame(step); else { raf = 0; scale = ts; t0 = tt; clamp(); render(); }
      })(start);
    }
    function spanTo(span) { W = host.clientWidth || W; var ts = effW() / Math.max(MIN_SPAN, Math.min(MAX_SPAN, span)); animateTo(ts, NOW - effW() / ts); }
    function zoomStep(f) { W = host.clientWidth || W; var mid = effW() / 2, c = t0 + mid / scale, ts = scale * f; animateTo(ts, c - mid / ts); }

    fit(opts.span || 3 * DAY);
    render();
    window.addEventListener('resize', render);
    return {
      el: svg, render: render,
      zoomIn: function () { zoomStep(1.7); }, zoomOut: function () { zoomStep(1 / 1.7); },
      today: function () { var d = new Date(NOW); d.setHours(0, 0, 0, 0); spanTo(NOW - d.getTime()); },
      week: function () { spanTo(7 * DAY); }, fortnight: function () { spanTo(14 * DAY); }
    };
  }

  window.TL = { create: create };
})();
