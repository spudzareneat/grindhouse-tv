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
