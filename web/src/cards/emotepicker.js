import { getKey, setKey } from '../store.js';
import { onSocket } from '../socket.js';

/* ==========================================================
   EMOTE PICKER — a custom panel that replaces CyTube's native #emotelist
   popup, ported from the desktop userscript's emote-picker module.
   chat/input.js's relocateEmoteButton() owns the floating #sc-emote-proxy
   trigger; it toggles this module's panel instead of forwarding clicks to
   CyTube's own button. #emotelistbtn/#emotelist are left untouched in the
   DOM -- this module only reads from them as a data-source fallback.
========================================================== */

const LS_EMOTE_FAVORITES = 'sc_emote_favorites';   // private to this module -- JSON array of favorited emote names
const LS_EMOTE_ACTIVE_TAB = 'sc_emote_active_tab'; // 'all' | 'favorites'
const LS_EMOTE_PANEL_POS = 'sc_emote_panel_pos';   // JSON {left, top} from the last drag

/* ==========================================================
   EMOTE DATA — hybrid sourcing.
   Primary: window.CHANNEL.emotes, the array CyTube's own client keeps in
   sync ({name, image, source, regex} per entry). Only name/image matter
   here -- insertion is a literal `emote.name` string, not a regex match.
   readChannelEmotes() returns null only when CHANNEL.emotes isn't a real
   array yet (not loaded / malformed) -- a genuinely-loaded empty array
   comes back as [], distinct from null, so computeEmoteList() never falls
   through to the DOM-scrape fallback for a channel that has confirmed
   zero emotes, only for one whose data truly isn't available yet.
   Fallback: scrape #emotelist img.channel-emote nodes directly.
========================================================== */
function readChannelEmotes() {
    try {
        const arr = window.CHANNEL && window.CHANNEL.emotes;
        if (!Array.isArray(arr)) return null;
        const out = [];
        for (const e of arr) {
            if (e && typeof e.name === 'string' && e.name && typeof e.image === 'string' && e.image) {
                out.push({ name: e.name, image: e.image });
            }
        }
        return out;
    } catch (e) { return null; }
}

function readEmotesFromDom() {
    const out = [];
    document.querySelectorAll('#emotelist img.channel-emote').forEach(img => {
        const name = img.title;
        const image = img.src;
        if (name && image) out.push({ name, image });
    });
    return out;
}

// The click-open-then-close dance briefly shows/hides CyTube's own popup, so
// `allowForceRender` gates it to only run when the user actually opened our panel
// (never a background socket refresh), and only once per page load.
let _forceRenderAttempted = false;
function scrapeEmotesFallback(allowForceRender) {
    let out = readEmotesFromDom();
    if (out.length || !allowForceRender || _forceRenderAttempted) return out;
    _forceRenderAttempted = true;
    const btn = document.getElementById('emotelistbtn');
    if (btn) {
        try {
            btn.click(); // force a native render if it hasn't happened yet
            out = readEmotesFromDom();
        } finally {
            btn.click(); // close it again -- our panel is what actually shows
        }
    }
    return out;
}

function computeEmoteList(allowForceRender) {
    const fromChannel = readChannelEmotes();
    if (fromChannel !== null) return fromChannel; // genuine data, even if empty
    return scrapeEmotesFallback(!!allowForceRender);
}

let _emoteData = [];

// Re-derives the emote list and, if the panel is open, re-renders whichever tab
// is active in place (preserving any active search filter). Called on first
// panel open (allowForceRender=true) and on any live emote-list socket event.
function refreshEmoteData(allowForceRender) {
    try {
        _emoteData = computeEmoteList(allowForceRender);
    } catch (e) {
        return;
    }
    warmFavoriteBlobUrls(); // fire-and-forget
    const grid = document.getElementById('sc-emotes-grid');
    if (!grid) return;
    const search = document.getElementById('sc-emotes-search');
    renderActiveTabGrid(grid, search ? search.value : '');
}

onSocket('emoteList', () => refreshEmoteData(false));
onSocket('updateEmote', () => refreshEmoteData(false));
onSocket('removeEmote', () => refreshEmoteData(false));

/* ==========================================================
   DRAG + CLAMP HELPER
========================================================== */
function clampPanelPos(left, top, width, height) {
    return {
        x: Math.min(Math.max(left, -(width - 40)), window.innerWidth - 40),
        y: Math.min(Math.max(top, 0), window.innerHeight - 32),
    };
}

function makePanelDraggable(panel, head, draggingClass, onDragEnd) {
    let dragging = false, dragDX = 0, dragDY = 0;
    const setPos = (prop, val) => panel.style.setProperty(prop, val, 'important');
    head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return; // don't start a drag from the close button
        const rect = panel.getBoundingClientRect();
        setPos('left', rect.left + 'px');
        setPos('top', rect.top + 'px');
        setPos('right', 'auto');
        setPos('bottom', 'auto');
        dragDX = e.clientX - rect.left;
        dragDY = e.clientY - rect.top;
        dragging = true;
        head.classList.add(draggingClass);
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const rect = panel.getBoundingClientRect();
        const { x, y } = clampPanelPos(e.clientX - dragDX, e.clientY - dragDY, rect.width, rect.height);
        setPos('left', x + 'px');
        setPos('top', y + 'px');
    });
    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        head.classList.remove(draggingClass);
        try { head.releasePointerCapture(e.pointerId); } catch (err) {}
        if (onDragEnd) {
            const rect = panel.getBoundingClientRect();
            onDragEnd(rect.left, rect.top);
        }
    };
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
}

function getSavedEmotePanelPos() {
    try {
        const raw = getKey(LS_EMOTE_PANEL_POS);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') return parsed;
    } catch (e) {}
    return null;
}
function saveEmotePanelPos(left, top) {
    try { setKey(LS_EMOTE_PANEL_POS, JSON.stringify({ left, top })); } catch (e) {}
}

/* ==========================================================
   PERSISTED FAVORITES — _emoteFavorites is the in-memory Set of favorited
   emote names; loadFavorites() (re)reads it on every panel open so star
   states/the Favorites tab start accurate. A favorited name no longer
   present in the current emote list (e.g. removed) is never pruned --
   currentTabSourceList() just skips rendering it, storage keeps the name
   in case it comes back.
========================================================== */
let _emoteFavorites = new Set();
function loadFavorites() {
    try {
        const arr = JSON.parse(getKey(LS_EMOTE_FAVORITES) || '[]');
        if (Array.isArray(arr)) return new Set(arr.filter(n => typeof n === 'string' && n));
    } catch (e) {}
    return new Set();
}
function saveFavorites() {
    try { setKey(LS_EMOTE_FAVORITES, JSON.stringify([..._emoteFavorites])); } catch (e) {}
}

/* ==========================================================
   FAVORITE IMAGE CACHE — Cache Storage API, keyed by emote image URL.
   Separate from the browser's own HTTP disk cache (a shared LRU across
   everything the page loads, including every gif anyone posts in chat --
   a favorited emote can get silently evicted there even though nothing
   about it changed). Cross-origin emote CDNs without CORS headers make
   fetch() below throw -- caught and swallowed like every other
   best-effort path here; that emote just falls back to the live URL.
========================================================== */
const EMOTE_FAVORITES_CACHE = 'sc-emote-favorites-v1';

function openFavoritesCache() {
    if (!('caches' in window)) return Promise.resolve(null);
    return caches.open(EMOTE_FAVORITES_CACHE).catch(() => null);
}

let _favoriteBlobUrls = new Map();

function patchFavoriteTileImage(name, src) {
    document.querySelectorAll('#sc-emotes-panel .sc-emotes-tile').forEach(tile => {
        if (tile.dataset.emoteName !== name) return;
        const img = tile.querySelector('img');
        if (img && img.src !== src) img.src = src;
    });
}

function setFavoriteBlobUrl(name, blob) {
    const objUrl = URL.createObjectURL(blob);
    const prev = _favoriteBlobUrls.get(name);
    _favoriteBlobUrls.set(name, objUrl);
    if (prev) URL.revokeObjectURL(prev);
    patchFavoriteTileImage(name, objUrl);
}

// Fetches+persists a favorited emote's actual bytes into the cache the moment
// it's starred, rather than only caching whatever the browser happened to
// already have loaded.
async function cacheFavoriteImage(name, url) {
    if (!url) return;
    try {
        const cache = await openFavoritesCache();
        if (!cache) return;
        const res = await fetch(url);
        if (!res.ok) return;
        await cache.put(url, res.clone());
        setFavoriteBlobUrl(name, await res.blob());
    } catch (e) {} // cross-origin without CORS, offline, etc -- old behavior just continues
}

async function evictFavoriteImage(name, url) {
    const blobUrl = _favoriteBlobUrls.get(name);
    if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        _favoriteBlobUrls.delete(name);
    }
    try {
        const cache = await openFavoritesCache();
        if (cache && url) await cache.delete(url);
    } catch (e) {}
}

// Backfills _favoriteBlobUrls for every current favorite -- resolving from the
// cache where possible, and for a favorite the cache doesn't have yet
// (favorited before this cache existed, or evicted under storage pressure),
// falling through to cacheFavoriteImage() to fetch+store it fresh. Fire-and-
// forget; already-resolved names are skipped, so repeat calls are cheap.
async function warmFavoriteBlobUrls() {
    if (!_emoteFavorites.size || !_emoteData.length) return;
    const cache = await openFavoritesCache();
    if (!cache) return;
    for (const e of _emoteData) {
        if (!_emoteFavorites.has(e.name) || _favoriteBlobUrls.has(e.name)) continue;
        try {
            const res = await cache.match(e.image);
            if (res) setFavoriteBlobUrl(e.name, await res.blob());
            else await cacheFavoriteImage(e.name, e.image);
        } catch (err) {}
    }
}

function toggleFavorite(name) {
    if (!name) return;
    const isFav = !_emoteFavorites.has(name);
    if (isFav) _emoteFavorites.add(name);
    else _emoteFavorites.delete(name);
    saveFavorites();
    refreshAfterFavoriteToggle(name, isFav);
    const emote = _emoteData.find(em => em.name === name);
    const image = emote && emote.image;
    if (isFav) cacheFavoriteImage(name, image);
    else evictFavoriteImage(name, image);
}
// On the All tab, a toggle never changes tile membership, so the star is just
// mutated in place (rebuilding the grid would reset scrollTop and destroy/
// recreate whatever tile held focus). On the Favorites tab, unstarring DOES
// change membership -- that tab alone is fully re-rendered.
function refreshAfterFavoriteToggle(name, isFav) {
    if (_activeTab === 'favorites') {
        const grid = document.getElementById('sc-emotes-grid');
        const search = document.getElementById('sc-emotes-search');
        if (grid) renderActiveTabGrid(grid, search ? search.value : '');
        return;
    }
    document.querySelectorAll('#sc-emotes-panel .sc-emotes-star').forEach(star => {
        if (star.dataset.emoteName === name) setEmoteStarState(star, isFav);
    });
}

let _activeTab = 'all';
function getSavedActiveTab() {
    try {
        const raw = getKey(LS_EMOTE_ACTIVE_TAB);
        if (raw === 'all' || raw === 'favorites') return raw;
    } catch (e) {}
    return 'all';
}
function saveActiveTab(tab) {
    try { setKey(LS_EMOTE_ACTIVE_TAB, tab); } catch (e) {}
}

/* ==========================================================
   INSERTION — #sc-chat-textarea is the real send-source.
========================================================== */
function insertEmoteIntoChat(name) {
    const textarea = document.getElementById('sc-chat-textarea');
    if (!textarea || !name) return;
    const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
    const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + name + textarea.value.slice(end);
    const newPos = start + name.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
}

function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _starLabel(isFav) { return isFav ? 'Remove from favorites' : 'Add to favorites'; }

// Mutates an already-rendered star in place, without touching the tile it lives in.
function setEmoteStarState(star, isFav) {
    star.classList.toggle('sc-emotes-star-active', isFav);
    star.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    const label = _starLabel(isFav);
    star.setAttribute('aria-label', label);
    star.title = label;
    star.textContent = isFav ? '★' : '☆';
}

// Shared tile markup for both the All and Favorites tabs. The tile itself is a
// <button> (click = insert), so the star toggle inside it is deliberately NOT a
// <button> -- nested buttons get silently mangled/reparented by the browser;
// it's a role="button" span instead, made D-pad/keyboard reachable via tabindex.
function renderEmoteTile(e, isFav) {
    const name = _escHtml(e.name);
    const starLabel = _starLabel(isFav);
    // Favorited + already resolved this session -> the Cache Storage-backed object
    // URL, bypassing the network entirely. Otherwise the live URL.
    const src = (isFav && _favoriteBlobUrls.has(e.name)) ? _favoriteBlobUrls.get(e.name) : e.image;
    return `<button type="button" class="sc-emotes-tile" data-emote-name="${name}">` +
            `<span class="sc-emotes-spinner" aria-hidden="true"></span>` +
            `<img src="${_escHtml(src)}" alt="${name}" title="${name}" loading="lazy">` +
            `<span class="sc-emotes-tile-actions">` +
                `<span class="sc-emotes-star${isFav ? ' sc-emotes-star-active' : ''}" role="button" tabindex="0" ` +
                    `data-emote-name="${name}" aria-pressed="${isFav ? 'true' : 'false'}" ` +
                    `aria-label="${starLabel}" title="${starLabel}">${isFav ? '★' : '☆'}</span>` +
            `</span>` +
        `</button>`;
}

function wireImageLoadSpinners(container) {
    container.querySelectorAll('img').forEach(img => {
        const tile = img.closest('.sc-emotes-tile');
        if (!tile) return;
        if (img.complete) { tile.classList.add('sc-emotes-img-loaded'); return; }
        const onDone = () => tile.classList.add('sc-emotes-img-loaded');
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
    });
}

function currentTabSourceList() {
    if (_activeTab === 'favorites') return _emoteData.filter(e => _emoteFavorites.has(e.name));
    return _emoteData;
}

// Live case-insensitive substring filter on emote.name, re-rendered on every
// search keystroke, tab switch, and data refresh.
function renderActiveTabGrid(grid, searchTerm) {
    const source = currentTabSourceList();
    const term = (searchTerm || '').trim().toLowerCase();
    const filtered = term ? source.filter(e => e.name.toLowerCase().includes(term)) : source;
    if (!filtered.length) {
        const onFavorites = _activeTab === 'favorites';
        const msg = onFavorites
            ? (source.length ? 'No matching favorites' : 'No favorites yet')
            : (source.length ? 'No matching emotes' : 'No emotes available');
        grid.innerHTML = `<div class="sc-emotes-empty">${msg}</div>`;
        return;
    }
    grid.innerHTML = filtered.map(e => renderEmoteTile(e, _activeTab === 'favorites' || _emoteFavorites.has(e.name))).join('');
    wireImageLoadSpinners(grid);
}

/* ==========================================================
   GIF PREVIEW — a tile whose image is an actual .gif shows it enlarged in a
   floating box beside the panel. Triggered by mouse hover (desktop/pointer)
   AND by D-pad/keyboard focus (TV remote has no hover concept, :focus is its
   equivalent) -- this app is remote-first, so the TV path isn't optional.
========================================================== */
function isGifImageUrl(url) {
    if (!url) return false;
    try {
        return /\.gif$/i.test(new URL(url, location.href).pathname);
    } catch (e) {
        return /\.gif(?:[?#]|$)/i.test(url);
    }
}

function ensureEmotePreviewEl() {
    let preview = document.getElementById('sc-emotes-preview');
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = 'sc-emotes-preview';
    preview.innerHTML = '<span class="sc-emotes-spinner" aria-hidden="true"></span><img alt="" aria-hidden="true">' +
        '<span id="sc-emotes-preview-name"></span>';
    const img = preview.querySelector('img');
    const onDone = () => preview.classList.add('sc-emotes-preview-loaded');
    img.addEventListener('load', onDone);
    img.addEventListener('error', onDone);
    document.body.appendChild(preview);
    return preview;
}

// Anchored beside #sc-emotes-panel (right edge if there's room, else the left
// edge) rather than beside the tile itself, so it never covers other tiles.
function positionEmotePreview(preview, tile) {
    const panel = document.getElementById('sc-emotes-panel');
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const pw = preview.offsetWidth, ph = preview.offsetHeight;
    const gap = 8;
    let left = panelRect.right + gap;
    if (left + pw > window.innerWidth) left = panelRect.left - gap - pw;
    left = Math.max(4, Math.min(left, window.innerWidth - pw - 4));
    let top = tileRect.top + tileRect.height / 2 - ph / 2;
    top = Math.max(4, Math.min(top, window.innerHeight - ph - 4));
    preview.style.setProperty('left', left + 'px', 'important');
    preview.style.setProperty('top', top + 'px', 'important');
}

function showEmotePreview(tile) {
    const img = tile.querySelector('img');
    if (!img || !isGifImageUrl(img.src)) return;
    const preview = ensureEmotePreviewEl();
    const previewImg = preview.querySelector('img');
    if (previewImg.src !== img.src) {
        preview.classList.remove('sc-emotes-preview-loaded');
        previewImg.src = img.src;
    }
    const nameEl = preview.querySelector('#sc-emotes-preview-name');
    if (nameEl) nameEl.textContent = tile.dataset.emoteName || ''; // textContent -- name is untrusted
    preview.style.setProperty('display', 'block', 'important');
    positionEmotePreview(preview, tile);
}

function hideEmotePreview() {
    const preview = document.getElementById('sc-emotes-preview');
    if (preview) preview.style.setProperty('display', 'none', 'important');
}

function teardownEmotePreview() {
    _previewTile = null;
    const preview = document.getElementById('sc-emotes-preview');
    if (preview) preview.remove();
}

// Tracks the currently-previewed tile so delegated mouseover/mouseout and
// focusin/focusout (none of which bubble in a way that lets a single delegated
// listener dedupe on its own the way click does) don't redundantly reshow/
// reposition on every bubble from a tile's own descendants (img, star, spinner).
let _previewTile = null;
function wireEmotePreviewDelegation(body) {
    const enter = (tile) => {
        if (!tile || tile === _previewTile) return;
        _previewTile = tile;
        showEmotePreview(tile);
    };
    const leave = (tile, related) => {
        if (!tile || tile !== _previewTile) return;
        if (related && tile.contains(related)) return; // still inside the same tile
        _previewTile = null;
        hideEmotePreview();
    };
    body.addEventListener('mouseover', (e) => enter(e.target.closest('.sc-emotes-tile')));
    body.addEventListener('mouseout', (e) => leave(e.target.closest('.sc-emotes-tile'), e.relatedTarget));
    // TV/keyboard equivalent of hover -- focusin/focusout DO bubble (unlike
    // focus/blur), so this can be delegated the same way as the mouse pair.
    body.addEventListener('focusin', (e) => enter(e.target.closest('.sc-emotes-tile')));
    body.addEventListener('focusout', (e) => leave(e.target.closest('.sc-emotes-tile'), e.relatedTarget));
}

/* ==========================================================
   OPEN / CLOSE / TOGGLE — toggleEmotesPanel is what chat/input.js's
   relocateEmoteButton() calls.
========================================================== */
export function openEmotesPanel() {
    if (document.getElementById('sc-emotes-panel')) return;
    // Read on every open so star states / the active tab reflect whatever was last saved.
    _emoteFavorites = loadFavorites();
    _activeTab = getSavedActiveTab();
    // allowForceRender=true: only here, in direct response to the user opening the
    // panel, is the disruptive native-popup click-dance permitted.
    if (!_emoteData.length) refreshEmoteData(true); // also warms the favorite image cache
    else warmFavoriteBlobUrls(); // refreshEmoteData() didn't run above, so warm it here instead

    const panel = document.createElement('div');
    panel.id = 'sc-emotes-panel';
    panel.innerHTML = `
        <div id="sc-emotes-head">
            <span>Emotes</span>
            <button id="sc-emotes-close" type="button">✕</button>
        </div>
        <div id="sc-emotes-body">
            <div id="sc-emotes-tabs" role="tablist">
                <button type="button" class="sc-emotes-tab" data-tab="all" role="tab">All</button>
                <button type="button" class="sc-emotes-tab" data-tab="favorites" role="tab">Favorites</button>
            </div>
            <input type="text" id="sc-emotes-search" class="sc-emotes-search" placeholder="Search emotes…" autocomplete="off">
            <div id="sc-emotes-grid" class="sc-emotes-grid"></div>
        </div>`;
    document.body.appendChild(panel);

    const body = panel.querySelector('#sc-emotes-body');
    const search = panel.querySelector('#sc-emotes-search');
    const tabs = panel.querySelector('#sc-emotes-tabs');
    const grid = panel.querySelector('#sc-emotes-grid');

    const updateTabButtonStates = () => {
        tabs.querySelectorAll('.sc-emotes-tab').forEach(btn => {
            const active = btn.dataset.tab === _activeTab;
            btn.classList.toggle('sc-emotes-tab-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    };
    updateTabButtonStates();
    renderActiveTabGrid(grid, '');

    tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.sc-emotes-tab');
        if (!btn || btn.dataset.tab === _activeTab) return;
        _activeTab = btn.dataset.tab;
        saveActiveTab(_activeTab);
        updateTabButtonStates();
        renderActiveTabGrid(grid, search.value);
    });

    search.addEventListener('input', () => renderActiveTabGrid(grid, search.value));

    // Delegated at the body level so one pair of listeners covers the grid
    // regardless of which tab is currently rendered into it. Star clicks are
    // checked first and stopPropagation()'d so they never also match
    // .sc-emotes-tile and trigger an insert+close.
    body.addEventListener('click', (e) => {
        const star = e.target.closest('.sc-emotes-star');
        if (star) {
            e.stopPropagation();
            toggleFavorite(star.dataset.emoteName);
            return;
        }
        const tile = e.target.closest('.sc-emotes-tile');
        if (!tile) return;
        insertEmoteIntoChat(tile.dataset.emoteName);
        closeEmotesPanel();
    });
    // Keyboard/D-pad equivalent for the star (a role="button" span, not a real
    // <button>, so Enter/Space/OK activation isn't native).
    body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const star = e.target.closest('.sc-emotes-star');
        if (!star) return;
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(star.dataset.emoteName);
    });

    wireEmotePreviewDelegation(body);

    panel.querySelector('#sc-emotes-close').addEventListener('click', closeEmotesPanel);

    // Apply a saved drag position (clamped against the panel's actual rendered
    // size, in case the viewport shrank since it was saved). Otherwise leave the
    // orientation-aware CSS bottom/right default (tv.css) alone.
    const saved = getSavedEmotePanelPos();
    if (saved) {
        const rect = panel.getBoundingClientRect();
        const { x, y } = clampPanelPos(saved.left, saved.top, rect.width, rect.height);
        panel.style.setProperty('left', x + 'px', 'important');
        panel.style.setProperty('top', y + 'px', 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
    }

    makePanelDraggable(panel, panel.querySelector('#sc-emotes-head'), 'sc-emotes-dragging', (left, top) => {
        saveEmotePanelPos(left, top);
    });
}

export function closeEmotesPanel() {
    teardownEmotePreview();
    const panel = document.getElementById('sc-emotes-panel');
    if (panel) panel.remove();
}

export function toggleEmotesPanel() {
    if (document.getElementById('sc-emotes-panel')) closeEmotesPanel();
    else openEmotesPanel();
}
