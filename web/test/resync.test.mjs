import { test } from 'node:test';
import assert from 'node:assert';

// initMediaWatcher() (web/src/player/resync.js) pulls in a long chain of modules that
// each expect a browser environment (window/document/navigator/localStorage) at import
// time (tvdetect.js's isTv IIFE in particular). Set those up before the dynamic import
// below so the whole chain loads without throwing.
function setupGlobals({ playerDuration, playerCurrentTime, connected }) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    const fakeVideo = { duration: playerDuration, currentTime: playerCurrentTime };
    globalThis.document = {
        getElementById: () => null,
        querySelector: (sel) => (sel === '#ytapiplayer video, video' ? fakeVideo : null),
        querySelectorAll: () => [],
        body: { appendChild: () => {} },
        createElement: () => ({
            style: {},
            classList: { add() {}, remove() {}, contains: () => false },
            addEventListener() {},
            appendChild() {},
        }),
    };
    globalThis.window = { CytubeNative: undefined, screen: { width: 1920 }, PLAYER: undefined };
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });

    const reloadCalls = [];
    globalThis.location = { reload: () => reloadCalls.push(true) };

    const listeners = {};
    const fakeSocket = {
        connected,
        on: (event, cb) => { (listeners[event] ??= []).push(cb); },
        _emit: (event, data) => { (listeners[event] || []).forEach((cb) => cb(data)); },
    };
    globalThis.socket = fakeSocket;

    const rebuildCalls = [];
    globalThis.loadMediaPlayer = (d) => rebuildCalls.push(d);

    return { fakeSocket, fakeVideo, rebuildCalls, reloadCalls };
}

test('while still reconnecting, the safety timer does NOT rebuild against stale changeMedia data (does not restart an old movie)', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    // Socket never reconnects in this test -- worst case, a long/failed reconnect.
    const { fakeSocket, rebuildCalls } = setupGlobals({ playerDuration: 5000, playerCurrentTime: 1234, connected: false });

    const { initMediaWatcher } = await import('../src/player/resync.js');
    initMediaWatcher();

    // Movie A is playing when the app backgrounds.
    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A', seconds: 5000, paused: false, type: 'raw' });

    // App resumes; native fires the resume hook. The room may have moved on to Movie B
    // while backgrounded, but the socket hasn't reconnected yet.
    globalThis.window.__scStaleResync();

    t.mock.timers.tick(10000); // first safety-timer tick: still disconnected
    assert.strictEqual(rebuildCalls.length, 0, 'must not rebuild with stale data while disconnected');

    t.mock.timers.tick(10000); // second tick: still disconnected
    assert.strictEqual(rebuildCalls.length, 0, 'must keep waiting, not act on stale data');
});

test('after the reconnect-wait cap is exceeded, falls back to a full reload instead of trusting stale data forever', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { fakeSocket, rebuildCalls, reloadCalls } = setupGlobals({ playerDuration: 5000, playerCurrentTime: 1234, connected: false });

    const { initMediaWatcher } = await import('../src/player/resync.js');
    initMediaWatcher();

    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A', seconds: 5000, paused: false, type: 'raw' });
    globalThis.window.__scStaleResync();

    for (let i = 0; i < 7; i++) t.mock.timers.tick(10000); // well past the 6-attempt (60s) cap, still disconnected throughout

    assert.strictEqual(rebuildCalls.length, 0, 'never rebuilds with stale data');
    assert.strictEqual(reloadCalls.length, 1, 'gives up and reloads once waiting this long is clearly not working');
});

test('once actually reconnected, a changeMedia that arrives promptly rebuilds with the FRESH data', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { fakeSocket, fakeVideo, rebuildCalls } = setupGlobals({ playerDuration: 5000, playerCurrentTime: 1234, connected: true });

    const { initMediaWatcher } = await import('../src/player/resync.js');
    initMediaWatcher();

    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A', seconds: 5000, paused: false, type: 'raw' });
    globalThis.window.__scStaleResync();

    t.mock.timers.tick(3000); // reconnect (already connected) + changeMedia for Movie B lands quickly
    fakeVideo.duration = 5000; // old player hasn't rebuilt yet, still reports Movie A's duration
    fakeSocket._emit('changeMedia', { id: 'movieB', title: 'Movie B', seconds: 9000, paused: false, type: 'raw' });

    t.mock.timers.tick(4000); // the 4s post-changeMedia staleness check

    assert.strictEqual(rebuildCalls.length, 1);
    assert.strictEqual(rebuildCalls[0].id, 'movieB');
});

test('connected but genuinely no media change: a dead player still gets rebuilt (the original fix this feature was for)', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { fakeSocket, rebuildCalls } = setupGlobals({ playerDuration: 5000, playerCurrentTime: 1234, connected: true });

    const { initMediaWatcher } = await import('../src/player/resync.js');
    initMediaWatcher();

    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A', seconds: 5000, paused: false, type: 'raw' });
    globalThis.window.__scStaleResync();

    // No changeMedia ever arrives (nothing changed), but the player is dead (frozen playhead).
    t.mock.timers.tick(10000); // safety timer fires while connected -> runs the staleness check
    t.mock.timers.tick(2000);  // playhead-not-advancing follow-up check

    assert.strictEqual(rebuildCalls.length, 1);
    assert.strictEqual(rebuildCalls[0].id, 'movieA');
});
