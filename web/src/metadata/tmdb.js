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

export const movieState = {
    lastMovieTitle: '',
    movieLinkCache: {}, // cache by raw title to avoid repeat lookups
};

// ── Kill-Count JSONL (fetched once, keyed by tmdbId) ───────────────────────
let killCountDb = null; // null = not loaded yet, {} = loaded (may be empty)

export async function getKillCountDb() {
    if (killCountDb !== null) return killCountDb;
    killCountDb = {};
    try {
        // Use GM_xmlhttpRequest to bypass any CORS issues with raw.githubusercontent.com
        const text = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/lklynet/Kill-Count/main/killcounts.jsonl',
                onload: r => r.status === 200 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
                onerror: reject,
            });
        });
        let loaded = 0;
        for (const line of text.split('\n')) {
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
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
            if (!res.ok) return;
            const data = await res.json();
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
    return result;
}
