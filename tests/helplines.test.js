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

test('COUNTRY_OPTIONS is sorted by name with Other last, one per HELP_LINES entry', () => {
  assert.equal(COUNTRY_OPTIONS.length, Object.keys(HELP_LINES).length);
  assert.equal(COUNTRY_OPTIONS[COUNTRY_OPTIONS.length - 1][0], 'other');
  const names = COUNTRY_OPTIONS.slice(0, -1).map((o) => o[1]);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('expanded coverage: a newly-added country (Germany) leads with a public advice line', () => {
  const de = helpLinesFor('DE');
  assert.equal(de.country, 'Germany');
  assert.ok(de.advice.length >= 1);
  assert.equal(de.advice[0].kind, 'nurse');
  assert.equal(de.advice[0].number, '116117');
  assert.equal(de.emergency.number, '112');
});

test('every advice line is nurse or poison and has a number; non-other entries carry advice', () => {
  for (const [code, e] of Object.entries(HELP_LINES)) {
    if (code === 'other') continue;
    assert.ok(e.advice.length >= 1, `${code} has no advice line`);
    for (const a of e.advice) {
      assert.ok(a.kind === 'nurse' || a.kind === 'poison', `${code}: bad kind ${a.kind}`);
      assert.ok(a.number && a.number.trim(), `${code}: missing number`);
    }
  }
});
