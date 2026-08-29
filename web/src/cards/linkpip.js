/* ==========================================================
   LINK PIP PANEL — a floating YouTube preview, opened by chat/linkpip.js's
   confirm popup. NOT the same thing as Android's native OS-level
   Picture-in-Picture (MainActivity.kt's enterPip()/the sc-pip body class) --
   this is a new in-page floating panel, namespaced sc-link-pip-* to avoid
   confusion with that. Ported from the desktop userscript's link-pip module,
   minus its click-to-activate trigger (see chat/linkpip.js for the
   remote-first replacement) and drag-to-reposition (a touch/mouse nicety,
   not needed for D-pad/tap use here).
========================================================== */

export function extractYouTubeId(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
            if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
            if (u.pathname === '/watch' && u.searchParams.has('v')) return u.searchParams.get('v');
        }
        return null;
    } catch (e) { return null; }
}

export function isPipLink(url) { return !!extractYouTubeId(url); }

// Mute only (no pause) -- the main player keeps playing behind the panel. Mirrors the
// dual video.js/native-<video> fallback chain chat/modes.js's chat-only mode already
// uses for the same mute/restore need.
function mutePlayer() {
    try {
        const vid = document.querySelector('#videowrap video');
        if (vid) {
            const state = { kind: 'video', muted: vid.muted };
            vid.muted = true;
            return state;
        }
    } catch (e) {}
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p) {
            const wasMuted = typeof p.isMuted === 'function' ? !!p.isMuted() :
                (typeof p.muted === 'function' ? !!p.muted() : false);
            if (typeof p.mute === 'function') p.mute();
            else if (typeof p.muted === 'function') p.muted(true);
            return { kind: 'wrapper', muted: wasMuted };
        }
    } catch (e) {}
    return null;
}

function restorePlayer(state) {
    if (!state || state.muted) return; // was already muted before we touched it -- leave it be
    if (state.kind === 'video') {
        try { const vid = document.querySelector('#videowrap video'); if (vid) vid.muted = false; } catch (e) {}
        return;
    }
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p) {
            if (typeof p.unMute === 'function') p.unMute();
            else if (typeof p.muted === 'function') p.muted(false);
        }
    } catch (e) {}
}

let _pipMuteState = null;
let _outsideClickHandler = null;

export function openLinkPip(url) {
    const id = extractYouTubeId(url);
    if (!id) return;
    closeLinkPip(); // one window at a time
    let panel = document.getElementById('sc-link-pip-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'sc-link-pip-panel';
        panel.innerHTML = `
            <div id="sc-link-pip-head">
                <span>Preview</span>
                <button id="sc-link-pip-close" type="button">✕</button>
            </div>
            <div id="sc-link-pip-body"></div>`;
        document.body.appendChild(panel);
        panel.querySelector('#sc-link-pip-close').addEventListener('click', closeLinkPip);
    }
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.className = 'sc-link-pip-frame';
    iframe.setAttribute('frameborder', '0');
    const body = panel.querySelector('#sc-link-pip-body');
    body.innerHTML = '';
    body.appendChild(iframe);
    panel.classList.add('sc-link-pip-visible');

    _outsideClickHandler = (e) => { if (!panel.contains(e.target)) closeLinkPip(); };
    setTimeout(() => document.addEventListener('click', _outsideClickHandler, true), 0);

    _pipMuteState = mutePlayer();
}

export function closeLinkPip() {
    const panel = document.getElementById('sc-link-pip-panel');
    if (panel) {
        panel.classList.remove('sc-link-pip-visible');
        const body = panel.querySelector('#sc-link-pip-body');
        if (body) body.innerHTML = ''; // drop the iframe -- clearing src alone doesn't reliably stop audio
    }
    if (_outsideClickHandler) { document.removeEventListener('click', _outsideClickHandler, true); _outsideClickHandler = null; }
    if (_pipMuteState) { restorePlayer(_pipMuteState); _pipMuteState = null; }
}
