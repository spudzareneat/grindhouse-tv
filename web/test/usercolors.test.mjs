import { test } from 'node:test';
import assert from 'node:assert';
import { usernameToColor } from '../src/usercolors.js';

test('similar names land on distinct hues', () => {
    assert.strictEqual(usernameToColor('mike'), 'hsl(207.1, 72%, 70%)');
    assert.strictEqual(usernameToColor('mikey'), 'hsl(23.3, 72%, 70%)');
});

test('same name is always deterministic', () => {
    assert.strictEqual(usernameToColor('Alice'), usernameToColor('Alice'));
    assert.strictEqual(usernameToColor('Alice'), 'hsl(276.2, 72%, 70%)');
});

test('other observed usernames', () => {
    assert.strictEqual(usernameToColor('bob123'), 'hsl(286.2, 72%, 70%)');
    assert.strictEqual(usernameToColor('ZZZ'), 'hsl(159.5, 72%, 70%)');
});
