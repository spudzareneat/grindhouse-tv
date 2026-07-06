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
