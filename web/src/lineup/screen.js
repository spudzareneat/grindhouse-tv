import { getTonightsLineup } from './data.js';
import { showNowPlayingCard } from '../cards/nowplaying.js';

/* ==========================================================
   TONIGHT'S LINEUP — full-screen TV schedule rail, opened from
   the Coming Attractions poster strip. OK on a film opens the
   existing Now-Playing card in browse mode. Registered as an
   OVERLAY_IDS-trapped overlay in tvnav.js (see that file).
========================================================== */

function ensureScreenDom() {
    let screen = document.getElementById('sc-lineup-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'sc-lineup-screen';
    screen.innerHTML = `
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <div id="sc-lineup-rail"></div>`;
    document.body.appendChild(screen);
    return screen;
}

function renderLoading(screen) {
    screen.querySelector('#sc-lineup-rail').innerHTML =
        '<div id="sc-lineup-loading">Fetching tonight\'s lineup…</div>';
}

function renderItems(screen, data) {
    const header = screen.querySelector('#sc-lineup-header');
    if (header) header.textContent = (data && data.listTitle) || 'Grindhouse Lineup';
    const rail = screen.querySelector('#sc-lineup-rail');
    const items = (data && data.items) || [];
    if (!items.length) {
        rail.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
        return;
    }
    rail.innerHTML = '';
    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sc-lineup-item' + (item.isNowPlaying ? ' sc-lineup-item-current' : '');
        btn.innerHTML = `
            <div class="sc-lineup-poster" style="${item.poster ? `background-image:url(${item.poster})` : ''}"></div>
            <div class="sc-lineup-title">${item.cleanTitle}${item.cleanYear ? ` (${item.cleanYear})` : ''}</div>
            <div class="sc-lineup-eta">${item.isNowPlaying ? 'NOW PLAYING' : (item.etaLabel || '')}</div>`;
        // Static Coming Attractions fallback posters are display-only (item.clickable === false)
        // -- they have no real title/overview to show, so OK does nothing for them.
        if (item.clickable !== false) {
            btn.addEventListener('click', () => showNowPlayingCard(item, { autoHide: false, showProgress: item.isNowPlaying }));
        }
        rail.appendChild(btn);
    });
}

// Toggles visibility SYNCHRONOUSLY (before the data fetch resolves) so tvnav.js's
// openOverlay() detects the new overlay immediately — activate()'s "did an overlay just
// open" check runs right after this function returns, with no await in between.
export function showLineupScreen() {
    const screen = ensureScreenDom();
    screen.classList.add('sc-lineup-visible');
    renderLoading(screen);
    getTonightsLineup()
        .then(data => renderItems(screen, data))
        .catch(() => { renderItems(screen, { items: [] }); });
}

export function hideLineupScreen() {
    const screen = document.getElementById('sc-lineup-screen');
    if (screen) screen.classList.remove('sc-lineup-visible');
}
