import { test } from 'node:test';
import assert from 'node:assert';

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

test('defaults when unset', async () => {
    stubLocalStorage();
    const { getSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    assert.strictEqual(getSetting('tmdbKey'), '');
    assert.strictEqual(getSetting('onboarded'), false);
    assert.strictEqual(getSetting('spellcheck'), true);   // offbool, default true
    assert.strictEqual(getSetting('autoEmbed'), true);    // offbool, default true
    assert.strictEqual(getSetting('couchMode'), false);    // onbool, default false
    assert.strictEqual(getSetting('watchAlong'), false);
    assert.strictEqual(getSetting('castMute'), false);
    assert.strictEqual(getSetting('chatMode'), 'sidebar');
    assert.strictEqual(getSetting('vertSplit'), 50);
    assert.strictEqual(getSetting('updateCache'), null);
});

test('number: round-trips a float and falls back to the default when unparseable', async () => {
    stubLocalStorage();
    const { getSetting, setSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    setSetting('vertSplit', 62.5);
    assert.strictEqual(localStorage.getItem('sc_vert_split'), '62.5');
    assert.strictEqual(getSetting('vertSplit'), 62.5);
    localStorage.setItem('sc_vert_split', 'not-a-number');
    assert.strictEqual(getSetting('vertSplit'), 50);
});

test('offbool: only the literal string "off" disables', async () => {
    stubLocalStorage();
    const { getSetting, setSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    setSetting('spellcheck', false);
    assert.strictEqual(localStorage.getItem('sc_spellcheck'), 'off');
    assert.strictEqual(getSetting('spellcheck'), false);
    setSetting('spellcheck', true);
    assert.strictEqual(localStorage.getItem('sc_spellcheck'), 'on');
    assert.strictEqual(getSetting('spellcheck'), true);
});

test('onbool: only the literal string "on" enables', async () => {
    stubLocalStorage();
    const { getSetting, setSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    setSetting('couchMode', true);
    assert.strictEqual(localStorage.getItem('sc_couch_mode'), 'on');
    assert.strictEqual(getSetting('couchMode'), true);
    setSetting('couchMode', false);
    assert.strictEqual(localStorage.getItem('sc_couch_mode'), '');
    assert.strictEqual(getSetting('couchMode'), false);
});

test('round-trip: string, flag, and json types', async () => {
    stubLocalStorage();
    const { getSetting, setSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    setSetting('tmdbKey', '  abc123  ');
    assert.strictEqual(getSetting('tmdbKey'), 'abc123');

    setSetting('onboarded', true);
    assert.strictEqual(getSetting('onboarded'), true);

    const cache = { ts: 123, tag: 'v2.6', notes: 'hi', url: 'https://x' };
    setSetting('updateCache', cache);
    assert.deepStrictEqual(getSetting('updateCache'), cache);
});

test('legacy-compatible raw storage keys are unchanged', async () => {
    stubLocalStorage();
    const { setSetting } = await import('../src/settings/schema.js?t=' + Date.now());
    setSetting('tmdbKey', 'k');
    setSetting('chatMode', 'overlay');
    assert.strictEqual(localStorage.getItem('sc_tmdb_key'), 'k');
    assert.strictEqual(localStorage.getItem('sc_chat_mode'), 'overlay');
});
