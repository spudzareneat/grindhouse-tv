import { fetchTonightsSchedule, itemMatchesTitle } from './reddit.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, dayAnchorPacific, pacificDateString, medianGapSeconds, estimateDayItems, roundEtaMs, scheduleExpired } from './timing.js';
import { getMotdPosterImages } from '../motd.js';
import { hasKey, LS_TMDB, lineupTimingEnabled } from '../store.js';
import { parseMovieFilename } from '../parse.js';

/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Fetches + caches the Reddit schedule post (see reddit.js), persisted to
   localStorage across app relaunches and re-checked every time the Lineup
   screen opens: a background revalidate past CACHE_MAX_AGE_MS, or an awaited
   one once the cached weekend's own dates are in the past (scheduleExpired) --
   the latter is what guarantees a new pinned post gets picked up. Locates
   "now" within TODAY's day only, and feeds the pure timing model
   (timing.js estimateDayItems) each day's TMDB runtimes, section boundaries, the
   learned same-section and cross-section median bumper gaps, the confirmed
   now-playing film, and the persisted furthest-played marker -- yielding per-film
   ETAs (live-anchored, bumper-anchored, or projected
   from that day's Noon-Pacific showtime start) plus a played flag that grays
   already-shown posters. Falls back to the current title plus the static
   admin-curated Coming Attractions art if the fetch fails and no usable cache
   exists.
========================================================== */

const LS_LINEUP_CACHE = 'sc_lineup_cache_v1';
const LS_LINEUP_PROGRESS = 'sc_lineup_progress_v1'; // furthest film observed playing today
const LS_GAP_SAME_SECTION = 'sc_lineup_gap_same_v1';   // learned same-section bumper gaps (s), across nights
const LS_GAP_CROSS_SECTION = 'sc_lineup_gap_cross_v1'; // learned cross-section bumper gaps (s), across nights
const LS_LAST_SECTION = 'sc_lineup_last_section_v1';   // section of the most recently matched film today
const GAP_SAMPLE_CAP = 40; // bound stored sample count; oldest drop off so habits can drift over time
// itemMatchesTitle compares title text only (no year), so any unrelated content that happens to
// share a scheduled item's exact title -- a trailer, promo, or bumper referencing the same film
// -- false-positive matches it. A real feature presentation runs well past this; a short clip
// doesn't, so reject the match instead of trusting it (confirmed live 2026-07-19: a stray title
// collision permanently corrupted the played-progress marker, graying out films hours ahead of
// the real one playing). Checked against the socket's own declared duration (d.seconds),
// available immediately -- no need to wait and see how long it actually plays. Doesn't catch a
// coincidental FULL-length rerun of unrelated content under the same title; only short-clip
// collisions.
const MIN_PLAUSIBLE_FEATURE_SECONDS = 10 * 60;
// A film whose title fails to match the schedule (e.g. an unusual acronym/punctuation the
// filename parser mangles -- seen live 2026-07-18 on "L.E.T.H.A.L. Ladies") plays out as
// "unmatched" for its entire runtime, same as a real bumper. If the NEXT title does match,
// that whole runtime gets miscounted as one giant "gap" and corrupts the learned median --
// confirmed live: a real ~97-min movie became a persisted 7173s (119.6min) same-section
// sample. Real observed gaps tonight topped out at 13.6 min, so anything past this is far
// more likely a match failure than genuine bumper time -- discard it rather than learn from it.
const MAX_PLAUSIBLE_GAP_SECONDS = 30 * 60;
// Symmetric floor: a gap under a few seconds is far more likely a spurious title-observer blip
// than a real bumper block -- confirmed live 2026-07-19 on the sibling userscript: a 0.419s
// "gap" got learned and, being the only sample, poisoned both the same-section median AND the
// cross-section estimate (which falls back to the same-section one when it has no samples of
// its own), collapsing the ETA for everything past the current film to roughly zero padding.
const MIN_PLAUSIBLE_GAP_SECONDS = 15;
const CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000; // background-revalidate if older than this
const FALLBACK_LIST_TITLE = 'Coming Attractions';

const PROGRESS_CONFIRM_MS = 5 * 60 * 1000; // a match this brief was a queue jump, not a showing

let _scheduleCache = null;    // {postId, title, publishedAt, days, fetchedAt} or null
let _fetchFailed = false;     // sticky for the session once Reddit is unreachable AND no cache at all
let _revalidating = false;
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) BLOCK started
let _currentMatchedFlatIndex = -1; // flat index of whatever's playing RIGHT NOW per the socket;
                                    // -1 when the current title doesn't match anything (bumper/off-schedule)
let _pendingProgress = null;  // {idx, since} -- a matched film not yet current long enough to count as played

// Learned bumper-gap samples (s), split by whether the gap crossed a section boundary --
// live 2026-07-17/18 observation showed section breaks run a whole separate bumper reel
// (several short clips back to back: e.g. a 74s bumper, a 123s "Intermission", a 31s
// commercial), not one bumper's worth of gap, so pooling them with ordinary same-section
// gaps badly underestimated exactly those transitions (~2hr live drift on one section
// change). Persisted to localStorage (uncapped by date, unlike the played-progress
// marker) so the learned habit survives a relaunch/resync mid-night instead of the
// in-memory array quietly resetting to empty, as it did overnight 2026-07-17/18.
function readGapSamples(key) {
    try {
        const raw = JSON.parse(localStorage.getItem(key));
        return Array.isArray(raw) ? raw.filter(n => typeof n === 'number' && n >= 0) : [];
    } catch (e) { return []; }
}
function pushGapSample(key, arr, sec) {
    arr.push(sec);
    if (arr.length > GAP_SAMPLE_CAP) arr.shift();
    try { localStorage.setItem(key, JSON.stringify(arr)); }
    catch (e) { /* storage full/unavailable -- in-memory sample for this session still works */ }
}
let _observedSameSectionGapSeconds = readGapSamples(LS_GAP_SAME_SECTION);
let _observedCrossSectionGapSeconds = readGapSamples(LS_GAP_CROSS_SECTION);

// Section index of the most recently matched film seen today -- the "coming from" context
// a gap needs to be classified same- vs cross-section. Persisted (date-scoped, like the
// played-progress marker) so a page reload landing mid-bumper-block doesn't lose it and
// silently drop that gap sample entirely -- seen live 2026-07-18: the app's own
// stale-resync reload fired right as the Psychedelic Saturday -> Saturday Prime Time
// Drive-In bumper reel started, and the in-memory-only version of this meant the very
// first real cross-section transition went unclassified.
function readLastMatchedSection() {
    try {
        const p = JSON.parse(localStorage.getItem(LS_LAST_SECTION));
        return p && p.date === pacificDateString() && typeof p.section === 'number' ? p.section : -1;
    } catch (e) { return -1; }
}
function writeLastMatchedSection(section) {
    try { localStorage.setItem(LS_LAST_SECTION, JSON.stringify({ date: pacificDateString(), section })); }
    catch (e) { /* storage full/unavailable -- gap classification just skips until the next real match */ }
}
let _lastMatchedSection = readLastMatchedSection();

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

// Today's items flattened WITH each one's section index attached -- needed both to
// classify an observed gap as same-section vs cross-section, and (unchanged from
// before) to locate a matched title's flat index for the played-progress marker.
function flatTodayWithSection(sched) {
    const today = sched && sched.days.find(day => day.date === pacificDateString());
    if (!today) return [];
    const flat = [];
    today.sections.forEach((section, si) => section.items.forEach(item => flat.push({ si, item })));
    return flat;
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
// bumper blocks, seen live 2026-07-11). Classified same-section vs cross-section by
// comparing the newly-matched film's section to whatever section was last confirmed
// playing, and pushed into the matching persisted sample list. Matched titles in TODAY's
// day also advance the persisted played-progress marker, via the confirm-delay above, and
// set _currentMatchedFlatIndex -- the authoritative "what's airing right now" signal
// buildDaySections prefers over the DOM-title heuristic (see there for why). Reads the
// localStorage cache directly (without assigning _scheduleCache, which stays
// ensureSchedule's job so revalidation still happens) so all of this works before the
// lineup is first opened.
onSocket('changeMedia', (d) => {
    // Deliberately NOT gated on lineupTimingEnabled() -- only the display (buildDaySections)
    // is. Tracking always runs in the background so the state stays accurate; gating it here
    // too seemed like a natural extension but actually broke things: while the setting was
    // off, changeMedia events were never observed at all, so a film's entire runtime could
    // pass with no confirmed-played marker -- confirmed live 2026-07-19, Shock Waves' whole
    // ~90min run went untracked while the setting was off, and turning it back on mid-Zero-Boys
    // showed a bogus "Shock Waves starts at 8:15" because the app still thought Shock Waves
    // hadn't happened yet. Always tracking means flipping the setting on shows accurate state
    // immediately instead of waiting for the next real title change to self-correct.
    const rawTitle = d && d.title;
    const title = rawTitle ? parseMovieFilename(rawTitle).title : null;
    const sched = _scheduleCache || readCache();
    const declaredSeconds = d && typeof d.seconds === 'number' ? d.seconds : null;
    const matchesSchedule = !!(title && sched &&
        (declaredSeconds == null || declaredSeconds >= MIN_PLAUSIBLE_FEATURE_SECONDS) &&
        allScheduleTitles(sched).some(s => itemMatchesTitle(s, title)));

    const flatToday = flatTodayWithSection(sched);
    const idx = matchesSchedule ? flatToday.findIndex(f => itemMatchesTitle(f.item, title)) : -1;
    const newSection = idx !== -1 ? flatToday[idx].si : -1;
    _currentMatchedFlatIndex = idx;

    if (rawTitle && !matchesSchedule && sched) {
        if (!_lastUnmatchedStart) _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        const gapSec = (Date.now() - _lastUnmatchedStart) / 1000;
        if (_lastMatchedSection !== -1 && newSection !== -1
            && gapSec >= MIN_PLAUSIBLE_GAP_SECONDS && gapSec <= MAX_PLAUSIBLE_GAP_SECONDS) {
            if (newSection === _lastMatchedSection) {
                pushGapSample(LS_GAP_SAME_SECTION, _observedSameSectionGapSeconds, gapSec);
            } else {
                pushGapSample(LS_GAP_CROSS_SECTION, _observedCrossSectionGapSeconds, gapSec);
            }
        }
        _lastUnmatchedStart = null;
    }
    commitConfirmedProgress();
    _pendingProgress = null; // whatever was pending either just committed or was a jump
    if (matchesSchedule && idx !== -1) {
        _lastMatchedSection = newSection;
        writeLastMatchedSection(newSection);
        if (idx > readProgress()) _pendingProgress = { idx, since: Date.now() };
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
    // Populate the in-memory cache from localStorage on the first call of the session --
    // but unlike before, THIS FUNCTION RUNS AGAIN every time the Lineup screen is opened,
    // not just once. The WebView page is not reloaded across screen-off/on or backgrounding
    // (MainActivity.onStop only pauses it -- see CLAUDE.md), so a TV box especially can sit
    // on the same JS context for days; a one-time-only check here previously meant the
    // schedule, once loaded, was NEVER re-fetched again for the rest of that session even
    // after the pinned post rolled over (seen live 2026-07-15: Wednesday's new post ignored
    // all day because the old weekend's schedule was still sitting in memory from before it).
    if (!_scheduleCache && !_fetchFailed) {
        const cached = readCache();
        if (cached) _scheduleCache = cached;
    }
    if (_scheduleCache) {
        if (scheduleExpired(_scheduleCache)) {
            await refetchAndCache(); // the cached weekend is over -- there IS a new post, wait for it
        } else if (Date.now() - (_scheduleCache.fetchedAt || 0) > CACHE_MAX_AGE_MS) {
            refetchAndCache(); // just routine revalidation (e.g. a same-weekend post edit) -- fire-and-forget
        }
        return;
    }
    if (_fetchFailed) return;
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
    const infoFor = (f) => infosByKey.get(f.item.title + '|' + f.item.year) || {};

    // Experimental feature, off by default -- see lineupTimingEnabled(). Skip all live
    // matching/estimation and show the schedule as a plain, unstatused list instead: posters,
    // titles, section themes -- no NOW PLAYING, no played graying, no ETA guesses.
    if (!lineupTimingEnabled()) {
        const builtFlat = flat.map((f) => ({
            ...buildBase(infoFor(f), f.item.title, f.item.year),
            isNowPlaying: false,
            played: false,
            etaLabel: '',
        }));
        return day.sections.map((section, si) => ({
            name: section.name, slug: section.slug,
            items: builtFlat.filter((_, idx) => flat[idx].si === si),
        }));
    }

    const isToday = dayStatus === 'today';
    // Prefer the socket-driven match (_currentMatchedFlatIndex, authoritative -- straight
    // from the raw changeMedia payload data.js's own handler already parses) over the
    // DOM-title heuristic below (movieState.lastMovieTitle, populated by titleinject.js
    // polling #currenttitle). The DOM path can lag or land on a transient bumper/trailer
    // title right after a page reload and then never update again until the next real
    // title change -- seen live 2026-07-17/18: a still-airing film stayed misclassified as
    // already "played" for the rest of that boot. The socket payload self-heals on every
    // real media change, including the resync changeMedia CyTube resends on reconnect, so
    // it's only ever stale for the brief window before the first one arrives -- the DOM
    // fallback covers exactly that gap.
    const domTitle = isToday && movieState.lastMovieTitle
        ? parseMovieFilename(movieState.lastMovieTitle).title : '';
    const domFlatIndex = domTitle
        ? flat.findIndex(f => itemMatchesTitle(f.item, domTitle))
        : -1;
    const currentFlatIndex = isToday && _currentMatchedFlatIndex !== -1
        ? _currentMatchedFlatIndex : domFlatIndex;

    if (isToday) commitConfirmedProgress(); // a film past the confirm threshold counts as reached

    const nowMs = Date.now();
    // Cross-section falls back to the same-section median (better than a flat guess) if
    // no cross-section samples have been learned yet; same-section falls back to the
    // original 10-min cold-start default.
    const sameSectionGapSeconds = medianGapSeconds(_observedSameSectionGapSeconds) ?? 600;
    const crossSectionGapSeconds = medianGapSeconds(_observedCrossSectionGapSeconds) ?? sameSectionGapSeconds;
    const estimates = estimateDayItems({
        nowMs,
        anchorMs: dayAnchorPacific(day.date).getTime(),
        runtimesMin: flat.map(f => infoFor(f).runtime ?? null),
        sectionOf: flat.map(f => f.si),
        sameSectionGapSeconds,
        crossSectionGapSeconds,
        dayStatus,
        currentIndex: currentFlatIndex,
        // null (not 0) when the duration isn't known yet -- see estimateDayItems for why that
        // distinction matters.
        remainingSec: currentFlatIndex !== -1 && getCurrentMediaSeconds() > 0
            ? Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds())
            : (currentFlatIndex !== -1 ? null : 0),
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

// TMDB is searched under the post's primary title first; if that comes up empty, retry
// under each aka in turn -- the stream sometimes plays (and the post lists) a film under a
// retitle TMDB doesn't recognize (seen live 2026-07-15: "Alien Predators" has no TMDB entry,
// but its stated aka "The Falling" does) that `itemMatchesTitle` already treats as the same film.
async function lookupItem(item) {
    const primary = await lookupMovie(item.title, item.year);
    if (primary.cleanTitle || !item.akas?.length) return primary;
    for (const aka of item.akas) {
        const info = await lookupMovie(aka, item.year);
        if (info.cleanTitle) return info;
    }
    return primary;
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return fallbackView();

    const allItems = allScheduleTitles();
    const infos = await Promise.all(allItems.map(lookupItem));
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
