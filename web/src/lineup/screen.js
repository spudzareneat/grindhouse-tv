import { getTonightsLineup } from './data.js';
import { showNowPlayingCard } from '../cards/nowplaying.js';
import { getSectionTheme, ensureThemeFontsLoaded } from './sectionThemes.js';
import { isTv } from '../tvdetect.js';

/* ==========================================================
   TONIGHT'S LINEUP — full-screen schedule, opened from the Coming Attractions
   toggle on every platform. Friday/Saturday/Sunday day tabs switch which day
   is shown. Within a day:
     - TV: one themed section's rail fills the screen at a time -- Up/Down
       PAGES between sections (a Netflix-row feel without scrolling),
       driven by tvnav.js's D-pad handling via stepLineupSection().
     - Phone/tablet: all of the day's sections render stacked, and native
       touch-scroll moves between them (no swipe/gesture code -- this
       codebase has none, so scrolling is the one interaction pattern
       already proven elsewhere, e.g. the trivia card's list).
   OK/tap on a film opens the existing Now-Playing card in browse mode.
   Registered as an OVERLAY_IDS-trapped overlay in tvnav.js for TV; the
   close button (below) is how every platform without a Back key closes it.
========================================================== */

let _lastData = null;          // most recent getTonightsLineup() result, so paging doesn't refetch
let _activeDay = null;         // currently selected day name
let _activeSectionIndex = 0;   // currently shown section within _activeDay

function ensureScreenDom() {
    ensureThemeFontsLoaded();
    let screen = document.getElementById('sc-lineup-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'sc-lineup-screen';
    screen.innerHTML = `
        <button id="sc-lineup-close" type="button">✕</button>
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <nav id="sc-lineup-daytabs"></nav>
        <div id="sc-lineup-body"></div>`;
    screen.querySelector('#sc-lineup-close').addEventListener('click', hideLineupScreen);
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
        + (item.played ? ' sc-lineup-item-played' : '')
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

// One section's grouping, sized to fill the screen on its own. Named theme sections repeat
// every week (a slow-changing, closed set), so each gets its own Google Font + accent color
// (see sectionThemes.js) tying its header and background together, rather than per-section art.
function sectionEl(section) {
    const el = document.createElement('div');
    el.className = 'sc-lineup-section';
    const theme = getSectionTheme(section.slug);
    el.style.setProperty('--sc-lineup-wash', theme.wash);
    if (section.name) {
        const name = document.createElement('div');
        name.className = 'sc-lineup-section-name';
        name.style.setProperty('color', theme.color, 'important');
        if (theme.font) name.style.setProperty('font-family', `${theme.font}, cursive`, 'important');
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
    if (isTv) {
        // TV: one section fills the screen at a time (stepLineupSection() pages between them).
        if (_activeSectionIndex >= day.sections.length) _activeSectionIndex = 0;
        body.appendChild(sectionEl(day.sections[_activeSectionIndex]));
    } else {
        // Phone/tablet: every section stacked, native scroll moves between them.
        day.sections.forEach(section => body.appendChild(sectionEl(section)));
    }
}

function showDay(screen, day) {
    _activeDay = day;
    _activeSectionIndex = 0; // switching days always lands on that day's first section
    const tabs = [...screen.querySelectorAll('.sc-lineup-daytab')];
    tabs.forEach(t => t.classList.toggle('sc-lineup-daytab-active', t.textContent === day));
    renderBody(screen, _lastData.days);
}

// Moves the shown section by `delta` (-1/+1), preserving the film column the caller was on
// (clamped to the new section's length) so Up/Down lands on roughly the same poster position.
// Returns the newly focused item element, or null if there's no section that way (caller
// decides what to do at the boundary -- e.g. steer to the day tab row).
export function stepLineupSection(delta, columnIndex) {
    if (!_lastData || _lastData.fallback) return null;
    const days = _lastData.days || [];
    const day = days.find(d => d.day === _activeDay) || days[0];
    if (!day) return null;
    const newIndex = _activeSectionIndex + delta;
    if (newIndex < 0 || newIndex >= day.sections.length) return null;
    _activeSectionIndex = newIndex;
    const screen = document.getElementById('sc-lineup-screen');
    renderBody(screen, days);
    const rail = screen.querySelector('.sc-lineup-rail');
    if (!rail) return null;
    const items = [...rail.querySelectorAll('.sc-lineup-item')];
    return items[Math.min(columnIndex, items.length - 1)] || null;
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
    // Recomputed fresh on every open (not just when _activeDay is unset) so a manual tab
    // switch from a PRIOR open doesn't linger -- opening the screen always starts back on
    // today's day (or the first day, before the weekend starts).
    _activeDay = (days.find(d => d.isToday) || days[0] || {}).day || null;
    _activeSectionIndex = 0;
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
