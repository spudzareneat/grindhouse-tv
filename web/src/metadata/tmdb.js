import { nativeHttpGet } from '../native.js';
import { hasKey, getKey, LS_TMDB } from '../store.js';
import { fetchImdbParentalGuide, fetchImdbMovieByTitle, titlesMatch } from './imdb.js';

/* ==========================================================
   MOVIE LINKS — TMDB-primary when a key is configured, else IMDb-
   primary (the always-available fallback) — + Wikipedia.

   TMDB plays a dual role: when a key is set, fetchTmdbPrimary(title,
   year) is tried first (better title/rating/overview matching than
   IMDb's GraphQL search); when it finds a confidently-linked match (a
   real external_ids.imdb_id), its result is used directly and the
   IMDb-primary lookup is skipped entirely. Whenever TMDB-primary
   comes back empty (no key, no match, no linked IMDb id), lookupMovie
   falls through to IMDb-primary via fetchImdbMovieByTitle (imdb.js),
   with fetchTmdbSupplemental(imdbId) layering TMDB's poster/backdrop/
   kill-count on top if a key is set. This matters because TMDB's
   catalog misses plenty of real titles a room plays (obscure fan
   shorts, direct-to-video genre fare) that IMDb's much broader
   catalog has -- confirmed live: TMDB's /search/movie returns zero
   results for "Our Robocop Remake" (2014), a real film IMDb has.
========================================================== */

export const LINK_DEFS = [
    { key: 'imdb',       label: 'IMDb',       color: '#f5c518', fg: '#000', char: 'i' },
    { key: 'letterboxd', label: 'Letterboxd', color: '#2c4a2e', fg: '#00e054', char: 'L' },
    { key: 'wiki',       label: 'Wikipedia',  color: '#444',    fg: '#eee', char: 'W' },
];

// ── Persisted caches (survive cold restarts -- the WebView reloads the whole
// page and wipes every in-memory-only cache on process death, e.g. Android
// reclaiming a backgrounded app). Same {data,ts}/MAX_AGE_MS convention as
// lineup/data.js's schedule cache. ──────────────────────────────────────────
const LS_MOVIE_CACHE = 'sc_movie_cache_v1';
const MOVIE_CACHE_MAX_AGE_MS = 9 * 24 * 60 * 60 * 1000; // movie metadata rarely changes
const MOVIE_CACHE_MAX_ENTRIES = 300; // evict oldest by ts past this, so storage doesn't grow unbounded

const LS_KILLCOUNT_CACHE = 'sc_killcount_cache_v1';
const KILLCOUNT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let _movieCacheTimestamps = {}; // cacheKey -> ts, mirrors movieState.movieLinkCache for persistence/eviction only

// Loads any still-fresh entries straight into movieState.movieLinkCache so lookupMovie()'s
// existing in-memory-first check (unchanged) already short-circuits on a cache hit.
function loadMovieCache() {
    try {
        const raw = localStorage.getItem(LS_MOVIE_CACHE);
        if (!raw) return;
        const stored = JSON.parse(raw); // { [cacheKey]: { result, ts } }
        const now = Date.now();
        for (const [key, entry] of Object.entries(stored)) {
            // Drop unresolved entries (result.resolved !== true) on load -- lookupMovie()
            // no longer writes these, but entries persisted before that fix (TMDB-only,
            // no IMDb fallback) are still sitting in localStorage with cleanTitle: null,
            // permanently poisoning any title TMDB's catalog happened to miss even after
            // the fix ships (confirmed live: "Our Robocop Remake" (2014), which TMDB has
            // no entry for but IMDb does).
            if (entry && entry.result?.resolved && now - entry.ts < MOVIE_CACHE_MAX_AGE_MS) {
                movieState.movieLinkCache[key] = entry.result;
                _movieCacheTimestamps[key] = entry.ts;
            }
        }
    } catch (e) { /* storage unavailable/corrupt -- fall through with an empty cache */ }
}

function persistMovieCache() {
    try {
        const keys = Object.keys(movieState.movieLinkCache);
        if (keys.length > MOVIE_CACHE_MAX_ENTRIES) {
            const oldestFirst = keys.sort((a, b) => (_movieCacheTimestamps[a] || 0) - (_movieCacheTimestamps[b] || 0));
            for (const k of oldestFirst.slice(0, keys.length - MOVIE_CACHE_MAX_ENTRIES)) {
                delete movieState.movieLinkCache[k];
                delete _movieCacheTimestamps[k];
            }
        }
        const out = {};
        for (const key of Object.keys(movieState.movieLinkCache)) {
            out[key] = { result: movieState.movieLinkCache[key], ts: _movieCacheTimestamps[key] || Date.now() };
        }
        localStorage.setItem(LS_MOVIE_CACHE, JSON.stringify(out));
    } catch (e) { /* storage full/unavailable -- in-memory cache for this session still works */ }
}

export const movieState = {
    lastMovieTitle: '',
    movieLinkCache: {}, // cache by raw title to avoid repeat lookups
};
loadMovieCache();

// ── Kill-Count JSONL (fetched once, keyed by tmdbId) ───────────────────────
let killCountDb = null; // null = not loaded yet, {} = loaded (may be empty)

function loadKillCountCache() {
    try {
        const raw = localStorage.getItem(LS_KILLCOUNT_CACHE);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (data && Date.now() - ts < KILLCOUNT_CACHE_MAX_AGE_MS) return data;
    } catch (e) {}
    return null;
}
function saveKillCountCache(data) {
    try { localStorage.setItem(LS_KILLCOUNT_CACHE, JSON.stringify({ data, ts: Date.now() })); }
    catch (e) {}
}

export async function getKillCountDb() {
    if (killCountDb !== null) return killCountDb;
    const cached = loadKillCountCache();
    if (cached) { killCountDb = cached; return killCountDb; }
    killCountDb = {};
    try {
        // nativeHttpGet bypasses CORS via the CytubeNative bridge (GM_xmlhttpRequest, used
        // here previously, is a Tampermonkey/userscript API that doesn't exist in this native
        // WebView -- it threw a ReferenceError on every call, silently caught below, so kill
        // counts never actually populated).
        const res = await nativeHttpGet('https://raw.githubusercontent.com/lklynet/Kill-Count/main/killcounts.jsonl');
        if (!res || res.status !== 200) throw new Error('HTTP ' + (res && res.status));
        let loaded = 0;
        for (const line of res.body.split('\n')) {
            const s = line.trim();
            if (!s) continue;
            try {
                const entry = JSON.parse(s);
                // Field name confirmed from repo: tmdb_id and count
                if (entry.tmdb_id != null) {
                    killCountDb[String(entry.tmdb_id)] = entry.count;
                    loaded++;
                }
            } catch (e) {}
        }
        saveKillCountCache(killCountDb);
    } catch (e) {
        console.warn('[CyTube SC] Kill count DB failed to load:', e);
    }
    return killCountDb;
}

// Returns 'valid' | 'invalid' | 'error'
export async function validateTmdbKey(key) {
    if (!key) return 'invalid';
    const url = `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`;
    try {
        // TMDB is CORS-friendly, so a plain fetch works; native is the fallback
        const res = await fetch(url);
        if (res.status === 200) return 'valid';
        if (res.status === 401) return 'invalid';
        return 'error';
    } catch (e) {
        try {
            const r = await nativeHttpGet(url);
            if (r.status === 200) return 'valid';
            if (r.status === 401) return 'invalid';
            return 'error';
        } catch (e2) { return 'error'; }
    }
}

// Given an already-resolved IMDb id, finds the matching TMDB movie (if a key
// is set and TMDB has one) and returns its poster/backdrop/kill-count. Called
// from the IMDb-primary branch below to layer TMDB's imagery/kill-count on
// top of an IMDb-resolved title.
async function fetchTmdbSupplemental(imdbId) {
    const empty = { tmdbId: null, poster: null, backdrop: null, killCount: null };
    if (!imdbId || !hasKey(LS_TMDB)) return empty;
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}` +
            `?external_source=imdb_id&api_key=${encodeURIComponent(getKey(LS_TMDB))}`
        );
        if (!res.ok) return empty;
        const data = await res.json();
        const movie = data.movie_results && data.movie_results[0];
        if (!movie) return empty;
        const tmdbId   = movie.id ?? null;
        const poster   = movie.poster_path   ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`    : null;
        const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
        let killCount = null;
        if (tmdbId != null) {
            const db = await getKillCountDb();
            const count = db[String(tmdbId)];
            if (count !== undefined && count !== null) killCount = count;
        }
        return { tmdbId, poster, backdrop, killCount };
    } catch (e) { return empty; }
}

// Primary lookup: searches TMDB directly and returns full metadata plus the
// linked IMDb id. Tried first, ahead of (and, when it succeeds, replacing)
// the IMDb-primary flow. Never throws -- resolves null on any failure (no
// key, no title, network error, no search results, or no linked imdb_id) so
// lookupMovie() can fall straight through to IMDb-primary with no try/catch
// of its own. Requires a linked IMDb id: every downstream consumer (parental
// guide, .links.imdb/.links.letterboxd) needs a real one, so a TMDB match
// with no linked IMDb id is treated as a miss, not a partial success.
async function fetchTmdbPrimary(title, year) {
    if (!title || !hasKey(LS_TMDB)) return null;
    try {
        const apiKey = getKey(LS_TMDB);
        // /search/multi covers both movies and TV shows in one call. TMDB already
        // relevance-ranks server-side -- lookupMovie() still runs the caller-side
        // titlesMatch() check against this result, same as it does for IMDb's, since
        // "top-ranked result" isn't the same as "actually the right title".
        const searchRes = await fetch(
            `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}` +
            `&include_adult=false&api_key=${encodeURIComponent(apiKey)}`
        );
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json();
        const candidates = (searchData.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        if (!candidates.length) return null;

        // Year tiebreak: prefer the first candidate whose release/first-air year
        // matches, if a year was given; otherwise trust TMDB's own top-ranked result.
        let best = candidates[0];
        if (year) {
            const yearMatch = candidates.find(r => (r.release_date || r.first_air_date || '').slice(0, 4) === String(year));
            if (yearMatch) best = yearMatch;
        }

        const mediaType = best.media_type;
        const detailsRes = await fetch(
            `https://api.themoviedb.org/3/${mediaType}/${best.id}` +
            `?append_to_response=external_ids&api_key=${encodeURIComponent(apiKey)}`
        );
        if (!detailsRes.ok) return null;
        const d = await detailsRes.json();

        const imdbId = d.external_ids?.imdb_id || null;
        if (!imdbId) return null;

        let killCount = null;
        if (mediaType === 'movie' && best.id != null) {
            const db = await getKillCountDb();
            const count = db[String(best.id)];
            if (count !== undefined && count !== null) killCount = count;
        }

        return {
            imdbId,
            tmdbId:   best.id ?? null,
            title:    mediaType === 'movie' ? (d.title ?? null) : (d.name ?? null),
            year:     (d.release_date || d.first_air_date || '').slice(0, 4) || null,
            rating:   d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
            runtime:  mediaType === 'movie' ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
            genres:   (d.genres || []).map(g => g.name).filter(Boolean),
            overview: d.overview || null,
            poster:   d.poster_path   ? `https://image.tmdb.org/t/p/w500${d.poster_path}`    : null,
            backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
            killCount,
        };
    } catch (e) { return null; }
}

export async function lookupMovie(title, year) {
    const cacheKey = title + (year || '');
    if (movieState.movieLinkCache[cacheKey] !== undefined) return movieState.movieLinkCache[cacheKey];

    // TMDB-primary and Wikipedia start together (independent of each other).
    // Wikipedia is only awaited once, right before it's needed to build
    // `result`, so it runs in the background the whole time either branch
    // below takes instead of serializing after the TMDB-primary await.
    let wikiUrl = null;
    const tmdbPrimaryPromise = fetchTmdbPrimary(title, year);
    const wikiPromise = (async () => {
        try {
            const searchTitle = title + (year ? ' ' + year : '') + ' film';
            const res = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${
                    encodeURIComponent(searchTitle)
                }&srlimit=1&format=json&origin=*`
            );
            if (!res.ok) return;
            const data = await res.json();
            const hit = data?.query?.search?.[0];
            if (hit) wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
        } catch (e) {}
    })();

    const rawTmdbPrimary = await tmdbPrimaryPromise;
    const tmdbPrimary = (rawTmdbPrimary && titlesMatch(rawTmdbPrimary.title, title)) ? rawTmdbPrimary : null;

    let imdbResult = null;
    let tmdbSupplemental = null;
    let imdbId;

    if (tmdbPrimary) {
        // TMDB found a confidently-linked match -- use it directly, skip the
        // IMDb-primary lookup (and its TMDB-supplemental enrichment, which
        // fetchTmdbPrimary already made redundant by resolving its own tmdb id).
        imdbId = tmdbPrimary.imdbId;
    } else {
        // TMDB-primary didn't run at all (no key) or came back empty (no
        // search results, no linked IMDb id, or failed titlesMatch) --
        // IMDb's much broader catalog is the fallback (see this file's
        // header comment for why that matters).
        imdbResult = await fetchImdbMovieByTitle(title, year);
        imdbId = imdbResult?.tconst || null;
        tmdbSupplemental = await fetchTmdbSupplemental(imdbId);
    }

    // IMDb Parent Guide (severity by category) — always runs off whichever
    // path resolved imdbId; no TMDB equivalent exists.
    const parentalGuide = await fetchImdbParentalGuide(imdbId);

    await wikiPromise;

    // `??` throughout (never mixed with `||`) -- every source field here is
    // either a real value or null/undefined, and necessary for fields like
    // `rating`, where a legitimate 0.0 must not be treated as "missing" the
    // way `||` would.
    const result = {
        links: {
            imdb:       imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
            letterboxd: imdbId ? `https://letterboxd.com/imdb/${imdbId}` : null,
            wiki:       wikiUrl,
        },
        resolved:   !!(tmdbPrimary || imdbResult),
        killCount:  tmdbPrimary?.killCount ?? tmdbSupplemental?.killCount ?? null,
        parentalGuide,
        imdbId:     imdbId || null,
        cleanTitle: tmdbPrimary?.title    ?? imdbResult?.title    ?? null,
        cleanYear:  tmdbPrimary?.year     ?? imdbResult?.year     ?? null,
        rating:     tmdbPrimary?.rating   ?? imdbResult?.rating   ?? null,
        runtime:    tmdbPrimary?.runtime  ?? imdbResult?.runtime  ?? null,
        genres:     tmdbPrimary?.genres   ?? imdbResult?.genres   ?? [],
        // TMDB's poster/backdrop take priority over IMDb's; IMDb has no dedicated
        // wide "backdrop" field, so its (usually portrait) poster is reused for
        // both -- the card's CSS crops it to fill, same pattern used when no
        // dedicated backdrop exists.
        poster:     tmdbPrimary?.poster   ?? tmdbSupplemental?.poster   ?? imdbResult?.poster ?? null,
        backdrop:   tmdbPrimary?.backdrop ?? tmdbSupplemental?.backdrop ?? imdbResult?.poster ?? null,
        overview:   tmdbPrimary?.overview ?? imdbResult?.overview ?? '',
    };

    // Only persist a resolved result -- caching an unresolved one (e.g. a
    // transient IMDb GraphQL failure) would permanently poison future lookups
    // for this title. An unresolved result is still returned to the caller
    // this time, just not cached.
    if (result.resolved) {
        movieState.movieLinkCache[cacheKey] = result;
        _movieCacheTimestamps[cacheKey] = Date.now();
        persistMovieCache();
    }
    return result;
}
