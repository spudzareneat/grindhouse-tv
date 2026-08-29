import { test } from 'node:test';
import assert from 'node:assert';

// initDesyncButton() (web/src/chrome/buttons.js) pulls in tvnav.js, which pulls in a long
// chain of DOM/browser-dependent modules (same reason resync.test.mjs needs to fake out
// tvdetect.js's isTv IIFE) -- set up minimal fakes for all of it before the dynamic import.
function makeClassList() {
    const set = new Set();
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
    };
}

function makeFakeElement() {
    const listeners = {};
    return {
        style: {},
        dataset: {},
        classList: makeClassList(),
        addEventListener(type, cb) { (listeners[type] ??= []).push(cb); },
        appendChild() {},
        querySelector: () => null,
        click() { (listeners.click || []).forEach((cb) => cb()); },
    };
}

function setupGlobals() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };

    let capturedBtn = null;
    globalThis.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: {
            appendChild: (el) => { capturedBtn = el; },
            classList: makeClassList(),
        },
        addEventListener() {},
        createElement: () => makeFakeElement(),
    };
    globalThis.window = { CytubeNative: undefined, screen: { width: 1920 }, PLAYER: undefined };
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
    globalThis.location = { reload: () => {} };

    const listeners = {};
    const fakeSocket = {
        connected: true,
        on: (event, cb) => { (listeners[event] ??= []).push(cb); },
        off: (event, cb) => {
            const arr = listeners[event] || [];
            const i = arr.indexOf(cb);
            if (i !== -1) arr.splice(i, 1);
        },
        emit: () => {},
        _callbacks: {},
        _emit: (event, data) => { (listeners[event] || []).forEach((cb) => cb(data)); },
    };
    globalThis.socket = fakeSocket;
    globalThis.window.socket = fakeSocket; // whenSocket() (socket.js) reads window.socket

    return { fakeSocket, getBtn: () => capturedBtn };
}

test('a genuinely new video resets desync', async () => {
    const { fakeSocket, getBtn } = setupGlobals();
    const { initDesyncButton } = await import('../src/chrome/buttons.js');
    initDesyncButton();

    const btn = getBtn();
    btn.click(); // turn desync on
    assert.strictEqual(btn.classList.contains('sc-desync-active'), true);

    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A' });
    assert.strictEqual(btn.classList.contains('sc-desync-active'), false, 'new video must reset desync');
});

test('the SAME video re-announced (e.g. a reconnect) does NOT reset desync', async () => {
    const { fakeSocket, getBtn } = setupGlobals();
    const { initDesyncButton } = await import('../src/chrome/buttons.js');
    initDesyncButton();

    const btn = getBtn();

    // Establish the current video (as if it was already playing when desync turned on).
    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A' });
    btn.click(); // turn desync on
    assert.strictEqual(btn.classList.contains('sc-desync-active'), true);

    // Server re-announces the exact same video (a reconnect catch-up, not a new video).
    fakeSocket._emit('changeMedia', { id: 'movieA', title: 'Movie A' });
    assert.strictEqual(btn.classList.contains('sc-desync-active'), true, 'same video must NOT reset desync');

    // A genuinely different video afterward still resets it.
    fakeSocket._emit('changeMedia', { id: 'movieB', title: 'Movie B' });
    assert.strictEqual(btn.classList.contains('sc-desync-active'), false);
});
