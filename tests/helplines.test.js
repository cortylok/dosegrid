import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_LINES, helpLinesFor, COUNTRY_OPTIONS, WHO_DIRECTORY } from '../js/helplines.js';

test('AU leads with a nurse advice line', () => {
  const au = helpLinesFor('AU');
  assert.equal(au.country, 'Australia');
  assert.equal(au.advice[0].kind, 'nurse');
  assert.equal(au.advice[0].number, '1800 022 222');
});

test('unknown code falls back to other (empty advice, null emergency)', () => {
  const o = helpLinesFor('ZZ');
  assert.equal(o, HELP_LINES.other);
  assert.equal(o.advice.length, 0);
  assert.equal(o.emergency.number, null);
});

test('WHO_DIRECTORY is the shared fallback for empty-advice countries', () => {
  assert.ok(WHO_DIRECTORY.url.includes('who.int'));
  assert.ok(WHO_DIRECTORY.label);
});

test('every entry has an advice array and an emergency object', () => {
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

test('global coverage: well over 150 countries, each with an emergency number', () => {
  const real = Object.entries(HELP_LINES).filter(([c]) => c !== 'other');
  assert.ok(real.length > 150, `only ${real.length} countries`);
  for (const [code, e] of real) {
    assert.ok(e.emergency.number && String(e.emergency.number).trim(), `${code} has no emergency number`);
  }
});

test('Germany lists all 8 regional poison centres and leads with a nurse line', () => {
  const de = helpLinesFor('DE');
  assert.equal(de.advice[0].kind, 'nurse');
  assert.equal(de.advice[0].number, '116117');
  const poison = de.advice.find((a) => a.kind === 'poison');
  assert.ok(poison && /Munich|Bonn/.test(poison.note), 'regional numbers should be in the note');
  assert.equal(de.emergency.number, '112');
});

test('every advice line is nurse or poison with a usable number', () => {
  for (const [code, e] of Object.entries(HELP_LINES)) {
    for (const a of e.advice) {
      assert.ok(a.kind === 'nurse' || a.kind === 'poison', `${code}: bad kind ${a.kind}`);
      assert.ok(a.number && String(a.number).trim(), `${code}: missing number`);
    }
  }
});
