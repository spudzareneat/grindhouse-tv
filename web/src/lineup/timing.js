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

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_MS = 86400000;

// A UTC-anchored timestamp for just d's Pacific CALENDAR DATE (no time-of-day) -- safe for
// day-difference arithmetic regardless of DST, since we never touch the time component.
function pacificDateOnly(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (t) => parts.find(p => p.type === t).value;
    return Date.UTC(+get('year'), +get('month') - 1, +get('day'));
}

function pacificWeekday(d) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).format(d);
}

// True if the list's Published timestamp falls within the current Mon-Sun week (Pacific) --
// i.e. this is genuinely the current week's list, not a stale one left from a prior week. A
// list published Wednesday always covers the Fri-Sun immediately following, in the same
// Mon-Sun calendar week, so "published this week" is equivalent to "covers the
// upcoming/current weekend".
export function isListForCurrentWeek(publishedAt, now = new Date()) {
    if (!publishedAt) return false;
    const pub = new Date(publishedAt);
    if (isNaN(pub.getTime())) return false;

    const todayIdx = WEEKDAY_INDEX[pacificWeekday(now)];
    const daysSinceMonday = (todayIdx + 6) % 7; // Mon=0 ... Sun=6
    const startOfWeek = pacificDateOnly(now) - daysSinceMonday * DAY_MS;
    const startOfNextWeek = startOfWeek + 7 * DAY_MS;

    const pubDay = pacificDateOnly(pub);
    return pubDay >= startOfWeek && pubDay < startOfNextWeek;
}

// True during the window the list exists but nothing live has started yet: the list is
// typically posted Wednesday for the upcoming Fri-Sun marathon, and showtime is "about Noon
// PST" on Friday. Wed/Thu/Fri-before-noon get one coarse "the first film starts around then"
// guess; Sat/Sun (marathon likely live already) and Mon/Tue don't -- and by the time this is
// checked, the caller has already confirmed via isListForCurrentWeek() that the list itself is
// genuinely current, so Mon/Tue staleness is handled separately, not by this function.
export function isBeforeFridayNoonPacific(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    if (weekday === 'Wed' || weekday === 'Thu') return true;
    if (weekday === 'Fri') return hour < 12;
    return false;
}
