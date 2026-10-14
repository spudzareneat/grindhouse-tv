import { test } from 'node:test';
import assert from 'node:assert';

// Ported (in part) from the sibling userscript's scripts/test-simkl-scrobble.mjs: the pure helpers,
// plus the client against a fake native transport (in place of a fake GM_xmlhttpRequest).

function stubLocalStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
    return store;
}

const H = await import('../src/simkl/helpers.js');

// Fresh client module + storage per test. `replies` is a queue of { status, body } objects (body
// may be an object -> JSON) or Error instances (network failure); every request is recorded.
async function freshClient(replies = [], { clientId = 'cid123' } = {}) {
    const store = stubLocalStorage();
    if (clientId) localStorage.setItem('sc_simkl_client_id', clientId);
    const C = await import('../src/simkl/client.js?t=' + Date.now() + Math.random());
    const calls = [];
    const respond = async (req) => {
        calls.push(req);
        const r = replies.shift();
        if (!r) throw new Error('no reply queued for ' + req.url);
        if (r instanceof Error) throw r;
        return { status: r.status, body: typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? null) };
    };
    C._setSimklTransport({
        get: (url, headers) => respond({ method: 'GET', url, headers }),
        post: (url, headers, body) => respond({ method: 'POST', url, headers, body }),
    });
    return { C, calls, store };
}
const noSleep = async () => {};
const token = (over = {}) => ({ access: 'AT', refresh: 'RT', expiresAt: Date.now() + 7 * 864e5, clientId: 'cid123', ...over });

// ── helpers ──────────────────────────────────────────────────────────────────

test('simklClampThreshold clamps and defaults', () => {
    assert.strictEqual(H.simklClampThreshold('90'), 90);
    assert.strictEqual(H.simklClampThreshold(75), 75);
    assert.strictEqual(H.simklClampThreshold('10'), 50);
    assert.strictEqual(H.simklClampThreshold('250'), 100);
    assert.strictEqual(H.simklClampThreshold(''), H.SIMKL_THRESHOLD_DEFAULT);
    assert.strictEqual(H.simklClampThreshold(null), H.SIMKL_THRESHOLD_DEFAULT);
});

const NOW = 1_800_000_000_000;
const BASE = { enabled: true, isYouTube: false, isEpisode: false, imdbId: 'tt0087332', duration: 6000, currentTime: 5400, thresholdPct: 90, prompted: null, now: NOW };

test('simklShouldPrompt: happy path, boundary and gates', () => {
    assert.strictEqual(H.simklShouldPrompt(BASE), true);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, currentTime: 5399 }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, enabled: false }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, isYouTube: true }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, isEpisode: true }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, imdbId: '' }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, duration: 300, currentTime: 299 }), false);   // shorts
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, duration: NaN }), false);
});

test('simklShouldPrompt: already-handled slot is per movie and expires after 12 h', () => {
    const p = { imdbId: 'tt0087332', ts: NOW - 1000, outcome: 'skipped' };
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, prompted: p }), false);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, prompted: { ...p, imdbId: 'tt0000001' } }), true);
    assert.strictEqual(H.simklShouldPrompt({ ...BASE, prompted: { ...p, ts: NOW - H.SIMKL_PROMPT_TTL_MS } }), true);
});

test('token helpers: usable, refresh window, from response', () => {
    assert.strictEqual(H.simklUsableToken({ access: 'a', clientId: 'x' }, 'x').access, 'a');
    assert.strictEqual(H.simklUsableToken({ access: 'a', clientId: 'x' }, 'y'), null);
    assert.strictEqual(H.simklUsableToken({ clientId: 'x' }, 'x'), null);
    assert.strictEqual(H.simklTokenNeedsRefresh({ expiresAt: NOW + H.SIMKL_REFRESH_WINDOW_MS + 1 }, NOW), false);
    assert.strictEqual(H.simklTokenNeedsRefresh({ expiresAt: NOW + H.SIMKL_REFRESH_WINDOW_MS }, NOW), true);
    const t = H.simklTokenFromResponse({ access_token: 'A', expires_in: 100 }, 'cid', NOW, 'oldR');
    assert.deepStrictEqual(t, { access: 'A', refresh: 'oldR', expiresAt: NOW + 100000, clientId: 'cid' });
});

test('simklBuildHistoryPayload: rating only when an integer 1..10', () => {
    const snap = { imdbId: 'tt1' };
    assert.deepStrictEqual(H.simklBuildHistoryPayload(snap, 'T', 0), { movies: [{ ids: { imdb: 'tt1' }, watched_at: 'T' }] });
    assert.strictEqual(H.simklBuildHistoryPayload(snap, 'T', 7).movies[0].rating, 7);
    assert.strictEqual(H.simklBuildHistoryPayload(snap, 'T', 11).movies[0].rating, undefined);
    assert.strictEqual(H.simklBuildHistoryPayload(snap, 'T', 7.5).movies[0].rating, undefined);
});

test('simklInterpretSyncResponse: not_found / added / exists / unknown', () => {
    assert.strictEqual(H.simklInterpretSyncResponse({ added: { movies: 1 }, not_found: { movies: [{}] } }), 'not_found');
    assert.strictEqual(H.simklInterpretSyncResponse({ added: { movies: 1 }, not_found: { movies: [] } }), 'added');
    assert.strictEqual(H.simklInterpretSyncResponse({ added: { movies: 0 } }), 'exists');
    assert.strictEqual(H.simklInterpretSyncResponse({}), 'unknown');
    assert.strictEqual(H.simklInterpretSyncResponse(null), 'unknown');
});

test('links: auth query, deep link, https-only verification link', () => {
    assert.strictEqual(H.simklAuthQuery('a b', 'n', '1.0'), 'client_id=a%20b&app-name=n&app-version=1.0');
    assert.ok(H.simklItemUrl('tt1', 'cid', '4.0').startsWith('https://api.simkl.com/redirect?to=simkl&imdb=tt1&client_id=cid'));
    assert.deepStrictEqual(H.simklVerificationLink({ verification_uri: 'https://simkl.com/pin', verification_uri_complete: 'https://simkl.com/pin/ABCD' }),
        { url: 'https://simkl.com/pin/ABCD', shown: 'simkl.com/pin' });
    assert.deepStrictEqual(H.simklVerificationLink({ verification_uri: 'javascript:alert(1)', verification_uri_complete: 'http://evil' }),
        { url: 'https://simkl.com/pin', shown: 'simkl.com/pin' });
});

test('misc helpers: form body, lifetime tick, panel position, escaping, hotkey', () => {
    assert.strictEqual(H.simklFormBody({ a: 'x y', b: null, c: undefined, d: 1 }), 'a=x%20y&d=1');
    assert.strictEqual(H.simklTickLifetime(1000, 250, false), 750);
    assert.strictEqual(H.simklTickLifetime(1000, 250, true), 1000);
    assert.strictEqual(H.simklTickLifetime(100, 250, false), 0);
    assert.deepStrictEqual(H.simklPanelPosition({ right: 900, bottom: 500 }, { width: 1000, height: 600 }), { right: 116, bottom: 156 });
    assert.deepStrictEqual(H.simklPanelPosition(null, { width: 1000, height: 600 }), { right: 16, bottom: 56 });
    assert.strictEqual(H.simklEsc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    assert.strictEqual(H.simklEsc(null), '');
    assert.strictEqual(H.simklIsHotkey({ altKey: true, shiftKey: true, code: 'KeyS' }), true);
    assert.strictEqual(H.simklIsHotkey({ altKey: true, shiftKey: false, code: 'KeyS' }), false);
});

// ── client ───────────────────────────────────────────────────────────────────

test('simklRequest: GET carries the auth query + User-Agent, Bearer only with a token; JSON parsed', async () => {
    const { C, calls } = await freshClient([{ status: 200, body: { ok: 1 } }, { status: 500, body: 'oops' }]);
    const r = await C.simklRequest('GET', '/users/settings', { token: token() });
    assert.deepStrictEqual(r, { status: 200, json: { ok: 1 } });
    assert.strictEqual(calls[0].url, 'https://api.simkl.com/users/settings?client_id=cid123&app-name=spuds-grindhouse&app-version=0');
    assert.strictEqual(calls[0].headers['User-Agent'], 'spuds-grindhouse/0');
    assert.strictEqual(calls[0].headers.Authorization, 'Bearer AT');
    const r2 = await C.simklRequest('GET', '/x?y=1');
    assert.deepStrictEqual(r2, { status: 500, json: null });
    assert.ok(calls[1].url.includes('/x?y=1&client_id='));
    assert.strictEqual(calls[1].headers.Authorization, undefined);
});

test('simklRequest: JSON vs form bodies set the matching Content-Type', async () => {
    const { C, calls } = await freshClient([{ status: 200, body: {} }, { status: 200, body: {} }]);
    await C.simklRequest('POST', '/sync/history', { body: { a: 1 } });
    await C.simklRequest('POST', '/oauth2/token', { form: true, body: { a: 'b c' } });
    assert.strictEqual(calls[0].headers['Content-Type'], 'application/json');
    assert.strictEqual(calls[0].body, '{"a":1}');
    assert.strictEqual(calls[1].headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.strictEqual(calls[1].body, 'a=b%20c');
});

test('simklStartDeviceAuth: payload on 200; "rejected" on 401 / bad body; "network" on failure', async () => {
    const dev = { device_code: 'D', user_code: 'U', expires_in: 900, interval: 5 };
    let { C, calls } = await freshClient([{ status: 200, body: dev }]);
    assert.deepStrictEqual(await C.simklStartDeviceAuth(), dev);
    assert.ok(calls[0].body.includes('scope=media%3Aread%20media%3Awrite'));
    ({ C } = await freshClient([{ status: 401, body: {} }]));
    await assert.rejects(C.simklStartDeviceAuth(), e => e.kind === 'rejected');
    ({ C } = await freshClient([{ status: 200, body: { device_code: 'D' } }]));
    await assert.rejects(C.simklStartDeviceAuth(), e => e.kind === 'rejected');
    ({ C } = await freshClient([new Error('net')]));
    await assert.rejects(C.simklStartDeviceAuth(), e => e.kind === 'network');
});

test('simklPollDeviceToken: pending then success saves the token; slow_down widens the interval', async () => {
    const { C, calls } = await freshClient([
        { status: 400, body: { error: 'authorization_pending' } },
        { status: 400, body: { error: 'slow_down' } },
        { status: 200, body: { access_token: 'A', refresh_token: 'R', expires_in: 604800, scope: 'media:read media:write' } },
    ]);
    const waits = [];
    const r = await C.simklPollDeviceToken({ device_code: 'D', expires_in: 900, interval: 2 }, { cancelled: false }, async ms => { waits.push(ms); });
    assert.strictEqual(r, 'ok');
    assert.deepStrictEqual(waits, [2000, 2000, 7000]);
    assert.strictEqual(calls.length, 3);
    const saved = C.simklLoadToken();
    assert.strictEqual(saved.access, 'A');
    assert.strictEqual(saved.refresh, 'R');
    assert.strictEqual(saved.clientId, 'cid123');
});

test('simklPollDeviceToken: expired / error / read-only scope / cancelled', async () => {
    const dev = { device_code: 'D', expires_in: 900, interval: 1 };
    let { C } = await freshClient([{ status: 400, body: { error: 'expired_token' } }]);
    assert.strictEqual(await C.simklPollDeviceToken(dev, { cancelled: false }, noSleep), 'expired');
    ({ C } = await freshClient([{ status: 401, body: { error: 'invalid_client' } }]));
    assert.strictEqual(await C.simklPollDeviceToken(dev, { cancelled: false }, noSleep), 'error');
    ({ C } = await freshClient([{ status: 200, body: { access_token: 'A', expires_in: 1, scope: 'media:read' } }]));
    assert.strictEqual(await C.simklPollDeviceToken(dev, { cancelled: false }, noSleep), 'scope');
    assert.strictEqual(C.simklLoadToken(), null);
    let calls;
    ({ C, calls } = await freshClient([]));
    const h = { cancelled: false };
    assert.strictEqual(await C.simklPollDeviceToken(dev, h, async () => { h.cancelled = true; }), 'cancelled');
    assert.strictEqual(calls.length, 0);
});

test('simklEnsureToken: fresh as-is; near expiry refreshes; rejected refresh clears', async () => {
    let { C, calls, store } = await freshClient([]);
    store.set('sc_simkl_token', JSON.stringify(token()));
    assert.strictEqual((await C.simklEnsureToken()).access, 'AT');
    assert.strictEqual(calls.length, 0);

    ({ C, calls, store } = await freshClient([{ status: 200, body: { access_token: 'NEW', expires_in: 604800 } }]));
    store.set('sc_simkl_token', JSON.stringify(token({ expiresAt: Date.now() + 1000 })));
    const out = {};
    const t = await C.simklEnsureToken(out);
    assert.strictEqual(t.access, 'NEW');
    assert.strictEqual(t.refresh, 'RT');          // kept when the response has none
    assert.strictEqual(out.refreshed, true);
    assert.ok(calls[0].body.includes('grant_type=refresh_token'));

    ({ C, store } = await freshClient([{ status: 401, body: {} }]));
    store.set('sc_simkl_token', JSON.stringify(token({ expiresAt: Date.now() + 1000 })));
    assert.strictEqual(await C.simklEnsureToken(), null);
    assert.strictEqual(C.simklLoadToken(), null);
});

test('simklSubmit: no token -> auth without touching the network', async () => {
    const { C, calls } = await freshClient([]);
    assert.deepStrictEqual(await C.simklSubmit({ imdbId: 'tt1' }, 0, noSleep), { result: 'auth' });
    assert.strictEqual(calls.length, 0);
});

test('simklSubmit: one authorized POST to /sync/history carrying the rating; added / exists / not_found', async () => {
    for (const [body, expected] of [
        [{ added: { movies: 1 } }, 'added'],
        [{ added: { movies: 0 } }, 'exists'],
        [{ added: { movies: 0 }, not_found: { movies: [{}] } }, 'not_found'],
        [{}, 'error'],
    ]) {
        const { C, calls, store } = await freshClient([{ status: 201, body }]);
        store.set('sc_simkl_token', JSON.stringify(token()));
        assert.deepStrictEqual(await C.simklSubmit({ imdbId: 'tt1' }, 8, noSleep), { result: expected });
        assert.strictEqual(calls.length, 1);
        assert.ok(calls[0].url.startsWith('https://api.simkl.com/sync/history?'));
        assert.strictEqual(calls[0].headers.Authorization, 'Bearer AT');
        assert.strictEqual(JSON.parse(calls[0].body).movies[0].rating, 8);
    }
});

test('simklSubmit: 401 -> one refresh + retry after >= 1 s; 429 retried once', async () => {
    let { C, calls, store } = await freshClient([
        { status: 401, body: {} },
        { status: 200, body: { access_token: 'NEW', expires_in: 604800 } },
        { status: 201, body: { added: { movies: 1 } } },
    ]);
    store.set('sc_simkl_token', JSON.stringify(token()));
    const waits = [];
    assert.deepStrictEqual(await C.simklSubmit({ imdbId: 'tt1' }, 0, async ms => { waits.push(ms); }), { result: 'added' });
    assert.strictEqual(calls[2].headers.Authorization, 'Bearer NEW');
    assert.ok(waits[0] >= 1000);

    ({ C, calls, store } = await freshClient([{ status: 429, body: {} }, { status: 429, body: {} }]));
    store.set('sc_simkl_token', JSON.stringify(token()));
    assert.deepStrictEqual(await C.simklSubmit({ imdbId: 'tt1' }, 0, noSleep), { result: 'error' });
    assert.strictEqual(calls.length, 2);
});

test('simklSubmit: network error is "error" and keeps the token', async () => {
    const { C, store } = await freshClient([new Error('net')]);
    store.set('sc_simkl_token', JSON.stringify(token()));
    assert.deepStrictEqual(await C.simklSubmit({ imdbId: 'tt1' }, 0, noSleep), { result: 'error' });
    assert.ok(C.simklLoadToken());
});

test('prompted slot round-trips and tolerates corrupt JSON', async () => {
    const { C, store } = await freshClient([]);
    assert.strictEqual(C.simklLoadPrompted(), null);
    C.simklMarkPrompted('tt1', 'skipped');
    const p = C.simklLoadPrompted();
    assert.strictEqual(p.imdbId, 'tt1');
    assert.strictEqual(p.outcome, 'skipped');
    store.set('sc_simkl_prompted', '{nope');
    assert.strictEqual(C.simklLoadPrompted(), null);
});

// ── Settings "Test connection" ───────────────────────────────────────────────

function fakeUi(open = true) {
    const log = [];
    return { log, codes: [], setStatus(t, k) { log.push([t, k]); }, showCode(d) { this.codes.push(d); }, isOpen: () => open };
}

test('connect: empty Client ID -> bad status, no requests', async () => {
    const { C, calls } = await freshClient([]);
    const ui = fakeUi();
    await C.simklConnectAndVerify('', ui, { cancelled: false }, noSleep);
    assert.deepStrictEqual(ui.log, [['Enter your Client ID first', 'bad']]);
    assert.strictEqual(calls.length, 0);
});

test('connect: already connected verifies via /users/settings and never starts a sign-in', async () => {
    const { C, calls, store } = await freshClient([{ status: 200, body: { user: { name: 'spud' } } }]);
    store.set('sc_simkl_token', JSON.stringify(token()));
    const ui = fakeUi();
    await C.simklConnectAndVerify('cid123', ui, { cancelled: false }, noSleep);
    assert.deepStrictEqual(ui.log.at(-1), ['✓ Connected as spud', 'ok']);
    assert.strictEqual(calls.length, 1);
});

test('connect: fresh sign-in saves the trimmed ID, shows the code, polls, connects', async () => {
    const dev = { device_code: 'D', user_code: 'AB12', verification_uri: 'https://simkl.com/pin', expires_in: 900, interval: 1 };
    const { C, store } = await freshClient([
        { status: 200, body: dev },
        { status: 200, body: { access_token: 'A', expires_in: 604800, scope: 'media:read media:write' } },
        { status: 200, body: { user: { name: 'spud' } } },
    ], { clientId: '' });
    const ui = fakeUi();
    await C.simklConnectAndVerify('newcid', ui, { cancelled: false }, noSleep);
    assert.strictEqual(store.get('sc_simkl_client_id'), 'newcid');
    assert.strictEqual(ui.codes.find(Boolean).user_code, 'AB12');
    assert.strictEqual(ui.codes.at(-1), null);   // code cleared at the end
    assert.deepStrictEqual(ui.log.at(-1), ['✓ Connected as spud', 'ok']);
});

test('connect: closing Settings mid-wait cancels before any token request', async () => {
    const dev = { device_code: 'D', user_code: 'U', expires_in: 900, interval: 1 };
    const { C, calls } = await freshClient([{ status: 200, body: dev }]);
    const ui = fakeUi(false);
    await C.simklConnectAndVerify('cid123', ui, { cancelled: false }, noSleep);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(ui.log.at(-1), ['Cancelled', '']);
});

test('connect: rejected Client ID and unreachable Simkl report distinctly', async () => {
    let { C } = await freshClient([{ status: 401, body: {} }]);
    let ui = fakeUi();
    await C.simklConnectAndVerify('bad', ui, { cancelled: false }, noSleep);
    assert.match(ui.log.at(-1)[0], /rejected/);
    ({ C } = await freshClient([new Error('net')]));
    ui = fakeUi();
    await C.simklConnectAndVerify('cid', ui, { cancelled: false }, noSleep);
    assert.match(ui.log.at(-1)[0], /reach Simkl/);
});
