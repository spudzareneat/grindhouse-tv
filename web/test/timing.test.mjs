import { test } from 'node:test';
import assert from 'node:assert';
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from '../src/lineup/timing.js';

// Fixed reference dates -- 2026-07-01 was confirmed a Wednesday from a real captured list page.
const PUBLISHED = '2026-07-01T16:00:37.212Z'; // Wed 2026-07-01, 09:00 PDT

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

test('isListForCurrentWeek: true for "now" later the same week (Friday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-03T20:00:00.000Z')), true);
});
test('isListForCurrentWeek: true for "now" on the last day of that week (Sunday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-05T20:00:00.000Z')), true);
});
test('isListForCurrentWeek: false once "now" crosses into the next week (Monday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-06T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false well into the next week (Wednesday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-08T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false when publishedAt is null', () => {
    assert.strictEqual(isListForCurrentWeek(null, new Date('2026-07-03T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false when publishedAt is unparseable', () => {
    assert.strictEqual(isListForCurrentWeek('not-a-date', new Date('2026-07-03T20:00:00.000Z')), false);
});

test('isBeforeFridayNoonPacific: true on Wednesday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-01T20:00:00.000Z')), true);
});
test('isBeforeFridayNoonPacific: true on Thursday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-02T20:00:00.000Z')), true);
});
test('isBeforeFridayNoonPacific: true Friday morning before noon Pacific', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-03T18:00:00.000Z')), true); // 11:00 PDT
});
test('isBeforeFridayNoonPacific: false Friday afternoon after noon Pacific', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-03T20:00:00.000Z')), false); // 13:00 PDT
});
test('isBeforeFridayNoonPacific: false on Saturday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-04T20:00:00.000Z')), false);
});
test('isBeforeFridayNoonPacific: false on Monday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-06T20:00:00.000Z')), false);
});
