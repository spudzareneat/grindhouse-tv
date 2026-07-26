import { test } from 'node:test';
import assert from 'node:assert';
import { parseFirstEntry, parseDateRange, parseSchedule, itemMatchesTitle, selectCurrentEntry } from '../src/lineup/reddit.js';

// A real captured feed fragment (r/420Grindhouse/.rss, 2026-07-09) -- one full <entry>
// wrapped in a minimal <feed> with a second, unrelated entry after it, so parseFirstEntry's
// "take entry #1, ignore the rest" behavior is exercised against something that looks like
// the real feed shape, not just an isolated fragment.
const FEED_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><author><name>/u/ksabas80</name></author><content type="html">&lt;!-- SC_OFF --&gt;&lt;div class=&quot;md&quot;&gt;&lt;p&gt;&lt;strong&gt;Playing this weekend @&lt;/strong&gt; &lt;a href=&quot;https://cytu.be/r/420Grindhouse&quot;&gt;420Grindhouse&lt;/a&gt;.&lt;/p&gt; &lt;p&gt;&lt;em&gt;Showtime starts each day at about Noon PST. If you have any issues getting cytube to work - check the&lt;/em&gt; &lt;a href=&quot;https://old.reddit.com/x&quot;&gt;FAQ&lt;/a&gt;.&lt;/p&gt; &lt;p&gt;&lt;strong&gt;Friday&lt;/strong&gt;&lt;/p&gt; &lt;p&gt;&lt;strong&gt;Funky Cheese Friday&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;The Legend of Gator Face (1996)&lt;/li&gt; &lt;li&gt;White Ghost (1988)&lt;/li&gt; &lt;li&gt;Frankenstein Island (1981)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Friday Grindhouse-A-Go-Go&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Gator Bait (1978)&lt;/li&gt; &lt;li&gt;Swamp Thing (1982)&lt;/li&gt; &lt;li&gt;Swamphead (2011)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Friday Night Freak Show&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Popeye the Slayer Man (2025)&lt;/li&gt; &lt;li&gt;The Chosen One: Legend of the Raven (1998)&lt;/li&gt; &lt;li&gt;Treasure of the Living Dead (1982)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Saturday&lt;/strong&gt;&lt;/p&gt; &lt;p&gt;&lt;strong&gt;Psychedelic Saturday&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Thunder of Gigantic Serpent (1988)&lt;/li&gt; &lt;li&gt;Unmasking the Idol (1986)&lt;/li&gt; &lt;li&gt;Computer Beach Party (1987)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Saturday Prime Time Drive-In&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Killing American Style (1988)&lt;/li&gt; &lt;li&gt;&lt;strong&gt;420 Grindhouse Premiere:&lt;/strong&gt; Sleepover Slaughter (2026)&lt;/li&gt; &lt;li&gt;Criminally Insane (1975)&lt;/li&gt; &lt;li&gt;Black Demons (1991) aka Demons 3&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Red Light Saturday Night&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Angel of Destruction (1994)&lt;/li&gt; &lt;li&gt;Bikini Bloodbath (2006)&lt;/li&gt; &lt;li&gt;Dead Sexy (2001)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Sunday&lt;/strong&gt;&lt;/p&gt; &lt;p&gt;&lt;strong&gt;The Sunday Classics&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Kill Them All and Come Back Alone (1968)&lt;/li&gt; &lt;li&gt;Sting of Death (1966)&lt;/li&gt; &lt;li&gt;The Last Shark (1981)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Sunday Slop-O-Rama&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Repo! The Genetic Opera (2008)&lt;/li&gt; &lt;li&gt;I Saw What You Did (1988)&lt;/li&gt; &lt;li&gt;The Doorway (2000)&lt;/li&gt; &lt;/ul&gt; &lt;p&gt;&lt;strong&gt;Last Call Sunday Night&lt;/strong&gt;&lt;/p&gt; &lt;ul&gt; &lt;li&gt;Night Children (1989)&lt;/li&gt; &lt;li&gt;DNA (1996)&lt;/li&gt; &lt;li&gt;A Day of Judgment (1981)&lt;/li&gt; &lt;/ul&gt; &lt;/div&gt;&lt;!-- SC_ON --&gt; &amp;#32; submitted by &amp;#32; &lt;a href=&quot;https://www.reddit.com/user/ksabas80&quot;&gt; /u/ksabas80 &lt;/a&gt;</content><id>t3_1uqmwk5</id><link href="https://www.reddit.com/r/420Grindhouse/comments/1uqmwk5/weekend_grindhouse_schedule_fri_710_sun_712/" /><updated>2026-07-08T08:43:58+00:00</updated><published>2026-07-08T08:43:58+00:00</published><title>Weekend Grindhouse Schedule - Fri 7/10 - Sun 7/12</title></entry><entry><content type="html">&lt;p&gt;unrelated later post&lt;/p&gt;</content><id>t3_1uomvhs</id><published>2026-07-06T20:00:00+00:00</published><title>4th of July 420 Grindhouse raffle results</title></entry></feed>`;

test('parseFirstEntry: extracts postId/title/publishedAt/contentHtml from entry #1, ignoring later entries', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    assert.strictEqual(entry.postId, 't3_1uqmwk5');
    assert.strictEqual(entry.title, 'Weekend Grindhouse Schedule - Fri 7/10 - Sun 7/12');
    assert.strictEqual(entry.publishedAt, '2026-07-08T08:43:58+00:00');
    assert.ok(entry.contentHtml.includes('<strong>Funky Cheese Friday</strong>'));
    assert.ok(!entry.contentHtml.includes('raffle results'));
});
test('parseFirstEntry: XML entity-escaping is fully decoded into real tags', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    assert.ok(entry.contentHtml.startsWith('<!-- SC_OFF -->'));
    assert.ok(!entry.contentHtml.includes('&lt;'));
});
test('parseFirstEntry: returns null when the feed has no entries', () => {
    assert.strictEqual(parseFirstEntry('<feed></feed>'), null);
});
test('parseFirstEntry: a double-encoded entity (markdown-escaped, then XML-escaped again) fully decodes', () => {
    // Real shape from the feed: an apostrophe comes through as &amp;#39; (Reddit's renderer
    // entity-encodes it, then the Atom feed XML-escapes that whole blob a second time).
    const feed = '<feed><entry><id>t3_x</id><title>T</title>' +
        '<content type="html">&lt;li&gt;They&amp;#39;re Coming to Get You! (1972)&lt;/li&gt;</content>' +
        '<published>2026-07-15T00:00:00+00:00</published></entry></feed>';
    const entry = parseFirstEntry(feed);
    assert.strictEqual(entry.contentHtml, "<li>They're Coming to Get You! (1972)</li>");
});

test('parseDateRange: reads Friday\'s month/day from the title, derives Sat/Sun as +1/+2 days', () => {
    assert.deepStrictEqual(
        parseDateRange('Weekend Grindhouse Schedule - Fri 7/10 - Sun 7/12', '2026-07-08T08:43:58+00:00'),
        { fri: '2026-07-10', sat: '2026-07-11', sun: '2026-07-12' }
    );
});
test('parseDateRange: a December post for a January weekend rolls the year forward', () => {
    assert.deepStrictEqual(
        parseDateRange('Weekend Grindhouse Schedule - Fri 1/2 - Sun 1/4', '2025-12-31T20:00:00+00:00'),
        { fri: '2026-01-02', sat: '2026-01-03', sun: '2026-01-04' }
    );
});
test('parseDateRange: returns null when the title has no parseable Friday date', () => {
    assert.strictEqual(parseDateRange('Some other post title', '2026-07-08T08:43:58+00:00'), null);
});
test('parseDateRange: returns null when publishedAt is missing', () => {
    assert.strictEqual(parseDateRange('Weekend Grindhouse Schedule - Fri 7/10 - Sun 7/12', null), null);
});

// Shaped like the real feed captured live 2026-07-22: an already-expired schedule post
// (last weekend, Fri 7/17-Sun 7/19) sits in entry #0, ahead of the brand-new live post
// (this weekend, Fri 7/24-Sun 7/26, published the same day) in entry #1 -- reproducing
// the exact bug where the app got stuck showing last week's lineup.
const STALE_FIRST_ENTRIES = [
    { postId: 't3_old', title: 'Weekend Grindhouse Schedule - Fri 7/17 - Sun 7/19', publishedAt: '2026-07-15T09:57:08+00:00', contentHtml: '<old>' },
    { postId: 't3_new', title: 'Weekend Grindhouse Schedule - Fri 7/24 - Sun 7/26', publishedAt: '2026-07-22T06:31:31+00:00', contentHtml: '<new>' },
];

test('selectCurrentEntry: picks the most recently published schedule post even when an older one sorts first', () => {
    const entry = selectCurrentEntry(STALE_FIRST_ENTRIES);
    assert.strictEqual(entry.postId, 't3_new');
});
test('selectCurrentEntry: a single live schedule post (the common case) is picked regardless of position', () => {
    const entries = [
        { postId: 't3_unrelated', title: '4 Days', publishedAt: '2026-07-20T22:32:40+00:00', contentHtml: '' },
        { postId: 't3_sched', title: 'Weekend Grindhouse Schedule - Fri 7/24 - Sun 7/26', publishedAt: '2026-07-22T06:31:31+00:00', contentHtml: '<sched>' },
    ];
    const entry = selectCurrentEntry(entries);
    assert.strictEqual(entry.postId, 't3_sched');
});
test('selectCurrentEntry: among two schedule-shaped candidates, the more recently published one wins regardless of which weekend is sooner', () => {
    const entries = [
        { postId: 't3_near_but_older_post', title: 'Weekend Grindhouse Schedule - Fri 7/24 - Sun 7/26', publishedAt: '2026-07-15T09:57:08+00:00', contentHtml: '' },
        { postId: 't3_far_but_newer_post', title: 'Weekend Grindhouse Schedule - Fri 7/31 - Sun 8/2', publishedAt: '2026-07-22T06:31:31+00:00', contentHtml: '' },
    ];
    const entry = selectCurrentEntry(entries);
    assert.strictEqual(entry.postId, 't3_far_but_newer_post');
});
test('selectCurrentEntry: only scans the top 5 raw feed entries -- a schedule post further down is ignored', () => {
    const filler = { postId: 't3_filler', title: 'Some other post', publishedAt: '2026-07-21T00:00:00+00:00', contentHtml: '' };
    const entries = [filler, filler, filler, filler, filler,
        { postId: 't3_too_late', title: 'Weekend Grindhouse Schedule - Fri 7/24 - Sun 7/26', publishedAt: '2026-07-22T06:31:31+00:00', contentHtml: '' }];
    assert.strictEqual(selectCurrentEntry(entries), null);
});
test('selectCurrentEntry: non-schedule entries (no parseable Fri date) are skipped entirely', () => {
    const entries = [
        { postId: 't3_raffle', title: '4th of July 420 Grindhouse raffle results', publishedAt: '2026-07-06T20:00:00+00:00', contentHtml: '' },
        { postId: 't3_sched', title: 'Weekend Grindhouse Schedule - Fri 7/24 - Sun 7/26', publishedAt: '2026-07-22T06:31:31+00:00', contentHtml: '' },
    ];
    const entry = selectCurrentEntry(entries);
    assert.strictEqual(entry.postId, 't3_sched');
});
test('selectCurrentEntry: returns null when nothing in the feed looks like a schedule post', () => {
    const entries = [{ postId: 't3_raffle', title: '4th of July 420 Grindhouse raffle results', publishedAt: '2026-07-06T20:00:00+00:00', contentHtml: '' }];
    assert.strictEqual(selectCurrentEntry(entries), null);
});

test('parseSchedule: groups sections and films under the correct day, in document order', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    const days = parseSchedule(entry.contentHtml);
    assert.deepStrictEqual(days.map(d => d.day), ['Friday', 'Saturday', 'Sunday']);
    assert.deepStrictEqual(days[0].sections.map(s => s.name),
        ['Funky Cheese Friday', 'Friday Grindhouse-A-Go-Go', 'Friday Night Freak Show']);
    assert.strictEqual(days[0].sections[0].items.length, 3);
    assert.deepStrictEqual(days[0].sections[0].items[0], { title: 'The Legend of Gator Face', year: '1996', display: 'The Legend of Gator Face (1996)', akas: [] });
});
test('parseSchedule: each section carries a slugified name for the font/color theme lookup', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    const days = parseSchedule(entry.contentHtml);
    assert.strictEqual(days[0].sections[1].slug, 'friday-grindhouse-a-go-go');
});
test('parseSchedule: strips a leading bold label from an item ("420 Grindhouse Premiere:")', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    const days = parseSchedule(entry.contentHtml);
    const drivein = days[1].sections.find(s => s.name === 'Saturday Prime Time Drive-In');
    assert.deepStrictEqual(drivein.items[1], { title: 'Sleepover Slaughter', year: '2026', display: 'Sleepover Slaughter (2026)', akas: [] });
});
test('parseSchedule: a trailing "aka Other Title" is kept as a match alias, not just display text', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    const days = parseSchedule(entry.contentHtml);
    const drivein = days[1].sections.find(s => s.name === 'Saturday Prime Time Drive-In');
    assert.deepStrictEqual(drivein.items[3], { title: 'Black Demons', year: '1991', display: 'Black Demons (1991) aka Demons 3', akas: ['Demons 3'] });
});
test('parseSchedule: an aka with its own (year) is captured without the year', () => {
    const days = parseSchedule('<p><strong>Friday</strong></p><p><strong>Sec</strong></p><ul><li>Treasure of the Living Dead (1982) aka Oasis of the Zombies (1982)</li></ul>');
    assert.deepStrictEqual(days[0].sections[0].items[0].akas, ['Oasis of the Zombies']);
});
test('parseSchedule: multiple akas all become aliases', () => {
    const days = parseSchedule('<p><strong>Friday</strong></p><p><strong>Sec</strong></p><ul><li>Some Film (1980) aka First Alias aka Second Alias</li></ul>');
    assert.deepStrictEqual(days[0].sections[0].items[0].akas, ['First Alias', 'Second Alias']);
});

test('itemMatchesTitle: matches the primary title case-insensitively', () => {
    assert.ok(itemMatchesTitle({ title: 'Black Demons', akas: ['Demons 3'] }, 'black demons'));
});
test('itemMatchesTitle: matches an aka case-insensitively', () => {
    assert.ok(itemMatchesTitle({ title: 'Black Demons', akas: ['Demons 3'] }, 'DEMONS 3'));
});
test('itemMatchesTitle: rejects a non-matching title', () => {
    assert.ok(!itemMatchesTitle({ title: 'Black Demons', akas: ['Demons 3'] }, 'Demons 2'));
});
test('itemMatchesTitle: tolerates cached items without an akas field', () => {
    assert.ok(itemMatchesTitle({ title: 'Black Demons' }, 'Black Demons'));
    assert.ok(!itemMatchesTitle({ title: 'Black Demons' }, 'Demons 3'));
});
test('parseSchedule: the intro paragraph and "Showtime starts..." line produce no spurious section', () => {
    const entry = parseFirstEntry(FEED_FIXTURE);
    const days = parseSchedule(entry.contentHtml);
    const allSectionNames = days.flatMap(d => d.sections.map(s => s.name));
    assert.ok(!allSectionNames.includes('Playing this weekend @'));
});
test('parseSchedule: returns an empty array for content with no day headers', () => {
    assert.deepStrictEqual(parseSchedule('<p><strong>Not A Day</strong></p><ul><li>X (2000)</li></ul>'), []);
});
