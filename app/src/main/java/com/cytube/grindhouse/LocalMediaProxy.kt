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
