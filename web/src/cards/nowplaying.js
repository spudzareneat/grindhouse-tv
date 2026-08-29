import { getCurrentMediaSeconds, getCurrentPlaybackSeconds, formatHMS } from '../mediatime.js';
import { movieState, LINK_DEFS } from '../metadata/tmdb.js';
import { isTv } from '../tvdetect.js';
import { showTriviaCard, toggleTriviaCard } from './trivia.js';
import { getLastAired } from '../metadata/lastaired.js';

/* ==========================================================
   NOW-PLAYING HERO CARD (cinematic shell)
   Full-screen card with backdrop art, poster, rating, runtime,
   genres and content warnings. Shows on new media + on pause,
   fades away on play. TV-first; trivially enableable on mobile.
========================================================== */

// Shorter labels for the IMDb parent-guide categories so chips stay compact
const NP_PG_SHORT = {
    'Sex & Nudity': 'Sex/Nudity',
    'Violence & Gore': 'Violence',
    'Profanity': 'Profanity',
    'Alcohol, Drugs & Smoking': 'Drugs',
    'Frightening & Intense Scenes': 'Frightening',
};

export const npState = {
    data: null,        // latest movie data for the card
    introDone: false,  // startup intro card has run (see initIntroSequence)
};
let _npHideTimer = null;
let _npProgTimer = null;
let _npWatcherInit = false;

// Refresh the now-playing card's elapsed / total / remaining readout in place.
function _renderNpProgress() {
    const card = document.getElementById('sc-np-card');
    if (!card) { clearInterval(_npProgTimer); return; }
    const wrap    = card.querySelector('#sc-np-progress');
    const fill    = card.querySelector('#sc-np-prog-fill');
    const elapsedEl = card.querySelector('#sc-np-prog-elapsed');
    const totalEl   = card.querySelector('#sc-np-prog-total');
    const remainEl  = card.querySelector('#sc-np-prog-remain');
    if (!wrap || !fill) return;

    const dur = getCurrentMediaSeconds();
    if (dur > 0) {
        const elapsed = Math.min(getCurrentPlaybackSeconds(), dur);
        const pct = Math.max(0, Math.min(100, (elapsed / dur) * 100));
        // Must be set !important: the stylesheet pins #sc-np-prog-fill to
        // `width: 0% !important`, which a plain inline width can't override — so the
        // bar would otherwise stay empty no matter the playhead.
        fill.style.setProperty('width', pct + '%', 'important');
        elapsedEl.textContent = formatHMS(elapsed);
        totalEl.textContent   = formatHMS(dur);
        remainEl.textContent  = '−' + formatHMS(dur - elapsed) + ' left';
        wrap.style.display = '';
    } else {
        // No known duration (live stream / unidentified) — nothing useful to show.
        wrap.style.display = 'none';
    }
}

// Enabled on all devices — the mobile (vertical/horizontal) layout renders correctly, and this
// card is the only place parent-guide/kill-count/last-aired info surfaces without a manual tap
// (2026-08-28: was TV-only under the assumption the mobile layout needed tuning first; verified
// on-device that it doesn't).
export function _npCardEnabled() { return true; }

// #sc-np-title's base size differs by layout (tv.css sets 44px default / 60px TV / 30px
// vertical) -- shrink it proportionally for long titles so a wordy one wraps to fewer lines
// rather than growing tall enough to push this bottom-anchored card's content off the top of
// the screen. The CSS line-clamp on #sc-np-title is the hard backstop for anything still too
// long even at the smallest tier.
function _npTitleFontSize(text) {
    const base = isTv ? 60 : (document.body.classList.contains('sc-vertical') ? 30 : 44);
    let scale = 1;
    if (text.length > 60) scale = 0.5;
    else if (text.length > 40) scale = 0.65;
    else if (text.length > 25) scale = 0.8;
    return Math.round(base * scale);
}

// Long synopses overflow the fixed overview window. Start at the top (so the
// opening lines read first), then after a beat glide smoothly to the bottom so
// the whole thing can be read hands-free on the remote. Returns the total ms the
// reveal will take so the auto-hide timer can wait for it to finish.
let _npScrollTimer = null, _npScrollRaf = null;
const _NP_SCROLL_DELAY = 3500;
function _autoScrollOverview() {
    clearTimeout(_npScrollTimer);
    cancelAnimationFrame(_npScrollRaf);
    const card = document.getElementById('sc-np-card');
    const ov = card && card.querySelector('#sc-np-overview');
    if (!ov) return 0;
    ov.scrollTop = 0;
    const dist = ov.scrollHeight - ov.clientHeight;
    if (dist <= 4) return 0;                          // fits — nothing to reveal
    const dur = Math.min(12000, Math.max(2500, (dist / 24) * 1000)); // ~24px/s reading pace
    _npScrollTimer = setTimeout(() => {
        const start = ov.scrollTop;
        const span = ov.scrollHeight - ov.clientHeight - start;
        if (span <= 0) return;
        const t0 = performance.now();
        const step = (now) => {
            const c = document.getElementById('sc-np-card');
            if (!c || !c.classList.contains('sc-np-visible')) return; // dismissed mid-scroll
            const p = Math.min(1, (now - t0) / dur);
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
            ov.scrollTop = start + span * e;
            if (p < 1) _npScrollRaf = requestAnimationFrame(step);
        };
        _npScrollRaf = requestAnimationFrame(step);
    }, _NP_SCROLL_DELAY);
    return _NP_SCROLL_DELAY + dur;
}

export function showNowPlayingCard(data, opts = {}) {
    if (!data || (!data.cleanTitle && !data.backdrop)) return;

    let card = document.getElementById('sc-np-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'sc-np-card';
        card.innerHTML = `
            <div id="sc-np-backdrop"></div>
            <div id="sc-np-scrim"></div>
            <div id="sc-np-content">
                <img id="sc-np-poster" alt="" />
                <div id="sc-np-info">
                    <div id="sc-np-eyebrow">Now Playing</div>
                    <div id="sc-np-title"></div>
                    <div id="sc-np-meta"></div>
                    <div id="sc-np-overview"></div>
                    <div id="sc-np-chips"></div>
                    <div id="sc-np-progress">
                        <div id="sc-np-prog-bar"><div id="sc-np-prog-fill"></div></div>
                        <div id="sc-np-prog-times">
                            <span id="sc-np-prog-elapsed">0:00</span>
                            <span id="sc-np-prog-remain"></span>
                            <span id="sc-np-prog-total">0:00</span>
                        </div>
                    </div>
                    <div id="sc-np-actions">
                        <div id="sc-np-links"></div>
                        <button id="sc-np-trivia-btn" type="button">Trivia</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(card);
        // Tapping/clicking the card dismisses it
        card.addEventListener('click', hideNowPlayingCard);
        card.querySelector('#sc-np-trivia-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // don't let it bubble to the card's own click-to-dismiss handler
            showTriviaCard();
        });
    }

    const title  = data.cleanTitle || movieState.lastMovieTitle || '';
    const year   = data.cleanYear ? ` (${data.cleanYear})` : '';
    const bd      = card.querySelector('#sc-np-backdrop');
    const poster  = card.querySelector('#sc-np-poster');
    const meta    = card.querySelector('#sc-np-meta');
    const chips   = card.querySelector('#sc-np-chips');

    bd.style.backgroundImage = data.backdrop ? `url(${data.backdrop})` : 'none';
    if (data.poster) { poster.src = data.poster; poster.style.display = ''; }
    else poster.style.display = 'none';

    // Eyebrow only claims "Now Playing" for the item actually loaded/synced right now --
    // browsing a different title from Tonight's Lineup passes showProgress: false (see the
    // progress-bar gating below, same signal) so it doesn't mislabel a title that hasn't
    // started yet.
    const eyebrow = card.querySelector('#sc-np-eyebrow');
    eyebrow.style.display = opts.showProgress !== false ? '' : 'none';

    // Trivia is keyed off the actual now-playing item's IMDb id (npState.data), never the
    // `data` this card happens to be rendering -- showTriviaCard() always reads
    // npState.data.imdbId itself, so a lineup-item preview with its own imdbId must still hide
    // this button, or clicking it would show trivia for whatever's really airing instead.
    const triviaBtn = card.querySelector('#sc-np-trivia-btn');
    const showTrivia = opts.showProgress !== false && !!(npState.data && npState.data.imdbId);
    triviaBtn.style.display = showTrivia ? '' : 'none';

    // IMDb/Letterboxd/Wikipedia links -- phone/tablet only, never on TV (2026-08-28: was a
    // user setting, now just hardcoded by device -- a TV remote has no real use for a link
    // that hands off to another app).
    const linksRow = card.querySelector('#sc-np-links');
    linksRow.innerHTML = '';
    if (!isTv && data.links) {
        LINK_DEFS.forEach(({ key, label, color, fg, char }) => {
            const url = data.links[key];
            if (!url) return;
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.title = `${label}: "${title}"`;
            a.className = 'sc-np-link';
            a.style.background = color;
            a.style.color = fg;
            a.textContent = char;
            // Same native hand-off as the title-row badges (titleinject.js) -- opens in the
            // IMDb/Letterboxd/Wikipedia app if installed, instead of inside this WebView.
            a.addEventListener('click', (e) => {
                e.stopPropagation(); // don't let it bubble to the card's own click-to-dismiss handler
                if (window.CytubeNative && typeof CytubeNative.openInApp === 'function') {
                    e.preventDefault();
                    CytubeNative.openInApp(url);
                }
            });
            linksRow.appendChild(a);
        });
    }

    const titleEl = card.querySelector('#sc-np-title');
    const titleText = title + year;
    titleEl.textContent = titleText;
    titleEl.style.setProperty('font-size', _npTitleFontSize(titleText) + 'px', 'important');
    card.querySelector('#sc-np-overview').textContent = data.overview || '';

    const metaParts = [];
    if (data.rating)  metaParts.push(`⭐ ${data.rating}`);
    if (data.runtime) metaParts.push(`${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`);
    if (data.genres && data.genres.length) metaParts.push(data.genres.slice(0, 3).join(' · '));
    const lastAired = getLastAired(title, data.cleanYear);
    if (lastAired) metaParts.push(`📅 Last aired ${lastAired.dateStr}`);
    meta.textContent = metaParts.join('     ');

    // IMDb Parent Guide chips (color-coded by severity) + kill count
    const chipHtml = [];
    (data.parentalGuide || []).forEach(pg => {
        const sev = String(pg.severity || '').toLowerCase();
        const label = NP_PG_SHORT[pg.category] || pg.category;
        chipHtml.push(`<span class="sc-np-chip sc-sev-${sev}">${label}: ${pg.severity}</span>`);
    });
    if (data.killCount !== null && data.killCount !== undefined) {
        chipHtml.push(`<span class="sc-np-chip">💀 ${data.killCount} kills</span>`);
    }
    chips.innerHTML = chipHtml.join('');

    card.classList.add('sc-np-visible');

    // Live elapsed / total / remaining bar — only meaningful for the item that's actually
    // playing right now (this is the remote-friendly stand-in for hovering a scrubber).
    // Browsing a different item from Tonight's Lineup passes showProgress: false so it
    // doesn't show the real now-playing item's progress mislabeled under this title.
    const progWrap = card.querySelector('#sc-np-progress');
    if (opts.showProgress !== false) {
        _renderNpProgress();
        clearInterval(_npProgTimer);
        _npProgTimer = setInterval(_renderNpProgress, 500);
    } else {
        clearInterval(_npProgTimer);
        if (progWrap) progWrap.style.display = 'none';
    }

    // Reveal a long synopsis by gliding to its bottom after a few seconds.
    _autoScrollOverview();

    clearTimeout(_npHideTimer);
    if (opts.autoHide) {
        // Flat dismiss timer for the new-movie announcement card, default 20s. (Previously
        // this waited on the video's paused state and could skip arming the timer entirely
        // if the player happened to be paused/buffering right as the card appeared, leaving
        // the card stuck on screen until manually dismissed -- a flat timer always fires.
        // 20s comfortably covers the synopsis auto-scroll, whose longest reveal is ~18s.)
        // opts.autoHideMs lets a caller shorten this (titleinject.js uses 10s on phones,
        // where the card now also auto-announces -- 2026-08-28 -- but a full 20s of a
        // synopsis nobody's reading yet felt too long for a device usually held, not TV'd).
        _npHideTimer = setTimeout(hideNowPlayingCard, opts.autoHideMs || 20000);
    }
}

export function hideNowPlayingCard() {
    const card = document.getElementById('sc-np-card');
    if (card) card.classList.remove('sc-np-visible');
    clearTimeout(_npHideTimer);
    clearInterval(_npProgTimer);
    clearTimeout(_npScrollTimer);
    cancelAnimationFrame(_npScrollRaf);
}

// The card announces a NEW film automatically (handled in injectMovieLinks).
// For a live sync stream, pausing is meaningless, so instead let the user
// summon the card on demand: press 'i' (info) or click/tap the title bar.
export function initNowPlayingWatcher() {
    if (_npWatcherInit) return;
    _npWatcherInit = true;

    const toggle = () => {
        const card = document.getElementById('sc-np-card');
        if (card && card.classList.contains('sc-np-visible')) hideNowPlayingCard();
        else if (npState.data) showNowPlayingCard(npState.data, { autoHide: false });
    };

    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
        if (e.key === 'i' || e.key === 'I') toggle();
        else if (e.key === 't' || e.key === 'T') toggleTriviaCard();
    });
    // (The card opens from the title text itself — see #sc-title-text in injectMovieLinks.
    // Trivia now lives inside the card, see the #sc-np-trivia-btn wiring in showNowPlayingCard.)
}
