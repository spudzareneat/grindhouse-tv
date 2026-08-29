import { openLinkPip, isPipLink } from '../cards/linkpip.js';
import { tvNavState } from '../tvnav.js';

/* ==========================================================
   LINK PIP DETECTION + CONFIRM POPUP
   Ported from the desktop userscript's link-pip module, but remote-first:
   instead of a click-to-activate ↗ icon next to the link, a qualifying
   YouTube link arriving in a NEW chat message pops an auto-focused,
   auto-dismissing "View this?" pill. OK opens the floating panel
   (cards/linkpip.js); Back or a timeout dismisses with no action.
========================================================== */

function findQualifyingLinks(msgEl) {
    return [...msgEl.querySelectorAll('a[href]')]
        .filter(a => !a.dataset.scPipChecked &&
            (a.protocol === 'http:' || a.protocol === 'https:') && isPipLink(a.href));
}

// Best-effort "is a modal/card currently open" check, so the prompt doesn't yank D-pad
// focus out from under it -- mirrors the visibility classes tvnav.js's own OVERLAY_IDS
// system checks, without needing to import its internals.
function isOverlayCurrentlyOpen() {
    const checks = [
        ['sc-settings-overlay', null], ['sc-modal-overlay', null],
        ['sc-trivia-card', 'sc-show'], ['sc-users-panel', null], ['sc-poll-panel', null],
        ['sc-np-card', 'sc-np-visible'], ['sc-upnext-card', 'sc-upnext-visible'],
        ['sc-link-pip-panel', 'sc-link-pip-visible'], ['sc-lineup-screen', 'sc-lineup-visible'],
    ];
    return checks.some(([id, cls]) => {
        const el = document.getElementById(id);
        if (!el || getComputedStyle(el).display === 'none') return false;
        if (cls && !el.classList.contains(cls)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 3 && r.height > 3;
    });
}

let promptEl = null;
let promptTimer = null;
let pendingUrl = null;
let _prevFocusEl = null; // what had TV focus before we auto-focused the prompt (null if we didn't steal it)

function buildPrompt() {
    const el = document.createElement('div');
    el.id = 'sc-link-pip-prompt';
    el.innerHTML = `<button id="sc-link-pip-prompt-btn" type="button">
        <span class="sc-lpp-label">New video</span>
        <span class="sc-lpp-action">View this?</span>
    </button>`;
    document.body.appendChild(el);
    el.querySelector('#sc-link-pip-prompt-btn').addEventListener('click', confirmLinkPip);
    return el;
}

function dismissLinkPipPrompt() {
    if (!promptEl) return;
    clearTimeout(promptTimer);
    const btn = promptEl.querySelector('button');
    promptEl.classList.remove('sc-show');
    pendingUrl = null;
    // Only restore focus if the user hasn't navigated away from the prompt in the meantime --
    // an unconditional setFocus() here could clobber wherever they've since moved to.
    if (_prevFocusEl && document.activeElement === btn && tvNavState.setFocus && _prevFocusEl.isConnected) {
        tvNavState.setFocus(_prevFocusEl);
    }
    _prevFocusEl = null;
}

function confirmLinkPip() {
    const url = pendingUrl;
    clearTimeout(promptTimer);
    if (promptEl) promptEl.classList.remove('sc-show');
    pendingUrl = null;
    _prevFocusEl = null; // opening the panel takes over focus via tvnav's normal overlay flow
    if (url) openLinkPip(url);
}

function showLinkPipPrompt(url) {
    pendingUrl = url;
    if (!promptEl) promptEl = buildPrompt();
    promptEl.classList.add('sc-show');
    clearTimeout(promptTimer);
    promptTimer = setTimeout(dismissLinkPipPrompt, 7000);

    if (!isOverlayCurrentlyOpen() && tvNavState.setFocus) {
        _prevFocusEl = document.querySelector('.sc-tv-focus');
        tvNavState.setFocus(promptEl.querySelector('button'));
    } else {
        _prevFocusEl = null; // still rendered for mouse/touch, just not focus-stolen
    }
}

let _linkPipObserverStarted = false;
export function startLinkPipObserver() {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;
    if (_linkPipObserverStarted) return;
    _linkPipObserverStarted = true;

    // Consume Back while the prompt is showing -- it isn't part of the OVERLAY_IDS/
    // overlayFocusStack system (a naive timeout-driven pop there could clobber focus if
    // the user's navigated elsewhere since), so it registers its own hook instead.
    tvNavState.preBackHooks.push(() => {
        if (promptEl && promptEl.classList.contains('sc-show')) { dismissLinkPipPrompt(); return true; }
        return false;
    });

    // Only react to genuinely NEW messages (nodes added after this observer starts) --
    // not the existing scrollback, so opening the app doesn't flood a burst of prompts
    // for old links. Single-slot: a later qualifying link while one prompt is already
    // showing just replaces its target rather than stacking a second pill.
    new MutationObserver((muts) => {
        muts.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1 || !node.matches || !node.matches('[class*="chat-msg-"]')) return;
            const link = findQualifyingLinks(node)[0];
            if (link) { link.dataset.scPipChecked = '1'; showLinkPipPrompt(link.href); }
        }));
    }).observe(buf, { childList: true });
}
