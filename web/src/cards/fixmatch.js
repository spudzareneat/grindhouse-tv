import { hasKey, LS_TMDB } from '../store.js';
import { searchTmdbCandidates, fetchTmdbDetails, forgetCachedLookup, overrideCacheKey } from '../metadata/tmdb.js';
import { searchImdbCandidates, fetchImdbTitleFields } from '../metadata/imdb.js';
import { getMovieOverride, setMovieOverride, clearMovieOverride, detectTconst } from '../metadata/overrides.js';
import { rematchCurrentTitle, parsedTitleFor } from '../titleinject.js';
import { npState } from './nowplaying.js';
import { tvNavState } from '../tvnav.js';
import { isTv } from '../tvdetect.js';

/* ==========================================================
   FIX MATCH PICKER — opened from the Now-Playing card's "Wrong match?"
   button. Opens already searched (seeded with the title the auto lookup
   parsed from the filename) so the usual fix is just Down + OK on the
   remote; the search box is there for when the right title isn't listed.
   Searches TMDB when a key is set (falling back to IMDb if TMDB has
   nothing), else IMDb. A pick is pinned to this exact raw filename
   (metadata/overrides.js) and the lookup re-runs. Ported in spirit from
   the PC userscript's openFixMatchModal, re-laid-out for the D-pad.
========================================================== */

const ROW_LIMIT = 10;
const _imdbPosterCache = {}; // tconst -> url | null, for the session

const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Remove the picker without touching the remote's focus -- tvnav.js's closeTop (Back) does
// its own focus restore right after.
export function closeFixMatch() {
    const el = document.getElementById('sc-fix-overlay');
    if (el) el.remove();
}

export function openFixMatch(rawTitle) {
    if (!rawTitle) return;
    closeFixMatch();

    const pinned = !!getMovieOverride(rawTitle);
    const cur = npState.data;
    const curText = cur && cur.cleanTitle ? cur.cleanTitle + (cur.cleanYear ? ` (${cur.cleanYear})` : '') : '';

    const overlay = document.createElement('div');
    overlay.id = 'sc-fix-overlay';
    overlay.innerHTML = `
        <div id="sc-fix-box">
            <div id="sc-fix-head">
                <span>Fix match</span>
                <button id="sc-fix-close" type="button">✕</button>
            </div>
            <div id="sc-fix-file"></div>
            ${curText ? `<div id="sc-fix-current">Showing as: <b>${esc(curText)}</b>${pinned ? ' · <span class="sc-fix-pinned">pinned</span>' : ''}</div>` : ''}
            <input id="sc-fix-search" type="text" autocomplete="off" spellcheck="false" enterkeyhint="search"
                   placeholder="Search a title, or paste an IMDb link / tt-id" />
            <div id="sc-fix-results"></div>
            <div id="sc-fix-status"></div>
            ${pinned ? '<div id="sc-fix-actions"><button id="sc-fix-reset" type="button">↺ Reset to auto-match</button></div>' : ''}
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#sc-fix-file').textContent = rawTitle;

    const input     = overlay.querySelector('#sc-fix-search');
    const resultsEl = overlay.querySelector('#sc-fix-results');
    const statusEl  = overlay.querySelector('#sc-fix-status');
    input.value = parsedTitleFor(rawTitle);

    let seq = 0;            // guards against an older search resolving after a newer one
    let debounce = null;
    let busy = false;       // a pick is being saved -- ignore further picks

    // Close from inside the picker (✕, a pick, Reset, Escape). Deferred a tick so a remote
    // OK that triggered it has finished its own click handling first, then the ring goes
    // back to whatever opened the picker -- one restore, never two.
    function finish() {
        clearTimeout(debounce);
        setTimeout(() => {
            if (!overlay.isConnected) return; // already closed via Back
            overlay.remove();
            if (tvNavState.overlayClosed) tvNavState.overlayClosed();
        }, 0);
    }

    function setStatus(text) { statusEl.textContent = text || ''; }

    function renderRows(rows) {
        resultsEl.innerHTML = '';
        rows.forEach(r => {
            const meta = [r.year, r.type, r.votes != null ? `${r.votes.toLocaleString()} votes` : null].filter(Boolean).join(' · ');
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'sc-fix-row';
            row.innerHTML = `
                <span class="sc-fix-thumb"${r.poster ? ` style="background-image:url('${esc(r.poster)}')"` : ''}></span>
                <span class="sc-fix-rowtext">
                    <span class="sc-fix-rowtitle">${esc(r.title)}</span>
                    <span class="sc-fix-rowmeta">${esc(meta)}</span>
                </span>`;
            row.addEventListener('click', () => pick(r));
            resultsEl.appendChild(row);
            r._el = row;
        });
    }

    // IMDb search results carry no image -- fill the thumbnails in as they arrive.
    function fillImdbPosters(rows, mySeq) {
        rows.filter(r => r.source === 'imdb' && !r.poster && r.imdbId).forEach(r => {
            const paint = (url) => {
                const t = url && r._el && r._el.querySelector('.sc-fix-thumb');
                if (t) t.style.backgroundImage = `url('${url}')`;
            };
            if (r.imdbId in _imdbPosterCache) { paint(_imdbPosterCache[r.imdbId]); return; }
            fetchImdbTitleFields(r.imdbId).then(f => {
                _imdbPosterCache[r.imdbId] = (f && f.poster) || null;
                if (mySeq === seq) paint(_imdbPosterCache[r.imdbId]);
            });
        });
    }

    async function runSearch({ focusFirst = false } = {}) {
        clearTimeout(debounce);
        const term = input.value.trim();
        const mySeq = ++seq;

        const tconst = detectTconst(term);
        if (tconst) {
            const rows = [{ source: 'imdb', imdbId: tconst, title: `Use ${tconst}`, year: null, type: null, votes: null, poster: null }];
            renderRows(rows);
            setStatus('');
            fillImdbPosters(rows, mySeq);
            if (focusFirst) focusRow(rows);
            return;
        }
        if (term.length < 2) { renderRows([]); setStatus('Type at least 2 letters.'); return; }

        const useTmdb = hasKey(LS_TMDB);
        setStatus(`Searching ${useTmdb ? 'TMDB' : 'IMDb'}…`);
        let rows = useTmdb ? await searchTmdbCandidates(term, ROW_LIMIT) : [];
        let note = '';
        if (!rows.length) {
            // TMDB's catalog misses plenty of real titles IMDb has (see tmdb.js's header).
            rows = await searchImdbCandidates(term, ROW_LIMIT);
            if (useTmdb && rows.length) note = 'Nothing on TMDB — showing IMDb results.';
        }
        if (mySeq !== seq || !overlay.isConnected) return;
        renderRows(rows);
        setStatus(rows.length ? note : 'No matches — try a different spelling, or paste an IMDb tt-id.');
        fillImdbPosters(rows, mySeq);
        if (focusFirst) focusRow(rows);
    }

    function focusRow(rows) {
        if (!isTv || !tvNavState.setFocus || !overlay.isConnected) return;
        if (document.activeElement === input) return; // mid-typing -- don't yank the ring away
        const target = (rows[0] && rows[0]._el) || input;
        tvNavState.setFocus(target);
    }

    async function pick(r) {
        if (busy) return;
        busy = true;
        let imdbId = r.imdbId;
        if (r.source === 'tmdb') {
            setStatus('Saving…');
            const details = await fetchTmdbDetails(r.tmdbType, r.tmdbId);
            imdbId = details && details.imdbId;
            if (!imdbId) {
                busy = false;
                if (overlay.isConnected) setStatus("TMDB has no IMDb link for that one — try another row.");
                return;
            }
        }
        if (!overlay.isConnected) return; // closed via Back while saving
        setMovieOverride(rawTitle, { imdbId, tmdbId: r.tmdbId ?? null, tmdbType: r.tmdbType ?? null });
        applyAndClose();
    }

    function applyAndClose() {
        forgetCachedLookup(overrideCacheKey(rawTitle)); // the previous pin's result, if any
        const eyebrow = document.getElementById('sc-np-eyebrow');
        if (eyebrow) eyebrow.textContent = 'Updating match…';
        finish();
        rematchCurrentTitle();
    }

    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => runSearch(), 500);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            try { input.blur(); } catch (err) {} // drop the on-screen keyboard
            runSearch({ focusFirst: true });
        }
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
    overlay.querySelector('#sc-fix-close').addEventListener('click', finish);
    const resetBtn = overlay.querySelector('#sc-fix-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        clearMovieOverride(rawTitle);
        applyAndClose();
    });

    runSearch({ focusFirst: true });
}
