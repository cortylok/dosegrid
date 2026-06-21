# DoseGrid — Android build & upload runbook (no Mac needed)

The Android project (`android/`) is committed (Capacitor 8, Gradle). Android builds entirely on Windows/Linux/Mac — **no Mac required**. You produce a signed `.aab` and upload it to the Play Console.

> **Requirements:** JDK **17+** (Android Studio bundles one), Android SDK (Android Studio or cmdline‑tools), Node **22+**. Java 21 + Android Studio are already on the dev machine.

## Part 0 — One-time, web only (Play Console)
1. Google Play Console developer account (one‑off fee paid).
2. Create the app; create the **`dosegrid_pro`** one‑time in‑app product (set price; activate); add a **license tester**.
3. Set up an internal/closed **test track**.

## Part 1 — Keystore (you own this — DO NOT LOSE IT)
The release keystore signs every update; losing it means you can't update the app. Reuse your existing keystore if you have one, or create one:
```bash
keytool -genkey -v -keystore dosegrid-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias dosegrid
```
Store it safely (e.g. a password manager / backup). Then create `android/key.properties` (gitignored — do NOT commit):
```
storeFile=../../dosegrid-release.jks
storePassword=********
keyAlias=dosegrid
keyPassword=********
```
…and wire it into `android/app/build.gradle` `signingConfigs`/`buildTypes.release` if not already (Capacitor's template may need this added once).

## Part 2 — Build the signed `.aab`
```bash
npm ci
npm run sync
cd android && ./gradlew bundleRelease      # Windows: gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
Or in Android Studio: **Build ▸ Generate Signed App Bundle ▸ Android App Bundle**.

## Part 3 — Upload
Upload `app-release.aab` to your Play Console test track → roll out → promote to production when ready.

## Versioning
Bump `versionCode` (integer, must increase) and `versionName` in `android/app/build.gradle` each release.

## Prompt for a Claude instance to do the build (after you've placed the keystore + key.properties)
> Build the signed Android release bundle for DoseGrid (Capacitor 8). Verify `node -v` (22+) and `java -version` (17+) and that `ANDROID_HOME` points at the Android SDK. Run `npm ci`, `npm run sync`, then `cd android && ./gradlew bundleRelease` (use `gradlew.bat` on Windows). The signing keystore is configured via `android/key.properties` (already in place). Report the path to the generated `.aab` and any Gradle/signing errors verbatim. Do NOT create a new keystore or commit `key.properties`/the `.jks`.
