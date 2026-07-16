import { nativeHttpGet } from '../native.js';
import { hasKey, getKey, LS_TMDB } from '../store.js';
import { fetchImdbParentalGuide } from './imdb.js';

/* ==========================================================
   MOVIE LINKS — TMDB lookup → confirmed IMDb + Letterboxd + Wikipedia
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
            if (entry && now - entry.ts < MOVIE_CACHE_MAX_AGE_MS) {
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

export async function lookupMovie(title, year) {
    const cacheKey = title + (year || '');
    if (movieState.movieLinkCache[cacheKey] !== undefined) return movieState.movieLinkCache[cacheKey];

    // ── TMDB + Wikipedia in parallel ─────────────────────────────────────────
    let tmdbResult = null;
    let wikiUrl    = null;

    const tmdbPromise = hasKey(LS_TMDB) ? (async () => {
        try {
            const params = new URLSearchParams({ api_key: getKey(LS_TMDB), query: title, language: 'en-US' });
            if (year) params.set('year', year);
            let res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
            if (!res.ok) return;
            let data = await res.json();
            // TMDB's `year` param is a hard filter, not a ranking hint -- a poster/schedule's
            // listed year one off from TMDB's own release date (seen live 2026-07-15:
            // "South Beach Academy" posted as 1995, TMDB has it as 1996) returns zero results
            // even though the film is right there under a yearless search.
            if (!data.results?.length && year) {
                params.delete('year');
                res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
                if (!res.ok) return;
                data = await res.json();
            }
            if (!data.results?.length) return;
            let best = data.results[0];
            if (year) {
                const withYear = data.results.find(r => r.release_date?.startsWith(year));
                if (withYear) best = withYear;
            }
            const detailRes = await fetch(
                `https://api.themoviedb.org/3/movie/${best.id}?api_key=${getKey(LS_TMDB)}&append_to_response=external_ids`
            );
            if (!detailRes.ok) return;
            const detail = await detailRes.json();
            tmdbResult = {
                tmdbId: best.id,
                imdbId: detail.imdb_id || detail.external_ids?.imdb_id || null,
                title:  detail.title,
                year:   detail.release_date ? detail.release_date.slice(0, 4) : year,
                poster:   detail.poster_path   ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`    : null,
                backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
                rating:   detail.vote_average  ? Math.round(detail.vote_average * 10) / 10 : null,
                runtime:  detail.runtime || null,
                overview: detail.overview || '',
                genres:   (detail.genres || []).map(g => g.name),
            };
        } catch (e) {}
    })() : Promise.resolve();

    // Wikipedia can start immediately with the raw title; we'll use tmdbResult.title if available
    // but since it runs in parallel we use the raw title — good enough for wiki search
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

    await Promise.all([tmdbPromise, wikiPromise]);

    // ── Kill count (from cached JSONL) ───────────────────────────────────────
    let killCount = null;
    if (tmdbResult?.tmdbId) {
        const db = await getKillCountDb();
        const count = db[String(tmdbResult.tmdbId)];
        if (count !== undefined && count !== null) killCount = count;
    }

    // ── IMDb Parent Guide (severity by category) ─────────────────────────────
    const parentalGuide = await fetchImdbParentalGuide(tmdbResult?.imdbId);

    const result = {
        links: {
            imdb:       tmdbResult?.imdbId  ? `https://www.imdb.com/title/${tmdbResult.imdbId}/` : null,
            letterboxd: tmdbResult?.tmdbId  ? `https://letterboxd.com/tmdb/${tmdbResult.tmdbId}` : null,
            wiki:       wikiUrl,
        },
        killCount,
        parentalGuide,
        imdbId:     tmdbResult?.imdbId  || null,
        cleanTitle: tmdbResult?.title  || null,
        cleanYear:  tmdbResult?.year   || null,
        poster:     tmdbResult?.poster   || null,
        backdrop:   tmdbResult?.backdrop || null,
        rating:     tmdbResult?.rating   ?? null,
        runtime:    tmdbResult?.runtime  ?? null,
        overview:   tmdbResult?.overview || '',
        genres:     tmdbResult?.genres   || [],
    };

    movieState.movieLinkCache[cacheKey] = result;
    _movieCacheTimestamps[cacheKey] = Date.now();
    persistMovieCache();
    return result;
}
