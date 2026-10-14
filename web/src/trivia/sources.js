import { nativeHttpGet } from '../native.js';
import { tpValidateCurated, tpIndexDriveInCsv, tpDriveInCardFromRow } from './curated.js';

/* ==========================================================
   CURATED POP-UP TRIVIA + DRIVE-IN TOTALS — data sources.
   Both live on raw.githubusercontent.com and are fetched through the
   native bridge (same as lastaired.js's CSV). Shared by the pop-up
   scheduler (cards/triviapopup.js) and the Trivia card (cards/trivia.js),
   so opening the card costs nothing extra once the bubbles have fetched.
========================================================== */

const CURATED_BASE = 'https://raw.githubusercontent.com/spudzareneat/grindhouse-popup-trivia/main/data/';
const DRIVEIN_CSV_URL = 'https://raw.githubusercontent.com/spudzareneat/JoeBobBriggsDriveInTotals/main/drivein_totals.csv';

// Dev/testing override: put a whole curated JSON doc in this localStorage key
// (via tools/cdp.mjs) and it's used for WHATEVER movie is playing (id check
// skipped). Remove the key to go back to normal.
const LS_TRIVIA_CURATED_DEV = 'sc_trivia_curated_dev';

// Session cache keyed by tconst: { curated, at }. A found file is kept for the
// session; "not curated" (404 / invalid) expires after CURATED_RECHECK_MS,
// because the generator publishes files during the weekend and a movie that
// started before its file landed should pick it up. Transient failures
// (network error, timeout, 5xx) are not cached at all.
export const CURATED_RECHECK_MS = 10 * 60 * 1000;
const _curatedCache = {};

// { facts } for a usable curated doc, else null.
function _curated(doc, id) {
    const facts = tpValidateCurated(doc, id);
    return facts ? { facts } : null;
}

export async function fetchCuratedTrivia(id) {
    if (!id) return null;
    let devRaw = null;
    try { devRaw = localStorage.getItem(LS_TRIVIA_CURATED_DEV); } catch (e) {}
    if (devRaw) {
        console.warn('[trivia-popup] curated dev override active (localStorage sc_trivia_curated_dev) -- applies to every movie');
        try { return _curated(JSON.parse(devRaw), null); } catch (e) { return null; }
    }
    const cached = _curatedCache[id];
    if (cached && (cached.curated || Date.now() - cached.at < CURATED_RECHECK_MS)) return cached.curated;
    try {
        const res = await nativeHttpGet(CURATED_BASE + encodeURIComponent(id) + '.json');
        const ok = res && res.status >= 200 && res.status < 300;
        let curated = null;
        if (ok) { try { curated = _curated(JSON.parse(res.body), id); } catch (e) {} }
        if (ok || (res && res.status === 404)) _curatedCache[id] = { curated, at: Date.now() };
        return curated;
    } catch (e) { return null; }
}

// Joe Bob's Drive-In Totals, one row per movie keyed by imdb_id. Fetched once
// per page session (~430KB); a failed fetch isn't cached, so the next movie
// tries again.
let _driveInIndex = null; // Promise<index | null>
function _fetchDriveInIndex() {
    if (_driveInIndex) return _driveInIndex;
    _driveInIndex = nativeHttpGet(DRIVEIN_CSV_URL)
        .then(res => (res && res.status >= 200 && res.status < 300) ? tpIndexDriveInCsv(res.body) : null)
        .catch(() => null)
        .then(index => {
            if (!index || !Object.keys(index).length) { _driveInIndex = null; return null; }
            return index;
        });
    return _driveInIndex;
}

// The movie's Drive-In Totals card ({ t, lines, stars, says, awards }), or null.
export async function fetchDriveInCard(id) {
    if (!id) return null;
    const index = await _fetchDriveInIndex();
    return index ? tpDriveInCardFromRow(index[id]) : null;
}
