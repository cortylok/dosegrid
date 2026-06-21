// tests/build-www.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWww } from '../scripts/build-www.mjs';

test('build-www copies runtime assets and excludes non-runtime files', async () => {
  const out = await mkdtemp(join(tmpdir(), 'dg-www-'));
  await buildWww(out);

  // runtime assets must be present
  for (const f of ['index.html', 'js/app.js', 'css/styles.css', 'medications.json',
    'manifest.webmanifest', 'service-worker.js', 'icons']) {
    await access(join(out, f)); // throws if missing → test fails
  }
  // non-runtime must NOT be copied
  for (const f of ['tests', 'docs', 'node_modules', 'package.json']) {
    await assert.rejects(access(join(out, f)), `${f} should not be in www`);
  }
  await rm(out, { recursive: true, force: true });
});
