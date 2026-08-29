import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeKey, parseCsvLine, buildLastAiredMap, getLastAired } from '../src/metadata/lastaired.js';

test('normalizeKey trims/lowercases/collapses whitespace and appends year', () => {
    assert.strictEqual(normalizeKey('  The   Thing ', '1982'), 'the thing (1982)');
    assert.strictEqual(normalizeKey('The Thing', ''), 'the thing');
    assert.strictEqual(normalizeKey('', '1982'), ' (1982)');
});

test('parseCsvLine handles a plain unquoted row', () => {
    assert.deepStrictEqual(parseCsvLine('The Thing (1982),1/30/26,Horror'), ['The Thing (1982)', '1/30/26', 'Horror']);
});

test('parseCsvLine handles a quoted field containing a comma', () => {
    assert.deepStrictEqual(
        parseCsvLine('"Silent Night, Deadly Night" (1984),12/1/25,Slasher'),
        ['Silent Night, Deadly Night (1984)', '12/1/25', 'Slasher']
    );
});

test('parseCsvLine unescapes doubled quotes inside a quoted field', () => {
    assert.deepStrictEqual(parseCsvLine('"He said ""hi"""'), ['He said "hi"']);
});

const HEADER = 'Title,Last Played,Movie Block\n';

test('buildLastAiredMap indexes a simple title+year row', () => {
    const map = buildLastAiredMap(HEADER + 'The Thing (1982),1/30/26,Horror Block\n');
    const entry = map.get(normalizeKey('The Thing', '1982'));
    assert.ok(entry);
    assert.strictEqual(entry.block, 'Horror Block');
    assert.strictEqual(entry.dateStr, 'Jan 30, 2026');
});

test('buildLastAiredMap keeps the chronologically latest of duplicate rows', () => {
    const csv = HEADER +
        'The Thing (1982),1/1/24,Horror Block\n' +
        'The Thing (1982),1/30/26,Horror Block\n';
    const map = buildLastAiredMap(csv);
    const entry = map.get(normalizeKey('The Thing', '1982'));
    assert.strictEqual(entry.dateStr, 'Jan 30, 2026');
});

test('buildLastAiredMap indexes both halves of an "aka" title as fallback aliases', () => {
    const csv = HEADER + 'After Death aka Zombie Flesh Eaters 3 (1989),3/4/25,Zombie Block\n';
    const map = buildLastAiredMap(csv);
    assert.ok(map.get(normalizeKey('After Death', '1989')));
    assert.ok(map.get(normalizeKey('Zombie Flesh Eaters 3', '1989')));
});

test('buildLastAiredMap skips rows with an unparseable date or empty title', () => {
    const csv = HEADER +
        'Bad Date Movie (2020),not-a-date,Block\n' +
        ',1/1/25,Block\n' +
        'Good Movie (2020),6/15/25,Block\n';
    const map = buildLastAiredMap(csv);
    assert.strictEqual(map.size, 1);
    assert.ok(map.get(normalizeKey('Good Movie', '2020')));
});

test('buildLastAiredMap returns an empty map for garbage input (e.g. an HTML error page)', () => {
    const map = buildLastAiredMap('<!DOCTYPE html><html>not a csv</html>');
    assert.strictEqual(map.size, 0);
});

test('getLastAired returns null before any sheet has loaded', () => {
    assert.strictEqual(getLastAired('The Thing', '1982'), null);
});
