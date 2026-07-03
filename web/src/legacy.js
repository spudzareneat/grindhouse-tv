import { parseMovieFilename } from './parse.js';
import { detectReadabilityIssues } from './readability.js';
import { usernameToColor } from './usercolors.js';
import { nativeHttpGet } from './native.js';
import { _appVersion, checkForUpdate, initUpdateCheck, _updateInfo, GH_RELEASES_PAGE } from './update.js';
import {
    LS_TMDB, LS_ONBOARDED, LS_SPELLCHECK, LS_CHAT_FONT, LS_MOVIE_LINKS, LS_COUCH, LS_WATCHALONG, LS_CAST_MUTE,
    getKey, setKey, hasKey, spellCheckEnabled, movieLinksEnabled, couchModeEnabled, watchAlongEnabled, castFallbackMuted,
} from './store.js';
import { fetchImdbParentalGuide, fetchImdbTrivia } from './metadata/imdb.js';
import { isTv } from './tvdetect.js';
import { LINK_DEFS, movieState, getKillCountDb, validateTmdbKey, lookupMovie } from './metadata/tmdb.js';
import baseCss from './styles/base.css';
import overlaysCss from './styles/overlays.css';
import tvCss from './styles/tv.css';

(function () {
    'use strict';

    /* ==========================================================
       API KEYS — stored in localStorage, managed via settings modal.
       Keys are never hard-coded; the settings modal handles first-run.
    ========================================================== */

    // Watch-Only mode: hide the chat input and the guest-login box so the room is
    // purely read-along. Works in both sidebar and overlay chat layouts (CSS-gated).
    function applyWatchAlong() {
        if (!document.body) return;
        document.body.classList.toggle('sc-watchalong', watchAlongEnabled());
    }

    // Couch Mode: while typing in the chat (sidebar layout) the input swells into a
    // large, easy-to-read compose box that overlaps the video. Body class gates the CSS.
    function applyCouchMode() {
        if (!document.body) return;
        document.body.classList.toggle('sc-couch', couchModeEnabled());
        if (!couchModeEnabled())
            document.body.classList.remove('sc-couch-typing', 'sc-couch-prep', 'sc-couch-settled');
    }
    let _couchIdleTimer = null;
    let _couchSettleTimer = null;
    let _couchPrepTimer = null;
    function couchFontPx() { return getChatFontSize() + 3; } // a touch bigger than the user's size
    function couchTypingOn() {
        if (!couchModeEnabled() || !document.body.classList.contains('sc-chat-sidebar')) return;
        couchIdleKick(); // (re)arm the 10s idle-revert on every keystroke
        if (document.body.classList.contains('sc-couch-typing')) return; // already open
        clearTimeout(_couchPrepTimer);
        const ta = document.getElementById('sc-chat-textarea');
        // Two-step open: establish the FIXED box at its collapsed size first, flush layout,
        // THEN expand. Switching position(static→fixed) and animating size in the same frame
        // gives the browser no clean start state — the width snaps and the open looks "off".
        if (!document.body.classList.contains('sc-couch-prep')) {
            document.body.classList.add('sc-couch-prep');
            void document.body.offsetWidth; // force reflow so the collapsed-fixed box is the start
        }
        // Enlarge the font (custom size + 3) — set inline so it tracks the user's setting and
        // animates from the normal size to the bigger one.
        if (ta) ta.style.setProperty('font-size', couchFontPx() + 'px', 'important');
        document.body.classList.add('sc-couch-typing'); // animate to the big box
        // Frosted blur only after the grow settles — per-frame backdrop blur on a growing box
        // is the main source of jank on older hardware.
        clearTimeout(_couchSettleTimer);
        _couchSettleTimer = setTimeout(() => document.body.classList.add('sc-couch-settled'), 420);
        couchScrollBottom();
    }
    // Pin the message list to the bottom of its reserved space, so the latest messages ride
    // up above the compose box instead of being hidden behind it.
    function couchScrollBottom() {
        const buf = document.getElementById('messagebuffer');
        if (!buf) return;
        const toBottom = () => { buf.scrollTop = buf.scrollHeight; };
        requestAnimationFrame(toBottom);
        [120, 300, 420].forEach(ms => setTimeout(toBottom, ms));
    }
    function couchTypingOff() {
        clearTimeout(_couchIdleTimer);
        clearTimeout(_couchSettleTimer);
        document.body.classList.remove('sc-couch-settled');
        const wasOpen = document.body.classList.contains('sc-couch-typing') ||
                        document.body.classList.contains('sc-couch-prep');
        if (!wasOpen) return;
        document.body.classList.remove('sc-couch-typing'); // animate collapse back down
        applyChatFontSize(getChatFontSize());              // restore the normal inline font (transitions down)
        // Clear the inline height so the input returns to its ORIGINAL rows=2 baseline.
        const ta = document.getElementById('sc-chat-textarea');
        if (ta) ta.style.removeProperty('height');
        couchScrollBottom();
        // Drop the fixed positioning back to normal flow only AFTER the collapse animation,
        // so position never snaps mid-animation (that's what made the motion look off).
        clearTimeout(_couchPrepTimer);
        _couchPrepTimer = setTimeout(() => document.body.classList.remove('sc-couch-prep'), 360);
    }
    // Revert the big box after 10s of no typing (re-armed on every keystroke).
    function couchIdleKick() {
        clearTimeout(_couchIdleTimer);
        _couchIdleTimer = setTimeout(couchTypingOff, 10000);
    }

    // Chat font size — user-set via the settings slider, applied to #messagebuffer
    function getChatFontSize() {
        const v = parseInt(getKey(LS_CHAT_FONT), 10);
        if (Number.isFinite(v) && v >= 10 && v <= 32) return v;
        return document.body && document.body.classList.contains('sc-tv') ? 18 : 14;
    }
    function applyChatFontSize(px) {
        const buf = document.getElementById('messagebuffer');
        if (buf) buf.style.setProperty('font-size', px + 'px', 'important');
        // The chat input matches the message font (overlay keeps its compact size)
        const ta = document.getElementById('sc-chat-textarea');
        if (ta) {
            const overlay = document.body && document.body.classList.contains('sc-chat-overlay');
            ta.style.setProperty('font-size', (overlay ? 13 : px) + 'px', 'important');
        }
    }

    // Soft (on-screen) keyboard suppression via inputmode="none".
    // Defaults to ON for TV; the settings toggle overrides on any device.
    const LS_NOKEYBOARD = 'sc_no_soft_keyboard';
    function softKeyboardDisabled() {
        const v = getKey(LS_NOKEYBOARD);
        if (v === 'on')  return true;
        if (v === 'off') return false;
        // Default: suppress the on-screen keyboard only when a hardware keyboard
        // is actually connected (so remote-only TVs keep the on-screen keyboard).
        try { if (window.CytubeNative && CytubeNative.hasHardwareKeyboard) return !!CytubeNative.hasHardwareKeyboard(); } catch (e) {}
        return false;
    }
    let _lastKbSuppress = null;
    function applySoftKeyboard() {
        const disable = softKeyboardDisabled();
        const mode = disable ? 'none' : 'text';
        ['chatline', 'sc-chat-textarea'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.getAttribute('inputmode') !== mode) el.setAttribute('inputmode', mode);
        });
        document.querySelectorAll('.emotelist-search').forEach(el => {
            if (el.getAttribute('inputmode') !== mode) el.setAttribute('inputmode', mode);
        });
        // The reliable path: tell the native WebView to suppress the IME.
        // Only when the state actually changes (the caller runs on every DOM mutation).
        if (disable !== _lastKbSuppress) {
            _lastKbSuppress = disable;
            try { if (window.CytubeNative && CytubeNative.setSuppressKeyboard) CytubeNative.setSuppressKeyboard(disable); } catch (e) {}
        }
    }

    /* ==========================================================
       MONITOR / ORIENTATION DETECTION
    ========================================================== */

    function isVerticalMonitor() {
        return window.screen.height > window.screen.width;
    }
    function applyMonitorLayout() {
        const wasVert = document.body.classList.contains('sc-vertical');
        const isVert = isVerticalMonitor();
        document.body.classList.toggle('sc-vertical', isVert);
        document.body.classList.toggle('sc-horizontal', !isVert);
        if (wasVert !== isVert) {
            const buf = document.getElementById('messagebuffer');
            if (buf) setTimeout(() => { buf.scrollTop = buf.scrollHeight; }, 200);
        }
    }
    function startMonitorWatcher() {
        applyMonitorLayout();
        setInterval(applyMonitorLayout, 800);
    }

    /* ==========================================================
       CHAT USERNAMES — autocomplete + LT ignore list
    ========================================================== */

    function getChatUsernames() {
        const names = new Set();
        document.querySelectorAll('#userlist .userlist_item').forEach(item => {
            const spans = item.querySelectorAll('span');
            const nameSpan = spans.length >= 2 ? spans[1] : spans[0];
            const n = nameSpan?.textContent?.trim();
            if (n) names.add(n);
        });
        document.querySelectorAll('#messagebuffer .username').forEach(el => {
            const n = el.textContent.replace(/[:\s]+$/, '').trim();
            if (n) names.add(n);
        });
        return [...names];
    }

    /* ==========================================================
       TAB AUTOCOMPLETE
    ========================================================== */

    let tabCandidates = [];
    let tabIndex = 0;
    let tabStart = 0;

    function handleTabComplete(textarea, e) {
        if (e.key !== 'Tab') { tabCandidates = []; return; }
        e.preventDefault();

        const val = textarea.value;
        const cursor = textarea.selectionStart;

        if (tabCandidates.length === 0) {
            let i = cursor - 1;
            while (i >= 0 && /\S/.test(val[i])) i--;
            tabStart = i + 1;
            const prefix = val.slice(tabStart, cursor).replace(/^@/, '');
            tabCandidates = getChatUsernames().filter(n =>
                n.toLowerCase().startsWith(prefix.toLowerCase())
            );
            tabIndex = 0;
        } else {
            tabIndex = (tabIndex + 1) % tabCandidates.length;
        }

        if (tabCandidates.length === 0) return;

        const completion = tabCandidates[tabIndex];
        const atPrefix = tabStart === 0 ? '@' : '';
        const insert = atPrefix + completion + ' ';
        const after = val.slice(cursor);
        textarea.value = val.slice(0, tabStart) + insert + after;
        const newCursor = tabStart + insert.length;
        textarea.selectionStart = textarea.selectionEnd = newCursor;
    }

    /* ==========================================================
       LANGUAGETOOL GRAMMAR CHECK
    ========================================================== */

    const LT_API = 'https://api.languagetool.org/v2/check';

    // Rules that fire constantly on casual chat and add no value
    const LT_DISABLED_RULES = [
        'UPPERCASE_SENTENCE_START',
        'PUNCTUATION_PARAGRAPH_END',
        'EN_QUOTES',
        'COMMA_PARENTHESIS_WHITESPACE',
        'WHITESPACE_RULE',
        'CONSECUTIVE_SPACES',
    ].join(',');

    // Explicitly enable these categories so they're always active
    // regardless of LT's default on/off state.
    // CONFUSED_WORDS is the one that catches there/their/they're,
    // your/you're, its/it's, to/too/two etc.
    const LT_ENABLED_CATEGORIES = [
        'GRAMMAR',
        'TYPOS',
        'CONFUSED_WORDS',
    ].join(',');

    // Pad short messages with a neutral sentence so LT has enough
    // context to fire confused-word rules. The pad is stripped from
    // results by subtracting its length from match offsets.
    const LT_PREFIX = 'I am writing this message. ';

    function buildAnnotation(text) {
        const names = getChatUsernames();

        // Build a sorted-longest-first list so longer names match before shorter prefixes
        const sorted = [...names].sort((a, b) => b.length - a.length);
        const escaped = sorted.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        // Tokens to mask as markup (LT skips these entirely):
        //   @Name or Name — followed by any non-alpha char or end of string
        //   #hashtag
        //   URLs
        const parts = [];
        if (escaped.length) {
            // Match @Name or bare Name at a word boundary / after space / at start
            parts.push(`@(?:${escaped.join('|')})`);
            parts.push(`(?<![\\w])(?:${escaped.join('|')})(?![\\w])`);
        }
        parts.push('#\\S+');                          // #hashtag
        parts.push('https?://\\S+');                  // URLs

        const tokenRe = new RegExp(parts.join('|'), 'gi');
        const annotation = [];
        let last = 0, match;

        // Prefix for context (helps LT with confused-word rules on short messages)
        annotation.push({ text: LT_PREFIX });

        while ((match = tokenRe.exec(text)) !== null) {
            if (match.index > last) annotation.push({ text: text.slice(last, match.index) });
            annotation.push({ markup: match[0] });
            last = match.index + match[0].length;
        }
        if (last < text.length) annotation.push({ text: text.slice(last) });

        return annotation;
    }

    async function checkGrammar(text) {
        try {
            const body = new URLSearchParams({
                data: JSON.stringify({ annotation: buildAnnotation(text) }),
                language: 'en-US',
                disabledRules: LT_DISABLED_RULES,
                enabledCategories: LT_ENABLED_CATEGORIES,
            });
            const res = await fetch(LT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            if (!res.ok) return [];
            const data = await res.json();
            const prefixLen = LT_PREFIX.length;
            return (data.matches || [])
                // Drop any matches that fired inside the prefix padding itself
                .filter(m => m.offset >= prefixLen)
                .map(m => ({
                    offset: m.offset - prefixLen,  // re-anchor to original text
                    length: m.length,
                    message: m.message,
                    shortMessage: m.shortMessage || '',
                    replacements: (m.replacements || []).slice(0, 5).map(r => r.value),
                }));
        } catch (e) { return []; }
    }

    /* ==========================================================
       INLINE ERROR REVIEW MODAL
    ========================================================== */

    function showReviewModal(text, ltMatches, readabilityIssues, onSend, onCancel) {
        const old = document.getElementById('sc-modal-overlay');
        if (old) old.remove();

        let workingText = text;
        let workingMatches = ltMatches.slice();

        const overlay = document.createElement('div');
        overlay.id = 'sc-modal-overlay';
        overlay.innerHTML = `
            <div id="sc-modal">
                <div id="sc-modal-title">⚠️ Review Before Sending</div>
                ${readabilityIssues.length ? `<div id="sc-readability">${
                    readabilityIssues.map(i => `<div class="sc-readability-issue">⚠️ ${i}</div>`).join('')
                }</div>` : ''}
                <div id="sc-preview-wrap"><div id="sc-preview"></div></div>
                <div id="sc-error-detail"></div>
                <div id="sc-modal-actions">
                    <button id="sc-btn-cancel">✏️ Edit in Chat</button>
                    <button id="sc-btn-send">✅ Send</button>
                </div>
                <div id="sc-lt-credit">Grammar by <a href="https://languagetool.org" target="_blank" rel="noopener">LanguageTool</a></div>
            </div>`;

        document.body.appendChild(overlay);

        // Keep physical-keyboard Enter routed to the WebView (Enter = Send) while the
        // modal is open, instead of letting native treat it as a TV "center" press.
        try { if (window.CytubeNative) CytubeNative.setChatInputFocused(true); } catch (e) {}
        // Recompute the native Enter-routing flag once the modal is gone.
        const closeModal = () => { overlay.remove(); setTimeout(syncNativeInputFocus, 0); };

        // Focus the Send button so keyboard events target the modal, not the textarea
        setTimeout(() => document.getElementById('sc-btn-send')?.focus(), 0);

        overlay.addEventListener('click', e => { if (e.target === overlay) { closeModal(); onCancel(); } });
        document.getElementById('sc-btn-cancel').addEventListener('click', () => { closeModal(); onCancel(); });
        document.getElementById('sc-btn-send').addEventListener('click', () => { closeModal(); onSend(workingText); });

        // Enter on the modal triggers Send, Escape triggers Cancel.
        // Use keyup so the key is fully released before focus returns to
        // the textarea — prevents the Enter from re-firing attemptSend.
        const modalKeyHandler = e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                overlay.removeEventListener('keydown', modalKeyHandler);
                closeModal();
                setTimeout(() => onSend(workingText), 50);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                overlay.removeEventListener('keydown', modalKeyHandler);
                closeModal();
                onCancel();
            }
        };
        overlay.addEventListener('keydown', modalKeyHandler);

        // Clean up listener if modal is removed any other way
        const cleanupObserver = new MutationObserver(() => {
            if (!document.getElementById('sc-modal-overlay')) {
                cleanupObserver.disconnect();
                syncNativeInputFocus();
            }
        });
        cleanupObserver.observe(document.body, { childList: true });

        function renderPreview() {
            const preview = document.getElementById('sc-preview');
            const detail = document.getElementById('sc-error-detail');
            if (!preview) return;

            const sorted = workingMatches.slice().sort((a, b) => a.offset - b.offset);
            const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            let html = '', pos = 0;

            sorted.forEach((m, i) => {
                if (m.offset > pos) html += esc(workingText.slice(pos, m.offset));
                html += `<span class="sc-error-span" data-idx="${i}" title="${esc(m.shortMessage || m.message)}">${esc(workingText.slice(m.offset, m.offset + m.length))}</span>`;
                pos = m.offset + m.length;
            });
            html += esc(workingText.slice(pos));
            preview.innerHTML = html;

            preview.querySelectorAll('.sc-error-span').forEach(span => {
                span.addEventListener('click', () => showErrorDetail(sorted[parseInt(span.dataset.idx)]));
            });
            detail.innerHTML = '';
        }

        function showErrorDetail(match) {
            const detail = document.getElementById('sc-error-detail');
            if (!detail) return;
            const sugs = match.replacements;
            detail.innerHTML = `
                <div class="sc-detail-msg">💬 ${match.message}</div>
                <div class="sc-detail-actions">
                    ${sugs.length ? sugs.map(s =>
                        `<button class="sc-sug-btn" data-sug="${s.replace(/"/g,'&quot;')}">✔ ${s}</button>`
                    ).join('') : '<em>No suggestions</em>'}
                    <button class="sc-reject-btn">✖ Ignore</button>
                </div>`;

            detail.querySelectorAll('.sc-sug-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sug = btn.dataset.sug;
                    const delta = sug.length - match.length;
                    workingText = workingText.slice(0, match.offset) + sug + workingText.slice(match.offset + match.length);
                    workingMatches = workingMatches.filter(m => m !== match);
                    workingMatches.forEach(m => { if (m.offset > match.offset) m.offset += delta; });
                    renderPreview();
                });
            });
            detail.querySelector('.sc-reject-btn').addEventListener('click', () => {
                workingMatches = workingMatches.filter(m => m !== match);
                renderPreview();
            });
        }

        renderPreview();
    }

    /* ==========================================================
       SEND FLOW
    ========================================================== */

    async function attemptSend(textarea, originalInput) {
        const text = textarea.value.trim();
        if (!text) return;

        // Skip all checking if spellcheck is disabled in settings
        if (!spellCheckEnabled()) {
            doSend(textarea, originalInput, text);
            return;
        }

        const readabilityIssues = detectReadabilityIssues(text);
        showCheckingIndicator(textarea, true);
        const ltMatches = await checkGrammar(text);
        showCheckingIndicator(textarea, false);

        if (ltMatches.length > 0 || readabilityIssues.length > 0) {
            showReviewModal(text, ltMatches, readabilityIssues,
                finalText => { textarea.value = finalText; doSend(textarea, originalInput, finalText); },
                () => textarea.focus()
            );
        } else {
            doSend(textarea, originalInput, text);
        }
    }

    function showCheckingIndicator(textarea, show) {
        let el = document.getElementById('sc-checking');
        if (show && !el) {
            el = document.createElement('div');
            el.id = 'sc-checking'; el.textContent = '🔍 Checking…';
            textarea.parentElement.insertBefore(el, textarea.nextSibling);
        } else if (!show && el) el.remove();
    }

    function doSend(textarea, originalInput, msg) {
        if (!msg) return;
        let sent = false;
        try {
            if (typeof socket !== 'undefined' && socket && socket.emit) {
                socket.emit('chatMsg', { msg, meta: {} });
                sent = true;
            }
        } catch (e) {}

        if (!sent) {
            originalInput.value = msg; lastChatlineValue = msg;
            originalInput.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
            }));
            try {
                if (typeof $ !== 'undefined')
                    $(originalInput).trigger($.Event('keydown', { which: 13, keyCode: 13, key: 'Enter' }));
            } catch (e) {}
        }

        textarea.value = ''; textarea.style.height = '';
        lastChatlineValue = ''; originalInput.value = '';
        // Return focus to the chat input so user can keep typing immediately
        textarea.focus();
    }

    /* ==========================================================
       EMOTE MIRROR
    ========================================================== */

    let emoteWatchInterval = null;
    let lastChatlineValue = '';

    function startEmoteWatcher(originalInput, textarea) {
        if (emoteWatchInterval) return;
        emoteWatchInterval = setInterval(() => {
            const current = originalInput.value;
            if (current !== lastChatlineValue) {
                textarea.value = current; lastChatlineValue = current;
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                textarea.dispatchEvent(new Event('input'));
            }
        }, 80);
    }

    /* ==========================================================
       CHAT TEXTAREA INSTALLATION
    ========================================================== */

    // Tell native Kotlin whether the WebView should keep physical-keyboard Enter
    // (so it sends/confirms) instead of routing it to the TV remote "center" action.
    // True when the chat textarea has focus, OR when the spell-check review modal is
    // open (it handles Enter = Send itself). Called on every focus/blur and modal change.
    function syncNativeInputFocus() {
        const a = document.activeElement;
        const inField = !!a && (a.id === 'sc-chat-textarea' || a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
        const modalOpen = !!document.getElementById('sc-modal-overlay');
        try { if (window.CytubeNative) CytubeNative.setChatInputFocused(inField || modalOpen); } catch (e) {}
    }
    window.__scSyncInputFocus = syncNativeInputFocus;

    function installChatTextarea() {
        const originalInput = document.getElementById('chatline');
        if (!originalInput) return false;
        if (document.getElementById('sc-chat-textarea')) return true;

        originalInput.style.cssText = `
            position: absolute !important; width: 1px !important; height: 1px !important;
            opacity: 0 !important; pointer-events: none !important; top: -9999px !important;`;

        const textarea = document.createElement('textarea');
        textarea.id = 'sc-chat-textarea';
        textarea.placeholder = 'Type a message…';
        textarea.spellcheck = true; textarea.lang = 'en'; textarea.rows = 2;
        textarea.setAttribute('autocorrect', 'on');
        textarea.setAttribute('autocapitalize', 'sentences');

        originalInput.parentElement.insertBefore(textarea, originalInput.nextSibling);

        textarea.addEventListener('input', () => {
            tabCandidates = [];
            lastChatlineValue = originalInput.value;
            // Couch Mode: typing (re)expands the big box and resets its 10s idle timer.
            // The couch CSS forces the height, so skip the auto-grow math while it's active.
            if (couchModeEnabled() && document.body.classList.contains('sc-chat-sidebar')) {
                couchTypingOn();
            } else {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            }
        });
        textarea.addEventListener('keydown', e => {
            handleTabComplete(textarea, e);
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Don't fire if a review modal is already open
                if (!document.getElementById('sc-modal-overlay')) {
                    attemptSend(textarea, originalInput);
                }
                couchTypingOff(); // Enter submits → shrink back to the normal input
            } else if (e.key === 'Escape') {
                // Escape backs out of the big box without sending.
                if (document.body.classList.contains('sc-couch-typing')) {
                    e.preventDefault();
                    couchTypingOff();
                }
            }
        });
        originalInput.addEventListener('focus', () => textarea.focus());

        // Tell native Kotlin when the textarea has focus so physical-keyboard Enter
        // is passed through instead of being intercepted as TV remote "center" press.
        // Defer blur a tick so focus can settle (e.g. onto the review modal) first.
        // (Couch Mode opens on actual typing — see the input handler — not merely on focus,
        // so that after an Enter-send the refocused input stays at its normal size.)
        textarea.addEventListener('focus', syncNativeInputFocus);
        textarea.addEventListener('blur', () => { setTimeout(syncNativeInputFocus, 0); couchTypingOff(); });

        const chatwrap = document.getElementById('chatwrap');
        if (chatwrap) {
            chatwrap.addEventListener('click', e => {
                if (e.target === chatwrap || e.target.id === 'messagebuffer') textarea.focus();
            });
        }

        // Clicking anywhere outside the chat column while the big box is open shrinks it back
        // (the box is a DOM child of #chatwrap, so clicks on the box itself don't count).
        document.addEventListener('pointerdown', e => {
            if (!document.body.classList.contains('sc-couch-typing')) return;
            if (e.target.closest && e.target.closest('#chatwrap')) return;
            textarea.blur();
        }, true);

        startEmoteWatcher(originalInput, textarea);
        return true;
    }

    /* ==========================================================
       FLOATING BUTTONS
       Appended to document.body so they're never inside #leftcontrols
       and can't be accidentally hidden with it.
    ========================================================== */

    /* ==========================================================
       DESYNC BUTTON — temporarily pause CyTube's sync
    ========================================================== */

    function initDesyncButton() {
        const btn = document.createElement('button');
        btn.id = 'sc-desync-btn';
        btn.textContent = '⟳';
        btn.title = 'Free watch — click to watch freely, click again to re-sync';
        btn.dataset.tvLabel = 'Free Watch';
        document.body.appendChild(btn);

        let desynced = false;
        let savedListeners = null;

        const getMediaUpdateListeners = () => {
            // Socket.IO v2/v3 stores listeners under _callbacks['$eventName']
            // Socket.IO v4 stores them under _events or via listeners()
            const key = '$mediaUpdate';
            if (socket._callbacks?.[key]) return { store: '_callbacks', key };
            if (socket._events?.mediaUpdate) return { store: '_events', key: 'mediaUpdate' };
            return null;
        };

        const freezeSync = () => {
            const loc = getMediaUpdateListeners();
            if (!loc) {
                console.warn('[CyTube SC] Could not find mediaUpdate listeners to freeze');
                return;
            }
            if (loc.store === '_callbacks') {
                savedListeners = socket._callbacks[loc.key].slice();
                socket._callbacks[loc.key] = [];
            } else {
                savedListeners = socket._events[loc.key];
                delete socket._events[loc.key];
            }
            console.log('[CyTube SC] Sync frozen — removed', savedListeners?.length ?? 1, 'mediaUpdate listener(s)');
        };

        const thawSync = () => {
            if (!savedListeners) return;
            const loc = getMediaUpdateListeners();
            if (loc?.store === '_callbacks') {
                socket._callbacks[loc.key] = savedListeners;
            } else {
                socket._events = socket._events || {};
                socket._events['mediaUpdate'] = savedListeners;
            }
            savedListeners = null;
            console.log('[CyTube SC] Sync restored');
            // Trigger immediate resync
            if (typeof socket !== 'undefined' && socket) {
                socket.emit('playerReady');
            }
        };

        btn.addEventListener('click', () => {
            if (typeof socket === 'undefined' || !socket) return;
            desynced = !desynced;
            if (desynced) {
                freezeSync();
                btn.classList.add('sc-desync-active');
                btn.title = 'Free watch ON — click to re-sync';
            } else {
                thawSync();
                btn.classList.remove('sc-desync-active');
                btn.title = 'Free watch — click to watch freely';
            }
        });
    }

    function addFloatingButtons() {
        if (document.getElementById('fs-toggle-btn')) return;

        const fsBtn = document.createElement('button');
        fsBtn.id = 'fs-toggle-btn'; fsBtn.textContent = '⛶'; fsBtn.title = 'Toggle Fullscreen';
        fsBtn.addEventListener('click', () => {
            document.fullscreenElement
                ? document.exitFullscreen().catch(() => {})
                : document.documentElement.requestFullscreen().catch(() => {});
        });
        document.body.appendChild(fsBtn);

        document.addEventListener('fullscreenchange', () => {
            fsBtn.style.display = document.fullscreenElement ? 'none' : '';
        });
    }

    /* ==========================================================
       EMOTE BUTTON RELOCATION
       CyTube's #emotelistbtn lives inside #leftcontrols which we
       hide in horizontal mode. Clone it outside so it's always visible,
       and forward clicks to the original so CyTube's picker still opens.
    ========================================================== */

    // VHS cassette SVG — stripped white background, fill:currentColor so CSS controls colour.
    // Source: vecteezy_black-vector-icon-of-vhs-video-cassette-tape-on-isolated-on_5567997.svg
    const _VHS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5628 3728" fill="currentColor" aria-hidden="true"><g transform="matrix(1.3333333,0,0,-1.3333333,0,3728)"><g transform="scale(0.1)"><g transform="scale(2.31715)"><path d="m 16300,9657.36 v -335.45 c -157.2,180.66 -390.4,294.66 -648.5,294.66 H 2567.81 c -260.88,0 -494.75,-115.91 -651.51,-298.23 v 339.02 c 0,353.34 291.56,640.74 649.98,640.74 H 15650 c 358.5,0 650,-287.4 650,-640.74"/></g><g transform="scale(1.06574)"><path d="m 11418,14609.4 h 187.4 V 16300 c -2170.61,-146.3 -3886.11,-1953.4 -3886.11,-4161.2 0,-2207.82 1715.5,-4015.03 3886.11,-4161.31 v 1924.59 c -132.5,17.26 -261.1,46.72 -384.9,86.79 -79.8,26.13 -165.5,-18.86 -189.4,-99.46 l -34.2,-114.57 c -29.3,-98.71 -147.7,-138.87 -231.1,-78.26 l -763.8,555.02 c -83.41,60.6 -81.81,185.5 3.1,244.1 l 98.6,68 c 69.3,47.7 85.5,143.1 36.1,211 -260.06,357.1 -413.47,796.9 -413.47,1272.5 v 1.6 c 0,83.3 -68.31,150.7 -151.73,148.6 l -121.51,-3.1 c -103.15,-2.5 -177.72,97.6 -145.84,195.6 l 291.75,898 c 31.81,98.1 151.07,135.2 232.89,72.5 l 95.24,-72.8 c 66.71,-51.1 162.37,-37.3 211.77,30.6 265.9,366 643.9,645.2 1083.3,787.6 79.8,25.9 122.4,112.7 94.5,191.8 l -39.7,112.8 c -34.3,97.1 37.8,199 141,199"/></g><g transform="scale(2.08529)"><path d="m 14313.8,8330.5 v -864 h 95.9 c 52.6,0 89.5,-52.03 71.9,-101.72 l -20.2,-57.59 c -14.3,-40.47 7.4,-84.83 48.2,-98.07 224.6,-72.79 417.8,-215.46 553.8,-402.53 25.2,-34.67 74,-41.72 108.2,-15.63 l 48.6,37.26 c 41.8,31.98 102.8,12.99 119.1,-37.12 l 149.1,-458.88 c 16.3,-50.11 -21.9,-101.33 -74.6,-100.04 l -62.1,1.63 c -42.6,1.01 -77.6,-33.37 -77.5,-76 v -0.82 c 0,-243.04 -78.5,-467.75 -211.3,-650.32 -25.3,-34.67 -17,-83.49 18.4,-107.85 l 50.5,-34.76 c 43.3,-29.88 44.1,-93.76 1.5,-124.74 l -390.4,-283.6 c -42.6,-31.03 -103.1,-10.5 -118.1,39.99 l -17.4,58.51 c -12.3,41.19 -56.1,64.16 -96.9,50.88 -63.2,-20.53 -129,-35.58 -196.7,-44.41 v -983.6 c 1109.4,74.76 1986.2,998.37 1986.2,2126.75 0,1128.34 -876.8,2051.9 -1986.2,2126.66"/></g><g transform="scale(2.31715)"><path d="m 15169.1,3729.71 c 0,-505.24 -409.6,-914.79 -914.8,-914.79 h -1098.8 c -277.4,0 -502.4,224.93 -502.4,502.38 v 4531.45 c 0,277.42 225,502.4 502.4,502.4 h 1098.9 c 487.9,0 886.5,-381.98 913.3,-863.17 0.9,-17.09 1.4,-34.26 1.4,-51.57 z m -3232.9,-341.07 c 0,-340.98 -276.4,-617.4 -617.4,-617.4 H 6900.45 c -340.98,0 -617.4,276.42 -617.4,617.4 v 4388.71 c 0,340.99 276.42,617.41 617.4,617.41 h 4418.35 c 341,0 617.4,-276.42 617.4,-617.41 z M 5566.1,3317.3 c 0,-277.45 -224.93,-502.38 -502.39,-502.38 H 3964.9 c -505.22,0 -914.78,409.55 -914.78,914.79 v 3706.7 c 0,505.18 409.56,914.74 914.73,914.74 h 1098.86 c 264.47,0 481.2,-204.38 500.96,-463.77 0.95,-12.76 1.43,-25.62 1.43,-38.63 z m 10732.5,5385.84 c -24.1,387.6 -346.1,694.52 -739.8,694.52 H 2660.51 c -409.41,0 -741.25,-331.89 -741.25,-741.25 V 2509.63 c 0,-409.38 331.84,-741.21 741.25,-741.21 H 15558.8 c 409.4,0 741.2,331.83 741.2,741.21 v 6146.78 c 0,15.73 -0.5,31.3 -1.4,46.73"/></g></g></g></svg>';

    function relocateEmoteButton() {
        if (document.getElementById('sc-emote-proxy')) return;
        const original = document.getElementById('emotelistbtn');
        if (!original) return;

        const proxy = document.createElement('button');
        proxy.id = 'sc-emote-proxy';
        proxy.innerHTML = _VHS_SVG;
        proxy.title = 'Emotes';
        proxy.dataset.tvLabel = 'Emotes';
        proxy.setAttribute('aria-label', 'Emote Picker');

        proxy.addEventListener('click', e => {
            e.stopPropagation();
            original.click();
        });

        // Must go inside the chat input row. If it isn't ready yet, bail and let
        // the bootObserver retry on the next DOM mutation — don't fall back to body
        // because without position:fixed it would be invisible there.
        const inputRow = document.getElementById('sc-mobile-input-row');
        if (!inputRow) return;
        inputRow.appendChild(proxy);
    }

    const applyInputMode = () => {
        const inputs = document.getElementsByClassName('emotelist-search');
        if (!inputs.length) return;
        for (const input of inputs) {
            if (input.getAttribute('inputmode') !== 'none') input.setAttribute('inputmode', 'none');
        }
    };

    /* ==========================================================
       MOVIE TITLE CLEANING
       Handles filenames like: White.Fire.[1984].mkv
       → returns { title: "White Fire", year: "1984" }
    ========================================================== */

    // Aggressively clean a messy YouTube "full movie" title into a TMDB query.
    // e.g. "Sole Survivor 1984 HD (Full Movie) | Free Action Thriller" → {title:'Sole Survivor', year:'1984'}
    const YT_NOISE = [
        'full movie', 'full length movie', 'full length feature', 'full length film', 'full length',
        'complete movie', 'complete film', 'the complete movie', 'entire movie',
        'free movie', 'free film', 'free online', 'free to watch', 'watch online', 'watch free',
        'watch now', 'online free', 'free with ads', 'with ads', 'no ads', 'ad free',
        'official movie', 'official film', 'official', 'exclusive', 'premiere', 'world premiere',
        'remastered', 'restored', 'colou?ri[sz]ed', 'subtitle[sd]?', 'subbed', 'dubbed', 'eng sub',
        'hd', 'fhd', 'uhd', '4k', '2k', '1080p', '720p', '480p', 'high definition',
        'blu-?ray', 'dvd', 'web-?dl', 'uncut', 'extended', 'director.?s cut', 'special edition',
        'classic movie', 'classic film', 'cult classic', 'b-?movie', 'feature film', 'feature',
        'cinema', 'blockbuster', 'must watch', 'in english', 'english movie',
    ];
    const YT_GENRES = ['action', 'thriller', 'horror', 'comedy', 'drama', 'sci-?fi', 'science fiction',
        'western', 'romance', 'crime', 'mystery', 'adventure', 'fantasy', 'war', 'noir', 'slasher',
        'martial arts', 'kung fu', 'documentary', 'family', 'musical', 'animation'];

    function parseYouTubeTitle(raw) {
        let s = ' ' + raw + ' ';

        // Year: first standalone 1900–2099
        let year = null;
        const ym = s.match(/\b(19\d{2}|20\d{2})\b/);
        if (ym) year = ym[1];

        // Drop bracketed chunks entirely: (Full Movie), [HD], {1080p}
        s = s.replace(/[\[({][^\])}]*[\])}]/g, ' ');
        // Drop the year token from the title text
        if (year) s = s.replace(new RegExp('\\b' + year + '\\b', 'g'), ' ');
        // Strip noise + genre words (whole-word, case-insensitive)
        [...YT_NOISE, ...YT_GENRES].forEach(n => {
            s = s.replace(new RegExp('\\b' + n + '\\b', 'gi'), ' ');
        });
        // Remove emoji / decorative symbols and stray punctuation runs
        s = s.replace(/[^\w\s&':!.,-]/g, ' ');

        // Split on spaced separators ( | – — - : • ) and keep the wordiest segment
        const segs = s.split(/\s[|–—•:_-]+\s/)
            .map(x => x.replace(/\s+/g, ' ').trim())
            .filter(x => x.length >= 2);
        let title = segs.sort((a, b) =>
            (b.match(/[a-z]/gi) || []).length - (a.match(/[a-z]/gi) || []).length
        )[0] || s;

        // Final tidy: trim trailing junk punctuation
        title = title.replace(/\s+/g, ' ').replace(/^[\s'":.,-]+|[\s'":.,-]+$/g, '').trim();
        return { title, year };
    }

    // Current media duration/type — from CyTube's socket, with a playlist fallback.
    let currentMediaSeconds = 0;
    let currentMediaType = '';
    // Live playhead position, kept fresh by CyTube's mediaUpdate socket event so the
    // remote-summoned progress card works for every media type (YouTube/Drive/raw).
    let currentPlaybackTime = 0;
    // Assigned by initTvNav (TV only) so other UI (e.g. the settings modal) can hand the
    // remote's focus ring to a specific element. Null on phones / before nav init.
    let _tvSetFocus = null;
    function parseTimeToSeconds(t) {
        const parts = String(t).trim().split(':').map(Number);
        if (!parts.length || parts.some(isNaN)) return 0;
        return parts.reduce((acc, v) => acc * 60 + v, 0);
    }
    function getCurrentMediaSeconds() {
        if (currentMediaSeconds > 0) return currentMediaSeconds;
        const el = document.querySelector('#queue .queue_active .qe_time, #queue .queue_entry.active .qe_time');
        return el ? parseTimeToSeconds(el.textContent) : 0;
    }
    // Current playhead in seconds — the live <video> when present (raw/Drive), otherwise
    // the last position CyTube broadcast via mediaUpdate (YouTube and other embeds).
    function getCurrentPlaybackSeconds() {
        const v = document.querySelector('#videowrap video');
        if (v && isFinite(v.currentTime) && v.currentTime > 0) return v.currentTime;
        return currentPlaybackTime;
    }
    function formatHMS(s) {
        s = Math.max(0, Math.floor(s || 0));
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    }
    // Summon the video.js control bar — the scrubber a mouse gets on hover — and let
    // video.js's own inactivity timer fade it back out. Raw/Drive/video.js players only;
    // a YouTube embed manages its own controls, so this no-ops there.
    function wakeVideoControls() {
        try {
            const p = window.PLAYER && window.PLAYER.player;
            if (p && typeof p.userActive === 'function') {
                p.userActive(true);
                if (typeof p.reportUserActivity === 'function') p.reportUserActivity();
                return;
            }
        } catch (e) { /* fall through to class toggle */ }
        const el = document.querySelector('#videowrap .video-js');
        if (el) { el.classList.add('vjs-user-active'); el.classList.remove('vjs-user-inactive'); }
    }
    // Pin the scrubber up (it normally auto-fades) for as long as a title-bar item is
    // selected on the remote; hide it again the moment focus moves off.
    let _scrubHoldTimer = null;
    function holdScrubber(on) {
        if (on) {
            wakeVideoControls();
            // video.js fades after ~2s idle, so refresh activity well inside that window.
            if (!_scrubHoldTimer) _scrubHoldTimer = setInterval(wakeVideoControls, 1000);
            return;
        }
        if (!_scrubHoldTimer) return;   // we weren't holding — don't touch the controls
        clearInterval(_scrubHoldTimer);
        _scrubHoldTimer = null;
        // We summoned the scrubber for the title bar; dismiss it now that focus has left.
        // (video.js won't auto-fade a paused video, so hide it explicitly.)
        try {
            const p = window.PLAYER && window.PLAYER.player;
            if (p && typeof p.userActive === 'function') p.userActive(false);
        } catch (e) {}
        const el = document.querySelector('#videowrap .video-js');
        if (el) { el.classList.add('vjs-user-inactive'); el.classList.remove('vjs-user-active'); }
    }

    /* ==========================================================
       MOVIE LINKS — TMDB lookup → confirmed IMDb + Letterboxd + Wikipedia
    ========================================================== */

    /* ==========================================================
       NATIVE HTTP (CORS-free) — used for API-key validation and
       any API that doesn't send CORS headers. Falls back gracefully
       when the native bridge isn't present.
    ========================================================== */

    /* ==========================================================
       APP UPDATE CHECK — compares the installed version against the
       latest GitHub Release. If newer, the settings gear is highlighted
       and the settings panel surfaces the release notes + a download link.
       Uses the native CORS-free httpGet against the public GitHub API.
    ========================================================== */

    /* ==========================================================
       GOOGLE DRIVE VIDEO SUPPORT
       Some items in the playlist are Google Drive videos. CyTube can
       play them but needs a privileged cross-origin fetch to
       docs.google.com (normally supplied by a Tampermonkey userscript,
       which we don't have in the app). We expose the same hooks CyTube
       looks for — window.getGoogleDriveMetadata(id, cb) plus the
       hasDriveUserscript / driveUserscriptVersion flags — backed by the
       native HTTP bridge (CORS-free). Ported from
       cytube-google-drive.user.js v1.7.0.
    ========================================================== */
    function initGoogleDrive() {
        const ITAG_QMAP = { 37:1080, 46:1080, 22:720, 45:720, 59:480, 44:480, 35:480, 18:360, 43:360, 34:360 };
        const ITAG_CMAP = { 43:'video/webm', 44:'video/webm', 45:'video/webm', 46:'video/webm',
                            18:'video/mp4', 22:'video/mp4', 37:'video/mp4', 59:'video/mp4',
                            35:'video/flv', 34:'video/flv' };

        // Route each stream through the native localhost media proxy (http://127.0.0.1:<port>/gd?u=…)
        // so the WebView can SEEK against a real HTTP server — shouldInterceptRequest can only stream
        // linearly, which left CyTube's sync-seek stuck on a spinner. 127.0.0.1 is a secure context,
        // so this isn't mixed-content-blocked on the https page.
        let _gdProxyBase = '';
        try {
            if (window.CytubeNative && typeof CytubeNative.gdProxyBase === 'function') {
                _gdProxyBase = CytubeNative.gdProxyBase();
            }
        } catch (e) {}
        function viaProxy(link) {
            return _gdProxyBase ? (_gdProxyBase + encodeURIComponent(link)) : link;
        }

        function mapLinks(links) {
            const videos = { 1080:[], 720:[], 480:[], 360:[] };
            Object.keys(links).forEach(function (itag) {
                itag = parseInt(itag, 10);
                if (!ITAG_QMAP.hasOwnProperty(itag)) return;
                videos[ITAG_QMAP[itag]].push({ itag: itag, contentType: ITAG_CMAP[itag], link: viaProxy(links[itag]) });
            });
            return videos;
        }

        function getVideoInfo(id, cb) {
            const url = 'https://docs.google.com/get_video_info?authuser=&docid=' + id + '&sle=true&hl=en';
            // Google binds the returned stream URL to the User-Agent that requested get_video_info
            // (the `eaua` param). The native bridge would otherwise send a Dalvik UA, which poisons
            // the stream (403 on playback). Send the browser UA — the same one the stream proxy uses.
            nativeHttpGet(url, { 'Accept': '*/*', 'User-Agent': navigator.userAgent }).then(function (res) {
                try {
                    if (!res || res.status !== 200) {
                        return cb('Google Drive request failed: HTTP ' + (res ? res.status : '?'));
                    }
                    const text = res.body || '';
                    // Google sometimes redirects to a login page when cookies are missing.
                    if (/accounts\.google\.com\/ServiceLogin/.test(text)) {
                        return cb('Google Docs request failed: This video requires you be logged ' +
                            'into a Google account. Open your Gmail in another tab and then refresh video.');
                    }
                    const data = {};
                    text.split('&').forEach(function (kv) {
                        const pair = kv.split('=');
                        data[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                    });
                    if (data.status === 'fail') {
                        return cb('Google Drive request failed: ' +
                            unescape(data.reason || '').replace(/\+/g, ' '));
                    }
                    if (!data.fmt_stream_map) {
                        return cb('Google has removed the video streams associated with this item. ' +
                            ' It can no longer be played.');
                    }
                    data.links = {};
                    data.fmt_stream_map.split(',').forEach(function (item) {
                        const pair = item.split('|');
                        data.links[pair[0]] = pair[1];
                    });
                    data.videoMap = mapLinks(data.links);
                    cb(null, data);
                } catch (e) {
                    cb('Google Drive parse error: ' + (e && e.message ? e.message : e));
                }
            }).catch(function (e) {
                cb('Google Drive request failed: ' + (e && e.message ? e.message : 'network error'));
            });
        }

        // Install the real implementation. The native document-start stub may have already
        // set window.getGoogleDriveMetadata to a queueing shim and registered hasDriveUserscript
        // before CyTube's scripts ran; we replace it here and drain anything it queued (e.g. the
        // Drive video that was already loading when the app opened).
        window.__gdRealMeta = getVideoInfo;
        window.getGoogleDriveMetadata = getVideoInfo;
        window.hasDriveUserscript = true;
        window.driveUserscriptVersion = '1.7';
        if (Array.isArray(window.__gdQueue) && window.__gdQueue.length) {
            const queued = window.__gdQueue.splice(0);
            queued.forEach(function (p) { getVideoInfo(p[0], p[1]); });
        }
        console.log('[CyTube SC] Google Drive metadata helper ready');
    }

    /* ==========================================================
       IMDb GraphQL (public endpoint, via native HTTP to dodge CORS)
       The website's own endpoint accepts arbitrary queries, so we send our
       OWN query (no persisted-hash maintenance). Works over GET; reuses the
       native bridge. Data is "non-commercial use only" per IMDb — fine here.
    ========================================================== */

    function isYouTubeMedia() {
        // CyTube exposes current media on the global PLAYER or window.player object.
        // The type field is 'yt' for YouTube. Also check for the YouTube iframe directly.
        try {
            const p = window.PLAYER || window.player;
            if (p && p.type === 'yt') return true;
            if (p && p.mediaType === 'yt') return true;
        } catch (e) {}
        // Fallback: check if a YouTube iframe is present in the video wrapper
        if (document.querySelector('#ytapiplayer iframe[src*="youtube.com"]')) return true;
        if (document.querySelector('#ytapiplayer[src*="youtube.com"]')) return true;
        return false;
    }

    function injectMovieLinks(titleEl) {
        const rawTitle = titleEl.textContent.trim()
            .replace(/^currently\s+playing[:\s]*/i, '')
            .replace(/^now\s+playing[:\s]*/i, '').trim();

        if (!rawTitle || rawTitle === movieState.lastMovieTitle || rawTitle.length < 2) return;
        movieState.lastMovieTitle = rawTitle;

        // Clean up any previous links/stats/trivia button
        ['sc-movie-links', 'sc-movie-stats', 'sc-trivia-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        // Drop stale movie metadata too: if this title turns out to be a non-movie
        // (short bumper that returns below, or unparseable), _npData must NOT linger —
        // otherwise the title observer rebuilds a Trivia button for the old film. The
        // lookup repopulates it below when (and only when) this resolves to a real movie.
        _npData = null;

        // YouTube: usually bumpers/intros, but occasionally a full movie.
        // Only attempt a lookup when the video runs an hour+ (likely a real film),
        // and parse the messy YouTube title differently from a filename.
        const isYt = isYouTubeMedia();
        let ytSeconds = 0;
        if (isYt) {
            ytSeconds = getCurrentMediaSeconds();
            if (ytSeconds < 3600) return; // short YouTube clip — skip
        }

        const { title, year } = isYt ? parseYouTubeTitle(rawTitle) : parseMovieFilename(rawTitle);
        if (!title || title.length < 2) return;

        // Loading placeholder inline with title (only if movie links are enabled)
        if (movieLinksEnabled()) {
            const linkRow = document.createElement('span');
            linkRow.id = 'sc-movie-links';
            linkRow.innerHTML = '<span class="sc-movie-loading">…</span>';
            titleEl.parentElement.insertBefore(linkRow, titleEl.nextSibling);
        }

        lookupMovie(title, year).then((movieData) => {
            const { links, killCount, parentalGuide, cleanTitle, cleanYear } = movieData;

            // For YouTube guesses, sanity-check the match against the real runtime.
            // If TMDB's runtime is wildly off from the video length, it's probably wrong.
            if (isYt) {
                if (!cleanTitle) { const r = document.getElementById('sc-movie-links'); if (r) r.remove(); return; }
                if (movieData.runtime && ytSeconds) {
                    const diff = Math.abs(movieData.runtime - ytSeconds / 60);
                    if (diff > 30) { const r = document.getElementById('sc-movie-links'); if (r) r.remove(); return; }
                }
            }

            // Stash for the Now-Playing hero card. The startup intro handles the
            // first card; only auto-announce SUBSEQUENT films mid-session.
            _npData = movieData;
            if (_npCardEnabled() && _introDone) showNowPlayingCard(movieData, { autoHide: true });
            // Update the title element with the clean TMDB title, wrapped in a
            // dedicated clickable span so ONLY the title (not the rest of the
            // header) opens the now-playing card.
            if (cleanTitle && titleEl) {
                const newText = cleanTitle + (cleanYear ? ` (${cleanYear})` : '');
                let span = titleEl.querySelector(':scope > #sc-title-text') || document.getElementById('sc-title-text');
                if (!span) {
                    span = document.createElement('span');
                    span.id = 'sc-title-text';
                    span.style.cursor = 'pointer';
                    span.title = 'Movie info';
                    span.dataset.noTvCaption = '1'; // title text is self-explanatory; no remote caption
                    span.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (_npData) showNowPlayingCard(_npData, { autoHide: false });
                    });
                    const textNode = [...titleEl.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
                    if (textNode) textNode.parentNode.replaceChild(span, textNode);
                    else titleEl.insertBefore(span, titleEl.firstChild);
                }
                span.textContent = newText;
            }
            // ── Icon links row (skipped entirely when links are disabled) ──────
            const currentRow = document.getElementById('sc-movie-links');
            if (currentRow) {
                currentRow.innerHTML = '';
                let anyLink = false;
                LINK_DEFS.forEach(({ key, label, color, fg, char }) => {
                    const url = links[key];
                    if (!url) return;
                    anyLink = true;
                    const a = document.createElement('a');
                    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                    a.title = `${label}: "${title}"${year ? ` (${year})` : ''}`;
                    a.className = 'sc-movie-link';
                    a.style.background = color;
                    a.style.color = fg;
                    a.textContent = char;
                    currentRow.appendChild(a);
                });
                if (!anyLink) currentRow.remove();
            }

            // ── Stats bar (kill count) ────────────────────────────────────────
            // Stats go in a fixed floating bar over the bottom of the video,
            // not inside #videowrap-header which is too small to contain a div.
            const statParts = [];
            if (killCount !== null) statParts.push(`💀 ${killCount} on-screen kills`);

            const old = document.getElementById('sc-movie-stats');
            if (old) old.remove();

            if (statParts.length) {
                const statsEl = document.createElement('div');
                statsEl.id = 'sc-movie-stats';
                statsEl.textContent = statParts.join('  ·  ');
                document.body.appendChild(statsEl);
                // Auto-hide after 12 seconds so it doesn't clutter the screen
                setTimeout(() => { if (statsEl.parentNode) statsEl.remove(); }, 12000);
            }
        });
    }

    // Drop CyTube's "Currently Playing:" / "Now Playing:" prefix from the displayed
    // title — both when it's part of a text node and when it's its own element.
    const _PLAYING_RE = /^\s*(currently|now)\s+playing\s*:?\s*/i;
    function stripPlayingPrefix(el) {
        el.querySelectorAll('strong, b, span, .label').forEach(c => {
            if (c.childElementCount === 0 && /^\s*(currently|now)\s+playing\s*:?\s*$/i.test(c.textContent)) {
                c.style.display = 'none';
            }
        });
        el.childNodes.forEach(n => {
            if (n.nodeType === 3 && _PLAYING_RE.test(n.textContent)) {
                n.textContent = n.textContent.replace(_PLAYING_RE, '');
            }
        });
    }

    function triggerTitleInject() {
        for (const el of [
            document.getElementById('currenttitle'),
            document.querySelector('#videowrap-header .pull-left'),
            document.querySelector('#videowrap-header span'),
            document.querySelector('.video-title'),
        ]) {
            if (el && el.textContent.trim()) { stripPlayingPrefix(el); injectMovieLinks(el); return; }
        }
    }

    let _titleObsAttached = false;
    function attachHeaderObserver() {
        if (_titleObsAttached) return;
        const header = document.getElementById('videowrap-header');
        if (!header) return;
        _titleObsAttached = true;
        new MutationObserver(triggerTitleInject).observe(header, { childList: true, subtree: true, characterData: true });
    }

    function watchMovieTitle() {
        triggerTitleInject();
        attachHeaderObserver();
        // First-load robustness: on a cold load the title/header often aren't ready
        // when we boot, so poll for ~20s — attaching the observer once the header
        // exists and re-trying the lookup until the title resolves.
        let tries = 0;
        const poll = setInterval(() => {
            attachHeaderObserver();
            triggerTitleInject();
            if (++tries >= 14) clearInterval(poll);
        }, 1500);
    }

    // Capture media duration + type from CyTube's socket so we can tell a
    // full-length YouTube movie from a short bumper. Re-runs the lookup on change.
    function initMediaWatcher() {
        if (typeof socket === 'undefined' || !socket || typeof socket.on !== 'function') {
            setTimeout(initMediaWatcher, 600);
            return;
        }
        let _lastMediaKey = '';
        let _lastChangeMediaData = null;
        let _roomPaused = false;
        let _resyncArmed = false;
        let _resyncTimer = null;

        // Duration (seconds) of the media the player has ACTUALLY loaded — YouTube via its API
        // (the iframe is cross-origin, so a <video> query can't reach inside it), everything
        // else via the <video> element. This is ground truth for "what's really playing".
        const renderedDuration = () => {
            try { const p = window.PLAYER; if (p && p.yt && typeof p.yt.getDuration === 'function') { const d = p.yt.getDuration(); if (d > 0) return d; } } catch (e) {}
            try { const v = document.querySelector('#ytapiplayer video, video'); if (v && v.duration > 0 && isFinite(v.duration)) return v.duration; } catch (e) {}
            return null;
        };
        // Current playhead position (seconds), same source priority as renderedDuration.
        const playheadProbe = () => {
            try { const p = window.PLAYER; if (p && p.yt && typeof p.yt.getCurrentTime === 'function') { const t = p.yt.getCurrentTime(); if (typeof t === 'number') return t; } } catch (e) {}
            try { const v = document.querySelector('#ytapiplayer video, video'); if (v && typeof v.currentTime === 'number') return v.currentTime; } catch (e) {}
            return null;
        };
        // Rebuild ONLY the in-page player from a changeMedia payload. CyTube's loadMediaPlayer
        // constructs a fresh player object (replacing window.PLAYER) and seeks it to the room's
        // sync position — exactly what a dead player needs, with no page reload (chat/UI stay put).
        const rebuildPlayer = (d) => {
            try { if (typeof loadMediaPlayer === 'function' && d) loadMediaPlayer(d); } catch (e) {}
        };
        // Rebuild the player ONLY if it's genuinely stale — never on a healthy resume. Two
        // signals, both judged only while the room is PLAYING (a still playhead is normal when
        // paused): (1) the loaded media's duration doesn't match the room's current media length
        // — the classic "old movie keeps playing after the room moved on"; (2) right media but
        // the playhead isn't advancing — a stuck/dead player. A healthy resume (right media,
        // advancing) matches on duration and is left completely untouched.
        const maybeRebuildIfStale = () => {
            try {
                const d = _lastChangeMediaData;
                if (!d || _roomPaused) return;
                const expected = (typeof d.seconds === 'number' && d.seconds > 0) ? d.seconds : null;
                const rendered = renderedDuration();
                if (expected != null && rendered != null && Math.abs(rendered - expected) > 4) {
                    rebuildPlayer(d);              // (1) wrong media loaded
                    return;
                }
                const t1 = playheadProbe();        // (2) right media — is the playhead advancing?
                if (t1 == null) return;
                setTimeout(() => {
                    if (_roomPaused) return;
                    const t2 = playheadProbe();
                    if (t2 != null && Math.abs(t2 - t1) < 0.25) rebuildPlayer(d);
                }, 2000);
            } catch (e) {}
        };
        // Called by native (MainActivity.onStart) when the app returns from the background, and
        // self-triggered on socket reconnect. The player object dies during a long suspend; on
        // return CyTube re-syncs chat + the title, but its PLAYER.load() no-ops against the dead
        // player so the OLD video plays forever. We arm a one-shot staleness check that runs once
        // the reconnect's fresh changeMedia has refreshed our notion of the room's current media,
        // so we rebuild ONLY when the player is actually dead — never on a healthy resume. A
        // safety timer runs the check even if no changeMedia arrives. Older builds without
        // loadMediaPlayer fall back to a full reload so playback still recovers.
        const armStaleCheck = () => {
            if (typeof loadMediaPlayer !== 'function') { location.reload(); return; }
            _resyncArmed = true;
            clearTimeout(_resyncTimer);
            _resyncTimer = setTimeout(() => { if (_resyncArmed) { _resyncArmed = false; maybeRebuildIfStale(); } }, 10000);
        };
        window.__scStaleResync = armStaleCheck;

        socket.on('changeMedia', (data) => {
            try {
                _lastChangeMediaData = data;
                if (data && typeof data.paused === 'boolean') _roomPaused = data.paused;
                // First changeMedia after a resume/reconnect: the room's current media is now
                // known. Give the player a few seconds to actually switch, then judge staleness.
                if (_resyncArmed) {
                    _resyncArmed = false;
                    clearTimeout(_resyncTimer);
                    setTimeout(maybeRebuildIfStale, 4000);
                }
                currentMediaSeconds = (data && typeof data.seconds === 'number') ? data.seconds : 0;
                currentMediaType    = (data && data.type) ? data.type : '';
                // Only treat this as a NEW film when the media actually changed —
                // CyTube re-emits changeMedia on reconnect/resume (e.g. coming back
                // from PiP), which must not re-trigger the lookup/announcement card.
                const key = (data && (data.id || '')) + '|' + (data && (data.title || ''));
                if (key === _lastMediaKey) return;
                _lastMediaKey = key;
                movieState.lastMovieTitle = '';                 // force a fresh lookup
                // Forget the previous film's metadata up front so the title observer
                // can't rebuild a stale Trivia button over the next video (e.g. a short
                // bumper with no trivia). It's recreated only once the new lookup lands
                // on a real movie. Drop the button now too in case one is showing.
                _npData = null;
                const _staleTrivia = document.getElementById('sc-trivia-btn');
                if (_staleTrivia) _staleTrivia.remove();
                // New media: drop any DRM overlay, and (for YouTube) start watching for the
                // no-Widevine failure that DRM "YouTube Movies" titles hit on this device.
                clearTimeout(_drmCheckTimer);
                hideDrmOverlay();
                if (currentMediaType === 'yt') _drmCheckTimer = setTimeout(() => checkYtDrm(0), 1500);
                setTimeout(triggerTitleInject, 350); // let the title DOM settle first
            } catch (e) {}
        });
        // Keep the live playhead fresh for the progress card (fires ~every second while
        // the room is synced; the desync "free watch" toggle strips these listeners, which
        // is fine — the synced position is meaningless then anyway).
        socket.on('mediaUpdate', (data) => {
            if (data && typeof data.currentTime === 'number') currentPlaybackTime = data.currentTime;
            if (data && typeof data.paused === 'boolean') _roomPaused = data.paused;
        });
        // Genuine network drops (not just app suspends) can also leave a dead player behind, so
        // re-run the staleness check whenever the socket reconnects. Harmless when it's healthy.
        let _wasDisconnected = false;
        socket.on('disconnect', () => { _wasDisconnected = true; });
        socket.on('connect', () => { if (_wasDisconnected) { _wasDisconnected = false; armStaleCheck(); } });
        // The video already playing at launch never fires changeMedia, so check it once.
        setTimeout(() => { if (window.PLAYER && window.PLAYER.mediaType === 'yt') checkYtDrm(0); }, 2500);
    }

    // Hover (pointer / keyboard-TV) or long-press (touch phone) a chat message to see
    // when it was sent, in the viewer's LOCAL timezone. CyTube only renders the channel's
    // clock time with no date, so we grab the epoch `time` straight off the chatMsg socket
    // event instead of trying to parse the rendered DOM. [[tv-remote-navigation]]
    function initChatTimestamps() {
        if (typeof socket === 'undefined' || !socket || typeof socket.on !== 'function') {
            setTimeout(initChatTimestamps, 600);
            return;
        }
        const fmt = (ms) => {
            try {
                return new Date(ms).toLocaleString([], {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', second: '2-digit'
                });
            } catch (e) { return ''; }
        };
        // CyTube registered its own chatMsg handler long before our script injected, so by
        // the time ours runs the message div is already the last child of #messagebuffer.
        socket.on('chatMsg', (data) => {
            try {
                if (!data || typeof data.time !== 'number') return;
                const buf = document.getElementById('messagebuffer');
                const node = buf && buf.lastElementChild;
                if (!node || node.dataset.scTs) return;
                node.dataset.scTs = String(data.time);
                node.title = 'Sent ' + fmt(data.time);   // native hover tooltip
            } catch (e) {}
        });

        // Touch devices have no hover — long-press a message to reveal the same time in a
        // small floating tip. Delegated on document so it survives messagebuffer rebuilds.
        const showTip = (node, x, y) => {
            const ts = node && node.dataset && node.dataset.scTs;
            if (!ts) return;
            let tip = document.getElementById('sc-chat-ts-tip');
            if (!tip) {
                tip = document.createElement('div');
                tip.id = 'sc-chat-ts-tip';
                tip.style.cssText =
                    'position:fixed;z-index:2147483646;max-width:80vw;padding:6px 10px;' +
                    'border-radius:8px;background:rgba(8,6,12,0.95);color:#fff;font-size:13px;' +
                    'font-weight:600;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5);' +
                    'border:1px solid rgba(255,255,255,0.15);transform:translateX(-50%);';
                document.body.appendChild(tip);
            }
            tip.textContent = 'Sent ' + fmt(Number(ts));
            tip.style.display = 'block';
            tip.style.top = Math.max(8, y - 44) + 'px';
            tip.style.left = Math.min(Math.max(x, 8), window.innerWidth - 8) + 'px';
            clearTimeout(tip._hideT);
            tip._hideT = setTimeout(() => { tip.style.display = 'none'; }, 2500);
        };
        let pressTimer = null;
        document.addEventListener('touchstart', (e) => {
            const node = e.target.closest && e.target.closest('#messagebuffer [class*="chat-msg-"]');
            if (!node) return;
            const t = e.touches[0];
            const x = t.clientX, y = t.clientY;
            pressTimer = setTimeout(() => showTip(node, x, y), 500);
        }, { passive: true });
        const cancelPress = () => clearTimeout(pressTimer);
        document.addEventListener('touchend', cancelPress, { passive: true });
        document.addEventListener('touchmove', cancelPress, { passive: true });
        document.addEventListener('touchcancel', cancelPress, { passive: true });
    }

    /* ==========================================================
       YOUTUBE DRM FALLBACK (YouTube Movies)
       This WebView has no Widevine CDM, so DRM-protected YouTube
       "Movies" titles fail with errorCode 'fmt.noneavailable'.
       Detect that and show a friendly overlay that offers to open
       the video externally (the native YouTube app/browser can
       decrypt it). See [[google-drive-playback-debug]] sibling notes.
    ========================================================== */
    let _drmCheckTimer = null;

    function openExternalUrl(url) {
        try {
            if (window.CytubeNative && typeof CytubeNative.openExternal === 'function') {
                CytubeNative.openExternal(url);
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {}
    }

    function hideDrmOverlay() {
        const o = document.getElementById('sc-drm-overlay');
        if (o) o.remove();
    }

    function showDrmOverlay(videoId, title) {
        hideDrmOverlay();
        const wrap = document.getElementById('videowrap') || document.body;
        if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        // Open the whole channel in a real browser (which has Widevine) rather than the bare
        // YouTube app — that keeps the full Grindhouse room (synced video + chat) and the DRM
        // title plays inside it.
        const url = 'https://cytu.be/r/420Grindhouse';
        const safeTitle = (title || 'This title').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        const o = document.createElement('div');
        o.id = 'sc-drm-overlay';
        o.innerHTML =
            '<div id="sc-drm-box">' +
            '<div id="sc-drm-icon">🔒</div>' +
            '<div id="sc-drm-title">' + safeTitle + ' can’t play in the app</div>' +
            '<div id="sc-drm-msg">It’s a DRM-protected <b>YouTube Movies</b> title and the in-app player ' +
            'can’t decrypt it. Open <b>Grindhouse</b> in your browser — it plays there, with the room ' +
            'and chat still in sync.</div>' +
            '<div id="sc-drm-actions"><button id="sc-drm-open" class="sc-drm-btn">Open Grindhouse in Browser</button></div>' +
            '</div>';
        wrap.appendChild(o);
        const btn = document.getElementById('sc-drm-open');
        if (btn) btn.addEventListener('click', () => openExternalUrl(url));
    }

    function checkYtDrm(tries) {
        const p = window.PLAYER;
        if (!p || p.mediaType !== 'yt') { hideDrmOverlay(); return; }
        let vd = null;
        try { vd = (p.yt && p.yt.getVideoData) ? p.yt.getVideoData() : null; } catch (e) {}
        if (vd && vd.errorCode) {            // e.g. 'fmt.noneavailable' for un-decryptable DRM titles
            showDrmOverlay(vd.video_id, vd.title);
            return;
        }
        if ((tries || 0) < 10) {             // player may still be resolving — retry a few seconds
            _drmCheckTimer = setTimeout(() => checkYtDrm((tries || 0) + 1), 1000);
        }
    }

    /* ==========================================================
       NOW-PLAYING HERO CARD (cinematic shell)
       Full-screen card with backdrop art, poster, rating, runtime,
       genres and content warnings. Shows on new media + on pause,
       fades away on play. TV-first; trivially enableable on mobile.
    ========================================================== */

    // Shorter labels for the IMDb parent-guide categories so chips stay compact
    const NP_PG_SHORT = {
        'Sex & Nudity': 'Sex/Nudity',
        'Violence & Gore': 'Violence',
        'Profanity': 'Profanity',
        'Alcohol, Drugs & Smoking': 'Drugs',
        'Frightening & Intense Scenes': 'Frightening',
    };

    let _npData = null;          // latest movie data for the card
    let _introDone = false;      // startup intro card has run (see initIntroSequence)
    let _npHideTimer = null;
    let _npProgTimer = null;
    let _npWatcherInit = false;

    // Refresh the now-playing card's elapsed / total / remaining readout in place.
    function _renderNpProgress() {
        const card = document.getElementById('sc-np-card');
        if (!card) { clearInterval(_npProgTimer); return; }
        const wrap    = card.querySelector('#sc-np-progress');
        const fill    = card.querySelector('#sc-np-prog-fill');
        const elapsedEl = card.querySelector('#sc-np-prog-elapsed');
        const totalEl   = card.querySelector('#sc-np-prog-total');
        const remainEl  = card.querySelector('#sc-np-prog-remain');
        if (!wrap || !fill) return;

        const dur = getCurrentMediaSeconds();
        if (dur > 0) {
            const elapsed = Math.min(getCurrentPlaybackSeconds(), dur);
            const pct = Math.max(0, Math.min(100, (elapsed / dur) * 100));
            // Must be set !important: the stylesheet pins #sc-np-prog-fill to
            // `width: 0% !important`, which a plain inline width can't override — so the
            // bar would otherwise stay empty no matter the playhead.
            fill.style.setProperty('width', pct + '%', 'important');
            elapsedEl.textContent = formatHMS(elapsed);
            totalEl.textContent   = formatHMS(dur);
            remainEl.textContent  = '−' + formatHMS(dur - elapsed) + ' left';
            wrap.style.display = '';
        } else {
            // No known duration (live stream / unidentified) — nothing useful to show.
            wrap.style.display = 'none';
        }
    }

    // Currently TV-only so the tuned mobile layout is untouched.
    // Flip to `true` to enable the card on phones too.
    function _npCardEnabled() { return isTv; }

    // Long synopses overflow the fixed overview window. Start at the top (so the
    // opening lines read first), then after a beat glide smoothly to the bottom so
    // the whole thing can be read hands-free on the remote. Returns the total ms the
    // reveal will take so the auto-hide timer can wait for it to finish.
    let _npScrollTimer = null, _npScrollRaf = null;
    const _NP_SCROLL_DELAY = 3500;
    function _autoScrollOverview() {
        clearTimeout(_npScrollTimer);
        cancelAnimationFrame(_npScrollRaf);
        const card = document.getElementById('sc-np-card');
        const ov = card && card.querySelector('#sc-np-overview');
        if (!ov) return 0;
        ov.scrollTop = 0;
        const dist = ov.scrollHeight - ov.clientHeight;
        if (dist <= 4) return 0;                          // fits — nothing to reveal
        const dur = Math.min(12000, Math.max(2500, (dist / 24) * 1000)); // ~24px/s reading pace
        _npScrollTimer = setTimeout(() => {
            const start = ov.scrollTop;
            const span = ov.scrollHeight - ov.clientHeight - start;
            if (span <= 0) return;
            const t0 = performance.now();
            const step = (now) => {
                const c = document.getElementById('sc-np-card');
                if (!c || !c.classList.contains('sc-np-visible')) return; // dismissed mid-scroll
                const p = Math.min(1, (now - t0) / dur);
                const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
                ov.scrollTop = start + span * e;
                if (p < 1) _npScrollRaf = requestAnimationFrame(step);
            };
            _npScrollRaf = requestAnimationFrame(step);
        }, _NP_SCROLL_DELAY);
        return _NP_SCROLL_DELAY + dur;
    }

    function showNowPlayingCard(data, opts = {}) {
        if (!data || (!data.cleanTitle && !data.backdrop)) return;

        let card = document.getElementById('sc-np-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'sc-np-card';
            card.innerHTML = `
                <div id="sc-np-backdrop"></div>
                <div id="sc-np-scrim"></div>
                <div id="sc-np-content">
                    <img id="sc-np-poster" alt="" />
                    <div id="sc-np-info">
                        <div id="sc-np-eyebrow">Now Playing</div>
                        <div id="sc-np-title"></div>
                        <div id="sc-np-meta"></div>
                        <div id="sc-np-overview"></div>
                        <div id="sc-np-chips"></div>
                        <div id="sc-np-progress">
                            <div id="sc-np-prog-bar"><div id="sc-np-prog-fill"></div></div>
                            <div id="sc-np-prog-times">
                                <span id="sc-np-prog-elapsed">0:00</span>
                                <span id="sc-np-prog-remain"></span>
                                <span id="sc-np-prog-total">0:00</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(card);
            // Tapping/clicking the card dismisses it
            card.addEventListener('click', hideNowPlayingCard);
        }

        const title  = data.cleanTitle || movieState.lastMovieTitle || '';
        const year   = data.cleanYear ? ` (${data.cleanYear})` : '';
        const bd      = card.querySelector('#sc-np-backdrop');
        const poster  = card.querySelector('#sc-np-poster');
        const meta    = card.querySelector('#sc-np-meta');
        const chips   = card.querySelector('#sc-np-chips');

        bd.style.backgroundImage = data.backdrop ? `url(${data.backdrop})` : 'none';
        if (data.poster) { poster.src = data.poster; poster.style.display = ''; }
        else poster.style.display = 'none';

        card.querySelector('#sc-np-title').textContent = title + year;
        card.querySelector('#sc-np-overview').textContent = data.overview || '';

        const metaParts = [];
        if (data.rating)  metaParts.push(`⭐ ${data.rating}`);
        if (data.runtime) metaParts.push(`${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`);
        if (data.genres && data.genres.length) metaParts.push(data.genres.slice(0, 3).join(' · '));
        meta.textContent = metaParts.join('     ');

        // IMDb Parent Guide chips (color-coded by severity) + kill count
        const chipHtml = [];
        (data.parentalGuide || []).forEach(pg => {
            const sev = String(pg.severity || '').toLowerCase();
            const label = NP_PG_SHORT[pg.category] || pg.category;
            chipHtml.push(`<span class="sc-np-chip sc-sev-${sev}">${label}: ${pg.severity}</span>`);
        });
        if (data.killCount !== null && data.killCount !== undefined) {
            chipHtml.push(`<span class="sc-np-chip">💀 ${data.killCount} kills</span>`);
        }
        chips.innerHTML = chipHtml.join('');

        card.classList.add('sc-np-visible');

        // Live elapsed / total / remaining bar — refreshes while the card is up.
        // This is the remote-friendly stand-in for hovering a scrubber: summon the
        // card (title button / 'i') and the progress updates in place.
        _renderNpProgress();
        clearInterval(_npProgTimer);
        _npProgTimer = setInterval(_renderNpProgress, 500);

        // Reveal a long synopsis by gliding to its bottom after a few seconds.
        const revealMs = _autoScrollOverview();

        clearTimeout(_npHideTimer);
        if (opts.autoHide) {
            // Only auto-hide if the video is actually playing
            const v = document.querySelector('#videowrap video');
            const playing = v && !v.paused;
            // Stay up long enough to finish revealing a long description (+ a tail to read it).
            if (playing || !v) _npHideTimer = setTimeout(hideNowPlayingCard, Math.max(7000, revealMs + 2500));
        }
    }

    function hideNowPlayingCard() {
        const card = document.getElementById('sc-np-card');
        if (card) card.classList.remove('sc-np-visible');
        clearTimeout(_npHideTimer);
        clearInterval(_npProgTimer);
        clearTimeout(_npScrollTimer);
        cancelAnimationFrame(_npScrollRaf);
    }

    /* ==========================================================
       TRIVIA CARD — scrollable IMDb trivia, summoned by 't' or the title button
    ========================================================== */
    function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function showTriviaCard() {
        const tconst = _npData && _npData.imdbId;
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
            'Trivia' + (_npData.cleanTitle ? ' — ' + _npData.cleanTitle : '');
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
    function hideTriviaCard() {
        const card = document.getElementById('sc-trivia-card');
        if (card) card.classList.remove('sc-show');
    }
    function toggleTriviaCard() {
        const card = document.getElementById('sc-trivia-card');
        if (card && card.classList.contains('sc-show')) hideTriviaCard();
        else showTriviaCard();
    }

    // The card announces a NEW film automatically (handled in injectMovieLinks).
    // For a live sync stream, pausing is meaningless, so instead let the user
    // summon the card on demand: press 'i' (info) or click/tap the title bar.
    function initNowPlayingWatcher() {
        if (_npWatcherInit) return;
        _npWatcherInit = true;

        const toggle = () => {
            const card = document.getElementById('sc-np-card');
            if (card && card.classList.contains('sc-np-visible')) hideNowPlayingCard();
            else if (_npData) showNowPlayingCard(_npData, { autoHide: false });
        };

        document.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
            if (e.key === 'i' || e.key === 'I') toggle();
            else if (e.key === 't' || e.key === 'T') toggleTriviaCard();
        });

        // Click/tap the title bar opens the card; inject a small Trivia button too.
        const bindTitle = () => {
            const h = document.getElementById('videowrap-header');
            if (!h) return;
            // (The card opens from the title text itself — see #sc-title-text in injectMovieLinks.)
            // Small "Trivia" button next to the title (only once we have a movie with IMDb id)
            if (_npData && _npData.imdbId && !document.getElementById('sc-trivia-btn')) {
                const btn = document.createElement('button');
                btn.id = 'sc-trivia-btn'; btn.type = 'button'; btn.textContent = 'Trivia';
                btn.addEventListener('click', (e) => { e.stopPropagation(); showTriviaCard(); });
                // If the top bar is already faded when we (re)create the button, match
                // that state immediately. Otherwise it pops in at full opacity and only
                // fades on the next wake→dim cycle — i.e. you'd have to wave the cursor
                // over it to make it disappear.
                if (document.body.classList.contains('sc-video-dimmed')) btn.classList.add('sc-bar-dim');
                h.appendChild(btn);
            }
        };
        bindTitle();
        new MutationObserver(bindTitle).observe(document.body, { childList: true, subtree: true });
    }

    /* ==========================================================
       USER COLOR SYSTEM
    ========================================================== */

    function applyUserColors() {
        document.querySelectorAll('#messagebuffer [class*="chat-msg-"]').forEach(el => {
            const cls = [...el.classList].find(c => c.startsWith('chat-msg-'));
            if (!cls) return;
            const span = el.querySelector('.username');
            if (span) { span.style.color = usernameToColor(cls.replace('chat-msg-', '')); span.style.fontWeight = '700'; }
        });
    }
    let _colorObserverStarted = false;
    function startUserColorObserver() {
        const buf = document.getElementById('messagebuffer');
        if (!buf) return;
        if (_colorObserverStarted) { applyUserColors(); return; }
        _colorObserverStarted = true;
        new MutationObserver(applyUserColors).observe(buf, { childList: true, subtree: true });
        applyUserColors();
    }

    /* ==========================================================
       SETTINGS MODAL
       First-run: shown automatically if TMDB key is absent.
       Re-openable via the ⚙ button added to the floating buttons.
    ========================================================== */

    function openSettingsModal() {
        const old = document.getElementById('sc-settings-overlay');
        if (old) old.remove();

        const tmdbVal  = getKey(LS_TMDB);
        // "First run" = the very first time the app is opened, not whether a key exists.
        // The key is always optional; we only use this to show the intro copy once.
        const firstRun = !localStorage.getItem(LS_ONBOARDED);
        try { localStorage.setItem(LS_ONBOARDED, '1'); } catch (e) {}

        const overlay = document.createElement('div');
        overlay.id = 'sc-settings-overlay';
        overlay.innerHTML = `
            <div id="sc-settings-modal">
                <div id="sc-settings-title">⚙ Grindhouse Settings</div>
                ${firstRun ? '<div class="sc-settings-intro">First-time setup — everything here is optional. Log in to chat, and enable TMDB for richer movie info. Reopen any time with the ⚙ button.</div>' : ''}

                <div class="sc-settings-group">
                    <label class="sc-settings-label">CyTube Account
                        <span class="sc-settings-note">Opens the CyTube login page — your settings here are saved first</span>
                    </label>
                    <button id="sc-login-btn" class="sc-settings-btn-wide" type="button">Log in / Switch Account</button>
                </div>

                <div class="sc-settings-group sc-settings-divider">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-tmdb-enable" ${tmdbVal ? 'checked' : ''} />
                            <span class="sc-toggle-text">Enable TMDB features</span>
                        </span>
                        <span class="sc-settings-note">Movie posters, ratings, runtime, IMDb/Letterboxd links</span>
                    </label>
                    <div id="sc-tmdb-fields" class="${tmdbVal ? '' : 'sc-hidden'}">
                        <div class="sc-settings-input-row">
                            <input id="sc-input-tmdb" class="sc-settings-input" type="text"
                                placeholder="Paste TMDB v3 key…" value="${tmdbVal}" spellcheck="false" />
                            <button id="sc-test-tmdb" class="sc-settings-test" type="button">Test</button>
                        </div>
                        <span id="sc-test-tmdb-status" class="sc-settings-test-status"></span>
                        <a class="sc-settings-link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">
                            Get a free TMDB key ↗
                        </a>
                    </div>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-spellcheck" ${spellCheckEnabled() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Grammar &amp; spell check popup</span>
                        </span>
                        <span class="sc-settings-note">When off, messages send immediately without review</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Disable on-screen keyboard</span>
                        </span>
                        <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-movielinks" ${movieLinksEnabled() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Show movie links (IMDb / Letterboxd / Wiki)</span>
                        </span>
                        <span class="sc-settings-note">Adds clickable link badges next to the title — usually unneeded on a TV</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-couch" ${couchModeEnabled() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Couch Mode</span>
                        </span>
                        <span class="sc-settings-note">When typing in sidebar chat, the input grows into a big, easy-to-read box over the video</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-watchalong" ${watchAlongEnabled() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Watch-Only Mode</span>
                        </span>
                        <span class="sc-settings-note">Hides the chat input and the guest-login box — just read along, no typing</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <span class="sc-toggle-row">
                            <input type="checkbox" id="sc-input-castmute" ${castFallbackMuted() ? 'checked' : ''} />
                            <span class="sc-toggle-text">Mute fallback audio while casting</span>
                        </span>
                        <span class="sc-settings-note">When a clip can't be cast (e.g. YouTube) it plays on this device instead — turn this on to keep that playback muted by default</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-label">
                        Chat font size
                        <span class="sc-settings-note" id="sc-font-val">${getChatFontSize()}px</span>
                    </label>
                    <input type="range" id="sc-input-fontsize" class="sc-settings-range"
                        min="11" max="28" step="1" value="${getChatFontSize()}" />
                    <div id="sc-font-sample" class="sc-font-sample" style="font-size:${getChatFontSize()}px">
                        Someone: that movie was wild
                    </div>
                </div>

                <div class="sc-settings-group sc-settings-divider" id="sc-update-group">
                    <label class="sc-settings-label">App Updates
                        <span class="sc-settings-note" id="sc-update-current">Installed: v${_appVersion() || '?'}</span>
                    </label>
                    <div id="sc-update-status" class="sc-settings-note">Checking for updates…</div>
                    <div id="sc-update-notes" class="sc-update-notes sc-hidden"></div>
                    <div class="sc-settings-input-row">
                        <button id="sc-update-check" class="sc-settings-test" type="button">Check now</button>
                    </div>
                    <button id="sc-update-download" class="sc-settings-btn-wide sc-hidden" type="button">Get the update on GitHub ↗</button>
                </div>

                <div id="sc-settings-actions">
                    <button id="sc-settings-cancel">${firstRun ? 'Skip for now' : 'Cancel'}</button>
                    <button id="sc-settings-save">Save</button>
                </div>
                <div id="sc-settings-status"></div>
            </div>`;

        document.body.appendChild(overlay);

        // The TMDB key is optional — always allow closing (backdrop tap or Cancel/Skip).
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        document.getElementById('sc-settings-cancel').addEventListener('click', () => overlay.remove());

        // Reveal/hide the TMDB key fields with the enable checkbox
        const tmdbEnable = document.getElementById('sc-input-tmdb-enable');
        const tmdbFields = document.getElementById('sc-tmdb-fields');
        if (tmdbEnable && tmdbFields) {
            tmdbEnable.addEventListener('change', () => {
                tmdbFields.classList.toggle('sc-hidden', !tmdbEnable.checked);
                // Use the TV nav's focus setter (not raw .focus()) so the remote's focus
                // ring tracks the key field — otherwise a later "right" navigates from the
                // stale checkbox (nothing to its right) instead of landing on Test.
                if (tmdbEnable.checked) {
                    const i = document.getElementById('sc-input-tmdb');
                    if (i) { if (_tvSetFocus) _tvSetFocus(i); else i.focus(); }
                }
            });
        }

        // Persist the non-live settings (TMDB key + spellcheck). The toggles for keyboard,
        // movie-links and font size already save themselves on change. Used by Save AND by
        // Login, so navigating to the login page never loses what you just entered.
        const persistSettings = () => {
            const enabled = tmdbEnable && tmdbEnable.checked;
            const input = document.getElementById('sc-input-tmdb');
            setKey(LS_TMDB, (enabled && input) ? input.value.trim() : '');
            const sc = document.getElementById('sc-input-spellcheck');
            if (sc) setKey(LS_SPELLCHECK, sc.checked ? 'on' : 'off');
            movieState.movieLinkCache = {};   // flush so the re-lookup hits the network
            movieState.lastMovieTitle = '';   // allow injectMovieLinks to re-run for the current title
            triggerTitleInject();  // immediately re-fetch with the new key
        };

        document.getElementById('sc-settings-save').addEventListener('click', () => {
            persistSettings();
            const status = document.getElementById('sc-settings-status');
            status.textContent = '✓ Saved';
            setTimeout(() => overlay.remove(), 800);
        });

        document.getElementById('sc-login-btn').addEventListener('click', () => {
            persistSettings();     // don't lose entries when we navigate away to log in
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        });

        // ── API key validation ───────────────────────────────────────────────
        const wireTest = (btnId, inputId, statusId, validator) => {
            const btn    = document.getElementById(btnId);
            const input  = document.getElementById(inputId);
            const status = document.getElementById(statusId);
            btn.addEventListener('click', async () => {
                const key = input.value.trim();
                if (!key) { status.className = 'sc-settings-test-status sc-test-bad'; status.textContent = 'Enter a key first'; return; }
                btn.disabled = true;
                status.className = 'sc-settings-test-status sc-test-pending';
                status.textContent = 'Checking…';
                const result = await validator(key);
                btn.disabled = false;
                if (result === 'valid')      { status.className = 'sc-settings-test-status sc-test-ok';  status.textContent = '✓ Valid key'; }
                else if (result === 'invalid') { status.className = 'sc-settings-test-status sc-test-bad'; status.textContent = '✗ Invalid key'; }
                else                          { status.className = 'sc-settings-test-status sc-test-bad'; status.textContent = '⚠ Couldn’t reach the API'; }
            });
        };
        wireTest('sc-test-tmdb', 'sc-input-tmdb', 'sc-test-tmdb-status', validateTmdbKey);

        // ── Chat font-size slider (live preview + persist) ───────────────────
        const fontInput  = document.getElementById('sc-input-fontsize');
        const fontVal    = document.getElementById('sc-font-val');
        const fontSample = document.getElementById('sc-font-sample');
        fontInput.addEventListener('input', () => {
            const px = parseInt(fontInput.value, 10);
            fontVal.textContent = px + 'px';
            fontSample.style.fontSize = px + 'px';
            setKey(LS_CHAT_FONT, String(px)); // persist immediately
            applyChatFontSize(px);            // live preview in the real chat
        });

        // ── Disable on-screen keyboard toggle (applies immediately) ──────────
        const nokb = document.getElementById('sc-input-nokb');
        if (nokb) nokb.addEventListener('change', () => {
            setKey(LS_NOKEYBOARD, nokb.checked ? 'on' : 'off');
            applySoftKeyboard();
        });

        // ── Couch Mode toggle (applies immediately) ──────────────────────────
        const couch = document.getElementById('sc-input-couch');
        if (couch) couch.addEventListener('change', () => {
            setKey(LS_COUCH, couch.checked ? 'on' : 'off');
            applyCouchMode();
        });

        // ── Watch-Only Mode toggle (applies immediately) ─────────────────────
        const watchalong = document.getElementById('sc-input-watchalong');
        if (watchalong) watchalong.addEventListener('change', () => {
            setKey(LS_WATCHALONG, watchalong.checked ? 'on' : 'off');
            applyWatchAlong();
        });

        // ── Cast fallback mute toggle (applies on next fallback; reflects now if casting) ─
        const castmute = document.getElementById('sc-input-castmute');
        if (castmute) castmute.addEventListener('change', () => {
            setKey(LS_CAST_MUTE, castmute.checked ? 'on' : 'off');
            // If a fallback clip is already playing on this device, honour the change live.
            if (document.body.classList.contains('sc-cast-fallback') && window.__scApplyCastFallbackAudio) {
                window.__scApplyCastFallbackAudio();
            }
        });

        // ── Movie-links toggle (applies on next media; clears current row now) ─
        const mlinks = document.getElementById('sc-input-movielinks');
        if (mlinks) mlinks.addEventListener('change', () => {
            setKey(LS_MOVIE_LINKS, mlinks.checked ? 'on' : 'off');
            if (!mlinks.checked) {
                const row = document.getElementById('sc-movie-links');
                if (row) row.remove();
            } else {
                movieState.lastMovieTitle = ''; // force a re-inject so links appear now
            }
        });

        // ── App update check / release notes ─────────────────────────────────
        (function wireUpdateSection() {
            const statusEl = document.getElementById('sc-update-status');
            const notesEl  = document.getElementById('sc-update-notes');
            const dlBtn    = document.getElementById('sc-update-download');
            const checkBtn = document.getElementById('sc-update-check');
            if (!statusEl || !dlBtn || !checkBtn) return;

            const render = (info) => {
                statusEl.className = 'sc-settings-note';
                notesEl.classList.add('sc-hidden');
                dlBtn.classList.add('sc-hidden');
                if (!info) { statusEl.textContent = 'Checking for updates…'; return; }
                if (info.available) {
                    statusEl.classList.add('sc-update-yes');
                    statusEl.textContent = 'Update available: ' + info.latest;
                    if (info.notes) { notesEl.textContent = info.notes; notesEl.classList.remove('sc-hidden'); }
                    dlBtn.classList.remove('sc-hidden');
                } else {
                    statusEl.classList.add('sc-update-no');
                    statusEl.textContent = info.latest ? '✓ You’re on the latest version (' + info.latest + ')' : '✓ You’re on the latest version';
                }
            };

            if (_updateInfo) render(_updateInfo);  // show what we already know instantly
            checkForUpdate(false).then(render).catch(() => {
                if (!_updateInfo) statusEl.textContent = 'Couldn’t reach GitHub to check.';
            });

            dlBtn.addEventListener('click', () => {
                const url = (_updateInfo && _updateInfo.url) || GH_RELEASES_PAGE;
                try { if (window.CytubeNative && CytubeNative.openExternal) CytubeNative.openExternal(url); else window.open(url, '_blank'); } catch (e) {}
            });
            checkBtn.addEventListener('click', async () => {
                statusEl.className = 'sc-settings-note';
                statusEl.textContent = 'Checking…';
                checkBtn.disabled = true;
                try { render(await checkForUpdate(true)); }
                catch (e) { statusEl.textContent = 'Couldn’t reach GitHub to check.'; }
                checkBtn.disabled = false;
            });
        })();
    }

    function addSettingsButton() {
        if (document.getElementById('sc-settings-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'sc-settings-btn';
        btn.textContent = '⚙';
        btn.title = 'Script Settings (API keys)';
        btn.dataset.tvLabel = 'Settings';
        btn.addEventListener('click', openSettingsModal);
        document.body.appendChild(btn);
    }

    // Cast button — a mobile-only sender control that sits in the fly-out cluster under
    // the settings gear and opens the system Cast device chooser. Never shown on TV (a TV
    // is the cast target, not a sender). Queries the bridge directly rather than the isTv
    // const, which may not be initialised yet when _scBoot() runs.
    function addCastButton() {
        let onTv = false;
        try { onTv = !!(window.CytubeNative && CytubeNative.isTv && CytubeNative.isTv()); } catch (e) {}
        if (onTv) return;
        if (document.getElementById('sc-cast-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'sc-cast-btn';
        btn.type = 'button';
        btn.title = 'Cast to TV';
        btn.dataset.tvLabel = 'Cast';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
            '<path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>';
        btn.addEventListener('click', function () {
            try { if (window.CytubeNative && CytubeNative.startCasting) CytubeNative.startCasting(); } catch (e) {}
        });
        document.body.appendChild(btn);
    }

    /* ==========================================================
       POSTER STRIP — toggle show/hide the MOTD poster images
    ========================================================== */

    // Global wake/dim control — exposed so initPosterStrip can call wake()
    let _topBarWake = null;
    let _topBarIsOpen = false;
    let _leftZoneReveal  = null;  // expose so video-tap can trigger both chrome systems together
    let _rightZoneReveal = null;  // vertical-mode right-edge drawer
    let _chromeWake = null;       // re-arms the TV chrome auto-hide (remote keys bypass DOM events)

    function initTopBar() {
        // Gradient overlay — pointer-events:none so it never blocks clicks
        const bar = document.createElement('div');
        bar.id = 'sc-top-bar';
        document.body.appendChild(bar);

        let idleTimer  = null;
        let playing    = false; // true once the video has actually started

        // All elements that get .sc-bar-dim when the bar fades
        const getDimEls = () => [
            bar,
            document.getElementById('videowrap-header'),
            document.getElementById('sc-poster-toggle'),
            document.getElementById('sc-trivia-btn'),
            document.getElementById('sc-movie-links'),
        ].filter(Boolean);

        const dim = () => {
            if (_topBarIsOpen || !playing) return;
            getDimEls().forEach(el => el.classList.add('sc-bar-dim'));
            document.body.classList.add('sc-video-dimmed');
        };

        const wake = () => {
            getDimEls().forEach(el => el.classList.remove('sc-bar-dim'));
            document.body.classList.remove('sc-video-dimmed');
            clearTimeout(idleTimer);
            if (!_topBarIsOpen && playing) idleTimer = setTimeout(dim, 3500);
        };
        _topBarWake = wake;

        // Start the countdown only when a video element starts playing
        const onVideoPlay = () => {
            if (playing) return; // already started once
            playing = true;
            clearTimeout(idleTimer);
            idleTimer = setTimeout(dim, 4000); // 4s after play starts
        };

        // Watch for video play events — video element may not exist yet at init
        const bindVideoEvents = () => {
            document.querySelectorAll('video').forEach(v => {
                if (!v._scPlayBound) {
                    v._scPlayBound = true;
                    v.addEventListener('play', onVideoPlay);
                }
            });
        };

        // Re-check whenever DOM changes (video element may be injected later)
        bindVideoEvents();
        new MutationObserver(bindVideoEvents)
            .observe(document.body, { childList: true, subtree: true });

        // For iframe-based players (YouTube/Twitch) no <video> element is accessible,
        // so treat iframe insertion into #videowrap as "playing started".
        const onIframeAppear = () => {
            if (!playing && document.querySelector('#videowrap iframe')) onVideoPlay();
        };
        const vw = document.getElementById('videowrap');
        if (vw) new MutationObserver(onIframeAppear).observe(vw, { childList: true, subtree: true });
        onIframeAppear();

        // Mouse near top of video area wakes the bar
        document.addEventListener('mousemove', (e) => {
            if (e.clientY < 60 && e.clientX < window.innerWidth * (1)) {
                wake();
            }
        });

        // When the bar is faded, the first tap/click on it only wakes it — it does
        // NOT trigger the title/trivia/links/coming-attractions. A second tap acts.
        const HEADER_SEL = '#videowrap-header, #sc-top-bar, #sc-title-text, #sc-movie-links, #sc-trivia-btn, #sc-poster-toggle';
        document.addEventListener('click', (e) => {
            if (!bar.classList.contains('sc-bar-dim')) return;   // not faded → normal behaviour
            if (!e.target.closest(HEADER_SEL)) return;           // tap wasn't on the header
            e.preventDefault();
            e.stopPropagation();
            wake();
        }, true); // capture phase: intercept before the element's own handler
    }

    function initPosterStrip() {
        const motd = document.getElementById('motdrow');
        if (!motd) return;

        // Build the poster strip container from MOTD images
        const imgs = [...motd.querySelectorAll('img')].filter(img => {
            // Read HTML attributes (not rendered dimensions — motdrow is hidden so rendered = 0)
            const w = parseInt(img.getAttribute('width') || 0);
            const h = parseInt(img.getAttribute('height') || 0);
            // Poster images in the MOTD are 125x175 — keep portrait-ish images, skip wide banners
            return h >= 100 && w <= 200;
        });
        if (!imgs.length) return;

        // Create our strip outside of #motdrow so we control it fully
        const strip = document.createElement('div');
        strip.id = 'sc-poster-strip';
        // Single shared zoom element — lives on body, above everything
        let zoomEl = document.getElementById('sc-poster-zoom');
        if (!zoomEl) {
            zoomEl = document.createElement('img');
            zoomEl.id = 'sc-poster-zoom';
            document.body.appendChild(zoomEl);
        }

        const ZOOM_H = 300;

        const calcZoomTarget = (thumb) => {
            const rect  = thumb.getBoundingClientRect();
            const attrW = parseInt(thumb.getAttribute('width')  || 125);
            const attrH = parseInt(thumb.getAttribute('height') || 175);
            const zoomW = Math.round(ZOOM_H * (attrW / attrH));

            // Always centre horizontally over the thumb, clamped to viewport
            let left = rect.left + rect.width / 2 - zoomW / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - zoomW - 8));

            // Anchor to the top of the thumb — expand upward from there
            // If not enough room above, expand downward instead
            let top;
            if (rect.top >= ZOOM_H + 8) {
                top = rect.top - ZOOM_H;          // expands upward, bottom edge at thumb top
            } else {
                top = rect.bottom - ZOOM_H;        // anchor bottom to thumb bottom, grows up into video
                top = Math.max(8, top);
            }

            return { left, top, width: zoomW, height: ZOOM_H };
        };

        const positionZoom = (thumb) => {
            const rect   = thumb.getBoundingClientRect();
            const target = calcZoomTarget(thumb);

            // Immediately place at thumb position/size (no transition yet)
            zoomEl.classList.remove('sc-zoom-expanded');
            zoomEl.style.transition = 'none';
            zoomEl.style.left   = rect.left   + 'px';
            zoomEl.style.top    = rect.top    + 'px';
            zoomEl.style.width  = rect.width  + 'px';
            zoomEl.style.height = rect.height + 'px';
            zoomEl.style.display = 'block';

            // Force a reflow so the browser registers the start state
            zoomEl.getBoundingClientRect();

            // Re-enable transition and animate to final size/position
            zoomEl._collapsing = false;
            zoomEl.style.transition = '';
            zoomEl.style.left   = target.left   + 'px';
            zoomEl.style.top    = target.top    + 'px';
            zoomEl.style.width  = target.width  + 'px';
            zoomEl.style.height = target.height + 'px';
            zoomEl.classList.add('sc-zoom-expanded');
        };

        imgs.forEach(img => {
            const thumb = document.createElement('img');
            thumb.src = img.src;
            thumb.className = 'sc-poster-thumb';
            thumb.title = img.title || img.alt || '';
            thumb.setAttribute('width',  img.getAttribute('width')  || '125');
            thumb.setAttribute('height', img.getAttribute('height') || '175');

            thumb.addEventListener('mouseenter', () => {
                // Cancel any in-progress collapse
                zoomEl._collapsing = false;
                zoomEl.src = thumb.src;
                zoomEl._activeThumb = thumb;   // remembered so an outside tap can collapse it
                positionZoom(thumb);
            });
            thumb.addEventListener('mouseleave', () => {
                zoomEl._collapsing = true;
                // Animate back to thumb size then hide
                const rect = thumb.getBoundingClientRect();
                zoomEl.classList.remove('sc-zoom-expanded');
                zoomEl.style.left   = rect.left   + 'px';
                zoomEl.style.top    = rect.top    + 'px';
                zoomEl.style.width  = rect.width  + 'px';
                zoomEl.style.height = rect.height + 'px';
                // Hide only if still collapsing when transition ends
                const onEnd = () => {
                    zoomEl.removeEventListener('transitionend', onEnd);
                    if (zoomEl._collapsing) {
                        zoomEl.style.display = 'none';
                        zoomEl.src = '';
                        zoomEl._collapsing = false;
                    }
                };
                zoomEl.addEventListener('transitionend', onEnd);
            });

            // Wrapper stays an <a> so TV-nav (strip.querySelectorAll('a')) can still
            // enumerate/focus each poster, but it intentionally has NO href — opening the
            // raw image URL on click/OK navigated the WebView and broke the app.
            const wrap = document.createElement('a');
            wrap.appendChild(thumb);
            strip.appendChild(wrap);
        });
        document.body.appendChild(strip);

        // Tapping a poster zooms it (via mouseenter on touch), but touch never fires the
        // thumb's mouseleave — so a tap anywhere that ISN'T a poster collapses the zoom,
        // reusing the existing mouseleave animation. Added once (initPosterStrip re-runs).
        if (!document.body._scPosterDismiss) {
            document.body._scPosterDismiss = true;
            document.addEventListener('click', (e) => {
                if (zoomEl.style.display !== 'block' || zoomEl._collapsing) return;
                if (e.target && e.target.classList && e.target.classList.contains('sc-poster-thumb')) return;
                const active = zoomEl._activeThumb;
                if (active) active.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            });
        }

        // Toggle button — injected below the video title
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'sc-poster-toggle';
        toggleBtn.textContent = "Coming Attractions";
        toggleBtn.title = 'Show/hide weekend lineup';
        toggleBtn.dataset.noTvCaption = '1'; // button text is self-explanatory; no remote caption
        toggleBtn.addEventListener('click', () => {
            const visible = strip.classList.toggle('sc-poster-visible');
            toggleBtn.classList.toggle('sc-poster-toggle-active', visible);
            // Tell the top bar system whether strip is open
            _topBarIsOpen = visible;
            if (visible && _topBarWake) {
                _topBarWake(); // wake and keep awake
            }
            // If closing, restart the idle timer via a mousemove wake
            // (the next mousemove in the zone will restart it naturally)
        });
        document.body.appendChild(toggleBtn);
    }

    /* ==========================================================
       POLL / ANNOUNCEMENT WATCHER
    ========================================================== */

    function initPollWatcher() {
        // pollwrap may not exist yet or may be empty — watch for it
        const tryInit = () => {
            const pollwrap = document.getElementById('pollwrap');
            if (!pollwrap) {
                // Not in DOM yet, watch body
                const bodyObs = new MutationObserver(() => {
                    if (document.getElementById('pollwrap')) {
                        bodyObs.disconnect();
                        tryInit();
                    }
                });
                bodyObs.observe(document.body, { childList: true, subtree: true });
                return;
            }
            _initPollWatcher(pollwrap);
        };
        tryInit();
    }

    function _initPollWatcher(pollwrap) {

        // Create the notification button — only shown when poll has content
        const header = document.getElementById('sc-chat-header');
        if (!header) return;
        const btn = document.createElement('button');
        btn.id = 'sc-poll-btn';
        btn.title = 'Channel announcement / poll';
        btn.textContent = 'POLL';
        header.appendChild(btn);

        // Create the floating panel
        const panel = document.createElement('div');
        panel.id = 'sc-poll-panel';
        panel.style.display = 'none';
        document.body.appendChild(panel);

        let panelOpen = false;

        const renderPanel = () => {
            // Clone pollwrap content so we can restyle without affecting original
            const well = pollwrap.querySelector('.well.active') || pollwrap.querySelector('.well');
            if (!well) { panel.innerHTML = ''; return; }

            // Extract just the useful parts: heading + options
            const h = well.querySelector('h3')?.textContent?.trim() || '';
            const opts = [...well.querySelectorAll('.option')].map(o => {
                // Get text without the vote count button text
                const btn = o.querySelector('button');
                const text = o.textContent.replace(btn?.textContent || '', '').trim();
                // Preserve links
                const links = [...o.querySelectorAll('a')].map(a =>
                    `<a href="${a.href}" target="_blank" rel="noopener noreferrer">${a.textContent}</a>`
                );
                let html = o.innerHTML.replace(/<button[^>]*>.*?<\/button>/i, '').trim();
                return `<div class="sc-poll-option">${html}</div>`;
            });

            // Time/author label
            const label = well.querySelector('.label')?.textContent?.trim() || '';
            const author = well.querySelector('.label')?.getAttribute('title') || '';

            panel.innerHTML = `
                <div class="sc-poll-header">${h}</div>
                <div class="sc-poll-options">${opts.join('')}</div>
                ${label ? `<div class="sc-poll-meta">${author ? author + ' · ' : ''}${label}</div>` : ''}
            `;
        };

        const hasPollContent = () => {
            // CyTube marks open polls with .well.active
            // Fall back to any .well with content if no active class
            const activeWell = pollwrap.querySelector('.well.active') || pollwrap.querySelector('.well');
            return !!(activeWell && activeWell.textContent.trim().length > 10);
        };

        const updateBtn = () => {
            const hasContent = hasPollContent();
            btn.style.display = hasContent ? '' : 'none';
            if (!hasContent && panelOpen) {
                panel.style.display = 'none';
                panelOpen = false;
                btn.classList.remove('sc-poll-btn-active');
            }
        };

        btn.addEventListener('click', () => {
            panelOpen = !panelOpen;
            if (panelOpen) {
                renderPanel();
                panel.style.display = 'block';
                btn.classList.add('sc-poll-btn-active');
            } else {
                panel.style.display = 'none';
                btn.classList.remove('sc-poll-btn-active');
            }
        });

        // Close on outside click
        document.addEventListener('click', e => {
            if (panelOpen && !btn.contains(e.target) && !panel.contains(e.target)) {
                panel.style.display = 'none';
                panelOpen = false;
                btn.classList.remove('sc-poll-btn-active');
            }
        });

        // Watch for poll changes
        new MutationObserver(() => {
            updateBtn();
            if (panelOpen) renderPanel();
        }).observe(pollwrap, { childList: true, subtree: true, characterData: true });

        updateBtn();
    } // end _initPollWatcher

    /* ==========================================================
       USER COUNT PANEL
    ========================================================== */

    function initChatHeader() {
        if (document.getElementById('sc-chat-header')) return;
        const header = document.createElement('div');
        header.id = 'sc-chat-header';
        document.body.appendChild(header);

        // Collapse/cycle button on the far-right of the chat header — the most
        // discoverable affordance for "close the chat panel from the chat side"
        const colBtn = document.createElement('button');
        colBtn.id = 'sc-chat-collapse-btn';
        colBtn.title = 'Cycle chat layout (C)';
        colBtn.dataset.tvLabel = 'Toggle Chat';
        colBtn.textContent = '›';
        colBtn.addEventListener('click', () => { if (typeof cycleChatMode === 'function') cycleChatMode(); });
        header.appendChild(colBtn);
    }

    function initUserCount() {
        const header = document.getElementById('sc-chat-header');
        if (!header) return;
        const btn = document.createElement('button');
        btn.id = 'sc-usercount-btn';
        header.appendChild(btn);

        // Create users panel
        const panel = document.createElement('div');
        panel.id = 'sc-users-panel';
        document.body.appendChild(panel);

        let open = false;

        const getUsers = () => {
            const items = [...document.querySelectorAll('#userlist .userlist_item')];
            return items
                .map(item => {
                    // CyTube structure: <span>(rank icon)</span><span (optional class)>Name</span>
                    // Get the second span which always contains the username
                    const spans = item.querySelectorAll('span');
                    const nameSpan = spans.length >= 2 ? spans[1] : spans[0];
                    return nameSpan?.textContent?.trim() || '';
                })
                .filter(Boolean)
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        };

        const updateCount = () => {
            // Prefer CyTube's own count (accurate, socket-driven)
            const cytubCount = document.getElementById('usercount');
            const raw = cytubCount?.textContent?.match(/\d+/)?.[0];
            const count = raw ? parseInt(raw) : getUsers().length;
            btn.textContent = count + ' USERS';
        };

        const renderPanel = () => {
            const users = getUsers();
            panel.innerHTML = `
                <div class="sc-users-panel-header">${users.length} connected</div>
                ${users.map(u => {
                    const color = usernameToColor(u);
                    return `<div class="sc-users-panel-name" style="color:${color}">${u}</div>`;
                }).join('')}
            `;
        };

        const closePanel = () => {
            panel.style.display = 'none';
            btn.classList.remove('sc-users-active');
            open = false;
        };

        btn.addEventListener('click', e => {
            e.stopPropagation();
            open = !open;
            if (open) {
                renderPanel();
                panel.style.display = 'block';
                btn.classList.add('sc-users-active');
            } else {
                closePanel();
            }
        });

        document.addEventListener('click', e => {
            if (open && !panel.contains(e.target) && e.target !== btn) closePanel();
        });

        // Update count and panel when userlist changes
        const ul = document.getElementById('userlist');
        if (ul) {
            new MutationObserver(() => {
                updateCount();
                if (open) renderPanel();
            }).observe(ul, { childList: true, subtree: true });
        }

        // Also watch CyTube's usercount element for socket-driven updates
        const uc = document.getElementById('usercount');
        if (uc) {
            new MutationObserver(updateCount)
                .observe(uc, { childList: true, subtree: true, characterData: true });
        }

        updateCount();
    }

    /* ==========================================================
       BOOT
    ========================================================== */

    const waitForBody = () => {
        if (!document.body) { requestAnimationFrame(waitForBody); return; }

        startMonitorWatcher();
        applyInputMode();

        const bootObserver = new MutationObserver(() => {
            applyInputMode();
            installChatTextarea();
            relocateEmoteButton();
            addFloatingButtons();
            addSettingsButton();
            startUserColorObserver();
            // Disconnect once all one-time elements are in place
            if (
                document.getElementById('sc-chat-textarea') &&
                document.getElementById('sc-emote-proxy') &&
                document.getElementById('fs-toggle-btn') &&
                document.getElementById('sc-settings-btn')
            ) {
                bootObserver.disconnect();
            }
        });
        bootObserver.observe(document.body, { childList: true, subtree: true });
    };

    // The channel UI doesn't run on the login page, but a remote-only TV still needs
    // D-pad navigation to reach the username/password fields and the Login button —
    // there's no pointer. Install a minimal, self-contained spatial nav, then stop.
    if (window.location.pathname.startsWith('/login')) {
        initLoginTvNav();
        return;
    }

    // Self-contained D-pad navigation for the /login page. None of the channel UI
    // (or its CSS, or the module-level isTv) runs here, so this re-detects TV and
    // injects just the focus-ring style it needs. The native layer forwards remote
    // keys to window.__scTvKey(dir) exactly as it does for the channel.
    function initLoginTvNav() {
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

    waitForBody();

    /* ==========================================================
       CSS + LOAD INIT
    ========================================================== */

    function _scBoot() {
        _scStatus('Styling channel…');
        getKillCountDb(); // pre-fetch kill count DB
        installChatTextarea();
        relocateEmoteButton();
        addFloatingButtons();
        addSettingsButton();
        addCastButton();
        watchMovieTitle();
        initMediaWatcher();
        initChatTimestamps();
        initNowPlayingWatcher();
        initTopBar();
        initDesyncButton();
        initChatHeader();
        initUserCount();
        initPollWatcher();
        initGoogleDrive();
        initUpdateCheck();

        // First-run settings modal — only the very first launch, never forced again.
        if (!localStorage.getItem(LS_ONBOARDED)) {
            setTimeout(openSettingsModal, 1200);
        }

        // Run immediately if #motdrow already has images, otherwise watch for it
        if (document.querySelector('#motdrow img')) {
            initPosterStrip();
        } else {
            const motdObserver = new MutationObserver(() => {
                if (document.querySelector('#motdrow img')) {
                    motdObserver.disconnect();
                    initPosterStrip();
                }
            });
            motdObserver.observe(document.body, { childList: true, subtree: true });
            // Hard fallback — if observer never fires, try once after 2s
            setTimeout(() => {
                if (!document.getElementById('sc-poster-strip')) initPosterStrip();
            }, 2000);
        }

        const style = document.createElement('style');
        style.textContent = baseCss + overlaysCss;
        document.head.appendChild(style);
    }
    if (document.readyState === 'complete') {
        _scBoot();
    } else {
        window.addEventListener('load', _scBoot);
    }

    // ── MOBILE / TV ADDITIONS ─────────────────────────────────────────

    // Viewport meta — prevent zoom, fill safe area
    (function() {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.body.style.setProperty('padding-top', '0px', 'important');
        document.body.style.setProperty('margin-top', '0px', 'important');
    })();

    // Load Inter for clean, distance-legible chat text (falls back to Roboto/system)
    (function() {
        const pc1 = document.createElement('link'); pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com';
        const pc2 = document.createElement('link'); pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = 'anonymous';
        const css = document.createElement('link'); css.rel = 'stylesheet';
        css.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(pc1); document.head.appendChild(pc2); document.head.appendChild(css);
    })();

    try {
        console.log('[Grindhouse] TV mode:', isTv,
            '| native bridge:', !!(window.CytubeNative && CytubeNative.isTv),
            '| screen:', screen.width + 'x' + screen.height,
            '| touchPoints:', navigator.maxTouchPoints,
            '| ontouchstart:', ('ontouchstart' in window));
    } catch (e) {}

    // Shared mobile/TV CSS overrides
    (function() {
        const s = document.createElement('style');
        s.textContent = tvCss;
        document.head.appendChild(s);
    })();

    // Mark TV so CSS can scale up
    if (isTv) document.body.classList.add('sc-tv');

    // Suppress the on-screen keyboard (inputmode="none") per the setting.
    // Re-applies as chat/emote inputs are (re)created.
    (function() {
        applySoftKeyboard();
        const obs = new MutationObserver(applySoftKeyboard);
        if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    })();

    // Backgrounding is handled natively now: the activity pauses the whole WebView
    // (onPause + pauseTimers) when it's no longer visible, freezing video, JS and
    // the chat socket so nothing runs in the background — and resumes on return.
    // (No JS src-clearing/reload button, which would prevent the fast resume.)

    // Wire up send button once chat textarea exists
    function _scAddSendBtn() {
        if (document.getElementById('sc-send-btn')) return;
        const ta = document.getElementById('sc-chat-textarea');
        if (!ta) return;
        const orig = document.getElementById('chatline');
        if (!document.getElementById('sc-mobile-input-row')) {
            const row = document.createElement('div');
            row.id = 'sc-mobile-input-row';
            ta.parentNode.insertBefore(row, ta);
            row.appendChild(ta);
        }
        const btn = document.createElement('button');
        btn.id = 'sc-send-btn'; btn.type = 'button'; btn.textContent = '➤';
        document.getElementById('sc-mobile-input-row').appendChild(btn);
        btn.addEventListener('click', () => { if (ta && orig) attemptSend(ta, orig); });
    }

    // Mobile keyboard handler.
    // edge-to-edge breaks adjustResize so vh never updates — we drive the layout
    // with explicit pixel values from visualViewport instead.
    (function() {
        if (!window.visualViewport || isTv) return;

        let kbTimer = null;
        const INPUT_H = 56; // chat input bar height

        const onOpen = (vv) => {
            const kbH  = Math.round(window.innerHeight - vv.height);
            const visH = vv.height;
            const isVert = document.body.classList.contains('sc-vertical');

            let vidH, chatH;
            if (isVert) {
                // Vertical: video gets 58% of visible, chat gets the rest minus input bar
                vidH  = Math.round(visH * 0.58);
                chatH = Math.max(visH - vidH - INPUT_H, 60);
            } else {
                // Horizontal: video and chat simply shrink to the visible height
                vidH  = visH;
                chatH = visH - 28; // 28px for the chat header row
            }

            const root = document.documentElement.style;
            root.setProperty('--sc-kb-h',   kbH   + 'px');
            root.setProperty('--sc-vid-h',  vidH  + 'px');
            root.setProperty('--sc-chat-h', chatH + 'px');
            document.body.classList.add('sc-kb-open');

            const buf = document.getElementById('messagebuffer');
            if (buf) setTimeout(() => { buf.scrollTop = buf.scrollHeight; }, 120);
        };

        const onClose = () => {
            const root = document.documentElement.style;
            root.removeProperty('--sc-kb-h');
            root.removeProperty('--sc-vid-h');
            root.removeProperty('--sc-chat-h');
            document.body.classList.remove('sc-kb-open');
        };

        window.visualViewport.addEventListener('resize', () => {
            const vv = window.visualViewport;
            clearTimeout(kbTimer);
            if (window.innerHeight - vv.height > 120) {
                onOpen(vv);
            } else {
                kbTimer = setTimeout(onClose, 280);
            }
        }, { passive: true });
    })();

    // Watch for chat textarea and add send button
    const _scSendObs = new MutationObserver(() => {
        if (document.getElementById('sc-chat-textarea')) { _scAddSendBtn(); if (document.getElementById('sc-send-btn')) _scSendObs.disconnect(); }
    });
    _scSendObs.observe(document.body, { childList: true, subtree: true });

    /* ==========================================================
       CINEMATIC + CHAT ENHANCEMENTS
       Ambient glow, auto-hiding chrome, chat layout modes,
       new-message pill, @mention toasts, quick reactions.
    ========================================================== */

    // ── Ambient glow: sample the video's colour and bleed it to the screen edges
    function initAmbientGlow() {
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
    function initChromeAutohide() {
        if (!isTv) return;
        let timer = null;
        const hide = () => document.body.classList.add('sc-chrome-hidden');
        const show = () => {
            document.body.classList.remove('sc-chrome-hidden');
            if (typeof _topBarWake === 'function') _topBarWake();
            clearTimeout(timer);
            timer = setTimeout(hide, 4000);
        };
        ['mousemove', 'keydown', 'click', 'touchstart', 'wheel'].forEach(ev =>
            document.addEventListener(ev, show, { passive: true }));
        // Remote D-pad keys are consumed by native and never fire DOM keydown, so the
        // TV nav code re-arms this timer directly via _chromeWake on every remote press.
        _chromeWake = show;
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
    function cycleChatMode() {
        let cur = 'sidebar';
        try { cur = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}
        applyChatMode(_CHAT_MODES[(_CHAT_MODES.indexOf(cur) + 1) % _CHAT_MODES.length]);
    }
    function initChatModes() {
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
    function initNewMessagePill() {
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
    function initMentionToast() {
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

    function initChatFont() { applyChatFontSize(getChatFontSize()); }

    // The control cluster stays hidden; a small left-edge "grip" hints at it.
    // Reaching the left edge (mouse or touch) — or hovering the grip — slides it out.
    function initLeftZone() {
        let hideTimer = null;
        const THRESH = 120; // px from the left edge
        const scheduleHide = (ms) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => document.body.classList.remove('sc-leftzone'), ms); };
        const reveal = (autoHideMs) => { clearTimeout(hideTimer); document.body.classList.add('sc-leftzone'); if (autoHideMs) scheduleHide(autoHideMs); };
        _leftZoneReveal = reveal;

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
    function initVertControlBand() {
        if (document.getElementById('sc-vert-ctrl-band')) return;
        const band = document.createElement('div');
        band.id = 'sc-vert-ctrl-band';
        document.body.appendChild(band);
    }

    // Right-edge slide-out drawer for vertical mode (mirrors the left-zone in horizontal).
    function initRightZone() {
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
        _rightZoneReveal = reveal;

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
    function initVideoTapReveal() {
        const REVEAL_MS = 4000;     // keep the scrubber + fly-out cluster up for the same window
        let scrubReleaseTimer = null;
        const tap = document.createElement('div');
        tap.id = 'sc-video-tap';
        tap.addEventListener('click', () => {
            if (_topBarWake) _topBarWake();
            if (_leftZoneReveal) _leftZoneReveal(REVEAL_MS);
            if (_rightZoneReveal) _rightZoneReveal(REVEAL_MS);
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

    function initCinematicChat() {
        [initAmbientGlow, initChromeAutohide, initChatModes, initNewMessagePill, initMentionToast, initChatFont, initLeftZone, initVideoTapReveal, initVertControlBand, initRightZone, applyCouchMode, applyWatchAlong]
            .forEach(fn => { try { fn(); } catch (e) { console.warn('[Grindhouse] init failed:', fn.name, e); } });
    }
    if (document.readyState === 'complete') initCinematicChat();
    else window.addEventListener('load', initCinematicChat);

    /* ==========================================================
       TV REMOTE NAVIGATION — D-pad focus/spatial nav.
       Native forwards remote keys to window.__scTvKey(dir); we move a focus
       highlight between interactive elements and activate / close on OK / Back.
    ========================================================== */
    (function initTvNav() {
        if (!isTv) return;
        let focusEl = null;

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
        const OVERLAY_IDS = ['sc-settings-overlay', 'sc-modal-overlay', 'sc-trivia-card', 'sc-users-panel', 'sc-poll-panel', 'sc-np-card'];
        const openOverlay = () => {
            for (const id of OVERLAY_IDS) {
                const o = document.getElementById(id);
                if (o && isVisible(o) &&
                    (id !== 'sc-np-card' || o.classList.contains('sc-np-visible')) &&
                    (id !== 'sc-trivia-card' || o.classList.contains('sc-show'))) return o;
            }
            return null;
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
        const MAIN_IDS = ['sc-drm-open', 'sc-title-text', 'sc-chatmode-btn', 'sc-emote-proxy', 'sc-desync-btn', 'sc-settings-btn',
            'sc-usercount-btn', 'sc-poll-btn', 'sc-poster-toggle', 'sc-trivia-btn', 'sc-newmsg-pill', 'sc-chat-collapse-btn', 'sc-chat-textarea'];
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
        _tvSetFocus = setFocus;

        // Seek the active player by ±delta seconds (free-watch only — the caller guards
        // on isDesynced()). Works for both video.js (raw/Drive) and a bare <video>.
        function seekBy(delta) {
            try {
                const p = window.PLAYER && window.PLAYER.player;
                if (p && typeof p.currentTime === 'function') {
                    p.currentTime(Math.max(0, (p.currentTime() || 0) + delta));
                    wakeVideoControls();
                    return;
                }
            } catch (e) {}
            const v = document.querySelector('#videowrap video');
            if (v) { try { v.currentTime = Math.max(0, v.currentTime + delta); wakeVideoControls(); } catch (e) {} }
        }

        // Coming Attractions strip: a horizontal poster reel. Drive the existing hover-zoom
        // off the focused poster so the remote gets the same preview the mouse does.
        const posterZoom = (a, on) => {
            const img = a && a.querySelector('img');
            if (img) img.dispatchEvent(new MouseEvent(on ? 'mouseenter' : 'mouseleave', { bubbles: true }));
        };
        function setPosterFocus(a, thumbs) {
            thumbs.forEach(t => { if (t !== a) posterZoom(t, false); });
            setFocus(a);
            posterZoom(a, true);
        }

        function move(dir) {
            // Scrubber focused + free-watch on: Left/Right steps through the movie
            // (±10s) instead of moving focus. candidates() only offers the scrubber
            // while desynced, so reaching here already implies seeking is allowed.
            if (focusEl && focusEl.classList && focusEl.classList.contains('vjs-progress-control') &&
                (dir === 'left' || dir === 'right')) {
                if (isDesynced()) seekBy(dir === 'right' ? 10 : -10);
                return;
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

            // Coming Attractions: enter the open strip with Down from its toggle, scroll it
            // with Left/Right, and leave with Up/Down. The strip isn't an OVERLAY (that would
            // trap focus), so we steer it explicitly here.
            const strip = document.getElementById('sc-poster-strip');
            if (strip && strip.classList.contains('sc-poster-visible')) {
                const toggle = document.getElementById('sc-poster-toggle');
                // All reel links — NOT isVisible-filtered: posters scrolled past the strip's
                // edge are off-viewport but still valid targets we scroll into view.
                const thumbs = [...strip.querySelectorAll('a')];
                if (thumbs.length) {
                    if (focusEl === toggle && dir === 'down') { setPosterFocus(thumbs[0], thumbs); return; }
                    if (strip.contains(focusEl)) {
                        if (dir === 'left' || dir === 'right') {
                            const i = thumbs.indexOf(focusEl);
                            const ni = dir === 'right' ? Math.min(thumbs.length - 1, i + 1) : Math.max(0, i - 1);
                            setPosterFocus(thumbs[ni], thumbs);
                            return;
                        }
                        // up / down → step back out of the reel onto the toggle
                        posterZoom(focusEl, false);
                        if (toggle) setFocus(toggle);
                        return;
                    }
                }
            }

            const { scope, list } = candidates();
            if (!list.length) return;
            if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }

            const cur = focusEl.getBoundingClientRect();
            const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
            // Two tiers: a candidate within 45° of the pressed direction (primary >= perp)
            // always beats one off to the side, however close the latter scores. Without
            // this, Right from the mute button picks the settings gear (4px rightward but
            // a whole cluster-height up) over the CC button dead ahead across the bar.
            // Off-cone candidates remain as fallback so loose diagonal hops still work.
            let best = null, bestScore = Infinity, cone = null, coneScore = Infinity;
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
                if (primary >= perp && score < coneScore) { coneScore = score; cone = el; }
                if (score < bestScore) { bestScore = score; best = el; }
            }
            if (cone) best = cone;
            if (best) { setFocus(best); return; }
            // No neighbour that way — scroll a scrollable region if we're in one
            if (dir === 'up' || dir === 'down') {
                const sc = (scope.querySelector && scope.querySelector('#sc-trivia-list, #sc-settings-modal, #messagebuffer')) ||
                           document.getElementById('messagebuffer');
                if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += (dir === 'down' ? 140 : -140);
            }
        }

        function activate() {
            if (!focusEl) { move('right'); return; }
            // OK on the scrubber would click at its origin and jump to 0 — seeking is
            // Left/Right only, so swallow the press here.
            if (focusEl.classList && focusEl.classList.contains('vjs-progress-control')) return;
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
            focusEl.click();
            if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
        }

        function closeTop() {
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
                clearFocus(); return true;
            }
            const modal = document.getElementById('sc-modal-overlay');
            if (modal && isVisible(modal)) { (document.getElementById('sc-btn-cancel') || { click() { modal.remove(); } }).click(); clearFocus(); return true; }
            const trivia = document.getElementById('sc-trivia-card');
            if (trivia && trivia.classList.contains('sc-show')) { hideTriviaCard(); clearFocus(); return true; }
            const np = document.getElementById('sc-np-card');
            if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); clearFocus(); return true; }
            for (const id of ['sc-users-panel', 'sc-poll-panel']) {
                const p = document.getElementById(id);
                if (p && isVisible(p)) { p.style.display = 'none'; clearFocus(); return true; }
            }
            const poster = document.getElementById('sc-poster-strip');
            if (poster && poster.classList.contains('sc-poster-visible')) {
                const t = document.getElementById('sc-poster-toggle'); if (t) t.click(); else poster.classList.remove('sc-poster-visible');
                clearFocus(); return true;
            }
            return false;
        }

        function revealChrome() {
            // Reveal the left cluster WITH an auto-hide timer (re-armed on every remote
            // press) so it fades back out a few seconds after navigation stops. Raw
            // classList.add left it stuck on, since remote keys don't fire DOM events.
            if (typeof _leftZoneReveal === 'function') _leftZoneReveal(4000);
            else document.body.classList.add('sc-leftzone');
            if (typeof _chromeWake === 'function') _chromeWake();
            else document.body.classList.remove('sc-chrome-hidden');
            if (typeof _topBarWake === 'function') _topBarWake();
        }

        window.__scTvKey = function (dir) {
            try {
                if (dir === 'back') {
                    if (!closeTop()) { try { if (window.CytubeNative && CytubeNative.tvBack) CytubeNative.tvBack(); } catch (e) {} }
                    return;
                }
                revealChrome();
                if (dir === 'center') activate();
                else move(dir);
            } catch (e) { /* never let remote nav throw */ }
        };
    })();

    // Hide the native loading overlay (the Grindhouse splash).
    function _scSignalReady() {
        try { if (window.CytubeNative && CytubeNative.onReady) CytubeNative.onReady(); } catch (e) {}
    }

    // Update the small status line on the native loading splash. Native handles the
    // pre-injection phases ("Starting…", "Loading channel…", "Preparing…"); from here
    // on the page drives it through the styling / wait-for-video phases.
    function _scStatus(s) {
        try { if (window.CytubeNative && CytubeNative.setLoadingStatus) CytubeNative.setLoadingStatus(s); } catch (e) {}
    }

    // True once media has started. Raw files expose a <video>; YouTube/embeds turn
    // #ytapiplayer INTO an <iframe> (or nest one in #videowrap) — there is no
    // cross-origin playback state, so iframe presence is our "playing" signal.
    function _mediaIsPlaying() {
        const v = document.querySelector('#videowrap video');
        if (v) return !v.paused && v.currentTime > 0.1;
        const yt = document.getElementById('ytapiplayer');
        if (yt && yt.tagName === 'IFRAME') return true;
        return !!document.querySelector('#videowrap iframe');
    }

    // Startup sequence: keep the splash up until the video is actually playing
    // (45s hard cap). On TV we then render the Now-Playing card BEHIND the still-
    // visible splash, preload its backdrop, fade the splash to reveal the finished
    // card (no flicker / no movie flash), hold 3s, then fade the card to the movie.
    function initIntroSequence() {
        const start = Date.now();
        let playingSince = 0, preloadStarted = false, done = false;
        _scStatus('Waiting for stream…');

        const reveal = () => {
            if (done) return;
            done = true;
            clearInterval(iv);
            _introDone = true;
            _scStatus('Ready');

            const data = _npData || (movieState.lastMovieTitle && movieState.lastMovieTitle.length > 1
                ? { cleanTitle: movieState.lastMovieTitle, backdrop: null } : null);

            if (isTv && data) {
                showNowPlayingCard(data, { autoHide: false }); // renders behind the opaque splash
                setTimeout(() => {
                    _scSignalReady();                          // fade splash → reveals the finished card
                    setTimeout(hideNowPlayingCard, 3000);      // hold 3s, then fade card → movie
                }, 550);                                       // let the card paint first
            } else {
                _scSignalReady();
            }
        };

        const iv = setInterval(() => {
            if (done) return;
            if (Date.now() - start >= 45000) return reveal(); // hard cap

            const playing = _mediaIsPlaying();

            if (!playing) { playingSince = 0; return; }
            if (!playingSince) playingSince = Date.now();

            if (!isTv) return reveal();                       // phones: reveal as soon as it's playing

            // TV: preload the backdrop so the card is fully painted before we reveal it
            if (_npData && _npData.backdrop && !preloadStarted) {
                preloadStarted = true;
                _scStatus('Loading movie info…');
                const img = new Image();
                img.onload = img.onerror = reveal;
                img.src = _npData.backdrop;
            }
            if (Date.now() - playingSince >= 3500) reveal();   // don't wait too long for the art
        }, 300);
    }

    if (document.readyState === 'complete') initIntroSequence();
    else window.addEventListener('load', initIntroSequence);

    // ── Cast mode: a top control bar that hosts the title + relocated controls ──────
    // Native calls window.__scSetCastMode(true/false) when a cast session starts/ends.
    // We MOVE the existing controls into the bar (keeping their handlers) and put them
    // back on exit — rather than rebuilding them — so trivia/poll/users/settings behave
    // exactly as they do normally.
    (function () {
        // Only controls that currently exist get moved (trivia needs IMDb data, poll
        // needs a live poll, poster toggle needs a Coming-Attractions reel, etc.).
        const CAST_CONTROL_IDS = ['sc-poster-toggle', 'sc-trivia-btn', 'sc-usercount-btn', 'sc-poll-btn', 'sc-settings-btn'];
        let savedSlots = null;   // each relocated element's original DOM position, for restore

        function buildBar() {
            let bar = document.getElementById('sc-cast-bar');
            if (bar) return bar;
            bar = document.createElement('div');
            bar.id = 'sc-cast-bar';
            const titleSlot = document.createElement('div');
            titleSlot.id = 'sc-cast-title-slot';
            const controls = document.createElement('div');
            controls.id = 'sc-cast-controls';
            const stop = document.createElement('button');
            stop.id = 'sc-cast-stop-btn';
            stop.type = 'button';
            stop.textContent = 'Stop Casting';
            stop.addEventListener('click', function () {
                try { if (window.CytubeNative && CytubeNative.stopCasting) CytubeNative.stopCasting(); } catch (e) {}
            });
            bar.appendChild(titleSlot);
            bar.appendChild(controls);
            bar.appendChild(stop);
            document.body.appendChild(bar);
            return bar;
        }

        function remember(el) { return { el: el, parent: el.parentNode, next: el.nextSibling }; }

        function enter() {
            buildBar();
            const titleSlot = document.getElementById('sc-cast-title-slot');
            const controls = document.getElementById('sc-cast-controls');
            savedSlots = [];
            // Move the whole title header (it always holds the live title — sometimes raw text,
            // sometimes the #sc-title-text span once TMDB matches — and keeps updating in place).
            const header = document.getElementById('videowrap-header');
            if (header) { savedSlots.push(remember(header)); titleSlot.appendChild(header); }
            CAST_CONTROL_IDS.forEach(function (id) {
                const el = document.getElementById(id);
                if (el) { savedSlots.push(remember(el)); controls.appendChild(el); }
            });
            document.body.classList.remove('sc-cast-fallback');
            document.body.classList.add('sc-cast');
            scrollChatToBottom();   // back to the chat view — pin to the newest message
        }

        // Jump the chat to the latest message once the cast layout has settled.
        function scrollChatToBottom() {
            var pin = function () {
                var mb = document.getElementById('messagebuffer');
                if (mb) mb.scrollTop = mb.scrollHeight;
            };
            requestAnimationFrame(function () { requestAnimationFrame(pin); });
            setTimeout(pin, 250);
        }

        function exit() {
            document.body.classList.remove('sc-cast');
            document.body.classList.remove('sc-cast-fallback');
            if (savedSlots) {
                savedSlots.forEach(function (s) {
                    try { if (s.parent) s.parent.insertBefore(s.el, s.next); } catch (e) {}
                });
                savedSlots = null;
            }
        }

        // Set the mute state of whatever player is current: <video> (raw/Drive) and/or the
        // CyTube player wrapper (YouTube YT.Player has mute/unMute; video.js has muted()).
        function setPlayerMuted(muted) {
            try { var v = document.querySelector('video'); if (v) v.muted = muted; } catch (e) {}
            try {
                var p = window.PLAYER && window.PLAYER.player;
                if (p) {
                    if (muted) {
                        if (typeof p.mute === 'function') p.mute();
                        else if (typeof p.muted === 'function') p.muted(true);
                    } else {
                        if (typeof p.unMute === 'function') p.unMute();
                        else if (typeof p.muted === 'function') p.muted(false);
                        if (typeof p.setVolume === 'function') { try { p.setVolume(100); } catch (e) {} }
                    }
                }
            } catch (e) {}
        }
        window.__scSetPlayerMuted = setPlayerMuted;

        // Apply the user's fallback-audio preference to the device player.
        window.__scApplyCastFallbackAudio = function () {
            var muted = false;
            try { muted = localStorage.getItem('sc_cast_fallback_mute') === 'on'; } catch (e) {}
            setPlayerMuted(muted);
        };

        // Native calls this when a non-castable (YouTube) clip falls back to this device.
        // The player may not be ready the instant we switch, so re-apply a few times.
        window.__scEnterCastFallback = function () {
            document.body.classList.add('sc-cast-fallback');
            window.__scApplyCastFallbackAudio();
            setTimeout(window.__scApplyCastFallbackAudio, 600);
            setTimeout(window.__scApplyCastFallbackAudio, 1600);
        };

        window.__scSetCastMode = function (on) {
            try { on ? enter() : exit(); } catch (e) { /* never let cast UI throw */ }
        };
    })();

})();
