import { test } from 'node:test';
import assert from 'node:assert';

test('parseSrt: parses a basic two-cue file', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = [
        '1',
        '00:00:01,000 --> 00:00:04,000',
        'Hello there.',
        '',
        '2',
        '00:00:05,500 --> 00:00:07,250',
        'General Kenobi.',
        '',
    ].join('\n');
    const cues = parseSrt(srt);
    assert.strictEqual(cues.length, 2);
    assert.strictEqual(cues[0].start, 1);
    assert.strictEqual(cues[0].end, 4);
    assert.strictEqual(cues[0].text, 'Hello there.');
    assert.strictEqual(cues[1].start, 5.5);
    assert.strictEqual(cues[1].end, 7.25);
    assert.strictEqual(cues[1].text, 'General Kenobi.');
});

test('parseSrt: handles \\r\\n line endings and a leading BOM', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n\r\n';
    const cues = parseSrt(srt);
    assert.strictEqual(cues.length, 1);
    assert.strictEqual(cues[0].text, 'Hi');
});

test('parseSrt: keeps multi-line cue text joined with a newline', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two\n\n';
    const cues = parseSrt(srt);
    assert.strictEqual(cues[0].text, 'Line one\nLine two');
});

test('parseSrt: HTML-escapes text but keeps whitelisted i/b/u tags', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n<i>emphasis</i> & <script>alert(1)</script>\n\n';
    const cues = parseSrt(srt);
    assert.strictEqual(cues[0].text, '<i>emphasis</i> &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
});

test('parseSrt: skips a block with no timing line', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '1\nnot a timing line\ntext\n\n2\n00:00:01,000 --> 00:00:02,000\nreal cue\n\n';
    const cues = parseSrt(srt);
    assert.strictEqual(cues.length, 1);
    assert.strictEqual(cues[0].text, 'real cue');
});

test('parseSrt: skips a block whose end time is not after its start time', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '1\n00:00:05,000 --> 00:00:02,000\nbroken\n\n';
    assert.strictEqual(parseSrt(srt).length, 0);
});

test('parseSrt: skips a block with a timing line but no text', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    const srt = '1\n00:00:01,000 --> 00:00:02,000\n\n';
    assert.strictEqual(parseSrt(srt).length, 0);
});

test('parseSrt: empty/null input returns an empty array', async () => {
    const { parseSrt } = await import('../src/subtitles/opensubtitles.js?t=' + Date.now());
    assert.deepStrictEqual(parseSrt(''), []);
    assert.deepStrictEqual(parseSrt(null), []);
});
