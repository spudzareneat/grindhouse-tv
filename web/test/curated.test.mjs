// Ported from the PC userscript's scripts/test-trivia-timeline.mjs -- same
// assertions against the same helpers, now imported from trivia/curated.js.
// (tpRankAllowed is module-private here and the Shift+D test key wasn't ported.)
import { test } from 'node:test';
import assert from 'node:assert';
import { tpValidateCurated, tpDueFact, tpCatchUpFact, TP_TIMELINE_WINDOW_S, tpDriveInAction, tpStarFills, TP_DRIVEIN_SEEN_KEY,
    tpParseCsv, tpIndexDriveInCsv, tpDriveInCardFromRow, tpNominationLines } from '../src/trivia/curated.js';

let failed = 0;
const failures = [];
function eq(label, actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push(`${label} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
        failed++;
    }
}

const doc = (facts, extra = {}) => ({ schema: 1, imdbId: 'tt0055830', title: 'X', year: 1962, runtimeSec: 4680, facts, ...extra });
const F = (t, text, rank = 1, icon = 'reel', byline = null) => ({ t, rank, anchor: 'spread', text, icon, byline, source: { type: 'imdb' } });

/* ---- tpValidateCurated ---------------------------------------------------- */

eq('valid doc -> sorted normalized facts',
    tpValidateCurated(doc([F(300, 'b'), F(120, 'a', 2, 'skull', 'Joe Bob')]), 'tt0055830'),
    [{ t: 120, rank: 2, anchor: 'spread', text: 'a', icon: 'skull', byline: 'Joe Bob' }, { t: 300, rank: 1, anchor: 'spread', text: 'b', icon: 'reel', byline: null }]);
eq('headshot image kept only from the IMDb image CDN',
    tpValidateCurated(doc([
        { ...F(100, 'ok'), image: 'https://m.media-amazon.com/images/M/abc@._V1_QL75_UX120_CR0,0,120,120_.jpg' },
        { ...F(200, 'evil'), image: 'https://evil.example/images/x.jpg' },
        { ...F(300, 'sneaky'), image: 'https://m.media-amazon.com.evil.example/images/x.jpg' },
        { ...F(400, 'js'), image: 'javascript:alert(1)' },
        { ...F(500, 'none') },
    ]), 'tt0055830').map(f => f.image),
    ['https://m.media-amazon.com/images/M/abc@._V1_QL75_UX120_CR0,0,120,120_.jpg', null, null, null, null]);
eq('source url kept only when plain http(s)',
    tpValidateCurated(doc([
        { ...F(100, 'web'), source: { type: 'web', url: 'https://www.denofgeek.com/movies/carnival-of-souls/' } },
        { ...F(200, 'http'), source: { type: 'web', url: 'http://example.com/a' } },
        { ...F(300, 'js'), source: { type: 'web', url: 'javascript:alert(1)' } },
        { ...F(400, 'quote'), source: { type: 'web', url: 'https://x.com/a"onmouseover="alert(1)' } },
        { ...F(500, 'imdb') },
    ]), 'tt0055830').map(f => f.sourceUrl),
    ['https://www.denofgeek.com/movies/carnival-of-souls/', 'http://example.com/a', undefined, undefined, undefined]);
eq('anchor scene kept, anything else -> spread',
    tpValidateCurated(doc([{ ...F(100, 'x'), anchor: 'scene' }, { ...F(200, 'y'), anchor: 'weird' }]), 'tt0055830').map(f => f.anchor), ['scene', 'spread']);
eq('null doc -> null', tpValidateCurated(null, 'tt0055830'), null);
eq('wrong schema -> null', tpValidateCurated(doc([F(1, 'a')], { schema: 2 }), 'tt0055830'), null);
eq('id mismatch -> null', tpValidateCurated(doc([F(100, 'a')]), 'tt9999999'), null);
eq('expectedId null skips id check (dev override)', tpValidateCurated(doc([F(100, 'a')]), null).length, 1);
eq('facts not an array -> null', tpValidateCurated(doc('nope'), 'tt0055830'), null);
eq('empty facts -> null', tpValidateCurated(doc([]), 'tt0055830'), null);
eq('drops string t / negative t / NaN t, keeps good',
    tpValidateCurated(doc([F('100', 'x'), F(-5, 'y'), F(NaN, 'z'), F(200, 'ok')]), 'tt0055830').map(f => f.text), ['ok']);
eq('drops empty and over-280 text, trims text',
    tpValidateCurated(doc([F(100, '   '), F(110, 'x'.repeat(281)), F(120, '  hi  ')]), 'tt0055830').map(f => f.text), ['hi']);
eq('all facts invalid -> null', tpValidateCurated(doc([F('1', 'a'), F(2, '')]), 'tt0055830'), null);
eq('out-of-range rank -> 2', tpValidateCurated(doc([F(100, 'a', 7)]), 'tt0055830')[0].rank, 2);
eq('non-string icon -> null', tpValidateCurated(doc([F(100, 'a', 1, 42)]), 'tt0055830')[0].icon, null);
eq('blank byline -> null', tpValidateCurated(doc([F(100, 'a', 1, 'reel', '  ')]), 'tt0055830')[0].byline, null);
eq('null entries in facts skipped', tpValidateCurated(doc([null, F(100, 'a')]), 'tt0055830').length, 1);


/* ---- tpDueFact ------------------------------------------------------------- */

const facts = tpValidateCurated(doc([F(100, 'r1'), F(200, 'r3', 3), F(300, 'r2', 2), F(400, 'r1b')]), 'tt0055830');
eq('window constant is 20', TP_TIMELINE_WINDOW_S, 20);
eq('before first fact -> null', tpDueFact(facts, 99, 'frequent', []), null);
eq('exactly at t -> due', tpDueFact(facts, 100, 'frequent', [])?.text, 'r1');
eq('inside window -> due', tpDueFact(facts, 119, 'frequent', [])?.text, 'r1');
eq('edge of window (t+20) -> due', tpDueFact(facts, 120, 'frequent', [])?.text, 'r1');
eq('late join past window -> null (no burst)', tpDueFact(facts, 150, 'frequent', []), null);
eq('seek far ahead lands in later window -> only that fact', tpDueFact(facts, 405, 'frequent', [])?.text, 'r1b');
eq('rank filter: rare skips rank-3 fact', tpDueFact(facts, 205, 'rare', []), null);
eq('rank filter: frequent shows rank-3 fact', tpDueFact(facts, 205, 'frequent', [])?.text, 'r3');
eq('seen (reload inside window) -> null', tpDueFact(facts, 105, 'frequent', ['r1']), null);
eq('NaN currentTime -> null', tpDueFact(facts, NaN, 'frequent', []), null);
eq('null facts -> null', tpDueFact(null, 100, 'frequent', []), null);

/* ---- tpCatchUpFact (late join / seek-ahead catch-up) ---------------------- */

const S = (t, text, rank = 1) => ({ ...F(t, text, rank), anchor: 'scene' });
const cu = tpValidateCurated(doc([F(100, 'a'), S(200, 'scene-only'), F(300, 'b', 2), F(400, 'c'), F(1000, 'future')]), 'tt0055830');
eq('late join: best-ranked earliest missed spread fact', tpCatchUpFact(cu, 600, 'frequent', [], 100)?.text, 'a');
eq('already-seen missed fact skipped -> next best', tpCatchUpFact(cu, 600, 'frequent', ['a'], 100)?.text, 'c');
eq('rank 1 beats an earlier rank 2', tpCatchUpFact(cu, 600, 'frequent', ['a', 'c'], 100)?.text, 'b');
eq('scene facts never caught up', tpCatchUpFact(cu, 600, 'frequent', ['a', 'b', 'c'], 100), null);
eq('too soon after the last bubble -> null', tpCatchUpFact(cu, 600, 'frequent', [], 30), null);
eq('timed fact less than 60s away -> null (keep the gap clear)', tpCatchUpFact(cu, 950, 'frequent', [], 100), null);
eq('a fact still inside its due window is not "missed"', tpCatchUpFact(cu, 110, 'frequent', [], 100), null);
eq('rank filter applies to catch-ups', tpCatchUpFact(cu, 600, 'rare', ['a', 'c'], 100), null);
eq('upcoming timed fact filtered out by rank does not block catch-up',
    tpCatchUpFact(tpValidateCurated(doc([F(100, 'a'), F(620, 'r3', 3)]), 'tt0055830'), 600, 'rare', [], 100)?.text, 'a');
eq('upcoming timed fact already seen does not block catch-up',
    tpCatchUpFact(tpValidateCurated(doc([F(100, 'a'), F(620, 'z')]), 'tt0055830'), 600, 'frequent', ['z'], 100)?.text, 'a');
eq('nothing missed at movie start -> null', tpCatchUpFact(cu, 50, 'frequent', [], 100), null);
eq('NaN currentTime -> null', tpCatchUpFact(cu, NaN, 'frequent', [], 100), null);
eq('null facts -> null', tpCatchUpFact(null, 600, 'frequent', [], 100), null);

/* ---- Drive-In Totals card --------------------------------------------- */

const DI = { t: 15, lines: ['19 Dead Bodies', 'Zombie Fu'], stars: 4, says: 'Four stars.', awards: [] };

const CSV = [
    '"title","year","imdb_id","first_air_date","totals","academy_award_nominations","star_rating","stars","transcribed","llm_model","source"',
    '"Carnival of Souls","1962","tt0055830","1992-05-16","No breasts (1962). Nineteen dead bodies. Approximately 15 zombies. One motor vehicle chase, with watery crash. Zombie Fu.","Drive-In Academy Award nominations for Candace Hilligoss, for saying ""I don\'t belong in the world""; Frances Feist, as the creepy old rooming house lady; and Herk Harvey, for producing. In the Drive-In Hall of Fame.","Four stars.","4","","","letterboxd: ty0005"',
    '"Texas","1974","tt0072271","","7 Dead Bodies. Bone Fu. Joe Bob say check it out.","","Four stars.","4","","",""',
    '"Unrated","1980","tt0000002","","Three dead bodies, one dead dog, two breasts, and arm slashing.","","","","","",""',
    '"Empty","1981","tt0000003","","","","Two stars.","2","","",""',
    '"Bad id","1982","nope","","1 Dead Body.","","","","","",""',
].join('\r\n') + '\r\n';
const IDX = tpIndexDriveInCsv(CSV);

eq('csv: indexed by imdb_id, bad ids skipped, quotes/commas/CRLF parsed',
    [Object.keys(IDX), IDX.tt0055830.starRating, IDX.tt0055830.nominations.includes('"I don\'t belong in the world"')],
    [['tt0055830', 'tt0072271', 'tt0000002', 'tt0000003'], 'Four stars.', true]);
eq('csv: empty / missing columns -> {}', [tpIndexDriveInCsv(''), tpIndexDriveInCsv('"a","b"\n"1","2"')], [{}, {}]);
eq('csv: embedded newline inside a quoted field', tpParseCsv('a,"x\ny",b\n'), [['a', 'x\ny', 'b']]);

eq('card from row: counts cleaned, stars + star phrase, one nominee per line',
    tpDriveInCardFromRow(IDX.tt0055830),
    { t: 15, lines: ['No Breasts (1962)', '19 Dead Bodies', 'About 15 Zombies', '1 Motor Vehicle Chase, with Watery Crash', 'Zombie Fu'],
      stars: 4, says: 'Four stars.',
      awards: ['Candace Hilligoss, for saying "I don\'t belong in the world"', 'Frances Feist, as the creepy old rooming house lady',
               'Herk Harvey, for producing', 'In the Drive-In Hall of Fame'] });
eq('card from row: "check it out" moves off the counts onto the star phrase',
    [tpDriveInCardFromRow(IDX.tt0072271).lines, tpDriveInCardFromRow(IDX.tt0072271).says],
    [['7 Dead Bodies', 'Bone Fu'], 'Four stars. Joe Bob says check it out.']);
eq('card from row: unrated -> no stars, empty phrase; long comma list is one count per item',
    tpDriveInCardFromRow(IDX.tt0000002),
    { t: 15, lines: ['3 Dead Bodies', '1 Dead Dog', '2 Breasts', 'Arm Slashing'], stars: null, says: '', awards: [] });
eq('card from row: no totals / no row -> null', [tpDriveInCardFromRow(IDX.tt0000003), tpDriveInCardFromRow(undefined)], [null, null]);
eq('card from row: odd star values clamp to half steps',
    ['2.25', '4.5', '0', 'x'].map(stars => tpDriveInCardFromRow({ totals: 'Zombie Fu.', stars, starRating: '', nominations: '' }).stars),
    [2.5, 4, 0, null]);

eq('nominations: plain comma list -> one name each, prefix and "and" dropped',
    tpNominationLines('Drive-In Academy Award nominations for John Karlen, Danielle Ouimet, Delphine Seyrig, and Andrea Rau.'),
    ['John Karlen', 'Danielle Ouimet', 'Delphine Seyrig', 'Andrea Rau']);
eq('nominations: "for:" prefix, single nominee, DIAA prefix',
    [tpNominationLines('Drive-in academy award nominations for: Terrence G. Ross. Victor Désy.'),
     tpNominationLines('Drive-In Academy Award nomination for Umberto Lenzi.'),
     tpNominationLines('DIAA Nominations For Walken, As A Geek School Teacher; And Martin Sheen for Acting Like A Politician.')],
    [['Terrence G. Ross', 'Victor Désy'], ['Umberto Lenzi'], ['Walken, As A Geek School Teacher', 'Martin Sheen for Acting Like A Politician']]);
eq('nominations: ";" inside a quote does not split; leaked verdict dropped',
    tpNominationLines('Drive-In Academy Awards for Rolfe Kanefsky, for writing the line "I am not a piece of meat who can perform on cue;" Kiva, as Pamela, for ignoring Rick. Three and a half stars. Joe Bob says check it out.'),
    ['Rolfe Kanefsky, for writing the line "I am not a piece of meat who can perform on cue;" Kiva, as Pamela, for ignoring Rick']);
eq('nominations: comma list with long parts stays one line',
    tpNominationLines('Drive-In Academy Award nominations for Brian Cox, as the world-weary coroner who says hi, and Olwen Kelly.').length, 1);
eq('nominations: chained initials are not a sentence end',
    tpNominationLines('Drive-In Academy Award nominations for Hy Pyke, D.C. Lacroix, and Regina Starr.'), ['Hy Pyke', 'D.C. Lacroix', 'Regina Starr']);
eq('nominations: empty -> []', [tpNominationLines(''), tpNominationLines(undefined)], [[], []]);

eq('card: not before t', tpDriveInAction(DI, 14, [], 999), null);
eq('card: due at t and through the window',
    [tpDriveInAction(DI, 15, [], 0), tpDriveInAction(DI, 15 + TP_TIMELINE_WINDOW_S, [], 0)], ['due', 'due']);
eq('card: late joiner gets it 15s after joining (or after the last pop), not before',
    [tpDriveInAction(DI, 600, [], 14), tpDriveInAction(DI, 600, [], 15)], [null, 'catchup']);
eq('card: seen -> never', tpDriveInAction(DI, 15, [TP_DRIVEIN_SEEN_KEY], 999), null);
eq('card: none -> null', tpDriveInAction(null, 15, [], 999), null);
eq('card: bad currentTime -> null', tpDriveInAction(DI, NaN, [], 999), null);
eq('stars: fill per slot',
    [tpStarFills(4), tpStarFills(3.5), tpStarFills(0), tpStarFills(1.5)],
    [[1, 1, 1, 1], [1, 1, 1, 0.5], [0, 0, 0, 0], [1, 0.5, 0, 0]]);


test('curated timeline + Drive-In Totals helpers (ported PC assertions)', () => {
    assert.strictEqual(failed, 0, failures.join('\n'));
});
