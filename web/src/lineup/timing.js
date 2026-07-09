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
