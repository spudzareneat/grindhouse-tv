import { test } from 'node:test';
import assert from 'node:assert';
import { twemojiUrl } from '../src/emojisupport.js';

const file = (s) => twemojiUrl(s).split('/').pop();

test('single codepoint', () => {
    assert.strictEqual(file('🟢'), '1f7e2.svg');
});

test('FE0F dropped outside ZWJ sequences', () => {
    assert.strictEqual(file('❤️'), '2764.svg');
});

test('ZWJ sequence keeps FE0F', () => {
    assert.strictEqual(file('🏳️‍🌈'), '1f3f3-fe0f-200d-1f308.svg');
});

test('skin-tone modifier', () => {
    assert.strictEqual(file('👍🏽'), '1f44d-1f3fd.svg');
});
