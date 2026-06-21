// scripts/build-www.mjs — assemble the generated www/ that Capacitor uses as webDir.
// The web app lives at the repo root (source of truth for GitHub Pages + tests);
// this copies only the runtime files into www/. Re-runnable; output is reproducible.
import { rm, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Runtime asset set served to the browser / bundled into the native app.
const ASSETS = [
  'index.html', 'css', 'js', 'medications.json',
  'manifest.webmanifest', 'service-worker.js', 'icons',
];

export async function buildWww(outDir = join(ROOT, 'www')) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const asset of ASSETS) {
    await cp(join(ROOT, asset), join(outDir, asset), { recursive: true });
  }
  return outDir;
}

// CLI entry: `node scripts/build-www.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildWww()
    .then((d) => console.log('built', d))
    .catch((e) => { console.error(e); process.exit(1); });
}
