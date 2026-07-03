import { getChatUsernames } from './usernames.js';
import { syncNativeInputFocus } from './inputfocus.js';
import { emoteState } from './emotemirror.js';
import { spellCheckEnabled } from '../store.js';
import { detectReadabilityIssues } from '../readability.js';

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

export async function attemptSend(textarea, originalInput) {
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
        originalInput.value = msg; emoteState.lastChatlineValue = msg;
        originalInput.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
        }));
        try {
            if (typeof $ !== 'undefined')
                $(originalInput).trigger($.Event('keydown', { which: 13, keyCode: 13, key: 'Enter' }));
        } catch (e) {}
    }

    textarea.value = ''; textarea.style.height = '';
    emoteState.lastChatlineValue = ''; originalInput.value = '';
    // Return focus to the chat input so user can keep typing immediately
    textarea.focus();
}
