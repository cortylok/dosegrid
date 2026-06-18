// js/timeline.js — zoomable, scrollable pain + dose timeline with level-of-detail.
import { loadPain, loadDoses, loadMeds } from './storage.js';
import { painColor, medColor, lodMode, startOfDay, isEarlyDose, medDayTotals } from './pain.js';

const DAY = 864e5, HOUR = 36e5;
const padL = 30, padR = 12;
const painTop = 14, painBot = 150, laneTop = 182, laneBot = 292, axisY = 308, H = 320;
const MAX_SPAN = 14 * DAY;   // most zoomed-out = a fortnight on screen
const MIN_SPAN = 12 * HOUR;  // deepest zoom

const startOfHour = t => { const d = new Date(t); d.setMinutes(0, 0, 0); return d.getTime(); };

export function createTimeline(host, { onPainClick, onDoseClick } = {}) {
  let scale = 1, t0 = 0, W = 600;
  let dragging = false, dragMoved = false, lastX = 0;
  const pointers = new Map(); let pinchDist = 0;
  let doseById = new Map();

  function range() {
    const now = Date.now();
    const ts = [...loadPain().map(p => p.timestamp), ...loadDoses().map(d => d.timestamp)];
    const min = ts.length ? Math.min(...ts) : now - MAX_SPAN;
    return { start: Math.min(min, now - MAX_SPAN), end: now };
  }
  function fit() { W = host.clientWidth; scale = (W - padL - padR) / MAX_SPAN; t0 = Date.now() - MAX_SPAN; }
  const pxDay = () => scale * DAY;
  function clamp() {
    W = host.clientWidth;
    const { start, end } = range();
    const sMin = (W - padL - padR) / MAX_SPAN, sMax = (W - padL - padR) / MIN_SPAN;
    scale = Math.max(sMin, Math.min(sMax, scale));
    const span = (W - padL - padR) / scale;
    const lo = start, hi = end - span;
    t0 = hi <= lo ? hi : Math.max(lo, Math.min(hi, t0));
  }
  const X = t => padL + (t - t0) * scale;
  const tR = () => t0 + (W - padL - padR) / scale;

  function medLookup() {
    const map = {};
    loadMeds().forEach((m) => { map[m.id] = { name: m.name, color: medColor(m.order || 0), max: m.maxDailyUnits || 0, interval: m.intervalHours || 0 }; });
    return map;
  }

  function render() {
    clamp();
    W = host.clientWidth;
    const span = tR() - t0;
    const detail = lodMode(pxDay()) === 'detail';
    const meds = medLookup();
    const pain = loadPain(), doses = loadDoses().slice().sort((a, b) => a.timestamp - b.timestamp);
    doseById = new Map(doses.map(d => [d.id, d]));
    const vis = pain.filter(p => p.timestamp >= t0 - DAY && p.timestamp <= tR() + DAY).sort((a, b) => a.timestamp - b.timestamp);
    const visDoses = doses.filter(d => d.timestamp >= t0 - DAY && d.timestamp <= tR() + DAY);
    const Y = v => painBot - (v / 10) * (painBot - painTop);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="tl-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

    // ---- background banding: day stripes (always) + hour stripes (fade in) ----
    const bandH = laneBot - painTop, ref = startOfDay(range().start);
    for (let dd = startOfDay(t0); dd < tR(); dd += DAY) {
      const x1 = Math.max(padL, X(dd)), x2 = Math.min(W - padR, X(dd + DAY));
      if (x2 > x1 && Math.round((dd - ref) / DAY) % 2 === 0)
        s += `<rect x="${x1.toFixed(1)}" y="${painTop}" width="${(x2 - x1).toFixed(1)}" height="${bandH}" fill="rgba(148,163,184,0.05)"/>`;
      const mx = X(dd);
      if (mx >= padL && mx <= W - padR)
        s += `<line x1="${mx.toFixed(1)}" y1="${painTop}" x2="${mx.toFixed(1)}" y2="${laneBot}" stroke="rgba(148,163,184,0.22)" stroke-width="1"/>`;
    }
    const hourAlpha = Math.max(0, Math.min(1, (scale * HOUR - 7) / 22));
    if (hourAlpha > 0.02) for (let hh = startOfHour(t0); hh < tR(); hh += HOUR) {
      const x1 = Math.max(padL, X(hh)), x2 = Math.min(W - padR, X(hh + HOUR));
      if (x2 > x1 && new Date(hh).getHours() % 2 === 0)
        s += `<rect x="${x1.toFixed(1)}" y="${painTop}" width="${(x2 - x1).toFixed(1)}" height="${bandH}" fill="rgba(34,211,238,${(hourAlpha * 0.06).toFixed(3)})"/>`;
    }

    // ---- pain gridlines ----
    for (const [v, y] of [[10, painTop], [5, (painTop + painBot) / 2], [0, painBot]]) {
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#334155"/><text x="${padL - 4}" y="${y + 3}" font-size="9" fill="#94a3b8" text-anchor="end">${v}</text>`;
    }

    // ---- pain ----
    if (detail) {
      if (vis.length > 1) s += `<polyline points="${vis.map(p => `${X(p.timestamp).toFixed(1)},${Y(p.score).toFixed(1)}`).join(' ')}" fill="none" stroke="rgba(34,211,238,.45)" stroke-width="1.5"/>`;
      for (const p of vis) {
        const cx = X(p.timestamp).toFixed(1), cy = Y(p.score).toFixed(1);
        const ring = p.note ? ' stroke="#f8fafc" stroke-width="2"' : '';
        s += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${painColor(p.score)}"${ring}/>`;
        s += `<circle cx="${cx}" cy="${cy}" r="17" fill="transparent" data-pain="${p.id}" style="cursor:pointer"/>`;
      }
    } else {
      for (let i = 1; i < vis.length; i++) {
        const a = vis[i - 1], b = vis[i];
        s += `<line x1="${X(a.timestamp).toFixed(1)}" y1="${Y(a.score).toFixed(1)}" x2="${X(b.timestamp).toFixed(1)}" y2="${Y(b.score).toFixed(1)}" stroke="${painColor((a.score + b.score) / 2)}" stroke-width="2.5"/>`;
      }
      for (const p of vis) if (p.note) {
        const cx = X(p.timestamp).toFixed(1), cy = Y(p.score).toFixed(1);
        s += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="#f8fafc"/><circle cx="${cx}" cy="${cy}" r="17" fill="transparent" data-pain="${p.id}" style="cursor:pointer"/>`;
      }
    }

    // ---- dose lane ----
    const laneH = laneBot - laneTop;
    s += `<text x="${padL}" y="${laneTop - 6}" font-size="8" fill="#64748b">DOSES — ${detail ? 'each dose, height = share of daily limit' : 'per-med daily totals vs each med’s max'}</text>`;
    s += `<line x1="${padL}" y1="${laneTop}" x2="${W - padR}" y2="${laneTop}" stroke="#f87171" stroke-width="1" stroke-dasharray="3 3"/><text x="${padL - 4}" y="${laneTop + 3}" font-size="7" fill="#f87171" text-anchor="end">max</text>`;
    s += `<line x1="${padL}" y1="${laneBot}" x2="${W - padR}" y2="${laneBot}" stroke="#475569"/>`;
    if (detail) {
      const cum = {}, lastTs = {};
      for (const d of visDoses) {
        const m = meds[d.medId] || { color: '#94a3b8', max: 0, interval: 0 };
        const dk = d.medId + '|' + startOfDay(d.timestamp);
        cum[dk] = (cum[dk] || 0) + d.units;
        const share = m.max ? Math.min(cum[dk] / m.max, 1.3) : 0.2;
        const top = laneBot - share * laneH;
        const early = isEarlyDose(d.timestamp, lastTs[d.medId] ?? null, m.interval);
        lastTs[d.medId] = d.timestamp;
        const x = X(d.timestamp).toFixed(1);
        s += `<line x1="${x}" y1="${laneBot}" x2="${x}" y2="${top.toFixed(1)}" stroke="${m.color}" stroke-width="3"/>`;
        s += `<circle cx="${x}" cy="${top.toFixed(1)}" r="7" fill="${m.color}"${early ? ' stroke="#fbbf24" stroke-width="2"' : ''}/>`;
        s += `<text x="${x}" y="${(top + 3).toFixed(1)}" font-size="8" fill="#06222a" text-anchor="middle" font-weight="700" pointer-events="none">${d.units}</text>`;
        s += `<circle cx="${x}" cy="${top.toFixed(1)}" r="16" fill="transparent" data-dose="${d.id}" style="cursor:pointer"/>`;
      }
    } else {
      const totals = medDayTotals(visDoses);
      const order = loadMeds();
      const BW = 7;
      for (const [ds, perMed] of totals) {
        const present = order.filter(m => perMed[m.id]);
        let bx = X(ds + 12 * HOUR) - (present.length * BW) / 2;
        for (const m of present) {
          const mm = meds[m.id], tabs = perMed[m.id], share = mm.max ? tabs / mm.max : 0.3;
          const h = Math.min(share, 1.3) * laneH;
          s += `<rect x="${bx.toFixed(1)}" y="${(laneBot - h).toFixed(1)}" width="${BW - 1}" height="${h.toFixed(1)}" rx="1.5" fill="${mm.color}" data-day="${ds}" data-med="${m.id}" style="cursor:pointer"/>`;
          bx += BW;
        }
      }
    }

    // ---- time axis ----
    for (let i = 0; i <= 5; i++) {
      const t = t0 + (span * i / 5), x = padL + (W - padL - padR) * i / 5;
      const label = span <= 2 * DAY ? new Date(t).toLocaleTimeString([], { hour: 'numeric' })
        : span <= 9 * DAY ? new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric' })
        : new Date(t).getDate() + '/' + (new Date(t).getMonth() + 1);
      s += `<text x="${x.toFixed(1)}" y="${axisY}" font-size="9" fill="#94a3b8" text-anchor="middle">${label}</text>`;
    }
    s += `</svg>`;
    host.innerHTML = s;
  }

  // ---- interaction ----
  function zoomAt(px, factor) { const tf = t0 + (px - padL) / scale; scale *= factor; clamp(); t0 = tf - (px - padL) / scale; clamp(); render(); }
  host.addEventListener('wheel', e => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e.clientX); if (pointers.size === 1) { dragging = true; dragMoved = false; lastX = e.clientX; } if (pointers.size === 2) { const xs = [...pointers.values()]; pinchDist = Math.abs(xs[0] - xs[1]); } });
  host.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e.clientX);
    if (pointers.size === 2) { const xs = [...pointers.values()]; const d = Math.abs(xs[0] - xs[1]); const r = host.getBoundingClientRect(); if (pinchDist) zoomAt((xs[0] + xs[1]) / 2 - r.left, d / pinchDist); pinchDist = d; return; }
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; if (Math.abs(dx) > 2) dragMoved = true; t0 -= dx / scale; render(); }
  });
  function up(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (pointers.size === 0) dragging = false; }
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', e => {
    if (dragMoved) return;
    const pa = e.target.closest('[data-pain]'); if (pa) { onPainClick && onPainClick(pa.dataset.pain); return; }
    const dz = e.target.closest('[data-dose]'); if (dz) { onDoseClick && onDoseClick(doseById.get(dz.dataset.dose)); return; }
  });
  window.addEventListener('resize', () => { fit(); render(); });

  fit();
  return { render };
}
