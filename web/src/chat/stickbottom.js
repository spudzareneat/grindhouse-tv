/* ==========================================================
   CHAT "STICK TO BOTTOM"
   Single source of truth for keeping the message list (#messagebuffer)
   pinned to its newest line.

   Why this needs to exist: #messagebuffer is a flex child that gives up
   vertical space to the compose box below it. Staying visually "at the
   bottom" relies entirely on JS doing scrollTop = scrollHeight at the right
   moment. The naive "do it synchronously on DOM mutation" approach reads
   scrollHeight *before* layout settles — the just-added message is still
   wrapping, the 'Inter' webfont is still loading, emotes / image embeds load
   later, and CyTube trims the buffer in the same mutation batch — so the pin
   lands a few-to-many px short and the newest line ends up hidden behind the
   compose box. Once that clip pushes the view past the "near bottom"
   threshold, auto-scroll gives up entirely.

   This module: one debounced `stuck` flag driven by the user's own
   scrolling, plus one `pinChatToBottom()` that re-applies across a few
   frames (rAF + a short settle timer) so it lands after layout. It's fed by
   a MutationObserver (new/removed messages), a ResizeObserver (compose-box
   grow, IME, font-size, mode switch, rotation) and a delegated image `load`
   listener (late emotes/embeds growing content height). The "↓ Latest" pill
   is the one-tap way back to the bottom after scrolling up to read backlog.
========================================================== */

const NEAR_BOTTOM_PX = 80;
const SETTLE_MS = 260;

let buf = null;
let pill = null;
let stuck = true;              // is the list currently following the bottom?
let pinGen = 0;                // bumped to invalidate in-flight deferred pins
let settleTimer = null;
let selfScrollUntil = 0;       // ignore the scroll events our own pin causes

function distanceFromBottom() {
    return buf.scrollHeight - buf.scrollTop - buf.clientHeight;
}
function atBottom() {
    return distanceFromBottom() <= NEAR_BOTTOM_PX;
}
function showPill(show) {
    if (pill) pill.classList.toggle('sc-show', !!show);
}
function applyScroll() {
    if (!buf) return;
    buf.scrollTop = buf.scrollHeight;
    selfScrollUntil = performance.now() + 100;
}
function cancelPendingPins() {
    pinGen++;
    clearTimeout(settleTimer);
}

/**
 * Scroll the message list to the bottom, and keep it there across the next
 * few frames while layout settles.
 * @param {{force?: boolean}} [opts] force = "we want the bottom now regardless"
 *        (chat-mode switch, message sent) — re-arms `stuck` and ignores the flag.
 */
export function pinChatToBottom(opts) {
    if (!buf) buf = document.getElementById('messagebuffer');
    if (!buf) return;
    if (opts && opts.force) stuck = true;
    if (!stuck) return;

    const gen = ++pinGen;
    const tick = () => { if (gen === pinGen && stuck) applyScroll(); };

    applyScroll();
    showPill(false);
    requestAnimationFrame(tick);
    requestAnimationFrame(() => requestAnimationFrame(tick));
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        if (gen === pinGen && stuck) { applyScroll(); showPill(false); }
    }, SETTLE_MS);
}

export function isStuck() { return stuck; }

/** Re-arm auto-follow (e.g. user tapped the pill, or just sent a message). */
export function markStuck() { stuck = true; showPill(false); }

export function initStickBottom() {
    buf = document.getElementById('messagebuffer');
    if (!buf) return;

    // This module owns the "return to bottom" pill outright.
    pill = document.getElementById('sc-newmsg-pill');
    if (!pill) {
        pill = document.createElement('div');
        pill.id = 'sc-newmsg-pill';
        document.body.appendChild(pill);
    }
    pill.textContent = '↓ Latest';
    pill.addEventListener('click', () => { markStuck(); pinChatToBottom({ force: true }); });

    // The user's own scrolling is what decides stuck vs. free. Ignore the
    // scroll events we cause ourselves during a pin.
    buf.addEventListener('scroll', () => {
        if (performance.now() < selfScrollUntil) return;
        stuck = atBottom();
        showPill(!stuck);
    }, { passive: true });

    // Any gesture that's about to scroll cancels in-flight deferred pins so we
    // don't yank the user mid-settle; the scroll handler then takes over.
    ['wheel', 'touchstart', 'pointerdown'].forEach(ev =>
        buf.addEventListener(ev, cancelPendingPins, { passive: true }));

    // New / removed messages.
    new MutationObserver(() => {
        if (stuck) pinChatToBottom();
        else showPill(!atBottom());
    }).observe(buf, { childList: true });

    // The list's own box resizing: compose-box auto-grow, IME show/hide,
    // font-size change, chat-mode switch, orientation flip. The catch-all that
    // lets the old scattered setTimeout re-scroll hacks go.
    if (window.ResizeObserver) {
        new ResizeObserver(() => { if (stuck) pinChatToBottom(); }).observe(buf);
    }

    // Late-loading emotes / embedded images grow content height after we've
    // already pinned — a ResizeObserver on the container can't see that.
    buf.addEventListener('load', () => { if (stuck) pinChatToBottom(); }, true);

    pinChatToBottom({ force: true });
}
