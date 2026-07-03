// Tell native Kotlin whether the WebView should keep physical-keyboard Enter
// (so it sends/confirms) instead of routing it to the TV remote "center" action.
// True when the chat textarea has focus, OR when the spell-check review modal is
// open (it handles Enter = Send itself). Called on every focus/blur and modal change.
export function syncNativeInputFocus() {
    const a = document.activeElement;
    const inField = !!a && (a.id === 'sc-chat-textarea' || a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
    const modalOpen = !!document.getElementById('sc-modal-overlay');
    try { if (window.CytubeNative) CytubeNative.setChatInputFocused(inField || modalOpen); } catch (e) {}
}
window.__scSyncInputFocus = syncNativeInputFocus;
