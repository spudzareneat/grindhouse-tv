# Grindhouse → GeckoView: Full Port Plan

## What the POC proved
A bare GeckoView app **plays the DRM "YouTube Movies" title** ("The Shallows") that the WebView app can't,
because GeckoView ships its own Widevine CDM. The working recipe:
1. **GeckoView** engine (`org.mozilla.geckoview:geckoview`)
2. **Desktop UA mode** (`GeckoSessionSettings.USER_AGENT_MODE_DESKTOP`) — bypasses YouTube's "get the app"
   mobile-browser block on Movies titles.
3. **A `PermissionDelegate` that grants content permissions** — GeckoView silently denies the EME
   `media-key-system-access` request by default; granting it lets Widevine negotiate. (This was the key.)

So DRM is solved by switching engines. The cost is everything else. This doc is what a *real* port costs.

## The core problem: GeckoView ≠ WebView API
The current app is ~3700 lines of injected JS (`cytube_mobile.js`) + a thin native WebView shell. GeckoView
removes the two pillars that shell relies on:
- **No `evaluateJavascript` / `addJavascriptInterface`** — you can't inject arbitrary page JS or expose a
  `CytubeNative` object directly. You ship a **built-in WebExtension** (bundled in assets) whose content
  script runs on `cytu.be`.
- **Content scripts run in an ISOLATED world** — they cannot see page globals (`window.PLAYER`, `socket`,
  CyTube internals) that `cytube_mobile.js` depends on heavily. To touch those you inject a `<script>` tag
  into the page (main world) from the content script, and the two halves talk via `window.postMessage`/
  CustomEvents. So the injected logic gets split in two and bridged.

## Feature-by-feature mapping
| WebView feature (today) | GeckoView equivalent | Difficulty |
|---|---|---|
| Inject `cytube_mobile.js` | Built-in WebExtension → content script injects a page-world `<script>` | **Hard** (plumbing) |
| `CytubeNative.*` bridge (`addJavascriptInterface`) | WebExtension ⇄ native via `WebExtension.PortDelegate`/`MessageDelegate`; all calls become async messages | **Hard** (rewrite all call sites) |
| `httpGet` (key validation, IMDb GraphQL) | Either native message, OR a normal `fetch()` in the extension background with `host_permissions` (no CORS in extensions) | Medium — extension fetch is cleaner |
| Drive `/videoplayback` proxy (`shouldInterceptRequest`) | **Likely unneeded:** GeckoView's media stack uses a real Firefox UA (no `wv` 403), and `get_video_info` can be an extension `fetch()` with host permission for `docs.google.com`. No byte-proxy = simpler. Must validate. | Medium (probably easier!) |
| Document-start stub (`addDocumentStartJavaScript`) | Content script with `run_at: document_start` | Easy |
| D-pad TV nav (`dispatchKeyEvent` → `window.__scTvKey`) | Activity `dispatchKeyEvent` → message to page-world script | Medium |
| PiP (enter + CSS class) | Activity PiP still works; CSS toggle via the bridge | Medium |
| Background suspend (`onPause`/`pauseTimers`) | `GeckoSession.setActive(false)` in `onStop` | Easy |
| Fullscreen video (`WebChromeClient`) | `ContentDelegate.onFullScreen` | Easy |
| Console → logcat | `GeckoSession.ContentDelegate`/`GeckoRuntimeSettings.consoleOutputEnabled` | Easy |
| Keyboard suppression (`NoImeWebView`) | GeckoView has its own text-input pipeline; no `onCheckIsTextEditor` hook — **unknown approach** | **Hard / unknown** |
| Splash + loading overlay, signing, EncryptedSharedPreferences | Native, unchanged | Easy |
| EME/Widevine (the whole point) | Desktop UA mode + permission delegate (proven) | Done |

## APK size
The debug POC is **508 MB** (all ABIs, unstripped). Mitigations:
- **ABI splits** — `splits { abi { isEnable = true; reset(); include("arm64-v8a") } }`. Your phone + Onn TV are
  both arm64, so a single arm64 APK ≈ **70–90 MB** (mostly `libxul.so`).
- Release build (R8 shrinks the Kotlin, not the native libs).
- Net: realistically **~80 MB** per device vs the current **9.5 MB** WebView app. Unavoidable with a bundled engine.

## Open questions to validate before committing
1. **Does the CyTube *embed* (not the YouTube watch page) play the DRM title in GeckoView?** The POC used the
   YouTube watch page. The room uses the YouTube *iframe embed*; embeds usually play on mobile, but Movies-title
   embeds may differ. Quick test: point the POC at `cytu.be/r/420Grindhouse` and land on a DRM title.
2. **Does desktop UA break the rest of CyTube/Grindhouse layout?** Desktop UA may change CyTube's responsive
   behavior and our CSS assumptions (which key off mobile/TV). May need per-iframe UA or careful CSS.
3. **Keyboard suppression** for physical-keyboard setups — is there a GeckoView equivalent at all?
4. **Drive without the proxy** — confirm the extension-`fetch()` + native-media-stack path actually plays.

## Suggested phasing
- **Phase 0 (½ day):** Point POC at the channel; confirm the embed DRM plays + assess desktop-UA layout damage.
  This de-risks the whole thing — if embeds don't play, stop here.
- **Phase 1 (1–2 days):** WebExtension scaffold + content-script→page-world `<script>` injection + a working
  message bridge (one method end-to-end, e.g. `getKey`). ABI-split build so it's installable.
- **Phase 2 (2–3 days):** Port `cytube_mobile.js` to run page-world; convert every `CytubeNative.*` call to the
  async message bridge; reimplement httpGet/Drive via extension fetch.
- **Phase 3 (1–2 days):** Re-wire the native delegates (D-pad, PiP, suspend, fullscreen, console, splash) +
  keyboard-suppression spike.
- **Phase 4:** Polish, release signing, per-device APKs.

Rough total: **~1 week** of focused work, with Phase 0 as the go/no-go gate.

## Recommendation
DRM is the *only* thing GeckoView buys, and it costs a ~10× larger app plus re-doing the integration layer.
**Most pragmatic:** keep the current 9.5 MB WebView app as the daily driver (it nails Drive, the cinematic
shell, TV nav, everything) and keep the shipped DRM fallback (open the channel in a Widevine browser). Pursue
the GeckoView port only if in-app DRM playback becomes a must-have. Phase 0 is cheap if you want to keep poking.

_POC lives in this project (`com.grindhouse.cytube.gecko`, "Grindhouse Gecko"); the real app is untouched._
