# Firefox Mobile (Android) Debug + Install Guide

_Last verified: March 6, 2026._

This branch adds a mobile-oriented variant of the add-on for Firefox on Android.

## What changed for mobile compatibility

- Added `browser_specific_settings.gecko_android` in `manifest.json`.
- Added `browser_specific_settings.gecko.data_collection_permissions.required=["none"]` for current AMO submission requirements.
- Replaced broad permissions with focused `host_permissions` for Wikipedia + Wikidata.
- Added mobile runtime throttling in `go.js`:
  - smaller request bins,
  - lower API concurrency,
  - debug headline logs disabled by default.

## 1) Debug on phone (recommended workflow)

Official docs:
- Firefox Android extension development: https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
- `web-ext` command reference: https://extensionworkshop.com/documentation/develop/web-ext-command-reference/
- Remote debugging (`about:debugging`): https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html

### Prerequisites

1. Android phone with Firefox Nightly installed.
2. USB debugging enabled on Android (Developer options).
3. On your computer:
   - Node.js + `web-ext`
   - Android platform tools (`adb`)

Install tooling:

```powershell
npm install --global web-ext
```

### Run the extension on Android from your dev machine

1. Connect phone over USB.
2. Verify device visibility:

```powershell
adb devices
```

3. Start Firefox Nightly on phone.
4. From this repo folder, run:

```powershell
web-ext run --target=firefox-android --firefox-apk org.mozilla.fenix
```

If you have multiple devices attached, add the device id:

```powershell
web-ext run --target=firefox-android --firefox-apk org.mozilla.fenix --android-device <device-id>
```

### Inspect/debug from desktop Firefox

1. Open desktop Firefox and go to `about:debugging#/setup`.
2. Enable USB device discovery.
3. Authorize the computer on your phone when prompted.
4. Open the connected Android runtime, then inspect the Wikipedia tab where the extension is active.

## 2) Install permanently when you are satisfied

Official docs:
- Signing and distribution overview: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- Self-distribution install flows: https://extensionworkshop.com/documentation/publish/install-self-distributed-add-ons/

### Important

Firefox add-ons must be signed for persistent installation.

### Package your add-on

From repo root:

```powershell
if (Test-Path .\dist) { Remove-Item .\dist -Recurse -Force }
New-Item -ItemType Directory -Path .\dist | Out-Null
Compress-Archive -Path .\manifest.json, .\go.js -DestinationPath .\dist\wikipedia-hyperlink-colorchanger.zip -Force
Rename-Item .\dist\wikipedia-hyperlink-colorchanger.zip wikipedia-hyperlink-colorchanger.xpi -Force
```

### Signing options

1. Listed on AMO: public listing in addons.mozilla.org.
2. Unlisted on AMO: signed private distribution (direct `.xpi` link/hosting).

### Android install paths

1. Personal/test install path (common):
   - Upload signed add-on to AMO.
   - Put it in your AMO custom add-on collection.
   - In Firefox Nightly on Android, enable custom add-on collection and install.
2. Public release path:
   - Publish listed on AMO so users install from addons.mozilla.org.

## 3) Quick verification checklist on phone

1. Open any Wikipedia article.
2. Confirm links are underlined with tier colors.
3. Confirm current-page/self links are not underlined.
4. Confirm article headline shows colored border.
5. Open several long articles and verify no hangs or major delays.
