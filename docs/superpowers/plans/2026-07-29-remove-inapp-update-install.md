# Remove In-App Update Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the app's self-download-and-install update path (native APK download +
`ACTION_VIEW` install intent + `REQUEST_INSTALL_PACKAGES` permission) so the app stops
tripping Play Protect's on-device verifier, while keeping update *detection* — the
settings panel still shows "Update available: vX" and now always offers a single
"View release on GitHub ↗" action that opens the release page in the external browser.

**Architecture:** Pure removal across three layers (JS UI/bridge glue, Kotlin native
bridge + Activity, Android manifest/resources), each independently buildable/testable.
No new behavior, no new files except this plan and its spec.

**Tech Stack:** Kotlin (Android), vanilla JS bundled with esbuild (`web/` → `cd web &&
npm run bundle` → `app/src/main/assets/cytube_mobile.js`), `node --test` for JS unit
tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-remove-inapp-update-install-design.md` — every
  removal in this plan traces back to that file's "Removals" section.
- `web/src/update.js` (checkForUpdate, `_pickApkAsset`, the 6h cache, gear pulse) is
  **out of scope** — left untouched per spec.
- The injected script (`app/src/main/assets/cytube_mobile.js`) is a generated bundle —
  never hand-edit it; always regenerate via `cd web && npm run bundle`.
- `MainActivity.kt`'s generic `window.__scAppResumed && window.__scAppResumed();` resume
  hook (native-side caller) stays — only the JS-side *registration* of it in
  `settings.js` is removed, per spec.

---

### Task 1: Remove the update-install JS (native.js, settings.js, overlays.css)

**Files:**
- Modify: `web/src/native.js:33-73`
- Modify: `web/src/settings.js:17` (import), `613-629` (markup), `807-912` (wiring)
- Modify: `web/src/styles/overlays.css:276-304`
- Test: `web/test/update.test.mjs` (verify it still passes — it only covers
  `_pickApkAsset`, which isn't touched)

**Interfaces:**
- Consumes: nothing new.
- Produces: `web/src/native.js` no longer exports `canInstallUpdates`,
  `requestInstallPermission`, or `nativeDownloadAndInstall`. `web/src/settings.js`'s
  Updates pane renders status text + notes + a single always-available
  `#sc-update-github-link` button when an update is available (no `#sc-update-action`,
  no progress bar). Later tasks (Kotlin/manifest removal) don't depend on anything from
  this task, but should follow it so the JS bundle and native bridge go stale-free
  together at the final smoke check.

- [ ] **Step 1: Delete the update-install block from `web/src/native.js`**

  Delete lines 33-73 (everything from the `/* ====... APP UPDATE INSTALL ...` comment
  through the closing `}` of `nativeDownloadAndInstall`) so the file ends right after
  `nativeHttpGet`'s closing brace (currently line 31). Confirm the file now ends with:

  ```js
  export function nativeHttpGet(url, headers = {}) {
      return new Promise((resolve, reject) => {
          if (!(window.CytubeNative && typeof CytubeNative.httpGet === 'function')) {
              reject(new Error('native http unavailable'));
              return;
          }
          const id = 'h' + Math.random().toString(36).slice(2);
          _scHttpCbs[id] = (res) => {
              if (res && res.error) reject(new Error(res.error));
              else resolve(res);
          };
          try { CytubeNative.httpGet(id, url, JSON.stringify(headers)); }
          catch (e) { delete _scHttpCbs[id]; reject(e); }
          // Timeout guard
          setTimeout(() => {
              if (_scHttpCbs[id]) { delete _scHttpCbs[id]; reject(new Error('timeout')); }
          }, 10000);
      });
  }
  ```

- [ ] **Step 2: Trim the `native.js` import in `web/src/settings.js:17`**

  Before:
  ```js
  import { nativeHttpGet, canInstallUpdates, requestInstallPermission, nativeDownloadAndInstall } from './native.js';
  ```
  After:
  ```js
  import { nativeHttpGet } from './native.js';
  ```

- [ ] **Step 3: Trim the Updates pane markup in `web/src/settings.js` (around line 613-629)**

  Before:
  ```js
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
  After:
  ```js
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
                          <button id="sc-update-github-link" class="sc-update-github-link sc-hidden" type="button">View release on GitHub ↗</button>
                      </div>
                  </div>
  ```

- [ ] **Step 4: Simplify `wireUpdateSection()` in `web/src/settings.js` (currently lines
  807-912)**

  Replace the entire IIFE with:
  ```js
          // ── App update check / release notes / external-browser link ──────────
          (function wireUpdateSection() {
              const statusEl = document.getElementById('sc-update-status');
              const notesEl  = document.getElementById('sc-update-notes');
              const checkBtn = document.getElementById('sc-update-check');
              const ghLink   = document.getElementById('sc-update-github-link');
              if (!statusEl || !checkBtn || !ghLink) return;

              const render = (info) => {
                  statusEl.className = 'sc-settings-note';
                  notesEl.classList.add('sc-hidden');
                  ghLink.classList.add('sc-hidden');
                  if (!info) { statusEl.textContent = 'Checking for updates…'; return; }
                  if (info.available) {
                      statusEl.classList.add('sc-update-yes');
                      statusEl.textContent = 'Update available: ' + info.latest;
                      if (info.notes) { notesEl.textContent = info.notes; notesEl.classList.remove('sc-hidden'); }
                      ghLink.classList.remove('sc-hidden');
                  } else {
                      statusEl.classList.add('sc-update-no');
                      statusEl.textContent = info.latest ? '✓ You’re on the latest version (' + info.latest + ')' : '✓ You’re on the latest version';
                  }
              };

              if (_updateInfo) render(_updateInfo);
              checkForUpdate(false).then(render).catch(() => {
                  if (!_updateInfo) statusEl.textContent = 'Couldn’t reach GitHub to check.';
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

  This drops `phase`, `renderAction`, the `actionBtn` lookup/click handler, and the
  `window.__scAppResumed` registration entirely, and removes the now-unused
  `canInstallUpdates`/`nativeDownloadAndInstall` calls. `render()`'s status/notes/ghLink
  logic is otherwise unchanged from before.

- [ ] **Step 5: Trim the CSS in `web/src/styles/overlays.css` (currently lines 276-304)**

  Before:
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
  After:
  ```css
              /* App-update section + the settings-gear "update available" highlight */
              #sc-update-notes {
                  white-space: pre-wrap !important; max-height: 130px !important; overflow-y: auto !important;
                  margin: 6px 0 8px !important; padding: 8px 10px !important;
                  background: rgba(255,255,255,0.05) !important; border-radius: 6px !important;
                  font-size: 12px !important; line-height: 1.45 !important; color: rgba(255,255,255,0.78) !important;
              }
              #sc-update-notes.sc-hidden, #sc-update-github-link.sc-hidden { display: none !important; }
              #sc-update-status.sc-update-yes { color: #7dffa0 !important; font-weight: 600 !important; }
              #sc-update-status.sc-update-no  { color: rgba(255,255,255,0.5) !important; }
              .sc-update-github-link {
                  display: block !important; margin-top: 8px !important; width: 100% !important;
                  background: transparent !important; border: none !important; cursor: pointer !important;
                  text-align: center !important; font-size: 12px !important;
                  color: rgba(255,255,255,0.5) !important; text-decoration: none !important;
              }
              .sc-update-github-link:hover { color: rgba(255,255,255,0.75) !important; }
  ```

- [ ] **Step 6: Run the JS test suite and lint**

  ```bash
  cd web && npm test && npm run lint
  ```
  Expected: all tests pass (update.test.mjs only exercises `_pickApkAsset`, untouched);
  lint clean (no unused-import warnings for the removed `native.js` exports).

- [ ] **Step 7: Commit**

  ```bash
  git add web/src/native.js web/src/settings.js web/src/styles/overlays.css
  git commit -m "$(cat <<'EOF'
  fix: drop in-app update self-install from the JS layer

  Part of removing the self-download-and-install update path (see
  docs/superpowers/specs/2026-07-29-remove-inapp-update-install-design.md).
  Settings now always offers "View release on GitHub" instead of an
  in-app Update Now button.
  EOF
  )"
  ```

---

### Task 2: Remove the native install plumbing (Kotlin)

**Files:**
- Modify: `app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt:147-225`
- Modify: `app/src/main/java/com/cytube/grindhouse/MainActivity.kt:554-582`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `CytubeJsBridge` no longer exposes `canInstallUpdates`,
  `requestInstallPermission`, or `downloadAndInstallUpdate` to the JS bridge (matches
  Task 1's removed JS callers). `MainActivity` no longer exposes
  `canInstallUpdates()`/`requestInstallPermission()`/`installApk()`. Task 3 (manifest/
  resource removal) depends on this — it removes the `FileProvider` declaration that
  `installApk()` referenced.

- [ ] **Step 1: Delete the three bridge methods from `CytubeJsBridge.kt`**

  Delete lines 147-225 — from the `/** Whether the app currently has permission to
  install APKs...` doc comment through the closing `}` of `downloadAndInstallUpdate`
  (which is also the last member before the class's closing brace). After deletion the
  file should end with the `httpGet` method's closing `}.start()` / `}` followed
  directly by the class's closing `}` — i.e. `downloadAndInstallUpdate` was the last
  method in the class, so removing it removes straight through to (but not including)
  the file's final `}`.

  Verify no leftover reference:
  ```bash
  grep -n "canInstallUpdates\|requestInstallPermission\|downloadAndInstallUpdate" app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt
  ```
  Expected: no output.

- [ ] **Step 2: Delete the three matching methods from `MainActivity.kt`**

  Delete lines 554-582:
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
      fun installApk(file: java.io.File): Boolean {
          return try {
              val uri = androidx.core.content.FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
              startActivity(
                  android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                      setDataAndType(uri, "application/vnd.android.package-archive")
                      addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                      addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                  }
              )
              true
          } catch (e: Exception) { false /* installer unavailable on this device */ }
      }

  ```
  Leave the surrounding methods (`tvBackground()` above/below it, etc.) untouched — just
  close the gap this leaves in the file.

  Verify no leftover reference:
  ```bash
  grep -n "canInstallUpdates\|requestInstallPermission\|installApk\|FileProvider" app/src/main/java/com/cytube/grindhouse/MainActivity.kt
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt app/src/main/java/com/cytube/grindhouse/MainActivity.kt
  git commit -m "$(cat <<'EOF'
  fix: drop in-app update self-install from the native layer

  Removes canInstallUpdates/requestInstallPermission/downloadAndInstallUpdate
  (CytubeJsBridge) and canInstallUpdates/requestInstallPermission/installApk
  (MainActivity) — the JS callers were removed in the prior commit. Manifest
  permission + FileProvider removal follows in the next commit.
  EOF
  )"
  ```

---

### Task 3: Remove the manifest permission, FileProvider, and file_paths.xml; verify the full build

**Files:**
- Modify: `app/src/main/AndroidManifest.xml`
- Delete: `app/src/main/res/xml/file_paths.xml`

**Interfaces:**
- Consumes: Task 2 must be done first — the `FileProvider` declaration removed here has
  no remaining code reference after Task 2.
- Produces: final state — no build artifact anywhere still names
  `REQUEST_INSTALL_PACKAGES`, `fileprovider`, or `file_paths`. This is the last task; its
  Step 4 (full Gradle build) is the plan's overall correctness check.

- [ ] **Step 1: Remove the permission line from `AndroidManifest.xml`**

  Delete:
  ```xml
      <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
  ```
  (it's grouped with the other `<uses-permission>` lines near the top of the manifest,
  alongside `INTERNET` and `POST_NOTIFICATIONS` — remove only this one line).

- [ ] **Step 2: Remove the `FileProvider` `<provider>` block from `AndroidManifest.xml`**

  Delete:
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
  Leave any sibling `<provider>`/`<activity>` entries around it untouched.

- [ ] **Step 3: Delete the now-orphaned resource file**

  ```bash
  git rm app/src/main/res/xml/file_paths.xml
  ```

- [ ] **Step 4: Full clean build to verify nothing references the removed
  permission/provider/resource**

  ```bash
  export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
  cd /c/Repos/android_GrindhouseTV && ./gradlew assembleDebug
  ```
  Expected: `BUILD SUCCESSFUL`. A leftover reference to `@xml/file_paths` or the
  `fileprovider` authority would fail this build (Kotlin compile error or AAPT resource-
  link error), so a clean build here is the confirmation that Tasks 1-3 are fully
  consistent with each other.

- [ ] **Step 5: Rebuild the JS bundle so the APK's injected script matches Task 1's
  source changes**

  ```bash
  cd /c/Repos/android_GrindhouseTV/web && npm run bundle
  ```
  Expected: `bundled OK`, and `git status` shows
  `app/src/main/assets/cytube_mobile.js` modified.

- [ ] **Step 6: Rebuild the debug APK with the refreshed bundle and confirm install on
  the connected debug package**

  ```bash
  export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
  cd /c/Repos/android_GrindhouseTV && ./gradlew assembleDebug
  "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
  ```
  Expected: `BUILD SUCCESSFUL` and `Success` from adb install. (The debug package,
  `com.grindhouse.cytube.debug`, installs fine over adb regardless of Play Protect —
  Play Protect's rejection in the spec's motivating incident was specific to sideloading
  the *release*-signed, previously-uninstalled-hash APK; the already-installed debug
  package updating in place is a routine adb flow, not what this plan is fixing.)

- [ ] **Step 7: Manual smoke check — Settings → App Updates pane**

  On the device (TV or phone), open the app, go to Settings → App Updates, and confirm:
  - Status text renders ("Checking…" then either "Update available: vX" or "✓ You're on
    the latest version").
  - When an update is available: release notes show, and exactly one button is present —
    "View release on GitHub ↗" — with no "Update Now" button and no progress bar.
  - Tapping "View release on GitHub ↗" opens the GitHub release page in the external
    browser (not inside the WebView).
  - "Check now" still works (re-triggers the check, updates the status text).

- [ ] **Step 8: Commit**

  ```bash
  git add app/src/main/AndroidManifest.xml app/src/main/assets/cytube_mobile.js
  git commit -m "$(cat <<'EOF'
  fix: drop REQUEST_INSTALL_PACKAGES permission and FileProvider

  Completes the removal of the in-app update self-install path started
  in the prior two commits — the app no longer requests install-package
  permission or declares a FileProvider, removing the permission/behavior
  pattern that got a sideloaded build rejected by Play Protect's on-device
  verifier. Bundle rebuilt via `cd web && npm run bundle` to pick up the
  JS-layer changes.
  EOF
  )"
  ```

---

## Self-Review Notes

- **Spec coverage:** every file in the spec's "Removals" table has a task (native.js/
  settings.js/overlays.css → Task 1; CytubeJsBridge.kt/MainActivity.kt → Task 2;
  AndroidManifest.xml/file_paths.xml → Task 3). The spec's "What stays unchanged" section
  (`update.js`, `checkBtn`, `ghLink`) is explicitly preserved in Task 1 Step 4's
  replacement code. The spec's testing plan (unit tests, Gradle build, manual device
  check) maps to Task 1 Step 6, Task 3 Step 4, and Task 3 Step 7.
- **Type/name consistency:** `ghLink`/`#sc-update-github-link`, `statusEl`/
  `#sc-update-status`, `notesEl`/`#sc-update-notes`, `checkBtn`/`#sc-update-check` are
  used identically across Task 1's markup and wiring steps.
- No release/version bump is included — this plan only removes the flagged capability;
  cutting a new release (version bump, `assembleRelease`, GitHub release) is a separate,
  user-triggered step per the project's existing release recap in `CLAUDE.md`.
