import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_LINES, helpLinesFor, COUNTRY_OPTIONS } from '../js/helplines.js';

test('AU leads with a nurse advice line', () => {
  const au = helpLinesFor('AU');
  assert.equal(au.country, 'Australia');
  assert.equal(au.advice[0].kind, 'nurse');
  assert.equal(au.advice[0].number, '1800 022 222');
});

test('unknown code falls back to other (empty advice + directory)', () => {
  const o = helpLinesFor('ZZ');
  assert.equal(o, HELP_LINES.other);
  assert.equal(o.advice.length, 0);
  assert.ok(o.directory && o.directory.url.includes('who.int'));
});

test('every entry has advice array and an emergency object', () => {
  for (const [code, e] of Object.entries(HELP_LINES)) {
    assert.ok(Array.isArray(e.advice), code);
    assert.ok(e.emergency && 'number' in e.emergency, code);
  }
});

test('COUNTRY_OPTIONS covers the data + an Other entry', () => {
  const codes = COUNTRY_OPTIONS.map((o) => o[0]);
  assert.ok(codes.includes('AU') && codes.includes('other'));
});
