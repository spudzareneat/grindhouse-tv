import { test } from 'node:test';
import assert from 'node:assert';

// player/leadtime.js pulls in titleinject.js's dependency chain, which (like
// player/resync.js, see resync.test.mjs) expects a browser environment at import
// time (tvdetect.js's isTv IIFE in particular). Stub those before the dynamic
// import below so the whole chain loads without throwing.
function setupGlobals({ connected = true } = {}) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    globalThis.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: { classList: { contains: () => false }, appendChild: () => {} },
        createElement: () => ({
            style: {},
            classList: { add() {}, remove() {}, contains: () => false },
            addEventListener() {},
            appendChild() {},
        }),
        addEventListener() {},
    };
    globalThis.window = { CytubeNative: undefined, screen: { width: 1920 }, PLAYER: undefined };
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });

    const listeners = {};
    const fakeSocket = {
        connected,
        _events: {},
        on: (event, cb) => { (listeners[event] ??= []).push(cb); },
    };
    globalThis.socket = fakeSocket;
    return { fakeSocket, store };
}

test('getMovieLeadSec/setMovieLeadSec: clamps to [0,10] and defaults to 2 when unset or unparseable', async () => {
    setupGlobals();
    const { getMovieLeadSec, setMovieLeadSec, MOVIE_LEAD_MIN, MOVIE_LEAD_MAX } =
        await import('../src/player/leadtime.js?t=' + Date.now());

    assert.strictEqual(getMovieLeadSec(), 2, 'default when never set');

    assert.strictEqual(setMovieLeadSec(5), 5);
    assert.strictEqual(getMovieLeadSec(), 5);

    assert.strictEqual(setMovieLeadSec(999), MOVIE_LEAD_MAX, 'clamps above range');
    assert.strictEqual(getMovieLeadSec(), MOVIE_LEAD_MAX);

    assert.strictEqual(setMovieLeadSec(-5), MOVIE_LEAD_MIN, 'clamps below range');
    assert.strictEqual(getMovieLeadSec(), MOVIE_LEAD_MIN);

    assert.strictEqual(setMovieLeadSec(NaN), 2, 'falls back to default when unparseable');
});

test('installed interceptor adds the lead to mediaUpdate.currentTime for non-YouTube media', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { fakeSocket } = setupGlobals();

    const seen = [];
    fakeSocket._events.mediaUpdate = (data) => seen.push(data.currentTime);

    const { initMovieLeadOffset, setMovieLeadSec } = await import('../src/player/leadtime.js?t=' + Date.now());
    setMovieLeadSec(3);
    initMovieLeadOffset();
    t.mock.timers.tick(1500); // first poll tick installs the interceptor

    assert.strictEqual(typeof fakeSocket._events.mediaUpdate, 'function', 'listener slot now holds the interceptor');
    fakeSocket._events.mediaUpdate({ currentTime: 100 });
    assert.deepStrictEqual(seen, [103], 'lead added before the real handler runs');
});

test('installed interceptor leaves currentTime untouched during YouTube playback', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { fakeSocket } = setupGlobals();
    globalThis.window.PLAYER = { type: 'yt' };

    const seen = [];
    fakeSocket._events.mediaUpdate = (data) => seen.push(data.currentTime);

    const { initMovieLeadOffset, setMovieLeadSec } = await import('../src/player/leadtime.js?t=' + Date.now());
    setMovieLeadSec(3);
    initMovieLeadOffset();
    t.mock.timers.tick(1500);

    fakeSocket._events.mediaUpdate({ currentTime: 100 });
    assert.deepStrictEqual(seen, [100], 'no lead applied to YouTube media');
});

test('installed interceptor is inert when lead is set to 0', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { fakeSocket } = setupGlobals();

    const seen = [];
    fakeSocket._events.mediaUpdate = (data) => seen.push(data.currentTime);

    const { initMovieLeadOffset, setMovieLeadSec } = await import('../src/player/leadtime.js?t=' + Date.now());
    setMovieLeadSec(0);
    initMovieLeadOffset();
    t.mock.timers.tick(1500);

    fakeSocket._events.mediaUpdate({ currentTime: 100 });
    assert.deepStrictEqual(seen, [100], '0 = off');
});
