import { getCurrentPlaybackSeconds } from '../mediatime.js';

/* ==========================================================
   MOVIE SUBTITLES OVERLAY — the classic bottom-center subtitle look
   (distinct from cards/subtitles.js's chat-as-subtitles pills), driven
   by real downloaded SRT cues (subtitles/opensubtitles.js) synced against
   the same live playhead the progress card already reads
   (mediatime.js's getCurrentPlaybackSeconds -- works for raw/Drive/YouTube).
========================================================== */

const REFRESH_MS = 500; // matches the progress card's own cadence (CLAUDE.md)

let _cues = [];
let _timer = null;
let _lastCueIndex = -1;
// Manual sync correction (seconds) when a downloaded file drifts against the
// actual playhead -- re-downloading to try another release costs one of the
// key's 5 free downloads/day, so this is the cheap first fix. Positive = cues
// appear LATER (delay them); negative = EARLIER (advance them). Set by the
// manage modal (subtitles/ui.js), reset only on a fresh download -- a hide/
// show toggle of the same file must not lose a tuned value.
let _offset = 0;

function ensureContainer() {
    let el = document.getElementById('sc-movie-subtitles-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sc-movie-subtitles-overlay';
        document.body.appendChild(el);
    }
    return el;
}

// Exported for unit testing -- pure lookup, no DOM/timer involved.
export function findActiveCueIndex(cues, seconds, offset = 0) {
    const adjusted = seconds - offset;
    for (let i = 0; i < cues.length; i++) {
        if (adjusted >= cues[i].start && adjusted <= cues[i].end) return i;
    }
    return -1;
}

// Only touches the DOM when the active cue actually changes -- called every
// REFRESH_MS while visible, so a no-op path matters.
function tick() {
    const idx = findActiveCueIndex(_cues, getCurrentPlaybackSeconds(), _offset);
    if (idx === _lastCueIndex) return;
    _lastCueIndex = idx;
    ensureContainer().innerHTML = idx >= 0 ? _cues[idx].text.replace(/\n/g, '<br>') : '';
}

export function showMovieSubtitles(cues) {
    _cues = cues || [];
    _lastCueIndex = -1;
    ensureContainer().classList.add('sc-movie-subtitles-visible');
    if (!_timer) _timer = setInterval(tick, REFRESH_MS);
    tick();
}

// Called only on a fresh download (subtitles/ui.js's selectResult) -- a
// hide/show toggle of the SAME file must keep whatever offset was tuned for it.
export function resetSubtitleOffset() { _offset = 0; }

export function getSubtitleOffset() { return _offset; }

export function setSubtitleOffset(seconds) {
    _offset = seconds;
    _lastCueIndex = -1; // force tick() to re-touch the DOM even if the index number is unchanged
    if (isMovieSubtitlesVisible()) tick();
}

export function hideMovieSubtitles() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    const el = document.getElementById('sc-movie-subtitles-overlay');
    if (el) { el.classList.remove('sc-movie-subtitles-visible'); el.innerHTML = ''; }
}

export function isMovieSubtitlesVisible() {
    const el = document.getElementById('sc-movie-subtitles-overlay');
    return !!(el && el.classList.contains('sc-movie-subtitles-visible'));
}
