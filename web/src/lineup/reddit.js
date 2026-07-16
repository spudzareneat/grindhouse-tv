/* ==========================================================
   TONIGHT'S LINEUP -- Reddit schedule fetch.
   r/420Grindhouse's Atom feed (https://www.reddit.com/r/420Grindhouse/.rss) is
   reachable with a browser UA and no login (the .json endpoints 403 the same
   way generic bots get blocked elsewhere in this app; .rss doesn't). The
   pinned schedule post sorts FIRST in the feed regardless of nominal sort
   order (confirmed live) -- "find this week's post" is just "take entry #1",
   no slug/title matching needed the way Letterboxd's version required.

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

// The first <entry> in the feed is the pinned post (verified live). Returns
// null if the feed has no entries or is missing a required field.
export function parseFirstEntry(feedXml) {
    const start = feedXml.indexOf('<entry>');
    if (start === -1) return null;
    const end = feedXml.indexOf('</entry>', start);
    if (end === -1) return null;
    const entry = feedXml.slice(start, end + '</entry>'.length);
    const idM = entry.match(/<id>([^<]+)<\/id>/);
    const titleM = entry.match(/<title>([^<]+)<\/title>/);
    const contentM = entry.match(/<content type="html">([\s\S]*?)<\/content>/);
    if (!idM || !titleM || !contentM) return null;
    const pubM = entry.match(/<published>([^<]+)<\/published>/);
    return {
        postId: idM[1],
        title: decodeHtmlEntities(titleM[1]),
        publishedAt: pubM ? pubM[1] : null,
        contentHtml: decodeHtmlEntities(contentM[1]),
    };
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
        const [primary, ...akaParts] = display.split(/\s+aka\s+/i);
        const ym = primary.trim().match(/^(.*)\s\((\d{4})\)$/);
        if (!ym) continue;
        const akas = akaParts
            .map(a => a.replace(/\s*\(\d{4}\)\s*$/, '').trim())
            .filter(Boolean);
        items.push({ title: ym[1].trim(), year: ym[2], display, akas });
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
            if (DAY_NAMES.includes(text)) {
                currentDay = { day: text, sections: [] };
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
    const entry = parseFirstEntry(res.body);
    if (!entry) throw new Error('no entries found in feed');
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
