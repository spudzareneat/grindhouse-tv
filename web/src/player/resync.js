import { mediaState } from '../mediatime.js';
import { movieState } from '../metadata/tmdb.js';
import { npState } from '../cards/nowplaying.js';
import { triggerTitleInject } from '../titleinject.js';
import { drmState, hideDrmOverlay, checkYtDrm } from './drm.js';

// Capture media duration + type from CyTube's socket so we can tell a
// full-length YouTube movie from a short bumper. Re-runs the lookup on change.
export function initMediaWatcher() {
    if (typeof socket === 'undefined' || !socket || typeof socket.on !== 'function') {
        setTimeout(initMediaWatcher, 600);
        return;
    }
    let _lastMediaKey = '';
    let _lastChangeMediaData = null;
    let _roomPaused = false;
    let _resyncArmed = false;
    let _resyncTimer = null;

    // Duration (seconds) of the media the player has ACTUALLY loaded — YouTube via its API
    // (the iframe is cross-origin, so a <video> query can't reach inside it), everything
    // else via the <video> element. This is ground truth for "what's really playing".
    const renderedDuration = () => {
        try { const p = window.PLAYER; if (p && p.yt && typeof p.yt.getDuration === 'function') { const d = p.yt.getDuration(); if (d > 0) return d; } } catch (e) {}
        try { const v = document.querySelector('#ytapiplayer video, video'); if (v && v.duration > 0 && isFinite(v.duration)) return v.duration; } catch (e) {}
        return null;
    };
    // Current playhead position (seconds), same source priority as renderedDuration.
    const playheadProbe = () => {
        try { const p = window.PLAYER; if (p && p.yt && typeof p.yt.getCurrentTime === 'function') { const t = p.yt.getCurrentTime(); if (typeof t === 'number') return t; } } catch (e) {}
        try { const v = document.querySelector('#ytapiplayer video, video'); if (v && typeof v.currentTime === 'number') return v.currentTime; } catch (e) {}
        return null;
    };
    // Rebuild ONLY the in-page player from a changeMedia payload. CyTube's loadMediaPlayer
    // constructs a fresh player object (replacing window.PLAYER) and seeks it to the room's
    // sync position — exactly what a dead player needs, with no page reload (chat/UI stay put).
    const rebuildPlayer = (d) => {
        try { if (typeof loadMediaPlayer === 'function' && d) loadMediaPlayer(d); } catch (e) {}
    };
    // Rebuild the player ONLY if it's genuinely stale — never on a healthy resume. Two
    // signals, both judged only while the room is PLAYING (a still playhead is normal when
    // paused): (1) the loaded media's duration doesn't match the room's current media length
    // — the classic "old movie keeps playing after the room moved on"; (2) right media but
    // the playhead isn't advancing — a stuck/dead player. A healthy resume (right media,
    // advancing) matches on duration and is left completely untouched.
    const maybeRebuildIfStale = () => {
        try {
            const d = _lastChangeMediaData;
            if (!d || _roomPaused) return;
            const expected = (typeof d.seconds === 'number' && d.seconds > 0) ? d.seconds : null;
            const rendered = renderedDuration();
            if (expected != null && rendered != null && Math.abs(rendered - expected) > 4) {
                rebuildPlayer(d);              // (1) wrong media loaded
                return;
            }
            const t1 = playheadProbe();        // (2) right media — is the playhead advancing?
            if (t1 == null) return;
            setTimeout(() => {
                if (_roomPaused) return;
                const t2 = playheadProbe();
                if (t2 != null && Math.abs(t2 - t1) < 0.25) rebuildPlayer(d);
            }, 2000);
        } catch (e) {}
    };
    // Called by native (MainActivity.onStart) when the app returns from the background, and
    // self-triggered on socket reconnect. The player object dies during a long suspend; on
    // return CyTube re-syncs chat + the title, but its PLAYER.load() no-ops against the dead
    // player so the OLD video plays forever. We arm a one-shot staleness check that runs once
    // the reconnect's fresh changeMedia has refreshed our notion of the room's current media,
    // so we rebuild ONLY when the player is actually dead — never on a healthy resume. Older
    // builds without loadMediaPlayer fall back to a full reload so playback still recovers.
    //
    // The safety timer below is a fallback for "no changeMedia ever arrives" — but
    // _lastChangeMediaData is only trustworthy once the socket has actually reconnected;
    // firing early would rebuild against whatever was playing BEFORE the app backgrounded,
    // i.e. restart an old movie the room has since moved past. So if the timer fires while
    // still disconnected, re-arm instead of acting — up to a cap, past which something is
    // genuinely wrong and a full reload is safer than trusting stale data indefinitely.
    let _reconnectWaitAttempts = 0;
    const MAX_RECONNECT_WAIT_ATTEMPTS = 6; // 6 * 10s = 60s of waiting for reconnect
    const armStaleCheck = () => {
        if (typeof loadMediaPlayer !== 'function') { location.reload(); return; }
        _resyncArmed = true;
        clearTimeout(_resyncTimer);
        _resyncTimer = setTimeout(() => {
            if (!_resyncArmed) return;
            if (socket.connected === false) {
                if (++_reconnectWaitAttempts >= MAX_RECONNECT_WAIT_ATTEMPTS) { location.reload(); return; }
                armStaleCheck();
                return;
            }
            _resyncArmed = false;
            _reconnectWaitAttempts = 0;
            maybeRebuildIfStale();
        }, 10000);
    };
    window.__scStaleResync = armStaleCheck;

    socket.on('changeMedia', (data) => {
        try {
            _lastChangeMediaData = data;
            if (data && typeof data.paused === 'boolean') _roomPaused = data.paused;
            // First changeMedia after a resume/reconnect: the room's current media is now
            // known. Give the player a few seconds to actually switch, then judge staleness.
            if (_resyncArmed) {
                _resyncArmed = false;
                _reconnectWaitAttempts = 0;
                clearTimeout(_resyncTimer);
                setTimeout(maybeRebuildIfStale, 4000);
            }
            mediaState.currentMediaSeconds = (data && typeof data.seconds === 'number') ? data.seconds : 0;
            mediaState.currentMediaType    = (data && data.type) ? data.type : '';
            // Only treat this as a NEW film when the media actually changed —
            // CyTube re-emits changeMedia on reconnect/resume (e.g. coming back
            // from PiP), which must not re-trigger the lookup/announcement card.
            const key = (data && (data.id || '')) + '|' + (data && (data.title || ''));
            if (key !== _lastMediaKey) {
                _lastMediaKey = key;
                movieState.lastMovieTitle = '';                 // force a fresh lookup
                // Forget the previous film's metadata up front so the title observer
                // can't rebuild a stale Trivia button over the next video (e.g. a short
                // bumper with no trivia). It's recreated only once the new lookup lands
                // on a real movie. Drop the button now too in case one is showing.
                npState.data = null;
                const _staleTrivia = document.getElementById('sc-trivia-btn');
                if (_staleTrivia) _staleTrivia.remove();
                // New media: drop any DRM overlay, and (for YouTube) start watching for the
                // no-Widevine failure that DRM "YouTube Movies" titles hit on this device.
                clearTimeout(drmState.checkTimer);
                hideDrmOverlay();
                if (mediaState.currentMediaType === 'yt') drmState.checkTimer = setTimeout(() => checkYtDrm(0), 1500);
            }
            // Always re-run title injection, even for a repeat changeMedia of the SAME
            // film: CyTube re-renders the title header's DOM on every changeMedia
            // (including reconnect re-syncs, e.g. resuming after a long background),
            // which wipes out our injected clean-title span. injectMovieLinks() detects
            // the unchanged title and reapplies the cached clean title cheaply — no
            // network re-lookup — instead of leaving the raw filename on screen.
            setTimeout(triggerTitleInject, 350); // let the title DOM settle first
        } catch (e) {}
    });
    // Keep the live playhead fresh for the progress card (fires ~every second while
    // the room is synced; the desync "free watch" toggle strips these listeners, which
    // is fine — the synced position is meaningless then anyway).
    socket.on('mediaUpdate', (data) => {
        if (data && typeof data.currentTime === 'number') mediaState.currentPlaybackTime = data.currentTime;
        if (data && typeof data.paused === 'boolean') _roomPaused = data.paused;
    });
    // Genuine network drops (not just app suspends) can also leave a dead player behind, so
    // re-run the staleness check whenever the socket reconnects. Harmless when it's healthy.
    let _wasDisconnected = false;
    socket.on('disconnect', () => { _wasDisconnected = true; });
    socket.on('connect', () => { if (_wasDisconnected) { _wasDisconnected = false; armStaleCheck(); } });
    // The video already playing at launch never fires changeMedia, so check it once.
    setTimeout(() => { if (window.PLAYER && window.PLAYER.mediaType === 'yt') checkYtDrm(0); }, 2500);
}
