import { nativeHttpGet, nativeHttpPost } from '../native.js';
import { setKey, LS_SIMKL_CLIENT_ID, simklClientId } from '../store.js';
import { _appVersion } from '../update.js';
import {
    LS_SIMKL_TOKEN, LS_SIMKL_PROMPTED, SIMKL_APP_NAME, SIMKL_API,
    simklAuthQuery, simklFormBody, simklUsableToken, simklTokenNeedsRefresh, simklTokenFromResponse,
    simklBuildHistoryPayload, simklInterpretSyncResponse,
} from './helpers.js';

/* ==========================================================
   SIMKL CLIENT — HTTP, token store, device-code sign-in and the
   one-call scrobble. Port of the userscript's "simkl-client" slice:
   same flow and rate-limit spacing, but requests go through the
   native bridge (CytubeNative.httpGet/httpPost -- no CORS, and the
   User-Agent header really is sent) instead of GM_xmlhttpRequest.
   Nothing here runs unless the user acts: the card asks first.
========================================================== */

// The native bridge by default; tests swap in a fake with _setSimklTransport().
let _transport = { get: nativeHttpGet, post: nativeHttpPost };
export function _setSimklTransport(t) { _transport = t; }

const _sleep = ms => new Promise(r => setTimeout(r, ms));

export function simklAppVersion() { return _appVersion() || '0'; }

// Resolves { status, json } for any HTTP response (json is null when the body isn't JSON);
// rejects only on a network error / timeout. opts = { body, form, token, clientId }: `form` sends
// the body urlencoded (the /oauth2/* endpoints) instead of JSON (/sync/*); `token` adds the Bearer
// header; `clientId` overrides the saved Client ID.
export async function simklRequest(method, path, opts = {}) {
    const { body, form, token, clientId } = opts;
    const version = simklAppVersion();
    const headers = { 'User-Agent': SIMKL_APP_NAME + '/' + version };
    if (body) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
    if (token && token.access) headers['Authorization'] = 'Bearer ' + token.access;
    const url = SIMKL_API + path + (path.includes('?') ? '&' : '?') + simklAuthQuery(clientId || simklClientId(), SIMKL_APP_NAME, version);
    const res = method === 'POST'
        ? await _transport.post(url, headers, body ? (form ? simklFormBody(body) : JSON.stringify(body)) : '')
        : await _transport.get(url, headers);
    let json = null;
    try { json = JSON.parse(res.body); } catch (e) {}
    return { status: res.status, json };
}

export function simklLoadToken() { try { return JSON.parse(localStorage.getItem(LS_SIMKL_TOKEN)); } catch (e) { return null; } }
function simklSaveToken(t) { try { localStorage.setItem(LS_SIMKL_TOKEN, JSON.stringify(t)); } catch (e) {} }
export function simklClearToken() { try { localStorage.removeItem(LS_SIMKL_TOKEN); } catch (e) {} }

export function simklLoadPrompted() { try { return JSON.parse(localStorage.getItem(LS_SIMKL_PROMPTED)); } catch (e) { return null; } }
// outcome: 'shown' (card appeared -- also what an auto-dismiss leaves behind) | 'skipped' | 'scrobbled' | 'needsconfig' (card shown but no Client ID; ignored once one exists)
export function simklMarkPrompted(imdbId, outcome) {
    try { localStorage.setItem(LS_SIMKL_PROMPTED, JSON.stringify({ imdbId, ts: Date.now(), outcome })); } catch (e) {}
}

// Device flow step 1 (needs only the Client ID). Resolves { device_code, user_code, verification_uri,
// verification_uri_complete, expires_in, interval }. Throws an Error whose .kind is 'network' (the
// request itself failed) or 'rejected' (Simkl answered but not with a usable code -- the way a bad
// Client ID shows up, since there is no separate key-check endpoint).
export async function simklStartDeviceAuth() {
    let res;
    try {
        res = await simklRequest('POST', '/oauth2/device', { form: true, body: { client_id: simklClientId(), scope: 'media:read media:write' } });
    } catch (e) { const err = new Error('device-code request failed: ' + e.message); err.kind = 'network'; throw err; }
    if (res.status !== 200 || !res.json || !res.json.device_code || !res.json.user_code) {
        const err = new Error('device-code HTTP ' + res.status); err.kind = 'rejected'; throw err;
    }
    return res.json;
}

// Device flow step 2: polls at Simkl's interval until approved / expired / cancelled. `handle` is
// { cancelled: boolean } -- set it true to stop. Saves the token and resolves 'ok' on success; else
// 'expired' | 'cancelled' | 'scope' | 'error'. Simkl has no "denied" signal: declining just leaves the
// code pending until our own deadline. 'scope' = approved, but without media:write, so nothing is saved.
export async function simklPollDeviceToken(dev, handle, sleep = _sleep) {
    let intervalMs = Math.max(1, dev.interval || 5) * 1000;
    const deadline = Date.now() + dev.expires_in * 1000;
    while (!handle.cancelled && Date.now() < deadline) {
        await sleep(intervalMs);
        if (handle.cancelled) break;
        let res;
        try {
            res = await simklRequest('POST', '/oauth2/token', { form: true,
                body: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: simklClientId(), device_code: dev.device_code } });
        } catch (e) { continue; }                                   // transient network error: keep polling until expiry
        const json = res.json;
        if (res.status === 200 && json && json.access_token) {
            if (typeof json.scope === 'string' && !json.scope.split(/\s+/).includes('media:write')) return 'scope';
            simklSaveToken(simklTokenFromResponse(json, simklClientId(), Date.now()));
            return 'ok';
        }
        const err = json && json.error;
        if (res.status === 400 && err === 'authorization_pending') continue;      // user hasn't approved yet
        if (res.status === 400 && err === 'slow_down') { intervalMs += 5000; continue; }
        if (res.status === 400 && err === 'expired_token') return 'expired';
        return 'error';                                              // any other 400, 401 invalid_client, 5xx...
    }
    return handle.cancelled ? 'cancelled' : 'expired';
}

// Exchanges the refresh token. Saves + returns the fresh token, or null. A definitive rejection
// (400/401/403) also clears the stored token so the next attempt goes through Connect; network
// errors / 5xx keep it.
async function simklRefreshToken(token) {
    try {
        const res = await simklRequest('POST', '/oauth2/token', {
            form: true,
            body: { grant_type: 'refresh_token', client_id: simklClientId(), refresh_token: token.refresh },
        });
        if (res.status === 200 && res.json && res.json.access_token) {
            const fresh = simklTokenFromResponse(res.json, simklClientId(), Date.now(), token.refresh);
            simklSaveToken(fresh);
            return fresh;
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) simklClearToken();
    } catch (e) {}
    return null;
}

// A token that can be used right now, or null (=> the card must run Connect). `out.refreshed` is set
// true when a refresh POST was sent (so a caller that POSTs next can keep to Simkl's 1 POST/second
// limit), whether or not the refresh succeeded.
export async function simklEnsureToken(out) {
    const token = simklUsableToken(simklLoadToken(), simklClientId());
    if (!token) return null;
    if (simklTokenNeedsRefresh(token, Date.now())) {
        if (out) out.refreshed = true;
        const fresh = await simklRefreshToken(token);
        if (fresh) return fresh;
        if (!simklLoadToken()) return null;                 // refresh was rejected and the token was cleared
        if (Date.now() >= token.expiresAt) return null;     // hard-expired and couldn't refresh
    }
    return token;                                           // near expiry but refresh failed transiently: still valid
}

export const simklHasUsableToken = () => !!simklUsableToken(simklLoadToken(), simklClientId());

// 'auth' (=> Connect) only when no usable token remains stored; if one is still there the failed
// token/refresh step was transient (network, timeout, 5xx), so report 'error' and let Retry work.
const simklNoTokenResult = () => ({ result: simklHasUsableToken() ? 'error' : 'auth' });

// Logs the watch (+ rating) with ONE POST /sync/history. Resolves { result }: 'added' | 'exists'
// (already in the user's history -- a server-side no-op) | 'not_found' | 'auth' (needs Connect) |
// 'error'. A 201 is never trusted on its own: the reply body decides. Simkl allows 1 POST/second, so a
// POST that follows another (a token refresh, or a 429'd attempt) waits first; the ordinary path
// (valid token, first attempt succeeds) never waits.
export async function simklSubmit(snap, rating, sleep = _sleep) {
    const ensured = {};
    let token = await simklEnsureToken(ensured);
    if (!token) return simklNoTokenResult();
    if (ensured.refreshed) await sleep(1100);               // proactive refresh POST just went out
    const nowIso = new Date().toISOString();
    const post = () => simklRequest('POST', '/sync/history', { body: simklBuildHistoryPayload(snap, nowIso, rating), token });
    try {
        let res = await post();
        if (res.status === 401) {                           // token rejected: one refresh, one retry
            token = await simklRefreshToken(token);
            if (!token) return simklNoTokenResult();
            await sleep(1100);                              // keep clear of the refresh POST
            res = await post();
        }
        if (res.status === 429) {                           // per-second rate limit: clears in ~1 s, retry once
            await sleep(1200);
            res = await post();
        }
        if (res.status !== 200 && res.status !== 201) return { result: 'error' };
        const verdict = simklInterpretSyncResponse(res.json);
        if (verdict === 'added' || verdict === 'exists' || verdict === 'not_found') return { result: verdict };
        return { result: 'error' };
    } catch (e) {
        return { result: 'error' };
    }
}

// The signed-in account's username (proves the token works end to end), or null on any failure.
export async function simklFetchUsername(token) {
    try {
        const res = await simklRequest('GET', '/users/settings', { token });
        const name = res.status === 200 && res.json && res.json.user && res.json.user.name;
        return (typeof name === 'string' && name) ? name : null;
    } catch (e) { return null; }
}

// Settings "Test connection": saves the typed Client ID, then either confirms the stored token or runs
// a device sign-in right in the row. `ui` = { setStatus(text, kind), showCode(dev|null), isOpen() };
// `handle` is { cancelled }.
export async function simklConnectAndVerify(clientId, ui, handle, sleep = _sleep) {
    if (!clientId) { ui.setStatus('Enter your Client ID first', 'bad'); return; }
    setKey(LS_SIMKL_CLIENT_ID, clientId);
    ui.showCode(null);
    ui.setStatus('Checking sign-in…', 'pending');
    const token = await simklEnsureToken();
    if (token) {
        const name = await simklFetchUsername(token);
        if (name) { ui.setStatus('✓ Connected as ' + name, 'ok'); return; }
    }

    let dev;
    try { dev = await simklStartDeviceAuth(); }
    catch (e) {
        if (e.kind === 'network') ui.setStatus('⚠ Couldn’t reach Simkl', 'bad');
        else ui.setStatus('✗ Client ID rejected by Simkl — check it at simkl.com/settings/developer', 'bad');
        return;
    }
    ui.showCode(dev);

    const expiresAt = Date.now() + dev.expires_in * 1000;
    const tick = () => {
        const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
        ui.setStatus('Waiting for approval… ' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'), 'pending');
    };
    tick();
    const iv = setInterval(tick, 1000);
    let r;
    try {
        const wrappedSleep = ms => {
            if (!ui.isOpen()) { handle.cancelled = true; return Promise.resolve(); }   // Settings closed mid-wait: stop polling
            return sleep(ms);
        };
        r = await simklPollDeviceToken(dev, handle, wrappedSleep);
    } finally { clearInterval(iv); }

    ui.showCode(null);
    if (r === 'cancelled')    ui.setStatus('Cancelled', '');
    else if (r === 'expired') ui.setStatus('✗ Code expired — press Test again', 'bad');
    else if (r === 'scope')   ui.setStatus('✗ Simkl granted read-only access — press Test again and approve all permissions', 'bad');
    else if (r === 'error')   ui.setStatus('✗ Sign-in failed — check the Client ID', 'bad');
    else if (r === 'ok') {
        const name = await simklFetchUsername(simklLoadToken());
        ui.setStatus(name ? '✓ Connected as ' + name : '✓ Connected', 'ok');
    }
}
