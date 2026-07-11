import { test } from 'node:test';
import assert from 'node:assert';
import { formatEta, medianGapSeconds, dayAnchorPacific, pacificDateString, estimateDayItems, roundEtaMs } from '../src/lineup/timing.js';

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

/* ---------- estimateDayItems ---------- */

const MIN = 60 * 1000;
const GAP_S = 600;             // 10-min bumper gap
const GAP_MS = GAP_S * 1000;
const ANCHOR = Date.UTC(2026, 6, 10, 19, 0, 0); // noon PDT, arbitrary but concrete
const RUNTIMES = [90, 100, 80, 95, 110, 70];    // minutes, 6 films

function estimate(overrides) {
    return estimateDayItems({
        nowMs: ANCHOR, anchorMs: ANCHOR, runtimesMin: RUNTIMES, gapSeconds: GAP_S,
        dayStatus: 'today', currentIndex: -1, remainingSec: 0,
        furthestPlayedIndex: -1, bumperStartMs: null,
        ...overrides,
    });
}

test('estimateDayItems: past day marks every item played with no ETA', () => {
    const items = estimate({ dayStatus: 'past' });
    assert.strictEqual(items.length, RUNTIMES.length);
    for (const it of items) {
        assert.strictEqual(it.played, true);
        assert.strictEqual(it.isNowPlaying, false);
        assert.strictEqual(it.etaMs, null);
    }
});

test('estimateDayItems: future day projects the first 3 starts from the noon anchor', () => {
    const items = estimate({ dayStatus: 'future' });
    assert.strictEqual(items[0].etaMs, ANCHOR);
    assert.strictEqual(items[1].etaMs, ANCHOR + 90 * MIN + GAP_MS);
    assert.strictEqual(items[2].etaMs, ANCHOR + (90 + 100) * MIN + 2 * GAP_MS);
    assert.strictEqual(items[3].etaMs, null); // only the first 3 get pre-show guesses
    assert.strictEqual(items[0].precision, 'approx');
    assert.strictEqual(items[1].precision, 'approx');
    assert.ok(items.every(it => !it.played && !it.isNowPlaying));
});

test('estimateDayItems: today pre-show (nothing observed, before noon) projects like a future day', () => {
    const items = estimate({ nowMs: ANCHOR - 60 * MIN });
    assert.strictEqual(items[0].etaMs, ANCHOR);
    assert.strictEqual(items[2].etaMs, ANCHOR + (90 + 100) * MIN + 2 * GAP_MS);
    assert.strictEqual(items[3].etaMs, null);
    assert.ok(items.every(it => !it.played));
});

test('estimateDayItems: live match walks remaining + gaps + runtimes, next film exact, 4-ahead cap', () => {
    const now = ANCHOR + 200 * MIN; // arbitrary evening clock
    const items = estimate({ nowMs: now, currentIndex: 1, remainingSec: 1200, furthestPlayedIndex: 0 });
    assert.strictEqual(items[1].isNowPlaying, true);
    assert.strictEqual(items[1].etaMs, null);
    assert.strictEqual(items[1].played, false);
    assert.strictEqual(items[0].played, true);          // aired earlier
    assert.strictEqual(items[0].etaMs, null);
    assert.strictEqual(items[2].etaMs, now + (1200 + GAP_S) * 1000);
    assert.strictEqual(items[2].precision, 'exact');
    assert.strictEqual(items[3].etaMs, now + (1200 + GAP_S + 80 * 60 + GAP_S) * 1000);
    assert.strictEqual(items[3].precision, 'approx');
    assert.notStrictEqual(items[5].etaMs, null);        // offset 4: still estimated
    assert.ok(items.slice(2).every(it => !it.played));
});

test('estimateDayItems: bumper playing keeps estimating from the bumper start', () => {
    const now = ANCHOR + 200 * MIN;
    const bumperStart = now - 2 * MIN;
    const items = estimate({ nowMs: now, furthestPlayedIndex: 1, bumperStartMs: bumperStart });
    assert.strictEqual(items[0].played, true);
    assert.strictEqual(items[1].played, true);          // it finished -- changeMedia moved past it
    assert.strictEqual(items[1].isNowPlaying, false);
    assert.strictEqual(items[2].etaMs, bumperStart + GAP_MS);
    assert.strictEqual(items[2].precision, 'approx');   // no live anchor: never 'exact'
    assert.strictEqual(items[3].etaMs, bumperStart + GAP_MS + 80 * MIN + GAP_MS);
    assert.notStrictEqual(items[5].etaMs, null);        // 4th after furthest: still estimated
    assert.ok(items.slice(2).every(it => !it.played));
});

test('estimateDayItems: bumper start unknown (relaunch mid-bumper) falls back to now + gap', () => {
    const now = ANCHOR + 200 * MIN;
    const items = estimate({ nowMs: now, furthestPlayedIndex: 1 });
    assert.strictEqual(items[2].etaMs, now + GAP_MS);
    assert.strictEqual(items[2].precision, 'approx');
});

test('estimateDayItems: joined late with nothing observed grays by clock projection', () => {
    // 50 min into film 1 by pure projection: film 0 ended, film 1 straddles now.
    const now = ANCHOR + (90 * MIN + GAP_MS) + 50 * MIN;
    const items = estimate({ nowMs: now });
    assert.strictEqual(items[0].played, true);
    assert.strictEqual(items[1].played, false);         // straddling: unconfirmed, leave alone
    assert.strictEqual(items[1].isNowPlaying, false);
    assert.strictEqual(items[1].etaMs, null);           // its start is already in the past
    const start2 = ANCHOR + (90 + 100) * MIN + 2 * GAP_MS;
    assert.strictEqual(items[2].etaMs, start2);
    assert.strictEqual(items[2].precision, 'approx');
    assert.notStrictEqual(items[3].etaMs, null);
    assert.notStrictEqual(items[4].etaMs, null);
    assert.strictEqual(items[5].etaMs, null);           // only 3 upcoming guesses
});

test('estimateDayItems: missing runtime contributes zero minutes to the walk', () => {
    const items = estimateDayItems({
        nowMs: ANCHOR, anchorMs: ANCHOR, runtimesMin: [null, 90, 80], gapSeconds: GAP_S,
        dayStatus: 'future', currentIndex: -1, remainingSec: 0,
        furthestPlayedIndex: -1, bumperStartMs: null,
    });
    assert.strictEqual(items[1].etaMs, ANCHOR + GAP_MS); // null runtime adds nothing
});

/* ---------- roundEtaMs ---------- */

const T0 = Date.UTC(2026, 6, 11, 16, 0, 0); // an exact hour, arbitrary

test('roundEtaMs: approx floors to the previous 15-minute mark (4:39 -> 4:30)', () => {
    assert.strictEqual(roundEtaMs(T0 + 39 * MIN, 'approx'), T0 + 30 * MIN);
});
test('roundEtaMs: approx floors 19 past to quarter past (6:19 -> 6:15)', () => {
    assert.strictEqual(roundEtaMs(T0 + 19 * MIN, 'approx'), T0 + 15 * MIN);
});
test('roundEtaMs: approx leaves an on-grid time alone', () => {
    assert.strictEqual(roundEtaMs(T0 + 45 * MIN, 'approx'), T0 + 45 * MIN);
});
test('roundEtaMs: exact rounds to the nearest 5 minutes (9:38 -> 9:40)', () => {
    assert.strictEqual(roundEtaMs(T0 + 38 * MIN, 'exact'), T0 + 40 * MIN);
});
test('roundEtaMs: exact rounds down when closer (9:52 -> 9:50)', () => {
    assert.strictEqual(roundEtaMs(T0 + 52 * MIN, 'exact'), T0 + 50 * MIN);
});
test('roundEtaMs: exact can round up across the hour (9:58 -> 10:00)', () => {
    assert.strictEqual(roundEtaMs(T0 + 58 * MIN, 'exact'), T0 + 60 * MIN);
});
