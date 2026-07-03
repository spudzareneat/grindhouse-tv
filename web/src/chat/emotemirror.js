/* ==========================================================
   EMOTE MIRROR
========================================================== */

export const emoteState = {
    watchInterval: null,
    lastChatlineValue: '',
};

export function startEmoteWatcher(originalInput, textarea) {
    if (emoteState.watchInterval) return;
    emoteState.watchInterval = setInterval(() => {
        const current = originalInput.value;
        if (current !== emoteState.lastChatlineValue) {
            textarea.value = current; emoteState.lastChatlineValue = current;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            textarea.dispatchEvent(new Event('input'));
        }
    }, 80);
}
