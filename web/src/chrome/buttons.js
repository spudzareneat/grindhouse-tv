import { mediaState } from '../mediatime.js';
import { tvNavState } from '../tvnav.js';
import { onSocket } from '../socket.js';

/* ==========================================================
   FLOATING BUTTONS
   Appended to document.body so they're never inside #leftcontrols
   and can't be accidentally hidden with it.
========================================================== */

/* ==========================================================
   DESYNC BUTTON — temporarily pause CyTube's sync
========================================================== */

// Socket.IO v2/v3 stores listeners under _callbacks['$eventName']
// Socket.IO v4 stores them under _events or via listeners()
export function getMediaUpdateListeners() {
    const key = '$mediaUpdate';
    if (socket._callbacks?.[key]) return { store: '_callbacks', key };
    if (socket._events?.mediaUpdate) return { store: '_events', key: 'mediaUpdate' };
    return null;
}

export function initDesyncButton() {
    const btn = document.createElement('button');
    btn.id = 'sc-desync-btn';
    btn.textContent = '⟳';
    btn.title = 'Free watch — click to watch freely, click again to re-sync';
    btn.dataset.tvLabel = 'Free Watch';
    document.body.appendChild(btn);

    let desynced = false;
    let savedListeners = null;

    // Freezing sync only empties the socket's mediaUpdate JS callback array (see freezeSync
    // below) -- it never unsubscribes from the event or leaves the room, so the server keeps
    // broadcasting regardless. Registering THIS listener via the normal socket.on() API, after
    // freezeSync() has already cleared the slot, means it keeps receiving every tick without
    // ever touching playback -- it only records the room's real position, for the seek-hud
    // readout and the OK-jump-to-live/forward-cap behavior in tvnav.js. Mirrors the same
    // wrap-the-mediaUpdate-slot trick player/leadtime.js already ships.
    function trackLiveRoomPosition(data) {
        if (data && typeof data.currentTime === 'number') {
            mediaState.desyncLiveSeconds = data.currentTime;
            mediaState.desyncLiveAt = Date.now();
        }
        if (data && typeof data.paused === 'boolean') mediaState.desyncLivePaused = data.paused;
    }

    const freezeSync = () => {
        const loc = getMediaUpdateListeners();
        if (!loc) {
            console.warn('[CyTube SC] Could not find mediaUpdate listeners to freeze');
            return;
        }
        if (loc.store === '_callbacks') {
            savedListeners = socket._callbacks[loc.key].slice();
            socket._callbacks[loc.key] = [];
        } else {
            savedListeners = socket._events[loc.key];
            delete socket._events[loc.key];
        }
        console.log('[CyTube SC] Sync frozen — removed', savedListeners?.length ?? 1, 'mediaUpdate listener(s)');
    };

    const thawSync = () => {
        if (!savedListeners) return;
        const loc = getMediaUpdateListeners();
        if (loc?.store === '_callbacks') {
            socket._callbacks[loc.key] = savedListeners;
        } else {
            socket._events = socket._events || {};
            socket._events['mediaUpdate'] = savedListeners;
        }
        savedListeners = null;
        console.log('[CyTube SC] Sync restored');
        // Trigger immediate resync
        if (typeof socket !== 'undefined' && socket) {
            socket.emit('playerReady');
        }
    };

    function turnOn() {
        freezeSync();
        mediaState.desyncLiveSeconds = null; mediaState.desyncLivePaused = false; // fresh session
        try { socket.on('mediaUpdate', trackLiveRoomPosition); } catch (e) {}
        btn.classList.add('sc-desync-active');
        btn.title = 'Free watch ON — click to re-sync';
        // Jump the D-pad ring straight to the scrubber -- no more hunting for it across
        // the control bar every time desync turns on.
        const bar = document.querySelector('#videowrap .vjs-control-bar .vjs-progress-control');
        if (bar && tvNavState.setFocus) tvNavState.setFocus(bar);
    }
    function turnOff() {
        try { socket.off('mediaUpdate', trackLiveRoomPosition); } catch (e) {}
        thawSync();
        mediaState.desyncLiveSeconds = null; // stale/meaningless once resynced
        btn.classList.remove('sc-desync-active');
        btn.title = 'Free watch — click to watch freely';
    }

    btn.addEventListener('click', () => {
        if (typeof socket === 'undefined' || !socket) return;
        desynced = !desynced;
        if (desynced) turnOn(); else turnOff();
    });

    // Auto-resync when the room moves on to a genuinely different video. Desync only
    // freezes the *mediaUpdate* callback array (see freezeSync above) -- changeMedia
    // (which actually swaps the player to the new source) is untouched and still fires
    // normally, but every mediaUpdate afterward (the new video's actual play-state/
    // position) would then be silently dropped with nothing left to correct it, so a
    // viewer who leaves free-watch on across a media change can get stuck on a paused
    // or misplaced new video with no way to notice or recover short of realizing free-
    // watch is still on. Same (id + title) dedup key resync.js already uses so a mere
    // reconnect re-announcing the SAME video doesn't falsely kick someone out of a seek
    // they're mid-way through.
    let _lastMediaKey = '';
    onSocket('changeMedia', (data) => {
        const key = (data && (data.id || '')) + '|' + (data && (data.title || ''));
        if (key === _lastMediaKey) return;
        _lastMediaKey = key;
        if (desynced) { desynced = false; turnOff(); }
    });
}

export function addFloatingButtons() {
    if (document.getElementById('fs-toggle-btn')) return;

    const fsBtn = document.createElement('button');
    fsBtn.id = 'fs-toggle-btn'; fsBtn.textContent = '⛶'; fsBtn.title = 'Toggle Fullscreen';
    fsBtn.addEventListener('click', () => {
        document.fullscreenElement
            ? document.exitFullscreen().catch(() => {})
            : document.documentElement.requestFullscreen().catch(() => {});
    });
    document.body.appendChild(fsBtn);

    document.addEventListener('fullscreenchange', () => {
        fsBtn.style.display = document.fullscreenElement ? 'none' : '';
    });
}

// Cast button — a mobile-only sender control that sits in the fly-out cluster under
// the settings gear and opens the system Cast device chooser. Never shown on TV (a TV
// is the cast target, not a sender). Queries the bridge directly rather than the isTv
// const, which may not be initialised yet when _scBoot() runs.
export function addCastButton() {
    let onTv = false;
    try { onTv = !!(window.CytubeNative && CytubeNative.isTv && CytubeNative.isTv()); } catch (e) {}
    if (onTv) return;
    if (document.getElementById('sc-cast-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'sc-cast-btn';
    btn.type = 'button';
    btn.title = 'Cast to TV';
    btn.dataset.tvLabel = 'Cast';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
        '<path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>';
    btn.addEventListener('click', function () {
        try { if (window.CytubeNative && CytubeNative.startCasting) CytubeNative.startCasting(); } catch (e) {}
    });
    document.body.appendChild(btn);
}
