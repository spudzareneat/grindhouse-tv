import { getTonightsLineup } from './data.js';
import { showNowPlayingCard } from '../cards/nowplaying.js';

/* ==========================================================
   TONIGHT'S LINEUP — full-screen TV schedule, opened from the Coming
   Attractions poster strip. Friday/Saturday/Sunday day tabs switch which
   day's themed sections are shown; each section is its own horizontal rail
   (like the old single-rail version, just one per section now). OK on a
   film opens the existing Now-Playing card in browse mode. Registered as an
   OVERLAY_IDS-trapped overlay in tvnav.js (see that file), which also scopes
   Left/Right rail-stepping to whichever .sc-lineup-rail contains focus.
========================================================== */

const ASSET_BASE = 'file:///android_asset/lineup-sections/';
const DEFAULT_ART = ASSET_BASE + '_default.jpg';

let _lastData = null;   // most recent getTonightsLineup() result, so day-tab switches don't refetch
let _activeDay = null;  // currently selected day name

function ensureScreenDom() {
    let screen = document.getElementById('sc-lineup-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'sc-lineup-screen';
    screen.innerHTML = `
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <nav id="sc-lineup-daytabs"></nav>
        <div id="sc-lineup-body"></div>`;
    document.body.appendChild(screen);
    return screen;
}

function renderLoading(screen) {
    screen.querySelector('#sc-lineup-daytabs').innerHTML = '';
    screen.querySelector('#sc-lineup-body').innerHTML =
        '<div id="sc-lineup-loading">Fetching tonight’s lineup…</div>';
}

function itemButton(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-lineup-item'
        + (item.isNowPlaying ? ' sc-lineup-item-current' : '')
        + (item.clickable === false ? ' sc-lineup-item-static' : '');
    const titleText = `${item.cleanTitle}${item.cleanYear ? ` (${item.cleanYear})` : ''}`;
    const etaText = item.isNowPlaying ? 'NOW PLAYING' : (item.etaLabel || '');
    // Titles are shown IN the poster box only when there's no art to identify the film by
    // (see .sc-lineup-poster-fallback) -- when real poster art is present, no title text is
    // shown at all; OK still opens the Now-Playing card with the full title if needed.
    btn.innerHTML = `
        <div class="sc-lineup-poster" style="${item.poster ? `background-image:url(${item.poster})` : ''}">
            ${!item.poster ? `<div class="sc-lineup-poster-fallback">${titleText}</div>` : ''}
            ${etaText ? `<div class="sc-lineup-eta">${etaText}</div>` : ''}
        </div>`;
    // Static Coming Attractions fallback posters are display-only (item.clickable === false)
    // -- they have no real title/overview to show, so OK does nothing for them.
    if (item.clickable !== false) {
        btn.addEventListener('click', () => showNowPlayingCard(item, { autoHide: false, showProgress: item.isNowPlaying }));
    }
    return btn;
}

function sectionEl(section) {
    const el = document.createElement('div');
    el.className = 'sc-lineup-section';
    const art = section.slug ? `${ASSET_BASE}${section.slug}.jpg` : DEFAULT_ART;
    el.style.backgroundImage = `url('${art}')`;
    // Named theme sections repeat every week (same 9 names), so their art is a
    // bundled Android asset (app/src/main/assets/lineup-sections/), not fetched --
    // any not-yet-added or unrecognized section name falls back to _default.jpg.
    const probe = new Image();
    probe.onerror = () => { el.style.backgroundImage = `url('${DEFAULT_ART}')`; };
    probe.src = art;
    if (section.name) {
        const name = document.createElement('div');
        name.className = 'sc-lineup-section-name';
        name.textContent = section.name;
        el.appendChild(name);
    }
    const rail = document.createElement('div');
    rail.className = 'sc-lineup-rail';
    section.items.forEach(item => rail.appendChild(itemButton(item)));
    el.appendChild(rail);
    return el;
}

function renderDayTabs(screen, days) {
    const tabs = screen.querySelector('#sc-lineup-daytabs');
    tabs.innerHTML = '';
    days.forEach((d) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sc-lineup-daytab' + (d.day === _activeDay ? ' sc-lineup-daytab-active' : '');
        btn.textContent = d.day;
        btn.addEventListener('click', () => showDay(screen, d.day));
        tabs.appendChild(btn);
    });
}

function renderBody(screen, days) {
    const body = screen.querySelector('#sc-lineup-body');
    body.innerHTML = '';
    const day = days.find(d => d.day === _activeDay) || days[0];
    if (!day || !day.sections.length) {
        body.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
        return;
    }
    day.sections.forEach(section => body.appendChild(sectionEl(section)));
}

function showDay(screen, day) {
    _activeDay = day;
    const tabs = [...screen.querySelectorAll('.sc-lineup-daytab')];
    tabs.forEach(t => t.classList.toggle('sc-lineup-daytab-active', t.textContent === day));
    renderBody(screen, _lastData.days);
}

// Degraded view when Reddit is unreachable: the current title (if known) plus the
// static Coming Attractions art, as one flat rail -- no tabs, no sections, since
// there's no real day/section structure to show in this mode.
function renderFallback(screen, data) {
    screen.querySelector('#sc-lineup-daytabs').innerHTML = '';
    const body = screen.querySelector('#sc-lineup-body');
    body.innerHTML = '';
    const items = (data.days && data.days[0] && data.days[0].sections[0] && data.days[0].sections[0].items) || [];
    if (!items.length) {
        body.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
        return;
    }
    const section = document.createElement('div');
    section.className = 'sc-lineup-section sc-lineup-section-fallback';
    const rail = document.createElement('div');
    rail.className = 'sc-lineup-rail';
    items.forEach(item => rail.appendChild(itemButton(item)));
    section.appendChild(rail);
    body.appendChild(section);
}

function renderItems(screen, data) {
    const header = screen.querySelector('#sc-lineup-header');
    if (header) header.textContent = (data && data.listTitle) || 'Grindhouse Lineup';
    _lastData = data;
    if (!data || data.fallback) { renderFallback(screen, data || { days: [] }); return; }
    const days = data.days || [];
    if (!_activeDay || !days.some(d => d.day === _activeDay)) {
        _activeDay = (days.find(d => d.isToday) || days[0] || {}).day || null;
    }
    renderDayTabs(screen, days);
    renderBody(screen, days);
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
        .catch(() => { renderItems(screen, { fallback: true, days: [] }); });
}

export function hideLineupScreen() {
    const screen = document.getElementById('sc-lineup-screen');
    if (screen) screen.classList.remove('sc-lineup-visible');
}
