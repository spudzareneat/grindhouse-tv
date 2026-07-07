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
