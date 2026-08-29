import { getCurrentMediaSeconds, getCurrentPlaybackSeconds, formatHMS } from '../mediatime.js';

/* ==========================================================
   YOUTUBE SCRUBBER — a read-only progress bar filling the same visual slot
   as .vjs-control-bar (see the shared positioning selectors in
   styles/base.css and tv.css) for YouTube media, which never runs video.js
   at all (a raw #ytapiplayer iframe, no .vjs-control-bar exists) -- without
   this a YouTube-playing room showed no scrubber whatsoever while every
   other media type did.

   Read-only: CyTube syncs playback across the room, and seeking here would
   need the same free-watch/desync gating the video.js scrubber already has
   (tvnav.js's isDesynced()/seekBy(), which only knows video.js's own
   currentTime() API, not YouTube's own seekTo()) -- porting that is a
   separate, larger feature; this only restores the missing visibility.

   Driven by a dumb periodic re-render (mirrors cards/nowplaying.js's
   _renderNpProgress) rather than reacting to changeMedia/mediaUpdate socket
   events directly, so it self-corrects regardless of handler ordering --
   every tick just asks "does a video.js bar exist right now" and "is there
   a real duration to show", with no state to get out of sync.
========================================================== */

let _el = null;
let _timer = null;

function ensureEl() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.id = 'sc-yt-scrubber';
    _el.innerHTML = `
        <span id="sc-yt-scrubber-elapsed">0:00</span>
        <div id="sc-yt-scrubber-track"><div id="sc-yt-scrubber-fill"></div></div>
        <span id="sc-yt-scrubber-remain">-0:00</span>`;
    document.body.appendChild(_el);
    return _el;
}

function render() {
    // video.js owns the bar whenever it exists -- never show both at once.
    if (document.querySelector('#videowrap .vjs-control-bar')) {
        if (_el) _el.style.display = 'none';
        return;
    }
    const dur = getCurrentMediaSeconds();
    if (!(dur > 0)) {
        if (_el) _el.style.display = 'none';
        return;
    }
    const el = ensureEl();
    el.style.display = 'flex';
    const elapsed = Math.min(getCurrentPlaybackSeconds(), dur);
    const pct = Math.max(0, Math.min(100, (elapsed / dur) * 100));
    el.querySelector('#sc-yt-scrubber-fill').style.setProperty('width', pct + '%', 'important');
    el.querySelector('#sc-yt-scrubber-elapsed').textContent = formatHMS(elapsed);
    el.querySelector('#sc-yt-scrubber-remain').textContent = '-' + formatHMS(dur - elapsed);
}

export function initYtScrubber() {
    if (_timer) return;
    render();
    _timer = setInterval(render, 500);
}
