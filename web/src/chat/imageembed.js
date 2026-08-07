/* ==========================================================
   CHAT IMAGE EMBEDS
   Direct image links posted in chat (postimg.cc, imgur, discord
   cdn, etc.) get a thumbnail preview appended under the message,
   reusing the <a> tags CyTube already auto-linkifies out of the
   raw message text. Sized to match the channel's own emote
   height so it doesn't dominate the narrow chat column. Tapping
   the 🔗 icon in the badge swaps the thumbnail back for the
   plain link (and back again).
========================================================== */
import { autoEmbedEnabled } from '../store.js';

export const IMAGE_LINK_RE = /\.(jpe?g|png|gif|webp|bmp)(\?[^\s"']*)?$/i;

// Individual emotes aren't all the same native size, so grabbing just the *first*
// match in the buffer meant embed size depended on whichever emote happened to be
// first at that moment -- producing inconsistently small thumbnails. Take the max
// of everything currently rendered and remember the best value seen so it stays
// stable over time (e.g. once the buffer scrolls past every large emote).
let _cachedEmoteHeight = 0;
function emoteInlineHeight() {
    const els = document.querySelectorAll('#messagebuffer .channel-emote, #messagebuffer .emote');
    let maxH = 0;
    els.forEach(el => {
        const h = el.getBoundingClientRect().height;
        if (h > maxH) maxH = h;
    });
    if (maxH > 4) _cachedEmoteHeight = Math.round(maxH);
    return _cachedEmoteHeight > 4 ? _cachedEmoteHeight : 48; // fallback until a real emote has rendered
}

export function findImageLinks(msgEl) {
    return [...msgEl.querySelectorAll('a[href]')]
        .filter(a => !a.dataset.scEmbedded && !a.closest('.sc-img-embed')
            && (a.protocol === 'http:' || a.protocol === 'https:') && IMAGE_LINK_RE.test(a.href));
}

// CyTube auto-scrolls the message buffer synchronously when a message is appended,
// and separately hooks `load` on any <img> present at that time. Our thumbnail is
// appended asynchronously (via MutationObserver), so it misses both mechanisms --
// rescroll manually, but only if the user hadn't scrolled up to read backlog.
function rescrollChatIfNearBottom() {
    const b = document.getElementById('messagebuffer');
    if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 60) b.scrollTop = b.scrollHeight;
}

function embedImagesIn(msgEl) {
    findImageLinks(msgEl).forEach(a => {
        a.dataset.scEmbedded = '1';
        a.style.display = 'none';
        const wrap = document.createElement('div');
        wrap.className = 'sc-img-embed';
        const link = document.createElement('a');
        link.href = a.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.loading = 'lazy';
        // !important priority: CyTube's own stylesheet caps chat <img> height (e.g.
        // for emotes) with a rule that otherwise wins over a plain inline style, which
        // is what was making embeds render tiny at random.
        img.style.setProperty('max-height', Math.round(emoteInlineHeight() * 1.25) + 'px', 'important');
        img.onerror = () => { wrap.remove(); a.style.display = ''; };
        img.onload = rescrollChatIfNearBottom;
        img.src = a.href;
        link.appendChild(img);
        const badge = document.createElement('span');
        badge.className = 'sc-img-embed-badge';
        const badgeLabel = document.createElement('span');
        badgeLabel.textContent = '🖼 embedded';
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'sc-img-embed-toggle';
        toggleBtn.textContent = '🔗';
        toggleBtn.title = 'Show link instead of image';
        toggleBtn.addEventListener('click', () => {
            const showingImage = link.style.display !== 'none';
            link.style.display = showingImage ? 'none' : '';
            a.style.display = showingImage ? '' : 'none';
            badgeLabel.textContent = showingImage ? '🔗 link only' : '🖼 embedded';
            toggleBtn.title = showingImage ? 'Show image instead of link' : 'Show link instead of image';
        });
        badge.appendChild(badgeLabel);
        badge.appendChild(toggleBtn);
        wrap.appendChild(link);
        wrap.appendChild(badge);
        msgEl.appendChild(wrap);
        rescrollChatIfNearBottom();
    });
}

function scanImageEmbeds(buf) {
    if (!autoEmbedEnabled()) return;
    buf.querySelectorAll('[class*="chat-msg-"]').forEach(embedImagesIn);
}

let _imageEmbedObserverStarted = false;
export function startImageEmbedObserver() {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;
    if (_imageEmbedObserverStarted) { scanImageEmbeds(buf); return; }
    _imageEmbedObserverStarted = true;
    new MutationObserver(() => scanImageEmbeds(buf)).observe(buf, { childList: true, subtree: true });
    scanImageEmbeds(buf);
}
