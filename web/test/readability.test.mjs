import { test } from 'node:test';
import assert from 'node:assert';
import { detectReadabilityIssues } from '../src/readability.js';

test('all caps words flagged', () => {
    assert.deepStrictEqual(
        detectReadabilityIssues('HELLO EVERYONE'),
        ['ALL CAPS: "HELLO", "EVERYONE" — hard to read']
    );
});

test('gibberish with no caps/repeats/punctuation is clean', () => {
    assert.deepStrictEqual(detectReadabilityIssues('asdfjkl;asdf'), []);
});

test('repeated characters and excessive punctuation both flagged', () => {
    assert.deepStrictEqual(
        detectReadabilityIssues('great movie!!!!!'),
        [
            'Repeated characters: "!!!!!" — hard to read',
            'Excessive punctuation: "!!!!!"',
        ]
    );
});

test('normal sentence is clean', () => {
    assert.deepStrictEqual(detectReadabilityIssues('a normal sentence.'), []);
});
