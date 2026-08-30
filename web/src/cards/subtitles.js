import { getKey, LS_SUBTITLE_OPACITY, LS_SUBTITLE_FONTSIZE, LS_SUBTITLE_LINES } from '../store.js';
import { usernameToColor } from '../usercolors.js';
import { getExternalUserEmoji } from '../useremoji.js';

/* ==========================================================
   CHAT-AS-SUBTITLES OVERLAY
   Renders the most recent chat messages as movie-subtitle-style pills over
   the video, reusing this app's own chat name colors (usercolors.js) and
   per-user emoji (useremoji.js) so a line here looks like the same person
   from the real chat log, icon and all.

   This is a chatMode value ('subtitles'), not an independent on/off toggle --
   it sits in the same sidebar/overlay/hidden/chat-only cycle (chat/modes.js),
   reached with the header button or 'C', same as every other layout. This
   module owns only the pill content/rendering; body.sc-chat-subtitles (set by
   applyChatMode) drives visibility purely in CSS (styles/tv.css), the same
   pattern every other chat mode already uses.

   Ported (as a concept -- the reference is a from-scratch Kotlin/Compose
   app, nothing here is literal code) from the subtitle-chat overlay in
   kburna243/mikes-420grindhouse-app:
   https://github.com/kburna243/mikes-420grindhouse-app
   (android/app/src/main/java/com/example/ui/chat/SubtitleChatOverlay.kt)

   Unlike that reference, messages aren't pushed into a separately-tracked
   queue -- #messagebuffer (CyTube's own message list) is already the
   source of truth, so a render just re-derives "the last N chat-msg-
   elements" from it fresh every time, the same idea as the reference's own
   `messages.takeLast(maxLines)`.
========================================================== */

const DEFAULT_OPACITY   = 0.6;
const DEFAULT_FONTSIZE  = 15;
const DEFAULT_LINES     = 3;

export function clampLines(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(3, Math.max(1, v)) : DEFAULT_LINES;
}
function clampOpacity(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(0.9, Math.max(0.2, v)) : DEFAULT_OPACITY;
}
function clampFontSize(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(24, Math.max(12, v)) : DEFAULT_FONTSIZE;
}

export function getSubtitleOpacity()  { return clampOpacity(getKey(LS_SUBTITLE_OPACITY) || DEFAULT_OPACITY); }
export function getSubtitleFontSize() { return clampFontSize(getKey(LS_SUBTITLE_FONTSIZE) || DEFAULT_FONTSIZE); }
export function getSubtitleLines()    { return clampLines(getKey(LS_SUBTITLE_LINES) || DEFAULT_LINES); }

export function applySubtitleOpacity(v) {
    document.body.style.setProperty('--sc-subtitle-opacity', String(clampOpacity(v)));
}
export function applySubtitleFontSize(px) {
    document.body.style.setProperty('--sc-subtitle-fontsize', clampFontSize(px) + 'px');
}

function _escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Turns a rendered CyTube message element into subtitle-safe data. Returns null for
// system/announcement messages (no chat-msg-<user> class -- same selector applyUserColors
// uses in settings.js) or a message that ends up with nothing to show once stripped.
export function extractSubtitleLine(msgEl) {
    const cls = [...msgEl.classList].find(c => c.startsWith('chat-msg-'));
    if (!cls) return null;
    const username = cls.replace('chat-msg-', '');

    const clone = msgEl.cloneNode(true);
    // .timestamp/.username: the message's own metadata, redrawn separately below.
    // .sc-img-embed: the (possibly large) auto-embedded image thumbnail imageembed.js
    // appends next to the link -- too big for a subtitle pill; small inline channel
    // emotes (not wrapped in .sc-img-embed) are left alone, matching the reference's
    // own inline-emote-in-a-subtitle-line look.
    clone.querySelectorAll('.timestamp, .username, .sc-img-embed').forEach(el => el.remove());
    const html = clone.innerHTML.trim();
    if (!html) return null;

    return { username, color: usernameToColor(username), emoji: getExternalUserEmoji(username), html };
}

function renderSubtitleLine(line) {
    const emojiHtml = line.emoji ? `<span class="sc-subtitle-emoji">${_escHtml(line.emoji)}</span>` : '';
    return `<div class="sc-subtitle-pill">${emojiHtml}` +
        `<span class="sc-subtitle-name" style="color:${line.color}">${_escHtml(line.username)}:</span> ` +
        `<span class="sc-subtitle-text">${line.html}</span></div>`;
}

function ensureContainer() {
    let el = document.getElementById('sc-subtitles-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sc-subtitles-overlay';
        document.body.appendChild(el);
    }
    return el;
}

export function inSubtitlesMode() {
    try { return localStorage.getItem('sc_chat_mode') === 'subtitles'; } catch (e) { return false; }
}

// Re-derives the last N visible lines straight from #messagebuffer (CyTube's own message
// list is the source of truth -- no separate queue to keep in sync with it) and re-renders.
// Cheap no-op while chatMode isn't 'subtitles' (visibility itself is CSS-driven off
// body.sc-chat-subtitles, chat/modes.js), so it's safe to call from a MutationObserver on
// every single chat message regardless of the current layout.
export function refreshSubtitles() {
    if (!inSubtitlesMode()) return;
    const container = ensureContainer();
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;

    const maxLines = getSubtitleLines();
    const all = [...buf.querySelectorAll('[class*="chat-msg-"]')];
    const lines = all.slice(-maxLines).map(extractSubtitleLine).filter(Boolean);
    container.innerHTML = lines.map(renderSubtitleLine).join('');
}

// Boot: creates the (initially empty) pill container and applies whatever appearance
// settings were last persisted. Safe to call more than once (self-guards like every other
// one-shot init in this app, e.g. startImageEmbedObserver's _imageEmbedObserverStarted).
export function initSubtitles() {
    ensureContainer();
    applySubtitleOpacity(getSubtitleOpacity());
    applySubtitleFontSize(getSubtitleFontSize());
    refreshSubtitles();
}

let _subtitlesObserverStarted = false;
export function startSubtitlesObserver() {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;
    if (_subtitlesObserverStarted) { refreshSubtitles(); return; }
    _subtitlesObserverStarted = true;
    new MutationObserver(refreshSubtitles).observe(buf, { childList: true, subtree: true });
    refreshSubtitles();
}
