import { test } from 'node:test';
import assert from 'node:assert';
import { parseMovieFilename, parseYouTubeTitle } from '../src/parse.js';

test('scene-style filename with bracketed year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('White.Fire.[1984].mkv'),
        { title: 'White Fire', year: '1984', season: null, episode: null, isEpisode: false }
    );
});

test('no bracketed year, bare year stays in title', () => {
    assert.deepStrictEqual(
        parseMovieFilename('The.Patriot.2000.1080p.mp4'),
        { title: 'The Patriot 2000 1080p', year: null, season: null, episode: null, isEpisode: false }
    );
});

test('plain filename, no dots or year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Uncle Sam'),
        { title: 'Uncle Sam', year: null, season: null, episode: null, isEpisode: false }
    );
});

test('scene tags without brackets around year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Some.Movie.2019.REMASTERED.x264-GRP.avi'),
        { title: 'Some Movie 2019 REMASTERED x264-GRP', year: null, season: null, episode: null, isEpisode: false }
    );
});

test('S02E02 marker: series name kept, episode subtitle dropped', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Twin Peaks S02E02 Coma.mp4'),
        { title: 'Twin Peaks', year: null, season: 2, episode: 2, isEpisode: true }
    );
});

test('year bracket BEFORE the episode marker still captures both', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Show Name (1984) S01E05.mkv'),
        { title: 'Show Name', year: '1984', season: 1, episode: 5, isEpisode: true }
    );
});

test('NxNN marker', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Batman 1x22.avi'),
        { title: 'Batman', year: null, season: 1, episode: 22, isEpisode: true }
    );
});

test('"Season N Episode NN" spelled out', () => {
    assert.deepStrictEqual(
        parseMovieFilename('The Simpsons Season 1 Episode 13.mp4'),
        { title: 'The Simpsons', year: null, season: 1, episode: 13, isEpisode: true }
    );
});

test('bare "Ep. N" marker: episode set, season null', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Cool Show Ep. 5.mp4'),
        { title: 'Cool Show', year: null, season: null, episode: 5, isEpisode: true }
    );
});

test('acronym title survives the dot cleanup alongside an episode marker', () => {
    assert.deepStrictEqual(
        parseMovieFilename('S.W.A.T. Season 1 Episode 1.mkv'),
        { title: 'S.W.A.T.', year: null, season: 1, episode: 1, isEpisode: true }
    );
});

test('YouTube title with an episode marker keeps the series name (first segment)', () => {
    assert.deepStrictEqual(
        parseYouTubeTitle('The Tomorrow People S01E01 The Slaves of Jedikiah'),
        { title: 'The Tomorrow People', year: null, season: 1, episode: 1, isEpisode: true }
    );
});

test('YouTube movie title without a marker is not an episode', () => {
    assert.deepStrictEqual(
        parseYouTubeTitle('Sole Survivor 1984 HD (Full Movie) | Free Action Thriller'),
        { title: 'Sole Survivor', year: '1984', season: null, episode: null, isEpisode: false }
    );
});
