import { test } from 'node:test';
import assert from 'node:assert';
import { findCurrentWeekListUrl, parseListTitles } from '../src/lineup/letterboxd.js';

const LISTS_PAGE_FIXTURE = `
<div class="list-set">
  <a href="/420grindhouse/list/general-favorites/">General Favorites</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/">This week's schedule</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/likes/">Likes</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/edit/">Edit</a>
  <a href="/420grindhouse/list/weekend-grindhouse-schedule-fri-6-26-sun/">Last week's schedule</a>
</div>`;

test('findCurrentWeekListUrl picks the first grindhouse-schedule link (lists are newest-first)', () => {
    assert.strictEqual(
        findCurrentWeekListUrl(LISTS_PAGE_FIXTURE),
        'https://letterboxd.com/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/'
    );
});
test('findCurrentWeekListUrl returns null when no schedule link is present', () => {
    assert.strictEqual(findCurrentWeekListUrl('<a href="/420grindhouse/list/other/">Other</a>'), null);
});

// Real snippet shape captured from a live list page (2026-07-05) — each poster carries its
// full title+year here, unlike the meta description (which only samples ~5 of the list).
const LIST_PAGE_FIXTURE = `<html><body><ul class="poster-list">
<li><div class="film-poster" data-image-width="125" data-image-height="187" data-item-name="American Hunter (1988)" data-item-slug="american-hunter" data-item-link="/film/american-hunter/"></div></li>
<li><div class="film-poster" data-item-name="America&#039;s Deadliest Home Video (1993)" data-item-slug="americas-deadliest-home-video"></div></li>
<li><div class="film-poster" data-item-name="American Cyborg: Steel Warrior (1993)" data-item-slug="american-cyborg-steel-warrior"></div></li>
</ul></body></html>`;

test('parseListTitles extracts every "Title (Year)" from each poster\'s data-item-name', () => {
    assert.deepStrictEqual(parseListTitles(LIST_PAGE_FIXTURE), [
        { title: 'American Hunter', year: '1988' },
        { title: 'America\'s Deadliest Home Video', year: '1993' },
        { title: 'American Cyborg: Steel Warrior', year: '1993' },
    ]);
});
test('parseListTitles returns an empty array when there are no posters', () => {
    assert.deepStrictEqual(parseListTitles('<html><body></body></html>'), []);
});
