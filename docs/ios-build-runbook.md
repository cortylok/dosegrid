# DoseGrid — iOS build & upload runbook (rented Mac)

The iOS project (`ios/`) is already committed (Capacitor 8, **Swift Package Manager** — no CocoaPods). The Mac only has to **build, sign, and upload** it. With an App Store Connect API key this runs almost entirely from the command line, so a Claude Code instance on the Mac can drive it.

> **Requirements (confirmed June 2026):** Xcode **26+**, Node **22+**, iOS target 15, SPM. Rent a Mac with **macOS 26 (Tahoe) + Xcode 26 pre‑installed** to skip the multi‑hour Xcode download.

## Part 0 — One-time, web only (you, not the Mac)
1. Apple Developer Program active; **Paid Apps** agreement signed (tax + banking).
2. Create the app record for **`com.cortylok.dosegrid`** in App Store Connect.
3. Create the **`dosegrid_pro`** non‑consumable IAP (set price; add a Sandbox tester).
4. **App Store Connect API key**: *Users and Access → Integrations → App Store Connect API → +*, role **App Manager**. Download the **`.p8`** and note **Key ID**, **Issuer ID**, **Team ID**. (This lets the Mac upload headlessly.)

## Part 1 — Provision the rented Mac (Terminal)
```bash
xcode-select --install 2>/dev/null; sudo xcodebuild -license accept
xcodebuild -version            # must be 26.x — else install Xcode 26 from the App Store
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"   # if no Homebrew
brew install node@22 && node -v   # v22+
curl -fsSL https://claude.ai/install.sh | bash && claude --version   # Claude Code (native installer)
mkdir -p ~/asc && mv ~/Downloads/AuthKey_*.p8 ~/asc/    # put the API key here
claude          # then log in via the browser prompt
```

## Part 2 — Prompt for the Mac's Claude (fill in the 3 IDs)
> You're on macOS to build, sign, and upload the **iOS** app for **DoseGrid** — a Capacitor 8 app whose iOS project uses Swift Package Manager. Do everything from the command line; only ask me to use a GUI/website if genuinely impossible from the CLI.
>
> **Facts**
> - Public repo: `https://github.com/cortylok/dosegrid`
> - iOS bundle id `com.cortylok.dosegrid` · app DoseGrid · workspace `ios/App/App.xcworkspace` · scheme `App`
> - API key `~/asc/AuthKey_<KEYID>.p8` · Key ID `<KEYID>` · Issuer ID `<ISSUER>` · Team ID `<TEAMID>`
> - First release: marketing version `1.0`, build `1`
> - One‑time IAP `dosegrid_pro` (already in App Store Connect); app uses `@capgo/native-purchases`; StoreKit needs no special entitlement change — just confirm the archive builds.
>
> **Do this**
> 1. Verify `xcodebuild -version` (need 26+) and `node -v` (need 22+). If wrong, stop and tell me.
> 2. `git clone` the repo, `cd dosegrid`, `npm ci` (fall back to `npm install`).
> 3. `npm run sync`.
> 4. Set the App target `MARKETING_VERSION=1.0`, `CURRENT_PROJECT_VERSION=1` (agvtool or xcconfig/pbxproj).
> 5. Archive with automatic signing via the API key:
>    `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/App.xcarchive archive -allowProvisioningUpdates -authenticationKeyPath ~/asc/AuthKey_<KEYID>.p8 -authenticationKeyID <KEYID> -authenticationKeyIssuerID <ISSUER>`
> 6. Write `ExportOptions.plist` (`method`=`app-store-connect`, `destination`=`upload`, `teamID`=`<TEAMID>`, `signingStyle`=`automatic`) and export+upload:
>    `xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates -authenticationKeyPath ~/asc/AuthKey_<KEYID>.p8 -authenticationKeyID <KEYID> -authenticationKeyIssuerID <ISSUER>`
> 7. Confirm the build reaches App Store Connect / TestFlight; report the build number and any signing/capability errors verbatim.
>
> If headless automatic signing fails (sometimes needs the Apple ID added once in **Xcode ▸ Settings ▸ Accounts**), tell me the exact clicks, wait, then resume from the archive step. When it's on TestFlight, remind me to attach `dosegrid_pro` to the version and sandbox‑test purchase + Restore on a real iPhone.

## Caveats
- Automatic signing via API key is usually fully headless; the **first** time Xcode may want the Apple ID added once in its Accounts pane (a GUI click).
- The **IAP purchase can only be verified on a real iPhone** (sandbox) — not in any CLI/simulator reliably.
- Future updates: bump `MARKETING_VERSION` / build number each upload (must exceed the last released).
