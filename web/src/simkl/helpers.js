/* ==========================================================
   SIMKL HELPERS — pure functions behind the end-of-movie
   "log this on Simkl?" card (cards/simkl.js) and its Settings
   test row. Ported as-is from the sibling userscript's
   simkl-scrobble module (its "simkl-helpers" test slice), so the
   two stay easy to diff. No DOM, no storage, no network here.
========================================================== */

export const LS_SIMKL_TOKEN    = 'sc_simkl_token';     // JSON {access, refresh, expiresAt, clientId}
export const LS_SIMKL_PROMPTED = 'sc_simkl_prompted';  // JSON {imdbId, ts, outcome} -- single slot

export const SIMKL_THRESHOLD_MIN     = 50;
export const SIMKL_THRESHOLD_MAX     = 100;
export const SIMKL_THRESHOLD_DEFAULT = 90;
export const SIMKL_MIN_DURATION_SEC  = 10 * 60;              // ignore shorts / bumpers
export const SIMKL_PROMPT_TTL_MS     = 12 * 60 * 60 * 1000;  // don't re-ask about the same movie within 12 h
export const SIMKL_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;  // refresh the token when < 1 day from expiry
export const SIMKL_PANEL_INSET       = { right: 16, bottom: 56 }; // px from the video's corner; bottom clears the control bar
export const SIMKL_APP_NAME          = 'spuds-grindhouse';         // sent as app-name + User-Agent on every Simkl request
export const SIMKL_API               = 'https://api.simkl.com';

export function simklClampThreshold(raw) {
    const n = parseInt(raw, 10);
    const v = Number.isFinite(n) ? n : SIMKL_THRESHOLD_DEFAULT;
    return Math.min(SIMKL_THRESHOLD_MAX, Math.max(SIMKL_THRESHOLD_MIN, v));
}

export function simklEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// True once playback has reached thresholdPct % of a known, positive duration.
export function simklPastThreshold(currentTime, duration, thresholdPct) {
    return Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) && currentTime >= 0
        && currentTime / duration >= thresholdPct / 100;
}

// The manual-card hotkey for keyboard users: Alt+Shift+S (physical key, so layouts don't matter).
export function simklIsHotkey(e) {
    return !!e && e.altKey === true && e.shiftKey === true && !e.ctrlKey && !e.metaKey && e.code === 'KeyS';
}

// s = { enabled, isYouTube, isEpisode, imdbId, duration, currentTime, thresholdPct, prompted, now }
export function simklShouldPrompt(s) {
    if (!s.enabled || s.isYouTube || s.isEpisode || !s.imdbId) return false;
    if (!Number.isFinite(s.duration) || s.duration < SIMKL_MIN_DURATION_SEC) return false;
    if (!simklPastThreshold(s.currentTime, s.duration, s.thresholdPct)) return false;
    const p = s.prompted;
    if (p && p.imdbId === s.imdbId && s.now - p.ts < SIMKL_PROMPT_TTL_MS) return false;
    return true;
}

export function simklUsableToken(token, clientId) {
    return (token && token.access && clientId && token.clientId === clientId) ? token : null;
}

export function simklTokenNeedsRefresh(token, nowMs) {
    return !!token && Number.isFinite(token.expiresAt) && nowMs >= token.expiresAt - SIMKL_REFRESH_WINDOW_MS;
}

// Simkl's token response: { access_token, token_type, expires_in (s), refresh_token, scope } -- no created_at,
// so the lifetime counts from nowMs. A refresh response may omit refresh_token: keep prevRefresh then.
export function simklTokenFromResponse(json, clientId, nowMs, prevRefresh) {
    const createdMs = Number.isFinite(json.created_at) ? json.created_at * 1000 : nowMs;
    return { access: json.access_token, refresh: json.refresh_token || prevRefresh, expiresAt: createdMs + json.expires_in * 1000, clientId };
}

// One /sync/history entry: logs the watch and (optionally) rates it in the same call -- Simkl allows
// 1 POST/second, so we never follow up with a separate ratings request. rating: integer 1..10 or omitted.
export function simklBuildHistoryPayload(snap, nowIso, rating) {
    const movie = { ids: { imdb: snap.imdbId }, watched_at: nowIso };
    if (Number.isInteger(rating) && rating >= 1 && rating <= 10) movie.rating = rating;
    return { movies: [movie] };
}

// Simkl's /sync/history reply: { added: { movies: n, ... }, not_found: { movies: [...], ... } }.
// A 201 alone proves nothing: not_found says the id didn't match. added.movies 0 with nothing
// not_found means the movie is already in the user's history (a server-side no-op) -> 'exists'.
export function simklInterpretSyncResponse(json) {
    const nf = json && json.not_found && json.not_found.movies;
    if (Array.isArray(nf) && nf.length) return 'not_found';
    const added = json && json.added;
    if (added && typeof added === 'object') return added.movies > 0 ? 'added' : 'exists';
    return 'unknown';
}

// The query string every Simkl request carries.
export function simklAuthQuery(clientId, appName, appVersion) {
    return 'client_id=' + encodeURIComponent(clientId) + '&app-name=' + encodeURIComponent(appName)
        + '&app-version=' + encodeURIComponent(appVersion);
}

// Simkl's official deep link: a 301 to the movie's simkl.com page (no token needed). Doubles as the
// attribution link Simkl's API rules ask for.
export function simklItemUrl(imdbId, clientId, appVersion) {
    return SIMKL_API + '/redirect?to=simkl&imdb=' + encodeURIComponent(imdbId) + '&' + simklAuthQuery(clientId, SIMKL_APP_NAME, appVersion);
}

// The sign-in page for a device code, https only (the values come from a network response): `url` is the
// complete link when it is https, else the plain one, else simkl.com/pin; `shown` is the plain link's text.
export function simklVerificationLink(dev) {
    const isHttps = u => /^https:\/\//.test(u);
    const url = isHttps(dev.verification_uri_complete) ? dev.verification_uri_complete
        : (isHttps(dev.verification_uri) ? dev.verification_uri : 'https://simkl.com/pin');
    const shown = (isHttps(dev.verification_uri) ? dev.verification_uri : 'https://simkl.com/pin').replace(/^https?:\/\//, '');
    return { url, shown };
}

// application/x-www-form-urlencoded body (Simkl's /oauth2/* endpoints); null/undefined values are skipped.
export function simklFormBody(obj) {
    return Object.keys(obj)
        .filter(k => obj[k] !== undefined && obj[k] !== null)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
        .join('&');
}

export function simklTickLifetime(remainingMs, dtMs, paused) {
    return paused ? remainingMs : Math.max(0, remainingMs - dtMs);
}

// rect = the video's getBoundingClientRect() (or null); viewport = { width, height } of the visible
// viewport. Returns CSS `right`/`bottom` px for a position:fixed box so it hugs the rect's bottom-right.
export function simklPanelPosition(rect, viewport) {
    const right  = rect ? viewport.width  - rect.right  : 0;
    const bottom = rect ? viewport.height - rect.bottom : 0;
    return {
        right:  Math.max(0, Math.round(right))  + SIMKL_PANEL_INSET.right,
        bottom: Math.max(0, Math.round(bottom)) + SIMKL_PANEL_INSET.bottom,
    };
}
