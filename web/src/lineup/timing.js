/* ==========================================================
   TONIGHT'S LINEUP — timing/ETA model.
   Precision decays honestly the further out an estimate is: 'exact' (current
   feature's remaining runtime + one learned bumper gap), 'approx' (further out,
   compounding uncertainty), 'late' (tail of the night — running order only).
========================================================== */

// hour24/minute describe a local wall-clock time already computed by the caller
// (kept as plain numbers, not a Date, so this stays pure and timezone-independent).
export function formatEta(hour24, minute, precision) {
    if (precision === 'late') return 'LATE';
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let h = hour24 % 12;
    if (h === 0) h = 12;
    const mm = String(minute).padStart(2, '0');
    const prefix = precision === 'approx' ? '~' : '≈';
    return `${prefix} ${h}:${mm} ${period}`;
}

// Running median of observed bumper-gap durations (seconds) between features,
// used both to refine tonight's remaining ETAs and as the cold-start default for
// future nights (per the vision doc's "persist the learned gap" note).
export function medianGapSeconds(observedGaps) {
    if (!observedGaps.length) return null;
    const sorted = [...observedGaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Friendly display rounding for an ETA instant: these are guesses, so don't show
// oddly-specific minutes. 'approx' floors to the previous quarter-hour (4:39 -> 4:30);
// 'exact' has a real live anchor behind it, so it only snaps to the nearest 5 minutes.
// A displayed time must never already be in the past (it reads as broken -- seen live
// when a long bumper block pushed the walk behind the clock), so anything that rounds
// to before `nowMs` clamps up to the next grid point at-or-after now instead. Epoch
// flooring lands on local :00/:15/:30/:45 because real UTC offsets are 15-min multiples.
export function roundEtaMs(etaMs, precision, nowMs) {
    const grid = precision === 'exact' ? 5 * 60000 : 15 * 60000;
    const round = precision === 'exact' ? Math.round : Math.floor;
    const rounded = round(etaMs / grid) * grid;
    if (nowMs != null && rounded < nowMs) return Math.ceil(nowMs / grid) * grid;
    return rounded;
}

const MAX_ESTIMATED_AHEAD = 4; // live-anchored: how many upcoming films past "now" get ETAs
const MAX_PRE_SHOW = 3;        // projection-only: how many films get a "starts around then" guess

// Per-film played/now-playing/ETA model for one day of the lineup. Pure -- every
// input is a number/array so the whole branch tree is unit-testable without the
// socket/DOM state data.js feeds it from. Returns one entry per film (same order):
//   { played, isNowPlaying, etaMs: epoch-ms | null, precision: 'exact' | 'approx' }
// Estimates degrade honestly by evidence quality: a confirmed now-playing film gives
// the next film an 'exact' ETA; a bumper anchor or the noon-Pacific clock projection
// only ever supports 'approx'.
export function estimateDayItems({
    nowMs, anchorMs, runtimesMin, gapSeconds, dayStatus,
    currentIndex, remainingSec, furthestPlayedIndex, bumperStartMs,
}) {
    const gapMs = gapSeconds * 1000;
    const runtimeMs = (i) => (runtimesMin[i] ? runtimesMin[i] * 60000 : 0);
    const blank = { played: false, isNowPlaying: false, etaMs: null, precision: 'approx' };

    if (dayStatus === 'past') {
        return runtimesMin.map(() => ({ ...blank, played: true }));
    }

    // Clock projection from the noon anchor: each film's start/end if the night ran
    // exactly to schedule. Used for future days, today's pre-show, and joined-late.
    const projected = [];
    let cursor = anchorMs;
    runtimesMin.forEach((_, i) => {
        projected.push({ startMs: cursor, endMs: cursor + runtimeMs(i) });
        cursor += runtimeMs(i) + gapMs;
    });

    if (dayStatus === 'today' && currentIndex >= 0) {
        // Live anchor: walk forward from the current film's remaining runtime.
        let cumulative = Math.max(0, remainingSec) * 1000;
        return runtimesMin.map((_, idx) => {
            if (idx === currentIndex) return { ...blank, isNowPlaying: true };
            if (idx < currentIndex || idx <= furthestPlayedIndex) return { ...blank, played: true };
            const offset = idx - currentIndex;
            cumulative += gapMs;
            const withEta = offset <= MAX_ESTIMATED_AHEAD
                ? { ...blank, etaMs: nowMs + cumulative, precision: offset === 1 ? 'exact' : 'approx' }
                : { ...blank };
            cumulative += runtimeMs(idx);
            return withEta;
        });
    }

    if (dayStatus === 'today' && furthestPlayedIndex >= 0) {
        // Bumper between films (or a title we failed to match): the furthest observed
        // film has finished; keep estimating from when the unmatched item started.
        let cumulative = (bumperStartMs != null ? bumperStartMs : nowMs) + gapMs;
        return runtimesMin.map((_, idx) => {
            if (idx <= furthestPlayedIndex) return { ...blank, played: true };
            const offset = idx - furthestPlayedIndex;
            const withEta = offset <= MAX_ESTIMATED_AHEAD ? { ...blank, etaMs: cumulative } : { ...blank };
            cumulative += runtimeMs(idx) + gapMs;
            return withEta;
        });
    }

    // No observation at all: future day, today's pre-show, or joined-late today.
    // Gray by projected end; guess starts for the next MAX_PRE_SHOW unstarted films.
    // A film straddling `now` is left unmarked -- probably playing, but unconfirmed.
    let guesses = 0;
    return runtimesMin.map((_, idx) => {
        const p = projected[idx];
        if (dayStatus === 'today') {
            if (p.endMs < nowMs) return { ...blank, played: true };
            if (p.startMs <= nowMs) return { ...blank }; // straddling now: probably playing, unconfirmed
        }
        if (guesses < MAX_PRE_SHOW) {
            guesses++;
            return { ...blank, etaMs: p.startMs };
        }
        return { ...blank };
    });
}

// Pacific-timezone offset (minutes, e.g. -420 during PDT / -480 during PST) of the
// UTC instant `d`. Noon is never within a couple hours of a DST transition (those
// happen at 2am local), so a single read-back is safe — no iteration needed.
function pacificOffsetMinutes(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d);
    const get = (t) => parts.find(p => p.type === t).value;
    const hour = parseInt(get('hour'), 10) % 24; // Intl can render midnight as "24"
    const asUTC = Date.UTC(+get('year'), +get('month') - 1, +get('day'), hour, +get('minute'), +get('second'));
    return (asUTC - d.getTime()) / 60000;
}

// The UTC instant that is Noon Pacific on the given 'YYYY-MM-DD' calendar date — the
// per-day showtime anchor ("Showtime starts each day at about Noon PST"), used as the
// walk-forward start point for whichever day is selected, not just Friday.
export function dayAnchorPacific(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const offsetMinutes = pacificOffsetMinutes(guess);
    return new Date(guess.getTime() - offsetMinutes * 60000);
}

// Today's Pacific calendar date as 'YYYY-MM-DD' — used to pick the default day tab
// (isToday) and to decide whether "now playing" should even be searched for on a
// given day.
export function pacificDateString(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const get = (t) => parts.find(p => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

// True once a cached schedule's own weekend has fully elapsed. The pinned Reddit post
// always describes the upcoming Fri-Sun, so once Sunday's date is in the past there is
// definitely a newer post live -- a harder, date-driven signal than a fetch-age timer,
// used by data.js to guarantee a rolled-over post gets picked up rather than relying on
// however long it's been since the last fetch.
export function scheduleExpired(sched, todayStr = pacificDateString()) {
    const lastDate = sched.days.reduce((max, d) => (d.date && d.date > max ? d.date : max), '');
    return !lastDate || todayStr > lastDate;
}
