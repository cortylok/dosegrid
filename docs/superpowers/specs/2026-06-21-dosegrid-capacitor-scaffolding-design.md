# DoseGrid Capacitor Scaffolding — Design

**Date:** 2026-06-21
**Status:** Approved (design); pending spec review
**Scope:** Wrap the existing static PWA into buildable native iOS + Android shells via Capacitor. **Out of scope** (separate specs): native in-app-purchase wiring (#3) and store submission. This is sub-project **#2 of 3** (after freemium gating, before native IAP).

## Summary

DoseGrid is currently a flat, build-step-free static PWA served from the repo root (GitHub Pages) with a `node --test` suite that imports `../js/…`. This sub-project adds Capacitor so the same web app can ship as native apps, mirroring the existing NEPT pipeline (Capacitor; iOS built via Xcode Cloud from Windows; Android `.aab` via Gradle). It deliberately does **not** add in-app purchases — the freemium gate already routes through the stubbed `js/pro.js` seam, which the later IAP spec replaces.

The guiding constraint: **don't disturb what works.** GitHub Pages (the test surface) and the test suite both depend on the current root layout, so the web app stays at root as the source of truth, and Capacitor consumes a generated `www/` copy.

## Locked decisions

1. **App name:** **DoseGrid** (kept). Store subtitle / tagline: **"Medication and pain diary."**
2. **Bundle identifier:** `com.cortylok.dosegrid` — iOS bundle ID and Android `applicationId`.
3. **IAP approach (built in #3, not here):** a native lightweight Capacitor IAP plugin (no third-party service).
4. **Web app stays at repo root** as source of truth; Capacitor's `webDir` is a generated `www/` (gitignored), assembled by a copy script. (Physically moving files into `www/` was rejected — it breaks the 8 test files' `../js/` imports and the Pages deploy.)
5. **Service worker is skipped on native** (`Capacitor.isNativePlatform()` guard) and kept for the web PWA.
6. **Pipeline parity with NEPT:** iOS via Xcode Cloud from Windows; Android `.aab` via Gradle.

## Architecture

```
repo root (source of truth — Pages + tests)
  index.html, css/, js/, medications.json, manifest.webmanifest,
  service-worker.js, icons/, tests/, docs/, README.md
        │  scripts/build-www.mjs  (copy runtime files)
        ▼
  www/  (generated, gitignored)  ──webDir──►  Capacitor  ──cap add──►  android/  ios/
```

### Components

**`package.json` (new — the repo's first)**
- `devDependencies`: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android` (and `@capacitor/assets` for icon generation).
- `scripts`:
  - `"test": "node --test"` (preserve the existing command)
  - `"build:www": "node scripts/build-www.mjs"`
  - `"sync": "npm run build:www && npx cap sync"`
- `"private": true`. No runtime dependencies (the web app remains dependency-free).

**`scripts/build-www.mjs` (new)**
- Pure Node (`fs`), no deps. Clears/creates `www/`, then copies the runtime asset set into it:
  `index.html`, `css/`, `js/`, `medications.json`, `manifest.webmanifest`, `service-worker.js`, `icons/`.
- Does **not** copy `tests/`, `docs/`, `node_modules/`, `android/`, `ios/`, dotfiles.
- Idempotent: safe to re-run; output is fully reproducible from root.

**`capacitor.config.json` (new)**
```json
{
  "appId": "com.cortylok.dosegrid",
  "appName": "DoseGrid",
  "webDir": "www"
}
```

**`js/app.js` (modify) — native service-worker guard**
- The SW registration block currently always runs. Wrap it so it only registers on the web:
  register only when **not** `window.Capacitor?.isNativePlatform?.()`. On native the assets are bundled (offline already works), and a network-first SW against the `capacitor://` scheme can misbehave.

**`.gitignore` (new or modify)**
- Ignore `node_modules/`, `www/`, and Capacitor/Xcode/Gradle build artifacts (`ios/App/Pods/`, `ios/App/build/`, `android/.gradle/`, `android/app/build/`, `*.xcuserstate`, etc.). The native project *sources* (`android/`, `ios/`) are committed; their build outputs are not.

**Native projects (generated)**
- `npx cap add android` → `android/` (Gradle project; `applicationId com.cortylok.dosegrid`).
- `npx cap add ios` → `ios/` (Xcode project; bundle id `com.cortylok.dosegrid`). On Windows the CocoaPods step may not complete locally — expected; Xcode Cloud resolves pods in CI, as with NEPT.

**Icons / splash**
- `@capacitor/assets` generates native icon sets from `icons/icon-512.png` (and a splash if a source is supplied). Committed into the native projects.

## Data flow / behaviour

- **Web (Pages, test surface):** unchanged — root files served directly; SW still registers; tests still run via `node --test` against `../js/…`.
- **Native build:** `npm run sync` regenerates `www/` from root and runs `cap sync` (copies `www/` into both native projects + updates native deps). Developer then opens the platform (Xcode Cloud for iOS; Gradle for Android) to build.
- **Runtime parity:** the native app loads the identical web app from its bundled copy; the freemium gate behaves the same (Pro still stubbed until #3). SW does not register on native.

## Testing / verification

- **`node --test`** still green (the scaffolding must not touch the existing suite; the only JS change is the SW guard in `app.js`, which has no unit test — verified by suite staying green + manual web check that the SW still registers in a browser).
- **`npm run build:www`** produces a `www/` containing exactly the runtime files and none of the excluded ones (spot-check the directory listing).
- **`npx cap sync`** completes without error and reports both `android` and `ios` platforms.
- **`npx cap doctor`** reports the Capacitor install is healthy.
- Confirm `android/app/build.gradle` shows `applicationId "com.cortylok.dosegrid"` and the iOS project's bundle id matches.
- Web smoke test: serve the root, confirm the app still loads and (in a browser) the service worker registers; confirm `www/index.html` is generated.

## Risks / notes

- **CocoaPods on Windows:** `cap add ios` / `cap sync`'s pod step may warn/fail locally — acceptable; the iOS build happens in Xcode Cloud. Document this so the executor doesn't treat it as a blocker.
- **Android SDK:** building the `.aab` needs `ANDROID_HOME` pointed at the local Android SDK (present for NEPT). Generating the `android/` project does not require a full build.
- **Repo size:** committing `android/` and `ios/` adds many files; build outputs are gitignored to keep it manageable.
- **Pages deploy:** unaffected — root layout is preserved. (The PWA remains the test surface and will be retired post-launch.)
- **Seam discipline preserved:** no IAP code here; `js/pro.js` remains the single integration point for #3.
