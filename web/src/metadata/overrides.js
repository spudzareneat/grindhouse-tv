/* ==========================================================
   MATCH OVERRIDES — user-pinned corrections for a wrong auto-match,
   keyed by the exact raw CyTube title (the filename). Same storage key
   and entry shape as the sibling PC userscript's movie-title-links
   module (LS_MOVIE_OVERRIDE), so the two stay conceptually in step even
   though their localStorage never syncs.

   Entry: { imdbId, tmdbId, tmdbType, ts } -- tmdbId/tmdbType are set
   when the pick came from a TMDB search (lets lookupMovie pull the same
   rich TMDB details an auto TMDB match gets); null for an IMDb pick.
========================================================== */

export const LS_MOVIE_OVERRIDE = 'sc_movie_override_v1';

function load() {
    try {
        const raw = localStorage.getItem(LS_MOVIE_OVERRIDE);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) { return {}; }
}

function save(map) {
    try { localStorage.setItem(LS_MOVIE_OVERRIDE, JSON.stringify(map)); }
    catch (e) { /* storage full/unavailable -- the pin just won't survive a restart */ }
}

export function getMovieOverride(rawTitle) {
    if (!rawTitle) return null;
    const entry = load()[rawTitle];
    return (entry && entry.imdbId) ? entry : null;
}

export function setMovieOverride(rawTitle, { imdbId, tmdbId = null, tmdbType = null } = {}) {
    if (!rawTitle || !imdbId) return;
    const map = load();
    map[rawTitle] = { imdbId, tmdbId, tmdbType, ts: Date.now() };
    save(map);
}

export function clearMovieOverride(rawTitle) {
    if (!rawTitle) return;
    const map = load();
    if (!(rawTitle in map)) return;
    delete map[rawTitle];
    save(map);
}

// A pasted IMDb link or bare tt-id -> 'tt1234567', else null.
export function detectTconst(s) {
    const m = String(s || '').match(/\b(tt\d{7,10})\b/);
    return m ? m[1] : null;
}
