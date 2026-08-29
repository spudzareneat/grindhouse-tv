/* ==========================================================
   CHAT IMAGE EMBEDS
   Direct image links posted in chat (postimg.cc, imgur, discord cdn, etc.)
   get a thumbnail preview appended under the message, reusing the <a> tags
   CyTube already auto-linkifies out of the raw message text. Sized to match
   the channel's own emote height so it doesn't dominate the narrow chat
   column. Tapping the 🔗 icon in the badge swaps the thumbnail back for the
   plain link (and back again); 🚫 permanently bans a URL from ever
   re-embedding, ↩ reverses that.

   Also auto-embeds image-hosting LANDING pages (postimg.cc, ibb.co,
   prnt.sc) that don't match a direct image extension, by fetching the page
   via the native httpGet bridge and reading its og:image meta tag -- ported
   from the desktop userscript's current chatimages module.
========================================================== */
import { autoEmbedEnabled } from '../store.js';
import { nativeHttpGet } from '../native.js';

export const IMAGE_LINK_RE = /\.(jpe?g|png|gif|webp|bmp)(\?[^\s"']*)?$/i;
const IMAGE_HOST_ALLOWLIST = ['postimg.cc', 'ibb.co', 'prnt.sc'];
const LS_BANNED = 'sc_img_banned_urls'; // private to this module -- JSON array of exact banned URLs

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

function getBannedUrls() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_BANNED) || '[]')); }
    catch (e) { return new Set(); }
}
function saveBannedUrls(set) { try { localStorage.setItem(LS_BANNED, JSON.stringify([...set])); } catch (e) {} }
function isBanned(url) { return getBannedUrls().has(url); }

function isImageHostPage(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return IMAGE_HOST_ALLOWLIST.includes(host);
    } catch (e) { return false; }
}

function filenameFromUrl(url) {
    try {
        const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
        return seg ? decodeURIComponent(seg) : url;
    } catch (e) { return url; }
}

function extractOgImage(html) {
    let m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (!m) m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return m ? m[1] : null;
}

function resolveOgImage(pageUrl) {
    return nativeHttpGet(pageUrl).then(res => {
        if (!res || res.status !== 200) return null;
        const raw = extractOgImage(res.body || '');
        if (!raw) return null;
        try { return new URL(raw, pageUrl).href; } catch (e) { return null; }
    }).catch(() => null);
}

// Memoizes the in-flight Promise itself (not just its resolved value) so two
// near-simultaneous reposts of the same URL share one fetch instead of firing two.
// A failed resolution (null) evicts its own cache entry once settled, so a later
// repost gets a fresh attempt instead of being permanently poisoned by one bad fetch.
const ogImageCache = new Map(); // url -> Promise<string|null>
function resolveOgImageCached(url) {
    if (!ogImageCache.has(url)) {
        const p = resolveOgImage(url);
        p.then(result => { if (result === null) ogImageCache.delete(url); });
        ogImageCache.set(url, p);
    }
    return ogImageCache.get(url);
}

export function findImageLinks(msgEl) {
    return [...msgEl.querySelectorAll('a[href]')]
        .filter(a => !a.dataset.scEmbedded && !a.closest('.sc-img-embed')
            && (a.protocol === 'http:' || a.protocol === 'https:') && IMAGE_LINK_RE.test(a.href));
}

function findImageHostPageLinks(msgEl) {
    return [...msgEl.querySelectorAll('a[href]')]
        .filter(a => !a.dataset.scEmbedded && !a.closest('.sc-img-embed')
            && (a.protocol === 'http:' || a.protocol === 'https:') && isImageHostPage(a.href));
}

// CyTube auto-scrolls the message buffer synchronously when a message is appended,
// and separately hooks `load` on any <img> present at that time. Our thumbnail is
// appended asynchronously (via MutationObserver), so it misses both mechanisms --
// rescroll manually, but only if the user hadn't scrolled up to read backlog.
function rescrollChatIfNearBottom() {
    const b = document.getElementById('messagebuffer');
    if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 60) b.scrollTop = b.scrollHeight;
}

// Shared badge/DOM builder for both the direct-image (src known immediately) and
// landing-page (src arrives later from an async og:image resolution) paths.
function buildEmbed(a, initialSrc) {
    a.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'sc-img-embed';
    const link = document.createElement('a');
    link.href = a.href; // landing page until a resolved image URL replaces it, for the host-page path
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.loading = 'lazy';
    // !important priority: CyTube's own stylesheet caps chat <img> height (e.g.
    // for emotes) with a rule that otherwise wins over a plain inline style, which
    // is what was making embeds render tiny at random.
    img.style.setProperty('max-height', Math.round(emoteInlineHeight() * 1.25) + 'px', 'important');
    link.appendChild(img);
    const badge = document.createElement('span');
    badge.className = 'sc-img-embed-badge';
    const badgeLabel = document.createElement('span');
    badgeLabel.textContent = initialSrc ? '🖼 embedded' : '🖼 loading…';
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
    const banBtn = document.createElement('span');
    banBtn.className = 'sc-img-embed-ban';
    banBtn.textContent = '🚫';
    banBtn.title = "Hide this image everywhere and don't embed it again";
    banBtn.addEventListener('click', () => banUrl(a.href));
    badge.appendChild(badgeLabel);
    badge.appendChild(toggleBtn);
    badge.appendChild(banBtn);
    wrap.appendChild(link);
    wrap.appendChild(badge);
    if (initialSrc) {
        img.title = filenameFromUrl(initialSrc);
        img.onerror = () => { wrap.remove(); a.style.display = ''; };
        img.onload = rescrollChatIfNearBottom;
        img.src = initialSrc;
    }
    return { wrap, link, img, badgeLabel };
}

function applyEmbeddedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    const { wrap } = buildEmbed(a, a.href);
    msgEl.appendChild(wrap);
    a._scUi = wrap;
    rescrollChatIfNearBottom();
}

// Self-contained (not sharing DOM-building beyond buildEmbed with applyEmbeddedState) --
// this path is async/racy enough (the fetch can resolve after the embed's been banned,
// toggled, or scrolled out and removed) to want its own resolution guard.
function applyResolvedEmbedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    const { wrap, link, img, badgeLabel } = buildEmbed(a, null);
    msgEl.appendChild(wrap);
    a._scUi = wrap;
    resolveOgImageCached(a.href).then(imgUrl => {
        if (!wrap.isConnected) return; // removed (banned, toggled, etc.) before the fetch settled
        if (!imgUrl) { wrap.remove(); a.style.display = ''; if (a._scUi === wrap) a._scUi = null; return; }
        link.href = imgUrl;
        img.title = filenameFromUrl(imgUrl);
        img.onerror = () => { wrap.remove(); a.style.display = ''; };
        img.onload = rescrollChatIfNearBottom;
        img.src = imgUrl;
        badgeLabel.textContent = '🖼 embedded';
        rescrollChatIfNearBottom();
    });
}

function applyBannedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    a.style.display = '';
    const badge = document.createElement('span');
    badge.className = 'sc-img-embed-badge sc-img-embed-banned';
    const label = document.createElement('span');
    label.textContent = '🚫 image hidden';
    const unbanBtn = document.createElement('span');
    unbanBtn.className = 'sc-img-embed-unban';
    unbanBtn.textContent = '↩ unban';
    unbanBtn.title = 'Show this image again';
    unbanBtn.addEventListener('click', () => unbanUrl(a.href));
    badge.appendChild(label);
    badge.appendChild(unbanBtn);
    msgEl.appendChild(badge);
    a._scUi = badge;
}

function sweepUrl(url, applyFn) {
    const buf = document.getElementById('messagebuffer');
    if (!buf) return;
    buf.querySelectorAll('a[data-sc-embedded]').forEach(a => {
        if (a.href !== url) return;
        if (a._scUi) a._scUi.remove();
        applyFn(a);
    });
}
function banUrl(url) {
    const set = getBannedUrls();
    set.add(url);
    saveBannedUrls(set);
    sweepUrl(url, applyBannedState);
}
function unbanUrl(url) {
    const set = getBannedUrls();
    set.delete(url);
    saveBannedUrls(set);
    // The two URL categories are mutually exclusive by construction (extension-based
    // direct image vs. bare landing-page hostname), so this dispatch is unambiguous.
    sweepUrl(url, isImageHostPage(url) ? applyResolvedEmbedState : applyEmbeddedState);
}

function renderLink(a) {
    a.dataset.scEmbedded = '1';
    if (isBanned(a.href)) applyBannedState(a);
    else applyEmbeddedState(a);
}
function renderHostPageLink(a) {
    a.dataset.scEmbedded = '1';
    if (isBanned(a.href)) applyBannedState(a);
    else applyResolvedEmbedState(a);
}

function scanImageEmbeds(buf) {
    if (!autoEmbedEnabled()) return;
    buf.querySelectorAll('[class*="chat-msg-"]').forEach(msgEl => {
        findImageLinks(msgEl).forEach(renderLink);
        findImageHostPageLinks(msgEl).forEach(renderHostPageLink);
    });
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
