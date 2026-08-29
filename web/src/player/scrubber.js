// video.js runs its own ~2s mouse-inactivity timer that fades .vjs-control-bar
// independently of this app's own TV chrome auto-hide (sc-chrome-hidden, a 4s idle
// timer — see chat/modes.js's initChromeAutohide, which also drives the docked
// settings/desync/chatmode buttons). Two independent timers meant the scrubber could
// visibly disappear before those buttons did. Disabling video.js's own timeout makes
// our own sc-chrome-hidden system the single source of truth for both — the scrubber
// then only changes opacity via that shared CSS trigger, same as the buttons.
// Explicit calls (wakeVideoControls/holdScrubber below, driven by focus) are
// untouched by this — they set userActive state directly, not through the timer.
export function neutralizeVjsInactivityTimer() {
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.options === 'function') p.options({ inactivityTimeout: 0 });
    } catch (e) {}
}

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
// selected on the remote.
//
// holdScrubber(false) deliberately does NOT force the bar back to
// vjs-user-inactive anymore (it used to -- "dismiss it now that focus has left").
// video.js's own vjs-user-inactive class drives its native CSS opacity fade
// completely independently of this app's own sc-chrome-hidden system (the shared
// 4s idle trigger that also drives the docked settings/desync/chatmode buttons --
// see chat/modes.js's initChromeAutohide and neutralizeVjsInactivityTimer above).
// Forcing vjs-user-inactive the instant focus left the title bar meant the
// scrubber could vanish immediately while those buttons stayed lit for the full
// 4s idle window -- exactly the desync this whole file exists to prevent. Letting
// go here just stops the interval that was keeping it pinned; sc-chrome-hidden's
// own timer is now the only thing that ever hides it, same as everything else.
let _scrubHoldTimer = null;
export function holdScrubber(on) {
    if (on) {
        wakeVideoControls();
        // video.js's own timer is neutralized (see above), but reportUserActivity()
        // still resets its internal "last activity" bookkeeping, which matters if
        // anything else ever re-enables the timeout -- refresh well inside the old
        // ~2s window regardless.
        if (!_scrubHoldTimer) _scrubHoldTimer = setInterval(wakeVideoControls, 1000);
        return;
    }
    if (!_scrubHoldTimer) return;   // we weren't holding — don't touch the controls
    clearInterval(_scrubHoldTimer);
    _scrubHoldTimer = null;
}
