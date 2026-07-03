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
