/* ==========================================================
   TONIGHT'S LINEUP — Letterboxd schedule fetch.
   letterboxd.com/420grindhouse/lists/ is reachable with a browser UA and no
   login (generic bots get 403 — the native HTTP bridge already sends one for
   IMDb the same way). Lists are newest-first; every weekly slug contains
   'grindhouse-schedule', so the first match is "this week". Each poster on the
   list page carries the full "Title (Year)" as a data-item-name attribute —
   the <meta name="description"> was tried first but only samples ~5 of the
   list's films, not the full schedule (confirmed against the live site).
========================================================== */
const LISTS_URL = 'https://letterboxd.com/420grindhouse/lists/';
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// Lists render newest-first, so the first href containing 'grindhouse-schedule'
// is the current week's list. Returns the absolute URL, or null if none is found.
export function findCurrentWeekListUrl(listsPageHtml) {
    const m = listsPageHtml.match(/href="(\/420grindhouse\/list\/[^"]*grindhouse-schedule[^"]*\/)"/i);
    return m ? 'https://letterboxd.com' + m[1] : null;
}

function decodeHtmlEntities(s) {
    return s
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// The list page's <meta property="og:title"> carries the list's own clean title, no
// site-suffix to strip (unlike the <title> tag, which appends a Letterboxd suffix).
export function parseListTitle(listPageHtml) {
    const m = listPageHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
    return m ? decodeHtmlEntities(m[1]).trim() : null;
}

// The list page's "Published <time datetime="...">" gives the list's own creation timestamp --
// used (Task 9k) to tell a genuinely current list apart from a stale one left from a prior week.
export function parseListPublishedDate(listPageHtml) {
    const m = listPageHtml.match(/<span class="published">[^<]*<time datetime="([^"]*)"/i);
    return m ? m[1] : null;
}

// Every poster on the list page carries data-item-name="Title (Year)", in schedule order —
// this is the complete, ordered list (unlike the meta description's ~5-title sample).
export function parseListTitles(listPageHtml) {
    const re = /data-item-name="([^"]*)"/g;
    const items = [];
    let m;
    while ((m = re.exec(listPageHtml))) {
        const decoded = decodeHtmlEntities(m[1]);
        const ym = decoded.match(/^(.*)\s\((\d{4})\)$/);
        if (ym) items.push({ title: ym[1].trim(), year: ym[2] });
    }
    return items;
}

// Fetches and parses tonight's schedule. Throws on any failure (network, no
// current-week link found, no titles parsed) — the caller (data.js) catches
// this and falls back to the Now/Next-only view.
export async function fetchTonightsSchedule() {
    const { nativeHttpGet } = await import('../native.js');
    const listsRes = await nativeHttpGet(LISTS_URL, BROWSER_HEADERS);
    if (!listsRes || listsRes.status !== 200) throw new Error('Letterboxd lists HTTP ' + (listsRes && listsRes.status));
    const listUrl = findCurrentWeekListUrl(listsRes.body);
    if (!listUrl) throw new Error('no current-week schedule list found');
    const listRes = await nativeHttpGet(listUrl, BROWSER_HEADERS);
    if (!listRes || listRes.status !== 200) throw new Error('Letterboxd list HTTP ' + (listRes && listRes.status));
    const items = parseListTitles(listRes.body);
    if (!items.length) throw new Error('no titles parsed from schedule list');
    return {
        listTitle: parseListTitle(listRes.body),
        publishedAt: parseListPublishedDate(listRes.body),
        items,
    };
}
