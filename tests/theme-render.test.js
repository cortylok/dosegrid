import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage + document shims so theme.js works under node (must precede imports that touch them).
globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; })();
globalThis.document = { documentElement: {}, querySelector: () => null, dispatchEvent: () => {} };

const { tileHtml, painCardHtml, doseHeaderHtml, timelinePalette } = await import('../js/theme-render.js');
const { setTheme } = await import('../js/theme.js');

const tv = { name: 'Paracetamol', strength: '500 mg', maxDay: 8, takenToday: 2, state: 'ready', scheduled: false, remainingText: '1h 40m', holdIng: null, lastLine: '2 h ago', color: '#38bdf8' };

for (const theme of ['classic', 'aurora', 'apothecary']) {
  test(`tileHtml renders for ${theme} across states`, () => {
    setTheme(theme);
    for (const state of ['ready', 'wait', 'hold', 'daily_max']) {
      const html = tileHtml({ ...tv, state, holdIng: state === 'hold' ? 'paracetamol' : null });
      assert.ok(html.length > 20, `${theme}/${state} produced output`);
      assert.ok(html.includes('Paracetamol'), `${theme}/${state} includes name`);
    }
  });
}

test('signature markers per theme', () => {
  setTheme('classic'); assert.ok(tileHtml(tv).includes('class="status'));
  setTheme('aurora'); assert.ok(tileHtml(tv).includes('au-dial'));
  setTheme('apothecary'); assert.ok(tileHtml(tv).includes('ap-blister'));
});

test('painCardHtml: data + empty state', () => {
  setTheme('classic');
  assert.ok(painCardHtml({ score: 4, color: '#f00', severity: 'moderate', relative: 'now', note: '' }).includes('4'));
  assert.ok(painCardHtml(null).toLowerCase().includes('no pain'));
});

test('doseHeaderHtml includes the name for each theme', () => {
  for (const theme of ['classic', 'aurora', 'apothecary']) {
    setTheme(theme);
    assert.ok(doseHeaderHtml({ name: 'Ibuprofen', strength: '400 mg', maxDay: 6, takenToday: 1, color: '#f00' }).includes('Ibuprofen'));
  }
});

test('timelinePalette returns keys with glow off', () => {
  const p = timelinePalette('aurora', true);
  ['pain', 'grid', 'axis', 'lane', 'now', 'band', 'ring'].forEach((k) => assert.ok(k in p));
  assert.equal(p.glow, false);
});
