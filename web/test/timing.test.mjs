import { test } from 'node:test';
import assert from 'node:assert';
import { formatEta, medianGapSeconds, dayAnchorPacific, pacificDateString, estimateDayItems, roundEtaMs, scheduleExpired } from '../src/lineup/timing.js';

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
        nowMs: ANCHOR, anchorMs: ANCHOR, runtimesMin: RUNTIMES,
        sameSectionGapSeconds: GAP_S, crossSectionGapSeconds: GAP_S,
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

test('estimateDayItems: missing runtime withholds the ETA of the film that follows it (no duplicate)', () => {
    // Previously a null runtime contributed zero minutes to the walk, so item[1]'s ETA
    // silently duplicated item[0]'s -- seen live 2026-07-17 on the A-Go-Go section. More
    // honest to show nothing than a confident-looking wrong guess.
    const items = estimateDayItems({
        nowMs: ANCHOR, anchorMs: ANCHOR, runtimesMin: [null, 90, 80],
        sameSectionGapSeconds: GAP_S, crossSectionGapSeconds: GAP_S,
        dayStatus: 'future', currentIndex: -1, remainingSec: 0,
        furthestPlayedIndex: -1, bumperStartMs: null,
    });
    assert.strictEqual(items[0].etaMs, ANCHOR); // the unknown-runtime film's own start is still solid
    assert.strictEqual(items[1].etaMs, null);   // withheld, not duplicated
    assert.strictEqual(items[2].etaMs, null);   // uncertainty propagates past it too
});

test('estimateDayItems: live-anchored branch also withholds ETAs past an unknown-runtime film', () => {
    const now = ANCHOR + 200 * MIN;
    const items = estimate({
        nowMs: now, currentIndex: 1, remainingSec: 1200, furthestPlayedIndex: 0,
        runtimesMin: [90, 100, null, 95, 110, 70],
    });
    assert.notStrictEqual(items[2].etaMs, null); // next film after current: still live-anchored, confident
    assert.strictEqual(items[3].etaMs, null);    // item[2]'s own runtime is unknown -- past it, withheld
    assert.strictEqual(items[4].etaMs, null);
    assert.strictEqual(items[5].etaMs, null);
});

test('estimateDayItems: remainingSec null (duration not known yet) withholds the next film\'s ETA entirely', () => {
    // Distinct from remainingSec: 0 (genuinely wrapping up right now) -- null means "we don't
    // know," e.g. joined mid-film before the first changeMedia arrived. Treating it as 0 would
    // anchor the next film's ETA to nowMs+gap, a confident-looking but bogus guess (seen live
    // 2026-07-19 on the sibling userscript: showed ~10 min out with 15+ min actually remaining).
    const now = ANCHOR + 200 * MIN;
    const items = estimate({ nowMs: now, currentIndex: 1, remainingSec: null, furthestPlayedIndex: 0 });
    assert.strictEqual(items[1].isNowPlaying, true);
    assert.strictEqual(items[2].etaMs, null); // no live data to anchor it -- withheld, not a guess
    assert.strictEqual(items[3].etaMs, null);
});
test('estimateDayItems: remainingSec 0 (genuinely no time left) still gives an exact live-anchored ETA', () => {
    const now = ANCHOR + 200 * MIN;
    const items = estimate({ nowMs: now, currentIndex: 1, remainingSec: 0, furthestPlayedIndex: 0 });
    assert.strictEqual(items[2].etaMs, now + GAP_MS); // remaining=0 -> next film starts after just the gap
    assert.strictEqual(items[2].precision, 'exact');
});

test('estimateDayItems: bumper-anchored branch also withholds ETAs past an unknown-runtime film', () => {
    const now = ANCHOR + 200 * MIN;
    const items = estimate({
        nowMs: now, furthestPlayedIndex: 1, bumperStartMs: now - 2 * MIN,
        runtimesMin: [90, 100, null, 95, 110, 70],
    });
    assert.notStrictEqual(items[2].etaMs, null); // first film after furthest-played: still confident
    assert.strictEqual(items[3].etaMs, null);    // item[2]'s own runtime is unknown -- past it, withheld
    assert.strictEqual(items[4].etaMs, null);
});

test('estimateDayItems: cross-section gap applies at a section boundary, same-section elsewhere', () => {
    const now = ANCHOR + 200 * MIN;
    const sectionOf = [0, 0, 0, 1, 1, 1]; // matches RUNTIMES: first 3 films section 0, last 3 section 1
    const items = estimateDayItems({
        nowMs: now, anchorMs: ANCHOR, runtimesMin: RUNTIMES, sectionOf,
        sameSectionGapSeconds: 300, crossSectionGapSeconds: 1800, // 5 min vs 30 min
        dayStatus: 'today', currentIndex: 1, remainingSec: 1200,
        furthestPlayedIndex: 0, bumperStartMs: null,
    });
    // item[2]: still section 0 -- same-section gap.
    assert.strictEqual(items[2].etaMs, now + (1200 + 300) * 1000);
    // item[3]: crosses into section 1 -- cross-section gap, not the same-section one.
    assert.strictEqual(items[3].etaMs, now + (1200 + 300 + 80 * 60 + 1800) * 1000);
});

test('estimateDayItems: bumper-anchored branch also honors a cross-section gap at the boundary', () => {
    const now = ANCHOR + 200 * MIN;
    const bumperStart = now - 2 * MIN;
    const sectionOf = [0, 0, 0, 1, 1, 1];
    const items = estimateDayItems({
        nowMs: now, anchorMs: ANCHOR, runtimesMin: RUNTIMES, sectionOf,
        sameSectionGapSeconds: 300, crossSectionGapSeconds: 1800,
        dayStatus: 'today', currentIndex: -1, remainingSec: 0,
        furthestPlayedIndex: 2, bumperStartMs: bumperStart, // furthest-played is the last film of section 0
    });
    // item[3] is the first film of section 1 -- the gap right after furthestPlayedIndex crosses sections.
    assert.strictEqual(items[3].etaMs, bumperStart + 1800 * 1000);
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

test('roundEtaMs: a floored time in the past clamps up to the next grid point after now', () => {
    // estimate 4:52, now 4:57 -- floor would show 4:45 (already passed); clamp to 5:00
    assert.strictEqual(roundEtaMs(T0 + 52 * MIN, 'approx', T0 + 57 * MIN), T0 + 60 * MIN);
});
test('roundEtaMs: an estimate wholly in the past clamps to the next grid point after now', () => {
    assert.strictEqual(roundEtaMs(T0 + 10 * MIN, 'approx', T0 + 37 * MIN), T0 + 45 * MIN);
});
test('roundEtaMs: exact precision also clamps, on its 5-minute grid', () => {
    // estimate 6:35, now 6:36 -- show 6:40, not a time one minute ago
    assert.strictEqual(roundEtaMs(T0 + 35 * MIN, 'exact', T0 + 36 * MIN), T0 + 40 * MIN);
});
test('roundEtaMs: future estimates are unaffected by the clamp', () => {
    assert.strictEqual(roundEtaMs(T0 + 39 * MIN, 'approx', T0 + 5 * MIN), T0 + 30 * MIN);
});
test('roundEtaMs: now exactly on the grid is an acceptable display time', () => {
    assert.strictEqual(roundEtaMs(T0 + 29 * MIN, 'approx', T0 + 30 * MIN), T0 + 30 * MIN);
});

function schedWithDates(...dates) {
    return { days: dates.map(date => ({ date })) };
}
test('scheduleExpired: false while today falls within the cached weekend', () => {
    const sched = schedWithDates('2026-07-10', '2026-07-11', '2026-07-12');
    assert.strictEqual(scheduleExpired(sched, '2026-07-11'), false);
});
test('scheduleExpired: false on the cached weekend\'s last day itself', () => {
    const sched = schedWithDates('2026-07-10', '2026-07-11', '2026-07-12');
    assert.strictEqual(scheduleExpired(sched, '2026-07-12'), false);
});
test('scheduleExpired: true once today is after the cached weekend\'s last day', () => {
    const sched = schedWithDates('2026-07-10', '2026-07-11', '2026-07-12');
    assert.strictEqual(scheduleExpired(sched, '2026-07-15'), true);
});
test('scheduleExpired: true when no day in the cached schedule has a date at all', () => {
    assert.strictEqual(scheduleExpired(schedWithDates(null, null), '2026-07-11'), true);
});
test('scheduleExpired: unaffected by day array order -- picks the max date, not the last entry', () => {
    const sched = schedWithDates('2026-07-12', '2026-07-10', '2026-07-11');
    assert.strictEqual(scheduleExpired(sched, '2026-07-12'), false);
});
