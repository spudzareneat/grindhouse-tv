import { fetchImdbTrivia } from '../metadata/imdb.js';
import { episodeTag } from '../parse.js';
import { npState } from './nowplaying.js';
import { isTv } from '../tvdetect.js';
import { tpStarFills } from '../trivia/curated.js';
import { fetchCuratedTrivia, fetchDriveInCard } from '../trivia/sources.js';

/* ==========================================================
   TRIVIA CARD — scrollable trivia, summoned by 't' or the title button.
   Sections, top to bottom: curated Pop-up Video facts (with their
   timestamp, headshot, byline and source), Joe Bob's Drive-In Totals
   (phone only -- on TV the animated card plays over the movie instead,
   see cards/driveincard.js), then IMDb's own trivia. Curated and Drive-In
   data come from the same cached fetches the pop-up bubbles use.
========================================================== */
function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const _attr = s => _escHtml(s).replace(/"/g, '&quot;');

function _fmtTime(sec) {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// image / sourceUrl were already allowlisted by tpValidateCurated (IMDb CDN
// only / plain http(s) with no quotes or brackets); escaped here as well.
// Off-site links open in the user's browser (MainActivity.shouldOverrideUrlLoading).
function _curatedItemHtml(f) {
    const face = f.image ? `<img class="sc-trivia-face" src="${_attr(f.image)}" alt="">` : '';
    const by = f.byline ? ` <span class="sc-trivia-by">— ${_escHtml(f.byline)}</span>` : '';
    const src = f.sourceUrl ? ` <a class="sc-trivia-src" href="${_attr(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">source</a>` : '';
    return `<div class="sc-trivia-item sc-trivia-curated"><span class="sc-trivia-time">${_fmtTime(f.t)}</span>${face}${_escHtml(f.text)}${by}${src}</div>`;
}

const STAR_PATH = 'M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.4 7.1L12 17.6l-6.3 3.6 1.4-7.1L1.8 9.2l7.1-.8z';
function _starSvg(fill, k) {
    const id = `sc-trivia-star-clip-${k}`;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><rect x="0" y="0" width="${24 * fill}" height="24"/></clipPath></defs>`
        + `<path d="${STAR_PATH}" fill="none" stroke="#f5d76e" stroke-width="1.4"/>`
        + `<path d="${STAR_PATH}" fill="#f5d76e" clip-path="url(#${id})"/></svg>`;
}

// Joe Bob's counts, star rating + sign-off, then any Drive-In Academy Award
// nominations -- the same content the TV card animates, as a static list.
function _driveInHtml(card) {
    let html = '<div class="sc-trivia-section">Drive-In Totals</div><div class="sc-trivia-item sc-trivia-drivein">'
        + `<ul class="sc-trivia-di-lines">${card.lines.map(l => `<li>${_escHtml(l)}</li>`).join('')}</ul>`;
    if (card.stars !== null || card.says) {
        html += '<div class="sc-trivia-di-verdict">'
            + (card.stars !== null ? `<span class="sc-trivia-di-stars">${tpStarFills(card.stars).map(_starSvg).join('')}</span>` : '')
            + (card.says ? `<span class="sc-trivia-di-says">${_escHtml(card.says)}</span>` : '')
            + '</div>';
    }
    if (card.awards && card.awards.length) {
        html += '<div class="sc-trivia-di-awards-h">Drive-In Academy Award Nominations</div>'
            + `<ul class="sc-trivia-di-awards">${card.awards.map(a => `<li>${_escHtml(a)}</li>`).join('')}</ul>`;
    }
    return html + '</div>';
}

export function showTriviaCard() {
    const tconst = npState.data && npState.data.imdbId;
    if (!tconst) return;
    let card = document.getElementById('sc-trivia-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'sc-trivia-card';
        card.innerHTML = `
            <div id="sc-trivia-panel">
                <div id="sc-trivia-head">
                    <span id="sc-trivia-title">Trivia</span>
                    <button id="sc-trivia-close" type="button">✕</button>
                </div>
                <div id="sc-trivia-list"></div>
            </div>`;
        document.body.appendChild(card);
        card.addEventListener('click', e => { if (e.target === card) hideTriviaCard(); });
        card.querySelector('#sc-trivia-close').addEventListener('click', hideTriviaCard);
    }
    // Episode-specific trivia (imdbId is switched to the episode's own tconst in
    // lookupMovie) — the header names the episode so it's clear which the facts
    // below belong to.
    const d = npState.data;
    const epTag = episodeTag(d.season, d.episode);
    card.querySelector('#sc-trivia-title').textContent =
        'Trivia' + (d.cleanTitle ? ' — ' + d.cleanTitle
            + (epTag ? ` · ${epTag}` : '') + (d.episodeName ? ` — ${d.episodeName}` : '') : '');
    const list = card.querySelector('#sc-trivia-list');
    list.innerHTML = '<div class="sc-trivia-item">Loading…</div>';
    card.classList.add('sc-show');
    Promise.all([
        fetchCuratedTrivia(tconst).catch(() => null),
        isTv ? Promise.resolve(null) : fetchDriveInCard(tconst).catch(() => null),
        fetchImdbTrivia(tconst).catch(() => null),
    ]).then(([curated, driveIn, items]) => {
        if (!document.getElementById('sc-trivia-card')) return;
        if ((npState.data && npState.data.imdbId) !== tconst) return; // movie changed while loading
        const facts = curated && curated.facts;
        let html = '';
        if (facts && facts.length) {
            html += `<div class="sc-trivia-section">Pop-up Video trivia (${facts.length})</div>`
                + facts.map(_curatedItemHtml).join('');
        }
        if (driveIn) html += _driveInHtml(driveIn);
        if (items && items.length) {
            if (html) html += `<div class="sc-trivia-section">IMDb trivia (${items.length})</div>`;
            html += items.map(t => `<div class="sc-trivia-item">${_escHtml(t)}</div>`).join('');
        }
        list.innerHTML = html || '<div class="sc-trivia-item">No trivia found.</div>';
        list.querySelectorAll('img.sc-trivia-face').forEach(img => img.addEventListener('error', () => img.remove()));
        list.scrollTop = 0;
    });
}
export function hideTriviaCard() {
    const card = document.getElementById('sc-trivia-card');
    if (card) card.classList.remove('sc-show');
}
export function toggleTriviaCard() {
    const card = document.getElementById('sc-trivia-card');
    if (card && card.classList.contains('sc-show')) hideTriviaCard();
    else showTriviaCard();
}
