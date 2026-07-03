import { fetchImdbTrivia } from '../metadata/imdb.js';
import { npState } from './nowplaying.js';

/* ==========================================================
   TRIVIA CARD — scrollable IMDb trivia, summoned by 't' or the title button
========================================================== */
function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
    card.querySelector('#sc-trivia-title').textContent =
        'Trivia' + (npState.data.cleanTitle ? ' — ' + npState.data.cleanTitle : '');
    const list = card.querySelector('#sc-trivia-list');
    list.innerHTML = '<div class="sc-trivia-item">Loading…</div>';
    card.classList.add('sc-show');
    fetchImdbTrivia(tconst).then(items => {
        if (!document.getElementById('sc-trivia-card')) return;
        if (!items || !items.length) { list.innerHTML = '<div class="sc-trivia-item">No trivia found.</div>'; return; }
        list.innerHTML = items.map(t => `<div class="sc-trivia-item">${_escHtml(t)}</div>`).join('');
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
