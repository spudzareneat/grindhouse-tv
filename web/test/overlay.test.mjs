import { test } from 'node:test';
import assert from 'node:assert';

const CUES = [
    { start: 1, end: 3, text: 'first' },
    { start: 5, end: 7, text: 'second' },
    { start: 10, end: 12, text: 'third' },
];

test('findActiveCueIndex: no offset -- exact cue windows', async () => {
    const { findActiveCueIndex } = await import('../src/subtitles/overlay.js?t=' + Date.now());
    assert.strictEqual(findActiveCueIndex(CUES, 2), 0);
    assert.strictEqual(findActiveCueIndex(CUES, 4), -1); // gap between cues
    assert.strictEqual(findActiveCueIndex(CUES, 6), 1);
    assert.strictEqual(findActiveCueIndex(CUES, 20), -1); // past the last cue
});

test('findActiveCueIndex: positive offset delays cues (need a later playhead to hit them)', async () => {
    const { findActiveCueIndex } = await import('../src/subtitles/overlay.js?t=' + Date.now());
    // Cue 0 originally [1,3]; offset +2 means it now shows during real time [3,5].
    assert.strictEqual(findActiveCueIndex(CUES, 2, 2), -1); // too early for the delayed cue
    assert.strictEqual(findActiveCueIndex(CUES, 4, 2), 0);  // now lands in the delayed window
});

test('findActiveCueIndex: negative offset advances cues (need an earlier playhead to hit them)', async () => {
    const { findActiveCueIndex } = await import('../src/subtitles/overlay.js?t=' + Date.now());
    // Cue 1 originally [5,7]; offset -2 means it now shows during real time [3,5].
    assert.strictEqual(findActiveCueIndex(CUES, 6, -2), -1); // too late for the advanced cue
    assert.strictEqual(findActiveCueIndex(CUES, 4, -2), 1);  // now lands in the advanced window
});

test('findActiveCueIndex: empty cue list is always -1 regardless of offset', async () => {
    const { findActiveCueIndex } = await import('../src/subtitles/overlay.js?t=' + Date.now());
    assert.strictEqual(findActiveCueIndex([], 5, 3), -1);
});
