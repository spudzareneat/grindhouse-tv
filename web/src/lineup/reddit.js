/* ==========================================================
   TONIGHT'S LINEUP -- Reddit schedule fetch.
   r/420Grindhouse's Atom feed (https://www.reddit.com/r/420Grindhouse/.rss) is
   reachable with a browser UA and no login (the .json endpoints 403 the same
   way generic bots get blocked elsewhere in this app; .rss doesn't). The feed
   does NOT reliably sort the current/pinned schedule post first (see
   selectCurrentEntry below) -- every entry has to be checked, not just #1.

   The post body is a fixed markdown->HTML shape: an intro paragraph, then
   repeating <p><strong>Day</strong></p> headers (Friday/Saturday/Sunday, a
   closed 3-name set) each followed by 2-4 <p><strong>Section Name</strong>
   </p> + <ul><li>Title (Year)</li>...</ul> pairs. Two independent layers of
   HTML-entity escaping are present: the Atom feed XML-escapes the whole
   content blob, and Reddit's own markdown renderer separately entity-encodes
   special characters (apostrophes, etc.) within it -- decodeHtmlEntities is
   applied once, up front, so everything downstream works on plain text/tags.
========================================================== */
const FEED_URL = 'https://www.reddit.com/r/420Grindhouse/.rss';
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const DAY_NAMES = ['Friday', 'Saturday', 'Sunday'];

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Reddit's markdown renderer entity-encodes special chars (e.g. an apostrophe -> &#39;)
// INSIDE the body, then the Atom feed XML-escapes the whole blob again, turning that into
// &amp;#39; -- so &amp; must be unescaped before the numeric/hex entities are decoded, or a
// double-encoded entity (seen live 2026-07-15: "They&#39;re Coming to Get You!" survived
// straight into the TMDB query) never gets a second decode pass.
function decodeHtmlEntities(s) {
    return s
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// Extracts every <entry> in the feed, in feed order. Reddit does NOT reliably sort the
// current/pinned schedule post first -- confirmed live 2026-07-22: an already-expired
// "Fri 7/17 - Sun 7/19" post sat in entry #0 all week while the brand-new "Fri 7/24 -
// Sun 7/26" post (published same day) sat in entry #1 behind it, apparently ordered by
// pin slot rather than recency/validity. selectCurrentEntry (below) is what actually
// picks the right one; this just does the raw extraction for every candidate.
function parseEntries(feedXml) {
    const entries = [];
    let searchFrom = 0;
    while (true) {
        const start = feedXml.indexOf('<entry>', searchFrom);
        if (start === -1) break;
        const end = feedXml.indexOf('</entry>', start);
        if (end === -1) break;
        const entry = feedXml.slice(start, end + '</entry>'.length);
        searchFrom = end + '</entry>'.length;
        const idM = entry.match(/<id>([^<]+)<\/id>/);
        const titleM = entry.match(/<title>([^<]+)<\/title>/);
        const contentM = entry.match(/<content type="html">([\s\S]*?)<\/content>/);
        if (!idM || !titleM || !contentM) continue;
        const pubM = entry.match(/<published>([^<]+)<\/published>/);
        entries.push({
            postId: idM[1],
            title: decodeHtmlEntities(titleM[1]),
            publishedAt: pubM ? pubM[1] : null,
            contentHtml: decodeHtmlEntities(contentM[1]),
        });
    }
    return entries;
}

// Kept for the existing single-entry callers/tests -- just the first extracted entry,
// with no attempt to pick the *right* one (see selectCurrentEntry for that). Returns
// null if the feed has no entries or is missing a required field.
export function parseFirstEntry(feedXml) {
    return parseEntries(feedXml)[0] ?? null;
}

// The pinned schedule post is expected within the top 3 feed entries; scanning a couple
// extra costs nothing and covers a mod re-pin landing it one slot further out.
const CANDIDATE_SCAN_LIMIT = 5;

// Picks the actual current schedule post out of the top of the feed: of the entries
// whose title looks like a schedule post (parseDateRange returns non-null -- filters out
// unrelated posts like "4 Days" or a single-film announcement), the one published most
// recently wins. Confirmed live 2026-07-22: the correct post is always the newest one,
// even when an older, already-expired schedule post happens to sort ahead of it in raw
// feed order (seen that day -- last weekend's post stayed in entry #0 while this
// weekend's, published same-day, sat in entry #1).
export function selectCurrentEntry(entries) {
    let best = null;
    for (const entry of entries.slice(0, CANDIDATE_SCAN_LIMIT)) {
        if (!parseDateRange(entry.title, entry.publishedAt)) continue; // not a schedule post
        if (!best || new Date(entry.publishedAt) > new Date(best.publishedAt)) best = entry;
    }
    return best;
}

// Parses "Weekend Grindhouse Schedule - Fri 7/10 - Sun 7/12" into real
// calendar dates. Only Friday's month/day is read from the title -- Saturday
// and Sunday are always +1/+2 days from Friday, which sidesteps a January
// weekend's Sunday parsing as a different (already-passed) month. The year
// comes from the post's own publishedAt timestamp, not system "now" -- except
// a December post for a January weekend, where the weekend is next year.
export function parseDateRange(title, publishedAt) {
    const m = title && title.match(/Fri\D*(\d{1,2})\/(\d{1,2})/i);
    if (!m || !publishedAt) return null;
    const pub = new Date(publishedAt);
    if (isNaN(pub.getTime())) return null;
    const friMonth = parseInt(m[1], 10), friDay = parseInt(m[2], 10);
    const pubMonth = pub.getMonth() + 1;
    const year = (pubMonth === 12 && friMonth === 1) ? pub.getFullYear() + 1 : pub.getFullYear();
    const fri = Date.UTC(year, friMonth - 1, friDay);
    const toStr = (ms) => new Date(ms).toISOString().slice(0, 10);
    return { fri: toStr(fri), sat: toStr(fri + 86400000), sun: toStr(fri + 2 * 86400000) };
}

// Each <li> is "Title (Year)", sometimes with a leading bold label
// ("<strong>420 Grindhouse Premiere:</strong> Sleepover Slaughter (2026)")
// or trailing "aka Other Title" name(s). The primary (title, year) pair drives
// the TMDB lookup; akas become extra MATCH aliases (the stream sometimes plays
// a film under the file's aka name -- seen live 2026-07-11); `display` keeps
// the full original text.
function parseListItems(ulInnerHtml) {
    const items = [];
    const liRe = /<li>([\s\S]*?)<\/li>/g;
    let lm;
    while ((lm = liRe.exec(ulInnerHtml))) {
        const display = lm[1].replace(/<strong>[^<]*<\/strong>\s*/, '').replace(/<[^>]+>/g, '').trim();
        if (!display) continue;
        const [primary, ...akaParts] = display.split(/\s+aka\s+/i);
        const akas = akaParts
            .map(a => a.replace(/\s*\(\d{4}\)\s*$/, '').trim())
            .filter(Boolean);
        // Non-greedy up to the FIRST "(YYYY)" -- tolerates trailing typos/garbage after
        // it (seen live 2026-08-07 on the sibling userscript: a mod typo left
        // "Decampitated (1998))" with an extra closing paren, which the old
        // exact-end-anchored regex rejected outright).
        const ym = primary.trim().match(/^(.*?)\s*\((\d{4})\)/);
        if (ym) {
            items.push({ title: ym[1].trim(), year: ym[2], display, akas });
        } else {
            // No parseable year at all -- still show it instead of silently vanishing
            // the film from the lineup. TMDB lookup runs yearless off the raw text; the
            // card just won't have a poster/overview if that search comes up empty too.
            console.warn('[SC] lineup: could not parse title/year from schedule item, showing raw text:', display);
            items.push({ title: primary.trim(), year: null, display, akas });
        }
    }
    return items;
}

// Case-insensitive "is this schedule item the film called `title`?" -- checks the
// primary title and every post-provided aka. Tolerates cached schedules written
// before akas existed (no `akas` field).
export function itemMatchesTitle(item, title) {
    const t = (title || '').toLowerCase();
    if (item.title.toLowerCase() === t) return true;
    return (item.akas || []).some(a => a.toLowerCase() === t);
}

// Walks the post body in document order, assigning each <ul> of films to the
// most recently seen section name, and each section to the most recently
// seen day. Day names are a closed 3-name set (Friday/Saturday/Sunday) --
// everything else in a standalone <strong> is treated as a section name.
export function parseSchedule(contentHtml) {
    const days = [];
    let currentDay = null;
    let pendingSectionName = null;
    const re = /<strong>([^<]*)<\/strong>|<ul>([\s\S]*?)<\/ul>/g;
    let m;
    while ((m = re.exec(contentHtml))) {
        if (m[1] !== undefined) {
            const text = m[1].trim();
            // Mods sometimes wrap the day header in extra markdown emphasis inside the
            // bold ("==Friday=="), which survives entity-decoding as literal '=' characters
            // -- strip any leading/trailing non-letters before comparing so decoration
            // doesn't stop currentDay from ever being set (seen live 2026-08-07 on the
            // sibling userscript: an "==Friday==" header silently produced zero parsed
            // days). The cleaned name, not the decorated text, is stored since it's used
            // later as dateByDay's Friday/Saturday/Sunday lookup key in fetchTonightsSchedule.
            const dayName = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
            if (DAY_NAMES.includes(dayName)) {
                currentDay = { day: dayName, sections: [] };
                days.push(currentDay);
                pendingSectionName = null;
            } else {
                pendingSectionName = text;
            }
        } else if (currentDay && pendingSectionName) {
            const items = parseListItems(m[2]);
            // Section names repeat verbatim every week (a closed, slow-changing set) --
            // slugified here so screen.js can look up each section's font/color theme (see
            // sectionThemes.js) by a stable key without re-deriving it.
            if (items.length) currentDay.sections.push({ name: pendingSectionName, slug: slugify(pendingSectionName), items });
            pendingSectionName = null;
        }
    }
    return days;
}

// Fetches and fully parses the current schedule post. Throws on any failure
// (network, missing entry, unparseable date range, zero days/sections parsed)
// -- the caller (data.js) catches this and falls back to the Now/Next-only
// view built from live changeMedia data.
export async function fetchTonightsSchedule() {
    // Dynamic import: native.js touches `window` at module scope (registering the native
    // callback bridge), which doesn't exist under plain `node --test` -- deferring the import
    // to here (only reached when actually fetching) keeps the pure parser functions above
    // testable in Node without a DOM, same pattern the archived Letterboxd version used.
    const { nativeHttpGet } = await import('../native.js');
    const res = await nativeHttpGet(FEED_URL, BROWSER_HEADERS);
    if (!res || res.status !== 200) throw new Error('Reddit feed HTTP ' + (res && res.status));
    const entries = parseEntries(res.body);
    if (!entries.length) throw new Error('no entries found in feed');
    const entry = selectCurrentEntry(entries);
    if (!entry) throw new Error('no schedule post found in feed');
    const dateRange = parseDateRange(entry.title, entry.publishedAt);
    if (!dateRange) throw new Error('could not parse weekend date range from title: ' + entry.title);
    const days = parseSchedule(entry.contentHtml);
    if (!days.length) throw new Error('no days parsed from schedule post');
    const dateByDay = { Friday: dateRange.fri, Saturday: dateRange.sat, Sunday: dateRange.sun };
    return {
        postId: entry.postId,
        title: entry.title,
        publishedAt: entry.publishedAt,
        days: days.map(d => ({ ...d, date: dateByDay[d.day] || null })),
    };
}
