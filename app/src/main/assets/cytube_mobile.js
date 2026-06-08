(function () {
    'use strict';

    /* ==========================================================
       API KEYS — stored in localStorage, managed via settings modal.
       Keys are never hard-coded; the settings modal handles first-run.
    ========================================================== */
    const LS_TMDB       = 'sc_tmdb_key';
    const LS_SPELLCHECK = 'sc_spellcheck'; // 'off' to disable, anything else = enabled
    const LS_CHAT_FONT  = 'sc_chat_fontsize';
    const LS_MOVIE_LINKS = 'sc_movie_links'; // 'off' to hide IMDb/Letterboxd/Wiki links
    const getKey   = id => localStorage.getItem(id) || '';
    const setKey   = (id, v) => localStorage.setItem(id, v.trim());
    const hasKey   = id => !!getKey(id);
    const spellCheckEnabled = () => getKey(LS_SPELLCHECK) !== 'off';
    const movieLinksEnabled = () => getKey(LS_MOVIE_LINKS) !== 'off';

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
        document.body.classList.toggle('sc-vertical', isVerticalMonitor());
        document.body.classList.toggle('sc-horizontal', !isVerticalMonitor());
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
       READABILITY CHECKS
    ========================================================== */

    function detectReadabilityIssues(text) {
        const issues = [];
        const allCaps = text.match(/\b[A-Z]{3,}\b/g);
        if (allCaps) issues.push(`ALL CAPS: "${allCaps.join('", "')}" — hard to read`);
        const repeated = text.match(/(.)\1{4,}/g);
        if (repeated) issues.push(`Repeated characters: "${repeated.join('", "')}" — hard to read`);
        const excessPunct = text.match(/[!?]{3,}/g);
        if (excessPunct) issues.push(`Excessive punctuation: "${excessPunct.join('", "')}"`);
        return issues;
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

        // Focus the Send button so keyboard events target the modal, not the textarea
        setTimeout(() => document.getElementById('sc-btn-send')?.focus(), 0);

        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); onCancel(); } });
        document.getElementById('sc-btn-cancel').addEventListener('click', () => { overlay.remove(); onCancel(); });
        document.getElementById('sc-btn-send').addEventListener('click', () => { overlay.remove(); onSend(workingText); });

        // Enter on the modal triggers Send, Escape triggers Cancel.
        // Use keyup so the key is fully released before focus returns to
        // the textarea — prevents the Enter from re-firing attemptSend.
        const modalKeyHandler = e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                overlay.removeEventListener('keydown', modalKeyHandler);
                overlay.remove();
                setTimeout(() => onSend(workingText), 50);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                overlay.removeEventListener('keydown', modalKeyHandler);
                overlay.remove();
                onCancel();
            }
        };
        overlay.addEventListener('keydown', modalKeyHandler);

        // Clean up listener if modal is removed any other way
        const cleanupObserver = new MutationObserver(() => {
            if (!document.getElementById('sc-modal-overlay')) {
                cleanupObserver.disconnect();
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
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });
        textarea.addEventListener('keydown', e => {
            handleTabComplete(textarea, e);
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Don't fire if a review modal is already open
                if (!document.getElementById('sc-modal-overlay')) {
                    attemptSend(textarea, originalInput);
                }
            }
        });
        originalInput.addEventListener('focus', () => textarea.focus());

        const chatwrap = document.getElementById('chatwrap');
        if (chatwrap) {
            chatwrap.addEventListener('click', e => {
                if (e.target === chatwrap || e.target.id === 'messagebuffer') textarea.focus();
            });
        }

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

    function relocateEmoteButton() {
        if (document.getElementById('sc-emote-proxy')) return;
        const original = document.getElementById('emotelistbtn');
        if (!original) return;

        const proxy = document.createElement('button');
        proxy.id = 'sc-emote-proxy';
        proxy.textContent = '▦';
        proxy.title = 'Emotes';
        proxy.setAttribute('aria-label', 'Emote Picker');

        proxy.addEventListener('click', e => {
            e.stopPropagation();
            original.click();
        });

        document.body.appendChild(proxy);

        // Style the original emotelistbtn to look like our proxy too
        if (!original.dataset.pickerApplied) {
            original.textContent = '▦';
            original.dataset.pickerApplied = 'true';
        }
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

    function parseMovieFilename(raw) {
        // Remove file extension
        let s = raw.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|divx|xvid|ogv)$/i, '');

        // Extract year from brackets or parens: [1984] or (1984)
        let year = null;
        const yearMatch = s.match(/[\[(](\d{4})[\])]/);
        if (yearMatch) {
            year = yearMatch[1];
            s = s.slice(0, yearMatch.index); // strip everything from year onwards
        }

        // Replace dots and underscores with spaces
        s = s.replace(/[._]+/g, ' ');

        // Strip leftover brackets and their contents (tags like [BluRay], [720p])
        s = s.replace(/[\[(][^\])]*/g, '').replace(/[\])]/, '');

        // Trim and collapse whitespace
        s = s.replace(/\s+/g, ' ').trim();

        return { title: s, year };
    }

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

    /* ==========================================================
       MOVIE LINKS — TMDB lookup → confirmed IMDb + Letterboxd + Wikipedia
    ========================================================== */

    const LINK_DEFS = [
        { key: 'imdb',       label: 'IMDb',       color: '#f5c518', fg: '#000', char: 'i' },
        { key: 'letterboxd', label: 'Letterboxd', color: '#2c4a2e', fg: '#00e054', char: 'L' },
        { key: 'wiki',       label: 'Wikipedia',  color: '#444',    fg: '#eee', char: 'W' },
    ];

    let lastMovieTitle = '';
    let movieLinkCache = {}; // cache by raw title to avoid repeat lookups

    // ── Kill-Count JSONL (fetched once, keyed by tmdbId) ───────────────────────
    let killCountDb = null; // null = not loaded yet, {} = loaded (may be empty)

    async function getKillCountDb() {
        if (killCountDb !== null) return killCountDb;
        killCountDb = {};
        try {
            // Use GM_xmlhttpRequest to bypass any CORS issues with raw.githubusercontent.com
            const text = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/lklynet/Kill-Count/main/killcounts.jsonl',
                    onload: r => r.status === 200 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
                    onerror: reject,
                });
            });
            let loaded = 0;
            for (const line of text.split('\n')) {
                const s = line.trim();
                if (!s) continue;
                try {
                    const entry = JSON.parse(s);
                    // Field name confirmed from repo: tmdb_id and count
                    if (entry.tmdb_id != null) {
                        killCountDb[String(entry.tmdb_id)] = entry.count;
                        loaded++;
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[CyTube SC] Kill count DB failed to load:', e);
        }
        return killCountDb;
    }


    /* ==========================================================
       NATIVE HTTP (CORS-free) — used for API-key validation and
       any API that doesn't send CORS headers. Falls back gracefully
       when the native bridge isn't present.
    ========================================================== */
    const _scHttpCbs = {};
    window.__scHttpResolve = function (id, res) {
        const cb = _scHttpCbs[id];
        if (cb) { delete _scHttpCbs[id]; cb(res); }
    };
    function nativeHttpGet(url, headers = {}) {
        return new Promise((resolve, reject) => {
            if (!(window.CytubeNative && typeof CytubeNative.httpGet === 'function')) {
                reject(new Error('native http unavailable'));
                return;
            }
            const id = 'h' + Math.random().toString(36).slice(2);
            _scHttpCbs[id] = (res) => {
                if (res && res.error) reject(new Error(res.error));
                else resolve(res);
            };
            try { CytubeNative.httpGet(id, url, JSON.stringify(headers)); }
            catch (e) { delete _scHttpCbs[id]; reject(e); }
            // Timeout guard
            setTimeout(() => {
                if (_scHttpCbs[id]) { delete _scHttpCbs[id]; reject(new Error('timeout')); }
            }, 10000);
        });
    }

    // Returns 'valid' | 'invalid' | 'error'
    async function validateTmdbKey(key) {
        if (!key) return 'invalid';
        const url = `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`;
        try {
            // TMDB is CORS-friendly, so a plain fetch works; native is the fallback
            const res = await fetch(url);
            if (res.status === 200) return 'valid';
            if (res.status === 401) return 'invalid';
            return 'error';
        } catch (e) {
            try {
                const r = await nativeHttpGet(url);
                if (r.status === 200) return 'valid';
                if (r.status === 401) return 'invalid';
                return 'error';
            } catch (e2) { return 'error'; }
        }
    }

    /* ==========================================================
       IMDb GraphQL (public endpoint, via native HTTP to dodge CORS)
       The website's own endpoint accepts arbitrary queries, so we send our
       OWN query (no persisted-hash maintenance). Works over GET; reuses the
       native bridge. Data is "non-commercial use only" per IMDb — fine here.
    ========================================================== */
    const IMDB_GQL = 'https://caching.graphql.imdb.com/';
    const IMDB_HEADERS = {
        'Accept': 'application/graphql+json, application/json',
        'Content-Type': 'application/json',
        'x-imdb-client-name': 'imdb-web-next-localized',
        'x-imdb-user-language': 'en-US',
        'x-imdb-user-country': 'US',
    };

    async function imdbQuery(operationName, query, variables) {
        const url = IMDB_GQL +
            '?operationName=' + encodeURIComponent(operationName) +
            '&query='         + encodeURIComponent(query) +
            '&variables='     + encodeURIComponent(JSON.stringify(variables));
        const res = await nativeHttpGet(url, IMDB_HEADERS);
        if (!res || res.status !== 200) throw new Error('IMDb GQL HTTP ' + (res && res.status));
        return JSON.parse(res.body);
    }

    // Returns [{category, severity}] (severity: None/Mild/Moderate/Severe) or null.
    async function fetchImdbParentalGuide(tconst) {
        if (!tconst) return null;
        const q = 'query GHGuide($id: ID!){ title(id:$id){ parentsGuide{ categories{ category{ text } severity{ text } } } } }';
        try {
            const data = await imdbQuery('GHGuide', q, { id: tconst });
            const cats = data && data.data && data.data.title && data.data.title.parentsGuide
                ? data.data.title.parentsGuide.categories : null;
            if (!cats) return null;
            return cats
                .map(c => ({ category: c.category && c.category.text, severity: c.severity && c.severity.text }))
                .filter(c => c.category && c.severity);
        } catch (e) { return null; }
    }

    // Trivia — lazy-fetched + cached per tconst (the lists can be hundreds long)
    const _triviaCache = {};
    async function fetchImdbTrivia(tconst) {
        if (!tconst) return null;
        if (_triviaCache[tconst]) return _triviaCache[tconst];
        const q = 'query GHTrivia($id: ID!){ title(id:$id){ trivia(first: 30){ edges{ node{ text{ plainText } } } } } }';
        try {
            const data = await imdbQuery('GHTrivia', q, { id: tconst });
            const edges = data && data.data && data.data.title && data.data.title.trivia
                ? data.data.title.trivia.edges : [];
            const items = (edges || []).map(e => e && e.node && e.node.text && e.node.text.plainText).filter(Boolean);
            _triviaCache[tconst] = items;
            return items;
        } catch (e) { return null; }
    }

    async function lookupMovie(title, year) {
        const cacheKey = title + (year || '');
        if (movieLinkCache[cacheKey] !== undefined) return movieLinkCache[cacheKey];

        // ── TMDB + Wikipedia in parallel ─────────────────────────────────────────
        let tmdbResult = null;
        let wikiUrl    = null;

        const tmdbPromise = hasKey(LS_TMDB) ? (async () => {
            try {
                const params = new URLSearchParams({ api_key: getKey(LS_TMDB), query: title, language: 'en-US' });
                if (year) params.set('year', year);
                const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
                if (!res.ok) return;
                const data = await res.json();
                if (!data.results?.length) return;
                let best = data.results[0];
                if (year) {
                    const withYear = data.results.find(r => r.release_date?.startsWith(year));
                    if (withYear) best = withYear;
                }
                const detailRes = await fetch(
                    `https://api.themoviedb.org/3/movie/${best.id}?api_key=${getKey(LS_TMDB)}&append_to_response=external_ids`
                );
                if (!detailRes.ok) return;
                const detail = await detailRes.json();
                tmdbResult = {
                    tmdbId: best.id,
                    imdbId: detail.imdb_id || detail.external_ids?.imdb_id || null,
                    title:  detail.title,
                    year:   detail.release_date ? detail.release_date.slice(0, 4) : year,
                    poster:   detail.poster_path   ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`    : null,
                    backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
                    rating:   detail.vote_average  ? Math.round(detail.vote_average * 10) / 10 : null,
                    runtime:  detail.runtime || null,
                    overview: detail.overview || '',
                    genres:   (detail.genres || []).map(g => g.name),
                };
            } catch (e) {}
        })() : Promise.resolve();

        // Wikipedia can start immediately with the raw title; we'll use tmdbResult.title if available
        // but since it runs in parallel we use the raw title — good enough for wiki search
        const wikiPromise = (async () => {
            try {
                const searchTitle = title + (year ? ' ' + year : '') + ' film';
                const res = await fetch(
                    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${
                        encodeURIComponent(searchTitle)
                    }&srlimit=1&format=json&origin=*`
                );
                if (!res.ok) return;
                const data = await res.json();
                const hit = data?.query?.search?.[0];
                if (hit) wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
            } catch (e) {}
        })();

        await Promise.all([tmdbPromise, wikiPromise]);

        // ── Kill count (from cached JSONL) ───────────────────────────────────────
        let killCount = null;
        if (tmdbResult?.tmdbId) {
            const db = await getKillCountDb();
            const count = db[String(tmdbResult.tmdbId)];
            if (count !== undefined && count !== null) killCount = count;
        }

        // ── IMDb Parent Guide (severity by category) ─────────────────────────────
        const parentalGuide = await fetchImdbParentalGuide(tmdbResult?.imdbId);

        const result = {
            links: {
                imdb:       tmdbResult?.imdbId  ? `https://www.imdb.com/title/${tmdbResult.imdbId}/` : null,
                letterboxd: tmdbResult?.tmdbId  ? `https://letterboxd.com/tmdb/${tmdbResult.tmdbId}` : null,
                wiki:       wikiUrl,
            },
            killCount,
            parentalGuide,
            imdbId:     tmdbResult?.imdbId  || null,
            cleanTitle: tmdbResult?.title  || null,
            cleanYear:  tmdbResult?.year   || null,
            poster:     tmdbResult?.poster   || null,
            backdrop:   tmdbResult?.backdrop || null,
            rating:     tmdbResult?.rating   ?? null,
            runtime:    tmdbResult?.runtime  ?? null,
            overview:   tmdbResult?.overview || '',
            genres:     tmdbResult?.genres   || [],
        };

        movieLinkCache[cacheKey] = result;
        return result;
    }

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

        if (!rawTitle || rawTitle === lastMovieTitle || rawTitle.length < 2) return;
        lastMovieTitle = rawTitle;

        // Clean up any previous links/stats/trivia button
        ['sc-movie-links', 'sc-movie-stats', 'sc-trivia-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

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
            // Update the title element with the clean TMDB title if available
            if (cleanTitle && titleEl) {
                // No prefix — "Currently Playing:" label is hidden via CSS
                const newText = cleanTitle + (cleanYear ? ` (${cleanYear})` : '');
                // Only replace the text node, not the child elements (links etc.)
                const textNode = [...titleEl.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
                if (textNode) textNode.textContent = newText;
                else titleEl.firstChild && (titleEl.firstChild.textContent = newText);
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
        socket.on('changeMedia', (data) => {
            try {
                currentMediaSeconds = (data && typeof data.seconds === 'number') ? data.seconds : 0;
                currentMediaType    = (data && data.type) ? data.type : '';
                lastMovieTitle = '';                 // force a fresh lookup
                setTimeout(triggerTitleInject, 350); // let the title DOM settle first
            } catch (e) {}
        });
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
    let _npWatcherInit = false;

    // Currently TV-only so the tuned mobile layout is untouched.
    // Flip to `true` to enable the card on phones too.
    function _npCardEnabled() { return _isTv; }

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
                    </div>
                </div>`;
            document.body.appendChild(card);
            // Tapping/clicking the card dismisses it
            card.addEventListener('click', hideNowPlayingCard);
        }

        const title  = data.cleanTitle || lastMovieTitle || '';
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

        clearTimeout(_npHideTimer);
        if (opts.autoHide) {
            // Only auto-hide if the video is actually playing
            const v = document.querySelector('#videowrap video');
            const playing = v && !v.paused;
            if (playing || !v) _npHideTimer = setTimeout(hideNowPlayingCard, 7000);
        }
    }

    function hideNowPlayingCard() {
        const card = document.getElementById('sc-np-card');
        if (card) card.classList.remove('sc-np-visible');
        clearTimeout(_npHideTimer);
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
            if (!h._scNpBound) {
                h._scNpBound = true;
                h.style.cursor = 'pointer';
                h.addEventListener('click', () => { if (_npData) showNowPlayingCard(_npData, { autoHide: false }); });
            }
            // Small "Trivia" button next to the title (only once we have a movie with IMDb id)
            if (_npData && _npData.imdbId && !document.getElementById('sc-trivia-btn')) {
                const btn = document.createElement('button');
                btn.id = 'sc-trivia-btn'; btn.type = 'button'; btn.textContent = 'Trivia';
                btn.addEventListener('click', (e) => { e.stopPropagation(); showTriviaCard(); });
                h.appendChild(btn);
            }
        };
        bindTitle();
        new MutationObserver(bindTitle).observe(document.body, { childList: true, subtree: true });
    }

    /* ==========================================================
       USER COLOR SYSTEM
    ========================================================== */

    function hashString(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) { h = str.charCodeAt(i) + ((h << 5) - h); h |= 0; }
        return Math.abs(h);
    }
    function usernameToColor(u) {
        const h = hashString(u);
        return `hsl(${h % 360}, ${75 + (h % 15)}%, ${60 + (h % 10)}%)`;
    }
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
        const firstRun = !tmdbVal;

        const overlay = document.createElement('div');
        overlay.id = 'sc-settings-overlay';
        overlay.innerHTML = `
            <div id="sc-settings-modal">
                <div id="sc-settings-title">⚙ CyTube Script Settings</div>
                ${firstRun ? '<div class="sc-settings-intro">First time setup — enter your API keys below. Both are optional but unlock extra features. You can update them any time via the ⚙ button.</div>' : ''}

                <div class="sc-settings-group">
                    <label class="sc-settings-label">
                        TMDB API Key
                        <span class="sc-settings-note">Unlocks: IMDb/Letterboxd links, kill counts, DtDD stats</span>
                    </label>
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

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <input type="checkbox" id="sc-input-spellcheck" ${spellCheckEnabled() ? 'checked' : ''} />
                        <span>Grammar &amp; spell check popup</span>
                        <span class="sc-settings-note">When off, messages send immediately without review</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? 'checked' : ''} />
                        <span>Disable on-screen keyboard</span>
                        <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                    </label>
                </div>

                <div class="sc-settings-group sc-settings-toggle-group">
                    <label class="sc-settings-toggle-label">
                        <input type="checkbox" id="sc-input-movielinks" ${movieLinksEnabled() ? 'checked' : ''} />
                        <span>Show movie links (IMDb / Letterboxd / Wiki)</span>
                        <span class="sc-settings-note">Adds clickable link badges next to the title — usually unneeded on a TV</span>
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

                <div id="sc-settings-actions">
                    ${!firstRun ? '<button id="sc-settings-cancel">Cancel</button>' : ''}
                    <button id="sc-settings-save">Save</button>
                </div>
                <div id="sc-settings-status"></div>

                <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;margin-top:8px">
                    <div style="font-size:13px;font-weight:600;color:#c0b0ff;margin-bottom:8px">CyTube Account</div>
                    <button id="sc-login-btn" style="background:rgba(192,176,255,0.2);color:#c0b0ff;border:1px solid rgba(192,176,255,0.4);border-radius:6px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;width:100%">Login / Switch Account</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        // Close on backdrop (only if not first run — first run requires at least dismissing)
        if (!firstRun) {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) overlay.remove();
            });
            document.getElementById('sc-settings-cancel').addEventListener('click', () => overlay.remove());
        }

        document.getElementById('sc-settings-save').addEventListener('click', () => {
            const tmdb = document.getElementById('sc-input-tmdb').value.trim();
            const spellcheck = document.getElementById('sc-input-spellcheck').checked;
            setKey(LS_TMDB, tmdb);
            setKey(LS_SPELLCHECK, spellcheck ? 'on' : 'off');
            // Clear movie cache so new keys take effect on next title
            movieLinkCache = {};
            const status = document.getElementById('sc-settings-status');
            status.textContent = '✓ Saved';
            setTimeout(() => overlay.remove(), 800);
        });

        document.getElementById('sc-login-btn').addEventListener('click', () => {
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

        // ── Movie-links toggle (applies on next media; clears current row now) ─
        const mlinks = document.getElementById('sc-input-movielinks');
        if (mlinks) mlinks.addEventListener('change', () => {
            setKey(LS_MOVIE_LINKS, mlinks.checked ? 'on' : 'off');
            if (!mlinks.checked) {
                const row = document.getElementById('sc-movie-links');
                if (row) row.remove();
            } else {
                lastMovieTitle = ''; // force a re-inject so links appear now
            }
        });
    }

    function addSettingsButton() {
        if (document.getElementById('sc-settings-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'sc-settings-btn';
        btn.textContent = '⚙';
        btn.title = 'Script Settings (API keys)';
        btn.addEventListener('click', openSettingsModal);
        document.body.appendChild(btn);
    }

    /* ==========================================================
       POSTER STRIP — toggle show/hide the MOTD poster images
    ========================================================== */

    // Global wake/dim control — exposed so initPosterStrip can call wake()
    let _topBarWake = null;
    let _topBarIsOpen = false;

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
        };

        const wake = () => {
            getDimEls().forEach(el => el.classList.remove('sc-bar-dim'));
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

        // Mouse near top of video area wakes the bar
        document.addEventListener('mousemove', (e) => {
            if (e.clientY < 60 && e.clientX < window.innerWidth * (1)) {
                wake();
            }
        });
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

            const wrap = document.createElement('a');
            wrap.href = img.src;
            wrap.target = '_blank';
            wrap.rel = 'noopener noreferrer';
            wrap.appendChild(thumb);
            strip.appendChild(wrap);
        });
        document.body.appendChild(strip);

        // Toggle button — injected below the video title
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'sc-poster-toggle';
        toggleBtn.textContent = "Coming Attractions";
        toggleBtn.title = 'Show/hide weekend lineup';
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

    // Don't run the channel UI on the login page
    if (window.location.pathname.startsWith('/login')) return;

    waitForBody();

    /* ==========================================================
       CSS + LOAD INIT
    ========================================================== */

    function _scBoot() {
        getKillCountDb(); // pre-fetch kill count DB
        installChatTextarea();
        relocateEmoteButton();
        addFloatingButtons();
        addSettingsButton();
        watchMovieTitle();
        initMediaWatcher();
        initNowPlayingWatcher();
        initTopBar();
        initDesyncButton();
        initChatHeader();
        initUserCount();
        initPollWatcher();

        // First-run settings modal
        if (!hasKey(LS_TMDB)) {
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
        style.textContent = `

            /* ===== SHARED HIDDEN ELEMENTS ===== */
            nav.navbar, #drinkbarwrap, #announcements, #playlistrow,
            #resizewrap, footer, #userlisttoggle, #rightcontrols,
            .modal-header, .timestamp, .modal-footer { display: none !important; }
            body { background-image: none !important; background: #000 !important; }
            .modal, .popover, .dropdown-menu { z-index: 20001 !important; }
            .modal-dialog { margin: 0 auto !important; }
            #resize-video-smaller, #resize-video-larger { display: none !important; }
            /* Remove pause and fullscreen from video.js control bar */
            .video-js .vjs-play-control { display: none !important; }
            .video-js .vjs-fullscreen-control { display: none !important; }
            /* Userlist — hidden but fully rendered so all users appear in DOM */
            #userlist {
                visibility: hidden !important;
                position: absolute !important;
                pointer-events: none !important;
                height: auto !important;
                overflow: hidden !important;
            }
            #userlisttoggle { display: none !important; }
            /* ── TOP BAR SYSTEM ────────────────────────────────────────────────────
               A single gradient band overlays the top of the video.
               After a few seconds the gradient, icons and Coming Attractions
               fade out leaving only the title. Mouse-over restores everything.
               If the poster strip is open nothing fades.

               States driven by .sc-bar-dim on #sc-top-bar:
                 (no class)    = fully visible
                 .sc-bar-dim   = gradient/icons/toggle faded, title stays
            ─────────────────────────────────────────────────────────────────── */

            /* Gradient overlay behind the whole bar */
            /* Gradient starts below the header row so it never alpha-composites
               over the title/pills/toggle — those have their own background */
            #sc-top-bar {
                position: fixed !important;
                top: 20px !important; /* start below the header bar */
                left: 0 !important;
                width: 80vw !important; height: 40px !important;
                z-index: 10001 !important; /* above video */
                pointer-events: none !important;
                background: linear-gradient(
                    to bottom,
                    rgba(0,0,0,0.35) 0%,
                    rgba(0,0,0,0)    100%
                ) !important;
                transition: opacity 1.5s ease !important;
                opacity: 1 !important;
            }
            body.sc-vertical #sc-top-bar { width: 100vw !important; }
            #sc-top-bar.sc-bar-dim { opacity: 0 !important; }

            /* Header — dark background fades out with gradient when dimmed */
            #videowrap-header {
                border: 0 !important;
                background: rgba(0,0,0,0.55) !important;
                padding: 3px 8px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                color: #fff !important;
                text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.9) !important;
                letter-spacing: 0.01em !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                width: 80vw !important;
                box-sizing: border-box !important;
                position: fixed !important;
                top: 0 !important; left: 0 !important;
                z-index: 10002 !important;
                pointer-events: auto !important;
                transition: background 1.5s ease !important;
            }
            /* When dimmed: background fades away, title stays via text-shadow */
            #videowrap-header.sc-bar-dim {
                background: transparent !important;
            }
            body.sc-vertical #videowrap-header { width: 100vw !important; }
            /* Hide the "Currently Playing:" prefix label */
            /* Hide CyTube's original usercount */
            #usercount { display: none !important; }

            /* Chat header bar — sits above #chatwrap */
            #sc-chat-header {
                position: fixed !important;
                top: 0 !important; right: 5px !important;
                width: calc(19vw - 5px) !important; height: 28px !important;
                z-index: 10003 !important;
                background: rgba(0,0,0,0.7) !important;
                border: 1px solid #3a3a3a !important;
                border-bottom: none !important;   /* flow seamlessly into the chat panel */
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 0 8px !important;
                box-sizing: border-box !important;
            }
            body.sc-vertical #sc-chat-header {
                left: 5px !important;
                right: 5px !important;
                width: auto !important;
                bottom: calc(42vh - 20px) !important;
                top: auto !important;
            }
            #sc-usercount-btn, #sc-poll-btn {
                background: transparent !important;
                border: none !important;
                font-size: 10px !important;
                font-weight: 700 !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                color: rgba(255,255,255,0.5) !important;
                cursor: pointer !important;
                padding: 0 4px !important;
                font-family: inherit !important;
                transition: color 0.2s !important;
                line-height: 28px !important;
            }
            #sc-usercount-btn:hover, #sc-poll-btn:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-usercount-btn.sc-users-active,
            #sc-poll-btn.sc-poll-btn-active { color: white !important; }

            /* Users panel — drops down from usercount, same style as poll panel */
            #sc-users-panel {
                position: fixed !important;
                top: 28px !important;
                right: 5px !important;
                width: calc(19vw - 5px) !important;
                z-index: 19000 !important;
                background: rgba(10,10,20,0.95) !important;
                border: 1px solid #3a3a3a !important;
                border-top: none !important;
                border-radius: 0 0 0 8px !important;
                padding: 10px 12px !important;
                color: rgba(255,255,255,0.88) !important;
                font-size: 12px !important;
                line-height: 1.6 !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
                max-height: 60vh !important;
                overflow-y: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.15) transparent !important;
                display: none;
            }
            body.sc-vertical #sc-users-panel {
                top: auto !important;
                bottom: calc(42vh) !important;
                right: 5px !important;
                width: calc(100vw - 5px) !important;
                max-height: 40vh !important;
            }
            .sc-users-panel-header {
                font-size: 10px !important;
                font-weight: 700 !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                color: rgba(255,255,255,0.4) !important;
                margin-bottom: 8px !important;
                padding-bottom: 6px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            }
            .sc-users-panel-name {
                padding: 1px 0 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }

            #videowrap-header .pull-left > span:first-child,
            #videowrap-header .label,
            #videowrap-header b { display: none !important; }
            #videowrap-header strong { font-weight: 500 !important; }

            /* Movie link icons — background fades to transparent when dimmed,
               /* Coming Attractions button — fades with gradient */
            #sc-poster-toggle {
                color: rgba(255,255,255,0.55) !important;
                transition: opacity 1.5s ease, color 0.2s ease !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            #sc-poster-toggle.sc-bar-dim {
                opacity: 0 !important;
                pointer-events: none !important;
            }
            #sc-poster-toggle:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-poster-toggle.sc-poster-toggle-active {
                color: rgba(255,255,255,0.9) !important;
            }
            /* Pull the control bar out of embed-responsive's constrained box
               and pin it as a fixed element flush to the bottom of the screen.
               Right edge stops just before the settings button. */
            /* ===== VIDEO.JS CONTROL BAR — pill style matching our UI buttons ===== */
            .video-js .vjs-control-bar {
                position: fixed !important;
                bottom: 4px !important;
                left: 4px !important;
                right: calc(20vw + 150px) !important;
                width: auto !important;
                margin: 0 !important;
                z-index: 10001 !important;
                /* Pill-style bar */
                background: rgba(255,255,255,0.08) !important;
                border-radius: 999px !important;
                padding: 0 8px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                backdrop-filter: blur(4px) !important;
            }
            body.sc-vertical .video-js .vjs-control-bar {
                bottom: calc(42vh + 15px) !important;
                right: 160px !important;
                left: 4px !important;
            }

            /* Individual control buttons — match pill button style */
            .video-js .vjs-control {
                color: rgba(255,255,255,0.55) !important;
                transition: color 0.3s ease, background 0.3s ease !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-control:hover {
                color: white !important;
                background: rgba(255,255,255,0.12) !important;
            }

            /* Progress / seek bar */
            .video-js .vjs-progress-control {
                border-radius: 999px !important;
                overflow: visible !important;
            }
            .video-js .vjs-progress-holder {
                background: rgba(255,255,255,0.15) !important;
                border-radius: 999px !important;
                height: 4px !important;
                transition: height 0.15s !important;
            }
            .video-js .vjs-progress-holder:hover { height: 6px !important; }
            .video-js .vjs-play-progress {
                background: rgba(255,255,255,0.75) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-play-progress::before {
                color: white !important;
                font-size: 10px !important;
                top: -3px !important;
            }
            .video-js .vjs-load-progress {
                background: rgba(255,255,255,0.1) !important;
                border-radius: 999px !important;
            }

            /* Volume slider */
            .video-js .vjs-volume-bar {
                background: rgba(255,255,255,0.15) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-volume-level {
                background: rgba(255,255,255,0.75) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-volume-level::before {
                color: white !important;
                font-size: 10px !important;
            }

            /* Time display */
            .video-js .vjs-time-control {
                color: rgba(255,255,255,0.55) !important;
                font-size: 11px !important;
                line-height: 32px !important;
                padding: 0 4px !important;
                min-width: 0 !important;
            }

            /* Big play button — pill style */
            .video-js .vjs-big-play-button {
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                margin: 0 !important;
                background: rgba(255,255,255,0.08) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 999px !important;
                width: 60px !important;
                height: 60px !important;
                line-height: 60px !important;
                font-size: 24px !important;
                color: rgba(255,255,255,0.8) !important;
                transition: background 0.3s ease, color 0.3s ease !important;
                backdrop-filter: blur(4px) !important;
            }
            .video-js .vjs-big-play-button:hover {
                background: rgba(255,255,255,0.18) !important;
                color: white !important;
            }
            .video-js:hover .vjs-big-play-button { opacity: 1 !important; }

            /* ===== MOTD — keep hidden, we extract images ourselves ===== */
            #motdrow { display: none !important; }

            /* ===== POSTER STRIP ===== */
            #sc-poster-strip {
                display: none !important; /* hidden by default */
                position: fixed !important;
                top: 20px !important;   /* drops down from the header bar */
                left: 0 !important;
                z-index: 19500 !important;
                width: 80vw !important;
                background: rgba(0,0,0,0.93) !important;
                padding: 8px 12px !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                white-space: nowrap !important;
                border-bottom: 1px solid rgba(255,255,255,0.12) !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.2) transparent !important;
            }
            body.sc-vertical #sc-poster-strip {
                width: 100vw !important;
                top: 20px !important;
                bottom: auto !important;
            }
            #sc-poster-strip.sc-poster-visible {
                display: block !important;
            }
            .sc-poster-thumb {
                height: 110px !important;
                width: auto !important;
                border-radius: 4px !important;
                margin-right: 6px !important;
                opacity: 0.82 !important;
                transition: opacity 0.15s !important;
                vertical-align: top !important;
                cursor: pointer !important;
                display: inline-block !important;
                flex-shrink: 0 !important;
            }
            .sc-poster-thumb:hover { opacity: 1 !important; }

            #sc-poster-zoom {
                display: none;
                position: fixed !important;
                z-index: 99990 !important;
                pointer-events: none !important;
                border-radius: 4px !important;
                box-shadow: 0 0 0 rgba(0,0,0,0) !important;
                border: 1px solid rgba(255,255,255,0.0) !important;
                /* transition animates position, size, shadow, border together */
                transition:
                    top 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    width 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    height 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 0.22s ease,
                    border-color 0.22s ease,
                    border-radius 0.22s ease !important;
            }
            #sc-poster-zoom.sc-zoom-expanded {
                box-shadow: 0 12px 48px rgba(0,0,0,0.92) !important;
                border-color: rgba(255,255,255,0.2) !important;
                border-radius: 6px !important;
            }


            /* Toggle button — right side of the header bar, same line as the title */
            #sc-poster-toggle {
                position: fixed !important;
                top: 0 !important;
                right: 20vw !important;  /* stops at the chat panel edge */
                left: auto !important;
                z-index: 10003 !important;
                background: transparent !important;
                border: none !important;
                border-radius: 0 !important;
                padding: 2px 8px !important;
                font-size: 10px !important;
                cursor: pointer !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                white-space: nowrap !important;
                line-height: 1 !important;
                height: 20px !important;
                display: flex !important;
                align-items: center !important;
            }
            body.sc-vertical #sc-poster-toggle {
                top: 0 !important;
                right: 0 !important;
                left: auto !important;
                bottom: auto !important;
            }

            /* ===== MOVIE LINKS ===== */
            #sc-movie-links {
                display: inline-flex !important;
                gap: 3px !important;
                margin-left: 8px !important;
                vertical-align: middle !important;
            }
            /* Dim: override inline background with transparent, fade text to ghost */
            #sc-movie-links.sc-bar-dim .sc-movie-link {
                background: transparent !important;
                color: rgba(255,255,255,0.3) !important;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15) !important;
            }
            .sc-movie-link {
                display: inline-flex !important;
                align-items: center !important; justify-content: center !important;
                width: 17px !important; height: 17px !important;
                border-radius: 3px !important;
                font-size: 10px !important; font-weight: 900 !important;
                text-decoration: none !important;
                line-height: 1 !important; font-family: Georgia, serif !important;
                flex-shrink: 0 !important; cursor: pointer !important;
                transition: background 2s ease, color 2s ease, box-shadow 2s ease, filter 0.2s ease !important;
            }
            .sc-movie-link:hover { filter: brightness(1.3) !important; }
            .sc-movie-loading { font-size: 11px !important; color: rgba(255,255,255,0.3) !important; margin-left: 6px !important; }
            /* Stats bar — floats over bottom-left of video, auto-hides after 12s */
            #sc-movie-stats {
                position: fixed !important;
                bottom: 40px !important;
                left: 12px !important;
                z-index: 19000 !important;
                background: rgba(0,0,0,0.75) !important;
                color: rgba(255,255,255,0.9) !important;
                font-size: 13px !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                letter-spacing: 0.03em !important;
                line-height: 1.4 !important;
                pointer-events: none !important;
                max-width: 75vw !important;
                animation: sc-stats-fadein 0.4s ease !important;
            }
            @keyframes sc-stats-fadein {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0); }
            }


            /* ===== FLOATING BUTTONS (body-level, always visible) ===== */
            #sc-desync-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important; height: 28px !important;
                padding: 0 !important;
                font-size: 15px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
            }
            #sc-desync-btn:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }
            #sc-desync-btn.sc-desync-active {
                color: #ffcc44 !important;
                background: rgba(255,200,50,0.18) !important;
            }
            body.sc-horizontal #sc-desync-btn {
                bottom: 6px !important;
                right: calc(20vw + 38px) !important;
            }
            body.sc-vertical #sc-desync-btn {
                bottom: 43vh !important;
                right: 46px !important;
            }

            #fs-toggle-btn, #sc-emote-proxy {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                font-size: 15px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
            }
            #fs-toggle-btn:hover, #sc-emote-proxy:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }
            #fs-toggle-btn:focus { outline: none !important; }

            /* ===== HORIZONTAL LAYOUT (widescreen) ===== */
            body.sc-horizontal #videowrap {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 79vw !important; height: 100vh !important;
                z-index: 9999 !important; background: black !important;
            }
            body.sc-horizontal #videowrap .embed-responsive,
            body.sc-horizontal #ytapiplayer {
                width: 79vw !important; height: 100vh !important;
            }
            body.sc-horizontal #chatwrap {
                position: fixed !important; top: 28px !important; right: 0 !important;
                width: 19vw !important; height: calc(100vh - 28px) !important;
                z-index: 9999 !important; background: rgba(0,0,0,0.7) !important;
                overflow: hidden !important; padding: 0 !important; margin: 0 !important;
                box-sizing: border-box !important;
                border: 1px solid #3a3a3a !important; border-top: none !important;  /* match the header */
                display: flex !important; flex-direction: column !important;
            }
            /* One consistent 8px inset for everything in the chat column, so the
               messages, input and header all share the same left/right edge. */
            body.sc-horizontal #chatwrap > * { margin-left: 0 !important; margin-right: 0 !important; box-sizing: border-box !important; width: 100% !important; }
            body.sc-horizontal #messagebuffer,
            body.sc-horizontal #sc-mobile-input-row { padding-left: 8px !important; padding-right: 8px !important; }
            body.sc-horizontal #sc-chat-header { padding: 0 8px !important; margin: 0 !important; }
            /* Hide send button in horizontal — Enter key sends */
            body.sc-horizontal #sc-send-btn { display: none !important; }
            body.sc-horizontal #sc-mobile-input-row { padding: 4px 0 !important; }
            body.sc-horizontal #leftcontrols { display: none !important; }
            /* Horizontal: buttons bottom-right of video */
            body.sc-horizontal #sc-emote-proxy {
                bottom: 6px !important; right: calc(20vw + 6px) !important;
            }
            body.sc-horizontal #fs-toggle-btn {
                bottom: 6px !important; right: calc(20vw + 70px) !important;
            }

            /* ===== VERTICAL LAYOUT (portrait monitor) ===== */
            body.sc-vertical #videowrap {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 55vh !important;
                z-index: 9999 !important; background: black !important;
                border: none !important; outline: none !important;
                box-shadow: none !important;
            }
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer {
                width: 100vw !important; height: 55vh !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            body.sc-vertical .video-js {
                margin: 0 !important;
                padding: 0 !important;
                left: 0 !important;
            }
            body.sc-vertical .vjs-tech {
                left: 0 !important;
                margin: 0 !important;
            }
            body.sc-vertical #chatwrap {
                position: fixed !important; bottom: 0 !important; left: 0 !important;
                width: 100vw !important; height: calc(42vh - 28px) !important;
                z-index: 9999 !important; background: rgba(0,0,0,0.85) !important;
                overflow: hidden !important; padding: 0 5px !important;
                display: flex !important; flex-direction: column !important;
            }
            body.sc-vertical #messagebuffer { font-size: 15px !important; }

            /* Vertical: all buttons in one right-pinned row flush on top of the chat panel.
               leftcontrols hides its own internal layout; we show a proxy row instead. */
            body.sc-vertical #leftcontrols { display: none !important; }

            /* fs + emote buttons: right-pinned, sitting exactly on the chat top edge */
            body.sc-vertical #sc-emote-proxy {
                bottom: 43vh !important;
                right: 8px !important; left: auto !important;
            }
            body.sc-vertical #fs-toggle-btn {
                bottom: 43vh !important;
                right: 84px !important; left: auto !important;
            }

            /* ===== SHARED CHAT ELEMENTS ===== */
            #messagebuffer {
                flex: 1 !important; height: auto !important;
                width: 100% !important; box-sizing: border-box !important;
                padding-left: 0 !important; padding-right: 0 !important; margin: 0 !important;
                background: transparent !important; color: white !important; border: none !important;
                font-size: 14px !important; overflow-x: hidden !important; overflow-y: auto !important; padding-bottom: 5px !important;
            }
            /* Long usernames / links must wrap, never widen the panel */
            #messagebuffer, #messagebuffer * {
                overflow-wrap: anywhere !important; word-break: break-word !important;
                max-width: 100% !important;
            }
            #sc-chat-textarea {
                width: 100% !important; min-height: 44px !important; max-height: 120px !important;
                background: rgba(255,255,255,0.1) !important; color: white !important;
                border: 1px solid rgba(255,255,255,0.3) !important; border-radius: 4px !important;
                padding: 6px 8px !important; font-size: 14px !important; font-family: inherit !important;
                resize: none !important; overflow-y: auto !important;
                box-sizing: border-box !important; line-height: 1.4 !important;
                outline: none !important; transition: border-color 0.2s !important; flex-shrink: 0 !important;
            }
            #sc-chat-textarea:focus {
                border-color: rgba(255,255,255,0.7) !important;
                background: rgba(255,255,255,0.15) !important;
            }
            #sc-chat-textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
            #sc-checking {
                font-size: 11px !important; color: rgba(255,255,200,0.6) !important;
                padding: 2px 4px !important; flex-shrink: 0 !important;
            }

            /* ===== REVIEW MODAL ===== */
            #sc-modal-overlay {
                position: fixed !important; inset: 0 !important;
                background: rgba(0,0,0,0.8) !important; z-index: 99999 !important;
                display: flex !important; align-items: center !important;
                justify-content: center !important; font-family: system-ui, sans-serif !important;
            }
            #sc-modal {
                background: #13131f !important; border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 12px !important; padding: 20px !important;
                max-width: 520px !important; width: 94vw !important; color: white !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important; max-height: 85vh !important;
                overflow-y: auto !important; display: flex !important; flex-direction: column !important; gap: 12px !important;
            }
            #sc-modal-title { font-size: 16px !important; font-weight: 700 !important; color: #f0c040 !important; margin: 0 !important; }
            #sc-readability { display: flex !important; flex-direction: column !important; gap: 4px !important; }
            .sc-readability-issue {
                font-size: 12px !important; color: #ffd080 !important;
                background: rgba(255,200,80,0.08) !important; border-radius: 4px !important; padding: 4px 8px !important;
            }
            #sc-preview-wrap {
                background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 6px !important; padding: 10px 12px !important;
                line-height: 1.6 !important; font-size: 14px !important; color: #e0e0e0 !important; word-break: break-word !important;
            }
            .sc-error-span {
                background: rgba(255,80,80,0.25) !important; border-bottom: 2px solid #ff5555 !important;
                border-radius: 2px !important; cursor: pointer !important; padding: 0 1px !important; transition: background 0.15s !important;
            }
            .sc-error-span:hover { background: rgba(255,80,80,0.45) !important; }
            #sc-error-detail {
                background: rgba(255,255,255,0.04) !important; border-radius: 6px !important;
                padding: 8px 10px !important; font-size: 13px !important; min-height: 36px !important; color: #ccc !important;
            }
            #sc-error-detail:empty { display: none !important; }
            .sc-detail-msg { margin-bottom: 8px !important; color: #ffcccc !important; }
            .sc-detail-actions { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; }
            .sc-sug-btn {
                background: rgba(60,180,100,0.2) !important; color: #90ffa0 !important;
                border: 1px solid rgba(60,200,100,0.4) !important; border-radius: 5px !important;
                padding: 4px 10px !important; cursor: pointer !important; font-size: 12px !important;
            }
            .sc-sug-btn:hover { background: rgba(60,180,100,0.4) !important; }
            .sc-reject-btn {
                background: rgba(255,255,255,0.07) !important; color: #aaa !important;
                border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 5px !important;
                padding: 4px 10px !important; cursor: pointer !important; font-size: 12px !important;
            }
            .sc-reject-btn:hover { background: rgba(255,255,255,0.14) !important; }
            #sc-modal-actions { display: flex !important; gap: 10px !important; justify-content: flex-end !important; }
            #sc-btn-cancel {
                background: rgba(255,255,255,0.08) !important; color: #ccc !important;
                border: 1px solid rgba(255,255,255,0.2) !important; border-radius: 6px !important;
                padding: 7px 16px !important; cursor: pointer !important; font-size: 13px !important;
            }
            #sc-btn-cancel:hover { background: rgba(255,255,255,0.16) !important; }
            #sc-btn-send {
                background: rgba(60,180,100,0.25) !important; color: #90ffa0 !important;
                border: 1px solid rgba(60,200,100,0.5) !important; border-radius: 6px !important;
                padding: 7px 16px !important; cursor: pointer !important; font-size: 13px !important; font-weight: 600 !important;
            }
            #sc-btn-send:hover { background: rgba(60,180,100,0.4) !important; }
            #sc-lt-credit { font-size: 10px !important; color: rgba(255,255,255,0.25) !important; text-align: right !important; }
            #sc-lt-credit a { color: rgba(255,255,255,0.35) !important; }

            /* ===== SETTINGS BUTTON ===== */
            #sc-settings-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                font-size: 13px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
                line-height: 1 !important;
            }
            #sc-settings-btn:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }

            body.sc-horizontal #sc-settings-btn {
                bottom: 6px !important; right: calc(20vw + 102px) !important;
            }
            body.sc-vertical #sc-settings-btn {
                bottom: 43vh !important; right: 122px !important;
            }

            /* ===== SETTINGS MODAL ===== */
            #sc-settings-overlay {
                position: fixed !important; inset: 0 !important;
                background: rgba(0,0,0,0.85) !important;
                z-index: 99998 !important;
                display: flex !important;
                align-items: center !important; justify-content: center !important;
                font-family: system-ui, sans-serif !important;
            }
            #sc-settings-modal {
                background: #0e0e1a !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 12px !important;
                padding: 24px !important;
                width: min(480px, 94vw) !important;
                color: white !important;
                box-shadow: 0 16px 48px rgba(0,0,0,0.8) !important;
                display: flex !important; flex-direction: column !important; gap: 16px !important;
                max-height: 90vh !important; overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
            }
            /* Validate-key button sits inline with each key input */
            .sc-settings-input-row { display: flex !important; gap: 8px !important; align-items: stretch !important; }
            .sc-settings-input-row .sc-settings-input { flex: 1 !important; }
            .sc-settings-test {
                flex-shrink: 0 !important;
                background: rgba(192,176,255,0.15) !important;
                color: #c0b0ff !important;
                border: 1px solid rgba(192,176,255,0.35) !important;
                border-radius: 6px !important;
                padding: 0 16px !important; font-size: 13px !important; font-weight: 600 !important;
                cursor: pointer !important;
            }
            .sc-settings-test:disabled { opacity: 0.5 !important; cursor: default !important; }
            .sc-settings-test-status { font-size: 12px !important; min-height: 14px !important; }
            .sc-settings-test-status.sc-test-ok      { color: #7dffa0 !important; }
            .sc-settings-test-status.sc-test-bad     { color: #ff8080 !important; }
            .sc-settings-test-status.sc-test-pending { color: rgba(255,255,255,0.55) !important; }
            /* Chat font-size slider + live sample */
            .sc-settings-range { width: 100% !important; accent-color: #c0b0ff !important; cursor: pointer !important; }
            .sc-font-sample {
                margin-top: 10px !important; padding: 10px 12px !important;
                background: rgba(255,255,255,0.05) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 6px !important; color: rgba(255,255,255,0.88) !important;
                line-height: 1.4 !important;
            }
            #sc-settings-title {
                font-size: 17px !important; font-weight: 700 !important;
                color: #c0b0ff !important;
            }
            .sc-settings-intro {
                font-size: 13px !important; color: rgba(255,255,255,0.6) !important;
                line-height: 1.5 !important;
                background: rgba(255,255,255,0.04) !important;
                border-radius: 6px !important; padding: 8px 10px !important;
            }
            .sc-settings-group {
                display: flex !important; flex-direction: column !important; gap: 5px !important;
            }
            .sc-settings-label {
                font-size: 13px !important; font-weight: 600 !important;
                color: rgba(255,255,255,0.85) !important;
                display: flex !important; flex-direction: column !important; gap: 2px !important;
            }
            .sc-settings-note {
                font-weight: 400 !important; font-size: 11px !important;
                color: rgba(255,255,255,0.4) !important;
            }
            .sc-settings-input {
                background: rgba(255,255,255,0.07) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 6px !important;
                color: white !important;
                padding: 8px 10px !important;
                font-size: 13px !important;
                font-family: monospace !important;
                outline: none !important;
                width: 100% !important; box-sizing: border-box !important;
            }
            .sc-settings-input:focus {
                border-color: rgba(192,176,255,0.6) !important;
                background: rgba(255,255,255,0.1) !important;
            }
            .sc-settings-link {
                font-size: 11px !important; color: rgba(192,176,255,0.7) !important;
                text-decoration: none !important; align-self: flex-start !important;
            }
            .sc-settings-link:hover { color: #c0b0ff !important; text-decoration: underline !important; }
            .sc-settings-toggle-group { border-top: 1px solid rgba(255,255,255,0.08) !important; padding-top: 12px !important; }
            .sc-settings-toggle-label {
                display: flex !important; flex-direction: column !important; gap: 3px !important;
                cursor: pointer !important; font-size: 13px !important;
                font-weight: 600 !important; color: rgba(255,255,255,0.85) !important;
            }
            .sc-settings-toggle-label input[type="checkbox"] {
                width: 16px !important; height: 16px !important;
                margin: 0 8px 0 0 !important; cursor: pointer !important;
                accent-color: #c0b0ff !important;
            }
            .sc-settings-toggle-label > span:first-of-type {
                display: flex !important; align-items: center !important;
            }
            #sc-settings-actions {
                display: flex !important; gap: 10px !important; justify-content: flex-end !important;
                margin-top: 4px !important;
            }
            #sc-settings-cancel {
                background: rgba(255,255,255,0.08) !important; color: #aaa !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 6px !important; padding: 8px 18px !important;
                cursor: pointer !important; font-size: 13px !important;
            }
            #sc-settings-cancel:hover { background: rgba(255,255,255,0.14) !important; }
            #sc-settings-save {
                background: rgba(192,176,255,0.2) !important; color: #c0b0ff !important;
                border: 1px solid rgba(192,176,255,0.4) !important;
                border-radius: 6px !important; padding: 8px 18px !important;
                cursor: pointer !important; font-size: 13px !important; font-weight: 600 !important;
            }
            #sc-settings-save:hover { background: rgba(192,176,255,0.35) !important; }


            /* Poll panel */
            #sc-poll-panel {
                position: fixed !important;
                top: 28px !important;
                right: 5px !important;
                width: calc(19vw - 5px) !important;
                z-index: 19000 !important;
                background: rgba(10,10,20,0.95) !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 8px !important;
                padding: 12px 14px !important;
                max-width: 100% !important;
                color: rgba(255,255,255,0.88) !important;
                font-size: 13px !important;
                line-height: 1.5 !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
                font-family: system-ui, sans-serif !important;
            }
            body.sc-vertical #sc-poll-panel {
                right: 0 !important;
                top: auto !important;
                bottom: calc(42vh + 42px) !important;
                max-width: 98vw !important;
            }
            .sc-poll-header {
                font-weight: 600 !important;
                font-size: 14px !important;
                color: #f0c040 !important;
                margin-bottom: 8px !important;
                padding-bottom: 6px !important;
                border-bottom: 1px solid rgba(255,255,255,0.1) !important;
            }
            .sc-poll-option {
                margin-bottom: 6px !important;
                color: rgba(255,255,255,0.82) !important;
                font-size: 13px !important;
            }
            .sc-poll-option a {
                color: #7eb8f7 !important;
                word-break: break-all !important;
            }
            .sc-poll-meta {
                margin-top: 8px !important;
                font-size: 11px !important;
                color: rgba(255,255,255,0.35) !important;
                text-align: right !important;
            }

            #sc-settings-status {
                font-size: 12px !important; color: #90ffa0 !important;
                text-align: center !important; min-height: 16px !important;
            }
        `;
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

    // Detect TV. Prefer the authoritative native leanback flag (via the bridge);
    // fall back to a screen/touch heuristic only if the bridge isn't present
    // (e.g. running as a plain userscript in a browser).
    const _isTv = (function () {
        try {
            if (window.CytubeNative && typeof CytubeNative.isTv === 'function') return !!CytubeNative.isTv();
        } catch (e) {}
        return window.screen.width >= 1280 && !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
    })();
    try {
        console.log('[Grindhouse] TV mode:', _isTv,
            '| native bridge:', !!(window.CytubeNative && CytubeNative.isTv),
            '| screen:', screen.width + 'x' + screen.height,
            '| touchPoints:', navigator.maxTouchPoints,
            '| ontouchstart:', ('ontouchstart' in window));
    } catch (e) {}

    // Shared mobile/TV CSS overrides
    (function() {
        const s = document.createElement('style');
        s.textContent = `
            html, body { width: 100vw !important; overflow-x: hidden !important; background: #000 !important; }

            /* Clean, distance-legible chat type (Inter, falling back to Roboto/system) */
            #messagebuffer, #messagebuffer *, #sc-chat-textarea {
                font-family: 'Inter', 'Roboto', system-ui, -apple-system, sans-serif !important;
                letter-spacing: 0.005em !important;
            }
            #messagebuffer { line-height: 1.35 !important; }
            body.sc-tv #messagebuffer { font-weight: 500 !important; }
            /* Poll notifications carry a hardcoded 14pt size — make them match chat */
            #messagebuffer .poll-notify { font-size: inherit !important; }

            /* App is always fullscreen — the toggle is redundant */
            #fs-toggle-btn { display: none !important; }

            /* 44px touch / focus targets on all devices */
            #sc-desync-btn, #sc-emote-proxy, #sc-settings-btn {
                width: 44px !important; height: 44px !important; font-size: 18px !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            /* Prevent input zoom on mobile */
            #sc-chat-textarea { font-size: 16px !important; }

            /* ── VERTICAL (portrait phone) ───────────────────── */
            /* Video gets 60vh — stays large even when keyboard shrinks the viewport */
            body.sc-vertical #videowrap,
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer    { height: 60vh !important; }
            body.sc-vertical #chatwrap       { height: calc(37vh - 28px) !important; }
            body.sc-vertical #sc-chat-header { bottom: calc(37vh - 20px) !important; }
            body.sc-vertical #sc-users-panel { bottom: calc(37vh) !important; }
            body.sc-vertical #sc-poll-panel  { bottom: calc(37vh + 42px) !important; }
            body.sc-vertical .video-js .vjs-control-bar { bottom: calc(40vh + 4px) !important; right: 80px !important; }
            body.sc-vertical #sc-desync-btn   { bottom: calc(40vh + 2px) !important; right: 8px !important; }
            body.sc-vertical #sc-emote-proxy  { bottom: calc(40vh + 2px) !important; right: 52px !important; }
            body.sc-vertical #fs-toggle-btn   { bottom: calc(40vh + 2px) !important; right: 96px !important; }
            body.sc-vertical #sc-settings-btn { bottom: calc(40vh + 2px) !important; right: 140px !important; }

            /* ── KEYBOARD OPEN (sc-kb-open) ──────────────────── */
            /* edge-to-edge mode breaks adjustResize — vh never updates,
               so we drive layout with explicit px values from visualViewport */
            body.sc-kb-open.sc-vertical #videowrap,
            body.sc-kb-open.sc-vertical #videowrap .embed-responsive,
            body.sc-kb-open.sc-vertical #ytapiplayer {
                height: var(--sc-vid-h) !important;
            }
            body.sc-kb-open.sc-vertical #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* ── VERTICAL keyboard open ─────────────────────── */
            /* Hide floating buttons while typing */
            body.sc-kb-open.sc-vertical #sc-desync-btn,
            body.sc-kb-open.sc-vertical #sc-emote-proxy,
            body.sc-kb-open.sc-vertical #fs-toggle-btn,
            body.sc-kb-open.sc-vertical #sc-settings-btn,
            body.sc-kb-open #sc-top-bar,
            body.sc-kb-open #sc-chat-header {
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* ── HORIZONTAL keyboard open ───────────────────── */
            body.sc-kb-open.sc-horizontal #videowrap,
            body.sc-kb-open.sc-horizontal #videowrap .embed-responsive,
            body.sc-kb-open.sc-horizontal #ytapiplayer {
                height: var(--sc-vid-h) !important;
            }
            body.sc-kb-open.sc-horizontal #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* Lift floating buttons above the keyboard */
            body.sc-kb-open.sc-horizontal #sc-desync-btn,
            body.sc-kb-open.sc-horizontal #sc-emote-proxy,
            body.sc-kb-open.sc-horizontal #fs-toggle-btn,
            body.sc-kb-open.sc-horizontal #sc-settings-btn {
                bottom: calc(var(--sc-kb-h) + 6px) !important;
            }

            /* ── HORIZONTAL (landscape phone / tablet / TV) ──── */
            /* Control cluster — vertical stack pinned to the mid-left edge.
               Hidden until the mouse moves to the left side (sc-leftzone),
               then revealed and clickable; fades out again afterwards. */
            body.sc-horizontal #sc-chatmode-btn,
            body.sc-horizontal #sc-emote-proxy,
            body.sc-horizontal #sc-desync-btn,
            body.sc-horizontal #sc-settings-btn {
                left: 10px !important; right: auto !important; bottom: auto !important;
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(-14px) !important;
                transition: opacity 0.25s ease, transform 0.25s ease !important;
            }
            /* Slide/fade in when the mouse reaches the left edge (or the grip) */
            body.sc-horizontal.sc-leftzone #sc-chatmode-btn,
            body.sc-horizontal.sc-leftzone #sc-emote-proxy,
            body.sc-horizontal.sc-leftzone #sc-desync-btn,
            body.sc-horizontal.sc-leftzone #sc-settings-btn {
                opacity: 1 !important; pointer-events: auto !important; transform: translateX(0) !important;
            }

            /* Subtle drawer "grip" — the only thing visible until you reach the edge */
            #sc-cluster-grip { display: none !important; }
            body.sc-horizontal #sc-cluster-grip {
                display: block !important;
                position: fixed !important; left: 0 !important; top: 50% !important;
                transform: translateY(-50%) !important;
                width: 5px !important; height: 56px !important;
                border-radius: 0 4px 4px 0 !important;
                background: rgba(255,255,255,0.16) !important;
                z-index: 20049 !important; cursor: pointer !important;
                transition: background 0.2s ease, width 0.15s ease, opacity 0.25s ease !important;
            }
            body.sc-horizontal #sc-cluster-grip:hover { background: rgba(255,255,255,0.5) !important; width: 7px !important; }
            body.sc-tv.sc-horizontal #sc-cluster-grip { height: 72px !important; width: 6px !important; }
            /* Hide the grip once the cluster is open */
            body.sc-leftzone #sc-cluster-grip { opacity: 0 !important; pointer-events: none !important; }
            /* Vertical positions (44px buttons, 56px pitch) */
            body.sc-horizontal #sc-chatmode-btn { top: calc(50% - 112px) !important; }
            body.sc-horizontal #sc-emote-proxy  { top: calc(50% - 56px)  !important; }
            body.sc-horizontal #sc-desync-btn   { top: 50% !important; }
            body.sc-horizontal #sc-settings-btn { top: calc(50% + 56px)  !important; }
            /* TV — bigger buttons, wider pitch */
            body.sc-tv.sc-horizontal #sc-chatmode-btn { top: calc(50% - 128px) !important; }
            body.sc-tv.sc-horizontal #sc-emote-proxy  { top: calc(50% - 64px)  !important; }
            body.sc-tv.sc-horizontal #sc-desync-btn   { top: 50% !important; }
            body.sc-tv.sc-horizontal #sc-settings-btn { top: calc(50% + 64px)  !important; }
            /* Seek bar (raw video only) spans the video, stopping at the chat edge */
            body.sc-horizontal .video-js .vjs-control-bar { left: 4px !important; right: calc(19vw + 12px) !important; }

            /* ── TV: larger text, focus ring on interactive items ─ */
            body.sc-tv #messagebuffer { font-size: 18px !important; }
            body.sc-tv #sc-chat-textarea { font-size: 18px !important; }
            body.sc-tv #sc-desync-btn, body.sc-tv #fs-toggle-btn,
            body.sc-tv #sc-emote-proxy, body.sc-tv #sc-settings-btn {
                width: 52px !important; height: 52px !important; font-size: 22px !important;
            }
            body.sc-tv :focus { outline: 3px solid rgba(255,255,255,0.8) !important; }
            /* D-pad focus highlight (remote navigation) */
            body.sc-tv .sc-tv-focus {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32) !important;
                border-radius: 5px !important;
            }

            /* TV: keep the settings modal inside the overscan-safe area and scrollable */
            body.sc-tv #sc-settings-overlay { padding: 6vh 8vw !important; box-sizing: border-box !important; }
            body.sc-tv #sc-settings-modal {
                max-height: 84vh !important; width: min(620px, 84vw) !important;
                padding: 28px !important;
            }
            body.sc-tv #sc-settings-title { font-size: 22px !important; }
            body.sc-tv .sc-settings-input,
            body.sc-tv .sc-settings-test { font-size: 16px !important; }
            body.sc-tv #sc-settings-save,
            body.sc-tv #sc-settings-cancel,
            body.sc-tv #sc-login-btn { font-size: 16px !important; padding: 12px 22px !important; }

            /* Send button */
            #sc-send-btn {
                flex-shrink: 0 !important; background: rgba(255,255,255,0.12) !important;
                border: none !important; border-radius: 50% !important;
                width: 44px !important; height: 44px !important;
                color: rgba(255,255,255,0.85) !important; font-size: 18px !important;
                cursor: pointer !important; display: flex !important;
                align-items: center !important; justify-content: center !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-mobile-input-row {
                display: flex !important; align-items: flex-end !important;
                gap: 8px !important; width: 100% !important; padding: 4px 0 !important;
            }
            #sc-mobile-input-row #sc-chat-textarea { flex: 1 !important; }

            /* ── NOW-PLAYING HERO CARD ───────────────────────── */
            #sc-np-card {
                position: fixed !important; inset: 0 !important;
                z-index: 21000 !important;
                background: #000 !important;   /* black base when there's no backdrop image */
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.5s ease !important;
                overflow: hidden !important;
                font-family: system-ui, sans-serif !important;
            }
            #sc-np-card.sc-np-visible { opacity: 1 !important; pointer-events: auto !important; }
            #sc-np-backdrop {
                position: absolute !important; inset: 0 !important;
                background-size: cover !important; background-position: center !important;
                transform: scale(1.05) !important;
                filter: saturate(1.1) !important;
            }
            #sc-np-scrim {
                position: absolute !important; inset: 0 !important;
                background:
                    linear-gradient(90deg, rgba(8,3,6,0.97) 0%, rgba(8,3,6,0.82) 40%, rgba(8,3,6,0.45) 100%),
                    linear-gradient(0deg, rgba(8,3,6,0.95) 0%, rgba(8,3,6,0) 45%) !important;
            }
            #sc-np-content {
                position: absolute !important;
                left: 6% !important; bottom: 12% !important; right: 6% !important;
                display: flex !important; gap: 32px !important; align-items: flex-end !important;
            }
            #sc-np-poster {
                width: 200px !important; border-radius: 10px !important;
                box-shadow: 0 16px 48px rgba(0,0,0,0.8) !important;
                flex-shrink: 0 !important;
            }
            #sc-np-info { color: #fff !important; max-width: 60% !important; }
            #sc-np-eyebrow {
                font-size: 13px !important; font-weight: 700 !important;
                letter-spacing: 0.18em !important; text-transform: uppercase !important;
                color: var(--np-accent, #ff5b73) !important; margin-bottom: 10px !important;
            }
            #sc-np-title {
                font-size: 44px !important; font-weight: 800 !important; line-height: 1.05 !important;
                text-shadow: 0 2px 16px rgba(0,0,0,0.8) !important; margin-bottom: 14px !important;
            }
            #sc-np-meta {
                font-size: 17px !important; color: rgba(255,255,255,0.82) !important;
                margin-bottom: 16px !important; font-weight: 500 !important;
            }
            #sc-np-overview {
                font-size: 16px !important; line-height: 1.5 !important;
                color: rgba(255,255,255,0.72) !important; margin-bottom: 16px !important;
                display: -webkit-box !important; -webkit-line-clamp: 3 !important;
                -webkit-box-orient: vertical !important; overflow: hidden !important;
            }
            #sc-np-chips { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
            .sc-np-chip {
                font-size: 13px !important; color: rgba(255,255,255,0.9) !important;
                background: rgba(255,255,255,0.12) !important;
                border: 1px solid rgba(255,255,255,0.18) !important;
                border-radius: 999px !important; padding: 5px 12px !important;
                backdrop-filter: blur(4px) !important;
            }
            /* Parent-guide severity colors */
            .sc-np-chip.sc-sev-none     { background: rgba(120,120,130,0.30) !important; border-color: rgba(160,160,170,0.4) !important; }
            .sc-np-chip.sc-sev-mild     { background: rgba(60,160,80,0.32)  !important; border-color: rgba(90,200,110,0.5) !important; color: #c9ffd4 !important; }
            .sc-np-chip.sc-sev-moderate { background: rgba(200,150,40,0.34)  !important; border-color: rgba(230,180,60,0.55) !important; color: #ffe9b8 !important; }
            .sc-np-chip.sc-sev-severe   { background: rgba(200,60,50,0.38)   !important; border-color: rgba(235,90,80,0.6) !important; color: #ffd2cc !important; }
            :root { --np-accent: #ff5b73; }

            /* TV: scale the card up for the couch */
            body.sc-tv #sc-np-poster { width: 260px !important; }
            body.sc-tv #sc-np-title { font-size: 60px !important; }
            body.sc-tv #sc-np-meta { font-size: 22px !important; }
            body.sc-tv #sc-np-overview { font-size: 20px !important; }
            body.sc-tv .sc-np-chip { font-size: 16px !important; padding: 7px 16px !important; }

            /* ── TRIVIA LINK (subtle, top-right next to Coming Attractions) + CARD ── */
            #sc-trivia-btn {
                position: fixed !important; top: 0 !important;
                right: calc(20vw + 150px) !important; left: auto !important;
                z-index: 10003 !important;
                background: transparent !important; border: none !important;
                color: rgba(255,255,255,0.55) !important;
                font-size: 10px !important; letter-spacing: 0.06em !important;
                text-transform: uppercase !important; white-space: nowrap !important;
                line-height: 1 !important; height: 20px !important; padding: 2px 8px !important;
                display: flex !important; align-items: center !important; cursor: pointer !important;
                opacity: 1 !important; transition: opacity 1.5s ease, color 0.2s ease !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-trivia-btn:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-trivia-btn.sc-bar-dim { opacity: 0 !important; pointer-events: none !important; }
            body.sc-vertical #sc-trivia-btn { right: 92px !important; }
            body.sc-tv #sc-trivia-btn { font-size: 12px !important; }

            #sc-trivia-card {
                position: fixed !important; inset: 0 !important; z-index: 21800 !important;
                background: rgba(0,0,0,0.62) !important; backdrop-filter: blur(3px) !important;
                display: none !important; align-items: center !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
            }
            #sc-trivia-card.sc-show { display: flex !important; }
            #sc-trivia-panel {
                width: min(820px, 86vw) !important; max-height: 82vh !important;
                background: rgba(14,10,18,0.97) !important;
                border: 1px solid rgba(255,255,255,0.14) !important;
                border-radius: 14px !important; overflow: hidden !important;
                display: flex !important; flex-direction: column !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
            }
            #sc-trivia-head {
                display: flex !important; align-items: center !important; justify-content: space-between !important;
                padding: 16px 20px !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                flex-shrink: 0 !important;
            }
            #sc-trivia-title { font-size: 18px !important; font-weight: 800 !important; color: var(--np-accent,#ff5b73) !important; }
            #sc-trivia-close {
                background: rgba(255,255,255,0.1) !important; border: none !important; color: #fff !important;
                width: 32px !important; height: 32px !important; border-radius: 50% !important;
                cursor: pointer !important; font-size: 14px !important; flex-shrink: 0 !important;
            }
            #sc-trivia-close:hover { background: rgba(255,255,255,0.2) !important; }
            #sc-trivia-list {
                overflow-y: auto !important; padding: 4px 20px 20px !important;
                -webkit-overflow-scrolling: touch !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.28) transparent !important;
            }
            #sc-trivia-list::-webkit-scrollbar { width: 10px !important; }
            #sc-trivia-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05) !important; border-radius: 10px !important; margin: 6px 0 !important; }
            #sc-trivia-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28) !important; border-radius: 10px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
            #sc-trivia-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45) !important; background-clip: padding-box !important; }
            body.sc-tv #sc-trivia-list::-webkit-scrollbar { width: 14px !important; }
            .sc-trivia-item {
                color: rgba(255,255,255,0.86) !important; font-size: 14px !important; line-height: 1.5 !important;
                padding: 12px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            }
            body.sc-tv #sc-trivia-panel { width: min(1100px, 84vw) !important; max-height: 84vh !important; }
            body.sc-tv #sc-trivia-title { font-size: 26px !important; }
            body.sc-tv #sc-trivia-close { width: 44px !important; height: 44px !important; font-size: 20px !important; }
            body.sc-tv .sc-trivia-item { font-size: 20px !important; padding: 16px 0 !important; }

            /* Vertical phones (if enabled there): stack poster above text */
            body.sc-vertical #sc-np-content { flex-direction: column !important; align-items: flex-start !important; gap: 18px !important; bottom: 8% !important; }
            body.sc-vertical #sc-np-poster { width: 130px !important; }
            body.sc-vertical #sc-np-title { font-size: 30px !important; }
            body.sc-vertical #sc-np-info { max-width: 90% !important; }

            /* ── AMBIENT GLOW ────────────────────────────────── */
            #sc-ambient {
                position: fixed !important; inset: 0 !important;
                z-index: 10000 !important; pointer-events: none !important;
                box-shadow: inset 0 0 160px 36px var(--sc-ambient-color, rgba(0,0,0,0)) !important;
                transition: box-shadow 1.6s ease !important;
            }
            body.sc-ambient-off #sc-ambient { display: none !important; }

            /* ── AUTO-HIDING CHROME (TV) ─────────────────────── */
            body.sc-tv .video-js .vjs-control-bar { transition: opacity 0.6s ease !important; }
            /* The control cluster is governed by the left-edge reveal, not this.
               Here we just fade the seek bar + hide the cursor when idle. */
            body.sc-tv.sc-chrome-hidden .video-js .vjs-control-bar {
                opacity: 0 !important; pointer-events: none !important;
            }
            body.sc-tv.sc-chrome-hidden { cursor: none !important; }

            /* ── CHAT LAYOUT MODES ───────────────────────────── */
            /* Hidden: full-bleed cinema — drop chat AND the title / coming-attractions chrome */
            body.sc-chat-hidden #chatwrap, body.sc-chat-hidden #sc-chat-header,
            body.sc-chat-hidden #sc-users-panel, body.sc-chat-hidden #sc-poll-panel,
            body.sc-chat-hidden #sc-top-bar, body.sc-chat-hidden #videowrap-header,
            body.sc-chat-hidden #sc-poster-toggle, body.sc-chat-hidden #sc-poster-strip,
            body.sc-chat-hidden #sc-movie-links { display: none !important; }
            body.sc-chat-hidden.sc-horizontal #videowrap,
            body.sc-chat-hidden.sc-horizontal #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-horizontal #ytapiplayer { width: 100vw !important; }
            body.sc-chat-hidden.sc-horizontal .video-js .vjs-control-bar { right: 16px !important; }
            body.sc-chat-hidden.sc-vertical #videowrap,
            body.sc-chat-hidden.sc-vertical #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-vertical #ytapiplayer { height: 100vh !important; }

            /* Overlay: video full width, chat floats translucent over the right */
            /* ── OVERLAY: minimal chat in the top-right corner over full video ── */
            body.sc-chat-overlay.sc-horizontal #videowrap,
            body.sc-chat-overlay.sc-horizontal #videowrap .embed-responsive,
            body.sc-chat-overlay.sc-horizontal #ytapiplayer { width: 100vw !important; }

            /* Hide every bit of chrome — title bar, coming attractions, user/poll header */
            body.sc-chat-overlay.sc-horizontal #sc-top-bar,
            body.sc-chat-overlay.sc-horizontal #videowrap-header,
            body.sc-chat-overlay.sc-horizontal #sc-movie-links,
            body.sc-chat-overlay.sc-horizontal #sc-movie-stats,
            body.sc-chat-overlay.sc-horizontal #sc-poster-toggle,
            body.sc-chat-overlay.sc-horizontal #sc-poster-strip,
            body.sc-chat-overlay.sc-horizontal #sc-chat-header { display: none !important; }

            /* Chat = small top-right corner panel, dark transparent, no borders */
            body.sc-chat-overlay.sc-horizontal #chatwrap {
                top: 0 !important; right: 0 !important; left: auto !important;
                width: 30vw !important; height: 46vh !important;
                background: rgba(8,6,12,0.42) !important;
                border: none !important; border-radius: 0 0 0 10px !important;
                padding: 10px !important; box-sizing: border-box !important;
                z-index: 10002 !important;
            }
            body.sc-chat-overlay.sc-horizontal #messagebuffer {
                text-shadow: 0 1px 4px rgba(0,0,0,0.9) !important;
            }
            /* Kill any stray borders/outlines/shadows around the chat in overlay */
            body.sc-chat-overlay.sc-horizontal #chatwrap,
            body.sc-chat-overlay.sc-horizontal #chatwrap *,
            body.sc-chat-overlay.sc-horizontal #messagebuffer,
            body.sc-chat-overlay.sc-horizontal #sc-mobile-input-row,
            body.sc-chat-overlay.sc-horizontal #chatwrap .input-group,
            body.sc-chat-overlay.sc-horizontal #chatwrap .form-control {
                border: none !important; box-shadow: none !important; outline: none !important;
            }
            /* Shrink posted images / emotes to a quarter size in the corner chat */
            body.sc-chat-overlay.sc-horizontal #messagebuffer img {
                zoom: 0.25 !important;
                max-width: 100% !important; height: auto !important;
            }
            /* One-line, borderless, no-placeholder input on the same transparent bg */
            body.sc-chat-overlay.sc-horizontal #sc-mobile-input-row { padding: 2px 0 0 !important; }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea {
                min-height: 0 !important; height: 26px !important; max-height: 26px !important;
                background: rgba(0,0,0,0.5) !important; border: none !important; box-shadow: none !important;
                border-radius: 6px !important;
                padding: 3px 8px !important; font-size: 13px !important; line-height: 1.4 !important;
                overflow-y: auto !important; resize: none !important;
            }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea:focus {
                background: rgba(0,0,0,0.68) !important; border: none !important;
            }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea::placeholder { color: transparent !important; }
            body.sc-chat-overlay.sc-horizontal #sc-newmsg-pill {
                right: 2vw !important; top: calc(46vh - 38px) !important; bottom: auto !important;
            }

            /* Sidebar: header matches the chat panel exactly (same box, same padding) */
            body.sc-horizontal #sc-chat-header {
                right: 0 !important; width: 19vw !important;
                box-sizing: border-box !important; padding: 0 8px !important;
            }

            /* Control cluster — chat-mode icon on top, then emote / free-watch / settings
               in a row beneath it, pinned to the mid-left edge over the video.
               Clear of YouTube's own controls and the chat, so everything clicks. */
            #sc-chatmode-btn {
                position: fixed !important;
                left: 10px !important; top: calc(50% - 60px) !important;
                z-index: 20050 !important;
                width: 44px !important; height: 44px !important; border-radius: 50% !important;
                background: rgba(0,0,0,0.6) !important;
                border: 1px solid rgba(255,255,255,0.25) !important;
                color: rgba(255,255,255,0.9) !important; cursor: pointer !important;
                font-size: 18px !important; line-height: 1 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                transition: opacity 0.6s ease, background 0.2s ease !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-chatmode-btn:hover { background: rgba(0,0,0,0.85) !important; }
            body.sc-tv #sc-chatmode-btn { width: 52px !important; height: 52px !important; font-size: 22px !important; top: calc(50% - 70px) !important; }

            /* ── NEW-MESSAGES PILL ───────────────────────────── */
            #sc-newmsg-pill {
                position: fixed !important; z-index: 19500 !important;
                background: var(--np-accent, #ff5b73) !important; color: #160409 !important;
                font-size: 13px !important; font-weight: 800 !important;
                padding: 7px 16px !important; border-radius: 999px !important;
                cursor: pointer !important; box-shadow: 0 6px 20px rgba(0,0,0,0.55) !important;
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.25s ease !important;
            }
            #sc-newmsg-pill.sc-show { opacity: 1 !important; pointer-events: auto !important; }
            body.sc-horizontal #sc-newmsg-pill { right: calc(19vw + 16px) !important; bottom: 56px !important; }
            body.sc-vertical   #sc-newmsg-pill { left: 50% !important; transform: translateX(-50%) !important; bottom: calc(40vh + 56px) !important; }
            body.sc-tv #sc-newmsg-pill { font-size: 17px !important; padding: 10px 22px !important; }

            /* ── MENTION TOAST ───────────────────────────────── */
            #sc-mention-toast {
                position: fixed !important; top: 26px !important; left: 50% !important;
                transform: translateX(-50%) translateY(-20px) !important;
                z-index: 21500 !important;
                background: rgba(20,8,14,0.97) !important; color: #fff !important;
                border: 1px solid var(--np-accent, #ff5b73) !important;
                border-radius: 12px !important; padding: 12px 18px !important;
                max-width: 72vw !important; box-shadow: 0 10px 36px rgba(0,0,0,0.65) !important;
                opacity: 0 !important; pointer-events: none !important; cursor: pointer !important;
                transition: opacity 0.35s ease, transform 0.35s ease !important;
                font-size: 14px !important; line-height: 1.4 !important;
            }
            #sc-mention-toast.sc-show { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; pointer-events: auto !important; }
            #sc-mention-toast .sc-mt-name { color: var(--np-accent, #ff5b73) !important; font-weight: 800 !important; margin-right: 6px !important; }
            body.sc-tv #sc-mention-toast { font-size: 21px !important; padding: 16px 26px !important; top: 40px !important; }
        `;
        document.head.appendChild(s);
    })();

    // Mark TV so CSS can scale up
    if (_isTv) document.body.classList.add('sc-tv');

    // Suppress the on-screen keyboard (inputmode="none") per the setting.
    // Re-applies as chat/emote inputs are (re)created.
    (function() {
        applySoftKeyboard();
        const obs = new MutationObserver(applySoftKeyboard);
        if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    })();

    // TV: reload button + pause video when app goes to background
    if (_isTv) {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            document.querySelectorAll('video').forEach(v => { try { if (!v.paused) { v.pause(); v.src = ''; } } catch {} });
            if (!document.getElementById('sc-reload-btn')) {
                const btn = document.createElement('button');
                btn.id = 'sc-reload-btn';
                btn.textContent = '↻'; btn.title = 'Reload Video';
                btn.style.cssText = 'position:fixed;bottom:5px;right:calc(20vw+200px);z-index:20002;background:rgba(0,0,0,0.7);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:4px 10px;font-size:20px;cursor:pointer;';
                btn.addEventListener('click', () => location.reload());
                document.body.appendChild(btn);
            }
        });
    }

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
        if (!window.visualViewport || _isTv) return;

        let maxVVH = window.visualViewport.height;
        let kbTimer = null;
        const INPUT_H = 56; // chat input bar height

        const onOpen = (vv) => {
            const kbH  = maxVVH - vv.height;
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
            maxVVH = Math.max(maxVVH, vv.height);
            clearTimeout(kbTimer);
            if (maxVVH - vv.height > 120) {
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
        if (!_isTv) return;
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
        timer = setTimeout(hide, 4000);
    }

    // ── Chat layout modes: sidebar → overlay → hidden
    const _CHAT_MODES = ['sidebar', 'overlay', 'hidden'];
    const _CHAT_MODE_ICONS = { sidebar: '◨', overlay: '⧉', hidden: '▢' };
    function applyChatMode(mode) {
        _CHAT_MODES.forEach(m => document.body.classList.toggle('sc-chat-' + m, m === mode));
        try { localStorage.setItem('sc_chat_mode', mode); } catch (e) {}
        const btn = document.getElementById('sc-chatmode-btn');
        if (btn) { btn.textContent = _CHAT_MODE_ICONS[mode] || '▦'; btn.title = 'Chat: ' + mode + ' (press C)'; }
        applyChatFontSize(getChatFontSize()); // input size depends on the mode (overlay = compact)
    }
    function cycleChatMode() {
        let cur = 'sidebar';
        try { cur = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}
        applyChatMode(_CHAT_MODES[(_CHAT_MODES.indexOf(cur) + 1) % _CHAT_MODES.length]);
    }
    function initChatModes() {
        let saved = 'sidebar';
        try { saved = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}

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
                const text = node.textContent.replace(/^\s*[^:]+:\s*/, '').trim().slice(0, 180);
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
        const reveal = () => { clearTimeout(hideTimer); document.body.classList.add('sc-leftzone'); };
        const scheduleHide = (ms) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => document.body.classList.remove('sc-leftzone'), ms); };

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
            if (x <= THRESH) { reveal(); scheduleHide(3500); }
        }, { passive: true });
    }

    function initCinematicChat() {
        [initAmbientGlow, initChromeAutohide, initChatModes, initNewMessagePill, initMentionToast, initChatFont, initLeftZone]
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
        if (!_isTv) return;
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

        const MAIN_IDS = ['sc-chatmode-btn', 'sc-emote-proxy', 'sc-desync-btn', 'sc-settings-btn',
            'sc-usercount-btn', 'sc-poll-btn', 'sc-poster-toggle', 'sc-trivia-btn', 'sc-chat-textarea'];
        const FOCUS_SEL = 'button, a[href], input:not([type=hidden]), textarea, select, [tabindex]';

        const makeFocusable = (el) => {
            if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.tabIndex = -1;
        };

        function candidates() {
            const ov = openOverlay();
            if (ov) {
                let list = [...ov.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter(e => !e.disabled);
                if (!list.length) list = [ov]; // a click-to-dismiss overlay (e.g. the now-playing card)
                return { scope: ov, list };
            }
            return { scope: document, list: MAIN_IDS.map(id => document.getElementById(id)).filter(el => el && isVisible(el)) };
        }

        function setFocus(el) {
            if (!el) return;
            makeFocusable(el);
            if (focusEl && focusEl !== el) focusEl.classList.remove('sc-tv-focus');
            focusEl = el;
            el.classList.add('sc-tv-focus');
            try { el.focus({ preventScroll: true }); } catch (e) {}
            try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
        }

        function move(dir) {
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
            const { scope, list } = candidates();
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
            if (focusEl.tagName === 'TEXTAREA' || focusEl.tagName === 'INPUT') {
                if (focusEl.type === 'checkbox' || focusEl.type === 'range') focusEl.click();
                else { try { focusEl.focus(); } catch (e) {} } // let the on-screen keyboard open (if not suppressed)
                return;
            }
            focusEl.click();
        }

        function closeTop() {
            const settings = document.getElementById('sc-settings-overlay');
            if (settings && isVisible(settings)) {
                const c = document.getElementById('sc-settings-cancel');
                if (c) c.click(); else settings.remove();
                focusEl = null; return true;
            }
            const modal = document.getElementById('sc-modal-overlay');
            if (modal && isVisible(modal)) { (document.getElementById('sc-btn-cancel') || { click() { modal.remove(); } }).click(); focusEl = null; return true; }
            const trivia = document.getElementById('sc-trivia-card');
            if (trivia && trivia.classList.contains('sc-show')) { hideTriviaCard(); focusEl = null; return true; }
            const np = document.getElementById('sc-np-card');
            if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); focusEl = null; return true; }
            for (const id of ['sc-users-panel', 'sc-poll-panel']) {
                const p = document.getElementById(id);
                if (p && isVisible(p)) { p.style.display = 'none'; focusEl = null; return true; }
            }
            const poster = document.getElementById('sc-poster-strip');
            if (poster && poster.classList.contains('sc-poster-visible')) {
                const t = document.getElementById('sc-poster-toggle'); if (t) t.click(); else poster.classList.remove('sc-poster-visible');
                focusEl = null; return true;
            }
            return false;
        }

        function revealChrome() {
            document.body.classList.add('sc-leftzone');
            document.body.classList.remove('sc-chrome-hidden');
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

        const reveal = () => {
            if (done) return;
            done = true;
            clearInterval(iv);
            _introDone = true;

            const data = _npData || (lastMovieTitle && lastMovieTitle.length > 1
                ? { cleanTitle: lastMovieTitle, backdrop: null } : null);

            if (_isTv && data) {
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

            if (!_isTv) return reveal();                       // phones: reveal as soon as it's playing

            // TV: preload the backdrop so the card is fully painted before we reveal it
            if (_npData && _npData.backdrop && !preloadStarted) {
                preloadStarted = true;
                const img = new Image();
                img.onload = img.onerror = reveal;
                img.src = _npData.backdrop;
            }
            if (Date.now() - playingSince >= 3500) reveal();   // don't wait too long for the art
        }, 300);
    }

    if (document.readyState === 'complete') initIntroSequence();
    else window.addEventListener('load', initIntroSequence);

})();