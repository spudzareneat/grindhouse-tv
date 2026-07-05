import { test } from 'node:test';
import assert from 'node:assert';
import { whenSocket, onSocket } from '../src/socket.js';

test('socket appears late — callback fires once', () => {
    delete globalThis.window;
    globalThis.window = {};
    let calls = 0;
    let received = null;
    whenSocket((s) => { calls++; received = s; }, 5);
    assert.strictEqual(calls, 0, 'should not fire before socket exists');

    const fakeSocket = { on: () => {} };
    globalThis.window.socket = fakeSocket;

    return new Promise((resolve) => {
        setTimeout(() => {
            assert.strictEqual(calls, 1);
            assert.strictEqual(received, fakeSocket);
            delete globalThis.window;
            resolve();
        }, 600);
    });
});

test('socket never appears — gives up silently, no throw', () => {
    delete globalThis.window;
    globalThis.window = {};
    let calls = 0;
    assert.doesNotThrow(() => whenSocket(() => { calls++; }, 1));

    return new Promise((resolve) => {
        setTimeout(() => {
            assert.strictEqual(calls, 0);
            delete globalThis.window;
            resolve();
        }, 600);
    });
});

test('onSocket registers a handler once the socket is available', () => {
    delete globalThis.window;
    globalThis.window = {};
    const registered = [];
    globalThis.window.socket = { on: (event, handler) => registered.push({ event, handler }) };
    const handler = () => {};
    onSocket('changeMedia', handler);
    assert.strictEqual(registered.length, 1);
    assert.strictEqual(registered[0].event, 'changeMedia');
    assert.strictEqual(registered[0].handler, handler);
    delete globalThis.window;
});
