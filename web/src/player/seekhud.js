import { getCurrentMediaSeconds, getCurrentPlaybackSeconds, formatHMS, getDesyncLiveSeconds } from '../mediatime.js';

/* ==========================================================
   SEEK HUD — a small always-visible elapsed/total + "N behind live" readout that
   appears while free-watch (desync) is on, so scrubbing with the D-pad isn't blind.
   Gated to raw/Drive media only (requires a real .vjs-control-bar) -- desync-seeking
   doesn't work on YouTube at all today (tvnav.js's seekBy is video.js-only), so
   showing a HUD there would just be misleading, not a new limitation this adds.
========================================================== */

let _el = null;
let _timer = null;

function isDesyncActive() {
    const b = document.getElementById('sc-desync-btn');
    return !!(b && b.classList.contains('sc-desync-active'));
}

function ensureEl() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.id = 'sc-seek-hud';
    _el.innerHTML = `
        <span id="sc-seek-hud-pos">0:00 / 0:00</span>
        <span id="sc-seek-hud-live"></span>`;
    document.body.appendChild(_el);
    return _el;
}

function render() {
    if (!isDesyncActive() || !document.querySelector('#videowrap .vjs-control-bar')) {
        if (_el) _el.style.display = 'none';
        return;
    }
    const dur = getCurrentMediaSeconds();
    const pos = getCurrentPlaybackSeconds();
    if (!(dur > 0)) {
        if (_el) _el.style.display = 'none';
        return;
    }
    const el = ensureEl();
    el.style.display = 'flex';
    el.querySelector('#sc-seek-hud-pos').textContent = `${formatHMS(pos)} / ${formatHMS(dur)}`;
    const live = getDesyncLiveSeconds();
    const liveEl = el.querySelector('#sc-seek-hud-live');
    if (live == null) {
        liveEl.textContent = '';
    } else {
        const behind = Math.max(0, live - pos);
        liveEl.textContent = behind < 1 ? 'at live' : `${formatHMS(behind)} behind live`;
    }
}

export function initSeekHud() {
    if (_timer) return;
    render();
    _timer = setInterval(render, 500);
}
