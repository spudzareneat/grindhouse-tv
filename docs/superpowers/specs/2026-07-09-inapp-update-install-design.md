# In-App Update Install — Design

*Brainstormed 2026-07-09. Phase 3 item from `docs/redesign-vision.md`.*

## Goal

Replace the "Get the update on GitHub ↗" link-out in Settings → Updates with a real
one-tap in-app download + install, so a TV user doesn't have to leave the app, find a
browser, download the APK, and navigate a file manager. Everything else about the
existing update checker (`web/src/update.js`: GitHub Releases API check, 6h cache,
settings-gear highlight/pulse) stays as-is — this only replaces what happens when the
user acts on "an update is available."

Each GitHub release carries exactly one asset, `grindhouse-v<version>.apk` (per the
release recap in `CLAUDE.md`), so there's no asset-picking ambiguity.

## Native layer (Kotlin)

### Manifest

- `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`
- A `FileProvider` entry, authority `${applicationId}.fileprovider`, backed by a new
  `res/xml/file_paths.xml` exposing a `cache-path` scoped to an `update/` subfolder of
  `cacheDir`. `androidx.core.ktx` is already a dependency, so `FileProvider` needs no new
  library.

### `CytubeJsBridge` — three new `@JavascriptInterface` methods

Thin wrappers delegating to `MainActivity`, matching the existing bridge style (e.g.
`openExternal`, `httpGet`):

- `canInstallUpdates(): Boolean` → `packageManager.canRequestPackageInstalls()`.
- `requestInstallPermission()` → launches
  `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` with `package:<applicationId>` — the
  one-time OS "allow installs from this source" toggle screen.
- `downloadAndInstallUpdate(reqId: String, url: String)` → same `Thread { ... }` +
  `evaluateJavascript` callback shape as `httpGet`, but streams the HTTP response body to
  `cacheDir/update/grindhouse-update.apk` (deleting any stale file first) instead of
  buffering a string. Emits progress ticks to a new
  `window.__scUpdateProgress(reqId, {phase, pct, error})` sink, where
  `phase` is `'downloading' | 'installing' | 'error'`, throttled to roughly every 3–5%
  or 250ms (whichever comes first) to avoid flooding `evaluateJavascript`. On a clean
  finish, immediately fires `ACTION_VIEW` on the `FileProvider` content URI
  (MIME `application/vnd.android.package-archive`, `FLAG_GRANT_READ_URI_PERMISSION`) and
  sends one final `phase:'installing'` tick.

There is no reliable way to observe the outcome of the system installer afterward — if
it's replacing the running app, the process may die mid-install — so native does not try
to report install success/failure. The flow is fire-and-forget once the installer intent
is launched.

## JS layer

### `web/src/update.js`

- When parsing the release JSON in `checkForUpdate`, also resolve
  `rel.assets.find(a => a.name.endsWith('.apk'))?.browser_download_url` and stash it as
  `_updateInfo.apkUrl` (persisted in the existing `sc_update_cache` localStorage blob
  alongside tag/notes/url).
- New export `downloadAndInstall(onProgress)`: wraps `CytubeNative.downloadAndInstallUpdate`
  in the same reqId-keyed callback pattern `native.js`'s `nativeHttpGet` uses, but calls
  `onProgress(tick)` on every tick instead of resolving once. Rejects if the native bridge
  or `_updateInfo.apkUrl` is unavailable.
- New exports `canInstallUpdates()` / `requestInstallPermission()` — direct passthroughs
  to the matching bridge methods (with a safe `false`/no-op fallback when
  `window.CytubeNative` is absent, e.g. during local dev in a plain browser).

### `web/src/settings.js` — Updates pane

Replace the current single "Get the update on GitHub ↗" button with a small state
machine driving one primary button + a slim progress bar:

| State | Trigger | UI |
|---|---|---|
| Permission not granted | `!canInstallUpdates()`, re-checked every time the Updates tab is shown | Primary button: "Allow installs from Grindhouse →" → `requestInstallPermission()` |
| Ready | update available, permission granted | Primary button: "Update Now" (append the asset size if GitHub's API exposes it, e.g. "Update Now (9.5 MB)") → starts `downloadAndInstall` |
| Downloading | in progress | Button disabled; new `.sc-update-progress` bar element (styled like the existing now-playing progress-card bar) fills 0→100%; status text "Downloading… NN%" |
| Installing | download finished, installer intent fired | Status text "Opening installer…" — terminal state, no further polling |
| Error | download failed | Status text "Download failed — check connection"; button reverts to "Update Now" (retry = tap again) |

A small secondary text link "View release on GitHub ↗" stays next to the release notes
(reusing the existing `GH_RELEASES_PAGE`/`info.url`) for transparency and as a manual
fallback if in-app install ever fails on a particular device.

`checkForUpdate`, the 6h cache, and the settings-gear highlight/pulse are untouched.

## Edge cases

- **Debug builds:** GitHub releases only ever contain the release-signed APK
  (`com.grindhouse.cytube`). Installing it from a debug build (`com.grindhouse.cytube.debug`)
  installs it as a separate app alongside the debug build rather than "updating" the
  debug install — consistent with the project's existing documented debug/release
  side-by-side design. This is a pre-existing quirk of the update *checker* (which
  already flags debug builds as outdated) and isn't new risk introduced here; no special
  gating added.
- **Permission screen re-entry:** the OS toggle is a separate Activity; the app isn't
  notified when the user returns. Handled by re-checking `canInstallUpdates()` each time
  the Updates tab is opened rather than trying to catch an activity result.
- **Partial/stale downloads:** any existing file at `cacheDir/update/grindhouse-update.apk`
  is deleted before a new download starts, so a previous failed attempt can't corrupt a
  retry.
- **GitHub API asset shape changes:** if no asset ends in `.apk` (malformed or manual
  release), `_updateInfo.apkUrl` is `undefined` and `downloadAndInstall` rejects
  immediately — the UI falls back to the error state, and "View release on GitHub ↗"
  remains available as a manual path.

## Testing plan

- Manual device verification only (per project convention — this touches native
  download/install/permission flows that don't have meaningful unit-test surface).
- Verify on both a phone/tablet and the TV box:
  1. Fresh install with an older `versionCode`, confirm "Update available" appears and
     `apkUrl` resolves.
  2. First-time permission flow: tap "Update Now" while ungranted → confirm it shows
     "Allow installs from Grindhouse →" → confirm `ACTION_MANAGE_UNKNOWN_APP_SOURCES`
     opens and the toggle sticks after returning.
  3. Full download → progress bar reaches 100% → installer launches → complete the
     install → confirm the new version launches cleanly.
  4. Airplane-mode mid-download → confirm the error state renders and retry works.
  5. D-pad reachability of every new button/state on TV (the Updates tab is inside the
     existing tabbed settings modal, which is already TV-nav wired).
