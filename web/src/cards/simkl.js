import { npState } from './nowplaying.js';
import { movieState } from '../metadata/tmdb.js';
import { isYouTubeMedia } from '../titleinject.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { simklEnabled, simklClientId, simklThresholdRaw } from '../store.js';
import { isTv } from '../tvdetect.js';
import { tvNavState } from '../tvnav.js';
import { openExternalUrl } from '../player/drm.js';
import { renderQrToCanvas } from '../vendor/qr.js';
import {
    simklClampThreshold, simklEsc, simklPastThreshold, simklIsHotkey, simklShouldPrompt,
    simklItemUrl, simklVerificationLink, simklTickLifetime, simklPanelPosition,
} from '../simkl/helpers.js';
import {
    simklAppVersion, simklLoadToken, simklClearToken, simklLoadPrompted, simklMarkPrompted,
    simklStartDeviceAuth, simklPollDeviceToken, simklSubmit, simklHasUsableToken,
} from '../simkl/client.js';

/* ==========================================================
   SIMKL SCROBBLE CARD — end-of-movie "log this on Simkl?" prompt.
   Ported from the sibling userscript's simkl-scrobble module.

   When a movie passes a configurable share of its runtime (default
   90%), a small card appears at the bottom-right of the video for a
   minute offering to record the watch (and an optional 1-10 rating)
   on simkl.com. Opt-in, movies only (npState.data.imdbId; YouTube
   and TV episodes are skipped), one Client ID in Settings.

   Kept light for low-end Fire Sticks: the heartbeat is one cheap
   check every 3 s that returns at once when the feature is off; the
   card's DOM exists only while it's up; no backdrop blur; nothing
   touches the network until the user presses a button.

   TV: the card takes the remote's focus when it appears (like the
   Up Next card) -- Left/Right walks the stars, OK presses, Back is
   "Not now" (tvnav.js closeTop -> simklDismiss). It remembers what
   had focus before and hands it back when it closes. Sign-in shows
   the device code plus a QR of the sign-in link to scan with a phone.
========================================================== */

const SIMKL_POLL_MS           = 3000;       // heartbeat: decides when the movie has reached the prompt point
const SIMKL_LIFE_TICK_MS      = 1000;       // countdown + reposition tick (the CSS bar transition smooths it)
const SIMKL_PANEL_LIFETIME_MS = 60 * 1000;  // how long the prompt stays up untouched
const SIMKL_SUCCESS_MS        = 6 * 1000;   // how long the "Logged" confirmation stays up
const SIMKL_EXIT_ANIM_MS      = 300;        // matches simkl.css's transition

let _panelEl = null;   // live card node, or null when closed
let _ctx     = null;   // { snap, manual, rating, view, message, remaining, lifeTotal, touched, dev, devExpiresAt, poll, already, prevFocus }
let _lifeTimer = null;

const _threshold = () => simklClampThreshold(simklThresholdRaw());

// Everything the card needs about the movie, captured once at trigger time so a queue advance while
// the card is open can't change what gets submitted.
function _snapshot() {
    const d = npState.data;
    return {
        imdbId: (d && d.imdbId) || '',
        title:  (d && d.cleanTitle) || movieState.lastMovieTitle || 'this movie',
        year:   (d && d.cleanYear) || '',
        poster: (d && d.poster) || '',
    };
}

// Normally <body>; while something is fullscreened the card must live inside that element to stay
// visible (a <video> can't hold children, so that case is skipped).
function _host() {
    const fs = document.fullscreenElement;
    return (fs && fs.tagName !== 'VIDEO') ? fs : document.body;
}

// Pins the card to the bottom-right of the video (or #videowrap, else the viewport corner). Runs every
// life tick so chat-mode / split / fullscreen changes are followed.
function _reposition() {
    if (!_panelEl) return;
    const host = _host();
    if (_panelEl.parentNode !== host) host.appendChild(_panelEl);
    const v = document.querySelector('#videowrap video');
    const wrap = document.getElementById('videowrap');
    let r = (v && v.getBoundingClientRect()) || null;
    if (!r || r.width <= 0 || r.height <= 0) r = (wrap && wrap.getBoundingClientRect()) || null;
    if (r && (r.width <= 0 || r.height <= 0)) r = null;
    const pos = simklPanelPosition(r, { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });
    _panelEl.style.setProperty('right', pos.right + 'px', 'important');
    _panelEl.style.setProperty('bottom', pos.bottom + 'px', 'important');
}

function _stars(rating) {
    let out = '';
    for (let i = 1; i <= 10; i++) {
        out += `<button type="button" class="sc-simkl-star${i <= rating ? ' on' : ''}" data-r="${i}" aria-label="Rate ${i} out of 10">★</button>`;
    }
    return out;
}

function _paintLife() {
    const bar = _panelEl && _panelEl.querySelector('.sc-simkl-life-bar');
    if (bar && _ctx) bar.style.setProperty('width', Math.max(0, Math.min(100, _ctx.remaining / _ctx.lifeTotal * 100)) + '%', 'important');
}

// The sign-in link as a tappable link (phone) or a QR to scan with a phone (TV -- there's no browser
// worth sending a remote user to).
function _signInHtml(dev) {
    const link = simklVerificationLink(dev);
    return isTv
        ? `<div class="sc-simkl-help">Scan with your phone, or go to <b>${simklEsc(link.shown)}</b> and enter:</div>
           <canvas class="sc-simkl-qr"></canvas>`
        : `<div class="sc-simkl-help">Open <a href="#" class="sc-simkl-link" data-act="signin">${simklEsc(link.shown)}</a> and enter:</div>`;
}

function _render() {
    const c = _ctx, el = _panelEl;
    if (!c || !el) return;
    // Which star (if any) held the remote's focus, so a re-render keeps the ring on the same star.
    const focusedStar = isTv && document.activeElement && el.contains(document.activeElement) && document.activeElement.dataset.r;
    const s = c.snap;
    const title = `${simklEsc(s.title)}${s.year ? ` <span class="sc-simkl-year">(${simklEsc(s.year)})</span>` : ''}`;
    const poster = s.poster
        ? `<img class="sc-simkl-poster" src="${simklEsc(s.poster)}" alt="" />`
        : '<div class="sc-simkl-poster sc-simkl-noposter">🎬</div>';
    let body = '';
    switch (c.view) {
        case 'prompt':
            body = `
                <div class="sc-simkl-q">${c.manual ? 'Log this movie on Simkl?' : 'You reached the end. Log it on Simkl?'}</div>
                <div class="sc-simkl-stars" role="group" aria-label="Optional rating">${_stars(c.rating)}</div>
                <div class="sc-simkl-rating-label">${c.rating ? c.rating + ' / 10' : 'Optional rating'}</div>
                <div class="sc-simkl-actions">
                    <button type="button" class="sc-simkl-btn sc-simkl-primary" data-act="scrobble" data-default>Log to Simkl</button>
                    <button type="button" class="sc-simkl-btn" data-act="skip">Not now</button>
                </div>
                ${simklLoadToken() ? '<a href="#" class="sc-simkl-link" data-act="disconnect">Disconnect Simkl</a>' : ''}`;
            break;
        case 'submitting':
            body = '<div class="sc-simkl-q">Logging to Simkl…</div>';
            break;
        case 'success':
            body = `
                <div class="sc-simkl-q sc-simkl-ok">${c.already ? 'Already on your Simkl history ✓' : 'Logged ✓'}</div>
                ${isTv ? '' : '<a href="#" class="sc-simkl-link" data-act="view">View on Simkl ↗</a>'}
                <div class="sc-simkl-actions"><button type="button" class="sc-simkl-btn" data-act="skip" data-default>Close</button></div>`;
            break;
        case 'notfound':
            body = `
                <div class="sc-simkl-q sc-simkl-bad">Simkl couldn't match this movie.</div>
                <div class="sc-simkl-actions"><button type="button" class="sc-simkl-btn" data-act="skip" data-default>Close</button></div>`;
            break;
        case 'error':
            body = `
                <div class="sc-simkl-q sc-simkl-bad">${simklEsc(c.message || 'Something went wrong.')}</div>
                <div class="sc-simkl-actions">
                    <button type="button" class="sc-simkl-btn sc-simkl-primary" data-act="retry" data-default>Retry</button>
                    <button type="button" class="sc-simkl-btn" data-act="skip">Close</button>
                </div>`;
            break;
        case 'connect':
            body = c.dev ? `
                <div class="sc-simkl-q">Connect your Simkl account</div>
                ${_signInHtml(c.dev)}
                <div class="sc-simkl-code">${simklEsc(c.dev.user_code)}</div>
                <div class="sc-simkl-help">Waiting for approval… <span class="sc-simkl-expiry"></span></div>
                <div class="sc-simkl-actions"><button type="button" class="sc-simkl-btn" data-act="cancelconnect" data-default>Cancel</button></div>`
                : '<div class="sc-simkl-q">Contacting Simkl…</div>';
            break;
        case 'needsconfig':
            body = `
                <div class="sc-simkl-q">Simkl isn't set up yet</div>
                <div class="sc-simkl-help">Add your Simkl Client ID in Settings → Account to log movies.</div>
                <div class="sc-simkl-actions">
                    <button type="button" class="sc-simkl-btn sc-simkl-primary" data-act="settings" data-default>Open Settings</button>
                    <button type="button" class="sc-simkl-btn" data-act="skip">Dismiss</button>
                </div>`;
            break;
        case 'nomatch':
            body = `
                <div class="sc-simkl-q">No movie matched yet</div>
                <div class="sc-simkl-help">Nothing to log yet — wait for the Now Playing card to identify the movie (YouTube videos can't be logged).</div>
                <div class="sc-simkl-actions"><button type="button" class="sc-simkl-btn" data-act="skip" data-default>Close</button></div>`;
            break;
    }
    el.innerHTML = `
        <div class="sc-simkl-row">
            ${poster}
            <div class="sc-simkl-main">
                <div class="sc-simkl-title">${title}</div>
                ${body}
            </div>
        </div>
        <div class="sc-simkl-life"><div class="sc-simkl-life-bar"></div></div>`;
    const qr = el.querySelector('.sc-simkl-qr');
    if (qr && c.dev) { try { renderQrToCanvas(qr, simklVerificationLink(c.dev).url, 4); } catch (e) { qr.remove(); } }
    _paintLife();
    _reposition();
    // innerHTML just replaced whatever held the remote's focus -- put the ring back on the same star,
    // else on this view's default button (the "submitting" view has none, so the ring waits there).
    if (isTv && c.holdsFocus) {
        const target = (focusedStar && el.querySelector(`[data-r="${focusedStar}"]`)) || el.querySelector('[data-default]');
        if (target && tvNavState.setFocus) tvNavState.setFocus(target);
    }
}

// opts.life (ms) restarts the countdown for the new view; opts.message feeds the 'error' view.
function _setView(view, opts = {}) {
    const c = _ctx;
    if (!c) return;
    c.view = view;
    c.message = opts.message || '';
    if (opts.life) { c.remaining = opts.life; c.lifeTotal = opts.life; }
    _render();
}

function _lifeTick() {
    const c = _ctx;
    if (!c || !_panelEl) return;
    // Once the viewer has touched the card, it waits for them (except the brief success toast).
    const paused = (c.touched && c.view !== 'success') || c.view === 'submitting' || c.view === 'connect';
    c.remaining = simklTickLifetime(c.remaining, SIMKL_LIFE_TICK_MS, paused);
    _reposition();
    _paintLife();
    const exp = _panelEl.querySelector('.sc-simkl-expiry');
    if (exp && c.devExpiresAt) {
        const secs = Math.max(0, Math.round((c.devExpiresAt - Date.now()) / 1000));
        exp.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    }
    if (c.remaining <= 0) _close();   // auto-dismiss: the 'shown' outcome recorded at show time stands
}

// Tears the card down. On TV, if it held the remote's focus, hands focus back to whatever had it
// before -- deferred a tick so it lands AFTER tvnav's activate() finishes its own bookkeeping for the
// OK press that closed us (it sees the overlay count drop and restores/clears focus first).
function _close(opts = {}) {
    const el = _panelEl, c = _ctx;
    if (c && c.poll) c.poll.cancelled = true;
    clearInterval(_lifeTimer); _lifeTimer = null;
    _ctx = null; _panelEl = null;
    if (el) {
        el.classList.remove('sc-simkl-in');
        el.classList.add('sc-simkl-out');
        setTimeout(() => el.remove(), SIMKL_EXIT_ANIM_MS + 50);
    }
    if (isTv && c && c.holdsFocus && !opts.keepFocus) {
        const prev = c.prevFocus;
        setTimeout(() => {
            if (!tvNavState.setFocus) return;
            if (prev && prev.isConnected && prev.getClientRects().length) tvNavState.setFocus(prev);
            else if (tvNavState.clearFocus) tvNavState.clearFocus();
        }, 0);
    }
}

// Back on the remote / Esc: same as "Not now". Returns true when a card was open.
export function simklDismiss() {
    if (!_ctx || _ctx.view === 'submitting') return !!_ctx;
    _onAction('skip');
    return true;
}

async function _beginConnect() {
    const c = _ctx;
    if (!c) return;
    _setView('connect');                                  // no c.dev yet -> "Contacting Simkl…"
    let dev;
    try { dev = await simklStartDeviceAuth(); }
    catch (e) {
        if (_ctx !== c) return;
        const message = e && e.kind === 'network' ? 'Couldn\'t reach Simkl — check your connection.'
            : 'Simkl rejected the Client ID — check it in Settings.';
        _setView('error', { message, life: SIMKL_PANEL_LIFETIME_MS });
        return;
    }
    if (_ctx !== c) return;
    c.dev = dev;
    c.devExpiresAt = Date.now() + dev.expires_in * 1000;
    c.poll = { cancelled: false };
    _setView('connect');
    const r = await simklPollDeviceToken(dev, c.poll);
    if (_ctx !== c || r === 'cancelled') return;
    c.dev = null; c.devExpiresAt = 0; c.poll = null;
    if (r === 'ok') { _beginSubmit(); return; }
    const message = r === 'expired' ? 'The code expired — try again.'
        : r === 'scope' ? 'Simkl granted read-only access — try again and approve all permissions.'
        : 'Simkl sign-in failed — check the Client ID in Settings.';
    _setView('error', { message, life: SIMKL_PANEL_LIFETIME_MS });
}

async function _beginSubmit() {
    const c = _ctx;
    if (!c) return;
    if (!simklHasUsableToken()) { _beginConnect(); return; }
    _setView('submitting');
    const out = await simklSubmit(c.snap, c.rating);
    if (_ctx !== c) return;                               // card was closed while we waited
    if (out.result === 'added' || out.result === 'exists') {
        simklMarkPrompted(c.snap.imdbId, 'scrobbled');
        c.already = out.result === 'exists';
        _setView('success', { life: SIMKL_SUCCESS_MS });
    } else if (out.result === 'not_found') {
        _setView('notfound', { life: SIMKL_PANEL_LIFETIME_MS });
    } else if (out.result === 'auth') {
        _beginConnect();
    } else {
        _setView('error', { message: 'Couldn\'t reach Simkl — try again.', life: SIMKL_PANEL_LIFETIME_MS });
    }
}

function _onAction(act) {
    const c = _ctx;
    if (!c) return;
    if (act === 'skip')          { if (!c.manual) simklMarkPrompted(c.snap.imdbId, 'skipped'); _close(); return; }
    if (act === 'settings')      { _close({ keepFocus: true }); const b = document.getElementById('sc-settings-btn'); if (b) b.click(); return; }
    if (act === 'disconnect')    { simklClearToken(); _render(); return; }
    if (act === 'view')          { openExternalUrl(simklItemUrl(c.snap.imdbId, simklClientId(), simklAppVersion())); return; }
    if (act === 'signin')        { if (c.dev) openExternalUrl(simklVerificationLink(c.dev).url); return; }
    if (act === 'cancelconnect') { if (c.poll) c.poll.cancelled = true; c.dev = null; c.devExpiresAt = 0; _setView('prompt'); return; }
    if (act === 'scrobble' || act === 'retry') { _beginSubmit(); }
}

// opts.manual = opened by the Alt+Shift+S hotkey (any time, any progress). A manual card records
// nothing in the prompted slot -- except when the movie is already past the prompt point, where it
// records 'shown' (or 'needsconfig') so the auto card doesn't re-pop 3 s after a manual dismiss.
function _show(snap, opts = {}) {
    const manual = !!opts.manual;
    const configured = !!simklClientId();
    const pastPoint = simklPastThreshold(getCurrentPlaybackSeconds(), getCurrentMediaSeconds(), _threshold());
    if (snap.imdbId && (!manual || pastPoint)) {
        simklMarkPrompted(snap.imdbId, configured ? 'shown' : 'needsconfig');   // survives reloads: no re-prompt for this movie for 12 h
    }
    const el = document.createElement('div');
    el.id = 'sc-simkl-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Log this movie on Simkl');
    _panelEl = el;
    _ctx = {
        snap, manual, rating: 0,
        view: !configured ? 'needsconfig' : (manual && !snap.imdbId) ? 'nomatch' : 'prompt', message: '',
        remaining: SIMKL_PANEL_LIFETIME_MS, lifeTotal: SIMKL_PANEL_LIFETIME_MS,
        touched: false, dev: null, devExpiresAt: 0, poll: null, already: false,
        holdsFocus: false, prevFocus: null,
    };
    el.addEventListener('click', e => {
        if (!_ctx) return;
        _ctx.touched = true;
        const star = e.target.closest('[data-r]');
        if (star) {
            const n = parseInt(star.dataset.r, 10);
            _ctx.rating = _ctx.rating === n ? 0 : n;   // press the selected star again to clear
            _render();
            return;
        }
        const a = e.target.closest('[data-act]');
        if (a) { e.preventDefault(); _onAction(a.dataset.act); }
    });
    // Remote moves between the card's own controls count as "the viewer is here" -- stop the countdown.
    el.addEventListener('focusin', () => { if (_ctx && _ctx.holdsFocus && _ctx.focusSettled) _ctx.touched = true; });
    _host().appendChild(el);
    if (isTv && tvNavState.setFocus) {
        _ctx.prevFocus = tvNavState.getFocus ? tvNavState.getFocus() : null;
        _ctx.holdsFocus = true;
    }
    _render();                                   // on TV this also lands the ring on the default button
    if (_ctx) _ctx.focusSettled = true;
    requestAnimationFrame(() => el.classList.add('sc-simkl-in'));
    _lifeTimer = setInterval(_lifeTick, SIMKL_LIFE_TICK_MS);
}

// Heartbeat: settings are poll-per-use (Save only writes localStorage), so everything is re-read here.
function _tick() {
    if (_panelEl || !simklEnabled()) return;
    const d = npState.data;
    if (!d || !d.imdbId) return;
    // Don't barge in over Settings, the Lineup screen or another card -- try again next tick.
    if (tvNavState.overlayOpen && tvNavState.overlayOpen()) return;
    const p = simklLoadPrompted();
    const configured = !!simklClientId();
    const eligible = simklShouldPrompt({
        enabled: true,
        isYouTube: isYouTubeMedia(),
        isEpisode: d.episode != null,
        imdbId: d.imdbId,
        duration: getCurrentMediaSeconds(),
        currentTime: getCurrentPlaybackSeconds(),
        thresholdPct: _threshold(),
        prompted: (p && p.outcome === 'needsconfig' && configured) ? null : p,
        now: Date.now(),
    });
    if (eligible) _show(_snapshot());
}

// Alt+Shift+S (keyboard users): opens the card for the current movie now, or closes it if open.
function _manualTrigger() {
    if (_panelEl) { _close(); return; }
    _show(_snapshot(), { manual: true });
}

export function simklBoot() {
    setInterval(_tick, SIMKL_POLL_MS);
    document.addEventListener('keydown', e => {
        if (simklIsHotkey(e) && !e.repeat && simklEnabled()) { e.preventDefault(); _manualTrigger(); return; }
        if (e.key !== 'Escape' || !_ctx) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;   // don't steal Esc from chat/settings
        simklDismiss();
    }, true);
}
