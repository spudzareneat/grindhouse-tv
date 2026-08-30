import { nativeHttpGet, nativeHttpPost } from '../native.js';
import { getKey, LS_OPENSUBTITLES } from '../store.js';

/* ==========================================================
   OPENSUBTITLES CLIENT — searches/downloads real movie subtitles keyed off
   the IMDb id this app's own TMDB/IMDb lookup (metadata/tmdb.js) already
   resolves for the now-playing title. English only for now (see the
   brainstorming design note: no language picker yet).

   Search + the final signed-link fetch are plain GETs over the existing
   nativeHttpGet bridge. The /download step is POST-only (it exchanges a
   file_id for a temporary signed link and counts against the key's daily
   quota), so it needs nativeHttpPost (native.js / CytubeJsBridge.kt).
========================================================== */

const API_BASE = 'https://api.opensubtitles.com/api/v1';
const USER_AGENT = 'GrindhouseTV v1.0';

function authHeaders(key) {
    return { 'Api-Key': key, 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' };
}

// Test-button validator (settings.js), same shape as validateTmdbKey: 'valid' | 'invalid' | 'error'.
//
// /infos/user looks like the obvious pick but is wrong -- it needs a full username/
// password login token, not just an Api-Key, so it 401s ("No token in request") for
// every key regardless of validity. /subtitles search doesn't validate the Api-Key at
// all (confirmed live: garbage key, or no key, both return normal 200 results) -- also
// useless as a check.
//
// What actually works (confirmed live against the real API): POST /download with a
// deliberately-invalid file_id. OpenSubtitles checks the Api-Key before it looks at
// file_id, and its failure mode for a bad/missing key on this endpoint is (oddly) a
// generic 503 "Service unavailable" rather than 401/403. A real key sails past that
// check and 406s on the bogus file_id itself ("Invalid file_id") -- it never resolves
// to a real signed link, so no quota is spent.
export async function validateOpensubtitlesKey(key) {
    if (!key) return 'invalid';
    try {
        const r = await nativeHttpPost(`${API_BASE}/download`, authHeaders(key), JSON.stringify({ file_id: 0 }));
        if (r.status === 503) return 'invalid';
        if (r.status >= 400 && r.status < 500) return 'valid'; // rejected the bogus file_id, not the key
        return 'error';
    } catch (e) { return 'error'; }
}

// Searches English subtitles for a resolved IMDb id ("tt1234567" or a bare number --
// OpenSubtitles' v1 API wants the numeric id). Never throws: no key, no imdbId, a
// network error, or a bad response all resolve to [] so callers can show a plain
// empty-state instead of juggling a .catch(). Sorted by download count (a reasonable
// "most likely a good release" proxy) and capped to a manageable picker list.
export async function searchSubtitles(imdbId) {
    const key = getKey(LS_OPENSUBTITLES);
    if (!key || !imdbId) return [];
    const numericId = String(imdbId).replace(/^tt/i, '');
    try {
        const r = await nativeHttpGet(
            `${API_BASE}/subtitles?imdb_id=${encodeURIComponent(numericId)}&languages=en`,
            authHeaders(key)
        );
        if (r.status !== 200) return [];
        const data = JSON.parse(r.body);
        return (data.data || [])
            .map((entry) => {
                const a = entry.attributes || {};
                const file = (a.files || [])[0];
                if (!file || !file.file_id) return null;
                return {
                    fileId: file.file_id,
                    release: a.release || 'Unknown release',
                    uploader: (a.uploader && a.uploader.name) || 'Unknown',
                    downloadCount: a.download_count || 0,
                    fromTrusted: !!a.from_trusted,
                    hearingImpaired: !!a.hearing_impaired,
                    machineTranslated: !!(a.machine_translated || a.ai_translated),
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.downloadCount - a.downloadCount)
            .slice(0, 8);
    } catch (e) { return []; }
}

// Exchanges a file_id for a temporary signed download link. Resolves null on any
// failure (bad/missing key, daily quota exhausted, network error) -- the picker
// shows an inline error rather than throwing.
export async function downloadSubtitle(fileId) {
    const key = getKey(LS_OPENSUBTITLES);
    if (!key || !fileId) return null;
    try {
        const r = await nativeHttpPost(`${API_BASE}/download`, authHeaders(key), JSON.stringify({ file_id: fileId }));
        if (r.status !== 200) return null;
        const data = JSON.parse(r.body);
        return data.link || null;
    } catch (e) { return null; }
}

// Plain GET of the signed link OpenSubtitles handed back -- no API key needed here,
// the link itself is the credential (and it expires).
export async function fetchSrtText(link) {
    if (!link) return null;
    try {
        const r = await nativeHttpGet(link);
        return r.status === 200 ? r.body : null;
    } catch (e) { return null; }
}

function srtTimeToSeconds(t) {
    const m = String(t).match(/(\d+):(\d\d):(\d\d)[,.](\d+)/);
    if (!m) return 0;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
}

// SRT files commonly carry a small set of formatting tags; everything else gets
// escaped since this is untrusted, user-uploaded third-party text rendered via
// innerHTML (overlay.js). Escape first, then punch a whitelist back open rather
// than trying to whitelist-parse arbitrary HTML.
const _ALLOWED_TAGS = ['i', 'b', 'u'];
function escapeSubtitleText(raw) {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/&lt;(\/?)(\w+)&gt;/g, (m, close, tag) =>
        _ALLOWED_TAGS.includes(tag.toLowerCase()) ? `<${close}${tag.toLowerCase()}>` : m);
}

// Parses SRT text into timed cues ({start, end, text}, seconds). Tolerant of
// \r\n, a leading BOM, and the occasional malformed block -- OpenSubtitles files
// are user-uploaded, not guaranteed well-formed. Multi-line cue text is joined
// with '\n' (rendering, e.g. as <br>, is the overlay's job, not the parser's).
export function parseSrt(text) {
    if (!text) return [];
    const noBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const clean = noBom.replace(/\r\n/g, '\n');
    const blocks = clean.split(/\n\n+/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.trim());
        if (!lines.length) continue;
        const timeLineIdx = lines.findIndex(l => l.includes('-->'));
        if (timeLineIdx === -1) continue;
        const [startStr, endStr] = lines[timeLineIdx].split('-->').map(s => s.trim());
        const start = srtTimeToSeconds(startStr);
        const end = srtTimeToSeconds(endStr);
        if (end <= start) continue;
        const textLines = lines.slice(timeLineIdx + 1);
        if (!textLines.length) continue;
        cues.push({ start, end, text: escapeSubtitleText(textLines.join('\n')) });
    }
    return cues;
}
