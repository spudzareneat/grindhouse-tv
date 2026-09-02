/* ==========================================================
   MOVIE TITLE CLEANING
   Handles filenames like: White.Fire.[1984].mkv
   → returns { title: "White Fire", year: "1984" }

   Ported from the sibling PC userscript's core/01-movie-identity.js
   (season/episode support added there in "Add season/episode title
   parsing and YouTube oEmbed fallback" + the year-first follow-up fix).
========================================================== */

// Ordered season/episode detectors. Order matters -- more specific/anchored
// patterns are tried first so e.g. "S01E10" can't get partially re-matched
// by the looser bare-episode pattern below it. `season: null` means the
// pattern has no season group at all.
const EPISODE_PATTERNS = [
    { re: /\bS(\d{1,2})[\s._-]?E(\d{1,3})\b/i, season: 1, episode: 2 },                              // S01E10
    { re: /\bSeason[\s._-]?(\d{1,2})[\s._-]+Episode[\s._-]?(\d{1,3})\b/i, season: 1, episode: 2 },    // Season 1 Episode 20
    { re: /\bEpisode[\s._-]?(\d{1,3})[\s._-]+Season[\s._-]?(\d{1,2})\b/i, season: 2, episode: 1 },    // Episode 20 Season 1
    { re: /\b(\d{1,2})x(\d{1,3})\b/i, season: 1, episode: 2 },                                        // 1x22
    { re: /\bEp(?:isode)?\.?[\s._-]?(\d{1,3})\b/i, season: null, episode: 1 },                        // Ep. 5 / Episode 5 (no season)
];

// Runs EPISODE_PATTERNS in order; returns { match, season, episode } for the
// first hit, or null. season/episode are numbers (or season: null), never strings.
function _matchEpisode(s) {
    for (const p of EPISODE_PATTERNS) {
        const m = s.match(p.re);
        if (m) {
            return {
                match: m,
                season: p.season !== null ? parseInt(m[p.season], 10) : null,
                episode: parseInt(m[p.episode], 10),
            };
        }
    }
    return null;
}

// e.g. (1, 10) -> "S01E10"; (null, 5) -> "E05" (the bare "Ep. 5" pattern has no
// season group); (null, null) -> '' for movies (isEpisode false).
export function episodeTag(season, episode) {
    if (episode == null) return '';
    const ep = String(episode).padStart(2, '0');
    return season != null ? `S${String(season).padStart(2, '0')}E${ep}` : `E${ep}`;
}

export function parseMovieFilename(raw) {
    // Remove file extension
    let s = raw.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|divx|xvid|ogv)$/i, '');

    // Locate the year and the season/episode marker (S01E10, Season 1
    // Episode 20, 1x22, Ep. 5, etc.) against the same untouched string
    // before cutting anything. Checking one and slicing before checking
    // the other would silently discard whichever marker comes second --
    // e.g. "Show Name (1984) S01E05" has the episode marker AFTER the
    // year bracket, so cutting at the year first (as this used to)
    // threw the episode marker away before it was ever searched for,
    // leaving season/episode null even though the marker was right
    // there in the original string.
    let year = null;
    const yearMatch = s.match(/[\[(](\d{4})[\])]/);
    if (yearMatch) year = yearMatch[1];

    let season = null, episode = null;
    const epMatch = _matchEpisode(s);
    if (epMatch) {
        season = epMatch.season;
        episode = epMatch.episode;
    }

    // Cut the title at whichever marker starts first -- keeps the
    // series-name prefix, discards the episode-specific subtitle
    // scene/upload filenames often append after the marker.
    const cutIndex = Math.min(
        yearMatch ? yearMatch.index : Infinity,
        epMatch ? epMatch.match.index : Infinity
    );
    if (cutIndex !== Infinity) s = s.slice(0, cutIndex);

    // Acronym-style titles (R.O.T.O.R., S.W.A.T.) use dots as part of the actual
    // name, not as filename word-separators -- protect runs of 2+ single-letter-dot
    // groups from the dot/underscore-to-space cleanup below, which is tuned for
    // scene-release filenames like White.Fire.mkv, not acronyms. Confirmed live:
    // without this, "R.O.T.O.R." came out as "R O T O R".
    const acronyms = [];
    s = s.replace(/\b(?:[A-Za-z]\.){2,}/g, (m) => {
        acronyms.push(m);
        return ` @@${acronyms.length - 1}@@ `;
    });

    // Replace dots and underscores with spaces
    s = s.replace(/[._]+/g, ' ');

    // Strip leftover brackets and their contents (tags like [BluRay], [720p])
    s = s.replace(/[\[(][^\])]*/g, '').replace(/[\])]/, '');

    // Restore protected acronyms
    s = s.replace(/@@(\d+)@@/g, (_, i) => acronyms[i]);

    // Trim and collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();

    return { title: s, year, season, episode, isEpisode: episode !== null };
}

// Aggressively clean a messy YouTube "full movie" title into a TMDB query.
// e.g. "Sole Survivor 1984 HD (Full Movie) | Free Action Thriller" → {title:'Sole Survivor', year:'1984'}
const YT_NOISE = [
    'full movie', 'full length movie', 'full length feature', 'full length film', 'full length',
    'complete movie', 'complete film', 'the complete movie', 'entire movie',
    'free movie', 'free film', 'free online', 'free to watch', 'watch online', 'watch free',
    'watch now', 'online free', 'free with ads', 'with ads', 'no ads', 'ad free',
    'official movie', 'official film', 'official', 'exclusive', 'premiere', 'world premiere',
    'remastered', 'restored', 'colou?ri[sz]ed', 'subtitle[sd]?', 'subbed', 'dubbed', 'eng sub',
    'hd', 'fhd', 'uhd', '4k', '2k', '1080p', '720p', '480p', 'high definition',
    'blu-?ray', 'dvd', 'web-?dl', 'uncut', 'extended', 'director.?s cut', 'special edition',
    'classic movie', 'classic film', 'cult classic', 'b-?movie', 'feature film', 'feature',
    'cinema', 'blockbuster', 'must watch', 'in english', 'english movie',
];
const YT_GENRES = ['action', 'thriller', 'horror', 'comedy', 'drama', 'sci-?fi', 'science fiction',
    'western', 'romance', 'crime', 'mystery', 'adventure', 'fantasy', 'war', 'noir', 'slasher',
    'martial arts', 'kung fu', 'documentary', 'family', 'musical', 'animation'];

export function parseYouTubeTitle(raw) {
    let s = ' ' + raw + ' ';

    // Year: first standalone 1900–2099
    let year = null;
    const ym = s.match(/\b(19\d{2}|20\d{2})\b/);
    if (ym) year = ym[1];

    // Drop bracketed chunks entirely: (Full Movie), [HD], {1080p}
    s = s.replace(/[\[({][^\])}]*[\])}]/g, ' ');
    // Drop the year token from the title text
    if (year) s = s.replace(new RegExp('\\b' + year + '\\b', 'g'), ' ');

    // Extract season/episode and cut at the match, same convention as
    // parseMovieFilename.
    let season = null, episode = null;
    const epMatch = _matchEpisode(s);
    if (epMatch) {
        season = epMatch.season;
        episode = epMatch.episode;
        s = s.slice(0, epMatch.match.index);
    }
    const isEpisode = episode !== null;

    // Strip noise + genre words (whole-word, case-insensitive)
    [...YT_NOISE, ...YT_GENRES].forEach(n => {
        s = s.replace(new RegExp('\\b' + n + '\\b', 'gi'), ' ');
    });
    // Preserve the segment-separator characters the split below relies on
    // (|–—•) -- stripping them here first, before they can be used as
    // delimiters, silently merged every pipe/em-dash/bullet-separated
    // title into one blob (only plain "-" survived, since it's in this
    // allowed set already, which is why dash-separated titles "worked"
    // while pipe-separated ones never actually split).
    s = s.replace(/[^\w\s&':!.,|–—•-]/g, ' ');

    // Split on spaced separators ( | – — - : • ) and keep the wordiest segment
    const segs = s.split(/\s[|–—•:_-]+\s/)
        .map(x => x.replace(/\s+/g, ' ').trim())
        .filter(x => x.length >= 2);
    // When an episode marker was found, the channel's series-name-first
    // convention means the correct segment is the FIRST one, not the
    // longest-alpha one -- an episode subtitle (e.g. "The Rameses
    // Connection") routinely has more alpha characters than the actual
    // series name (e.g. "The Tomorrow People") that precedes it, so the
    // longest-wins heuristic below would silently pick the wrong segment
    // for every episodic title.
    let title = isEpisode
        ? (segs[0] || s)
        : (segs.sort((a, b) =>
            (b.match(/[a-z]/gi) || []).length - (a.match(/[a-z]/gi) || []).length
          )[0] || s);

    // Final tidy: trim trailing junk punctuation
    title = title.replace(/\s+/g, ' ').replace(/^[\s'":.,-]+|[\s'":.,-]+$/g, '').trim();
    return { title, year, season, episode, isEpisode };
}
