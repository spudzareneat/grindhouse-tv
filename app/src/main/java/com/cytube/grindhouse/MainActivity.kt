package com.grindhouse.cytube

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.PictureInPictureParams
import android.content.SharedPreferences
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class MainActivity : AppCompatActivity() {

    private lateinit var webView: NoImeWebView
    private lateinit var fullscreenContainer: FrameLayout
    private lateinit var prefs: SharedPreferences
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private lateinit var loadingOverlay: ImageView
    private lateinit var loadingContainer: View
    private var loadingPulse: ObjectAnimator? = null
    private var loadingHidden = false

    // Keep the branded splash up until CyTube's first page load (or an 8s safety cap)
    @Volatile private var pageLoaded = false
    private val splashStart = System.currentTimeMillis()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        splash.setKeepOnScreenCondition {
            !pageLoaded && System.currentTimeMillis() - splashStart < 8000L
        }
        super.onCreate(savedInstanceState)

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
        startLoadingPulse()

        setupWebView()
        webView.loadUrl("https://cytu.be/r/420Grindhouse")

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
                val dir = when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP -> "up"
                    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
                    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                    KeyEvent.KEYCODE_DPAD_CENTER,
                    KeyEvent.KEYCODE_ENTER,
                    KeyEvent.KEYCODE_NUMPAD_ENTER -> "center"
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

        webView.addJavascriptInterface(CytubeJsBridge(this, prefs), "CytubeNative")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                pageLoaded = true
                injectScript()
            }
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
}