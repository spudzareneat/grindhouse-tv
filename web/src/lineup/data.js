import { fetchTonightsSchedule, itemMatchesTitle } from './reddit.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, dayAnchorPacific, pacificDateString, medianGapSeconds, estimateDayItems, roundEtaMs } from './timing.js';
import { getMotdPosterImages } from '../motd.js';
import { hasKey, LS_TMDB } from '../store.js';
import { parseMovieFilename } from '../parse.js';

/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Fetches + caches the Reddit schedule post (see reddit.js) once per session
   (persisted to localStorage across app relaunches, keyed by the post's own
   id -- self-heals whenever the pinned post rolls over to next week's), locates
   "now" within TODAY's day only, and feeds the pure timing model
   (timing.js estimateDayItems) each day's TMDB runtimes, the learned median
   bumper-gap, the confirmed now-playing film, and the persisted furthest-played
   marker -- yielding per-film ETAs (live-anchored, bumper-anchored, or projected
   from that day's Noon-Pacific showtime start) plus a played flag that grays
   already-shown posters. Falls back to the current title plus the static
   admin-curated Coming Attractions art if the fetch fails and no usable cache
   exists.
========================================================== */

const LS_LINEUP_CACHE = 'sc_lineup_cache_v1';
const LS_LINEUP_PROGRESS = 'sc_lineup_progress_v1'; // furthest film observed playing today
const CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000; // background-revalidate if older than this
const FALLBACK_LIST_TITLE = 'Coming Attractions';

const PROGRESS_CONFIRM_MS = 5 * 60 * 1000; // a match this brief was a queue jump, not a showing

let _scheduleCache = null;    // {postId, title, publishedAt, days, fetchedAt} or null
let _fetchFailed = false;     // sticky for the session once Reddit is unreachable AND no cache at all
let _revalidating = false;
let _observedGapSeconds = []; // durations (s) of unmatched blocks between scheduled features
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) BLOCK started
let _pendingProgress = null;  // {idx, since} -- a matched film not yet current long enough to count as played

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

function allScheduleTitles(sched = _scheduleCache) {
    if (!sched) return [];
    return sched.days.flatMap(d => d.sections.flatMap(s => s.items));
}

// Furthest flat index within TODAY's day ever observed playing, persisted so grayed
// "already played" posters survive an app relaunch mid-night. Self-resets when the
// stored Pacific date isn't today's.
function readProgress() {
    try {
        const p = JSON.parse(localStorage.getItem(LS_LINEUP_PROGRESS));
        return p && p.date === pacificDateString() && p.furthestIndex >= 0 ? p.furthestIndex : -1;
    } catch (e) { return -1; }
}
function writeProgress(furthestIndex) {
    try { localStorage.setItem(LS_LINEUP_PROGRESS, JSON.stringify({ date: pacificDateString(), furthestIndex })); }
    catch (e) { /* storage full/unavailable -- graying just degrades to clock projection */ }
}

// If a matched film has now been current long enough to be a real showing (not a
// momentary queue jump -- seen live: the DJ skimming the queue fired changeMedia for
// four scheduled titles in seconds, graying them a night early), commit it to the
// persisted marker. Called when the next changeMedia arrives AND from buildDaySections,
// so a still-playing film past the threshold counts even before it ends.
function commitConfirmedProgress() {
    if (!_pendingProgress) return;
    if (Date.now() - _pendingProgress.since >= PROGRESS_CONFIRM_MS) {
        if (_pendingProgress.idx > readProgress()) writeProgress(_pendingProgress.idx);
        _pendingProgress = null;
    }
}

// Learn bumper-gap duration live: the time from the FIRST unmatched changeMedia after a
// feature to the next matched one is one observed gap sample -- the whole bumper block,
// not just its last item (resetting per-item made the median absurdly small on multi-
// bumper blocks, seen live 2026-07-11). Matched titles in TODAY's day also advance the
// persisted played-progress marker, via the confirm-delay above. Reads the localStorage
// cache directly (without assigning _scheduleCache, which stays ensureSchedule's job so
// revalidation still happens) so all of this works before the lineup is first opened.
onSocket('changeMedia', (d) => {
    const rawTitle = d && d.title;
    const title = rawTitle ? parseMovieFilename(rawTitle).title : null;
    const sched = _scheduleCache || readCache();
    const matchesSchedule = !!(title && sched &&
        allScheduleTitles(sched).some(s => itemMatchesTitle(s, title)));
    if (rawTitle && !matchesSchedule && sched) {
        if (!_lastUnmatchedStart) _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1000);
        _lastUnmatchedStart = null;
    }
    commitConfirmedProgress();
    _pendingProgress = null; // whatever was pending either just committed or was a jump
    if (matchesSchedule) {
        const today = sched.days.find(day => day.date === pacificDateString());
        const flatItems = today ? today.sections.flatMap(s => s.items) : [];
        const idx = flatItems.findIndex(s => itemMatchesTitle(s, title));
        if (idx !== -1 && idx > readProgress()) _pendingProgress = { idx, since: Date.now() };
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
// across section boundaries), hands the timing model (estimateDayItems) the flat facts
// -- runtimes, learned gap, confirmed now-playing, persisted played-progress, bumper
// start -- then re-nests the built items back into their sections.
function buildDaySections(day, dayStatus, infosByKey) {
    const flat = [];
    day.sections.forEach((section, si) => {
        section.items.forEach(item => flat.push({ section, si, item }));
    });

    const isToday = dayStatus === 'today';
    const currentTitle = isToday && movieState.lastMovieTitle
        ? parseMovieFilename(movieState.lastMovieTitle).title : '';
    const currentFlatIndex = currentTitle
        ? flat.findIndex(f => itemMatchesTitle(f.item, currentTitle))
        : -1;

    if (isToday) commitConfirmedProgress(); // a film past the confirm threshold counts as reached

    const nowMs = Date.now();
    const infoFor = (f) => infosByKey.get(f.item.title + '|' + f.item.year) || {};
    const estimates = estimateDayItems({
        nowMs,
        anchorMs: dayAnchorPacific(day.date).getTime(),
        runtimesMin: flat.map(f => infoFor(f).runtime ?? null),
        gapSeconds: medianGapSeconds(_observedGapSeconds) ?? 600, // 10-min cold-start default
        dayStatus,
        currentIndex: currentFlatIndex,
        remainingSec: currentFlatIndex !== -1
            ? Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds()) : 0,
        furthestPlayedIndex: isToday ? readProgress() : -1,
        bumperStartMs: _lastUnmatchedStart,
    });

    const builtFlat = flat.map((f, idx) => {
        const est = estimates[idx];
        const eta = est.etaMs != null ? new Date(roundEtaMs(est.etaMs, est.precision, nowMs)) : null;
        return {
            ...buildBase(infoFor(f), f.item.title, f.item.year),
            isNowPlaying: est.isNowPlaying,
            played: est.played,
            etaLabel: eta ? formatEta(eta.getHours(), eta.getMinutes(), est.precision) : '',
        };
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

    const todayStr = pacificDateString(); // ISO date strings order lexicographically
    const days = _scheduleCache.days.map((day) => ({
        day: day.day, date: day.date, isToday: day.date === todayStr,
        sections: buildDaySections(
            day,
            day.date < todayStr ? 'past' : day.date === todayStr ? 'today' : 'future',
            infosByKey),
    }));
    return { listTitle: _scheduleCache.title || FALLBACK_LIST_TITLE, fallback: false, days };
}
