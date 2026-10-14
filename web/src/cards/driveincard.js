import { tpStarFills } from '../trivia/curated.js';

/* ==========================================================
   DRIVE-IN TOTALS CARD — MonsterVision-style: transparent over the
   picture, "Drive-In Totals" header, Joe Bob's counts rolling in one at a
   time (long lists scroll, oldest off the top), then his star rating and
   sign-off, then -- if he handed any out -- a "Drive-In Academy Award
   Nominations" slide, one nominee per line. No fixed length: it stays until
   every line has shown and the last slide has held.

   Ported from the PC userscript's trivia-popup module. TV only -- on a
   phone the picture is too small for it, so the same data is listed in the
   Trivia card instead (cards/trivia.js). Scheduled by cards/triviapopup.js;
   bubbles wait while it's up (isDriveInCardUp).
========================================================== */

function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const CARD_MS = { header: 1200, line: 1500, pause: 1200, clear: 600, starStart: 150, star: 280, says: 300, hold: 6000, fade: 800,
    // Academy Award slide: the verdict holds `verdictHold` first, then the
    // header swaps; each nominee stays up long enough to read (`awardCharMs`
    // per character, never less than `line`, at most `awardLineMax`), then
    // the slide holds `awardHold`.
    verdictHold: 4000, swap: 600, awardCharMs: 55, awardLineMax: 8000, awardHold: 10000 };
const CARD_FONT_LINK_ID = 'sc-tp-card-font';
const STAR_PATH = 'M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.4 7.1L12 17.6l-6.3 3.6 1.4-7.1L1.8 9.2l7.1-.8z';
let _cardEl = null;
let _cardTimers = [];
let _onHidden = null;

export const isDriveInCardUp = () => !!_cardEl;

// Patua One: free stand-in for ITC La Bamba, MonsterVision's face. Loaded on
// first use; Georgia until it arrives.
function _ensureCardFont() {
    if (document.getElementById(CARD_FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = CARD_FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Patua+One&display=swap';
    document.head.appendChild(link);
}

// The on-screen rectangle the movie picture occupies, letterbox bars
// excluded (object-fit: contain). Falls back to #videowrap, then the viewport.
export function pictureRect() {
    const v = document.querySelector('#videowrap video');
    const r = v && v.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0 && v.videoWidth > 0 && v.videoHeight > 0) {
        const scale = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
        const picW = v.videoWidth * scale, picH = v.videoHeight * scale;
        return { left: r.left + (r.width - picW) / 2, top: r.top + (r.height - picH) / 2, width: picW, height: picH };
    }
    const wrap = document.getElementById('videowrap');
    const wr = wrap && wrap.getBoundingClientRect();
    if (wr && wr.width > 0 && wr.height > 0) return { left: wr.left, top: wr.top, width: wr.width, height: wr.height };
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function _starSvg(fill, k) {
    const id = `sc-tp-star-clip-${k}`;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><rect x="0" y="0" width="${24 * fill}" height="24"/></clipPath></defs>`
        + `<path d="${STAR_PATH}" fill="rgba(20,20,20,.35)" stroke="#f5d76e" stroke-width="1.2"/>`
        + `<path d="${STAR_PATH}" fill="#f5d76e" stroke="#7a5a10" stroke-width=".6" clip-path="url(#${id})"/></svg>`;
}

function _later(ms, fn) { _cardTimers.push(setTimeout(fn, ms)); }

// onHidden fires once the card is fully gone (after its fade), so the
// scheduler can restart its gap clock then.
export function showDriveInCard(card, onHidden) {
    hideDriveInCard(true);
    _ensureCardFont();
    _onHidden = onHidden || null;
    // Top-right corner of the actual picture, sized from it (fonts too) so it
    // reads the same in any layout.
    const P = pictureRect();
    const el = document.createElement('div');
    el.id = 'sc-tp-card';
    el.style.setProperty('left', (P.left + P.width * 0.59) + 'px', 'important');
    el.style.setProperty('top', (P.top + P.height * 0.01) + 'px', 'important');
    el.style.setProperty('width', (P.width * 0.40) + 'px', 'important');
    el.style.setProperty('--sc-tp-head', Math.max(18, P.height * 0.09) + 'px');
    el.style.setProperty('--sc-tp-line', Math.max(12, P.height * 0.046) + 'px');
    const awards = card.awards || [];
    el.innerHTML = `
        <div class="sc-tp-card-h">Drive-In<br>Totals</div>
        <div class="sc-tp-card-rule"></div>
        <div class="sc-tp-card-lines"><div class="sc-tp-card-track"></div></div>
        <div class="sc-tp-card-verdict">
            ${card.stars !== null ? `<div class="sc-tp-card-stars">${tpStarFills(card.stars).map(_starSvg).join('')}</div>` : ''}
            <div class="sc-tp-card-says">${_escHtml(card.says)}</div>
        </div>`;
    document.body.appendChild(el);
    _cardEl = el;
    const linesEl = el.querySelector('.sc-tp-card-lines');
    const track = el.querySelector('.sc-tp-card-track');

    requestAnimationFrame(() => el.classList.add('sc-tp-card-on'));
    const addLine = text => {
        const line = document.createElement('div');
        line.className = 'sc-tp-card-line';
        line.textContent = text;
        track.appendChild(line);
        requestAnimationFrame(() => line.classList.add('sc-tp-card-in'));
        // Fill top-down; once full, roll the oldest lines off the top.
        const over = track.offsetHeight - linesEl.clientHeight;
        if (over > 0) {
            linesEl.classList.add('sc-tp-card-scrolling');
            track.style.setProperty('transform', `translateY(${-over}px)`, 'important');
        }
    };
    let t = CARD_MS.header;
    for (const text of card.lines) {
        _later(t, () => addLine(text));
        t += CARD_MS.line;
    }
    if (card.stars !== null || card.says) {
        t += CARD_MS.pause;
        _later(t, () => linesEl.classList.add('sc-tp-card-gone'));
        t += CARD_MS.clear;
        const verdict = el.querySelector('.sc-tp-card-verdict');
        _later(t, () => verdict.classList.add('sc-tp-card-on'));
        const stars = el.querySelectorAll('.sc-tp-card-stars svg');
        stars.forEach((s, k) => _later(t + CARD_MS.starStart + k * CARD_MS.star, () => s.classList.add('sc-tp-card-in')));
        t += CARD_MS.starStart + stars.length * CARD_MS.star + CARD_MS.says;
        const says = el.querySelector('.sc-tp-card-says');
        _later(t, () => says.classList.add('sc-tp-card-on'));
    }
    if (awards.length) {
        // Its own slide: verdict out, header becomes "Drive-In Academy Award
        // Nominations", the count area is reused for the nominees.
        t += CARD_MS.verdictHold;
        const head = el.querySelector('.sc-tp-card-h');
        const verdict = el.querySelector('.sc-tp-card-verdict');
        _later(t, () => {
            head.classList.add('sc-tp-card-swap');
            verdict.classList.remove('sc-tp-card-on');
            linesEl.classList.add('sc-tp-card-gone');
        });
        t += CARD_MS.swap;
        _later(t, () => {
            head.innerHTML = 'Drive-In Academy<br>Award Nominations';
            el.classList.add('sc-tp-card-awards');
            track.textContent = '';
            track.style.setProperty('transform', 'none', 'important');
            linesEl.classList.remove('sc-tp-card-scrolling', 'sc-tp-card-gone');
            head.classList.remove('sc-tp-card-swap');
        });
        t += CARD_MS.header;
        for (const text of awards) {
            _later(t, () => addLine(text));
            t += Math.min(CARD_MS.awardLineMax, Math.max(CARD_MS.line, text.length * CARD_MS.awardCharMs));
        }
        t += CARD_MS.awardHold - CARD_MS.hold;
    }
    t += CARD_MS.hold;
    _later(t, () => hideDriveInCard(false));
}

// _cardEl stays set through the fade, so bubbles wait until it's gone.
export function hideDriveInCard(instant) {
    _cardTimers.forEach(clearTimeout);
    _cardTimers = [];
    if (!_cardEl) return;
    const el = _cardEl;
    const done = () => {
        el.remove();
        if (_cardEl === el) {
            _cardEl = null;
            const cb = _onHidden; _onHidden = null;
            if (cb) cb();
        }
    };
    if (instant) { done(); return; }
    el.classList.add('sc-tp-card-out');
    _cardTimers.push(setTimeout(done, CARD_MS.fade));
}
