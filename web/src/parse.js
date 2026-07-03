/* ==========================================================
   MOVIE TITLE CLEANING
   Handles filenames like: White.Fire.[1984].mkv
   → returns { title: "White Fire", year: "1984" }
========================================================== */

export function parseMovieFilename(raw) {
    // Remove file extension
    let s = raw.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|divx|xvid|ogv)$/i, '');

    // Extract year from brackets or parens: [1984] or (1984)
    let year = null;
    const yearMatch = s.match(/[\[(](\d{4})[\])]/);
    if (yearMatch) {
        year = yearMatch[1];
        s = s.slice(0, yearMatch.index); // strip everything from year onwards
    }

    // Replace dots and underscores with spaces
    s = s.replace(/[._]+/g, ' ');

    // Strip leftover brackets and their contents (tags like [BluRay], [720p])
    s = s.replace(/[\[(][^\])]*/g, '').replace(/[\])]/, '');

    // Trim and collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();

    return { title: s, year };
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
    // Strip noise + genre words (whole-word, case-insensitive)
    [...YT_NOISE, ...YT_GENRES].forEach(n => {
        s = s.replace(new RegExp('\\b' + n + '\\b', 'gi'), ' ');
    });
    // Remove emoji / decorative symbols and stray punctuation runs
    s = s.replace(/[^\w\s&':!.,-]/g, ' ');

    // Split on spaced separators ( | – — - : • ) and keep the wordiest segment
    const segs = s.split(/\s[|–—•:_-]+\s/)
        .map(x => x.replace(/\s+/g, ' ').trim())
        .filter(x => x.length >= 2);
    let title = segs.sort((a, b) =>
        (b.match(/[a-z]/gi) || []).length - (a.match(/[a-z]/gi) || []).length
    )[0] || s;

    // Final tidy: trim trailing junk punctuation
    title = title.replace(/\s+/g, ' ').replace(/^[\s'":.,-]+|[\s'":.,-]+$/g, '').trim();
    return { title, year };
}
