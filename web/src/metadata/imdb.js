import { nativeHttpGet } from '../native.js';

/* ==========================================================
   IMDb GraphQL (public endpoint, via native HTTP to dodge CORS)
   The website's own endpoint accepts arbitrary queries, so we send our
   OWN query (no persisted-hash maintenance). Works over GET; reuses the
   native bridge. Data is "non-commercial use only" per IMDb — fine here.
========================================================== */
const IMDB_GQL = 'https://caching.graphql.imdb.com/';
const IMDB_HEADERS = {
    'Accept': 'application/graphql+json, application/json',
    'Content-Type': 'application/json',
    'x-imdb-client-name': 'imdb-web-next-localized',
    'x-imdb-user-language': 'en-US',
    'x-imdb-user-country': 'US',
};

async function imdbQuery(operationName, query, variables) {
    const url = IMDB_GQL +
        '?operationName=' + encodeURIComponent(operationName) +
        '&query='         + encodeURIComponent(query) +
        '&variables='     + encodeURIComponent(JSON.stringify(variables));
    const res = await nativeHttpGet(url, IMDB_HEADERS);
    if (!res || res.status !== 200) throw new Error('IMDb GQL HTTP ' + (res && res.status));
    return JSON.parse(res.body);
}

/* ==========================================================
   TITLE SEARCH — title+year -> tconst, plus rating/runtime/overview/
   poster/genres. IMDb-primary fallback for movies TMDB doesn't have
   cataloged (e.g. obscure fan shorts) or when no TMDB key is set.
   Query text/field-paths/disambiguation logic ported verbatim from
   the sibling PC userscript's movie-title-links module (proven live
   there against caching.graphql.imdb.com; not re-derived).
========================================================== */

// Unfiltered search + client-side pick, NOT a server-side year filter — IMDb's
// mainSearch year-range filter drops unrelated-but-plausible near-miss titles
// instead of the intended exact one on an off-by-one year, worse than a clean
// "no match". Search title-only (first: 20 -- franchises with heavy fan-video/
// short/podcast coverage can bury the real film past the first handful of
// results), narrow to titleType.id === 'movie' when possible, then prefer a
// releaseYear match, breaking ties by highest ratingsSummary.voteCount rather
// than raw relevance order -- real theatrical releases outvote fan content by
// orders of magnitude.
const IMDB_MAIN_SEARCH_QUERY = 'query MainSearch($term: String!) { mainSearch(first: 20, options: { searchTerm: $term, type: TITLE }) { edges { node { entity { ... on Title { id titleText { text } releaseYear { year } titleType { text id isSeries isEpisode } ratingsSummary { voteCount } } } } } } }';

function byVoteCountDesc(a, b) {
    return (b.ratingsSummary?.voteCount ?? 0) - (a.ratingsSummary?.voteCount ?? 0);
}

// Sequel numbering swaps freely between roman and arabic ("Part III" vs "Part
// 3") between how the stream names a title and how IMDb's own titleText spells
// it -- normalize both to arabic so they compare equal. Deliberately excludes
// bare I/V/X: those collide with the pronoun "I", rating-board "V"/"X", etc.
// far too often in real titles to treat as numerals.
const ROMAN_NUMERALS = {
    ii: 2, iii: 3, iv: 4, vi: 6, vii: 7, viii: 8, ix: 9,
    xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15,
    xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};

function normalizeTitle(s) {
    return (s || '')
        .toLowerCase()
        .replace(/^(the|a|an)\s+/, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map(w => ROMAN_NUMERALS[w] !== undefined ? String(ROMAN_NUMERALS[w]) : w)
        .join(' ');
}

// Excluded from the token sets before comparing -- otherwise formulaic genre
// titles that share only connector words (e.g. "Island of the Living Dead" vs
// "Night of the Living Dead") clear the similarity bar on "of"/"the"/"living"/
// "dead" alone despite being unrelated films.
const TITLE_STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and']);

function titleTokens(s) {
    return new Set(normalizeTitle(s).split(' ').filter(w => w && !TITLE_STOPWORDS.has(w)));
}

// Dice coefficient over normalized, stopword-stripped word sets -- tolerant of
// punctuation, subtitle, and roman/arabic differences, but still confidently
// rejects an unrelated title (near-zero token overlap).
export function titlesMatch(a, b) {
    const setA = titleTokens(a);
    const setB = titleTokens(b);
    if (!setA.size || !setB.size) return false;
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection++;
    return (2 * intersection) / (setA.size + setB.size) >= 0.7;
}

async function imdbSearchTitle(title, year) {
    if (!title) return null;
    try {
        const data = await imdbQuery('MainSearch', IMDB_MAIN_SEARCH_QUERY, { term: title });
        const edges = data?.data?.mainSearch?.edges || [];
        const results = edges.map(e => e?.node?.entity).filter(Boolean);
        const movies = results.filter(r => r.titleType?.id === 'movie');
        const tvEpisodes = results.filter(r => r.titleType?.id === 'tvEpisode');
        const nonPodcast = results.filter(r => r.titleType?.id !== 'podcastEpisode');
        // A candidate must actually resemble the query title before it's eligible at
        // all -- year is only a tiebreaker among title matches, never a filter we
        // fall back off of onto an unrelated popular title. Advance to the next tier
        // only when the current one has no title-matching candidate at all (not
        // merely when it's empty) -- some genre titles are tagged a titleType other
        // than 'movie' on IMDb, so a same-named-but-wrong 'movie' entry must not
        // block the loop from ever reaching the tier that actually holds the real
        // title.
        const tiers = [movies, tvEpisodes, nonPodcast, results];
        let titleMatches = [];
        for (const tier of tiers) {
            titleMatches = tier.filter(r => titlesMatch(r.titleText?.text, title));
            if (titleMatches.length) break;
        }
        if (!titleMatches.length) return null;
        const yearMatches = year ? titleMatches.filter(r => String(r.releaseYear?.year) === String(year)) : [];
        const candidates = yearMatches.length ? yearMatches : titleMatches;
        const best = candidates.slice().sort(byVoteCountDesc)[0] || null;
        if (!best) return null;
        return {
            tconst: best.id,
            title: best.titleText?.text ?? null,
            year: best.releaseYear?.year ?? null,
            titleType: best.titleType?.id ?? null,
        };
    } catch (e) { return null; }
}

// All 5 fields (rating, runtime, overview, poster, genres) via a single GraphQL
// round-trip. Field paths and the `titleGenres.genres[].genre.text` nesting
// match the parental-guide/trivia queries above exactly (same endpoint/shape).
const IMDB_TITLE_FIELDS_QUERY = 'query GHCombined($id: ID!){ title(id:$id){ id ratingsSummary{ aggregateRating voteCount } runtime{ seconds } plot{ plotText{ plainText } } primaryImage{ url width height } titleGenres{ genres{ genre{ text } } } } }';

async function fetchImdbTitleFields(tconst) {
    if (!tconst) return null;
    try {
        const data = await imdbQuery('GHCombined', IMDB_TITLE_FIELDS_QUERY, { id: tconst });
        const t = data?.data?.title;
        if (!t) return null;
        return {
            rating:   t.ratingsSummary?.aggregateRating ?? null,
            runtime:  t.runtime?.seconds != null ? Math.round(t.runtime.seconds / 60) : null,
            overview: t.plot?.plotText?.plainText ?? null,
            poster:   t.primaryImage?.url ?? null,
            genres:   t.titleGenres?.genres?.map(g => g.genre?.text).filter(Boolean) ?? null,
        };
    } catch (e) { return null; }
}

// Combined entry point: resolves title+year to a tconst, then pulls its
// fields, and returns a single merged object. Returns null if the title can't
// be resolved at all; still returns the tconst/title/year even if the field
// lookup itself fails (fields spread in as {} in that case).
export async function fetchImdbMovieByTitle(title, year) {
    const match = await imdbSearchTitle(title, year);
    if (!match || !match.tconst) return null;
    const fields = await fetchImdbTitleFields(match.tconst);
    return {
        tconst: match.tconst,
        title:  match.title,
        year:   match.year,
        ...(fields || {}),
    };
}

// Returns [{category, severity}] (severity: None/Mild/Moderate/Severe) or null.
export async function fetchImdbParentalGuide(tconst) {
    if (!tconst) return null;
    const q = 'query GHGuide($id: ID!){ title(id:$id){ parentsGuide{ categories{ category{ text } severity{ text } } } } }';
    try {
        const data = await imdbQuery('GHGuide', q, { id: tconst });
        const cats = data && data.data && data.data.title && data.data.title.parentsGuide
            ? data.data.title.parentsGuide.categories : null;
        if (!cats) return null;
        return cats
            .map(c => ({ category: c.category && c.category.text, severity: c.severity && c.severity.text }))
            .filter(c => c.category && c.severity);
    } catch (e) { return null; }
}

// Trivia — lazy-fetched + cached per tconst (the lists can be hundreds long)
const _triviaCache = {};
export async function fetchImdbTrivia(tconst) {
    if (!tconst) return null;
    if (_triviaCache[tconst]) return _triviaCache[tconst];
    const q = 'query GHTrivia($id: ID!){ title(id:$id){ trivia(first: 30){ edges{ node{ text{ plainText } } } } } }';
    try {
        const data = await imdbQuery('GHTrivia', q, { id: tconst });
        const edges = data && data.data && data.data.title && data.data.title.trivia
            ? data.data.title.trivia.edges : [];
        const items = (edges || []).map(e => e && e.node && e.node.text && e.node.text.plainText).filter(Boolean);
        _triviaCache[tconst] = items;
        return items;
    } catch (e) { return null; }
}

/* ==========================================================
   CAST & CREW TRIVIA — feeds the pop-up trivia bubble rotation
   (cards/triviapopup.js) with per-person facts, not just the movie's
   own trivia. Query text/caching keys ported verbatim from the sibling
   PC userscript's trivia-popup module (proven live there; not
   re-derived) -- see that repo's `Add cast & crew trivia to the pop-up
   bubble rotation` + two follow-up fix commits for the review history
   behind the cache-key and dedupe details below.
========================================================== */

// Combined cast+director query -- one request per movie instead of two;
// the bare `characters` field on Credit fails GraphQL validation, it only
// exists on the `Cast` interface implementation, hence the inline fragment.
export async function fetchCastAndDirector(tconst) {
    if (!tconst) return null;
    const q = 'query GHCastAndDirector($id: ID!){ title(id:$id){ series{ series{ id } } cast: credits(first: 3, filter: { categories: ["cast"] }) { edges{ node{ name{ id nameText{ text } } ... on Cast { characters{ name } } } } } directors: credits(first: 1, filter: { categories: ["director"] }) { edges{ node{ name{ id nameText{ text } } } } } } }';
    try {
        const data = await imdbQuery('GHCastAndDirector', q, { id: tconst });
        const t = data?.data?.title;
        if (!t) return null;
        const cast = (t.cast?.edges || []).map(e => ({
            nconst: e?.node?.name?.id ?? null,
            name: e?.node?.name?.nameText?.text ?? null,
            character: e?.node?.characters?.[0]?.name ?? null,
            role: 'cast',
        })).filter(p => p.nconst && p.name);
        const directors = (t.directors?.edges || []).map(e => ({
            nconst: e?.node?.name?.id ?? null,
            name: e?.node?.name?.nameText?.text ?? null,
            character: null,
            role: 'director',
        })).filter(p => p.nconst && p.name);
        // Dedup by nconst, keeping the FIRST occurrence -- cast is concatenated
        // before directors, so an actor-director (credited as both) keeps
        // their character-name byline instead of being double-counted under a
        // second, generic "Director" byline.
        const seen = new Set();
        return {
            people: cast.concat(directors).filter(p => !seen.has(p.nconst) && seen.add(p.nconst)),
            seriesTconst: t.series?.series?.id ?? null,
        };
    } catch (e) { return null; }
}

// Cached per-nconst (a person's own trivia doesn't depend on which movie is
// currently playing).
const _personTriviaCache = {};
export async function fetchPersonTrivia(nconst) {
    if (!nconst) return [];
    if (_personTriviaCache[nconst]) return _personTriviaCache[nconst];
    const q = 'query GHPersonTrivia($id: ID!){ name(id:$id){ trivia(first: 10){ edges{ node{ text{ plainText } } } } } }';
    try {
        const data = await imdbQuery('GHPersonTrivia', q, { id: nconst });
        const edges = data?.data?.name?.trivia?.edges || [];
        const items = edges.map(e => e?.node?.text?.plainText).filter(Boolean);
        _personTriviaCache[nconst] = items;
        return items;
    } catch (e) { return []; }
}

// Picks the person's highest-vote-count "known for" title other than the one
// currently playing, and returns {title, year} for the caller to synthesize
// a fact sentence from.
//
// Cached per (nconst, excludeTconst, excludeSeriesTconst) triple, not per-
// nconst alone: the same person's "known for" pick depends on which title(s)
// are being excluded (the one currently playing), so a cache keyed only by
// nconst could serve a stale pick made under a different exclusion -- one
// that names the movie now playing as their "known for" title, which reads
// as self-referential nonsense in the popup. The series exclusion is a
// separate parameter (not just excludeTconst) because for TV content
// excludeTconst is the EPISODE's own tconst, but IMDb's knownFor query only
// ever returns SERIES-level titles -- so without also excluding the parent
// series id, a series regular's "known for" pick could be the very series
// currently airing.
const _personKnownForCache = {};
export async function fetchPersonKnownFor(nconst, excludeTconst, excludeSeriesTconst) {
    if (!nconst) return null;
    const cacheKey = `${nconst}|${excludeTconst}|${excludeSeriesTconst || ''}`;
    if (_personKnownForCache[cacheKey] !== undefined) return _personKnownForCache[cacheKey];
    const q = 'query GHKnownFor($id: ID!){ name(id:$id){ knownFor(first: 6){ edges{ node{ title{ id titleText{ text } releaseYear{ year } ratingsSummary{ voteCount } } } } } } }';
    try {
        const data = await imdbQuery('GHKnownFor', q, { id: nconst });
        const edges = data?.data?.name?.knownFor?.edges || [];
        const titles = edges
            .map(e => e?.node?.title)
            .filter(t => t && t.id && t.id !== excludeTconst && t.id !== excludeSeriesTconst && t.titleText?.text);
        if (!titles.length) { _personKnownForCache[cacheKey] = null; return null; }
        titles.sort((a, b) => (b.ratingsSummary?.voteCount ?? 0) - (a.ratingsSummary?.voteCount ?? 0));
        const best = titles[0];
        const result = { title: best.titleText.text, year: best.releaseYear?.year ?? null };
        _personKnownForCache[cacheKey] = result;
        return result;
    } catch (e) { return null; }
}
