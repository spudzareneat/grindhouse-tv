package com.grindhouse.cytube

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.util.concurrent.Executors

/**
 * Minimal localhost HTTP server that proxies Google Drive video streams.
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
 */
class LocalMediaProxy(private val userAgent: String) {
    @Volatile private var server: ServerSocket? = null
    private val pool = Executors.newCachedThreadPool()
    var port: Int = 0; private set

    // JPEG bytes served at /slate — the "please wait" card shown on the cast TV during a
    // non-castable (YouTube) segment. Set by MainActivity; the cast device fetches it over the LAN.
    @Volatile var slate: ByteArray? = null

    fun start() {
        if (server != null) return
        // Bind on the wildcard address (0.0.0.0) rather than loopback-only. The WebView still
        // reaches it via http://127.0.0.1:<port> (a Chromium "secure context"), but binding the
        // wildcard also lets a CAST TARGET on the same LAN fetch Drive streams from the phone:
        // Google ties Drive stream URLs to the requesting browser, so the Chromecast can't hit
        // Google directly — it pulls through this proxy at http://<phone-lan-ip>:<port> instead.
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

    private fun handle(client: Socket) {
        try {
            client.use { sock ->
                val reader = BufferedReader(InputStreamReader(sock.getInputStream()))
                val requestLine = reader.readLine() ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) return
                val method = parts[0]
                val path = parts[1]
                var range: String? = null
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) break
                    if (line.startsWith("Range:", ignoreCase = true)) range = line.substringAfter(":").trim()
                }
                val out = sock.getOutputStream()
                if (path.startsWith("/slate")) {
                    serveSlate(out, method.equals("HEAD", true)); return@use
                }
                val enc = path.substringAfter("u=", "")
                if (enc.isEmpty()) { writeStatus(out, 400, "Bad Request"); return@use }
                proxy(URLDecoder.decode(enc, "UTF-8"), range, method.equals("HEAD", true), out)
            }
        } catch (_: Exception) { /* client gone / broken pipe — ignore */ }
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

    companion object { private const val CHUNK = 4L * 1024 * 1024 }
}
