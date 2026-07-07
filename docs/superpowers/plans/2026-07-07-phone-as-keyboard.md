# Phone-as-Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a phone on the same Wi-Fi as the TV act as a live keyboard for any text field in the app (chat, CyTube login, Settings text fields), paired via a QR code shown in Settings.

**Architecture:** `LocalMediaProxy.kt`'s existing localhost HTTP server gets three new routes (`GET /type`, `POST /type`, `GET /type/status`). The phone POSTs each keystroke; native forwards it to the page instantly via `webView.evaluateJavascript(...)` (no polling loop for the typing channel itself — the same push pattern already used for `__scTvKey`/`__scSetCastMode`). A small `web/src/chat/keyboard.js` module owns the TV-side DOM wiring (which field is focused, applying pushed text). Settings gets a "Phone Keyboard" section that starts pairing and renders the QR (via a vendored offline encoder).

**Tech Stack:** Kotlin (raw `ServerSocket` HTTP, no framework — matches existing `LocalMediaProxy.kt`), vanilla ES modules bundled by the existing esbuild pipeline (`web/build.mjs`), `qrcode-generator` npm package (MIT, bundled at build time — zero runtime network dependency), Node's built-in test runner (`node --test`, matching `web/test/*.test.mjs`).

## Global Constraints

- No new runtime network dependency: `qrcode-generator` is bundled into `cytube_mobile.js` by esbuild at build time; the shipped app makes zero external calls for this feature (LAN-only, per `docs/redesign-vision.md`'s "no cloud" property).
- One active phone pairing at a time. Starting a new pairing (or restarting the TV app) invalidates the previous token. No "Unpair" button in this iteration (see spec's Non-goals).
- TV-only feature: gated on `isTv` everywhere it surfaces in the Settings UI and the page-side wiring.
- Follow the codebase's existing patterns exactly: native→JS push via `webView.evaluateJavascript`, synchronous `@JavascriptInterface` methods for immediate reads (matching `gdProxyBase()`, `isTvDevice()`), CORS/response-writing style matching `LocalMediaProxy.kt`'s existing `writeStatus`/`serveSlate`.
- No Kotlin unit-test harness exists in this project — native task verification is "compiles clean" (`./gradlew assembleDebug`); full behavioral verification is the device pass in Task 7, matching how `LocalMediaProxy.kt`'s existing Drive-proxy code is verified today (device + curl, per `CLAUDE.md`'s on-device debug harness section).

---

### Task 1: Vendor the QR encoder

**Files:**
- Modify: `web/package.json`
- Create: `web/src/vendor/qr.js`
- Test: `web/test/qr.test.mjs`

**Interfaces:**
- Produces: `renderQrToCanvas(canvas, text, moduleSize = 6)` — draws a QR encoding of `text` onto `canvas` (any object exposing `.width`, `.height`, `.getContext('2d')` returning an object with `.fillStyle` and `.fillRect(x, y, w, h)`). Throws if `text` is too long to encode. Consumed by Task 6 (Settings UI).

- [ ] **Step 1: Install the encoder library**

Run: `cd web && npm install qrcode-generator`

Expected: `web/package.json`'s `dependencies` gains `"qrcode-generator": "^X.Y.Z"` (npm picks the version — do not hand-edit the version string), and `web/package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `web/test/qr.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { renderQrToCanvas } from '../src/vendor/qr.js';

function stubCanvas() {
    const calls = [];
    const ctx = {
        fillStyle: null,
        fillRect: (x, y, w, h) => calls.push({ fillStyle: ctx.fillStyle, x, y, w, h }),
    };
    return { width: 0, height: 0, getContext: () => ctx, _calls: calls };
}

test('renders a non-trivial QR pattern', () => {
    const canvas = stubCanvas();
    renderQrToCanvas(canvas, 'http://192.168.1.50:12345/type?t=abcdef0123456789');
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
    const darkCells = canvas._calls.filter(c => c.fillStyle === '#000');
    assert.ok(darkCells.length > 10, 'expected multiple dark QR modules to be drawn');
});

test('throws for input too long to encode', () => {
    const canvas = stubCanvas();
    assert.throws(() => renderQrToCanvas(canvas, 'x'.repeat(5000)));
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web && node --test test/qr.test.mjs`
Expected: FAIL — `Cannot find module '../src/vendor/qr.js'`

- [ ] **Step 4: Write the implementation**

Create `web/src/vendor/qr.js`:

```js
import qrcode from 'qrcode-generator';

// qrcode-generator requires a type number (1-40, capacity increases with size) rather than
// auto-sizing; loop upward and let it throw ("code length overflow" et al.) until one fits.
function encode(text) {
    for (let type = 1; type <= 40; type++) {
        try {
            const qr = qrcode(type, 'M');
            qr.addData(text);
            qr.make();
            return qr;
        } catch (e) { /* too small for this type — try the next */ }
    }
    throw new Error('QR encode failed: data too long');
}

export function renderQrToCanvas(canvas, text, moduleSize = 6) {
    const qr = encode(text);
    const count = qr.getModuleCount();
    canvas.width = count * moduleSize;
    canvas.height = count * moduleSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
            }
        }
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && node --test test/qr.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 6: Lint**

Run: `cd web && npm run lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/src/vendor/qr.js web/test/qr.test.mjs
git commit -m "feat: vendor QR encoder for phone-as-keyboard pairing"
```

---

### Task 2: Native — `/type` routes on `LocalMediaProxy`

**Files:**
- Modify: `app/src/main/java/com/cytube/grindhouse/LocalMediaProxy.kt` (full-file rewrite — the change touches imports, fields, `handle()`, and adds several new methods, so replace the whole file rather than patching in place)

**Interfaces:**
- Produces (consumed by Task 3):
  - `fun startKeyboardPairing(): String` — generates a fresh token, invalidates any previous one, returns the new token.
  - `fun noteFieldChanged(label: String, masked: Boolean)` — records which field the TV page currently has focused.
  - `fun isKeyboardConnected(): Boolean` — true if a valid-token request arrived in the last 3s.
  - `var onKeyboardInput: ((text: String, commit: Boolean) -> Unit)?` — settable callback invoked (off the UI thread) on every phone keystroke POST.
  - `var port: Int` (already existed) — reused unchanged.

- [ ] **Step 1: Rewrite the file**

Write `app/src/main/java/com/cytube/grindhouse/LocalMediaProxy.kt`:

```kotlin
package com.grindhouse.cytube

import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.security.SecureRandom
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * Minimal localhost HTTP server that proxies Google Drive video streams, and also hosts the
 * phone-as-keyboard pairing endpoints.
 *
 * Why not WebView.shouldInterceptRequest? That can stream a <video> linearly but CANNOT serve
 * SEEKING (Content-Range from an intercepted response isn't honored), and CyTube always seeks the
 * video to the room's position. A real HTTP server on 127.0.0.1 fixes that — the WebView's media
 * stack does proper byte-range seeking against it.
 *
 * It also: (1) caps open-ended ranges into bounded chunks — Google throttles `bytes=N-` to ~playback
 * rate but serves bounded ranges ~64x faster; (2) presents the clean browser UA — Google 403s the
 * WebView's "wv"/Dalvik UA; (3) follows the signed CDN redirect manually; (4) sends no cookies.
 *
 * The injected JS rewrites Drive stream URLs to http://127.0.0.1:<port>/gd?u=<encoded CDN url>.
 * 127.0.0.1 is a Chromium "secure context", so this is NOT blocked as mixed content on the https
 * page (a network-security-config still has to permit cleartext to 127.0.0.1).
 *
 * Phone-as-keyboard: GET /type serves a self-contained HTML page a phone loads directly (its own
 * origin, so no CORS needed); POST /type carries keystrokes forwarded to the WebView via
 * evaluateJavascript (no polling loop on the TV side); GET /type/status is the phone's own ~1s
 * poll for "which field / still paired". One pairing at a time — starting a new one invalidates
 * the last, and everything here is in-memory only (an app restart drops any pairing).
 */
class LocalMediaProxy(private val userAgent: String) {
    @Volatile private var server: ServerSocket? = null
    private val pool = Executors.newCachedThreadPool()
    var port: Int = 0; private set

    // JPEG bytes served at /slate — the "please wait" card shown on the cast TV during a
    // non-castable (YouTube) segment. Set by MainActivity; the cast device fetches it over the LAN.
    @Volatile var slate: ByteArray? = null

    @Volatile private var keyboardToken: String? = null
    @Volatile private var keyboardFieldLabel: String = ""
    @Volatile private var keyboardFieldMasked: Boolean = false
    @Volatile private var keyboardRevision: Int = 0
    @Volatile private var keyboardLastSeenMs: Long = 0L
    var onKeyboardInput: ((text: String, commit: Boolean) -> Unit)? = null

    fun start() {
        if (server != null) return
        // Bind on the wildcard address (0.0.0.0) rather than loopback-only. The WebView still
        // reaches it via http://127.0.0.1:<port> (a Chromium "secure context"), but binding the
        // wildcard also lets a CAST TARGET on the same LAN fetch Drive streams from the phone:
        // Google ties Drive stream URLs to the requesting browser, so the Chromecast can't hit
        // Google directly — it pulls through this proxy at http://<phone-lan-ip>:<port> instead.
        // (The same wildcard bind is what makes /type reachable from an actual phone.)
        val s = ServerSocket(0, 50, InetAddress.getByName("0.0.0.0"))
        server = s
        port = s.localPort
        pool.execute {
            while (!s.isClosed) {
                try { val c = s.accept(); pool.execute { handle(c) } }
                catch (e: Exception) { if (s.isClosed) break }
            }
        }
    }

    fun stop() {
        try { server?.close() } catch (_: Exception) {}
        server = null
        pool.shutdownNow()
    }

    /** Start a new phone-keyboard pairing, discarding any previous one. Returns the fresh token. */
    fun startKeyboardPairing(): String {
        val token = generateToken()
        keyboardToken = token
        keyboardFieldLabel = ""
        keyboardFieldMasked = false
        keyboardRevision++
        keyboardLastSeenMs = 0L
        return token
    }

    /** Called by the TV page whenever D-pad focus moves to a different editable field. */
    fun noteFieldChanged(label: String, masked: Boolean) {
        keyboardFieldLabel = label
        keyboardFieldMasked = masked
        keyboardRevision++
    }

    /** True once a paired phone has made a valid-token request in the last few seconds. */
    fun isKeyboardConnected(): Boolean =
        keyboardToken != null && (System.currentTimeMillis() - keyboardLastSeenMs) < 3000L

    private fun generateToken(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun handle(client: Socket) {
        try {
            client.use { sock ->
                val input = sock.getInputStream()
                val requestLine = readAsciiLine(input) ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) return
                val method = parts[0]
                val path = parts[1]
                var range: String? = null
                var contentLength = 0
                while (true) {
                    val line = readAsciiLine(input) ?: break
                    if (line.isEmpty()) break
                    if (line.startsWith("Range:", ignoreCase = true)) range = line.substringAfter(":").trim()
                    if (line.startsWith("Content-Length:", ignoreCase = true))
                        contentLength = line.substringAfter(":").trim().toIntOrNull() ?: 0
                }
                val out = sock.getOutputStream()
                val routePath = path.substringBefore("?")
                when {
                    routePath == "/slate" -> { serveSlate(out, method.equals("HEAD", true)); return@use }
                    routePath == "/type" && method == "GET" -> { serveKeyboardPage(path, out); return@use }
                    routePath == "/type" && method == "POST" -> {
                        val body = readBodyBytes(input, contentLength)
                        handleKeyboardPost(path, body, out)
                        return@use
                    }
                    routePath == "/type/status" -> { serveKeyboardStatus(path, out); return@use }
                }
                val enc = path.substringAfter("u=", "")
                if (enc.isEmpty()) { writeStatus(out, 400, "Bad Request"); return@use }
                proxy(URLDecoder.decode(enc, "UTF-8"), range, method.equals("HEAD", true), out)
            }
        } catch (_: Exception) { /* client gone / broken pipe — ignore */ }
    }

    // Hand-rolled instead of BufferedReader/InputStreamReader: HTTP header lines are always
    // ASCII, so reading byte-by-byte here is simple AND keeps the stream position byte-exact
    // for the POST body that follows — a char-decoding Reader can't be trusted for that (a
    // Content-Length byte count doesn't line up with a decoded character count once the body
    // has any multi-byte UTF-8 in it, e.g. an emoji or an accented letter in a chat message —
    // that mismatch previously meant reading past the sent data and blocking forever on a
    // still-open keep-alive connection).
    private fun readAsciiLine(input: InputStream): String? {
        val sb = StringBuilder()
        var any = false
        while (true) {
            val b = input.read()
            if (b < 0) return if (any) sb.toString() else null
            any = true
            if (b == '\n'.code) return sb.toString()
            if (b == '\r'.code) continue
            sb.append(b.toChar())
        }
    }

    // Reads exactly `length` raw BYTES (matching the Content-Length header) and decodes them as
    // UTF-8 — correct for any chat text, unlike reading `length` characters off a Reader.
    private fun readBodyBytes(input: InputStream, length: Int): String {
        if (length <= 0) return ""
        val buf = ByteArray(length)
        var read = 0
        while (read < length) {
            val n = input.read(buf, read, length - read)
            if (n < 0) break
            read += n
        }
        return String(buf, 0, read, Charsets.UTF_8)
    }

    private fun queryParam(path: String, name: String): String? {
        val q = path.substringAfter("?", "")
        if (q.isEmpty()) return null
        for (pair in q.split("&")) {
            val idx = pair.indexOf("=")
            if (idx < 0) continue
            val k = pair.substring(0, idx)
            val v = pair.substring(idx + 1)
            if (k == name) return URLDecoder.decode(v, "UTF-8")
        }
        return null
    }

    private fun serveKeyboardPage(path: String, out: OutputStream) {
        val token = queryParam(path, "t")
        if (token == null || token != keyboardToken) { writeStatus(out, 403, "Forbidden"); return }
        val bytes = KEYBOARD_PAGE_HTML.toByteArray(Charsets.UTF_8)
        val sb = StringBuilder("HTTP/1.1 200 OK\r\n")
        sb.append("Content-Type: text/html; charset=utf-8\r\n")
        sb.append("Content-Length: ${bytes.size}\r\n")
        sb.append("Connection: close\r\n\r\n")
        out.write(sb.toString().toByteArray(Charsets.US_ASCII))
        out.write(bytes)
        out.flush()
    }

    private fun handleKeyboardPost(path: String, body: String, out: OutputStream) {
        val token = queryParam(path, "t")
        if (token == null || token != keyboardToken) { writeStatus(out, 403, "Forbidden"); return }
        try {
            val json = JSONObject(body)
            val text = json.optString("text", "")
            val commit = json.optBoolean("commit", false)
            keyboardLastSeenMs = System.currentTimeMillis()
            onKeyboardInput?.invoke(text, commit)
        } catch (_: Exception) { /* malformed body — drop the keystroke, keep the connection */ }
        writeJson(out, JSONObject())
    }

    private fun serveKeyboardStatus(path: String, out: OutputStream) {
        val token = queryParam(path, "t")
        val valid = token != null && token == keyboardToken
        if (valid) keyboardLastSeenMs = System.currentTimeMillis()
        val json = JSONObject()
            .put("valid", valid)
            .put("label", keyboardFieldLabel)
            .put("masked", keyboardFieldMasked)
            .put("revision", keyboardRevision)
        writeJson(out, json)
    }

    private fun writeJson(out: OutputStream, json: JSONObject) {
        val bytes = json.toString().toByteArray(Charsets.UTF_8)
        val sb = StringBuilder("HTTP/1.1 200 OK\r\n")
        sb.append("Content-Type: application/json\r\n")
        sb.append("Content-Length: ${bytes.size}\r\n")
        sb.append("Connection: close\r\n\r\n")
        out.write(sb.toString().toByteArray(Charsets.US_ASCII))
        out.write(bytes)
        out.flush()
    }

    private fun proxy(url: String, rawRange: String?, headOnly: Boolean, out: OutputStream) {
        // Cap open-ended ranges into a bounded chunk to dodge Google's throttling.
        val range = run {
            val r = rawRange ?: "bytes=0-"
            val m = Regex("""bytes=(\d+)-(\d*)""").find(r)
            if (m != null && m.groupValues[2].isEmpty()) {
                val start = m.groupValues[1].toLong()
                "bytes=$start-${start + CHUNK - 1}"
            } else r
        }
        var current = url
        var hops = 0
        while (true) {
            val conn = (URL(current).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                instanceFollowRedirects = false
                connectTimeout = 15000
                readTimeout = 20000
                setRequestProperty("Range", range)
                setRequestProperty("User-Agent", userAgent)
            }
            val code = conn.responseCode
            if (code in 300..399 && hops < 6) {
                val loc = conn.getHeaderField("Location")
                conn.disconnect()
                if (loc.isNullOrEmpty()) { writeStatus(out, 502, "Bad Gateway"); return }
                current = URL(URL(current), loc).toString(); hops++; continue
            }

            val reason = when (code) { 206 -> "Partial Content"; 200 -> "OK"; else -> "Error" }
            val sb = StringBuilder("HTTP/1.1 $code $reason\r\n")
            sb.append("Content-Type: ${conn.getHeaderField("Content-Type") ?: "video/mp4"}\r\n")
            conn.getHeaderField("Content-Length")?.let { sb.append("Content-Length: $it\r\n") }
            conn.getHeaderField("Content-Range")?.let { sb.append("Content-Range: $it\r\n") }
            sb.append("Accept-Ranges: bytes\r\n")
            sb.append("Access-Control-Allow-Origin: *\r\n")
            sb.append("Connection: close\r\n\r\n")
            out.write(sb.toString().toByteArray(Charsets.US_ASCII))

            if (!headOnly) {
                val input = if (code in 200..299) conn.inputStream else conn.errorStream
                if (input != null) {
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                    }
                    input.close()
                }
            }
            out.flush()
            conn.disconnect()
            return
        }
    }

    private fun serveSlate(out: OutputStream, headOnly: Boolean) {
        val data = slate
        if (data == null) { writeStatus(out, 404, "Not Found"); return }
        val sb = StringBuilder("HTTP/1.1 200 OK\r\n")
        sb.append("Content-Type: image/jpeg\r\n")
        sb.append("Content-Length: ${data.size}\r\n")
        sb.append("Access-Control-Allow-Origin: *\r\n")
        sb.append("Connection: close\r\n\r\n")
        out.write(sb.toString().toByteArray(Charsets.US_ASCII))
        if (!headOnly) out.write(data)
        out.flush()
    }

    private fun writeStatus(out: OutputStream, code: Int, reason: String) {
        try {
            out.write("HTTP/1.1 $code $reason\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                .toByteArray(Charsets.US_ASCII))
            out.flush()
        } catch (_: Exception) {}
    }

    companion object {
        private const val CHUNK = 4L * 1024 * 1024

        // Self-contained phone-side page for GET /type?t=<token> — no external resources, so it
        // works purely over the LAN. Reads its own token from location.search rather than a
        // template substitution, so this constant never needs per-request rendering.
        private const val KEYBOARD_PAGE_HTML = """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Grindhouse Keyboard</title>
<style>
  body { margin:0; font-family:sans-serif; background:#111; color:#eee; display:flex; flex-direction:column; height:100vh; padding:16px; box-sizing:border-box; }
  #label { font-size:14px; opacity:0.7; margin-bottom:8px; }
  #field { flex:1; font-size:20px; padding:12px; border-radius:8px; border:none; width:100%; box-sizing:border-box; }
  #send { margin-top:12px; padding:14px; font-size:18px; border-radius:8px; border:none; background:#e63946; color:#fff; }
  #status { margin-top:8px; font-size:12px; opacity:0.6; }
</style></head>
<body>
  <div id="label">Connecting&hellip;</div>
  <input id="field" type="text" autocomplete="off" autocapitalize="sentences" />
  <button id="send" type="button">Send &#9166;</button>
  <div id="status"></div>
<script>
(function(){
  var token = new URLSearchParams(location.search).get('t') || '';
  var field = document.getElementById('field');
  var label = document.getElementById('label');
  var status = document.getElementById('status');
  var lastRevision = null;

  function post(text, commit) {
    fetch('/type?t=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, commit: commit })
    }).catch(function(){ status.textContent = 'Connection lost'; });
  }

  field.addEventListener('input', function(){ post(field.value, false); });
  field.addEventListener('keydown', function(e){
    if (e.key === 'Enter') { post(field.value, true); }
  });
  document.getElementById('send').addEventListener('click', function(){
    post(field.value, true);
  });

  function poll() {
    fetch('/type/status?t=' + encodeURIComponent(token))
      .then(function(r){ return r.json(); })
      .then(function(s){
        if (!s.valid) { label.textContent = 'Reconnect — rescan the QR code'; status.textContent = ''; return; }
        label.textContent = 'Typing into: ' + (s.label || '…');
        field.type = s.masked ? 'password' : 'text';
        status.textContent = '';
        if (lastRevision !== null && s.revision !== lastRevision) { field.value = ''; }
        lastRevision = s.revision;
      })
      .catch(function(){ status.textContent = 'Connection lost'; });
  }
  poll();
  setInterval(poll, 1000);
})();
</script>
</body></html>"""
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/cytube/grindhouse/LocalMediaProxy.kt
git commit -m "feat: add phone-keyboard pairing routes to LocalMediaProxy"
```

---

### Task 3: Native — `MainActivity` + `CytubeJsBridge` wiring

**Files:**
- Modify: `app/src/main/java/com/cytube/grindhouse/MainActivity.kt:166`, `:216`
- Modify: `app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt:70-72`

**Interfaces:**
- Consumes: `LocalMediaProxy.startKeyboardPairing()`, `.noteFieldChanged()`, `.isKeyboardConnected()`, `.onKeyboardInput` (Task 2).
- Produces (consumed by Task 4/6 via the `CytubeNative` bridge):
  - `CytubeNative.phoneKeyboardUrl(): String` — starts pairing, returns the QR-encodable URL (`""` on failure).
  - `CytubeNative.isKeyboardConnected(): Boolean`
  - `CytubeNative.setKeyboardFieldLabel(label: String, masked: boolean): void`
  - Native push target the JS side must define: `window.__scPhoneKeyboard(text: string, commit: boolean)`.

- [ ] **Step 1: Wire the native push callback**

In `app/src/main/java/com/cytube/grindhouse/MainActivity.kt`, replace:

```kotlin
        mediaProxy = LocalMediaProxy(webViewUa).also { it.start() }
```

with:

```kotlin
        mediaProxy = LocalMediaProxy(webViewUa).also { proxy ->
            proxy.start()
            // Push each phone keystroke straight into the page — no polling loop on the TV
            // side, same pattern as __scTvKey (D-pad) and __scSetCastMode (cast).
            proxy.onKeyboardInput = { text, commit ->
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.__scPhoneKeyboard && window.__scPhoneKeyboard(" +
                            "${JSONObject.quote(text)}, $commit)",
                        null
                    )
                }
            }
        }
```

- [ ] **Step 2: Add the three activity-level methods**

In the same file, right after `fun gdProxyBase(): String = "http://127.0.0.1:${mediaProxy?.port ?: 0}/gd?u="`, add:

```kotlin

    /**
     * Start (or restart) phone-keyboard pairing and return the URL to encode as a QR code.
     * Starting a new pairing invalidates whatever phone was paired before.
     */
    fun phoneKeyboardUrl(): String? {
        val proxy = mediaProxy ?: return null
        val ip = lanIpAddress() ?: return null
        val token = proxy.startKeyboardPairing()
        return "http://$ip:${proxy.port}/type?t=$token"
    }

    /** True once the paired phone has made a request in the last few seconds. */
    fun isKeyboardConnected(): Boolean = mediaProxy?.isKeyboardConnected() ?: false

    /** Called by the page whenever D-pad focus moves to a different editable field. */
    fun setKeyboardFieldLabel(label: String, masked: Boolean) {
        mediaProxy?.noteFieldChanged(label, masked)
    }
```

- [ ] **Step 3: Add the bridge methods**

In `app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt`, right after:

```kotlin
    /** Base URL of the localhost Drive media proxy — JS rewrites Drive stream URLs onto this. */
    @JavascriptInterface
    fun gdProxyBase(): String = activity.gdProxyBase()
```

add:

```kotlin

    /** Start phone-keyboard pairing; returns the URL to render as a QR code (or "" on failure). */
    @JavascriptInterface
    fun phoneKeyboardUrl(): String = activity.phoneKeyboardUrl() ?: ""

    /** Whether a paired phone has been active in the last few seconds. */
    @JavascriptInterface
    fun isKeyboardConnected(): Boolean = activity.isKeyboardConnected()

    /** Tell native which field (label + whether it's a password) currently has D-pad focus. */
    @JavascriptInterface
    fun setKeyboardFieldLabel(label: String, masked: Boolean) {
        activity.setKeyboardFieldLabel(label, masked)
    }
```

- [ ] **Step 4: Verify it compiles**

Run: `export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/cytube/grindhouse/MainActivity.kt app/src/main/java/com/cytube/grindhouse/CytubeJsBridge.kt
git commit -m "feat: expose phone-keyboard pairing over the CytubeNative bridge"
```

---

### Task 4: TV-side JS module — `web/src/chat/keyboard.js`

**Files:**
- Create: `web/src/chat/keyboard.js`
- Test: `web/test/keyboard.test.mjs`

**Interfaces:**
- Consumes: `CytubeNative.setKeyboardFieldLabel`, `CytubeNative.isKeyboardConnected`, `CytubeNative.setSuppressKeyboard` (all from Task 3, called defensively via `try/catch` like every other native-bridge call site in this codebase).
- Produces (consumed by Task 5):
  - `initPhoneKeyboard(isTvDevice: boolean, recheckSoftKeyboard: () => void): void`
  - Pure helpers `isEditable(el)` / `labelFor(el)`, exported for testing.
  - Sets `window.__scPhoneKeyboard = (text, commit) => void` as a side effect of `initPhoneKeyboard` — this is the target `MainActivity`'s `evaluateJavascript` push calls (Task 3).

`isTvDevice` and `recheckSoftKeyboard` are passed in rather than imported (from `tvdetect.js` / `settings.js`) so this module has no import-time dependency on `window` — keeping `isEditable`/`labelFor` importable and testable under plain Node.

- [ ] **Step 1: Write the failing test**

Create `web/test/keyboard.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { isEditable, labelFor } from '../src/chat/keyboard.js';

test('isEditable', () => {
    assert.strictEqual(isEditable({ tagName: 'INPUT' }), true);
    assert.strictEqual(isEditable({ tagName: 'TEXTAREA' }), true);
    assert.strictEqual(isEditable({ tagName: 'DIV' }), false);
    assert.strictEqual(isEditable(null), false);
});

test('labelFor identifies known fields', () => {
    assert.strictEqual(labelFor({ id: 'sc-chat-textarea', tagName: 'TEXTAREA' }), 'Chat message');
    assert.strictEqual(labelFor({ type: 'password', tagName: 'INPUT' }), 'Password');
    assert.strictEqual(labelFor({ id: 'sc-input-tmdb', tagName: 'INPUT' }), 'TMDB API key');
    assert.strictEqual(labelFor({ id: 'username', tagName: 'INPUT' }), 'Username');
    assert.strictEqual(labelFor({ tagName: 'INPUT' }), 'Text field');
    assert.strictEqual(labelFor(null), 'Text field');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test test/keyboard.test.mjs`
Expected: FAIL — `Cannot find module '../src/chat/keyboard.js'`

- [ ] **Step 3: Write the implementation**

Create `web/src/chat/keyboard.js`:

```js
// Phone-as-keyboard: a phone on the same Wi-Fi drives whatever text field currently has
// D-pad focus. Native pushes each keystroke straight to window.__scPhoneKeyboard (no polling
// loop here) — see LocalMediaProxy.kt's /type routes and MainActivity's onKeyboardInput wiring.

export function isEditable(el) {
    return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
}

export function labelFor(el) {
    if (!el) return 'Text field';
    if (el.id === 'sc-chat-textarea') return 'Chat message';
    if (el.type === 'password') return 'Password';
    if (el.id === 'sc-input-tmdb') return 'TMDB API key';
    if (el.id === 'username' || el.name === 'username') return 'Username';
    return 'Text field';
}

function reportFocusedField() {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    try {
        if (window.CytubeNative && CytubeNative.setKeyboardFieldLabel) {
            CytubeNative.setKeyboardFieldLabel(labelFor(el), el.type === 'password');
        }
    } catch (e) {}
}

function applyPhoneInput(text, commit) {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (commit) {
        ['keydown', 'keyup'].forEach(type => {
            el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true }));
        });
    }
}

/**
 * TV-only. `recheckSoftKeyboard` is the caller's existing on-screen-keyboard decision function
 * (settings.js's applySoftKeyboard) — called on a light ~1s interval so a phone connecting or
 * disconnecting re-evaluates suppression through that single existing decision point, rather
 * than this module calling CytubeNative.setSuppressKeyboard independently.
 */
export function initPhoneKeyboard(isTvDevice, recheckSoftKeyboard) {
    if (!isTvDevice) return;
    document.addEventListener('focusin', reportFocusedField);
    window.__scPhoneKeyboard = applyPhoneInput;
    setInterval(() => { try { recheckSoftKeyboard(); } catch (e) {} }, 1000);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test test/keyboard.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Lint**

Run: `cd web && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add web/src/chat/keyboard.js web/test/keyboard.test.mjs
git commit -m "feat: add TV-side phone-keyboard wiring module"
```

---

### Task 5: Wire `keyboard.js` into `settings.js`

**Files:**
- Modify: `web/src/settings.js`

**Interfaces:**
- Consumes: `initPhoneKeyboard(isTvDevice, recheckSoftKeyboard)` (Task 4).
- Produces: `softKeyboardDisabled()` now also returns `true` when a phone is connected (unless the user has explicitly forced the on-screen keyboard on/off via the existing setting) — same function signature/name, no new export.

- [ ] **Step 1: Import the module**

In `web/src/settings.js`, right after:

```js
import { nativeHttpGet } from './native.js';
```

add:

```js
import { initPhoneKeyboard } from './chat/keyboard.js';
```

- [ ] **Step 2: Fold phone-keyboard connection into the soft-keyboard decision**

Replace:

```js
    function softKeyboardDisabled() {
        const v = getKey(LS_NOKEYBOARD);
        if (v === 'on')  return true;
        if (v === 'off') return false;
        // Default: suppress the on-screen keyboard only when a hardware keyboard
        // is actually connected (so remote-only TVs keep the on-screen keyboard).
        try { if (window.CytubeNative && CytubeNative.hasHardwareKeyboard) return !!CytubeNative.hasHardwareKeyboard(); } catch (e) {}
        return false;
    }
```

with:

```js
    function softKeyboardDisabled() {
        const v = getKey(LS_NOKEYBOARD);
        if (v === 'on')  return true;
        if (v === 'off') return false;
        // Default: suppress the on-screen keyboard when a phone is actively paired (it's
        // driving text entry instead), or when a hardware keyboard is connected (so
        // remote-only TVs with neither keep the on-screen keyboard).
        try { if (window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected()) return true; } catch (e) {}
        try { if (window.CytubeNative && CytubeNative.hasHardwareKeyboard) return !!CytubeNative.hasHardwareKeyboard(); } catch (e) {}
        return false;
    }
```

- [ ] **Step 3: Initialize on the main (channel) page**

Replace:

```js
    initTvNav();
```

with:

```js
    initTvNav();
    initPhoneKeyboard(isTv, applySoftKeyboard);
```

- [ ] **Step 4: Initialize on the login page**

The login page runs a separate, minimal code path that returns before the channel UI (and `applySoftKeyboard`) ever loads — the phone-keyboard push target and focus tracking need to be installed there too. Replace:

```js
    if (window.location.pathname.startsWith('/login')) {
        initLoginTvNav();
        return;
    }
```

with:

```js
    if (window.location.pathname.startsWith('/login')) {
        initPhoneKeyboard(isTv, () => {
            try {
                const connected = window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected();
                if (window.CytubeNative && CytubeNative.setSuppressKeyboard) CytubeNative.setSuppressKeyboard(!!connected);
            } catch (e) {}
        });
        initLoginTvNav();
        return;
    }
```

- [ ] **Step 5: Existing tests still pass**

Run: `cd web && node --test test/*.test.mjs`
Expected: all PASS (no test imports `settings.js` directly, so this is a regression guard on the other suites)

- [ ] **Step 6: Lint and bundle**

Run: `cd web && npm run lint && npm run bundle`
Expected: no lint errors; `bundled OK`

- [ ] **Step 7: Commit**

```bash
git add web/src/settings.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: wire phone-keyboard into the channel and login pages"
```

---

### Task 6: Settings UI — "Phone Keyboard" pairing section

**Files:**
- Modify: `web/src/settings.js`
- Modify: `web/src/styles/overlays.css`

**Interfaces:**
- Consumes: `renderQrToCanvas` (Task 1), `CytubeNative.phoneKeyboardUrl` / `.isKeyboardConnected` (Task 3).

- [ ] **Step 1: Import the QR renderer**

In `web/src/settings.js`, right after:

```js
import { initPhoneKeyboard } from './chat/keyboard.js';
```

add:

```js
import { renderQrToCanvas } from './vendor/qr.js';
```

- [ ] **Step 2: Track a status-poll timer per modal instance**

Replace:

```js
        const tmdbVal  = getKey(LS_TMDB);
        // "First run" = the very first time the app is opened, not whether a key exists.
        // The key is always optional; we only use this to show the intro copy once.
        const firstRun = !localStorage.getItem(LS_ONBOARDED);
        try { localStorage.setItem(LS_ONBOARDED, '1'); } catch (e) {}
```

with:

```js
        const tmdbVal  = getKey(LS_TMDB);
        // "First run" = the very first time the app is opened, not whether a key exists.
        // The key is always optional; we only use this to show the intro copy once.
        const firstRun = !localStorage.getItem(LS_ONBOARDED);
        try { localStorage.setItem(LS_ONBOARDED, '1'); } catch (e) {}
        let phoneKbStatusTimer = null;
```

- [ ] **Step 3: Add the Playback-tab section (TV only)**

Replace:

```js
                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Disable on-screen keyboard</span>
                            </span>
                            <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                        </label>
                    </div>
                </div>
```

with:

```js
                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Disable on-screen keyboard</span>
                            </span>
                            <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                        </label>
                    </div>
                    ${isTv ? `
                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-label">Phone Keyboard
                            <span class="sc-settings-note">Pair a phone on the same Wi-Fi to type into any field here — chat, login, even this key field</span>
                        </label>
                        <div class="sc-settings-input-row">
                            <button id="sc-pair-phone-btn" class="sc-settings-btn-wide" type="button">Pair a phone</button>
                        </div>
                        <canvas id="sc-phone-qr" class="sc-hidden"></canvas>
                        <div id="sc-phone-qr-status" class="sc-settings-note"></div>
                    </div>` : ''}
                </div>
```

- [ ] **Step 4: Route modal-close through a shared helper that stops the status timer**

Replace:

```js
        document.body.appendChild(overlay);

        // ── Tab switching. First-run always lands on Account (the default/first tab). ──
        const tabs  = [...overlay.querySelectorAll('.sc-settings-tab')];
        const panes = [...overlay.querySelectorAll('.sc-settings-pane')];
        const showTab = (name) => {
            tabs.forEach(t => t.classList.toggle('sc-settings-tab-active', t.dataset.tab === name));
            panes.forEach(p => p.classList.toggle('sc-settings-pane-active', p.dataset.pane === name));
        };
        tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
        showTab('account');

        // The TMDB key is optional — always allow closing (backdrop tap or Cancel/Skip).
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        document.getElementById('sc-settings-cancel').addEventListener('click', () => overlay.remove());
```

with:

```js
        document.body.appendChild(overlay);

        // Every path that closes the modal must also stop the phone-keyboard status poll,
        // or it keeps ticking (and leaking) after the modal is gone.
        const closeSettings = () => { clearInterval(phoneKbStatusTimer); overlay.remove(); };

        // ── Tab switching. First-run always lands on Account (the default/first tab). ──
        const tabs  = [...overlay.querySelectorAll('.sc-settings-tab')];
        const panes = [...overlay.querySelectorAll('.sc-settings-pane')];
        const showTab = (name) => {
            tabs.forEach(t => t.classList.toggle('sc-settings-tab-active', t.dataset.tab === name));
            panes.forEach(p => p.classList.toggle('sc-settings-pane-active', p.dataset.pane === name));
        };
        tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
        showTab('account');

        // The TMDB key is optional — always allow closing (backdrop tap or Cancel/Skip).
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeSettings();
        });
        document.getElementById('sc-settings-cancel').addEventListener('click', () => closeSettings());
```

- [ ] **Step 5: Use the same helper for the Save button's auto-close**

Replace:

```js
        document.getElementById('sc-settings-save').addEventListener('click', () => {
            persistSettings();
            const status = document.getElementById('sc-settings-status');
            status.textContent = '✓ Saved';
            setTimeout(() => overlay.remove(), 800);
        });
```

with:

```js
        document.getElementById('sc-settings-save').addEventListener('click', () => {
            persistSettings();
            const status = document.getElementById('sc-settings-status');
            status.textContent = '✓ Saved';
            setTimeout(closeSettings, 800);
        });
```

- [ ] **Step 6: Wire the Pair button**

Right after:

```js
        // ── Disable on-screen keyboard toggle (applies immediately) ──────────
        const nokb = document.getElementById('sc-input-nokb');
        if (nokb) nokb.addEventListener('change', () => {
            setKey(LS_NOKEYBOARD, nokb.checked ? 'on' : 'off');
            applySoftKeyboard();
        });
```

add:

```js

        // ── Phone Keyboard pairing (TV only) ──────────────────────────────────
        const pairBtn = document.getElementById('sc-pair-phone-btn');
        if (pairBtn) {
            const qrCanvas = document.getElementById('sc-phone-qr');
            const qrStatus = document.getElementById('sc-phone-qr-status');
            pairBtn.addEventListener('click', () => {
                let url = '';
                try { if (window.CytubeNative && CytubeNative.phoneKeyboardUrl) url = CytubeNative.phoneKeyboardUrl(); } catch (e) {}
                if (!url) { qrStatus.textContent = 'Could not start pairing.'; return; }
                renderQrToCanvas(qrCanvas, url);
                qrCanvas.classList.remove('sc-hidden');
                qrStatus.textContent = 'Waiting for phone…';
                clearInterval(phoneKbStatusTimer);
                phoneKbStatusTimer = setInterval(() => {
                    let connected = false;
                    try { connected = !!(window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected()); } catch (e) {}
                    qrStatus.textContent = connected ? 'Phone connected ✓' : 'Waiting for phone…';
                }, 1000);
            });
        }
```

- [ ] **Step 7: Add the canvas styling**

In `web/src/styles/overlays.css`, right after:

```css
            .sc-settings-btn-wide:hover { background: rgba(192,176,255,0.32) !important; }
```

add:

```css
            #sc-phone-qr {
                display: block !important; margin: 10px auto 4px !important;
                background: #fff !important; padding: 8px !important; border-radius: 8px !important;
            }
            #sc-phone-qr.sc-hidden { display: none !important; }
```

- [ ] **Step 8: Lint and bundle**

Run: `cd web && npm run lint && npm run bundle`
Expected: no lint errors; `bundled OK`

- [ ] **Step 9: Commit**

```bash
git add web/src/settings.js web/src/styles/overlays.css app/src/main/assets/cytube_mobile.js
git commit -m "feat: add Phone Keyboard pairing UI to Settings"
```

---

### Task 7: Full-stack device verification

**Files:** none (verification only)

- [ ] **Step 1: Build and install the debug APK**

Run:
```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
Expected: `BUILD SUCCESSFUL`, `Success` from adb install.

- [ ] **Step 2: Launch and confirm the pairing URL**

Follow the relaunch/attach sequence from `CLAUDE.md`'s "On-device debug harness" section (wake, launch, wait ~14s, `adb forward` the devtools port), then:

```bash
node tools/cdp.mjs "CytubeNative.phoneKeyboardUrl()"
```
Expected: a string like `"http://192.168.x.x:PORT/type?t=<32 hex chars>"`.

- [ ] **Step 3: Device checklist (manual, on the actual TV + a phone on the same Wi-Fi)**

- [ ] Open Settings → Playback tab on the TV, tap "Pair a phone" — a QR code renders and the status line reads "Waiting for phone…".
- [ ] Scan the QR with a phone on the same Wi-Fi — it loads the keyboard page; the status line on the TV flips to "Phone connected ✓" within ~1s.
- [ ] With the TV's chat box focused, type on the phone — characters mirror live into the TV's chat box. Press the phone's Enter/Go (or Send) — the message sends on the TV.
- [ ] Navigate the TV to the CyTube login page, focus the username field, type on the phone — it mirrors correctly. Do the same for the password field, and confirm the phone's own field switches to `type="password"` and its label reads "Password".
- [ ] Back on Settings, focus the TMDB API key field, type on the phone — it mirrors, and the phone's field is NOT masked (label reads "TMDB API key").
- [ ] While the phone is connected, confirm the Android on-screen keyboard does NOT pop up when a text field is focused on the TV.
- [ ] Disconnect the phone (close its browser tab); within a few seconds the TV's "Disable on-screen keyboard" auto-suppression should turn back off (tap a text field — the Android keyboard should reappear, assuming the manual toggle is left at its default/off state).
- [ ] Tap "Pair a phone" again (rotating the token) and confirm the first phone's further keystrokes are rejected (its page shows "Reconnect — rescan the QR code").
- [ ] Force-stop and relaunch the app, then confirm the previously-issued token no longer works (old phone page shows "Reconnect…").

- [ ] **Step 4: Record the outcome**

If every checklist item passes, the feature is complete — proceed to `superpowers:finishing-a-development-branch` for the branch this was implemented on. If any item fails, use `superpowers:systematic-debugging` before re-running this checklist; do not mark the task complete with known-failing items.
