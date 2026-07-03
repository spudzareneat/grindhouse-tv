import { getCurrentMediaSeconds, getCurrentPlaybackSeconds, formatHMS } from '../mediatime.js';
import { movieState } from '../metadata/tmdb.js';
import { isTv } from '../tvdetect.js';
import { showTriviaCard, toggleTriviaCard } from './trivia.js';

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

// Currently TV-only so the tuned mobile layout is untouched.
// Flip to `true` to enable the card on phones too.
export function _npCardEnabled() { return isTv; }

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
                </div>
            </div>`;
        document.body.appendChild(card);
        // Tapping/clicking the card dismisses it
        card.addEventListener('click', hideNowPlayingCard);
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

    card.querySelector('#sc-np-title').textContent = title + year;
    card.querySelector('#sc-np-overview').textContent = data.overview || '';

    const metaParts = [];
    if (data.rating)  metaParts.push(`⭐ ${data.rating}`);
    if (data.runtime) metaParts.push(`${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`);
    if (data.genres && data.genres.length) metaParts.push(data.genres.slice(0, 3).join(' · '));
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

    // Live elapsed / total / remaining bar — refreshes while the card is up.
    // This is the remote-friendly stand-in for hovering a scrubber: summon the
    // card (title button / 'i') and the progress updates in place.
    _renderNpProgress();
    clearInterval(_npProgTimer);
    _npProgTimer = setInterval(_renderNpProgress, 500);

    // Reveal a long synopsis by gliding to its bottom after a few seconds.
    const revealMs = _autoScrollOverview();

    clearTimeout(_npHideTimer);
    if (opts.autoHide) {
        // Only auto-hide if the video is actually playing
        const v = document.querySelector('#videowrap video');
        const playing = v && !v.paused;
        // Stay up long enough to finish revealing a long description (+ a tail to read it).
        if (playing || !v) _npHideTimer = setTimeout(hideNowPlayingCard, Math.max(7000, revealMs + 2500));
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

    // Click/tap the title bar opens the card; inject a small Trivia button too.
    const bindTitle = () => {
        const h = document.getElementById('videowrap-header');
        if (!h) return;
        // (The card opens from the title text itself — see #sc-title-text in injectMovieLinks.)
        // Small "Trivia" button next to the title (only once we have a movie with IMDb id)
        if (npState.data && npState.data.imdbId && !document.getElementById('sc-trivia-btn')) {
            const btn = document.createElement('button');
            btn.id = 'sc-trivia-btn'; btn.type = 'button'; btn.textContent = 'Trivia';
            btn.addEventListener('click', (e) => { e.stopPropagation(); showTriviaCard(); });
            // If the top bar is already faded when we (re)create the button, match
            // that state immediately. Otherwise it pops in at full opacity and only
            // fades on the next wake→dim cycle — i.e. you'd have to wave the cursor
            // over it to make it disappear.
            if (document.body.classList.contains('sc-video-dimmed')) btn.classList.add('sc-bar-dim');
            h.appendChild(btn);
        }
    };
    bindTitle();
    new MutationObserver(bindTitle).observe(document.body, { childList: true, subtree: true });
}
