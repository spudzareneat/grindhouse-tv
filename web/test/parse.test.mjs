import { test } from 'node:test';
import assert from 'node:assert';
import { parseMovieFilename } from '../src/parse.js';

test('scene-style filename with bracketed year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('White.Fire.[1984].mkv'),
        { title: 'White Fire', year: '1984' }
    );
});

test('no bracketed year, bare year stays in title', () => {
    assert.deepStrictEqual(
        parseMovieFilename('The.Patriot.2000.1080p.mp4'),
        { title: 'The Patriot 2000 1080p', year: null }
    );
});

test('plain filename, no dots or year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Uncle Sam'),
        { title: 'Uncle Sam', year: null }
    );
});

test('scene tags without brackets around year', () => {
    assert.deepStrictEqual(
        parseMovieFilename('Some.Movie.2019.REMASTERED.x264-GRP.avi'),
        { title: 'Some Movie 2019 REMASTERED x264-GRP', year: null }
    );
});
