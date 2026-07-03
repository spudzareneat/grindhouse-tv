/* ==========================================================
   YOUTUBE DRM FALLBACK (YouTube Movies)
   This WebView has no Widevine CDM, so DRM-protected YouTube
   "Movies" titles fail with errorCode 'fmt.noneavailable'.
   Detect that and show a friendly overlay that offers to open
   the video externally (the native YouTube app/browser can
   decrypt it). See [[google-drive-playback-debug]] sibling notes.
========================================================== */
export const drmState = { checkTimer: null };

function openExternalUrl(url) {
    try {
        if (window.CytubeNative && typeof CytubeNative.openExternal === 'function') {
            CytubeNative.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    } catch (e) {}
}

export function hideDrmOverlay() {
    const o = document.getElementById('sc-drm-overlay');
    if (o) o.remove();
}

function showDrmOverlay(videoId, title) {
    hideDrmOverlay();
    const wrap = document.getElementById('videowrap') || document.body;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    // Open the whole channel in a real browser (which has Widevine) rather than the bare
    // YouTube app — that keeps the full Grindhouse room (synced video + chat) and the DRM
    // title plays inside it.
    const url = 'https://cytu.be/r/420Grindhouse';
    const safeTitle = (title || 'This title').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const o = document.createElement('div');
    o.id = 'sc-drm-overlay';
    o.innerHTML =
        '<div id="sc-drm-box">' +
        '<div id="sc-drm-icon">🔒</div>' +
        '<div id="sc-drm-title">' + safeTitle + ' can’t play in the app</div>' +
        '<div id="sc-drm-msg">It’s a DRM-protected <b>YouTube Movies</b> title and the in-app player ' +
        'can’t decrypt it. Open <b>Grindhouse</b> in your browser — it plays there, with the room ' +
        'and chat still in sync.</div>' +
        '<div id="sc-drm-actions"><button id="sc-drm-open" class="sc-drm-btn">Open Grindhouse in Browser</button></div>' +
        '</div>';
    wrap.appendChild(o);
    const btn = document.getElementById('sc-drm-open');
    if (btn) btn.addEventListener('click', () => openExternalUrl(url));
}

export function checkYtDrm(tries) {
    const p = window.PLAYER;
    if (!p || p.mediaType !== 'yt') { hideDrmOverlay(); return; }
    let vd = null;
    try { vd = (p.yt && p.yt.getVideoData) ? p.yt.getVideoData() : null; } catch (e) {}
    if (vd && vd.errorCode) {            // e.g. 'fmt.noneavailable' for un-decryptable DRM titles
        showDrmOverlay(vd.video_id, vd.title);
        return;
    }
    if ((tries || 0) < 10) {             // player may still be resolving — retry a few seconds
        drmState.checkTimer = setTimeout(() => checkYtDrm((tries || 0) + 1), 1000);
    }
}
