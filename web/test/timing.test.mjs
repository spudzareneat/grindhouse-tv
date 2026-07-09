import { test } from 'node:test';
import assert from 'node:assert';
import { formatEta, medianGapSeconds, dayAnchorPacific, pacificDateString } from '../src/lineup/timing.js';

test('formatEta: exact precision uses the ≈ prefix', () => {
    assert.strictEqual(formatEta(21, 20, 'exact'), '≈ 9:20 PM');
});
test('formatEta: approx precision uses the ~ prefix', () => {
    assert.strictEqual(formatEta(23, 0, 'approx'), '~ 11:00 PM');
});
test('formatEta: late precision ignores the time and returns LATE', () => {
    assert.strictEqual(formatEta(3, 45, 'late'), 'LATE');
});
test('formatEta: midnight hour formats as 12, not 0', () => {
    assert.strictEqual(formatEta(0, 5, 'exact'), '≈ 12:05 AM');
});
test('formatEta: noon hour formats as 12 PM, not 0 PM', () => {
    assert.strictEqual(formatEta(12, 0, 'exact'), '≈ 12:00 PM');
});

test('medianGapSeconds: empty input returns null', () => {
    assert.strictEqual(medianGapSeconds([]), null);
});
test('medianGapSeconds: single value returns itself', () => {
    assert.strictEqual(medianGapSeconds([120]), 120);
});
test('medianGapSeconds: odd count returns the middle value', () => {
    assert.strictEqual(medianGapSeconds([150, 90, 120]), 120);
});
test('medianGapSeconds: even count averages the two middle values', () => {
    assert.strictEqual(medianGapSeconds([60, 150, 90, 120]), 105);
});

test('dayAnchorPacific: noon Pacific in summer (PDT, UTC-7) is 19:00 UTC', () => {
    const d = dayAnchorPacific('2026-07-10'); // Friday of the confirmed live schedule
    assert.strictEqual(d.toISOString(), '2026-07-10T19:00:00.000Z');
});
test('dayAnchorPacific: noon Pacific in winter (PST, UTC-8) is 20:00 UTC', () => {
    const d = dayAnchorPacific('2026-01-09');
    assert.strictEqual(d.toISOString(), '2026-01-09T20:00:00.000Z');
});

test('pacificDateString: formats a known UTC instant as its Pacific calendar date', () => {
    // 2026-07-10T19:00:00Z is noon PDT on 2026-07-10 -- same calendar date in both zones here.
    assert.strictEqual(pacificDateString(new Date('2026-07-10T19:00:00.000Z')), '2026-07-10');
});
test('pacificDateString: a late-UTC instant can still be the PREVIOUS Pacific calendar date', () => {
    // 2026-07-11T02:00:00Z is 2026-07-10T19:00:00 PDT -- still Friday in Pacific time.
    assert.strictEqual(pacificDateString(new Date('2026-07-11T02:00:00.000Z')), '2026-07-10');
});
