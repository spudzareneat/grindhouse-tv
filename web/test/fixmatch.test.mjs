import { test } from 'node:test';
import assert from 'node:assert';

function stubLocalStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
    return store;
}
stubLocalStorage();

const O = await import('../src/metadata/overrides.js');
const { normalizeImdbCandidates } = await import('../src/metadata/imdb.js');
const { normalizeTmdbCandidates } = await import('../src/metadata/tmdb.js');

test('override round-trip is keyed by the exact raw title', () => {
    localStorage.clear();
    const raw = 'Night.of.the.Creeps.1986.1080p.BluRay.mkv';
    assert.strictEqual(O.getMovieOverride(raw), null);
    O.setMovieOverride(raw, { imdbId: 'tt0091630', tmdbId: 15239, tmdbType: 'movie' });
    const e = O.getMovieOverride(raw);
    assert.strictEqual(e.imdbId, 'tt0091630');
    assert.strictEqual(e.tmdbId, 15239);
    assert.strictEqual(e.tmdbType, 'movie');
    assert.strictEqual(O.getMovieOverride(raw + ' '), null);
    O.clearMovieOverride(raw);
    assert.strictEqual(O.getMovieOverride(raw), null);
});

test('override without an imdbId is never stored', () => {
    localStorage.clear();
    O.setMovieOverride('x', { tmdbId: 1, tmdbType: 'movie' });
    assert.strictEqual(O.getMovieOverride('x'), null);
});

test('corrupt override storage reads as empty', () => {
    localStorage.setItem(O.LS_MOVIE_OVERRIDE, '{not json');
    assert.strictEqual(O.getMovieOverride('x'), null);
    O.setMovieOverride('x', { imdbId: 'tt1234567' });
    assert.strictEqual(O.getMovieOverride('x').imdbId, 'tt1234567');
});

test('detectTconst finds ids in links and bare text', () => {
    assert.strictEqual(O.detectTconst('https://www.imdb.com/title/tt0091630/?ref_=x'), 'tt0091630');
    assert.strictEqual(O.detectTconst(' tt12345678 '), 'tt12345678');
    assert.strictEqual(O.detectTconst('Night of the Creeps'), null);
    assert.strictEqual(O.detectTconst('tt123'), null);
});

test('IMDb candidates drop podcasts and incomplete rows, cap at limit', () => {
    const ent = (id, text, type = 'movie', extra = {}) => ({ id, titleText: { text }, titleType: { id: type, text: type === 'movie' ? 'Movie' : type }, ...extra });
    const rows = normalizeImdbCandidates([
        ent('tt1', 'A', 'movie', { releaseYear: { year: 1986 }, ratingsSummary: { voteCount: 42 } }),
        ent('tt2', 'Pod', 'podcastEpisode'),
        null,
        { id: 'tt3' },
        ent('tt4', 'B', 'tvSeries'),
        ent('tt5', 'C'),
    ], 2);
    assert.deepStrictEqual(rows.map(r => r.imdbId), ['tt1', 'tt4']);
    assert.strictEqual(rows[0].year, 1986);
    assert.strictEqual(rows[0].votes, 42);
    assert.strictEqual(rows[0].source, 'imdb');
});

test('TMDB candidates keep movies + tv only, map names/years/posters', () => {
    const rows = normalizeTmdbCandidates([
        { id: 1, media_type: 'movie', title: 'Night of the Creeps', release_date: '1986-08-22', vote_count: 500, poster_path: '/p.jpg' },
        { id: 2, media_type: 'person', name: 'Fred Dekker' },
        { id: 3, media_type: 'tv', name: 'Creepshow', first_air_date: '2019-09-26' },
        { id: 4, media_type: 'movie', title: '' },
    ]);
    assert.deepStrictEqual(rows.map(r => r.tmdbId), [1, 3]);
    assert.strictEqual(rows[0].year, '1986');
    assert.strictEqual(rows[0].type, 'Movie');
    assert.strictEqual(rows[0].poster, 'https://image.tmdb.org/t/p/w92/p.jpg');
    assert.strictEqual(rows[1].title, 'Creepshow');
    assert.strictEqual(rows[1].tmdbType, 'tv');
    assert.strictEqual(rows[1].poster, null);
});
