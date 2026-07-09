import { fetchTonightsSchedule } from './reddit.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, dayAnchorPacific, pacificDateString, medianGapSeconds } from './timing.js';
import { getMotdPosterImages } from '../motd.js';
import { hasKey, LS_TMDB } from '../store.js';
import { parseMovieFilename } from '../parse.js';

/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Fetches + caches the Reddit schedule post (see reddit.js) once per session
   (persisted to localStorage across app relaunches, keyed by the post's own
   id -- self-heals whenever the pinned post rolls over to next week's), locates
   "now" within TODAY's day only, and projects the next MAX_ESTIMATED_AHEAD
   upcoming films' ETA from TMDB runtimes plus a learned median bumper-gap,
   anchored at that day's Noon-Pacific showtime start. Falls back to the
   current title plus the static admin-curated Coming Attractions art if the
   fetch fails and no usable cache exists.
========================================================== */

const LS_LINEUP_CACHE = 'sc_lineup_cache_v1';
const CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000; // background-revalidate if older than this
const FALLBACK_LIST_TITLE = 'Coming Attractions';
const MAX_ESTIMATED_AHEAD = 4; // only the next N upcoming films get any time estimate at all

let _scheduleCache = null;    // {postId, title, publishedAt, days, fetchedAt} or null
let _fetchFailed = false;     // sticky for the session once Reddit is unreachable AND no cache at all
let _revalidating = false;
let _observedGapSeconds = []; // durations (s) of changeMedia items that didn't match the schedule
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) item started

function readCache() {
    try {
        const raw = localStorage.getItem(LS_LINEUP_CACHE);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}
function writeCache(schedule) {
    try { localStorage.setItem(LS_LINEUP_CACHE, JSON.stringify({ ...schedule, fetchedAt: Date.now() })); }
    catch (e) { /* storage full/unavailable -- in-memory cache for this session still works */ }
}

function allScheduleTitles() {
    if (!_scheduleCache) return [];
    return _scheduleCache.days.flatMap(d => d.sections.flatMap(s => s.items));
}

// Learn bumper-gap duration live: a changeMedia title that doesn't match anything in
// tonight's schedule is a bumper; the time between it starting and the next
// (matched-or-not) changeMedia is one observed gap sample.
onSocket('changeMedia', (d) => {
    const rawTitle = d && d.title;
    const title = rawTitle ? parseMovieFilename(rawTitle).title : null;
    const matchesSchedule = !!(title && _scheduleCache &&
        allScheduleTitles().some(s => s.title.toLowerCase() === title.toLowerCase()));
    if (rawTitle && !matchesSchedule && _scheduleCache) {
        _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1000);
        _lastUnmatchedStart = null;
    }
});

async function refetchAndCache() {
    if (_revalidating) return;
    _revalidating = true;
    try {
        const result = await fetchTonightsSchedule();
        _scheduleCache = result;
        writeCache(result);
    } catch (e) {
        // Keep whatever we already had (in-memory and/or cached) -- a failed background
        // revalidation is silent; _fetchFailed only matters when we have nothing at all.
    } finally {
        _revalidating = false;
    }
}

async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    const cached = readCache();
    if (cached) {
        _scheduleCache = cached;
        if (Date.now() - (cached.fetchedAt || 0) > CACHE_MAX_AGE_MS) refetchAndCache(); // fire-and-forget
        return;
    }
    try {
        const result = await fetchTonightsSchedule();
        _scheduleCache = result;
        writeCache(result);
    } catch (e) {
        _fetchFailed = true;
    }
}

// Fallback when Reddit is unreachable and no cache exists at all: the current item (if known
// and it looks like a real feature, not a short/bumper) plus the same admin-curated "Coming
// Attractions" art the small poster strip shows (display-only -- no real title/overview to
// show for those, so OK does nothing) -- still something real to look at instead of an empty
// or thin live-only view. Shaped as a single pseudo-day/section so screen.js's fallback
// renderer doesn't need to know this differs from the real day/section structure.
async function fallbackView() {
    const items = [];
    if (movieState.lastMovieTitle) {
        const { title, year } = parseMovieFilename(movieState.lastMovieTitle);
        const info = await lookupMovie(title, year);
        // Skip likely bumpers/shorts: if TMDB is configured and confidently found nothing for
        // this exact title, it's probably not a real feature. Without a TMDB key at all there's
        // no way to tell, so default to showing it.
        if (!hasKey(LS_TMDB) || info.cleanTitle) {
            items.push({ ...buildBase(info, title, year), isNowPlaying: true, etaLabel: '' });
        }
    }
    getMotdPosterImages().forEach((img) => {
        items.push({
            cleanTitle: img.title || img.alt || '', cleanYear: null,
            poster: img.src, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: '', clickable: false,
        });
    });
    return {
        listTitle: FALLBACK_LIST_TITLE, fallback: true,
        days: [{ day: 'Tonight', date: null, isToday: true, sections: [{ name: '', slug: null, items }] }],
    };
}

// Every item's TMDB/IMDb-enriched fields, shared across all days/sections -- including
// parentalGuide/killCount/imdbId/rating/genres, which lookupMovie() already fetches.
function buildBase(info, title, year) {
    return {
        cleanTitle: info.cleanTitle || title,
        cleanYear: info.cleanYear || year,
        poster: info.poster || null,
        backdrop: info.backdrop || null,
        overview: info.overview || '',
        runtime: info.runtime ?? null,
        rating: info.rating ?? null,
        genres: info.genres || [],
        parentalGuide: info.parentalGuide || null,
        killCount: info.killCount ?? null,
        imdbId: info.imdbId || null,
    };
}

// Flattens a day's sections into one ordered list (for locating "now" and walking ETAs
// across section boundaries), then re-nests the built items back into their sections.
function buildDaySections(day, isTodayFlag, infosByKey) {
    const flat = [];
    day.sections.forEach((section, si) => {
        section.items.forEach(item => flat.push({ section, si, item }));
    });

    const currentTitle = isTodayFlag && movieState.lastMovieTitle
        ? parseMovieFilename(movieState.lastMovieTitle).title : '';
    const currentFlatIndex = currentTitle
        ? flat.findIndex(f => f.item.title.toLowerCase() === currentTitle.toLowerCase())
        : -1;

    // Pre-show cold start: the first film of ANY day that hasn't started yet gets one coarse
    // "starts around then" guess, anchored on that day's own real Noon-Pacific showtime --
    // rather than the running-order-only blank every other not-yet-started item gets (never
    // display precision the data can't support).
    const anchor = dayAnchorPacific(day.date);
    const isColdStart = currentFlatIndex === -1 && Date.now() < anchor.getTime();

    const learnedGap = medianGapSeconds(_observedGapSeconds) ?? 600; // 10-min cold-start default
    let cumulative = currentFlatIndex !== -1
        ? Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds()) : 0;

    const builtFlat = flat.map((f, idx) => {
        const info = infosByKey.get(f.item.title + '|' + f.item.year) || {};
        const base = buildBase(info, f.item.title, f.item.year);
        if (idx === currentFlatIndex) return { ...base, isNowPlaying: true, etaLabel: '' };
        if (isColdStart && idx === 0) {
            return { ...base, isNowPlaying: false, etaLabel: formatEta(anchor.getHours(), anchor.getMinutes(), 'approx') };
        }
        if (currentFlatIndex === -1 || idx < currentFlatIndex) {
            return { ...base, isNowPlaying: false, etaLabel: '' }; // no live anchor, or already aired earlier today
        }
        const offset = idx - currentFlatIndex;
        cumulative += learnedGap; // a bumper precedes this feature
        let etaLabel = '';
        if (offset <= MAX_ESTIMATED_AHEAD) {
            const precision = offset === 1 ? 'exact' : 'approx';
            const eta = new Date(Date.now() + cumulative * 1000);
            etaLabel = formatEta(eta.getHours(), eta.getMinutes(), precision);
        }
        cumulative += info.runtime ? info.runtime * 60 : 0;
        return { ...base, isNowPlaying: false, etaLabel };
    });

    return day.sections.map((section, si) => ({
        name: section.name, slug: section.slug,
        items: builtFlat.filter((_, idx) => flat[idx].si === si),
    }));
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return fallbackView();

    const allItems = allScheduleTitles();
    const infos = await Promise.all(allItems.map(({ title, year }) => lookupMovie(title, year)));
    const infosByKey = new Map(allItems.map((item, i) => [item.title + '|' + item.year, infos[i]]));

    const todayStr = pacificDateString();
    const days = _scheduleCache.days.map((day) => ({
        day: day.day, date: day.date, isToday: day.date === todayStr,
        sections: buildDaySections(day, day.date === todayStr, infosByKey),
    }));
    return { listTitle: _scheduleCache.title || FALLBACK_LIST_TITLE, fallback: false, days };
}
