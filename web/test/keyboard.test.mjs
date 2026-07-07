import { test } from 'node:test';
import assert from 'node:assert';
import { isEditable, labelFor } from '../src/chat/keyboard.js';

test('isEditable', () => {
    assert.strictEqual(isEditable({ tagName: 'INPUT' }), true);
    assert.strictEqual(isEditable({ tagName: 'TEXTAREA' }), true);
    assert.strictEqual(isEditable({ tagName: 'DIV' }), false);
    assert.strictEqual(isEditable(null), false);
});

test('labelFor identifies known fields', () => {
    assert.strictEqual(labelFor({ id: 'sc-chat-textarea', tagName: 'TEXTAREA' }), 'Chat message');
    assert.strictEqual(labelFor({ type: 'password', tagName: 'INPUT' }), 'Password');
    assert.strictEqual(labelFor({ id: 'sc-input-tmdb', tagName: 'INPUT' }), 'TMDB API key');
    assert.strictEqual(labelFor({ id: 'username', tagName: 'INPUT' }), 'Username');
    assert.strictEqual(labelFor({ tagName: 'INPUT' }), 'Text field');
    assert.strictEqual(labelFor(null), 'Text field');
});
