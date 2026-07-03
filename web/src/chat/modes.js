import { isTv } from '../tvdetect.js';
import { chromeState } from '../chrome/state.js';
import { getChatFontSize, applyChatFontSize } from './fontsize.js';
import { holdScrubber } from '../player/scrubber.js';

/* ==========================================================
   CINEMATIC + CHAT ENHANCEMENTS
   Ambient glow, auto-hiding chrome, chat layout modes,
   new-message pill, @mention toasts, quick reactions.
========================================================== */

// ── Ambient glow: sample the video's colour and bleed it to the screen edges
export function initAmbientGlow() {
    if (isTv) return;
    const el = document.createElement('div');
    el.id = 'sc-ambient';
    document.body.appendChild(el);

    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 9;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let disabled = false;

    const sample = () => {
        if (disabled) return;
        const v = document.querySelector('#videowrap video');
        if (!v || v.paused || v.readyState < 2 || !v.videoWidth) return;
        try {
            ctx.drawImage(v, 0, 0, 16, 9);
            const d = ctx.getImageData(0, 0, 16, 9).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
            r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
            // Boost saturation a touch so the glow reads as colour, not grey
            const max = Math.max(r, g, b) || 1;
            const boost = (c) => Math.min(255, Math.round(c * (1 + (c / max) * 0.35)));
            r = boost(r); g = boost(g); b = boost(b);
            document.documentElement.style.setProperty('--sc-ambient-color', `rgba(${r},${g},${b},0.5)`);
            document.documentElement.style.setProperty('--np-accent', `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`);
        } catch (e) {
            // Tainted canvas (cross-origin video, e.g. YouTube) — give up quietly
            disabled = true;
            document.body.classList.add('sc-ambient-off');
        }
    };
    setInterval(sample, 2500);
}

// ── Auto-hiding chrome on TV: fade controls after a few idle seconds
export function initChromeAutohide() {
    if (!isTv) return;
    let timer = null;
    const hide = () => document.body.classList.add('sc-chrome-hidden');
    const show = () => {
        document.body.classList.remove('sc-chrome-hidden');
        if (typeof chromeState.topBarWake === 'function') chromeState.topBarWake();
        clearTimeout(timer);
        timer = setTimeout(hide, 4000);
    };
    ['mousemove', 'keydown', 'click', 'touchstart', 'wheel'].forEach(ev =>
        document.addEventListener(ev, show, { passive: true }));
    // Remote D-pad keys are consumed by native and never fire DOM keydown, so the
    // TV nav code re-arms this timer directly via chromeState.chromeWake on every remote press.
    chromeState.chromeWake = show;
    timer = setTimeout(hide, 4000);
}

// ── Chat layout modes: sidebar → overlay → hidden
// Chat-Only is a phone/tablet mode (a keyboard-free chat client) — not offered on TV,
// where the device is the playback target. Excluding it here drops it from the cycle and
// makes initChatModes fall back if 'chatonly' was ever persisted on a TV.
const _CHAT_MODES = isTv ? ['sidebar', 'overlay', 'hidden'] : ['sidebar', 'overlay', 'hidden', 'chatonly'];
const _CHAT_MODE_ICONS = { sidebar: '▐', overlay: '▣', hidden: '⊠', chatonly: '☰' };
const _CHAT_MODE_LABELS = { sidebar: 'Sidebar', overlay: 'Overlay', hidden: 'Hidden', chatonly: 'Chat Only' };

// CHAT-ONLY side effects: pause + mute the player so the device is a pure chat client.
// CyTube's sync conductor keeps trying to resume/seek, so we hold the media down with a
// light 1s interval (also covers the player not being ready yet on a cold load).
let _chatOnlyTimer = null, _inChatOnly = false;
function _coStopMedia() {
    try { const vid = document.querySelector('#videowrap video'); if (vid) { vid.muted = true; if (!vid.paused) vid.pause(); } } catch (e) {}
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p) {
            if (typeof p.pauseVideo === 'function') p.pauseVideo();
            else if (typeof p.pause === 'function') { try { p.pause(); } catch (e) {} }
            if (typeof p.mute === 'function') p.mute();
            else if (typeof p.muted === 'function') p.muted(true);
        }
    } catch (e) {}
}
function enterChatOnly() {
    _inChatOnly = true;
    _coStopMedia();
    clearInterval(_chatOnlyTimer);
    _chatOnlyTimer = setInterval(_coStopMedia, 1000);
}
function exitChatOnly() {
    if (!_inChatOnly) return;       // only act when we're actually leaving chat-only
    _inChatOnly = false;
    clearInterval(_chatOnlyTimer); _chatOnlyTimer = null;
    // Unmute and nudge playback; the sync conductor takes it from the room's position.
    try { const vid = document.querySelector('#videowrap video'); if (vid) vid.muted = false; } catch (e) {}
    try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p) {
            if (typeof p.unMute === 'function') p.unMute();
            else if (typeof p.muted === 'function') p.muted(false);
            if (typeof p.playVideo === 'function') p.playVideo();
            else if (typeof p.play === 'function') { try { p.play(); } catch (e) {} }
        }
    } catch (e) {}
}
function applyChatMode(mode) {
    _CHAT_MODES.forEach(m => document.body.classList.toggle('sc-chat-' + m, m === mode));
    try { localStorage.setItem('sc_chat_mode', mode); } catch (e) {}
    if (mode === 'chatonly') enterChatOnly(); else exitChatOnly();
    const btn = document.getElementById('sc-chatmode-btn');
    if (btn) {
        btn.textContent = _CHAT_MODE_ICONS[mode] || '▐';
        const label = _CHAT_MODE_LABELS[mode] || mode;
        btn.title = 'Chat: ' + label + ' (press C)';
        btn.dataset.tvLabel = 'Chat: ' + label;
    }
    const colBtn = document.getElementById('sc-chat-collapse-btn');
    if (colBtn) colBtn.textContent = mode === 'hidden' ? '‹' : '›';
    applyChatFontSize(getChatFontSize()); // input size depends on the mode (overlay = compact)
    // The layout reflows on a mode change, which loses the scroll position —
    // snap the chat back to the latest message once it settles.
    const buf = document.getElementById('messagebuffer');
    if (buf) {
        const toBottom = () => { buf.scrollTop = buf.scrollHeight; };
        requestAnimationFrame(() => requestAnimationFrame(toBottom));
        [120, 320, 600].forEach(ms => setTimeout(toBottom, ms));
    }
}
export function cycleChatMode() {
    let cur = 'sidebar';
    try { cur = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}
    applyChatMode(_CHAT_MODES[(_CHAT_MODES.indexOf(cur) + 1) % _CHAT_MODES.length]);
}
export function initChatModes() {
    let saved = 'sidebar';
    try { saved = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}
    if (!_CHAT_MODES.includes(saved)) saved = 'sidebar';

    // Always-visible floating button — lives on <body>, NOT in the chat header,
    // so it stays reachable even in Hidden mode.
    if (!document.getElementById('sc-chatmode-btn')) {
        const btn = document.createElement('button');
        btn.id = 'sc-chatmode-btn'; btn.type = 'button';
        btn.title = 'Cycle chat layout (press C)';
        btn.addEventListener('click', cycleChatMode);
        document.body.appendChild(btn);
    }
    applyChatMode(saved);

    // Hotkey 'c' cycles modes (ignored while typing in chat)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'c' && e.key !== 'C') return;
        const t = e.target;
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
        cycleChatMode();
    });
}

// ── Smart auto-scroll + "new messages" pill
export function initNewMessagePill() {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;

    const pill = document.createElement('div');
    pill.id = 'sc-newmsg-pill';
    pill.textContent = '↓ New messages';
    document.body.appendChild(pill);

    const nearBottom = () => buf.scrollHeight - buf.scrollTop - buf.clientHeight < 80;
    const toBottom = () => { buf.scrollTop = buf.scrollHeight; pill.classList.remove('sc-show'); };
    pill.addEventListener('click', toBottom);
    buf.addEventListener('scroll', () => { if (nearBottom()) pill.classList.remove('sc-show'); }, { passive: true });

    new MutationObserver(() => {
        if (nearBottom()) buf.scrollTop = buf.scrollHeight;
        else pill.classList.add('sc-show');
    }).observe(buf, { childList: true });
}

// ── @mention toast
export function initMentionToast() {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;

    const myName = () => { try { return (window.CLIENT && CLIENT.name) ? String(CLIENT.name) : ''; } catch (e) { return ''; } };

    let toast = null, toastTimer = null;
    const show = (name, text) => {
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sc-mention-toast';
            toast.addEventListener('click', () => toast.classList.remove('sc-show'));
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span class="sc-mt-name"></span><span class="sc-mt-text"></span>`;
        toast.querySelector('.sc-mt-name').textContent = name + ':';
        toast.querySelector('.sc-mt-text').textContent = ' ' + text;
        toast.classList.add('sc-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('sc-show'), 6000);
    };

    new MutationObserver((muts) => {
        const me = myName().toLowerCase();
        muts.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            const isMention = node.classList?.contains('nick-highlight') ||
                (me && node.textContent && node.textContent.toLowerCase().includes('@' + me));
            if (!isMention) return;
            const name = node.querySelector('.username')?.textContent?.replace(/[:\s]+$/, '').trim() || 'Mention';
            // Pull the message body by removing the timestamp + username spans, NOT by
            // a colon regex: CyTube's (CSS-hidden but still in textContent) timestamp is
            // "[12:34:56]", whose own colons would make a "strip up to first colon" regex
            // chop only "[12:" — leaving a stray "]" and the repeated username behind.
            const clone = node.cloneNode(true);
            clone.querySelectorAll('.timestamp, .username').forEach(el => el.remove());
            const text = clone.textContent.replace(/^[\s:]+/, '').trim().slice(0, 180);
            show(name, text);
        }));
    }).observe(buf, { childList: true });
}

export function initChatFont() { applyChatFontSize(getChatFontSize()); }

// The control cluster stays hidden; a small left-edge "grip" hints at it.
// Reaching the left edge (mouse or touch) — or hovering the grip — slides it out.
export function initLeftZone() {
    let hideTimer = null;
    const THRESH = 120; // px from the left edge
    const scheduleHide = (ms) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => document.body.classList.remove('sc-leftzone'), ms); };
    const reveal = (autoHideMs) => { clearTimeout(hideTimer); document.body.classList.add('sc-leftzone'); if (autoHideMs) scheduleHide(autoHideMs); };
    chromeState.leftZoneReveal = reveal;

    if (!document.getElementById('sc-cluster-grip')) {
        const grip = document.createElement('div');
        grip.id = 'sc-cluster-grip';
        grip.title = 'Controls';
        grip.addEventListener('mouseenter', reveal);
        grip.addEventListener('click', reveal);
        document.body.appendChild(grip);
    }

    document.addEventListener('mousemove', (e) => {
        if (e.clientX <= THRESH) reveal();
        else if (document.body.classList.contains('sc-leftzone')) scheduleHide(550);
    }, { passive: true });

    // Touch: tap near the left edge to reveal for a few seconds
    document.addEventListener('touchstart', (e) => {
        const x = e.touches[0] ? e.touches[0].clientX : 1e9;
        if (x <= THRESH) { reveal(3500); }
    }, { passive: true });
}

// Dark strip between video and chat in vertical mode; buttons float on top via CSS.
export function initVertControlBand() {
    if (document.getElementById('sc-vert-ctrl-band')) return;
    const band = document.createElement('div');
    band.id = 'sc-vert-ctrl-band';
    document.body.appendChild(band);
}

// Right-edge slide-out drawer for vertical mode (mirrors the left-zone in horizontal).
export function initRightZone() {
    let hideTimer = null;
    const THRESH = 100; // px from right edge triggers reveal
    const scheduleHide = (ms) => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => document.body.classList.remove('sc-rightzone'), ms);
    };
    const reveal = (ms) => {
        clearTimeout(hideTimer);
        document.body.classList.add('sc-rightzone');
        if (ms) scheduleHide(ms);
    };
    chromeState.rightZoneReveal = reveal;

    if (!document.getElementById('sc-vert-ctrl-grip')) {
        const grip = document.createElement('div');
        grip.id = 'sc-vert-ctrl-grip';
        grip.title = 'Controls';
        grip.addEventListener('click', () => reveal(3500));
        document.body.appendChild(grip);
    }

    document.addEventListener('touchstart', (e) => {
        if (!document.body.classList.contains('sc-vertical')) return;
        const x = e.touches[0]?.clientX;
        if (x != null && window.innerWidth - x <= THRESH) reveal(3500);
    }, { passive: true });
}

// Transparent tap-catcher over the video — only pointer-events:auto when chrome is dimmed
// (sc-video-dimmed on body). A document-level click listener doesn't work here because
// YouTube/Drive embeds are iframes and their taps never bubble to the parent document.
export function initVideoTapReveal() {
    const REVEAL_MS = 4000;     // keep the scrubber + fly-out cluster up for the same window
    let scrubReleaseTimer = null;
    const tap = document.createElement('div');
    tap.id = 'sc-video-tap';
    tap.addEventListener('click', () => {
        if (chromeState.topBarWake) chromeState.topBarWake();
        if (chromeState.leftZoneReveal) chromeState.leftZoneReveal(REVEAL_MS);
        if (chromeState.rightZoneReveal) chromeState.rightZoneReveal(REVEAL_MS);
        // Tie the scrubber to the fly-out: this overlay swallows the tap, so the
        // video.js control bar would otherwise need a second tap. Hold it up for the
        // same window the buttons stay revealed (holdScrubber refreshes activity
        // inside video.js's ~2s idle timeout), then release so they fade together.
        holdScrubber(true);
        clearTimeout(scrubReleaseTimer);
        scrubReleaseTimer = setTimeout(() => holdScrubber(false), REVEAL_MS);
    });
    document.body.appendChild(tap);
}
