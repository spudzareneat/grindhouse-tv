/* ==========================================================
   MOTD POSTER IMAGES -- the admin-curated "Coming Attractions" art from
   #motdrow. Shared by the small poster strip (posters.js) and the
   Tonight's Lineup fallback (lineup/data.js) when Letterboxd isn't
   usable, so there's still real curated art to look at either way.
========================================================== */
export function getMotdPosterImages() {
    const motd = document.getElementById('motdrow');
    if (!motd) return [];
    return [...motd.querySelectorAll('img')].filter((img) => {
        // Poster images in the MOTD are 125x175 — keep portrait-ish images, skip wide banners.
        const w = parseInt(img.getAttribute('width') || '0', 10);
        const h = parseInt(img.getAttribute('height') || '0', 10);
        return h >= 100 && w <= 200;
    });
}
