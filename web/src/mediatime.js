// Current media duration/type — from CyTube's socket, with a playlist fallback.
// Live playhead position, kept fresh by CyTube's mediaUpdate socket event so the
// remote-summoned progress card works for every media type (YouTube/Drive/raw).
export const mediaState = {
    currentMediaSeconds: 0,
    currentMediaType: '',
    currentYtVideoId: '',  // 'yt' media's video id, from changeMedia -- for the oEmbed fallback
    currentPlaybackTime: 0,
    // Room's live playhead, tracked ONLY while desynced (chrome/buttons.js) via a dedicated
    // mediaUpdate listener registered after freezeSync() empties the normal one -- see that
    // file's comment. null = no tick received yet this desync session.
    desyncLiveSeconds: null,
    desyncLiveAt: 0,
    desyncLivePaused: false,
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
// The room's live playhead while desynced, extrapolated lightly between ~1Hz mediaUpdate
// ticks (not frame-accurate -- fine for "jump to live" / "don't seek past live", not for
// tight sync). null until the first tick lands this desync session.
export function getDesyncLiveSeconds() {
    if (mediaState.desyncLiveSeconds == null) return null;
    if (mediaState.desyncLivePaused) return mediaState.desyncLiveSeconds;
    return mediaState.desyncLiveSeconds + Math.max(0, (Date.now() - mediaState.desyncLiveAt) / 1000);
}
export function formatHMS(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
