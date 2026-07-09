/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Stage 0: a hardcoded fixture matching the real day/section structure of a
   captured live schedule post (r/420Grindhouse, 2026-07-10 weekend), so the
   day-tabs + section-grouped screen and its D-pad nav can be device-tested
   before any Reddit fetch/parse code exists. Stage 1 replaces this file's
   internals with the real pipeline (reddit.js fetch + TMDB match + the
   day-anchored timing model in timing.js) -- screen.js does not change.
========================================================== */

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Minimal per-item shape screen.js/showNowPlayingCard consume. Stage 1's real
// buildBase() (ported from the archived Letterboxd version) adds
// rating/genres/parentalGuide/killCount/imdbId on top of this same base set.
function item(cleanTitle, cleanYear, opts = {}) {
    return {
        cleanTitle, cleanYear,
        poster: null, backdrop: null, overview: opts.overview || '', runtime: opts.runtime ?? null,
        isNowPlaying: !!opts.isNowPlaying, etaLabel: opts.etaLabel || '',
        clickable: opts.clickable !== false,
    };
}

function section(name, items) {
    return { name, slug: slugify(name), items };
}

const FIXTURE_DAYS = [
    {
        day: 'Friday', date: '2026-07-10', isToday: true,
        sections: [
            section('Funky Cheese Friday', [
                item('The Legend of Gator Face', '1996'),
                item('White Ghost', '1988'),
                item('Frankenstein Island', '1981', {
                    isNowPlaying: true,
                    overview: 'Four female astronauts crash-land on an island run by a mad scientist and his sister, the reincarnation of a 400-year-old witch.',
                }),
            ]),
            section('Friday Grindhouse-A-Go-Go', [
                item('Gator Bait', '1978', { etaLabel: '≈ 9:20 PM' }),
                item('Swamp Thing', '1982', { etaLabel: '~ 11:00 PM' }),
                item('Swamphead', '2011'),
            ]),
            section('Friday Night Freak Show', [
                item('Popeye the Slayer Man', '2025'),
                item('The Chosen One: Legend of the Raven', '1998'),
                item('Treasure of the Living Dead', '1982'),
            ]),
        ],
    },
    {
        day: 'Saturday', date: '2026-07-11', isToday: false,
        sections: [
            section('Psychedelic Saturday', [
                item('Thunder of Gigantic Serpent', '1988'),
                item('Unmasking the Idol', '1986'),
                item('Computer Beach Party', '1987'),
            ]),
            section('Saturday Prime Time Drive-In', [
                item('Killing American Style', '1988'),
                item('Sleepover Slaughter', '2026'),
                item('Criminally Insane', '1975'),
                item('Black Demons', '1991'),
            ]),
            section('Red Light Saturday Night', [
                item('Angel of Destruction', '1994'),
                item('Bikini Bloodbath', '2006'),
                item('Dead Sexy', '2001'),
            ]),
        ],
    },
    {
        day: 'Sunday', date: '2026-07-12', isToday: false,
        sections: [
            section('The Sunday Classics', [
                item('Kill Them All and Come Back Alone', '1968'),
                item('Sting of Death', '1966'),
                item('The Last Shark', '1981'),
            ]),
            section('Sunday Slop-O-Rama', [
                item('Repo! The Genetic Opera', '2008'),
                item('I Saw What You Did', '1988'),
                item('The Doorway', '2000'),
            ]),
            section('Last Call Sunday Night', [
                item('Night Children', '1989'),
                item('DNA', '1996'),
                item('A Day of Judgment', '1981'),
            ]),
        ],
    },
];

export async function getTonightsLineup() {
    return {
        listTitle: 'Weekend Grindhouse Schedule — Fri 7/10 – Sun 7/12',
        fallback: false,
        days: FIXTURE_DAYS,
    };
}
