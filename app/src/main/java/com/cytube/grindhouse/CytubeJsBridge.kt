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

    /** Suppress/allow the on-screen keyboard (physical keyboard keeps working). */
    @JavascriptInterface
    fun setSuppressKeyboard(on: Boolean) {
        activity.runOnUiThread { activity.setKeyboardSuppressed(on) }
    }

    /** Hide the native loading overlay once the injected script has finished styling. */
    @JavascriptInterface
    fun onReady() {
        activity.runOnUiThread { activity.hideLoadingOverlay() }
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
