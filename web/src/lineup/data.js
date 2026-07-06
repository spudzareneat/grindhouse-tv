// The one interface lineup/screen.js consumes. Stage 0: a hardcoded fixture covering every
// visual state (now playing / exact / approx / late precision) so the screen's on-TV feel can
// be device-tested before any network code exists. Stage 1 replaces this implementation with
// the real Letterboxd + timing pipeline — screen.js does not change.
export async function getTonightsLineup() {
    return {
        items: [
            {
                cleanTitle: 'The Beyond', cleanYear: '1981', isNowPlaying: true, etaLabel: '',
                poster: null, backdrop: null,
                overview: 'A woman inherits a Louisiana hotel built over one of the seven gateways to Hell.',
            },
            {
                cleanTitle: 'American Hunter', cleanYear: '1988', isNowPlaying: false, etaLabel: '≈ 9:20 PM',
                poster: null, backdrop: null,
                overview: 'A grizzled ex-mercenary is hired to track a killer through the wilderness.',
            },
            {
                cleanTitle: 'Zombie Holocaust', cleanYear: '1980', isNowPlaying: false, etaLabel: '~ 11:00 PM',
                poster: null, backdrop: null,
                overview: 'A series of grisly murders at a New York hospital leads to a remote island of cannibals.',
            },
            {
                cleanTitle: 'Nightbeast', cleanYear: '1982', isNowPlaying: false, etaLabel: 'LATE',
                poster: null, backdrop: null,
                overview: 'An alien crash-lands and terrorizes a small town.',
            },
            {
                cleanTitle: 'Sole Survivor', cleanYear: '1984', isNowPlaying: false, etaLabel: 'LATE',
                poster: null, backdrop: null,
                overview: 'A plane crash survivor is stalked by the shadowy figures of everyone who was meant to die with her.',
            },
        ],
    };
}
