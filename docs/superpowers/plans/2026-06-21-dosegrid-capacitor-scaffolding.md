# DoseGrid Capacitor Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing static DoseGrid PWA into buildable native iOS + Android shells via Capacitor, without disturbing the GitHub Pages deploy or the `node --test` suite.

**Architecture:** The web app stays at repo root (source of truth for Pages + tests). A small Node copy script assembles a generated `www/` that Capacitor uses as its `webDir`. `npx cap add` generates committed `android/` and `ios/` projects (build outputs gitignored). The service worker is skipped on native.

**Tech Stack:** Capacitor 6+ (`@capacitor/core`, `cli`, `ios`, `android`, `assets`), Node (ESM), Gradle (Android), Xcode Cloud (iOS, from Windows — same as the NEPT app).

**Spec:** `docs/superpowers/specs/2026-06-21-dosegrid-capacitor-scaffolding-design.md`

---

## File Structure

- **Create** `package.json` — first one; `type: module`, scripts (`test`, `build:www`, `sync`), Capacitor devDeps.
- **Create** `scripts/build-www.mjs` — copies runtime assets from root into the generated `www/`.
- **Create** `tests/build-www.test.js` — verifies the copy includes runtime files and excludes the rest.
- **Create** `capacitor.config.json` — appId/appName/webDir.
- **Create** `.gitignore` — ignore `node_modules/`, `www/`, native build outputs.
- **Create** `assets/icon.png` — source for native icon generation (from existing `icons/icon-512.png`).
- **Modify** `js/app.js` — skip service-worker registration on native.
- **Modify** `README.md` — add a "Building the native apps" section.
- **Generated (committed)** `android/`, `ios/` — native projects.

---

### Task 1: package.json + Capacitor dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dosegrid",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "DoseGrid — Medication and pain diary",
  "scripts": {
    "test": "node --test",
    "build:www": "node scripts/build-www.mjs",
    "sync": "npm run build:www && npx cap sync"
  }
}
```

- [ ] **Step 2: Verify the test suite still passes with package.json present**

Run: `node --test`
Expected: PASS — 56 tests, 0 fail. (Confirms `"type": "module"` keeps the ESM test files working.)

- [ ] **Step 3: Install Capacitor dev dependencies**

Run: `npm install -D @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/assets`
Expected: installs without error; `package.json` now has a `devDependencies` block; `package-lock.json` and `node_modules/` are created.

- [ ] **Step 4: Verify the Capacitor CLI is available**

Run: `npx cap --version`
Expected: prints a version number (e.g. `6.x.x` or `7.x.x`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add package.json and Capacitor dev dependencies"
```

---

### Task 2: `build-www.mjs` copy script (TDD)

**Files:**
- Create: `scripts/build-www.mjs`
- Test: `tests/build-www.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-www.test.js`
Expected: FAIL — cannot import `../scripts/build-www.mjs` (module not found).

- [ ] **Step 3: Write the implementation**

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/build-www.test.js`
Expected: PASS — 1 test.

- [ ] **Step 5: Verify the CLI produces a real `www/`**

Run: `npm run build:www && ls www`
Expected: prints `built …/www` then lists `css  icons  index.html  js  manifest.webmanifest  medications.json  service-worker.js` (no `tests`, `docs`, `node_modules`).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-www.mjs tests/build-www.test.js
git commit -m "build: add build-www script to stage web assets for Capacitor"
```

---

### Task 3: Capacitor config

**Files:**
- Create: `capacitor.config.json`

- [ ] **Step 1: Create `capacitor.config.json`**

```json
{
  "appId": "com.cortylok.dosegrid",
  "appName": "DoseGrid",
  "webDir": "www"
}
```

- [ ] **Step 2: Verify Capacitor reads the config**

Run: `npx cap config --json`
Expected: JSON output that includes `"appId": "com.cortylok.dosegrid"` and `"webDir": "www"` (the command prints the resolved Capacitor config).

- [ ] **Step 3: Commit**

```bash
git add capacitor.config.json
git commit -m "build: add capacitor.config.json (com.cortylok.dosegrid)"
```

---

### Task 4: .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Node / Capacitor
node_modules/
www/

# iOS build artifacts (project sources ARE committed)
ios/App/Pods/
ios/App/build/
ios/App/output/
ios/App/App/public/
*.xcuserstate
DerivedData/

# Android build artifacts (project sources ARE committed)
android/.gradle/
android/app/build/
android/build/
android/local.properties
android/app/src/main/assets/public/
android/capacitor-cordova-android-plugins/

# misc
.DS_Store
```

- [ ] **Step 2: Verify the ignores resolve before native projects exist**

Run: `git check-ignore -v node_modules www || echo "note: paths ignored once present"`
Expected: prints matching `.gitignore` rules for `node_modules` and `www` (both currently exist), confirming they won't be committed.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "build: gitignore node_modules, generated www, native build outputs"
```

---

### Task 5: Skip the service worker on native

**Files:**
- Modify: `js/app.js` (the service-worker registration block at the bottom)

- [ ] **Step 1: Replace the service-worker registration block**

Find this block at the end of `js/app.js`:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
```

Replace it with:

```javascript
// Register the service worker on the web only. In a Capacitor native build the
// app is bundled locally (offline already works), and a network-first SW against
// the capacitor:// scheme can misbehave, so we skip it there.
const isNativePlatform = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
if (!isNativePlatform && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
```

- [ ] **Step 2: Verify syntax and that the suite still passes**

Run: `node --check js/app.js && node --test`
Expected: no syntax error; 57 tests pass (56 prior + 1 build-www test), 0 fail.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(app): skip service-worker registration on native platforms"
```

---

### Task 6: Add the Android platform

**Files:**
- Generated: `android/`

- [ ] **Step 1: Ensure `www/` is fresh, then add Android**

Run: `npm run build:www && npx cap add android`
Expected: Capacitor creates `android/` and reports "add in X ms" / "sync in X ms". (Requires internet to fetch the Android platform package; Java is already installed.)

- [ ] **Step 2: Verify the applicationId**

Run: `grep -R "applicationId" android/app/build.gradle`
Expected: a line `applicationId "com.cortylok.dosegrid"`.

- [ ] **Step 3: Confirm build outputs are ignored, sources are staged**

Run: `git status --porcelain android | grep -E "android/(\.gradle|app/build)/" || echo "build outputs correctly ignored"`
Expected: prints `build outputs correctly ignored` (only source files appear under `android/`, not `.gradle/` or `app/build/`).

- [ ] **Step 4: Commit the Android project**

```bash
git add android
git commit -m "build(android): add Capacitor Android project"
```

---

### Task 7: Add the iOS platform

**Files:**
- Generated: `ios/`

- [ ] **Step 1: Add iOS**

Run: `npx cap add ios`
Expected: Capacitor creates `ios/`. **Note:** on Windows the CocoaPods (`pod install`) step will warn or fail ("pod: command not found" or skipped) — this is expected and not a blocker; pods are resolved in Xcode Cloud (same pipeline as the NEPT app). The `ios/` project files are still generated.

- [ ] **Step 2: Verify the iOS project exists and has the bundle id**

Run: `grep -R "com.cortylok.dosegrid" ios/App/App.xcodeproj/project.pbxproj | head -1`
Expected: at least one match showing `PRODUCT_BUNDLE_IDENTIFIER = com.cortylok.dosegrid;`.

- [ ] **Step 3: Commit the iOS project**

```bash
git add ios
git commit -m "build(ios): add Capacitor iOS project (pods resolved in Xcode Cloud)"
```

---

### Task 8: Generate native app icons

**Files:**
- Create: `assets/icon.png`
- Generated (committed): icon assets under `android/` and `ios/`

- [ ] **Step 1: Create the icon source folder from the existing app icon**

Run: `mkdir -p assets && cp icons/icon-512.png assets/icon.png`
Expected: `assets/icon.png` exists (copied from the existing 512×512 app icon).

- [ ] **Step 2: Generate native icon sets**

Run: `npx @capacitor/assets generate --assetPath assets`
Expected: the tool writes icon sets into the iOS and Android projects and prints a summary. **Note:** it may warn that the source should be ≥1024×1024; it still generates from the 512 source. If it errors hard on size, replace `assets/icon.png` with a 1024×1024 export of the logo and re-run — that is the only fix needed.

- [ ] **Step 3: Commit the icons**

```bash
git add assets android ios
git commit -m "build: generate native app icons from icons/icon-512.png"
```

---

### Task 9: Sync, health-check, document, and final verify

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run a full sync**

Run: `npm run sync`
Expected: `build:www` runs, then `cap sync` reports updating both `android` and `ios` with no errors (CocoaPods warning on Windows is acceptable, per Task 7).

- [ ] **Step 2: Capacitor health check**

Run: `npx cap doctor`
Expected: reports Capacitor core/CLI versions and lists `android` and `ios` as installed platforms; no critical errors (a CocoaPods note on Windows is acceptable).

- [ ] **Step 3: Add a "Building the native apps" section to `README.md`**

Append to `README.md`:

```markdown
## Building the native apps (Capacitor)

DoseGrid also ships as native iOS + Android apps via [Capacitor](https://capacitorjs.com/). The web app at the repo root is the source of truth; `www/` is generated.

```bash
npm install            # one-time: install Capacitor tooling
npm run sync           # rebuild www/ and copy it into the native projects
npx cap open android   # open in Android Studio → build .aab
npx cap open ios       # open in Xcode (iOS builds via Xcode Cloud from Windows)
```

- **App id:** `com.cortylok.dosegrid` · **Name:** DoseGrid · **Tagline:** Medication and pain diary
- iOS pods are resolved in Xcode Cloud (no local CocoaPods needed on Windows).
- Android `.aab` builds with Gradle (point `ANDROID_HOME` at your Android SDK).
- In-app purchases (Pro unlock) are wired in a later step; the entitlement seam is `js/pro.js`.
```

- [ ] **Step 4: Final verification**

Run: `node --test`
Expected: PASS — 57 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document building the native apps with Capacitor"
```

---

## Self-Review

**Spec coverage:**
- Web stays at root; generated `www/` via copy script → Tasks 1 (script wiring), 2 (`build-www.mjs`). ✓
- `package.json` + Capacitor devDeps (incl. `@capacitor/assets`) → Task 1. ✓
- `capacitor.config.json` (appId/appName/webDir) → Task 3. ✓
- `.gitignore` (node_modules, www, native build outputs; commit native sources) → Task 4. ✓
- Native SW guard in `app.js` → Task 5. ✓
- `cap add android` / `cap add ios` (committed projects) → Tasks 6, 7. ✓
- Icons via `@capacitor/assets` from `icons/icon-512.png` → Task 8. ✓
- `cap sync` + `cap doctor` verification + README → Task 9. ✓
- CocoaPods-on-Windows and Android SDK caveats documented → Tasks 7, 9 + README. ✓
- Out of scope (IAP, store submission) → not in any task, by design. ✓

**Placeholder scan:** No TBD/TODO. The icon size note (Task 8) is a real operational instruction with an exact fix, not a placeholder.

**Type/name consistency:** `buildWww(outDir)` defined in Task 2 and invoked by the `build:www`/`sync` scripts (Task 1) and the test (Task 2); `webDir: "www"` consistent across config + script output; appId `com.cortylok.dosegrid` consistent across config, Android (`applicationId`), iOS (`PRODUCT_BUNDLE_IDENTIFIER`), and README.

**Note for executor:** Tasks 6–8 require internet (Capacitor platform packages) and a working `npx cap`. The CocoaPods warning on Windows in Tasks 7/9 is expected — do **not** treat it as BLOCKED. Test count is 57 from Task 2 onward (56 existing + the new `build-www` test).

---

## Roadmap (context, not part of this plan)

- **#3 — Native IAP wiring:** replace the `purchasePro`/`restorePurchases` stubs in `js/pro.js` with a native lightweight Capacitor IAP plugin; create the store products. Own spec + plan.
- **#4 — Dose notifications:** opt-in local notifications via `@capacitor/local-notifications` — PRN "you can take another now" when the interval elapses, and scheduled-med reminders. Own spec + plan (native capability; builds on this shell).
