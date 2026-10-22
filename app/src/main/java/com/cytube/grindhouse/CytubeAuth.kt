package com.grindhouse.cytube

import android.content.SharedPreferences
import android.webkit.CookieManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * In-app CyTube login / logout / saved-account switching.
 *
 * Native performs the HTTP form login (GET /login for the CSRF token, POST /login) and
 * copies the resulting session cookies into the WebView's CookieManager; the page then
 * reloads and the socket reconnects as the new user. Saved passwords live in their own
 * encrypted prefs file (NOT the one getKey() reads) and never cross back into JS —
 * the channel's own custom JS can see CytubeNative too.
 *
 * The global java.net CookieHandler is ACCEPT_NONE (see MainActivity), so cookies are
 * handled by hand here.
 */
class CytubeAuth(
    private val activity: MainActivity,
    private val store: SharedPreferences,
    private val userAgent: () -> String
) {
    private val base = "https://cytu.be"

    private class Resp(val status: Int, val body: String, val setCookies: List<String>)

    fun listJson(): String {
        val out = JSONArray()
        accounts().forEach { a ->
            out.put(JSONObject().put("name", a.optString("name")).put("lastUsed", a.optLong("lastUsed")))
        }
        return JSONObject()
            .put("active", store.getString(KEY_ACTIVE, "") ?: "")
            .put("accounts", out)
            .toString()
    }

    fun remove(name: String) {
        val kept = JSONArray()
        accounts().filter { !it.optString("name").equals(name, true) }.forEach { kept.put(it) }
        val ed = store.edit().putString(KEY_ACCOUNTS, kept.toString())
        if ((store.getString(KEY_ACTIVE, "") ?: "").equals(name, true)) ed.remove(KEY_ACTIVE)
        ed.apply()
    }

    fun login(reqId: String, name: String, password: String, remember: Boolean) {
        Thread { resolve(reqId, doLogin(name.trim(), password, remember)) }.start()
    }

    fun switchTo(reqId: String, name: String) {
        Thread {
            val acct = accounts().firstOrNull { it.optString("name").equals(name, true) }
            val pw = acct?.optString("pw").orEmpty()
            resolve(reqId,
                if (acct == null || pw.isEmpty()) fail("No saved password for $name")
                else doLogin(acct.optString("name"), pw, true))
        }.start()
    }

    fun logout(reqId: String) {
        Thread {
            // Best effort server-side logout; the local cookie wipe below is what counts.
            try {
                val existing = CookieManager.getInstance().getCookie(base).orEmpty()
                val page = request("GET", "$base/login", existing, null)
                val csrf = csrfFrom(page.body)
                if (csrf != null) {
                    val cookie = mergeCookies(existing, page.setCookies)
                    val resp = request("POST", "$base/logout", cookie, form("_csrf" to csrf))
                    applyCookies(resp.setCookies)
                }
            } catch (_: Exception) { }
            val cm = CookieManager.getInstance()
            cm.setCookie(base, "auth=; Max-Age=0; Domain=.cytu.be; Path=/")
            cm.setCookie(base, "auth=; Max-Age=0; Path=/")
            cm.flush()
            store.edit().remove(KEY_ACTIVE).apply()
            resolve(reqId, JSONObject().put("ok", true).put("error", JSONObject.NULL))
        }.start()
    }

    private fun doLogin(name: String, password: String, remember: Boolean): JSONObject {
        if (name.isEmpty() || password.isEmpty()) return fail("Enter a username and password")
        return try {
            val page = request("GET", "$base/login", "", null)
            val csrf = csrfFrom(page.body) ?: return fail("Couldn't reach the CyTube login page")
            val cookie = mergeCookies("", page.setCookies)
            val resp = request("POST", "$base/login", cookie,
                form("_csrf" to csrf, "name" to name, "password" to password, "remember" to "on"))
            val authed = resp.setCookies.any { it.trimStart().startsWith("auth=") && !it.contains("auth=;") }
            if (!authed) return fail(errorFrom(resp.body) ?: "Login failed (HTTP ${resp.status})")
            applyCookies(resp.setCookies)
            if (remember) saveAccount(name, password)
            store.edit().putString(KEY_ACTIVE, name).apply()
            JSONObject().put("ok", true).put("name", name).put("error", JSONObject.NULL)
        } catch (e: Exception) {
            fail("Network error: ${e.message ?: "request failed"}")
        }
    }

    private fun saveAccount(name: String, password: String) {
        val list = JSONArray()
        accounts().filter { !it.optString("name").equals(name, true) }.forEach { list.put(it) }
        list.put(JSONObject().put("name", name).put("pw", password).put("lastUsed", System.currentTimeMillis()))
        store.edit().putString(KEY_ACCOUNTS, list.toString()).apply()
    }

    private fun accounts(): List<JSONObject> = try {
        val arr = JSONArray(store.getString(KEY_ACCOUNTS, "[]") ?: "[]")
        (0 until arr.length()).map { arr.getJSONObject(it) }.sortedBy { it.optString("name").lowercase() }
    } catch (_: Exception) { emptyList() }

    private fun request(method: String, url: String, cookie: String, body: String?): Resp {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 8000
            instanceFollowRedirects = false
            setRequestProperty("User-Agent", userAgent())
            setRequestProperty("Accept", "text/html")
            if (cookie.isNotEmpty()) setRequestProperty("Cookie", cookie)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                setRequestProperty("Origin", base)
                setRequestProperty("Referer", "$base/login")
            }
        }
        try {
            if (body != null) conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            val setCookies = conn.headerFields.entries
                .filter { it.key != null && it.key.equals("Set-Cookie", true) }
                .flatMap { it.value }
            val stream = if (status in 200..399) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            return Resp(status, text, setCookies)
        } finally {
            conn.disconnect()
        }
    }

    private fun applyCookies(setCookies: List<String>) {
        if (setCookies.isEmpty()) return
        val cm = CookieManager.getInstance()
        setCookies.forEach { cm.setCookie(base, it) }
        cm.flush()
    }

    /** "a=1; b=2" + Set-Cookie headers → one Cookie header (later values win). */
    private fun mergeCookies(existing: String, setCookies: List<String>): String {
        val map = LinkedHashMap<String, String>()
        existing.split(";").map { it.trim() }.filter { it.contains("=") }
            .forEach { map[it.substringBefore("=")] = it.substringAfter("=") }
        setCookies.map { it.substringBefore(";").trim() }.filter { it.contains("=") }
            .forEach { map[it.substringBefore("=")] = it.substringAfter("=") }
        return map.entries.joinToString("; ") { "${it.key}=${it.value}" }
    }

    private fun csrfFrom(html: String): String? =
        Regex("""name="_csrf"\s+value="([^"]+)"""").find(html)?.groupValues?.get(1)

    private fun errorFrom(html: String): String? {
        val m = Regex("""alert-danger[^>]*>([\s\S]*?)</div>""").find(html) ?: return null
        val text = m.groupValues[1].replace(Regex("<[^>]+>"), " ")
            .replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", "\"")
            .replace(Regex("\\s+"), " ").trim()
            .removePrefix("Login Failed").trim()
        return text.ifEmpty { null }
    }

    private fun form(vararg pairs: Pair<String, String>): String =
        pairs.joinToString("&") { (k, v) -> "${URLEncoder.encode(k, "UTF-8")}=${URLEncoder.encode(v, "UTF-8")}" }

    private fun fail(msg: String): JSONObject = JSONObject().put("ok", false).put("error", msg)

    private fun resolve(reqId: String, payload: JSONObject) {
        val js = "window.__scAuthResolve && window.__scAuthResolve(${JSONObject.quote(reqId)}, $payload)"
        activity.runOnUiThread { activity.evalJs(js) }
    }

    companion object {
        private const val KEY_ACCOUNTS = "accounts"
        private const val KEY_ACTIVE = "active"
    }
}
