# In-App Update Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Settings → Updates "Get the update on GitHub ↗" link-out with a real one-tap in-app download + install.

**Architecture:** Native side gets a manual-stream download (`CytubeJsBridge.downloadAndInstallUpdate`, mirroring the existing `httpGet` bridge method) that writes the APK to a cache file and auto-launches the system installer via a `FileProvider` URI. JS side resolves the release's APK asset URL/size in `update.js`, exposes reqId-callback wrappers in `native.js` (matching `nativeHttpGet`'s pattern), and drives a small state machine in `settings.js`'s Updates pane (permission-gate → download-progress-bar → installing → error/retry).

**Tech Stack:** Kotlin (native bridge, `HttpURLConnection`, `FileProvider`), vanilla JS + esbuild (`web/src/*.js`), `node:test` for the one pure-function unit test.

## Global Constraints

- `minSdk 29`, `targetSdk 35`. `applicationId` is `com.grindhouse.cytube` (release) / `com.grindhouse.cytube.debug` (debug) — use `${applicationId}` in manifest XML and `packageName` in Kotlin so the `FileProvider` authority tracks whichever variant is running.
- `isMinifyEnabled = false` — no new R8 keep rules needed for the new bridge methods.
- Kotlin build requires `JAVA_HOME` pointed at Android Studio's JBR: `export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` (PowerShell: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`).
- The bundle (`app/src/main/assets/cytube_mobile.js`) is a generated, committed file — never hand-edit it. Rebuild with `cd web && npm run bundle` after any `web/src/**` change, and commit the regenerated bundle alongside the source change.
- Never rename existing `window.__sc*` globals; this plan only adds a new one (`__scUpdateProgress`).
- This project has no Kotlin unit/instrumentation tests — native-side verification is a successful Gradle build plus the manual device pass in Task 5, per existing project convention (see `CLAUDE.md`'s on-device debug harness section).
- JS pure functions get `node:test` coverage under `web/test/*.test.mjs` (existing convention: `parse.test.mjs`, `usercolors.test.mjs`, etc.); thin bridge-passthrough wrappers (like the existing untested `nativeHttpGet`) are not unit tested — device testing covers them.

---

### Task 1: Native download + install plumbing (Kotlin)

**Files:**
- Modify: `app/src/main/AndroidManifest.xml`
- Create: `app/src/main/res/xml/file_paths.xml`
- Modify: `app/src/main/java/com/cytube/grindhouse/MainActivity.kt` (add methods after `openExternalUrl`, currently ending around line 498)
- Modify: `app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt` (add methods after `httpGet`)

**Interfaces:**
- Produces (consumed by Task 2's JS wrappers via the `CytubeNative` bridge object):
  - `CytubeNative.canInstallUpdates(): boolean`
  - `CytubeNative.requestInstallPermission(): void`
  - `CytubeNative.downloadAndInstallUpdate(reqId: string, url: string): void` — delivers progress via `window.__scUpdateProgress(reqId, {phase, pct, error})` where `phase` is `'downloading' | 'installing' | 'error'`.

This task has no automated test (Android manifest/permission/intent code isn't unit-testable in this project). Verification is a successful debug build.

- [ ] **Step 1: Add the install-packages permission**

In `app/src/main/AndroidManifest.xml`, right after the existing `POST_NOTIFICATIONS` permission line:

```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

- [ ] **Step 2: Declare the FileProvider**

In the same file, inside `<application>`, immediately after the existing `<meta-data android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME" .../>` block and before `<activity android:name=".MainActivity" ...>`:

```xml
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
```

- [ ] **Step 3: Create the FileProvider path config**

Create `app/src/main/res/xml/file_paths.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="update" path="update/" />
</paths>
```

This exposes `<cacheDir>/update/` (where Step 5's download writes the APK) as a shareable path named `update`.

- [ ] **Step 4: Add install-permission methods to `MainActivity.kt`**

In `app/src/main/java/com/cytube/grindhouse/MainActivity.kt`, insert immediately after the closing brace of `openExternalUrl` (the function ending at line 498, right before `tvBackground`):

```kotlin
    /** Whether this app is currently allowed to install other APKs (Android 8+ per-app "unknown sources"). */
    fun canInstallUpdates(): Boolean = packageManager.canRequestPackageInstalls()

    /** Open the system "Allow installs from this source" screen for this app — a one-time OS toggle. */
    fun requestInstallPermission() {
        try {
            startActivity(
                android.content.Intent(
                    android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    android.net.Uri.parse("package:$packageName")
                ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (e: Exception) { /* screen unavailable on this device — nothing else to do */ }
    }

    /** Launch the system package installer for a downloaded update APK via a FileProvider URI. */
    fun installApk(file: java.io.File) {
        try {
            val uri = androidx.core.content.FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            startActivity(
                android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            )
        } catch (e: Exception) { /* installer unavailable on this device — nothing else to do */ }
    }
```

- [ ] **Step 5: Add the three bridge methods to `CytubeJsBridge.kt`**

In `app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt`, insert after the closing brace of `httpGet` (the last method, before the final closing brace of the class):

```kotlin
    /** Whether the app currently has permission to install APKs — used by the in-app update flow. */
    @JavascriptInterface
    fun canInstallUpdates(): Boolean = activity.canInstallUpdates()

    /** Open the OS "allow installs from this source" screen — one-time grant, covers future updates too. */
    @JavascriptInterface
    fun requestInstallPermission() {
        activity.runOnUiThread { activity.requestInstallPermission() }
    }

    /**
     * Download the update APK to a cache file, reporting progress to JS, then launch the system
     * installer on success. Progress/result delivered via window.__scUpdateProgress(reqId, {...}).
     * There's no reliable way to observe the installer's own outcome afterward (installing over the
     * running app can kill this process mid-install), so this is fire-and-forget past that point.
     */
    @JavascriptInterface
    fun downloadAndInstallUpdate(reqId: String, url: String) {
        Thread {
            val dir = java.io.File(activity.cacheDir, "update").apply { mkdirs() }
            val file = java.io.File(dir, "grindhouse-update.apk")
            if (file.exists()) file.delete()

            fun post(phase: String, pct: Int, error: String?) {
                val payload = JSONObject()
                    .put("phase", phase)
                    .put("pct", pct)
                    .put("error", error ?: JSONObject.NULL)
                val js = "window.__scUpdateProgress && window.__scUpdateProgress(" +
                    "${JSONObject.quote(reqId)}, $payload)"
                activity.runOnUiThread { activity.evalJs(js) }
            }

            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 15000
                    instanceFollowRedirects = true
                }
                val total = conn.contentLengthLong
                var lastPct = -1
                var lastTick = 0L
                conn.inputStream.use { input ->
                    java.io.FileOutputStream(file).use { output ->
                        val buf = ByteArray(8192)
                        var downloaded = 0L
                        var n: Int
                        while (input.read(buf).also { n = it } >= 0) {
                            output.write(buf, 0, n)
                            downloaded += n
                            if (total > 0) {
                                val pct = ((downloaded * 100L) / total).toInt()
                                val now = android.os.SystemClock.elapsedRealtime()
                                if (pct != lastPct && (pct - lastPct >= 3 || now - lastTick >= 250)) {
                                    lastPct = pct; lastTick = now
                                    post("downloading", pct, null)
                                }
                            }
                        }
                    }
                }
                conn.disconnect()
                post("installing", 100, null)
                activity.runOnUiThread { activity.installApk(file) }
            } catch (e: Exception) {
                post("error", 0, e.message ?: "download failed")
            }
        }.start()
    }
```

- [ ] **Step 6: Verify the debug build compiles**

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/AndroidManifest.xml app/src/main/res/xml/file_paths.xml \
    app/src/main/java/com/cytube/grindhouse/MainActivity.kt \
    app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt
git commit -m "feat: native download+install plumbing for in-app updates"
```

---

### Task 2: JS bridge wrappers (`native.js`)

**Files:**
- Modify: `web/src/native.js`

**Interfaces:**
- Consumes: `CytubeNative.canInstallUpdates`, `CytubeNative.requestInstallPermission`, `CytubeNative.downloadAndInstallUpdate` (Task 1).
- Produces (consumed by Task 3/4):
  - `export function canInstallUpdates(): boolean`
  - `export function requestInstallPermission(): void`
  - `export function nativeDownloadAndInstall(url: string, onProgress: (tick: {phase, pct, error}) => void): Promise<{phase, pct, error}>` — resolves when `phase === 'installing'`, rejects when `phase === 'error'` or the bridge is unavailable.

No automated test for this task — these are thin bridge passthroughs with a `window.CytubeNative` presence check, matching the existing (also untested) `nativeHttpGet` in this same file.

- [ ] **Step 1: Add the progress-callback registry and the three exports**

In `web/src/native.js`, after the existing `nativeHttpGet` function, append:

```js
/* ==========================================================
   APP UPDATE INSTALL — download the release APK and launch the
   system installer. Progress arrives as repeated ticks (not a
   single resolve) via window.__scUpdateProgress.
========================================================== */
const _scUpdateCbs = {};
window.__scUpdateProgress = function (id, tick) {
    const cb = _scUpdateCbs[id];
    if (cb) cb(tick);
    if (tick && (tick.phase === 'installing' || tick.phase === 'error')) delete _scUpdateCbs[id];
};

export function canInstallUpdates() {
    try { return !!(window.CytubeNative && CytubeNative.canInstallUpdates && CytubeNative.canInstallUpdates()); }
    catch (e) { return false; }
}

export function requestInstallPermission() {
    try { if (window.CytubeNative && CytubeNative.requestInstallPermission) CytubeNative.requestInstallPermission(); }
    catch (e) {}
}

export function nativeDownloadAndInstall(url, onProgress) {
    return new Promise((resolve, reject) => {
        if (!(window.CytubeNative && typeof CytubeNative.downloadAndInstallUpdate === 'function')) {
            reject(new Error('native update install unavailable'));
            return;
        }
        const id = 'u' + Math.random().toString(36).slice(2);
        _scUpdateCbs[id] = (tick) => {
            if (onProgress) onProgress(tick);
            if (tick.phase === 'installing') resolve(tick);
            else if (tick.phase === 'error') reject(new Error(tick.error || 'download failed'));
        };
        try { CytubeNative.downloadAndInstallUpdate(id, url); }
        catch (e) { delete _scUpdateCbs[id]; reject(e); }
    });
}
```

- [ ] **Step 2: Lint and bundle**

```bash
cd web
npm run lint
npm run bundle
```

Expected: both succeed with no errors (the bundle step regenerates `app/src/main/assets/cytube_mobile.js`).

- [ ] **Step 3: Commit**

```bash
git add web/src/native.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: JS bridge wrappers for in-app update install"
```

---

### Task 3: Resolve the APK asset in `update.js` (TDD)

**Files:**
- Modify: `web/src/update.js`
- Create: `web/test/update.test.mjs`

**Interfaces:**
- Produces (consumed by Task 4):
  - `export function _pickApkAsset(assets: Array<{name: string, browser_download_url: string, size: number}>): {url: string, size: number|null} | null` — pure function, exported for the test and reused for readability.
  - `_updateInfo` (existing export) gains two fields: `apkUrl: string|null`, `apkSize: number|null`.

- [ ] **Step 1: Write the failing test**

Create `web/test/update.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { _pickApkAsset } from '../src/update.js';

test('picks the .apk asset out of a release asset list', () => {
    const assets = [
        { name: 'source.zip', browser_download_url: 'https://example.com/source.zip', size: 100 },
        { name: 'grindhouse-v2.6.apk', browser_download_url: 'https://example.com/grindhouse-v2.6.apk', size: 9961472 },
    ];
    assert.deepStrictEqual(_pickApkAsset(assets), {
        url: 'https://example.com/grindhouse-v2.6.apk',
        size: 9961472,
    });
});

test('returns null when there is no .apk asset', () => {
    assert.strictEqual(_pickApkAsset([{ name: 'notes.txt', browser_download_url: 'x', size: 1 }]), null);
});

test('handles missing/malformed assets array', () => {
    assert.strictEqual(_pickApkAsset(undefined), null);
    assert.strictEqual(_pickApkAsset([]), null);
});

test('handles a missing size field gracefully', () => {
    const assets = [{ name: 'grindhouse-v2.6.apk', browser_download_url: 'https://example.com/a.apk' }];
    assert.deepStrictEqual(_pickApkAsset(assets), { url: 'https://example.com/a.apk', size: null });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd web
node --test test/update.test.mjs
```

Expected: FAIL — `_pickApkAsset is not a function` (it isn't exported yet).

- [ ] **Step 3: Implement `_pickApkAsset` and wire it into `checkForUpdate`**

In `web/src/update.js`, add the pure function near the top (after the `_verNewer` helper):

```js
// Pick the release's installable APK out of its GitHub asset list (every Grindhouse
// release carries exactly one, named grindhouse-v<version>.apk — see CLAUDE.md's
// release recap). Returns null if no .apk asset is present.
export function _pickApkAsset(assets) {
    const list = Array.isArray(assets) ? assets : [];
    const found = list.find(a => a && typeof a.name === 'string' && a.name.endsWith('.apk'));
    if (!found) return null;
    return {
        url: found.browser_download_url || null,
        size: typeof found.size === 'number' ? found.size : null,
    };
}
```

Then update `checkForUpdate` to resolve and cache it. Replace:

```js
    const rel = JSON.parse(res.body || '{}');
    const tag = rel.tag_name || rel.name || '';
    const notes = rel.body || '';
    const url = rel.html_url || GH_RELEASES_PAGE;
    try { localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify({ ts: Date.now(), tag, notes, url })); } catch (e) {}
    _updateInfo = { available: _verNewer(tag, current), current, latest: tag, notes, url };
    _markUpdateAvailable(_updateInfo.available);
    return _updateInfo;
```

with:

```js
    const rel = JSON.parse(res.body || '{}');
    const tag = rel.tag_name || rel.name || '';
    const notes = rel.body || '';
    const url = rel.html_url || GH_RELEASES_PAGE;
    const apkAsset = _pickApkAsset(rel.assets);
    const apkUrl = apkAsset && apkAsset.url;
    const apkSize = apkAsset && apkAsset.size;
    try { localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify({ ts: Date.now(), tag, notes, url, apkUrl, apkSize })); } catch (e) {}
    _updateInfo = { available: _verNewer(tag, current), current, latest: tag, notes, url, apkUrl, apkSize };
    _markUpdateAvailable(_updateInfo.available);
    return _updateInfo;
```

And in the cached-read branch just above it, replace:

```js
            if (c && c.ts && (Date.now() - c.ts) < 6 * 3600 * 1000) {
                _updateInfo = { available: _verNewer(c.tag, current), current, latest: c.tag, notes: c.notes || '', url: c.url || GH_RELEASES_PAGE };
                _markUpdateAvailable(_updateInfo.available);
                return _updateInfo;
            }
```

with:

```js
            if (c && c.ts && (Date.now() - c.ts) < 6 * 3600 * 1000) {
                _updateInfo = {
                    available: _verNewer(c.tag, current), current, latest: c.tag, notes: c.notes || '',
                    url: c.url || GH_RELEASES_PAGE, apkUrl: c.apkUrl || null, apkSize: c.apkSize || null,
                };
                _markUpdateAvailable(_updateInfo.available);
                return _updateInfo;
            }
```

- [ ] **Step 4: Run the test again to verify it passes**

```bash
cd web
node --test test/update.test.mjs
```

Expected: PASS, all 4 assertions.

- [ ] **Step 5: Run the full test suite, lint, and bundle**

```bash
cd web
npm test
npm run lint
npm run bundle
```

Expected: all pass; bundle regenerates `app/src/main/assets/cytube_mobile.js`.

- [ ] **Step 6: Commit**

```bash
git add web/src/update.js web/test/update.test.mjs app/src/main/assets/cytube_mobile.js
git commit -m "feat: resolve release APK asset URL/size in the update checker"
```

---

### Task 4: Settings UI — permission gate, progress bar, install trigger

**Files:**
- Modify: `web/src/settings.js` (template around the `data-pane="updates"` block, currently ~line 597-609; `wireUpdateSection`, currently ~line 779-819; the `import` line pulling from `./update.js`, currently line 18)
- Modify: `web/src/styles/overlays.css` (the update-section rules, currently ~line 271-283)

**Interfaces:**
- Consumes: `canInstallUpdates`, `requestInstallPermission`, `nativeDownloadAndInstall` from `./native.js` (Task 2); `_updateInfo.apkUrl`/`_updateInfo.apkSize` from `./update.js` (Task 3).

No automated test — this is DOM/UI wiring verified by `npm run bundle` succeeding plus the manual device pass in Task 5.

- [ ] **Step 1: Import the new native.js helpers**

In `web/src/settings.js`, change line 17 from:

```js
import { nativeHttpGet } from './native.js';
```

to:

```js
import { nativeHttpGet, canInstallUpdates, requestInstallPermission, nativeDownloadAndInstall } from './native.js';
```

- [ ] **Step 2: Replace the Updates pane markup**

Replace the `data-pane="updates"` block (currently):

```html
                <div class="sc-settings-pane" data-pane="updates">
                    <div class="sc-settings-group" id="sc-update-group">
                        <label class="sc-settings-label">App Updates
                            <span class="sc-settings-note" id="sc-update-current">Installed: v${_appVersion() || '?'}</span>
                        </label>
                        <div id="sc-update-status" class="sc-settings-note">Checking for updates…</div>
                        <div id="sc-update-notes" class="sc-update-notes sc-hidden"></div>
                        <div class="sc-settings-input-row">
                            <button id="sc-update-check" class="sc-settings-test" type="button">Check now</button>
                        </div>
                        <button id="sc-update-download" class="sc-settings-btn-wide sc-hidden" type="button">Get the update on GitHub ↗</button>
                    </div>
                </div>
```

with:

```html
                <div class="sc-settings-pane" data-pane="updates">
                    <div class="sc-settings-group" id="sc-update-group">
                        <label class="sc-settings-label">App Updates
                            <span class="sc-settings-note" id="sc-update-current">Installed: v${_appVersion() || '?'}</span>
                        </label>
                        <div id="sc-update-status" class="sc-settings-note">Checking for updates…</div>
                        <div id="sc-update-notes" class="sc-update-notes sc-hidden"></div>
                        <div class="sc-settings-input-row">
                            <button id="sc-update-check" class="sc-settings-test" type="button">Check now</button>
                        </div>
                        <div id="sc-update-progress-wrap" class="sc-update-progress-wrap sc-hidden">
                            <div id="sc-update-progress-fill" class="sc-update-progress-fill"></div>
                        </div>
                        <button id="sc-update-action" class="sc-settings-btn-wide sc-hidden" type="button">Update Now</button>
                        <button id="sc-update-github-link" class="sc-update-github-link sc-hidden" type="button">View release on GitHub ↗</button>
                    </div>
                </div>
```

- [ ] **Step 3: Rewrite `wireUpdateSection`**

Replace the whole `wireUpdateSection` IIFE (currently lines ~779-819) with:

```js
        // ── App update check / release notes / in-app install ────────────────
        (function wireUpdateSection() {
            const statusEl  = document.getElementById('sc-update-status');
            const notesEl   = document.getElementById('sc-update-notes');
            const actionBtn = document.getElementById('sc-update-action');
            const checkBtn  = document.getElementById('sc-update-check');
            const ghLink    = document.getElementById('sc-update-github-link');
            const progWrap  = document.getElementById('sc-update-progress-wrap');
            const progFill  = document.getElementById('sc-update-progress-fill');
            if (!statusEl || !actionBtn || !checkBtn || !ghLink || !progWrap || !progFill) return;

            let phase = 'idle'; // 'idle' | 'downloading' | 'installing' | 'error'

            const fmtSize = (bytes) => (typeof bytes === 'number' && bytes > 0)
                ? ' (' + (bytes / (1024 * 1024)).toFixed(1) + ' MB)' : '';

            const renderAction = () => {
                progWrap.classList.add('sc-hidden');
                actionBtn.classList.add('sc-hidden');
                if (phase === 'downloading') { progWrap.classList.remove('sc-hidden'); return; }
                if (phase === 'installing') { return; }
                if (!_updateInfo || !_updateInfo.available) return;
                actionBtn.classList.remove('sc-hidden');
                actionBtn.textContent = canInstallUpdates()
                    ? 'Update Now' + fmtSize(_updateInfo.apkSize)
                    : 'Allow installs from Grindhouse →';
            };

            const render = (info) => {
                statusEl.className = 'sc-settings-note';
                notesEl.classList.add('sc-hidden');
                ghLink.classList.add('sc-hidden');
                if (!info) { statusEl.textContent = 'Checking for updates…'; renderAction(); return; }
                if (info.available) {
                    statusEl.classList.add('sc-update-yes');
                    statusEl.textContent = 'Update available: ' + info.latest;
                    if (info.notes) { notesEl.textContent = info.notes; notesEl.classList.remove('sc-hidden'); }
                    ghLink.classList.remove('sc-hidden');
                } else {
                    statusEl.classList.add('sc-update-no');
                    statusEl.textContent = info.latest ? '✓ You’re on the latest version (' + info.latest + ')' : '✓ You’re on the latest version';
                }
                renderAction();
            };

            // Re-check install permission when the app regains focus (covers returning from
            // the system "allow installs from this source" screen, which doesn't rebuild this
            // modal). Self-unregisters once the modal has closed.
            const onVisible = () => {
                if (!overlay.isConnected) { document.removeEventListener('visibilitychange', onVisible); return; }
                if (!document.hidden) renderAction();
            };
            document.addEventListener('visibilitychange', onVisible);

            if (_updateInfo) render(_updateInfo);
            checkForUpdate(false).then(render).catch(() => {
                if (!_updateInfo) statusEl.textContent = 'Couldn’t reach GitHub to check.';
            });

            actionBtn.addEventListener('click', () => {
                if (!canInstallUpdates()) { requestInstallPermission(); return; }
                if (!_updateInfo || !_updateInfo.apkUrl) {
                    phase = 'error';
                    statusEl.className = 'sc-settings-note';
                    statusEl.textContent = 'No installable update found — use the GitHub link below';
                    renderAction();
                    return;
                }
                phase = 'downloading';
                progFill.style.width = '0%';
                statusEl.className = 'sc-settings-note';
                statusEl.textContent = 'Downloading… 0%';
                renderAction();
                nativeDownloadAndInstall(_updateInfo.apkUrl, (tick) => {
                    if (tick.phase === 'downloading') {
                        progFill.style.width = tick.pct + '%';
                        statusEl.textContent = 'Downloading… ' + tick.pct + '%';
                    } else if (tick.phase === 'installing') {
                        phase = 'installing';
                        statusEl.textContent = 'Opening installer…';
                        renderAction();
                    }
                }).catch(() => {
                    phase = 'error';
                    statusEl.className = 'sc-settings-note';
                    statusEl.textContent = 'Download failed — check connection';
                    renderAction();
                });
            });

            ghLink.addEventListener('click', () => {
                const url = (_updateInfo && _updateInfo.url) || GH_RELEASES_PAGE;
                try { if (window.CytubeNative && CytubeNative.openExternal) CytubeNative.openExternal(url); else window.open(url, '_blank'); } catch (e) {}
            });

            checkBtn.addEventListener('click', async () => {
                statusEl.className = 'sc-settings-note';
                statusEl.textContent = 'Checking…';
                checkBtn.disabled = true;
                try { render(await checkForUpdate(true)); }
                catch (e) { statusEl.textContent = 'Couldn’t reach GitHub to check.'; }
                checkBtn.disabled = false;
            });
        })();
```

This function runs inside the same closure as `openSettingsModal`'s `overlay` variable (it already does today — `wireUpdateSection` is nested inside `openSettingsModal`), so `overlay.isConnected` is directly accessible; no new parameter needed.

- [ ] **Step 4: Update the CSS**

In `web/src/styles/overlays.css`, replace (currently ~lines 271-283):

```css
            /* App-update section + the settings-gear "update available" highlight */
            #sc-update-notes {
                white-space: pre-wrap !important; max-height: 130px !important; overflow-y: auto !important;
                margin: 6px 0 8px !important; padding: 8px 10px !important;
                background: rgba(255,255,255,0.05) !important; border-radius: 6px !important;
                font-size: 12px !important; line-height: 1.45 !important; color: rgba(255,255,255,0.78) !important;
            }
            #sc-update-notes.sc-hidden, #sc-update-download.sc-hidden { display: none !important; }
            #sc-update-status.sc-update-yes { color: #7dffa0 !important; font-weight: 600 !important; }
            #sc-update-status.sc-update-no  { color: rgba(255,255,255,0.5) !important; }
            #sc-update-download { margin-top: 8px !important; background: rgba(125,255,160,0.16) !important;
                color: #7dffa0 !important; border-color: rgba(125,255,160,0.4) !important; }
            #sc-update-download:hover { background: rgba(125,255,160,0.28) !important; }
```

with:

```css
            /* App-update section + the settings-gear "update available" highlight */
            #sc-update-notes {
                white-space: pre-wrap !important; max-height: 130px !important; overflow-y: auto !important;
                margin: 6px 0 8px !important; padding: 8px 10px !important;
                background: rgba(255,255,255,0.05) !important; border-radius: 6px !important;
                font-size: 12px !important; line-height: 1.45 !important; color: rgba(255,255,255,0.78) !important;
            }
            #sc-update-notes.sc-hidden, #sc-update-action.sc-hidden, #sc-update-github-link.sc-hidden,
            #sc-update-progress-wrap.sc-hidden { display: none !important; }
            #sc-update-status.sc-update-yes { color: #7dffa0 !important; font-weight: 600 !important; }
            #sc-update-status.sc-update-no  { color: rgba(255,255,255,0.5) !important; }
            #sc-update-action { margin-top: 8px !important; background: rgba(125,255,160,0.16) !important;
                color: #7dffa0 !important; border-color: rgba(125,255,160,0.4) !important; }
            #sc-update-action:hover { background: rgba(125,255,160,0.28) !important; }
            .sc-update-github-link {
                display: block !important; margin-top: 8px !important; width: 100% !important;
                background: transparent !important; border: none !important; cursor: pointer !important;
                text-align: center !important; font-size: 12px !important;
                color: rgba(255,255,255,0.5) !important; text-decoration: none !important;
            }
            .sc-update-github-link:hover { color: rgba(255,255,255,0.75) !important; }
            .sc-update-progress-wrap {
                margin-top: 8px !important; height: 8px !important; border-radius: 999px !important;
                background: rgba(255,255,255,0.08) !important; overflow: hidden !important;
            }
            .sc-update-progress-fill {
                height: 100% !important; width: 0% !important; background: #7dffa0 !important;
                border-radius: 999px !important; transition: width 0.2s ease !important;
            }
```

- [ ] **Step 5: Lint, test, and bundle**

```bash
cd web
npm run lint
npm test
npm run bundle
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/settings.js web/src/styles/overlays.css app/src/main/assets/cytube_mobile.js
git commit -m "feat: in-app update download/install UI in Settings"
```

---

### Task 5: Build, install, and device verification

**Files:** none (verification-only task).

- [ ] **Step 1: Build the debug APK**

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Install on a connected device (phone/tablet first)**

```bash
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 3: Confirm an update is detected**

The installed debug `versionName` carries a `-debug` suffix but the same numeric `versionCode`/`versionName` as `main` — if `main`'s current release tag is already ahead (it should be, since this feature bumps nothing itself), Settings → Updates should show "Update available: v<latest>" with the notes and both buttons. If not, temporarily lower `versionName` in `app/build.gradle.kts` for this check only, then restore it (do not commit a version bump as part of this feature — that happens at release time per `CLAUDE.md`'s release recap).

- [ ] **Step 4: First-time permission flow**

With "install unknown apps" NOT yet granted for this app: tap "Allow installs from Grindhouse →" → confirm `ACTION_MANAGE_UNKNOWN_APP_SOURCES` opens → flip the toggle → back out → confirm the button now reads "Update Now" (the `visibilitychange` re-check firing).

- [ ] **Step 5: Full download → install**

Tap "Update Now" → confirm the progress bar fills 0→100% with the percentage text updating → confirm the system installer opens automatically at 100% → complete the install → confirm the app relaunches at the new version.

- [ ] **Step 6: Error path**

Enable airplane mode, tap "Update Now" (or "Check now" first to force a fresh check that will itself fail — verify that path too) → confirm "Download failed — check connection" renders and the button reverts to tappable "Update Now" for retry.

- [ ] **Step 7: TV pass**

Repeat steps 2-6 on the Android TV device. Specifically confirm: the new buttons are D-pad reachable within the existing Updates tab (already TV-nav wired), the progress bar is legible from couch distance, and both system screens (`ACTION_MANAGE_UNKNOWN_APP_SOURCES` and the package installer) are navigable with the remote.

- [ ] **Step 8: Report results to the user**

Summarize pass/fail for phone and TV before considering this feature ready to merge.
