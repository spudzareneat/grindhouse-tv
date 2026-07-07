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
}
