package com.grindhouse.cytube

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.PictureInPictureParams
import android.content.SharedPreferences
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Rational
import android.view.KeyEvent
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.inputmethod.InputMethodManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.mediarouter.app.MediaRouteButton
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaSeekOptions
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.framework.CastButtonFactory
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener
import org.json.JSONObject
import org.json.JSONTokener

class MainActivity : AppCompatActivity() {

    companion object {
        // Runs before CyTube's own scripts. Declares the Drive userscript as present and
        // queues any getGoogleDriveMetadata call until cytube_mobile.js installs the real
        // implementation (which drains __gdQueue). CyTube's backoffRetry waits indefinitely
        // for the deferred callback, so the queued call resolves cleanly once we're ready.
        private const val DRIVE_EARLY_STUB = """
            (function(){
              if (window.__gdEarly) return;
              window.__gdEarly = true;
              window.__gdQueue = [];
              window.hasDriveUserscript = true;
              window.driveUserscriptVersion = '1.7';
              window.getGoogleDriveMetadata = function(id, cb){
                if (typeof window.__gdRealMeta === 'function') { window.__gdRealMeta(id, cb); }
                else { window.__gdQueue.push([id, cb]); }
              };
            })();
        """
    }

    private lateinit var webView: NoImeWebView
    private var webViewUa: String = ""           // browser UA, reused for native Drive stream fetches
    private var mediaProxy: LocalMediaProxy? = null  // localhost server that proxies Drive streams
    private var stoppedAtMs = 0L                  // >0 once onStop ran; gates the on-resume player health check
    private lateinit var fullscreenContainer: FrameLayout
    private lateinit var prefs: SharedPreferences
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private lateinit var loadingOverlay: ImageView
    private lateinit var loadingContainer: View
    private lateinit var loadingStatus: TextView
    private var loadingPulse: ObjectAnimator? = null
    private var loadingHidden = false

    // Keep the branded splash up until CyTube's first page load (or an 8s safety cap)
    @Volatile private var pageLoaded = false
    private val splashStart = System.currentTimeMillis()

    // Set to true by JS bridge when the chat textarea has focus, so physical keyboard
    // Enter passes through to the WebView instead of being intercepted as TV-nav "center".
    @Volatile var chatInputFocused: Boolean = false

    // --- Casting (phone → TV, video-only; chat stays on the phone) ---
    private var castContext: CastContext? = null
    private var castSession: CastSession? = null
    // Hidden MediaRouteButton kept only so the SDK's device-chooser dialog can be opened
    // programmatically (performClick) from the in-page cast button.
    private var castButton: MediaRouteButton? = null
    private val conductorHandler = Handler(Looper.getMainLooper())
    private var conductorRunning = false
    // The stream URL last sent to the TV — used to detect when the room advances to a new movie.
    private var lastCastUrl: String? = null
    // Tablet/TV state while casting: "cast" = movie on TV + chat-only tablet; "fallback" = a
    // non-castable (YouTube) item playing back on the tablet with a slate on the TV.
    private var castUiMode: String = "none"
    private val CONDUCTOR_INTERVAL_MS = 1800L   // how often the phone re-checks the room vs the TV
    private val DRIFT_TOLERANCE_MS = 3000L      // only nudge the TV when it drifts past this

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        splash.setKeepOnScreenCondition {
            !pageLoaded && System.currentTimeMillis() - splashStart < 8000L
        }
        super.onCreate(savedInstanceState)

        // Ensure native HttpURLConnection requests send NO cookies: Google's videoplayback
        // returns 403 when presented the DRIVE_STREAM/NID cookies that get_video_info sets, but
        // works fine cookie-less. Install an empty, non-storing cookie handler so nothing leaks
        // from metadata lookups into the stream proxy.
        java.net.CookieHandler.setDefault(
            java.net.CookieManager(null, java.net.CookiePolicy.ACCEPT_NONE)
        )

        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.hide(WindowInsetsCompat.Type.systemBars())
        insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        setContentView(R.layout.activity_main)

        val masterKey = MasterKey.Builder(this)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            this, "cytube_prefs", masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        webView = findViewById(R.id.webview)
        fullscreenContainer = findViewById(R.id.fullscreen_container)
        loadingOverlay = findViewById(R.id.loading_overlay)
        loadingContainer = findViewById(R.id.loading_container)
        loadingStatus = findViewById(R.id.loading_status)
        // TV sits ~10ft away and overscan can clip the screen edges — nudge the corner
        // text in slightly and bump the size just enough to stay readable (still subtle).
        if (isTv) {
            loadingStatus.textSize = 13f
            (loadingStatus.layoutParams as FrameLayout.LayoutParams).apply {
                val m = (40 * resources.displayMetrics.density).toInt()
                marginStart = m
                bottomMargin = m
            }
        }
        // Phones draw the splash edge-to-edge; centerCrop on a tall/narrow phone crops the
        // poster's sides and clips the wordmark's outer letters. Show the whole poster
        // (letterboxed on the dark background) on phones only — TV and tablets, whose aspect
        // ratios match the art, keep the full-bleed crop unchanged.
        if (!isTv && resources.configuration.smallestScreenWidthDp < 600) {
            loadingOverlay.scaleType = ImageView.ScaleType.FIT_CENTER
        }
        setLoadingStatus("Starting…")
        startLoadingPulse()

        setupWebView()
        // Start the localhost Drive media proxy (setupWebView has populated webViewUa by now).
        mediaProxy = LocalMediaProxy(webViewUa).also { it.start() }
        webView.loadUrl("https://cytu.be/r/420Grindhouse")

        // Phone/tablet only: offer the Cast button (a TV is the cast target, not a sender).
        if (!isTv) setupCastSender()

        // Safety net: never leave the loading overlay up forever (JS hides it once the
        // video is actually playing, with its own 45s cap — this is the hard backstop).
        Handler(Looper.getMainLooper()).postDelayed({ hideLoadingOverlay() }, 48000)
    }

    private fun startLoadingPulse() {
        // Slow, gentle breathing pulse on the image only (the dark container stays opaque)
        loadingPulse = ObjectAnimator.ofFloat(loadingOverlay, "alpha", 1f, 0.6f).apply {
            duration = 2600
            startDelay = 200
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
    }

    /**
     * Update the small status line on the loading splash. Driven by native lifecycle for the
     * early phases (before JS exists) and then by the injected script via the bridge. No-ops
     * once the overlay has been dismissed.
     */
    fun setLoadingStatus(text: String) {
        runOnUiThread { if (!loadingHidden && ::loadingStatus.isInitialized) loadingStatus.text = text }
    }

    /** Called from JS (via the bridge) once the page is fully styled, or by the safety timeout. */
    fun hideLoadingOverlay() {
        if (loadingHidden) return
        loadingHidden = true
        loadingPulse?.cancel()
        loadingContainer.animate()
            .alpha(0f)
            .setDuration(550)
            .withEndAction { loadingContainer.visibility = View.GONE }
            .start()
    }

    /** Run JS in the WebView from native code (used by the HTTP bridge callbacks). */
    fun evalJs(code: String) {
        webView.evaluateJavascript(code, null)
    }

    /** Base URL of the localhost Drive media proxy; the injected JS rewrites stream URLs onto it. */
    fun gdProxyBase(): String = "http://127.0.0.1:${mediaProxy?.port ?: 0}/gd?u="

    // ----------------------------------------------------------------------------------------
    // Casting (phone → TV). Video-only: only the movie goes to the TV; the room (chat, overlays,
    // controls) stays on this phone, which also keeps the TV in sync by polling the room and
    // driving the TV's player. Works on any Cast device incl. Vizio SmartCast (Chromecast built-in).
    // ----------------------------------------------------------------------------------------

    /** Acquire the CastContext, wire the (hidden) route button, and listen for sessions. */
    private fun setupCastSender() {
        val button = findViewById<MediaRouteButton>(R.id.cast_button)
        castButton = button
        castContext = try {
            CastContext.getSharedInstance(this)
        } catch (e: Exception) {
            button.visibility = View.GONE   // Play Services missing/old — no casting
            return
        }
        CastButtonFactory.setUpMediaRouteButton(applicationContext, button)
        // The visible control is the in-page cast button (styled with the rest of the UI);
        // this native button stays invisible and is only click-driven to show the chooser.
        button.visibility = View.INVISIBLE
        mediaProxy?.slate = buildSlateBytes()   // image the TV shows during YouTube segments
        castContext?.sessionManager?.addSessionManagerListener(castSessionListener, CastSession::class.java)
        // Pick up a session that's already live (e.g. after a config change).
        castContext?.sessionManager?.currentCastSession?.let {
            castSession = it
            onCastStarted()
        }
    }

    private val castSessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarted(session: CastSession, sessionId: String) {
            castSession = session; onCastStarted()
        }
        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
            castSession = session; onCastStarted()
        }
        override fun onSessionEnded(session: CastSession, error: Int) = onCastStopped()
        override fun onSessionSuspended(session: CastSession, reason: Int) = onCastStopped()
        override fun onSessionStarting(session: CastSession) {}
        override fun onSessionStartFailed(session: CastSession, error: Int) {}
        override fun onSessionEnding(session: CastSession) {}
        override fun onSessionResuming(session: CastSession, sessionId: String) {}
        override fun onSessionResumeFailed(session: CastSession, error: Int) {}
    }

    /** A cast session connected: start conducting; the first tick picks the right UI for what's playing. */
    private fun onCastStarted() {
        castUiMode = "none"
        startConductor()
    }

    /** Cast ended: stop conducting and restore phone audio + normal UI. */
    private fun onCastStopped() {
        stopConductor()
        castSession = null
        lastCastUrl = null
        castUiMode = "none"
        setPhoneVideoMuted(false)
        setCastModeUi(false)
    }

    /** Toggle the page's cast-mode layout (hide video, full-width chat + top bar). */
    private fun setCastModeUi(on: Boolean) {
        evalJs("window.__scSetCastMode && window.__scSetCastMode($on)")
    }

    /** Open the system Cast device chooser — called from the in-page mobile cast button. */
    fun startCasting() {
        castButton?.performClick()
    }

    /** End the active cast session — called from the in-page "Stop Casting" button. */
    fun stopCasting() {
        castContext?.sessionManager?.endCurrentSession(true)
    }

    private fun startConductor() {
        if (conductorRunning) return
        conductorRunning = true
        lastCastUrl = null
        conductorTick()
    }

    private fun stopConductor() {
        conductorRunning = false
        conductorHandler.removeCallbacksAndMessages(null)
    }

    /** Poll the room's current movie/position and reconcile the TV to it, then schedule the next tick. */
    private fun conductorTick() {
        if (!conductorRunning) return
        queryCurrentMedia { media ->
            if (media != null) syncToReceiver(media)
            if (conductorRunning) conductorHandler.postDelayed({ conductorTick() }, CONDUCTOR_INTERVAL_MS)
        }
    }

    /**
     * Ask the page what's playing right now: {type:'video', src, time, paused} for a castable
     * <video>, or {type:'youtube'|'none'}. evaluateJavascript returns a JSON-encoded string, so the
     * result is double-quoted — unwrap it before parsing.
     */
    private fun queryCurrentMedia(cb: (JSONObject?) -> Unit) {
        val js = """
            (function(){
              try {
                var v = document.querySelector('video');
                if (v && (v.currentSrc || v.src)) {
                  return JSON.stringify({type:'video', src:(v.currentSrc||v.src),
                    time:(v.currentTime||0), paused:!!v.paused});
                }
                if (document.querySelector('iframe[src*="youtube"], #ytapiplayer iframe')) {
                  return JSON.stringify({type:'youtube'});
                }
                return JSON.stringify({type:'none'});
              } catch(e) { return JSON.stringify({type:'err'}); }
            })()
        """.trimIndent()
        webView.evaluateJavascript(js) { result ->
            cb(try {
                val unwrapped = JSONTokener(result).nextValue()
                if (unwrapped is String) JSONObject(unwrapped) else null
            } catch (e: Exception) { null })
        }
    }

    /**
     * Reconcile both screens with what the room is playing:
     *  - castable movie  → "cast" mode: chat-only tablet, movie on the TV (load/seek/pause).
     *  - YouTube/other   → "fallback" mode: play it back on the tablet, slate on the TV.
     *  - nothing/unknown → leave whatever's up (avoid thrashing between items).
     */
    private fun syncToReceiver(media: JSONObject) {
        val client = castSession?.remoteMediaClient ?: return
        val type = media.optString("type")
        val url = if (type == "video") castableUrl(media.optString("src")) else null

        when {
            type == "video" && url != null -> {
                applyCastMode("cast")
                castMovieToReceiver(client, url,
                    (media.optDouble("time", 0.0) * 1000).toLong(),
                    media.optBoolean("paused", false))
            }
            type == "youtube" || (type == "video" && url == null) -> applyCastMode("fallback")
            // "none"/"err": between items — keep the current screen state.
        }
    }

    /** Switch the tablet/TV between cast and fallback presentations (only acts on a change). */
    private fun applyCastMode(mode: String) {
        if (castUiMode == mode) return
        castUiMode = mode
        lastCastUrl = null   // force a fresh receiver load after any mode switch
        if (mode == "cast") {
            setCastModeUi(true)          // chat-only tablet
            setPhoneVideoMuted(true)     // movie's audio comes from the TV
        } else {
            setCastModeUi(false)         // normal tablet UI — play the YouTube item here
            // Apply the user's fallback-audio preference (default unmuted) to the device player.
            evalJs("window.__scEnterCastFallback && window.__scEnterCastFallback()")
            showSlateOnReceiver()        // "playing on tablet" card on the TV
        }
    }

    /** (Re)load the movie on the TV when it changes, otherwise correct drift / play-pause. */
    private fun castMovieToReceiver(
        client: com.google.android.gms.cast.framework.media.RemoteMediaClient,
        url: String, roomTimeMs: Long, paused: Boolean
    ) {
        if (url != lastCastUrl) {
            lastCastUrl = url
            val info = MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType("video/mp4")
                .build()
            client.load(
                MediaLoadRequestData.Builder()
                    .setMediaInfo(info).setCurrentTime(roomTimeMs).setAutoplay(!paused).build()
            )
            return
        }
        val state = client.playerState
        if (state == MediaStatus.PLAYER_STATE_PLAYING || state == MediaStatus.PLAYER_STATE_PAUSED) {
            if (kotlin.math.abs(client.approximateStreamPosition - roomTimeMs) > DRIFT_TOLERANCE_MS) {
                client.seek(MediaSeekOptions.Builder().setPosition(roomTimeMs).build())
            }
            if (paused && state == MediaStatus.PLAYER_STATE_PLAYING) client.pause()
            if (!paused && state == MediaStatus.PLAYER_STATE_PAUSED) client.play()
        }
    }

    /** Show the "please wait / playing on tablet" slate image on the TV (served from the LAN proxy). */
    private fun showSlateOnReceiver() {
        val client = castSession?.remoteMediaClient ?: return
        val ip = lanIpAddress() ?: return
        val port = mediaProxy?.port ?: return
        // No metadata title/subtitle — the slate image speaks for itself (and avoids the
        // receiver drawing a text overlay on top of it).
        val info = MediaInfo.Builder("http://$ip:$port/slate")
            .setStreamType(MediaInfo.STREAM_TYPE_NONE)
            .setContentType("image/jpeg")
            .build()
        client.load(MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build())
    }

    /**
     * Turn the phone's <video> src into something the TV can fetch. Drive streams come back pointed
     * at the phone's loopback proxy (127.0.0.1) — rewrite that to the phone's LAN IP so the TV can
     * reach it. Plain http(s) URLs (raw files) pass through. blob:/data: can't be cast → null.
     */
    private fun castableUrl(src: String?): String? {
        val s = src?.trim().orEmpty()
        if (s.isEmpty()) return null
        if (s.contains("127.0.0.1") || s.contains("localhost")) {
            val ip = lanIpAddress() ?: return null
            return s.replace("127.0.0.1", ip).replace("localhost", ip)
        }
        return if (s.startsWith("http://") || s.startsWith("https://")) s else null
    }

    /** First site-local IPv4 address of an up, non-loopback interface (the phone's Wi-Fi/LAN IP). */
    private fun lanIpAddress(): String? {
        try {
            for (iface in java.net.NetworkInterface.getNetworkInterfaces()) {
                if (!iface.isUp || iface.isLoopback) continue
                for (addr in iface.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr is java.net.Inet4Address && addr.isSiteLocalAddress) {
                        return addr.hostAddress
                    }
                }
            }
        } catch (e: Exception) { /* fall through */ }
        return null
    }

    private fun setPhoneVideoMuted(muted: Boolean) {
        evalJs("window.__scSetPlayerMuted && window.__scSetPlayerMuted($muted)")
    }

    /** The "can't be cast" slate JPEG (served to the TV during a YouTube fallback). */
    private fun buildSlateBytes(): ByteArray? {
        return try {
            assets.open("cast_slate.jpg").use { it.readBytes() }
        } catch (e: Exception) { null }
    }

    /**
     * Open a URL in an external web BROWSER (not the WebView, not another app). Used for DRM
     * "YouTube Movies" titles: a real browser has Widevine, so opening the channel page there plays
     * the title inside the full synced Grindhouse room. CATEGORY_BROWSABLE biases toward a browser.
     */
    fun openExternalUrl(url: String) {
        val uri = android.net.Uri.parse(url)
        // Prefer a Widevine-capable browser so DRM titles actually play: Chrome and Firefox
        // (GeckoView) have Widevine; system-WebView-based browsers (e.g. TV Bro) do NOT, so we
        // don't want the user landing there. Try the good ones directly, then fall back to the
        // system's default/chooser, then a clear error.
        for (pkg in listOf("com.android.chrome", "org.mozilla.firefox")) {
            try {
                val i = android.content.Intent(android.content.Intent.ACTION_VIEW, uri).apply {
                    setPackage(pkg)
                    addCategory(android.content.Intent.CATEGORY_BROWSABLE)
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (i.resolveActivity(packageManager) != null) { startActivity(i); return }
            } catch (e: Exception) { /* not installed / can't handle — try next */ }
        }
        try {
            startActivity(
                android.content.Intent(android.content.Intent.ACTION_VIEW, uri).apply {
                    addCategory(android.content.Intent.CATEGORY_BROWSABLE)
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: Exception) {
            android.widget.Toast.makeText(
                this, "No web browser is installed to open the channel", android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

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

    /** Back with no overlay open → background the app (Netflix-style), don't exit hard. */
    fun tvBackground() {
        runOnUiThread { moveTaskToBack(true) }
    }

    // On TV, capture the remote's D-pad / OK / Back and drive the in-page focus
    // navigation in JS. Skipped while the on-screen keyboard is up (so it can be
    // navigated normally) and on non-TV devices.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (isTv && event.action == KeyEvent.ACTION_DOWN && ::webView.isInitialized) {
            val imeUp = ViewCompat.getRootWindowInsets(webView)
                ?.isVisible(WindowInsetsCompat.Type.ime()) ?: false
            if (!imeUp) {
                // A physical keyboard's arrow keys arrive as KEYCODE_DPAD_* exactly like the
                // remote's, but while editing chat they should move the text cursor — not drive
                // remote-style focus navigation out of the field. When the event comes from a
                // real (alphabetic) keyboard and the chat input has focus, let the arrows fall
                // through to the WebView instead of forwarding them to the nav.
                val isArrow = event.keyCode == KeyEvent.KEYCODE_DPAD_UP ||
                    event.keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
                    event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                    event.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT
                if (isArrow && chatInputFocused && isFromPhysicalKeyboard(event)) {
                    return super.dispatchKeyEvent(event)
                }
                val dir = when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP -> "up"
                    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
                    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                    KeyEvent.KEYCODE_DPAD_CENTER -> "center"
                    // Physical keyboard Enter — pass through to WebView when a text field has focus
                    KeyEvent.KEYCODE_ENTER,
                    KeyEvent.KEYCODE_NUMPAD_ENTER -> if (!chatInputFocused) "center" else null
                    KeyEvent.KEYCODE_BACK -> "back"
                    else -> null
                }
                if (dir != null) {
                    webView.evaluateJavascript("window.__scTvKey && window.__scTvKey('$dir')", null)
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    /**
     * True when a key event originated from a real hardware keyboard (alphabetic) rather than a
     * D-pad remote — used to keep keyboard arrow keys editing chat text instead of being hijacked
     * as remote navigation. A TV remote reports KEYBOARD_TYPE_NON_ALPHABETIC; the soft keyboard is
     * virtual, so both are excluded.
     */
    private fun isFromPhysicalKeyboard(event: KeyEvent): Boolean {
        val dev = event.device ?: return false
        return !dev.isVirtual &&
            dev.keyboardType == android.view.InputDevice.KEYBOARD_TYPE_ALPHABETIC
    }

    /** Toggle on-screen keyboard suppression (physical keyboard still works). */
    fun setKeyboardSuppressed(on: Boolean) {
        webView.suppressIme = on
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.restartInput(webView)                 // re-query the editor state now
        if (on) imm.hideSoftInputFromWindow(webView.windowToken, 0)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // Allow inspecting the WebView from desktop Chrome via chrome://inspect — debug builds only
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = userAgentString
                .replace(Regex("Version/\\S+\\s"), "")
                .replace(" wv", "")
        }
        // Reused by the Drive stream proxy: Google's videoplayback 403s non-browser UAs
        // (the default Dalvik UA), so native fetches must present this browser UA.
        webViewUa = webView.settings.userAgentString

        webView.addJavascriptInterface(CytubeJsBridge(this, prefs), "CytubeNative")

        // Tell CyTube the Drive userscript is present BEFORE its own scripts run, so the
        // currently-playing Drive video isn't rejected during the race before our main
        // script injects (which only happens at onPageFinished). Early calls are queued and
        // drained by the real implementation in cytube_mobile.js. No native bridge needed here.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, DRIVE_EARLY_STUB, setOf("*"))
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                setLoadingStatus("Loading channel…")
            }
            override fun onPageFinished(view: WebView, url: String) {
                pageLoaded = true
                setLoadingStatus("Preparing…")
                injectScript()
            }
            // Drive streams are no longer intercepted here — the injected JS points them at the
            // localhost LocalMediaProxy instead, so the WebView can SEEK against a real HTTP server
            // (shouldInterceptRequest can only stream linearly, which broke CyTube's sync-seek).
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                customViewCallback?.onCustomViewHidden()
                customViewCallback = callback
                fullscreenContainer.addView(view)
                fullscreenContainer.visibility = View.VISIBLE
                webView.visibility = View.GONE
            }

            override fun onHideCustomView() {
                fullscreenContainer.removeAllViews()
                fullscreenContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
            }

            // Mirror page console output to logcat (debug builds) so we can debug the
            // injected script from `adb logcat -s GrindhouseWeb`.
            override fun onConsoleMessage(msg: android.webkit.ConsoleMessage): Boolean {
                if (BuildConfig.DEBUG) {
                    android.util.Log.d(
                        "GrindhouseWeb",
                        "${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})"
                    )
                }
                return true
            }
        }
    }

    private fun injectScript() {
        val script = assets.open("cytube_mobile.js").bufferedReader().readText()
        webView.evaluateJavascript(script, null)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private val isTv: Boolean by lazy {
        packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK) ||
        packageManager.hasSystemFeature("android.hardware.type.television") ||
        (getSystemService(UI_MODE_SERVICE) as android.app.UiModeManager)
            .currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
    }

    /** Authoritative TV check, exposed to the injected JS via the bridge. */
    fun isTvDevice(): Boolean = isTv

    /** True when a physical keyboard is connected (drives the soft-keyboard default). */
    fun hasHardwareKeyboard(): Boolean =
        resources.configuration.keyboard != Configuration.KEYBOARD_NOKEYS

    fun enterPip() {
        if (isTv) return
        // Switch to a video-only layout BEFORE the window is captured, so PiP shows
        // just the movie (full-bleed) instead of the whole UI with black margins.
        evalJs("document.body && document.body.classList.add('sc-pip')")
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .build()
        enterPictureInPictureMode(params)
    }

    override fun onUserLeaveHint() {
        if (!isTv) enterPip()
    }

    override fun onPictureInPictureModeChanged(isInPipMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPipMode, newConfig)
        // Keep the full-bleed video while in PiP; restore the full UI when expanded.
        evalJs("document.body && document.body.classList.toggle('sc-pip', $isInPipMode)")
        if (!isInPipMode) {
            // Don't pop the info card just because we came back from PiP.
            evalJs("var c=document.getElementById('sc-np-card'); if(c)c.classList.remove('sc-np-visible');")
        }
    }

    // When the app is no longer visible (Home pressed, or PiP dismissed) freeze the
    // WebView completely — pauses video, all JS/timers, and lets the chat socket go
    // idle so nothing runs in the background. onStop is NOT called while in PiP, so
    // PiP keeps playing. Everything resumes (and re-syncs) when the app returns.
    override fun onStop() {
        super.onStop()
        if (::webView.isInitialized) {
            webView.onPause()
            webView.pauseTimers()
            stoppedAtMs = SystemClock.elapsedRealtime()
        }
    }

    override fun onStart() {
        super.onStart()
        if (::webView.isInitialized) {
            webView.resumeTimers()
            webView.onResume()
            // Returning from the background: during a long suspend the socket times out and the
            // in-page player object goes dead. CyTube re-syncs chat + the title on reconnect, but
            // PLAYER.load() no-ops against the dead player, so the old video keeps playing forever.
            // Ask the injected script to check the player on reconnect and rebuild ONLY it when
            // it's actually stale (wrong/stuck media) — never on a healthy resume, so quick
            // app-switches aren't disrupted. Posted so it runs once the window has settled.
            if (stoppedAtMs > 0L) {
                stoppedAtMs = 0L
                webView.post {
                    webView.evaluateJavascript("window.__scStaleResync && window.__scStaleResync()", null)
                }
            }
            // While backgrounded the chat textarea keeps DOM focus, so on wake Chromium
            // re-pops the soft keyboard over the video. Drop focus from any editable and
            // hide the IME. Posted so it runs once the window/IME state has settled.
            webView.post {
                webView.evaluateJavascript(
                    "(function(){var a=document.activeElement;" +
                        "if(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))a.blur();})()",
                    null
                )
                val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                imm.hideSoftInputFromWindow(webView.windowToken, 0)
            }
        }
    }

    override fun onDestroy() {
        mediaProxy?.stop()
        mediaProxy = null
        stopConductor()
        // Casting depends on this app being alive (it's the sync conductor + Drive relay), so
        // when the app closes, stop the cast too — otherwise the TV keeps showing it as "casting".
        if (isFinishing) castContext?.sessionManager?.endCurrentSession(true)
        castContext?.sessionManager?.removeSessionManagerListener(
            castSessionListener, CastSession::class.java
        )
        super.onDestroy()
    }
}