package com.grindhouse.cytube

import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class CytubeJsBridge(
    private val activity: MainActivity,
    private val prefs: SharedPreferences
) {
    @JavascriptInterface
    fun getKey(key: String): String = prefs.getString(key, "") ?: ""

    @JavascriptInterface
    fun saveKey(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    @JavascriptInterface
    fun enterPip() {
        activity.runOnUiThread { activity.enterPip() }
    }

    @JavascriptInterface
    fun isTv(): Boolean = activity.isTvDevice()

    /** Installed app version name (e.g. "2.5") — used by the in-page update checker. */
    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    /** Back pressed with nothing to close in-page → background the app. */
    @JavascriptInterface
    fun tvBack() { activity.tvBackground() }

    @JavascriptInterface
    fun hasHardwareKeyboard(): Boolean = activity.hasHardwareKeyboard()

    /** Suppress/allow the on-screen keyboard (physical keyboard keeps working). */
    @JavascriptInterface
    fun setSuppressKeyboard(on: Boolean) {
        activity.runOnUiThread { activity.setKeyboardSuppressed(on) }
    }

    /** Track whether the chat textarea has focus so Enter isn't hijacked by TV nav. */
    @JavascriptInterface
    fun setChatInputFocused(active: Boolean) {
        activity.chatInputFocused = active
    }

    /** Hide the native loading overlay once the injected script has finished styling. */
    @JavascriptInterface
    fun onReady() {
        activity.runOnUiThread { activity.hideLoadingOverlay() }
    }

    /** Update the small status line on the loading splash from the injected script. */
    @JavascriptInterface
    fun setLoadingStatus(text: String) {
        activity.setLoadingStatus(text)
    }

    /** Open a URL outside the app (system browser / native YouTube app) — used for DRM titles. */
    @JavascriptInterface
    fun openExternal(url: String) {
        activity.runOnUiThread { activity.openExternalUrl(url) }
    }

    /** Base URL of the localhost Drive media proxy — JS rewrites Drive stream URLs onto this. */
    @JavascriptInterface
    fun gdProxyBase(): String = activity.gdProxyBase()

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

    /** Open the system Cast device chooser (the in-page mobile cast button). */
    @JavascriptInterface
    fun startCasting() {
        activity.runOnUiThread { activity.startCasting() }
    }

    /** End the current cast session (the cast-mode "Stop Casting" button). */
    @JavascriptInterface
    fun stopCasting() {
        activity.runOnUiThread { activity.stopCasting() }
    }

    /**
     * Native HTTP GET — bypasses WebView CORS so the script can validate API keys
     * (and reach APIs like DoesTheDogDie that don't send CORS headers).
     * Result is delivered back to JS via window.__scHttpResolve(reqId, {status, body, error}).
     */
    @JavascriptInterface
    fun httpGet(reqId: String, url: String, headersJson: String) {
        Thread {
            var status = 0
            var body = ""
            var error: String? = null
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    val headers = JSONObject(headersJson)
                    headers.keys().forEach { k -> conn.setRequestProperty(k, headers.getString(k)) }
                } catch (_: Exception) { /* no/invalid headers — ignore */ }

                status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                body = stream?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
            } catch (e: Exception) {
                error = e.message ?: "request failed"
            }

            val payload = JSONObject()
                .put("status", status)
                .put("body", body)
                .put("error", error ?: JSONObject.NULL)
            val js = "window.__scHttpResolve && window.__scHttpResolve(" +
                "${JSONObject.quote(reqId)}, $payload)"
            activity.runOnUiThread { activity.evalJs(js) }
        }.start()
    }

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
     *
     * knownSize (bytes, from the GitHub release asset's own metadata, already known to JS before
     * the download starts) is used as the progress-percentage denominator in preference to the
     * HTTP response's Content-Length header — device testing showed HttpURLConnection doesn't
     * reliably surface Content-Length across GitHub's release-asset redirect (github.com to
     * release-assets.githubusercontent.com), which silently produced zero progress ticks. Falls
     * back to the header if the caller doesn't have a known size.
     */
    @JavascriptInterface
    fun downloadAndInstallUpdate(reqId: String, url: String, knownSize: Long) {
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
                val total = if (knownSize > 0) knownSize else conn.contentLengthLong
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
                activity.runOnUiThread {
                    if (!activity.installApk(file)) post("error", 0, "installer unavailable")
                }
            } catch (e: Exception) {
                post("error", 0, e.message ?: "download failed")
            }
        }.start()
    }
}
