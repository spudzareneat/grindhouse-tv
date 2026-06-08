package com.grindhouse.cytube

import android.content.Context
import android.text.InputType
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.WebView

/**
 * WebView that can suppress the on-screen (soft) keyboard while still accepting
 * input from a physical keyboard.
 *
 * Two suppression paths, since Chromium WebView is inconsistent about which it uses:
 *  - onCheckIsTextEditor() returns false      → IME framework won't treat us as editable
 *  - onCreateInputConnection() sets TYPE_NULL → no soft keyboard, hardware keys still flow
 */
class NoImeWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : WebView(context, attrs) {

    var suppressIme = false

    override fun onCheckIsTextEditor(): Boolean =
        if (suppressIme) false else super.onCheckIsTextEditor()

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val ic = super.onCreateInputConnection(outAttrs)
        // Tell the IME there's no soft input to show; hardware keys still dispatch.
        if (suppressIme) outAttrs.inputType = InputType.TYPE_NULL
        return ic
    }
}
