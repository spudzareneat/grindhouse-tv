import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, medianGapSeconds } from './timing.js';

/* ==========================================================
   TONIGHT'S LINEUP — data interface consumed by lineup/screen.js.
   Fetches + caches the Letterboxd schedule once per session, locates "now" in
   it via the live current title, and projects each future item's ETA from
   TMDB runtimes plus a learned median bumper-gap. Falls back to a
   Now/Next-only view (built purely from live changeMedia data) if the
   Letterboxd fetch fails, or to running-order-only (no times) if "now" can't
   be placed on the list (e.g. a bumper is currently playing).
========================================================== */

let _scheduleCache = null;   // [{title, year}] for the whole night, or null before first fetch
let _fetchFailed = false;    // sticky for the session once Letterboxd is unreachable
let _lastChangeMedia = null; // most recent changeMedia payload (title), for the fallback
let _observedGapSeconds = []; // durations (s) of changeMedia items that didn't match the schedule
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) item started

// Learn bumper-gap duration live: a changeMedia title that doesn't match anything in
// tonight's schedule is a bumper; the time between it starting and the next
// (matched-or-not) changeMedia is one observed gap sample.
onSocket('changeMedia', (d) => {
    const title = d && d.title;
    const matchesSchedule = !!(title && _scheduleCache &&
        _scheduleCache.some(s => s.title.toLowerCase() === title.toLowerCase()));
    if (title && !matchesSchedule && _scheduleCache) {
        _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1000);
        _lastUnmatchedStart = null;
    }
    _lastChangeMedia = d || null;
});

async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    try {
        _scheduleCache = await fetchTonightsSchedule();
    } catch (e) {
        _fetchFailed = true;
    }
}

// Now/Next-only fallback: only what a plain viewer can see live, no future lineup.
function fallbackItems() {
    const items = [];
    if (movieState.lastMovieTitle) {
        items.push({
            cleanTitle: movieState.lastMovieTitle, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: true, etaLabel: '',
        });
    }
    if (_lastChangeMedia && _lastChangeMedia.title && _lastChangeMedia.title !== movieState.lastMovieTitle) {
        items.push({
            cleanTitle: _lastChangeMedia.title, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: 'LATE',
        });
    }
    return items;
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return { items: fallbackItems() };

    const infos = await Promise.all(_scheduleCache.map(({ title, year }) => lookupMovie(title, year)));
    const currentIndex = _scheduleCache.findIndex(s =>
        movieState.lastMovieTitle && s.title.toLowerCase() === movieState.lastMovieTitle.toLowerCase());

    if (currentIndex === -1) {
        // Can't place "now" on the list (e.g. a bumper is playing right now, or the
        // current title didn't match) — running order only, no times, per the vision
        // doc's "never display precision the data can't support."
        return {
            items: _scheduleCache.map(({ title, year }, i) => ({
                cleanTitle: infos[i].cleanTitle || title,
                cleanYear: infos[i].cleanYear || year,
                poster: infos[i].poster || null,
                backdrop: infos[i].backdrop || null,
                overview: infos[i].overview || '',
                isNowPlaying: false,
                etaLabel: 'LATE',
            })),
        };
    }

    const learnedGap = medianGapSeconds(_observedGapSeconds) ?? 600; // 10-min cold-start default
    let cumulative = Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds());
    const items = [];
    for (let i = currentIndex; i < _scheduleCache.length; i++) {
        const { title, year } = _scheduleCache[i];
        const info = infos[i];
        const base = {
            cleanTitle: info.cleanTitle || title,
            cleanYear: info.cleanYear || year,
            poster: info.poster || null,
            backdrop: info.backdrop || null,
            overview: info.overview || '',
        };
        const offset = i - currentIndex;
        if (offset === 0) { items.push({ ...base, isNowPlaying: true, etaLabel: '' }); continue; }

        cumulative += learnedGap; // a bumper precedes this feature
        const precision = offset === 1 ? 'exact' : offset <= 3 ? 'approx' : 'late';
        const eta = new Date(Date.now() + cumulative * 1000);
        items.push({ ...base, isNowPlaying: false, etaLabel: formatEta(eta.getHours(), eta.getMinutes(), precision) });
        cumulative += info.runtime ? info.runtime * 60 : 0; // then this feature's own runtime
    }
    return { items };
}
