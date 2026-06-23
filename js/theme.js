// js/theme.js — theme + light/dark mode state and application.
export const THEMES = ['classic', 'aurora', 'apothecary'];
export const MODES = ['auto', 'light', 'dark'];
export const THEME_LABELS = { classic: 'Classic', aurora: 'Aurora', apothecary: 'Apothecary' };
const THEME_BAR = { classic: '#0b1220', aurora: '#eef2f8', apothecary: '#efe6d6' };
const THEME_BAR_DARK = { classic: '#0b1220', aurora: '#0c1018', apothecary: '#16120e' };

const THEME_KEY = 'dosegrid.theme', MODE_KEY = 'dosegrid.mode';

export function normTheme(t) { return THEMES.includes(t) ? t : 'classic'; }
export function normMode(m) { return MODES.includes(m) ? m : 'auto'; }
export function resolvedDark(mode, systemDark) { return mode === 'dark' || (mode === 'auto' && !!systemDark); }
export function htmlClass(theme, dark) { return 'theme-' + theme + (dark ? ' is-dark' : ''); }

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, v) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

export function getTheme() { return normTheme(read(THEME_KEY)); }
export function getMode() { return normMode(read(MODE_KEY)); }
export function setTheme(t) { write(THEME_KEY, normTheme(t)); applyTheme(); }
export function setMode(m) { write(MODE_KEY, normMode(m)); applyTheme(); }

function systemDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme() {
  const theme = getTheme(), mode = getMode(), dark = resolvedDark(mode, systemDark());
  document.documentElement.className = htmlClass(theme, dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? THEME_BAR_DARK[theme] : THEME_BAR[theme]);
  document.dispatchEvent(new CustomEvent('dosegrid:refresh'));
}

// Re-apply when the OS scheme changes and we're in Auto.
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getMode() === 'auto') applyTheme(); });
}
