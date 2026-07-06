import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from './timing.js';

/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Fetches + caches the Letterboxd schedule once per session, locates "now" in
   it via the live current title, and projects each of the next 4 upcoming
   films' ETA from TMDB runtimes plus a learned median bumper-gap (beyond that,
   compounding uncertainty isn't worth displaying as a time). Falls back to a
   Now/Next-only view (built purely from live changeMedia data) if the
   Letterboxd fetch fails, or to running-order-only (no times) if "now" can't
   be placed on the list -- except the one case where a coarse anchor still
   exists without a live match: Friday before the marathon's usual noon-Pacific
   start, where the first film gets a single "starts around then" estimate.
========================================================== */

let _scheduleCache = null;   // [{title, year}] for the whole weekend, or null before first fetch
let _listTitle = null;       // the real Letterboxd list's own title, shown as the screen header
let _fetchFailed = false;    // sticky for the session once Letterboxd is unreachable
let _lastChangeMedia = null; // most recent changeMedia payload (title), for the fallback
let _observedGapSeconds = []; // durations (s) of changeMedia items that didn't match the schedule
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) item started

const FALLBACK_LIST_TITLE = 'Now / Next';
const MAX_ESTIMATED_AHEAD = 4; // only the next N upcoming films get any time estimate at all

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
        const result = await fetchTonightsSchedule();
        if (!isListForCurrentWeek(result.publishedAt)) {
            // Stale -- this list covers a weekend from a prior week (most likely Mon/Tue,
            // before the new one is posted ~Wednesday). Treat it the same as a fetch
            // failure: fall back to the Now/Next-only view rather than show a whole
            // already-aired weekend's lineup as if it were still upcoming.
            _fetchFailed = true;
            return;
        }
        _scheduleCache = result.items;
        _listTitle = result.listTitle;
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

// Every item's TMDB/IMDb-enriched fields, shared by both the matched and unmatched branches
// below -- including parentalGuide/killCount/imdbId/rating/genres, which lookupMovie() already
// fetches but earlier code dropped when building each item (browsing a film from the rail
// showed none of the parent-guide chips the real now-playing card shows).
function buildBase(info, title, year) {
    return {
        cleanTitle: info.cleanTitle || title,
        cleanYear: info.cleanYear || year,
        poster: info.poster || null,
        backdrop: info.backdrop || null,
        overview: info.overview || '',
        rating: info.rating ?? null,
        genres: info.genres || [],
        parentalGuide: info.parentalGuide || null,
        killCount: info.killCount ?? null,
        imdbId: info.imdbId || null,
    };
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return { listTitle: FALLBACK_LIST_TITLE, items: fallbackItems() };

    const infos = await Promise.all(_scheduleCache.map(({ title, year }) => lookupMovie(title, year)));
    const currentIndex = _scheduleCache.findIndex(s =>
        movieState.lastMovieTitle && s.title.toLowerCase() === movieState.lastMovieTitle.toLowerCase());

    if (currentIndex === -1) {
        // Can't place "now" on the list (a bumper is playing, an off-schedule item is airing,
        // or the marathon hasn't started this week) -- running order only, no times, per the
        // vision doc's "never display precision the data can't support" -- except the single
        // Friday-before-noon case, where the first film gets one coarse estimate.
        const fridayEstimate = isBeforeFridayNoonPacific();
        return {
            listTitle: _listTitle || FALLBACK_LIST_TITLE,
            items: _scheduleCache.map(({ title, year }, i) => ({
                ...buildBase(infos[i], title, year),
                isNowPlaying: false,
                etaLabel: (fridayEstimate && i === 0) ? '≈ Fri 12:00 PM' : 'LATE',
            })),
        };
    }

    const learnedGap = medianGapSeconds(_observedGapSeconds) ?? 600; // 10-min cold-start default
    let cumulative = Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds());
    const items = [];
    for (let i = currentIndex; i < _scheduleCache.length; i++) {
        const { title, year } = _scheduleCache[i];
        const info = infos[i];
        const base = buildBase(info, title, year);
        const offset = i - currentIndex;
        if (offset === 0) { items.push({ ...base, isNowPlaying: true, etaLabel: '' }); continue; }

        cumulative += learnedGap; // a bumper precedes this feature
        if (offset > MAX_ESTIMATED_AHEAD) {
            items.push({ ...base, isNowPlaying: false, etaLabel: 'LATE' });
        } else {
            const precision = offset === 1 ? 'exact' : 'approx';
            const eta = new Date(Date.now() + cumulative * 1000);
            items.push({ ...base, isNowPlaying: false, etaLabel: formatEta(eta.getHours(), eta.getMinutes(), precision) });
        }
        cumulative += info.runtime ? info.runtime * 60 : 0; // then this feature's own runtime
    }
    return { listTitle: _listTitle || FALLBACK_LIST_TITLE, items };
}
