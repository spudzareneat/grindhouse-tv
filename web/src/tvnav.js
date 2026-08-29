import { isTv } from './tvdetect.js';
import { holdScrubber, wakeVideoControls } from './player/scrubber.js';
import { chromeState } from './chrome/state.js';
import { hideTriviaCard } from './cards/trivia.js';
import { hideNowPlayingCard } from './cards/nowplaying.js';
import { hideLineupScreen, stepLineupSection } from './lineup/screen.js';
import { hideUpNextCard } from './cards/upnext.js';
import { closeLinkPip } from './cards/linkpip.js';
import { closeEmotesPanel } from './cards/emotepicker.js';
import { pickDirectional } from './tvnav/geometry.js';
import { getDesyncLiveSeconds } from './mediatime.js';

// Let other UI (settings modal) place the remote's focus ring on an element.
// settings.js reads tvNavState.setFocus instead of a bare reassignable binding.
// preBackHooks: transient, non-overlay popups (e.g. the link-pip "View this?" prompt)
// that need to consume a Back press without joining the OVERLAY_IDS/overlayFocusStack
// system register a `() => boolean` here — return true to consume the press. Keeps
// tvnav.js from having to import those modules directly (they already import
// tvNavState FROM here to request focus; this avoids a circular import back).
export const tvNavState = { setFocus: null, preBackHooks: [] };

// Self-contained D-pad navigation for the /login page. None of the channel UI
// (or its CSS, or the module-level isTv) runs here, so this re-detects TV and
// injects just the focus-ring style it needs. The native layer forwards remote
// keys to window.__scTvKey(dir) exactly as it does for the channel.
export function initLoginTvNav() {
    let isTv = false;
    try { if (window.CytubeNative && CytubeNative.isTv) isTv = !!CytubeNative.isTv(); } catch (e) {}
    if (!isTv) isTv = window.screen.width >= 1280 && !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
    if (!isTv) return; // phones/keyboards navigate the form normally

    const style = document.createElement('style');
    style.textContent =
        '.sc-tv-focus{outline:3px solid #e0701a !important;outline-offset:2px !important;' +
        'box-shadow:0 0 0 5px rgba(224,112,26,0.32) !important;border-radius:5px !important;}';
    (document.head || document.documentElement).appendChild(style);

    let focusEl = null;
    const isVisible = (el) => {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const FOCUS_SEL = 'input:not([type=hidden]), button, a[href], select, textarea, [tabindex]';
    const candidates = () =>
        [...document.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter(e => !e.disabled);

    function setFocus(el) {
        if (!el) return;
        if (focusEl && focusEl !== el) focusEl.classList.remove('sc-tv-focus');
        focusEl = el;
        el.classList.add('sc-tv-focus');
        try { el.focus({ preventScroll: true }); } catch (e) {}
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }

    function move(dir) {
        const list = candidates();
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }
        const cur = focusEl.getBoundingClientRect();
        const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
        let best = null, bestScore = Infinity;
        for (const el of list) {
            if (el === focusEl) continue;
            const r = el.getBoundingClientRect();
            const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
            let primary, perp;
            if (dir === 'left')       { if (dx > -4) continue; primary = -dx; perp = Math.abs(dy); }
            else if (dir === 'right') { if (dx < 4)  continue; primary = dx;  perp = Math.abs(dy); }
            else if (dir === 'up')    { if (dy > -4) continue; primary = -dy; perp = Math.abs(dx); }
            else                      { if (dy < 4)  continue; primary = dy;  perp = Math.abs(dx); }
            const score = primary + perp * 2;
            if (score < bestScore) { bestScore = score; best = el; }
        }
        if (best) setFocus(best);
    }

    function activate() {
        if (!focusEl) { move('down'); return; }
        const tag = focusEl.tagName, type = (focusEl.type || '').toLowerCase();
        // Text-like fields: focus to open the on-screen keyboard. Everything else
        // (buttons, checkbox, submit) just clicks.
        if ((tag === 'INPUT' && !/^(checkbox|radio|submit|button|reset)$/.test(type)) || tag === 'TEXTAREA') {
            try { focusEl.focus(); } catch (e) {}
        } else {
            focusEl.click();
        }
    }

    window.__scTvKey = function (dir) {
        try {
            if (dir === 'back') {
                if (history.length > 1) history.back();
                else { try { if (window.CytubeNative && CytubeNative.tvBack) CytubeNative.tvBack(); } catch (e) {} }
                return;
            }
            if (dir === 'center') activate();
            else move(dir);
        } catch (e) { /* never let remote nav throw */ }
    };

    // Land on the first text field (or first focusable) once the form is present.
    const seed = () => {
        const l = candidates();
        if (l.length) setFocus(l.find(e => e.tagName === 'INPUT' && /^(text|password|email)$/i.test(e.type)) || l[0]);
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') seed();
    else window.addEventListener('DOMContentLoaded', seed);
}

/* ==========================================================
   TV REMOTE NAVIGATION — D-pad focus/spatial nav.
   Native forwards remote keys to window.__scTvKey(dir); we move a focus
   highlight between interactive elements and activate / close on OK / Back.
========================================================== */
export function initTvNav() {
    if (!isTv) return;
    let focusEl = null;
    let overlayFocusStack = [];

    const isVisible = (el) => {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) return false;
        if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
        const cs = getComputedStyle(el);
        // (opacity intentionally not checked — the left cluster fades in as we navigate)
        return cs.visibility !== 'hidden' && cs.display !== 'none';
    };

    // Topmost interactive overlay (poster strip excluded so its toggle stays reachable)
    const OVERLAY_IDS = ['sc-settings-overlay', 'sc-modal-overlay', 'sc-trivia-card', 'sc-users-panel', 'sc-poll-panel', 'sc-np-card', 'sc-upnext-card', 'sc-link-pip-panel', 'sc-emotes-panel', 'sc-lineup-screen'];
    const isOverlayOpen = (id, o) => !!(o && isVisible(o) &&
        (id !== 'sc-np-card' || o.classList.contains('sc-np-visible')) &&
        (id !== 'sc-upnext-card' || o.classList.contains('sc-upnext-visible')) &&
        (id !== 'sc-trivia-card' || o.classList.contains('sc-show')) &&
        (id !== 'sc-link-pip-panel' || o.classList.contains('sc-link-pip-visible')) &&
        (id !== 'sc-lineup-screen' || o.classList.contains('sc-lineup-visible')));
    const openOverlay = () => {
        for (const id of OVERLAY_IDS) {
            const o = document.getElementById(id);
            if (isOverlayOpen(id, o)) return o;
        }
        return null;
    };
    // Count of simultaneously-open OVERLAY_IDS layers (0, 1, or 2+ when nested, e.g. the
    // Now-Playing card opened from within the Lineup screen). Used by activate() to tell
    // "a new overlay opened on top" (depth increased) apart from "the topmost overlay closed
    // via its own click-to-dismiss, revealing one underneath" (depth decreased) — an identity
    // comparison of openOverlay()'s single result can't distinguish these two cases.
    const countOpenOverlays = () => {
        let n = 0;
        for (const id of OVERLAY_IDS) { if (isOverlayOpen(id, document.getElementById(id))) n++; }
        return n;
    };

    // True while "free watch" is on. Seeking the movie (scrubber + Left/Right on
    // the player) is gated on this — a synced room just snaps a seek back, so we
    // only let the remote move through the movie once sync is deliberately frozen.
    const isDesynced = () => {
        const b = document.getElementById('sc-desync-btn');
        return !!(b && b.classList.contains('sc-desync-active'));
    };

    // A video.js pop-up menu (captions / quality / etc.) that's currently open.
    // video.js marks the open menu with `vjs-lock-showing` when its button is pressed.
    // Treat it like an overlay so the remote can step through its items and Back closes it.
    const openVjsMenu = () => {
        const m = document.querySelector('#videowrap .vjs-menu.vjs-lock-showing');
        // The .vjs-menu container computes to zero height (its item list overflows
        // upward out of it), so isVisible(container) is always false — an open menu
        // is one with at least one visible item instead.
        return (m && [...m.querySelectorAll('.vjs-menu-item')].some(isVisible)) ? m : null;
    };

    // Interactive controls in the player's control bar (captions, quality, volume,
    // and — only while free-watch is on — the seek scrubber). This is how CC / quality
    // become reachable with just a remote. Anything not rendered (e.g. no captions
    // track → no captions button) simply isn't returned, so there's no empty target.
    function controlBarTargets() {
        try {
            const bar = document.querySelector('#videowrap .vjs-control-bar');
            if (!bar || !isVisible(bar)) return [];
            const allowSeek = isDesynced();
            // `button.vjs-control` only matches plain buttons (mute, fullscreen). Menu
            // buttons (CC / quality / audio) are a wrapper <div class="vjs-control
            // vjs-menu-button"> around an inner <button> that video.js explicitly
            // strips `vjs-control` from — the inner button (which holds the click
            // handler) keeps `vjs-menu-button`, so target it via that class.
            return [...bar.querySelectorAll('button.vjs-control, button.vjs-menu-button, .vjs-progress-control')].filter(c => {
                if (!isVisible(c)) return false;
                if (c.classList.contains('vjs-progress-control') && !allowSeek) return false;
                // Skip dead stops: video.js renders some controls visible but inert
                // (e.g. PiP on a TV is vjs-disabled) — focusing them goes nowhere.
                if (c.disabled || c.classList.contains('vjs-disabled')) return false;
                return true;
            });
        } catch (e) { return []; }
    }

    // 'sc-drm-open' first so it's the default focus when the DRM fallback is up; it's only a
    // candidate while the overlay exists (getElementById is null otherwise). It lives in the main
    // cluster — NOT OVERLAY_IDS — so the remote can still reach chat and the controls.
    // 'messagebuffer' (the chat log) is a real landable target, not just something
    // scrolled while some other element holds focus — see the "Chat cluster" block in
    // move() below for its Up/Down/boundary behavior.
    const MAIN_IDS = ['sc-drm-open', 'sc-title-text', 'sc-chatmode-btn', 'sc-emote-proxy', 'sc-desync-btn', 'sc-settings-btn',
        'sc-usercount-connected', 'sc-usercount-online', 'sc-poll-btn', 'sc-poster-toggle', 'sc-up-next-btn', 'sc-newmsg-pill',
        'messagebuffer', 'sc-chat-textarea'];
    // Header-row buttons that Left/Right steps between deterministically in x-order
    // while the ring is on one of them — mirrors the control bar's own x-order
    // stepping special case in move() below, rather than relying on geometric
    // nearest-neighbour scoring across a tightly-packed row.
    const CHAT_HEADER_IDS = ['sc-usercount-connected', 'sc-usercount-online', 'sc-poll-btn'];
    const FOCUS_SEL = 'button, a[href], input:not([type=hidden]), textarea, select, [tabindex]';

    const makeFocusable = (el) => {
        if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.tabIndex = -1;
    };

    function candidates() {
        // An open captions/quality menu traps focus to its items (Back closes it).
        const menu = openVjsMenu();
        if (menu) {
            const list = [...menu.querySelectorAll('.vjs-menu-item')].filter(isVisible);
            if (list.length) return { scope: menu, list };
        }
        const ov = openOverlay();
        if (ov) {
            let list = [...ov.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter(e => !e.disabled);
            if (!list.length) list = [ov]; // a click-to-dismiss overlay (e.g. the now-playing card)
            return { scope: ov, list };
        }
        const main = MAIN_IDS.map(id => document.getElementById(id)).filter(el =>
            el && isVisible(el) &&
            // The new-message pill is opacity-hidden (still sized) until shown — only
            // make it a focus target while it's actually visible.
            (el.id !== 'sc-newmsg-pill' || el.classList.contains('sc-show')));
        // Append the player's own controls so CC / quality / (free-watch) seek are
        // reachable by spatial nav alongside the app chrome.
        return { scope: document, list: main.concat(controlBarTargets()) };
    }

    // Drop the focus ring from EVERY element (not just focusEl — an overlay that
    // held focus can be torn down with its ring still applied, leaving a stale
    // highlight) and release native focus so no :focus outline lingers either.
    function clearFocus() {
        document.querySelectorAll('.sc-tv-focus').forEach(e => e.classList.remove('sc-tv-focus'));
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
        holdScrubber(false);
        focusEl = null;
    }

    // Back-from-overlay restores focus to whatever opened it (settings gear, trivia
    // button, the poster that opened the Lineup screen, ...). A stack so a nested
    // overlay (Now-Playing card opened FROM the Lineup screen) unwinds one level at a
    // time instead of jumping straight back to whatever opened the outermost one.
    function restoreFocusAfterOverlayClose() {
        const restore = overlayFocusStack.pop() || null;
        clearFocus();
        if (restore && isVisible(restore)) setFocus(restore);
    }

    function setFocus(el) {
        if (!el) return;
        makeFocusable(el);
        // Native `title` tooltips clutter the TV (and an air-mouse can pop one right
        // over what you're trying to select). The focus ring is label enough — strip
        // the title from anything the remote lands on. Phones keep their tooltips.
        if (el.hasAttribute && el.hasAttribute('title')) el.removeAttribute('title');
        // Moving the remote off the chat input reveals the player's scrubber, the
        // same way a mouse leaving chat to hover the video brings up the controls.
        if (focusEl && focusEl.id === 'sc-chat-textarea' && el.id !== 'sc-chat-textarea') wakeVideoControls();
        // Keep the scrubber pinned up while focus sits on a title-bar item OR inside
        // the player's own control bar (so captions / quality / seek stay reachable
        // instead of fading); releasing it once focus moves off lets video.js fade it.
        holdScrubber(!!(el.closest && el.closest('#videowrap-header, .video-js')));
        // Clear the ring from any previously-highlighted element before lighting the
        // new one. querySelectorAll (not just focusEl) so a stale ring can't survive.
        document.querySelectorAll('.sc-tv-focus').forEach(e => { if (e !== el) e.classList.remove('sc-tv-focus'); });
        focusEl = el;
        el.classList.add('sc-tv-focus');
        try { el.focus({ preventScroll: true }); } catch (e) {}
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
    // Let other UI (settings modal) place the remote's focus ring on an element.
    tvNavState.setFocus = setFocus;

    // Ramped seek step: index = native Android key-repeat count (0 on a fresh press,
    // auto-incrementing while Left/Right is held — see MainActivity.kt's dispatchKeyEvent).
    // Resets to the base 10s on every fresh, non-repeated press for free, since Android
    // itself resets repeatCount to 0 on each new ACTION_DOWN. Clamps past the array's end.
    const SEEK_RAMP = [10, 10, 10, 10, 30, 30, 30, 60, 60, 120];
    function seekStepSeconds(repeatCount) {
        const i = Math.max(0, Math.min(SEEK_RAMP.length - 1, repeatCount | 0));
        return SEEK_RAMP[i];
    }

    // Forward seeks (free-watch only) are capped at the room's live position -- backward
    // is uncapped (only Math.max(0, ...) below). getDesyncLiveSeconds() is null until the
    // first mediaUpdate tick lands after desync turns on (see chrome/buttons.js); don't
    // fabricate a cap in that brief window, just let the seek through uncapped.
    //
    // Takes `current` (the position BEFORE this seek) so the cap can never move playback
    // backward: local desynced playback keeps advancing in real time same as the room does,
    // so it's normal to already be sitting at/past the last-known live tick (which only
    // updates ~1x/sec) -- clamping straight to `live` in that case would yank the seek
    // *backward* below where you already were, which reads as a broken "forward" press.
    // Floor the result at `current` instead: already at/past live -> forward seeking is a
    // harmless no-op, never a step back.
    function clampForwardToLive(current, next, delta) {
        if (delta <= 0) return next;
        const live = getDesyncLiveSeconds();
        return (live != null) ? Math.max(current, Math.min(next, live)) : next;
    }

    // Seek the active player by dirSign * a ramped step (free-watch only — the caller
    // guards on isDesynced()). Works for both video.js (raw/Drive) and a bare <video>.
    function seekBy(dirSign, repeatCount) {
        const delta = dirSign * seekStepSeconds(repeatCount);
        try {
            const p = window.PLAYER && window.PLAYER.player;
            if (p && typeof p.currentTime === 'function') {
                const current = p.currentTime() || 0;
                const next = Math.max(0, current + delta);
                p.currentTime(clampForwardToLive(current, next, delta));
                wakeVideoControls();
                return;
            }
        } catch (e) {}
        const v = document.querySelector('#videowrap video');
        if (v) { try { const current = v.currentTime; v.currentTime = clampForwardToLive(current, Math.max(0, current + delta), delta); wakeVideoControls(); } catch (e) {} }
    }

    // Jump straight to the room's live position (OK on the scrubber while desynced — see
    // activate() below). A no-op if no mediaUpdate tick has landed yet this desync session
    // rather than guessing at a fake position.
    function jumpToLive() {
        const live = getDesyncLiveSeconds();
        if (live == null) return;
        try {
            const p = window.PLAYER && window.PLAYER.player;
            if (p && typeof p.currentTime === 'function') { p.currentTime(Math.max(0, live)); wakeVideoControls(); return; }
        } catch (e) {}
        const v = document.querySelector('#videowrap video');
        if (v) { try { v.currentTime = Math.max(0, live); wakeVideoControls(); } catch (e) {} }
    }

    function move(dir, repeatCount) {
        // Scrubber focused + free-watch on: Left/Right steps through the movie
        // (ramped by repeatCount) instead of moving focus. candidates() only offers the
        // scrubber while desynced, so reaching here already implies seeking is allowed.
        if (focusEl && focusEl.classList && focusEl.classList.contains('vjs-progress-control') &&
            (dir === 'left' || dir === 'right')) {
            if (isDesynced()) seekBy(dir === 'right' ? 1 : -1, repeatCount || 0);
            return;
        }
        // Left/Right are claimed for seeking above, so Down is the deliberate way off the
        // scrubber toward the docked settings/desync/chatmode row that sits directly to its
        // right (#sc-settings-btn is the nearest of the three) -- without this, Down found no
        // candidate below the bottom-anchored scrubber and was a dead end (only Up, via the
        // generic spatial-nav fallback below, reached anywhere). Falls through to that same
        // generic path if the button isn't there for some reason.
        if (focusEl && focusEl.classList && focusEl.classList.contains('vjs-progress-control') && dir === 'down') {
            const next = document.getElementById('sc-settings-btn');
            if (next && isVisible(next)) { setFocus(next); return; }
        }

        // Control bar: Left/Right steps strictly along the bar's own controls in
        // x-order. Spatial scoring is unreliable here — chrome buttons can sit a
        // hair inside the pressed direction's half-plane and steal the move, which
        // is how Right from mute ended up on the settings gear instead of CC.
        // Falls through at either end so the remote can still leave the bar. Skipped
        // while a captions/quality menu is open so the first press enters the menu
        // (candidates() scopes to its items) instead of sliding along the bar.
        if (focusEl && (dir === 'left' || dir === 'right') && !openVjsMenu()) {
            const barEls = controlBarTargets();
            if (barEls.includes(focusEl)) {
                const sorted = barEls.slice().sort((a, b) =>
                    a.getBoundingClientRect().left - b.getBoundingClientRect().left);
                const i = sorted.indexOf(focusEl);
                const ni = dir === 'right' ? i + 1 : i - 1;
                if (ni >= 0 && ni < sorted.length) { setFocus(sorted[ni]); return; }
            }
        }

        // Range slider: left/right adjusts the value instead of moving focus
        if (focusEl && focusEl.type === 'range' && (dir === 'left' || dir === 'right')) {
            const step = parseFloat(focusEl.step) || 1;
            const min = focusEl.min !== '' ? parseFloat(focusEl.min) : -Infinity;
            const max = focusEl.max !== '' ? parseFloat(focusEl.max) : Infinity;
            let v = (parseFloat(focusEl.value) || 0) + (dir === 'right' ? step : -step);
            focusEl.value = Math.max(min, Math.min(max, v));
            focusEl.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        // Tonight's Lineup: a single themed section is shown at a time (a Netflix-row-style
        // pager, not a scrollable stack) — Left/Right steps through that section's own reel
        // like the Coming Attractions strip above (items scrolled past a rail's edge are
        // off-viewport but still valid targets, so this list is NOT isVisible-filtered), while
        // Up/Down PAGES to the previous/next section via stepLineupSection(), which re-renders
        // #sc-lineup-body to show only that section and reports back the item at the same
        // column so focus lands on roughly the same poster position. This replaced an earlier
        // stacked-and-scrollable layout: the day-tab row, pinned outside the scroll region and
        // therefore always isVisible(), kept out-competing the geometrically-correct row in the
        // scorer, especially while that row was still scrolled out of view.
        const lineupScreen = document.getElementById('sc-lineup-screen');
        if (lineupScreen && lineupScreen.classList.contains('sc-lineup-visible')) {
            const rail = focusEl && focusEl.closest('.sc-lineup-rail');
            if (rail && (dir === 'left' || dir === 'right')) {
                const items = [...rail.querySelectorAll('.sc-lineup-item')];
                const i = items.indexOf(focusEl);
                const ni = dir === 'right' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
                setFocus(items[ni]);
                return;
            }
            if (rail && (dir === 'up' || dir === 'down')) {
                const items = [...rail.querySelectorAll('.sc-lineup-item')];
                const myIndex = items.indexOf(focusEl);
                const target = stepLineupSection(dir === 'down' ? 1 : -1, myIndex);
                if (target) { setFocus(target); return; }
                // No section that way (top of the pager on Up, bottom on Down) — steer back
                // to the active day tab (mirrors the Coming Attractions strip's own
                // toggle<->reel special case). Symmetric both directions: Up from the first
                // row and Down from the last row both return to the day-tab strip, so the
                // pager reads as bounded rather than falling into unpredictable spatial nav.
                const activeTab = document.querySelector('.sc-lineup-daytab-active');
                if (activeTab) { setFocus(activeTab); return; }
            }
            // The close button behaves as part of the day-tab row, not the vertical flow: it's
            // reachable via Right off the last day tab (and Left back from it), while Down from
            // either a day tab OR close skips straight to the first movie of the first row.
            const onDayRow = focusEl && (focusEl.classList.contains('sc-lineup-daytab') || focusEl.id === 'sc-lineup-close');
            if (onDayRow && dir === 'down') {
                const body = document.getElementById('sc-lineup-body');
                const firstItem = body && body.querySelector('.sc-lineup-item');
                if (firstItem) { setFocus(firstItem); return; }
            }
            if (dir === 'right' && focusEl && focusEl.classList.contains('sc-lineup-daytab')) {
                const tabs = [...document.querySelectorAll('.sc-lineup-daytab')];
                if (focusEl === tabs[tabs.length - 1]) {
                    const close = document.getElementById('sc-lineup-close');
                    if (close) { setFocus(close); return; }
                }
            }
            if (dir === 'left' && focusEl && focusEl.id === 'sc-lineup-close') {
                const tabs = [...document.querySelectorAll('.sc-lineup-daytab')];
                const lastTab = tabs[tabs.length - 1];
                if (lastTab) { setFocus(lastTab); return; }
            }
        }

        // Chat cluster: the header row, the message log, and the textarea behave as one
        // connected strip with their own Left/Right and Up/Down rules, instead of the
        // whole-page geometric scorer -- the same "special-case one bounded cluster"
        // pattern already used for the control bar's x-order stepping (above) and the
        // lineup screen's rail navigation (below). This is scoped to chat only; nothing
        // else on the page is affected, unlike a page-wide zone system.
        {
            const buf = document.getElementById('messagebuffer');
            const onHeaderBtn = focusEl && CHAT_HEADER_IDS.includes(focusEl.id);
            const onLog = focusEl && focusEl.id === 'messagebuffer';
            const onTextarea = focusEl && focusEl.id === 'sc-chat-textarea';

            // Header row: Left/Right steps deterministically in x-order between the
            // buttons rather than relying on geometric nearest-neighbour scoring across
            // a tightly-packed row (mirrors the control bar's own special case above).
            if (onHeaderBtn && (dir === 'left' || dir === 'right')) {
                const i = CHAT_HEADER_IDS.indexOf(focusEl.id);
                const step = dir === 'right' ? 1 : -1;
                for (let ni = i + step; ni >= 0 && ni < CHAT_HEADER_IDS.length; ni += step) {
                    const el = document.getElementById(CHAT_HEADER_IDS[ni]);
                    if (el && isVisible(el)) { setFocus(el); return; }
                }
                // no next button that way — fall through to normal spatial nav to leave the row
            }
            // Down from the header row enters the log; Up from the textarea enters the
            // log too ("treat the chat input as its own thing" -- Up from it goes to
            // chat, not silently past it).
            if (onHeaderBtn && dir === 'down' && buf && isVisible(buf)) { setFocus(buf); return; }
            if (onTextarea && dir === 'up' && buf && isVisible(buf)) { setFocus(buf); return; }
            // On the log itself: Up/Down scrolls first, only moving focus on to the
            // textarea (Down) or back up to the header row (Up) once already at that
            // scroll boundary (or if there's nothing to scroll at all).
            if (onLog && buf && (dir === 'up' || dir === 'down')) {
                const scrollable = buf.scrollHeight > buf.clientHeight;
                const atTop = buf.scrollTop <= 0;
                const atBottom = buf.scrollTop + buf.clientHeight >= buf.scrollHeight - 1;
                if (dir === 'down') {
                    if (scrollable && !atBottom) { buf.scrollTop += 140; return; }
                    const ta = document.getElementById('sc-chat-textarea');
                    if (ta && isVisible(ta)) { setFocus(ta); return; }
                } else {
                    if (scrollable && !atTop) { buf.scrollTop -= 140; return; }
                    const firstHeader = CHAT_HEADER_IDS.map(id => document.getElementById(id)).find(e => e && isVisible(e));
                    if (firstHeader) { setFocus(firstHeader); return; }
                }
            }
        }

        const { scope, list } = candidates();
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }

        const cur = focusEl.getBoundingClientRect();
        const idx = pickDirectional(dir, cur, list.map(el => el === focusEl ? null : el.getBoundingClientRect()));
        if (idx !== -1) { setFocus(list[idx]); return; }
        // No neighbour that way — scroll a scrollable region if we're in one
        if (dir === 'up' || dir === 'down') {
            const sc = (scope.querySelector && scope.querySelector('#sc-trivia-list, #sc-settings-modal, #sc-upnext-body, #messagebuffer')) ||
                       document.getElementById('messagebuffer');
            if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += (dir === 'down' ? 140 : -140);
        }
    }

    function activate() {
        if (!focusEl) { move('right'); return; }
        // OK on the scrubber (raw click would jump to 0 — seeking is Left/Right only, so
        // that's never let through) instead jumps to the room's live position while
        // desynced, a fast way back after scrubbing away from it.
        if (focusEl.classList && focusEl.classList.contains('vjs-progress-control')) {
            if (isDesynced()) jumpToLive();
            return;
        }
        if (focusEl.tagName === 'TEXTAREA' || focusEl.tagName === 'INPUT') {
            if (focusEl.type === 'checkbox' || focusEl.type === 'range') focusEl.click();
            else { try { focusEl.focus(); } catch (e) {} } // let the on-screen keyboard open (if not suppressed)
            return;
        }
        // Picking a captions/quality item closes the menu — hand the ring back to its
        // control-bar button so we aren't stranded on the now-hidden item. closest()
        // finds the wrapper <div>; the focus candidate is its inner <button>.
        const ownerWrap = focusEl.classList && focusEl.classList.contains('vjs-menu-item') &&
            focusEl.closest('.vjs-menu-button');
        const ownerBtn = ownerWrap && ownerWrap.querySelector('button.vjs-menu-button');
        // Remember what opened an overlay so Back can restore focus to it instead
        // of just clearing the ring (see restoreFocusAfterOverlayClose()).
        const opener = focusEl;
        const depthBefore = countOpenOverlays();
        focusEl.click();
        const depthAfter = countOpenOverlays();
        if (depthAfter > depthBefore) {
            // A new overlay layer opened on top of whatever was open before (including
            // "nothing was open") — remember what opened it so Back can restore focus here.
            overlayFocusStack.push(opener);
        } else if (depthAfter < depthBefore) {
            // The click itself closed a layer (a click-to-dismiss overlay like the
            // Now-Playing card or trivia card, closed by OK instead of Back) — restore
            // focus exactly the way Back would, popping the entry paired with whatever
            // just closed. Keeps the stack correctly paired regardless of dismiss method.
            restoreFocusAfterOverlayClose();
            return;
        }
        if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
    }

    function closeTop() {
        // Transient popups outside the OVERLAY_IDS/overlayFocusStack system (e.g. the
        // link-pip "View this?" prompt) get first crack at consuming Back.
        for (const hook of tvNavState.preBackHooks) { if (hook()) return true; }
        // Innermost first: an open captions/quality menu closes back to its button.
        const menu = openVjsMenu();
        if (menu) {
            // closest() lands on the wrapper <div>; the click handler (and our focus
            // candidate) is the inner <button>, so resolve down to it.
            const wrap = menu.closest('.vjs-menu-button');
            const btn = wrap && wrap.querySelector('button.vjs-menu-button');
            // Click the button to toggle the menu shut — keeps video.js's own
            // pressed/lock state in sync (a raw class strip would desync it and the
            // button would need two presses to reopen). Fall back to a class strip.
            if (btn) { try { btn.click(); } catch (e) { try { menu.classList.remove('vjs-lock-showing'); } catch (e2) {} } }
            else { try { menu.classList.remove('vjs-lock-showing'); } catch (e) {} }
            clearFocus();
            if (btn && isVisible(btn)) setFocus(btn); // keep our place on the control bar
            return true;
        }
        const settings = document.getElementById('sc-settings-overlay');
        if (settings && isVisible(settings)) {
            const c = document.getElementById('sc-settings-cancel');
            if (c) c.click(); else settings.remove();
            restoreFocusAfterOverlayClose(); return true;
        }
        const modal = document.getElementById('sc-modal-overlay');
        if (modal && isVisible(modal)) { (document.getElementById('sc-btn-cancel') || { click() { modal.remove(); } }).click(); restoreFocusAfterOverlayClose(); return true; }
        const trivia = document.getElementById('sc-trivia-card');
        if (trivia && trivia.classList.contains('sc-show')) { hideTriviaCard(); restoreFocusAfterOverlayClose(); return true; }
        const np = document.getElementById('sc-np-card');
        if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); restoreFocusAfterOverlayClose(); return true; }
        const upNext = document.getElementById('sc-upnext-card');
        if (upNext && upNext.classList.contains('sc-upnext-visible')) { hideUpNextCard(); restoreFocusAfterOverlayClose(); return true; }
        const linkPip = document.getElementById('sc-link-pip-panel');
        if (linkPip && linkPip.classList.contains('sc-link-pip-visible')) { closeLinkPip(); restoreFocusAfterOverlayClose(); return true; }
        const emotes = document.getElementById('sc-emotes-panel');
        if (emotes && isVisible(emotes)) { closeEmotesPanel(); restoreFocusAfterOverlayClose(); return true; }
        const lineup = document.getElementById('sc-lineup-screen');
        if (lineup && lineup.classList.contains('sc-lineup-visible')) { hideLineupScreen(); restoreFocusAfterOverlayClose(); return true; }
        for (const id of ['sc-users-panel', 'sc-poll-panel']) {
            const p = document.getElementById(id);
            if (p && isVisible(p)) { p.style.display = 'none'; restoreFocusAfterOverlayClose(); return true; }
        }
        return false;
    }

    function revealChrome() {
        // Reveal the left cluster WITH an auto-hide timer (re-armed on every remote
        // press) so it fades back out a few seconds after navigation stops. Raw
        // classList.add left it stuck on, since remote keys don't fire DOM events.
        if (typeof chromeState.leftZoneReveal === 'function') chromeState.leftZoneReveal(4000);
        else document.body.classList.add('sc-leftzone');
        if (typeof chromeState.chromeWake === 'function') chromeState.chromeWake();
        else document.body.classList.remove('sc-chrome-hidden');
        if (typeof chromeState.topBarWake === 'function') chromeState.topBarWake();
    }

    window.__scTvKey = function (dir, repeatCount) {
        try {
            if (dir === 'back') {
                if (!closeTop()) { try { if (window.CytubeNative && CytubeNative.tvBack) CytubeNative.tvBack(); } catch (e) {} }
                return;
            }
            revealChrome();
            if (dir === 'center') activate();
            else move(dir, repeatCount || 0);
        } catch (e) { /* never let remote nav throw */ }
    };
}
