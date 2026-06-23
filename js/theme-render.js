// js/theme-render.js — per-theme HTML for the signature surfaces. Pure (view -> string).
import { getTheme } from './theme.js';

/* ---- shared SVG bits ---- */
const R = 42, CIRC = 2 * Math.PI * R;
function dial(color, frac) {
  const off = CIRC * (1 - Math.max(0.012, Math.min(1, frac)));
  return `<svg class="au-dial" viewBox="0 0 96 96"><circle class="au-track" cx="48" cy="48" r="${R}"/>` +
    `<circle class="au-prog" cx="48" cy="48" r="${R}" stroke="${color}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}
function blister(taken, max, cls) {
  let dots = '';
  for (let i = 0; i < max; i++) dots += `<i class="${i < taken ? 'on' : ''}"></i>`;
  return `<div class="${cls || 'ap-blister'}">${dots}</div>`;
}

/* ---- Classic (current markup) ---- */
function classicTile(v) {
  const count = `<span class="count">${v.remainingText}</span>`;
  const statusInner =
    v.state === 'ready' ? (v.scheduled ? 'Due to take' : 'Ready when needed')
    : v.state === 'wait' ? (v.scheduled ? `Due in&nbsp;${count}` : `${count}&nbsp;until next`)
    : v.state === 'hold' ? `Hold&nbsp;${count}`
    : (v.scheduled ? 'Done for today' : 'Daily max');
  return `<div><h2>${v.name}</h2>` +
    `<div class="dose-label">${v.strength ? v.strength + ' · ' : ''}max ${v.maxDay}/day</div>` +
    (v.holdIng ? `<div class="last hold-note">Contains ${v.holdIng} — shared limit reached</div>`
      : (v.lastLine ? `<div class="last">${v.lastLine}</div>` : '')) +
    `</div><div class="status ${v.state}">${statusInner}</div>`;
}
function classicPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  return `<div class="pain-now"><div class="pain-score" style="color:${v.color}">${v.score}<span>/10</span></div>` +
    `<div class="pain-meta">${v.severity} · logged ${v.relative}${v.note ? `<br><span class="muted">“${v.note}”</span>` : ''}</div></div>`;
}
function classicHeader(v) {
  return `<h2>${v.name}${v.strength ? ` <span class="muted">${v.strength}</span>` : ''}</h2>`;
}

/* ---- Aurora (dial) ---- */
function auroraStatus(v) {
  const n = `${v.takenToday} of ${v.maxDay} today`;
  switch (v.state) {
    case 'wait': return { top: 'Next in', big: v.remainingText, sm: true, chip: n };
    case 'hold': return { top: 'On hold', big: 'Hold', chip: 'Shared limit', holdNote: `Contains ${v.holdIng}` };
    case 'daily_max': return { top: 'Today', big: v.scheduled ? '✓' : 'Max', chip: `${v.takenToday} of ${v.maxDay} · done` };
    default: return { top: v.scheduled ? 'Due' : 'Ready', big: 'Now', chip: n };
  }
}
function auroraTile(v) {
  const st = auroraStatus(v), frac = v.takenToday / v.maxDay;
  return `<div class="au-dialwrap">${dial(v.color, frac)}` +
    `<div class="au-dialc"><div class="au-top">${st.top}</div><div class="au-big${st.sm ? ' sm' : ''}">${st.big}</div></div></div>` +
    `<div class="au-nm">${v.name}</div><div class="au-st">${st.chip}</div>` +
    (st.holdNote ? `<div class="au-holdnote">${st.holdNote}</div>` : '');
}
function auroraPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  const frac = v.score / 10;
  return `<div class="au-paincard"><div class="au-pscore">${dial('url(#auG)', frac)}` +
    `<svg width="0" height="0"><defs><linearGradient id="auG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15b886"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs></svg>` +
    `<div class="au-pv">${v.score}</div></div>` +
    `<div class="au-pmeta"><div class="au-plab">Pain right now</div><div class="au-psev">${v.severity}</div>` +
    `<div class="au-psince">${v.relative}${v.note ? ` · “${v.note}”` : ''}</div></div></div>`;
}
function auroraHeader(v) {
  return `<div class="au-shead"><div class="au-dialwrap sm">${dial(v.color, v.takenToday / v.maxDay)}</div>` +
    `<div><div class="au-sname">${v.name}</div><div class="au-sstrength">${v.strength} · max ${v.maxDay}/day</div></div></div>`;
}

/* ---- Apothecary (blister) ---- */
function apoStatus(v) {
  const n = `${v.takenToday} of ${v.maxDay} today`;
  switch (v.state) {
    case 'wait': return { icon: '◷', text: 'Next dose due soon', sub: v.remainingText };
    case 'hold': return { icon: '⊘', text: 'On hold', sub: `contains ${v.holdIng}` };
    case 'daily_max': return { icon: '●', text: v.scheduled ? 'Done for today' : 'Daily max reached', sub: '' };
    default: return { icon: '✓', text: v.scheduled ? 'Due now' : 'Ready now', sub: n };
  }
}
function apoTile(v) {
  const st = apoStatus(v);
  return `<div class="ap-head"><div><div class="ap-name">${v.name}</div>` +
    `<div class="ap-strength">${v.strength ? v.strength + ' · ' : ''}max ${v.maxDay}/day</div></div><div class="ap-icon">${st.icon}</div></div>` +
    blister(v.takenToday, v.maxDay) +
    `<div class="ap-status"><span class="d"></span>${st.text}${st.sub ? ` <small>${st.sub}</small>` : ''}</div>`;
}
function apoPain(v) {
  if (!v) return `<div class="pain-now muted">No pain logged yet. Tap “Log pain” to start.</div>`;
  return `<div class="ap-paincard"><div class="ap-pill"><b style="color:${v.color}">${v.score}</b><span>pain · ${v.severity}</span></div>` +
    `<div class="ap-pmeta">${v.relative}${v.note ? `<br><span class="muted">“${v.note}”</span>` : ''}</div></div>`;
}
function apoHeader(v) {
  return `<div class="ap-sname">${v.name}</div><div class="ap-sstrength">${v.strength} · max ${v.maxDay}/day</div>` +
    blister(v.takenToday, v.maxDay, 'ap-sh-blister');
}

/* ---- dispatch ---- */
const TILES = { classic: classicTile, aurora: auroraTile, apothecary: apoTile };
const PAINS = { classic: classicPain, aurora: auroraPain, apothecary: apoPain };
const HEADERS = { classic: classicHeader, aurora: auroraHeader, apothecary: apoHeader };
export function tileHtml(view) { return (TILES[getTheme()] || classicTile)(view); }
export function painCardHtml(view) { return (PAINS[getTheme()] || classicPain)(view); }
export function doseHeaderHtml(view) { return (HEADERS[getTheme()] || classicHeader)(view); }

/* ---- timeline palette (colours only; structure unchanged) ---- */
const PAL = {
  classic: { dark: { grid: 'rgba(148,163,184,.22)', gtext: '#94a3b8', lane: '#475569', now: 'rgba(148,163,184,.4)', band: 'rgba(148,163,184,.05)', ring: '#0b1220' },
    light: { grid: 'rgba(16,32,46,.14)', gtext: '#5b6676', lane: '#9aa7b6', now: 'rgba(16,32,46,.3)', band: 'rgba(16,32,46,.04)', ring: '#f4f7fb' } },
  aurora: {
    light: { grid: 'rgba(16,23,40,.08)', gtext: '#9aa3b4', lane: 'rgba(16,23,40,.12)', now: 'rgba(16,23,40,.25)', band: 'rgba(16,23,40,.025)', ring: '#fff' },
    dark: { grid: 'rgba(255,255,255,.08)', gtext: '#6b7488', lane: 'rgba(255,255,255,.12)', now: 'rgba(255,255,255,.28)', band: 'rgba(255,255,255,.03)', ring: '#0c1018' } },
  apothecary: {
    light: { grid: 'rgba(43,33,24,.1)', gtext: '#9a8c78', lane: 'rgba(43,33,24,.18)', now: 'rgba(191,91,57,.5)', band: 'rgba(43,33,24,.028)', ring: '#fbf6ec' },
    dark: { grid: 'rgba(255,255,255,.1)', gtext: '#9a8c78', lane: 'rgba(255,255,255,.18)', now: 'rgba(223,125,84,.6)', band: 'rgba(255,255,255,.028)', ring: '#221b14' } },
};
export function timelinePalette(theme, dark) {
  const t = PAL[theme] || PAL.classic;
  const p = (dark ? t.dark : t.light) || PAL.classic.dark;
  return { pain: null, area: null, glow: false, grid: p.grid, gtext: p.gtext, axis: p.gtext, lane: p.lane, now: p.now, band: p.band, ring: p.ring };
}
