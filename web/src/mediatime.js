// Current media duration/type — from CyTube's socket, with a playlist fallback.
// Live playhead position, kept fresh by CyTube's mediaUpdate socket event so the
// remote-summoned progress card works for every media type (YouTube/Drive/raw).
export const mediaState = {
    currentMediaSeconds: 0,
    currentMediaType: '',
    currentPlaybackTime: 0,
};

function parseTimeToSeconds(t) {
    const parts = String(t).trim().split(':').map(Number);
    if (!parts.length || parts.some(isNaN)) return 0;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
}
export function getCurrentMediaSeconds() {
    if (mediaState.currentMediaSeconds > 0) return mediaState.currentMediaSeconds;
    const el = document.querySelector('#queue .queue_active .qe_time, #queue .queue_entry.active .qe_time');
    if (el) {
        const t = parseTimeToSeconds(el.textContent);
        if (t > 0) return t;
    }
    // Last resort: the actual <video> element's own reported duration -- real and accurate
    // (confirmed live 2026-07-19 on the sibling userscript against the true remaining runtime)
    // whenever a same-origin file plays directly, covering exactly what the two checks above
    // miss: the WebView (re)loaded mid-movie, before any changeMedia event has arrived to
    // populate mediaState.currentMediaSeconds. Doesn't help for YouTube -- that player's video
    // element, when present at all, reports the iframe's own internal state inconsistently for
    // this purpose -- so that case still falls through to 0, same as before.
    const v = document.querySelector('#videowrap video');
    if (v && isFinite(v.duration) && v.duration > 0) return v.duration;
    return 0;
}
// Current playhead in seconds — the live <video> when present (raw/Drive), otherwise
// the last position CyTube broadcast via mediaUpdate (YouTube and other embeds).
export function getCurrentPlaybackSeconds() {
    const v = document.querySelector('#videowrap video');
    if (v && isFinite(v.currentTime) && v.currentTime > 0) return v.currentTime;
    return mediaState.currentPlaybackTime;
}
export function formatHMS(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
