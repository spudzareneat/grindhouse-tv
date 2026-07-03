// Summon the video.js control bar — the scrubber a mouse gets on hover — and let
// video.js's own inactivity timer fade it back out. Raw/Drive/video.js players only;
// a YouTube embed manages its own controls, so this no-ops there.
export function wakeVideoControls() {
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.userActive === 'function') {
            p.userActive(true);
            if (typeof p.reportUserActivity === 'function') p.reportUserActivity();
            return;
        }
    } catch (e) { /* fall through to class toggle */ }
    const el = document.querySelector('#videowrap .video-js');
    if (el) { el.classList.add('vjs-user-active'); el.classList.remove('vjs-user-inactive'); }
}
// Pin the scrubber up (it normally auto-fades) for as long as a title-bar item is
// selected on the remote; hide it again the moment focus moves off.
let _scrubHoldTimer = null;
export function holdScrubber(on) {
    if (on) {
        wakeVideoControls();
        // video.js fades after ~2s idle, so refresh activity well inside that window.
        if (!_scrubHoldTimer) _scrubHoldTimer = setInterval(wakeVideoControls, 1000);
        return;
    }
    if (!_scrubHoldTimer) return;   // we weren't holding — don't touch the controls
    clearInterval(_scrubHoldTimer);
    _scrubHoldTimer = null;
    // We summoned the scrubber for the title bar; dismiss it now that focus has left.
    // (video.js won't auto-fade a paused video, so hide it explicitly.)
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.userActive === 'function') p.userActive(false);
    } catch (e) {}
    const el = document.querySelector('#videowrap .video-js');
    if (el) { el.classList.add('vjs-user-inactive'); el.classList.remove('vjs-user-active'); }
}
