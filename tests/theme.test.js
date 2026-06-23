import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvedDark, htmlClass, normTheme, normMode, THEMES, MODES } from '../js/theme.js';

test('resolvedDark: dark always, light never, auto follows system', () => {
  assert.equal(resolvedDark('dark', false), true);
  assert.equal(resolvedDark('light', true), false);
  assert.equal(resolvedDark('auto', true), true);
  assert.equal(resolvedDark('auto', false), false);
});

test('htmlClass composes theme + is-dark', () => {
  assert.equal(htmlClass('aurora', true), 'theme-aurora is-dark');
  assert.equal(htmlClass('classic', false), 'theme-classic');
});

test('normTheme / normMode reject unknown values', () => {
  assert.equal(normTheme('aurora'), 'aurora');
  assert.equal(normTheme('nope'), 'classic');
  assert.equal(normTheme(null), 'classic');
  assert.equal(normMode('dark'), 'dark');
  assert.equal(normMode('weird'), 'auto');
  assert.deepEqual(THEMES, ['classic', 'aurora', 'apothecary']);
  assert.deepEqual(MODES, ['auto', 'light', 'dark']);
});
