# Remove In-App Update Install — Design

*Brainstormed 2026-07-29. Reverts the native layer of
[2026-07-09-inapp-update-install-design.md](2026-07-09-inapp-update-install-design.md).*

## Goal

Stop the app from downloading and self-installing update APKs. Confirmed live on the TV
box (onn Streaming Device 4K pro) 2026-07-29: `adb install`ing a freshly built release
APK got rejected by Google Play Protect's on-device verifier (Finsky), and logcat traced
it to the `REQUEST_INSTALL_PACKAGES` permission plus the app's own `ACTION_VIEW` intent
on a downloaded `.apk` file (`MainActivity.installApk`) — a permission/behavior
combination ("unknown-developer app that downloads and installs executable code on its
own") that on-device heuristic scanners are specifically built to flag, independent of
anything actually wrong with the code. Removing the capability removes the signal.

Update *detection* is unaffected and stays exactly as it was before the 2026-07-09
feature: `web/src/update.js`'s `checkForUpdate` (GitHub Releases API, 6h cache,
settings-gear highlight/pulse) keeps running. The only thing that changes is what happens
when the user acts on "an update is available" — instead of an in-app download+install
button, the existing "View release on GitHub ↗" link (already wired to
`CytubeNative.openExternal`) becomes the sole path, opening the release page in the
device's default browser so the user downloads and taps the APK through the normal
on-device installer flow.

## Removals

### `AndroidManifest.xml`
- `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`
- The `FileProvider` `<provider>` block (authority `${applicationId}.fileprovider`) — its
  only consumer was `installApk`.

### `app/src/main/res/xml/file_paths.xml`
- Delete the file. Its only `<cache-path>` entry (`update/`) backed the FileProvider above.

### `app/.../MainActivity.kt`
- `canInstallUpdates()`, `requestInstallPermission()`, `installApk()`.

### `app/.../CytubeJsBridge.kt`
- `canInstallUpdates()`, `requestInstallPermission()`, `downloadAndInstallUpdate()`
  (`@JavascriptInterface` methods).
- `HttpURLConnection`/`URL` imports stay — also used by the unrelated `httpGet` bridge
  method.

### `web/src/native.js`
- The whole "APP UPDATE INSTALL" block: `canInstallUpdates()`, `requestInstallPermission()`,
  `nativeDownloadAndInstall()`, the `window.__scUpdateProgress` sink and its `_scUpdateCbs`
  map.

### `web/src/settings.js`
- Import of `canInstallUpdates, requestInstallPermission, nativeDownloadAndInstall` from
  `native.js`.
- Markup: the `#sc-update-action` button (`"Update Now"` / `"Allow installs from
  Grindhouse →"`) and `#sc-update-progress-wrap`/`#sc-update-progress-fill`.
- `wireUpdateSection()`'s `phase` state machine, `renderAction()`, the `actionBtn` click
  handler, and the `window.__scAppResumed` registration (it existed only to re-check
  install permission when the OS "allow installs" screen returned focus — with that
  screen gone, nothing needs it). `MainActivity.kt`'s generic
  `window.__scAppResumed && window.__scAppResumed();` resume hook itself is left in place
  since it's a general-purpose mechanism, not update-specific — it just becomes a no-op
  until something else registers it.
- `render()` keeps showing status text + release notes + the `ghLink` button when
  `info.available` is true — unchanged, since `ghLink` visibility was already independent
  of `actionBtn`.

### `web/src/styles/overlays.css`
- `#sc-update-action` and `.sc-update-progress-wrap`/`.sc-update-progress-fill` rules.
- `.sc-update-github-link`, `#sc-update-notes`, `#sc-update-status` rules stay (still used).

## What stays unchanged

- `web/src/update.js` in full: `checkForUpdate`, `_pickApkAsset` (harmless dead weight —
  `apkUrl`/`apkSize` are still parsed out of the release JSON and cached, just no longer
  consumed by anything; left alone rather than pulled to keep this change narrowly scoped
  to the actually-risky native install path), the 6h cache, settings-gear
  highlight/pulse.
- `checkBtn` ("Check now") and its handler.
- `ghLink` ("View release on GitHub ↗") and its handler — already calls
  `CytubeNative.openExternal(url)`, falling back to `window.open`.

## Build step

After the edits: `cd web && npm run bundle` to regenerate
`app/src/main/assets/cytube_mobile.js` (the injected script is a generated bundle, not
hand-edited — see its own banner comment). Also run `npm test` and `npm run lint` in
`web/` since existing tests may reference the removed exports (`canInstallUpdates`,
`requestInstallPermission`, `nativeDownloadAndInstall` and their Kotlin-bridge
counterparts, if any test doubles them).

## Testing plan

- Unit tests: fix/remove any that reference the deleted exports; `npm test` clean.
- `./gradlew assembleDebug` (or `assembleRelease` if doing a real release) compiles clean
  with the manifest/provider/Kotlin removals — a stale `FileProvider` reference or leftover
  permission use would be a build-time (not just runtime) error.
- Manual device check: open Settings → Updates with an older installed version — confirm
  "Update available" still appears, notes render, and only "View release on GitHub ↗" is
  offered (no "Update Now" button, no permission-request button, no progress bar). Tap it,
  confirm it opens the release page in the external browser.
- Not testing Play Protect's actual verdict on the next build — that's Google's opaque
  heuristic and can't be verified deterministically; the fix here is scoped to removing
  the specific permission/behavior pattern that's known to trigger it.
