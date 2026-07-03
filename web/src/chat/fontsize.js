import { getKey, LS_CHAT_FONT } from '../store.js';

// Chat font size — user-set via the settings slider, applied to #messagebuffer
export function getChatFontSize() {
    const v = parseInt(getKey(LS_CHAT_FONT), 10);
    if (Number.isFinite(v) && v >= 10 && v <= 32) return v;
    return document.body && document.body.classList.contains('sc-tv') ? 18 : 14;
}
export function applyChatFontSize(px) {
    const buf = document.getElementById('messagebuffer');
    if (buf) buf.style.setProperty('font-size', px + 'px', 'important');
    // The chat input matches the message font (overlay keeps its compact size)
    const ta = document.getElementById('sc-chat-textarea');
    if (ta) {
        const overlay = document.body && document.body.classList.contains('sc-chat-overlay');
        ta.style.setProperty('font-size', (overlay ? 13 : px) + 'px', 'important');
    }
}
