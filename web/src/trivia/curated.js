/* ==========================================================
   CURATED POP-UP TRIVIA + DRIVE-IN TOTALS — pure helpers.
   Ported from the sibling PC userscript's trivia-popup module
   (cytube_tv_interface_script src/pc/modules/trivia-popup/index.js,
   the "curated-timeline slice"). No DOM, no globals, so
   test/curated.test.mjs can import them directly.

   Curated facts carry a playback time `t`, so every viewer (CyTube keeps
   them in sync) sees the same bubble at the same moment. The Drive-In
   Totals card comes from Joe Bob's CSV, for any movie in it, curated or not.
========================================================== */

const TP_CURATED_SCHEMA = 1;
// A fact is still "due" up to this many seconds after its t -- covers the
// 3s heartbeat and brief blocks (paused, window unfocused). Anything older
// counts as missed (seek / late join) and is skipped, never burst-fired.
export const TP_TIMELINE_WINDOW_S = 20;
const TP_CURATED_MAX_LEN = 280; // same legibility cap as TP_MAX_FACT_LEN; the generator itself targets 200

// Person facts may carry an IMDb headshot (generator-attached, from its own
// IMDb lookup). Only ever load images from IMDb's image CDN, and only URLs
// made of plain path characters -- the file is public data, so a hand edit
// or a bad commit must not be able to point the badge anywhere else.
const TP_IMAGE_URL_RE = /^https:\/\/m\.media-amazon\.com\/images\/[A-Za-z0-9@._,%\/-]+$/;
export function tpSafeImageUrl(url) {
    return typeof url === 'string' && url.length < 500 && TP_IMAGE_URL_RE.test(url);
}

// Citation link shown in the Trivia panel: plain http(s) only, and no
// characters that could break out of an attribute even if escaping were
// ever missed.
const TP_LINK_URL_RE = /^https?:\/\/[^\s"'<>`]+$/;
function tpSafeLinkUrl(url) {
    return typeof url === 'string' && url.length < 1000 && TP_LINK_URL_RE.test(url);
}

// Returns the doc's usable facts, normalized and sorted by t, or null when
// the doc is unusable (wrong schema / wrong movie / nothing valid) so the
// caller falls back to IMDb trivia. expectedId null skips the id check
// (dev override, which applies to whatever is playing).
export function tpValidateCurated(doc, expectedId) {
    if (!doc || typeof doc !== 'object' || doc.schema !== TP_CURATED_SCHEMA) return null;
    if (expectedId && doc.imdbId !== expectedId) return null;
    if (!Array.isArray(doc.facts)) return null;
    const facts = [];
    for (const f of doc.facts) {
        if (!f || typeof f !== 'object') continue;
        if (typeof f.t !== 'number' || !Number.isFinite(f.t) || f.t < 0) continue;
        if (typeof f.text !== 'string') continue;
        const text = f.text.trim();
        if (!text || text.length > TP_CURATED_MAX_LEN) continue;
        facts.push({
            t: f.t,
            rank: [1, 2, 3].includes(f.rank) ? f.rank : 2,
            anchor: f.anchor === 'scene' ? 'scene' : 'spread',
            text,
            icon: typeof f.icon === 'string' ? f.icon : null,
            byline: typeof f.byline === 'string' && f.byline.trim() ? f.byline.trim() : null,
            ...(tpSafeImageUrl(f.image) ? { image: f.image } : {}),
            ...(tpSafeLinkUrl(f.source && f.source.url) ? { sourceUrl: f.source.url } : {}),
        });
    }
    if (!facts.length) return null;
    facts.sort((a, b) => a.t - b.t);
    return facts;
}

// Frequency setting -> highest rank shown. Deterministic, so viewers on
// the same setting see exactly the same bubbles.
const TP_RANK_CUTOFF = { frequent: 3, occasional: 2, rare: 1 };
function tpRankAllowed(rank, tierName) {
    return rank <= (TP_RANK_CUTOFF[tierName] || TP_RANK_CUTOFF.occasional);
}

// The earliest unseen, rank-allowed fact whose t has been reached but is
// no more than TP_TIMELINE_WINDOW_S behind currentTime -- or null.
export function tpDueFact(facts, currentTime, tierName, seenTexts) {
    if (!Array.isArray(facts) || typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return null;
    for (const f of facts) {
        if (f.t > currentTime) break; // sorted by t
        if (currentTime - f.t > TP_TIMELINE_WINDOW_S) continue;
        if (!tpRankAllowed(f.rank, tierName)) continue;
        if (seenTexts.includes(f.text)) continue;
        return f;
    }
    return null;
}

// Catch-up for viewers who joined late or skipped ahead: facts whose due
// window has already passed are shown in the quiet gaps between timed
// facts, instead of being lost. Never crowds the synced timeline -- only
// when the last bubble was >= TP_CATCHUP_MIN_GAP_S ago and the next timed
// fact this viewer will actually see is >= TP_CATCHUP_CLEAR_S away.
// "scene" facts are excluded (they point at something on screen at that
// moment, meaningless later). Best rank first, then earliest. Missed facts
// are always from earlier in the movie, so this can't spoil anything.
const TP_CATCHUP_MIN_GAP_S = 45;
const TP_CATCHUP_CLEAR_S = 60;
export function tpCatchUpFact(facts, currentTime, tierName, seenTexts, secsSinceLastPop) {
    if (!Array.isArray(facts) || typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return null;
    if (!(secsSinceLastPop >= TP_CATCHUP_MIN_GAP_S)) return null;
    const shows = f => tpRankAllowed(f.rank, tierName) && !seenTexts.includes(f.text);
    const next = facts.find(f => f.t + TP_TIMELINE_WINDOW_S >= currentTime && shows(f));
    if (next && next.t - currentTime < TP_CATCHUP_CLEAR_S) return null;
    const missed = facts.filter(f => f.t + TP_TIMELINE_WINDOW_S < currentTime && f.anchor !== 'scene' && shows(f));
    if (!missed.length) return null;
    return missed.slice().sort((a, b) => a.rank - b.rank || a.t - b.t)[0];
}

// Drive-In Totals card: one per movie, for any movie in Joe Bob's Drive-In
// Totals CSV (spudzareneat/JoeBobBriggsDriveInTotals), curated or not --
// his counts, then his star rating, then (if any) a Drive-In Academy Award
// nominations slide (see _tpShowDriveInCard). Shown on every frequency
// tier at TP_DRIVEIN_T; remembered in the seen list under
// TP_DRIVEIN_SEEN_KEY so a reload doesn't replay it.
export const TP_DRIVEIN_SEEN_KEY = '[drive-in-totals card]';
const TP_DRIVEIN_T = 15; // plays over the opening of the movie

// Minimal RFC 4180 parser: quoted fields, "" escapes, embedded commas/newlines, CRLF.
export function tpParseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

// { tconst: { totals, nominations, starRating, stars } } from the CSV text.
export function tpIndexDriveInCsv(text) {
    const [header, ...rows] = tpParseCsv(text || '');
    const index = {};
    if (!header) return index;
    const col = name => header.indexOf(name);
    const ii = col('imdb_id'), ti = col('totals'), ai = col('academy_award_nominations'), ri = col('star_rating'), si = col('stars');
    if (ii < 0 || ti < 0) return index;
    for (const r of rows) {
        const id = (r[ii] || '').trim();
        if (!/^tt\d+$/.test(id)) continue;
        index[id] = { totals: (r[ti] || '').trim(), nominations: (r[ai] || '').trim(), starRating: (r[ri] || '').trim(), stars: (r[si] || '').trim() };
    }
    return index;
}

// Ported from the generator's deterministic Totals splitter
// (grindhouse-popup-trivia src/driveintotals.js).
const TP_ABBREV = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'vs', 'etc', 'approx', 'lt', 'sgt', 'capt', 'col', 'gen', 'prof', 'mt']);

// Sentence split that ignores periods inside quotes/parentheses, after abbreviations and initials.
export function tpSplitSentences(text) {
    const out = [];
    let buf = '', depth = 0, inQuote = false;
    for (const c of text) {
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === '"') inQuote = !inQuote;
        else if (c === '“') inQuote = true;
        else if (c === '”') inQuote = false;
        if (/\s/.test(c) && depth === 0 && !inQuote && /[.!?]["'”’)]*$/.test(buf)) {
            const lastWord = (buf.match(/([A-Za-z]+)\.$/) || [])[1];
            const initial = /(^|[\s.])[A-Z]\.$/.test(buf); // "G. Ross", "D.C. Lacroix"
            if (!(lastWord && TP_ABBREV.has(lastWord.toLowerCase())) && !initial) {
                if (buf.trim()) out.push(buf.trim());
                buf = '';
                continue;
            }
        }
        buf += c;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
}

// Splits on `sep` only outside quotes/parentheses ("...on cue;" stays whole).
function tpSplitOutside(text, sep) {
    const out = [];
    let buf = '', depth = 0, inQuote = false;
    for (const c of text) {
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === '"') inQuote = !inQuote;
        else if (c === '“') inQuote = true;
        else if (c === '”') inQuote = false;
        if (c === sep && depth === 0 && !inQuote) { out.push(buf); buf = ''; continue; }
        buf += c;
    }
    out.push(buf);
    return out;
}

const TP_SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'n', 'vs']);
const TP_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TP_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// "Seventy-Six breasts" -> "76 breasts". Only the number phrase that starts the line.
function tpLeadingNumberToDigits(s) {
    const m = s.match(/^((?:one|a)\s+hundred\s+(?:and\s+)?)?([a-z]+)(?:[-\s]([a-z]+))?\b/i);
    if (!m) return s;
    const hundred = m[1] ? 100 : 0;
    const w1 = m[2].toLowerCase(), w2 = m[3] && m[3].toLowerCase();
    const t = TP_TENS.indexOf(w1), u2 = w2 ? TP_UNITS.indexOf(w2) : -1;
    if (t >= 2 && u2 >= 1 && u2 <= 9) return `${hundred + t * 10 + u2}${s.slice(m[0].length)}`;
    if (t >= 2) return `${hundred + t * 10}${s.slice((m[1] || '').length + m[2].length)}`;
    if (TP_UNITS.includes(w1)) return `${hundred + TP_UNITS.indexOf(w1)}${s.slice((m[1] || '').length + m[2].length)}`;
    return s;
}

// Capitalize each word (and each hyphenated part); small words stay lower mid-line.
// Never lowercases the rest of a word, so "McCoy" and "TV" survive.
function tpTitleCase(s) {
    let first = true;
    return s.replace(/[A-Za-z][A-Za-z']*/g, (w, off) => {
        const prev = s[off - 1];
        const lead = first || prev === '(' || prev === '-';
        first = false;
        if (!lead && TP_SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
        return w[0].toUpperCase() + w.slice(1);
    });
}

function tpCleanTotalsLine(sentence) {
    let s = sentence.trim().replace(/\.+$/, '').trim();
    s = s.replace(/^(?:we(?:'ve)?\s+(?:got|have)\s+(?:a\s+total\s+of\s+)?|we're\s+talking\s+|there\s+(?:are|is|were|was)\s+)/i, '');
    s = s.replace(/^approximately\b/i, 'About');
    return tpTitleCase(tpLeadingNumberToDigits(s));
}

const TP_STAR_SENTENCE = /\b(?:zero|no|one|two|three|four|[0-4](?:\.5)?)(?:\s+and\s+(?:a\s+)?half)?\s+stars?\b/i;
const TP_SIGN_OFF = /check (?:it|this) out|joe bob says?\b/i;
// Only short sentences count as a verdict/sign-off ("Three stars.", "Joe Bob says check it out.").
const tpIsVerdict = s => (TP_STAR_SENTENCE.test(s) || TP_SIGN_OFF.test(s)) && s.split(/\s+/).length <= 8;
const tpTrimTail = s => s.replace(/[\s,;:.-]+$/, '');
function tpClip(s, max) {
    if (s.length <= max) return s;
    const cut = s.lastIndexOf(' ', max - 1);
    return tpTrimTail(s.slice(0, cut > 0 ? cut : max - 1)) + '…';
}

// The nominations column -> one line per nominee. "Drive-In Academy Award
// nominations for A, B, and C." gives [A, B, C]; ";"-separated entries
// (nominee plus role/quote) are one line each; a comma list with long
// parts (a role or quote inside) stays one line. Sentences after the
// first ("In the Drive-In Hall of Fame.") follow as their own lines; a
// leaked star rating / "check it out" is dropped.
const TP_NOMS_PREFIX = /^(?:drive-?in\s+academy\s+awards?(?:\s+nominations?)?|diaa(?:\s+nominations?)?)\s*(?:go(?:es)?\s+to|for)?\s*:?\s*/i;
export function tpNominationLines(text) {
    const sentences = tpSplitSentences((text || '').trim()).filter(s => !tpIsVerdict(s));
    if (!sentences.length) return [];
    const [first, ...rest] = sentences;
    const body = tpTrimTail(first.replace(TP_NOMS_PREFIX, ''));
    let names = tpSplitOutside(body, ';');
    if (names.length === 1) {
        const parts = body.split(/,\s+(?:and\s+)?|\s+and\s+/);
        if (parts.length > 1 && parts.every(p => p.trim().split(/\s+/).length <= 5)) names = parts;
    }
    return names.concat(rest)
        .map(n => tpTrimTail(n.trim().replace(/^and\s+/i, '')))
        .filter(Boolean)
        .map(n => tpClip(n[0].toUpperCase() + n.slice(1), 300))
        .slice(0, 30);
}

function tpNormalizeSays(says) {
    const t = says.trim();
    return /^(?:joe bob says? )?check it out\.?$/i.test(t) ? 'Joe Bob says check it out.' : t;
}

// A CSV row (from tpIndexDriveInCsv) -> the card, or null when there's
// nothing to count. Counts and Fu's -> lines (MonsterVision style: digits,
// Title Case; a long comma list is one count per item); `stars` -> 0..4 in
// half steps (null when unrated); says = the star phrase, plus Joe Bob's
// "check it out" pulled off the end of the counts.
export function tpDriveInCardFromRow(row) {
    if (!row || !row.totals) return null;
    const lines = [], signOff = [];
    for (const s of tpSplitSentences(row.totals)) {
        if (tpIsVerdict(s)) { if (TP_SIGN_OFF.test(s)) signOff.push(s); continue; }
        const parts = s.split(/,\s+(?:and\s+)?/);
        for (const part of parts.length >= 4 ? parts : [s]) {
            const line = tpCleanTotalsLine(part);
            if (line && !/^(?:and|but|also|plus|so)$/i.test(line)) lines.push(tpClip(line, 300));
        }
    }
    if (!lines.length) return null;
    const n = parseFloat(row.stars);
    const stars = Number.isFinite(n) ? Math.min(4, Math.max(0, Math.round(n * 2) / 2)) : null;
    const says = tpClip([row.starRating, ...signOff.map(tpNormalizeSays)].filter(Boolean).join(' '), 120);
    return { t: TP_DRIVEIN_T, lines: lines.slice(0, 60), stars, says, awards: tpNominationLines(row.nominations) };
}

// 'due' at its moment (within the same window as timed facts), 'catchup'
// once missed: a late joiner gets it TP_DRIVEIN_CATCHUP_S after the movie
// is identified (or after the last pop) -- same 15s lead-in as the start
// of the movie, not the 45s bubble catch-up gap. Else null.
const TP_DRIVEIN_CATCHUP_S = 15;
export function tpDriveInAction(card, currentTime, seenTexts, secsSinceLastPop) {
    if (!card || typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return null;
    if (seenTexts.includes(TP_DRIVEIN_SEEN_KEY) || currentTime < card.t) return null;
    if (currentTime - card.t <= TP_TIMELINE_WINDOW_S) return 'due';
    return secsSinceLastPop >= TP_DRIVEIN_CATCHUP_S ? 'catchup' : null;
}

// Four star slots: 1 full, 0.5 half, 0 empty outline.
export function tpStarFills(stars) {
    return [0, 1, 2, 3].map(k => Math.max(0, Math.min(1, stars - k)));
}
