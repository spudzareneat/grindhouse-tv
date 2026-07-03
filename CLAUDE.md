# Grindhouse — internal working notes

Native **Android app for [CyTube](https://cytu.be)** — a `WebView` wrapper that loads a CyTube
channel and injects one big styling/behavior script. One app serves **phone** (portrait/landscape)
and **Android TV** (Leanback), branched at runtime via `_isTv` (JS) / `isTvDevice()` (native bridge).
User-facing overview is in `README.md`; this file is the operational/dev knowledge.

> These notes were migrated from another repo's assistant memory on 2026-06-14. Treat file:line
> claims as point-in-time — verify against current code before relying on them.

## Layout & key facts

- `applicationId` / `namespace`: **`com.grindhouse.cytube`** (debug variant suffix `.debug`, version
  suffix `-debug`, so debug + release install **side by side**). `minSdk 29`, `targetSdk 35`.
  Current: **versionCode 11 / versionName 2.0**.
- Kotlin sources live under `app/src/main/java/com/cytube/grindhouse/` — note the **directory does
  not mirror the namespace** (`com.grindhouse.cytube`); the `package` line is the source of truth.
  - `MainActivity.kt` — WebView setup, TV D-pad forwarding, Drive proxy wiring, external-open, PiP.
  - `CytubeJsBridge.kt` — the `@JavascriptInterface` object exposed to the page as **`CytubeNative`**.
  - `NoImeWebView.kt` — soft-keyboard suppression for physical-keyboard users.
  - `LocalMediaProxy.kt` — localhost HTTP server for Google Drive byte-range seeking (see below).
- The injected script: **`app/src/main/assets/cytube_mobile.js`** (~5k lines). Injected at
  `onPageFinished` via `evaluateJavascript`. This is where ~all UI/behavior lives. Edit the asset,
  rebuild, reinstall — no Kotlin change needed for JS-only tweaks.
- `isMinifyEnabled = false` **intentionally** (avoids R8 keep-rules for the `@JavascriptInterface`
  bridge). Don't enable it without adding keep rules.
- Git remote: `grindhouse-tv` on GitHub (`spudzareneat`), pushed via the `github-spudz` SSH host
  alias. APKs are **gitignored** — they live only on GitHub Releases. Keystore + `keystore.properties`
  are gitignored too.

## Build & run

No system Java is installed — command-line builds need `JAVA_HOME` pointed at Android Studio's JBR:

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"   # PowerShell: $env:JAVA_HOME = "..."
./gradlew assembleDebug      # or assembleRelease
```

- `adb` lives at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
- Outputs: `app/build/outputs/apk/{debug,release}/`. Gradle always names the release `app-release.apk`.
- Debug- and release-signed APKs **can't update over each other** (different signatures) — but they
  use different package ids (`.debug` suffix), so both can be installed at once.

## Release & signing

- Keystore: `grindhouse-release.keystore` (alias `grindhouse`, store/key password in the gitignored `keystore.properties`),
  referenced via gitignored `keystore.properties`. `build.gradle.kts` auto-signs release **when the
  props file exists**. **Back up the keystore privately** — losing it means no more signed updates.
- Release builds run `lintVitalRelease` (debug doesn't). Orientation-split drawables need a default
  copy in `drawable-nodpi/` or lint fails (`MissingDefaultResource`).
- **Filename convention:** the user wants the version in the APK name. After `assembleRelease`, copy
  `app-release.apk` → `grindhouse-v<versionName>.apk` before attaching. Don't try to rename via
  `build.gradle.kts` on this preview AGP (legacy `applicationVariants` API is risky) — just copy at
  release time.
- Art weight: splash/icon/banner JPEGs were downscaled (PowerShell `System.Drawing`) to
  1920×1072 / 1080×1920 splashes, 512×512 icon, 960×536 banner → APK **22.7 → 9.5 MB**. Keep them
  small on future art swaps.
- Release recap: bump `versionCode`/`versionName` → `assembleRelease` → copy to `grindhouse-v<ver>.apk`
  → commit + push (author is the noreply email, keep it anonymous) →
  `gh release create v<ver> grindhouse-v<ver>.apk --notes-file ...`.
- `gh` CLI is at `C:\Program Files\GitHub CLI\gh.exe` (not on PATH), authed as `spudzareneat`.

## Solved problem: Google Drive playback (shipped v1.4, seek fix v1.5)

CyTube plays Google Drive items but needs a privileged cross-origin fetch normally supplied by a
Tampermonkey userscript. **Root cause of the original 403:** Google binds each `videoplayback` stream
URL to the **User-Agent that requested `get_video_info`** (the `eaua` URL param). The device was
fetching `get_video_info` with the default **Dalvik** UA, poisoning every stream URL.

Fix (both parts required):
1. `cytube_mobile.js` `initGoogleDrive` passes `'User-Agent': navigator.userAgent` to the
   `get_video_info` fetch so the stream URL binds to the browser UA.
2. A **localhost HTTP media server** (`LocalMediaProxy.kt`, `ServerSocket` on 127.0.0.1) that the
   WebView does real byte-range seeking against — it caps open-ended ranges to 4 MB chunks (Google
   throttles open-ended ranges to ~playback rate but serves bounded ranges ~64× faster), uses the
   **clean browser UA**, follows the CDN redirect, and **sends no cookies**. The injected JS rewrites
   Drive stream URLs to `http://127.0.0.1:<port>/gd?u=<encoded url>` via `CytubeNative.gdProxyBase()`.
   127.0.0.1 is a Chromium secure context (no mixed-content block); cleartext scoped via
   `res/xml/network_security_config.xml`.

> v1.5 replaced an earlier `shouldInterceptRequest` proxy, which could only stream **linearly** —
> CyTube always seeks to the room's sync position, so a mid-movie join stalled forever.

**Dead ends — do NOT revisit:** IP binding (egress matched), cookies (sending them *causes* 403;
there's a `CookieManager(ACCEPT_NONE)` default), CORS, request-header tweaks, IPv6.

## Solved problem: YouTube DRM "Movies" titles (shipped fallback v1.4)

Some YouTube items fail in-app while playing fine in a desktop browser — these are **DRM-protected
"YouTube Movies"** (`author: "YouTube Movies"`). The YT player reports
`PLAYER.yt.getVideoData().errorCode === 'fmt.noneavailable'` with `isEncrypted: true`.

**Root cause:** the Android System WebView on TV boxes has **no Widevine CDM**
(`requestMediaKeySystemAccess('com.widevine.alpha')` → `NotSupportedError` at every level; ClearKey
works). Can't be fixed in the WebView — the CDM is a system library. The only engine that ships its
own Widevine is **GeckoView** (see `docs/GECKOVIEW_PORT_PLAN.md` — a full port was costed at ~1 week
and a ~10× larger APK, and **shelved**; circle back only if Movies titles become regular).

**Shipped workaround:** detect the failure (`checkYtDrm` in `cytube_mobile.js`) and show
`#sc-drm-overlay` with an "Open Grindhouse in Browser" button → `CytubeNative.openExternal` →
`MainActivity.openExternalUrl`, which opens the **channel page** in a Widevine-capable browser
(prefers `com.android.chrome` then `org.mozilla.firefox` via `setPackage`; manifest `<queries>` for
Android 14 visibility; avoids TV Bro = system WebView = no Widevine). The button is registered for the
remote as `MAIN_IDS[0]` in `initTvNav` (NOT an OVERLAY_ID — that would trap focus).

> Triage rule: if a "YouTube won't play" report comes in, first check `getVideoData().errorCode` /
> `isEncrypted` and whether it's a Movies title before assuming an app bug.

## IMDb data (no key, used by the now-playing card + trivia)

IMDb has no free official API and its HTML is bot-blocked, but the site's GraphQL endpoint
**`https://caching.graphql.imdb.com/`** is reachable with no login/cookies and **accepts arbitrary
queries** (not safelisted) — so we send our own and never depend on rotating persisted-query hashes.
Works over **GET** (reuses the native `httpGet` bridge — no CORS). Required headers:
`Content-Type: application/json`, `Accept: application/graphql+json, application/json`,
`x-imdb-client-name: imdb-web-next-localized`. `tconst` = TMDb `imdb_id` (e.g. `tt0468569`).

- Parent guide: `title(id:$id){ parentsGuide{ categories{ category{text} severity{text} } } }`
- Trivia: `title(id:$id){ trivia(first:30){ edges{ node{ text{ plainText } } } } }`

Data is "non-commercial use only" per IMDb's disclaimer — fine for this personal app. IMDb is **also
used by the sibling CyTube userscripts**; prototype query scripts (`imdb-*.mjs`, run with `node`) live
in the userscript repo at `C:\Repos\cytube_tv_interface_script\working\` — prove new queries there
before porting into the app.

## TV remote navigation (`initTvNav` in `cytube_mobile.js`)

Native `MainActivity.dispatchKeyEvent` forwards D-pad / OK / Back to `window.__scTvKey(dir)` **only
while the IME is down** (`imeUp` guard) — when the on-screen keyboard is up it navigates normally.
The JS keeps a focus ring (`.sc-tv-focus`) and moves spatially between candidates.

- `MAIN_IDS` = the default focus cluster (header buttons, chat). `OVERLAY_IDS` = focus-trapping
  overlays (settings, modal, trivia, users, poll, now-playing). A passive card should be in **neither**
  (it stays dismissable by Back via `closeTop()` without trapping).
- `_tvSetFocus` is exported from `initTvNav` so other UI (e.g. the settings modal) can hand the focus
  ring to a specific element instead of raw `.focus()` (which leaves `focusEl` stale).
- `/login` runs a separate self-contained `initLoginTvNav` (the channel UI/CSS doesn't load there).

### Recent TV-nav work (2026-06-14, in `cytube_mobile.js`, not yet released)
1. **Settings TMDB key → Right now lands on Test** — the enable-checkbox handler used raw `.focus()`,
   leaving `focusEl` on the checkbox; switched to `_tvSetFocus`.
2. **Coming Attractions reel is D-pad navigable** — `move()` special-cases the open `#sc-poster-strip`:
   Down from the toggle enters it, Left/Right page the posters (scroll + reuse the hover-zoom), Up/Down
   step back out to the toggle.
3. **Progress / time-remaining card** — `initProgressCard()` adds a `TIME` header button (and `p`
   shortcut) toggling `#sc-progress-card` (elapsed / total / −remaining bar, 0.5s refresh). Added to
   `MAIN_IDS`, dismissed by Back. Live playhead comes from CyTube's `mediaUpdate` socket event
   (`currentPlaybackTime`), so it works for YouTube/Drive/raw.

## On-device debug harness

Debug tooling lives in `tools/` (relocated here 2026-06-14). Debug pkg `com.grindhouse.cytube.debug`,
debug-only logging (`onConsoleMessage` → logcat tag `GrindhouseWeb`; `[DriveProxy]` lines are
`BuildConfig.DEBUG`-gated, so release is clean). Network tests must run from the local machine /
`curl.exe` (it shares the TV's public IP) — not a sandboxed shell whose egress IP wanders.

- `tools/cdp.mjs "<js>"` — eval JS in the WebView via Chrome DevTools Protocol (Node 22 built-in
  WebSocket).
- `tools/test_drive2.mjs <docid>` — calls on-device `getGoogleDriveMetadata` + plays the first link,
  prints `MediaError` (`{"ok":true,"ev":"loadeddata"}` = success). Known-good docid
  `1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3`.
- `tools/test-gd*.ps1` — curl probes from the local machine.

Relaunch + attach sequence (debug build, screen-off suspends the WebView via `onStop`):
```bash
adb shell input keyevent KEYCODE_WAKEUP
adb shell am start -n com.grindhouse.cytube.debug/com.grindhouse.cytube.MainActivity
# wait ~14s, then:
appPid=$(adb shell pidof com.grindhouse.cytube.debug)   # NOTE: in PowerShell $PID is read-only — use $appPid
adb forward tcp:9222 localabstract:webview_devtools_remote_$appPid
# if on a chrome-error page (suspended while off): wake+foreground, then
node tools/cdp.mjs "location.href='https://cytu.be/r/420Grindhouse'"
adb logcat -d -s GrindhouseWeb
```

Enable WebView inspection from desktop Chrome (`chrome://inspect`) is on in **debug builds only**
(`WebView.setWebContentsDebuggingEnabled(true)`).
