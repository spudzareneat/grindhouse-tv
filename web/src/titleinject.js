import { parseMovieFilename, parseYouTubeTitle } from './parse.js';
import { movieLinksEnabled } from './store.js';
import { movieState, LINK_DEFS, lookupMovie } from './metadata/tmdb.js';
import { npState, showNowPlayingCard, _npCardEnabled } from './cards/nowplaying.js';
import { getCurrentMediaSeconds } from './mediatime.js';

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
    // (short bumper that returns below, or unparseable), npState.data must NOT linger —
    // otherwise the title observer rebuilds a Trivia button for the old film. The
    // lookup repopulates it below when (and only when) this resolves to a real movie.
    npState.data = null;

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
        npState.data = movieData;
        if (_npCardEnabled() && npState.introDone) showNowPlayingCard(movieData, { autoHide: true });
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
                    if (npState.data) showNowPlayingCard(npState.data, { autoHide: false });
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

export function triggerTitleInject() {
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

export function watchMovieTitle() {
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
