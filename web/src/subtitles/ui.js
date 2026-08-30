import { hasKey, LS_OPENSUBTITLES, LS_SUBTITLE_CACHE } from '../store.js';
import { searchSubtitles, downloadSubtitle, fetchSrtText, parseSrt } from './opensubtitles.js';
import {
    showMovieSubtitles, hideMovieSubtitles, isMovieSubtitlesVisible,
    getSubtitleOffset, setSubtitleOffset, resetSubtitleOffset,
} from './overlay.js';
import { tvNavState } from '../tvnav.js';
import { layoutDock } from '../chrome/dock.js';

// ── Persisted cache (survives cold restarts -- the WebView reloads the whole
// page and wipes every in-memory-only variable on process death, e.g. Android
// reclaiming a backgrounded app) so re-opening the same movie doesn't have to
// spend another of the key's 5 free downloads/day. Same {ts}/eviction
// convention as metadata/tmdb.js's movie-link cache. ────────────────────────
const SUBTITLE_CACHE_MAX_ENTRIES = 15;
let _subtitleCache = {}; // imdbId -> { cues, offset, release, uploader, ts }

function loadSubtitleCache() {
    try {
        const raw = localStorage.getItem(LS_SUBTITLE_CACHE);
        if (raw) _subtitleCache = JSON.parse(raw);
    } catch (e) { _subtitleCache = {}; }
}
loadSubtitleCache();

function persistSubtitleCache() {
    try {
        const keys = Object.keys(_subtitleCache);
        if (keys.length > SUBTITLE_CACHE_MAX_ENTRIES) {
            const oldestFirst = keys.sort((a, b) => (_subtitleCache[a].ts || 0) - (_subtitleCache[b].ts || 0));
            for (const k of oldestFirst.slice(0, keys.length - SUBTITLE_CACHE_MAX_ENTRIES)) delete _subtitleCache[k];
        }
        localStorage.setItem(LS_SUBTITLE_CACHE, JSON.stringify(_subtitleCache));
    } catch (e) { /* storage full/unavailable -- in-memory cache for this session still works */ }
}

/* ==========================================================
   SUBTITLES BUTTON + RESULTS PICKER + MANAGE MODAL — a docked cluster button
   (chrome/dock.js, alongside Cast/Free-Watch/Settings/View) that only
   appears once a movie is identified (a real imdbId, same signal
   metadata/tmdb.js's lookupMovie already produces for the parental-guide/
   trivia lookups) AND an OpenSubtitles key is configured.

   First click searches and opens a picker (OVERLAY_IDS, see tvnav.js) of the
   top results; picking one downloads + parses it and turns the overlay on
   immediately. Once something's downloaded, clicking the button again opens
   a manage modal instead (hide/show, sync offset, or re-open the picker to
   try a different release) -- the free key only gets 5 downloads/day, so
   picking a different result from the SAME cached search list (no re-search)
   and nudging the offset are both meant to be cheaper first resorts than
   burning another download on a guess.
========================================================== */

let _imdbId = null;
let _cues = null;      // null = nothing downloaded yet for the current _imdbId
let _lastResults = [];  // cached search results -- "try a different one" reuses these, no re-search
let _loading = false;

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function ensureButton() {
    let btn = document.getElementById('sc-subtitles-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'sc-subtitles-btn';
        btn.className = 'sc-dock-btn';
        btn.type = 'button';
        btn.title = 'Download subtitles for this movie';
        btn.dataset.tvLabel = 'Subtitles';
        btn.addEventListener('click', onButtonClick);
        document.body.appendChild(btn);
    }
    return btn;
}

// Called whenever titleinject.js resolves (or clears) the now-playing movie's
// imdbId. A changed imdbId means a genuinely different movie -- drop whatever
// subtitles/picker/modal state belonged to the last one.
export function updateSubtitleButton(imdbId) {
    if (imdbId !== _imdbId) {
        _imdbId = imdbId;
        _cues = null;
        _lastResults = [];
        closeSubtitlesPicker();
        closeManageModal();
        hideMovieSubtitles();

        // A cache hit means this exact movie was already downloaded in a past
        // session -- make the button ready immediately (clicking it opens the
        // manage modal, same as a live download) without spending another
        // download or even a search. Doesn't auto-show: a fresh app launch
        // shouldn't pop subtitles over the video unprompted.
        const cached = imdbId && _subtitleCache[imdbId];
        if (cached) {
            _cues = cached.cues;
            setSubtitleOffset(cached.offset || 0);
        }
    }
    const show = !!(imdbId && hasKey(LS_OPENSUBTITLES));
    const btn = show ? ensureButton() : document.getElementById('sc-subtitles-btn');
    if (btn) btn.classList.toggle('sc-hidden', !show);
    layoutDock(); // this button's presence just (potentially) changed -- reflow the dock
}

async function onButtonClick() {
    if (_loading) return;
    if (_cues) { openManageModal(); return; }
    _loading = true;
    const btn = document.getElementById('sc-subtitles-btn');
    btn.disabled = true;
    btn.title = 'Searching…';
    _lastResults = await searchSubtitles(_imdbId);
    btn.disabled = false;
    btn.title = 'Download subtitles for this movie';
    _loading = false;
    openSubtitlesPicker();
}

function resultBadges(r) {
    const badges = [];
    if (r.fromTrusted) badges.push('<span class="sc-subtitles-badge sc-subtitles-badge-trusted">✓ Trusted</span>');
    if (r.hearingImpaired) badges.push('<span class="sc-subtitles-badge">SDH</span>');
    if (r.machineTranslated) badges.push('<span class="sc-subtitles-badge sc-subtitles-badge-warn">Machine-translated</span>');
    return badges.join('');
}

function openSubtitlesPicker() {
    closeManageModal(); // mutually exclusive with the manage modal
    closeSubtitlesPicker();
    const results = _lastResults;
    const panel = document.createElement('div');
    panel.id = 'sc-subtitles-picker';
    panel.innerHTML = `
        <div id="sc-subtitles-picker-box">
            <div id="sc-subtitles-picker-head">
                <span>Choose Subtitles</span>
                <button id="sc-subtitles-picker-close" type="button">✕</button>
            </div>
            <div id="sc-subtitles-picker-body">
                ${results.length ? results.map((r, i) => `
                    <button type="button" class="sc-subtitles-result" data-idx="${i}">
                        <span class="sc-subtitles-result-release">${escapeHtml(r.release)}</span>
                        <span class="sc-subtitles-result-meta">${escapeHtml(r.uploader)} · ${r.downloadCount.toLocaleString()} downloads</span>
                        ${resultBadges(r) ? `<span class="sc-subtitles-result-badges">${resultBadges(r)}</span>` : ''}
                    </button>`).join('')
                : '<div class="sc-subtitles-empty">No subtitles found for this movie.</div>'}
            </div>
            <div id="sc-subtitles-picker-status"></div>
        </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#sc-subtitles-picker-close').addEventListener('click', closeSubtitlesPicker);
    panel.querySelectorAll('.sc-subtitles-result').forEach((el, i) => {
        el.addEventListener('click', () => selectResult(results[i]));
    });

    const first = panel.querySelector('.sc-subtitles-result') || panel.querySelector('#sc-subtitles-picker-close');
    if (first && tvNavState.setFocus) tvNavState.setFocus(first);
}

export function closeSubtitlesPicker() {
    const panel = document.getElementById('sc-subtitles-picker');
    if (panel) panel.remove();
}

async function selectResult(result) {
    const status = document.getElementById('sc-subtitles-picker-status');
    if (status) status.textContent = 'Downloading…';
    const link = await downloadSubtitle(result.fileId);
    if (!link) {
        if (status) status.textContent = "Download failed — try another, or check your key/quota.";
        return;
    }
    const srt = await fetchSrtText(link);
    const cues = srt ? parseSrt(srt) : [];
    if (!cues.length) {
        if (status) status.textContent = "Couldn't read that subtitle file — try another.";
        return;
    }
    _cues = cues;
    resetSubtitleOffset(); // a genuinely different file -- any prior tuning doesn't apply
    _subtitleCache[_imdbId] = { cues, offset: 0, release: result.release, uploader: result.uploader, ts: Date.now() };
    persistSubtitleCache();
    closeSubtitlesPicker();
    showMovieSubtitles(_cues);
}

const OFFSET_STEP = 0.5;

function renderOffsetReadout(modal) {
    const seconds = getSubtitleOffset();
    const el = modal.querySelector('#sc-subtitles-offset-val');
    if (el) el.textContent = (seconds > 0 ? '+' : '') + seconds.toFixed(1) + 's';
}

function openManageModal() {
    closeSubtitlesPicker(); // mutually exclusive with the results picker
    closeManageModal();
    const modal = document.createElement('div');
    modal.id = 'sc-subtitles-manage';
    modal.innerHTML = `
        <div id="sc-subtitles-manage-box">
            <div id="sc-subtitles-manage-head">
                <span>Subtitles</span>
                <button id="sc-subtitles-manage-close" type="button">✕</button>
            </div>
            <button id="sc-subtitles-manage-toggle" type="button" class="sc-settings-btn-wide"></button>
            <div class="sc-subtitles-offset-row">
                <span class="sc-subtitles-offset-label">Sync offset</span>
                <div class="sc-subtitles-offset-controls">
                    <button id="sc-subtitles-offset-minus" type="button" class="sc-settings-test">−0.5s</button>
                    <span id="sc-subtitles-offset-val"></span>
                    <button id="sc-subtitles-offset-plus" type="button" class="sc-settings-test">+0.5s</button>
                </div>
            </div>
            <button id="sc-subtitles-offset-reset" type="button" class="sc-update-github-link">Reset offset</button>
            <button id="sc-subtitles-manage-different" type="button" class="sc-settings-btn-wide">Download a different one</button>
        </div>`;
    document.body.appendChild(modal);

    const toggleBtn = modal.querySelector('#sc-subtitles-manage-toggle');
    const syncToggleLabel = () => { toggleBtn.textContent = isMovieSubtitlesVisible() ? 'Hide Subtitles' : 'Show Subtitles'; };
    syncToggleLabel();
    toggleBtn.addEventListener('click', () => {
        if (isMovieSubtitlesVisible()) hideMovieSubtitles(); else showMovieSubtitles(_cues);
        syncToggleLabel();
    });

    const applyOffset = (seconds) => {
        setSubtitleOffset(seconds);
        renderOffsetReadout(modal);
        // Persist the tuned value so it survives a restart alongside the cached file
        // -- only meaningful once this movie's cues actually made it into the cache
        // (a live download always writes one first; a cache-hit restore already has one).
        if (_subtitleCache[_imdbId]) {
            _subtitleCache[_imdbId].offset = seconds;
            persistSubtitleCache();
        }
    };
    renderOffsetReadout(modal);
    modal.querySelector('#sc-subtitles-offset-minus').addEventListener('click', () => applyOffset(getSubtitleOffset() - OFFSET_STEP));
    modal.querySelector('#sc-subtitles-offset-plus').addEventListener('click', () => applyOffset(getSubtitleOffset() + OFFSET_STEP));
    modal.querySelector('#sc-subtitles-offset-reset').addEventListener('click', () => applyOffset(0));

    modal.querySelector('#sc-subtitles-manage-close').addEventListener('click', closeManageModal);
    modal.querySelector('#sc-subtitles-manage-different').addEventListener('click', async (e) => {
        // _lastResults is only populated by a live search this session -- a movie
        // restored straight from the cache (app restart) never searched at all, so
        // there'd be nothing to show without fetching first here (search is free,
        // only download spends quota).
        if (!_lastResults.length) {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Searching…';
            _lastResults = await searchSubtitles(_imdbId);
            btn.disabled = false;
            btn.textContent = 'Download a different one';
        }
        openSubtitlesPicker();
    });

    if (tvNavState.setFocus) tvNavState.setFocus(toggleBtn);
}

export function closeManageModal() {
    const modal = document.getElementById('sc-subtitles-manage');
    if (modal) modal.remove();
}
