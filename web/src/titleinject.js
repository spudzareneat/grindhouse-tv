import { parseMovieFilename, parseYouTubeTitle } from './parse.js';
import { movieState, lookupMovie } from './metadata/tmdb.js';
import { npState, showNowPlayingCard, _npCardEnabled } from './cards/nowplaying.js';
import { getCurrentMediaSeconds, mediaState } from './mediatime.js';
import { nativeHttpGet } from './native.js';
import { getLastAired } from './metadata/lastaired.js';
import { isTv } from './tvdetect.js';
import { chromeState } from './chrome/state.js';
import { updateSubtitleButton } from './subtitles/ui.js';

// Auto-announce hold time for the Now-Playing card (see showNowPlayingCard's opts.autoHideMs).
const NP_AUTO_HIDE_MS = isTv ? 10000 : 8000;

// Auto-announce the hero card only for a genuine feature: a non-YouTube item at least
// 45 min long. Filters out main-server bumpers/shorts (raw files) that happen to match a
// TMDB title; YouTube is excluded outright (its shorts already fall through below, and
// even hour+ YT "movies" don't need the auto-card). Manual summon (i key / title tap /
// Tonight's Lineup) is unaffected -- this only gates the automatic pop.
const NP_AUTO_MIN_SECONDS = 45 * 60;
function _npShouldAutoAnnounce(isYt) {
    return !isYt && getCurrentMediaSeconds() >= NP_AUTO_MIN_SECONDS;
}

export function isYouTubeMedia() {
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

// Fallback when changeMedia hasn't fired yet this session (e.g. a fresh/refreshed page
// load) -- reads the video id straight from the YouTube iframe's src, the same element
// isYouTubeMedia() above checks.
function _domYtVideoId() {
    const el = document.querySelector('#ytapiplayer iframe[src*="youtube.com"]');
    if (!el) return '';
    const src = el.getAttribute('src') || '';
    const m = src.match(/[?&]v=([\w-]{11})/) || src.match(/\/embed\/([\w-]{11})/);
    return m ? m[1] : '';
}

// Free, no-key YouTube oEmbed lookup -- title/channel/thumbnail only, no year/plot/rating/
// imdbId. Used only as a fallback for short clips the main TMDB path below skips entirely
// (trailers/bumpers/ads) -- but real short films (e.g. "Our Robocop Remake") do run under
// the hour cutoff too, and oEmbed's title is straight from the video itself, so it beats
// showing nothing. Resolves null on any failure instead of throwing, so callers need no
// .catch(). Ported from the sibling PC userscript's movie-title-links module, swapping its
// GM_xmlhttpRequest (a Tampermonkey API that doesn't exist in this native WebView) for the
// CytubeNative CORS bridge.
function fetchYtOembed(videoId) {
    if (!videoId) return Promise.resolve(null);
    const watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
    const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(watchUrl) + '&format=json';
    return nativeHttpGet(url).then((res) => {
        if (!res || res.status !== 200) return null;
        try { return JSON.parse(res.body); } catch (e) { return null; }
    }).catch(() => null);
}

// Builds/updates the clickable clean-title span inside titleEl from resolved movie data.
// Shared by the fresh-lookup path below and the cache-reapply path (same movie, but CyTube
// reset the title header's DOM out from under us -- see the reapply branch in
// injectMovieLinks for why that happens).
function applyCleanTitleDom(titleEl, movieData) {
    const { cleanTitle, cleanYear } = movieData;
    if (!cleanTitle || !titleEl) return;
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

function injectMovieLinks(titleEl) {
    const rawTitle = titleEl.textContent.trim()
        .replace(/^currently\s+playing[:\s]*/i, '')
        .replace(/^now\s+playing[:\s]*/i, '').trim();

    if (!rawTitle || rawTitle.length < 2) return;

    if (rawTitle === movieState.lastMovieTitle) {
        // Same movie we've already resolved this session. CyTube re-renders the title
        // header on every socket reconnect (e.g. resuming after a long background) --
        // that wipes the clean-title span we inject below, reverting the display to the
        // raw filename even though nothing about the movie changed. Reapply it from the
        // cached lookup: cheap, synchronous, no network call, no re-announcing the card.
        if (npState.data && !titleEl.querySelector('#sc-title-text')) {
            applyCleanTitleDom(titleEl, npState.data);
        }
        return;
    }
    movieState.lastMovieTitle = rawTitle;

    // Clean up any previous stats bar/trivia button
    ['sc-movie-stats', 'sc-trivia-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    // Drop stale movie metadata too: if this title turns out to be a non-movie
    // (short bumper that returns below, or unparseable), npState.data must NOT linger —
    // otherwise the title observer rebuilds a Trivia button for the old film. The
    // lookup repopulates it below when (and only when) this resolves to a real movie.
    npState.data = null;
    updateSubtitleButton(null); // reset until the lookup below (re-)resolves an imdbId

    // YouTube: usually bumpers/intros, but occasionally a full movie.
    // Only attempt a lookup when the video runs an hour+ (likely a real film),
    // and parse the messy YouTube title differently from a filename.
    const isYt = isYouTubeMedia();
    let ytSeconds = 0;
    if (isYt) {
        ytSeconds = getCurrentMediaSeconds();
        if (ytSeconds < 3600) {
            // Short clip -- most are trailers/bumpers/ads with no real IMDb match, but
            // real short films (e.g. "Our Robocop Remake") run under an hour too. oEmbed
            // is free and gives the actual video title straight from YouTube, so use it
            // instead of leaving the raw, unparsed CyTube title on screen. Unlike the
            // PC script (which only surfaces this via its 'i' keyboard shortcut, out of
            // scope here -- remote/TV first, no hotkeys), also make the title clickable/
            // focusable the same way a real TMDB match does, so it's reachable on TV.
            const videoId = mediaState.currentYtVideoId || _domYtVideoId();
            if (videoId) {
                fetchYtOembed(videoId).then((info) => {
                    if (!info || !info.title) return; // no data -- leave npState.data untouched
                    if (movieState.lastMovieTitle !== rawTitle) return; // superseded by a newer title
                    const movieData = {
                        cleanTitle: info.title, cleanYear: null,
                        poster: info.thumbnail_url || null, backdrop: info.thumbnail_url || null,
                        overview: info.author_name ? `Uploaded by ${info.author_name}` : null,
                        rating: null, runtime: null, genres: [], parentalGuide: null,
                        killCount: null, imdbId: null, links: {},
                    };
                    npState.data = movieData;
                    // No auto-card for YouTube (see _npShouldAutoAnnounce) -- this path is
                    // YT-only. The title stays clickable / summonable via applyCleanTitleDom.
                    applyCleanTitleDom(titleEl, movieData);
                });
            }
            return;
        }
    }

    const { title, year } = isYt ? parseYouTubeTitle(rawTitle) : parseMovieFilename(rawTitle);
    if (!title || title.length < 2) return;

    lookupMovie(title, year).then((movieData) => {
        const { killCount, parentalGuide, cleanTitle, cleanYear } = movieData;

        // For YouTube guesses, sanity-check the match against the real runtime.
        // If TMDB's runtime is wildly off from the video length, it's probably wrong.
        if (isYt) {
            if (!cleanTitle) return;
            if (movieData.runtime && ytSeconds) {
                const diff = Math.abs(movieData.runtime - ytSeconds / 60);
                if (diff > 30) return;
            }
        }

        // Stash for the Now-Playing hero card. The startup intro handles the
        // first card; only auto-announce SUBSEQUENT films mid-session. IMDb/Letterboxd/Wiki
        // links (movieData.links) render inside that card on phone/tablet -- see
        // nowplaying.js's #sc-np-links -- and not at all on TV (see that file's #sc-np-links
        // gating and the comment on _npCardEnabled).
        npState.data = movieData;
        updateSubtitleButton(movieData.imdbId);
        if (_npCardEnabled() && npState.introDone && _npShouldAutoAnnounce(isYt)) showNowPlayingCard(movieData, { autoHide: true, autoHideMs: NP_AUTO_HIDE_MS });
        // Update the title element with the clean TMDB title, wrapped in a
        // dedicated clickable span so ONLY the title (not the rest of the
        // header) opens the now-playing card.
        applyCleanTitleDom(titleEl, movieData);

        // ── Stats bar (kill count, parent guide, last aired) ───────────────
        // Stats go in a fixed floating bar over the bottom of the video,
        // not inside #videowrap-header which is too small to contain a div.
        const statParts = [];
        if (killCount !== null) statParts.push(`💀 ${killCount} on-screen kills`);
        // Color-coded dot + category, "None" severity skipped (nothing to warn about) --
        // same compact format as the sibling PC userscript's stats bar.
        if (parentalGuide && parentalGuide.length) {
            const PG_SEV_DOT = { Severe: '🔴', Moderate: '🟡', Mild: '🟢', None: '' };
            parentalGuide.forEach(({ category, severity }) => {
                const dot = PG_SEV_DOT[severity] || '';
                if (dot) statParts.push(`${dot} ${category}`);
            });
        }
        const lastAired = getLastAired(cleanTitle || title, cleanYear || year);
        if (lastAired) statParts.push(`📅 Last aired ${lastAired.dateStr}`);

        const old = document.getElementById('sc-movie-stats');
        if (old) old.remove();

        if (statParts.length) {
            // The Now-Playing card (full-screen, z-index above this bar) auto-shows over the
            // same trigger -- starting this bar's 12s visible countdown at the same moment
            // meant most of it ticked away unseen behind the card. Delay creation until the
            // card is done (or 0ms if it won't show at all -- before intro/on a device where
            // it's disabled) so the full 12s is actually visible.
            const cardWillAutoShow = _npCardEnabled() && npState.introDone && _npShouldAutoAnnounce(isYt);
            const revealDelay = cardWillAutoShow ? NP_AUTO_HIDE_MS : 0;
            setTimeout(() => {
                if (movieState.lastMovieTitle !== rawTitle) return; // superseded by a newer title
                const statsEl = document.createElement('div');
                statsEl.id = 'sc-movie-stats';
                statsEl.textContent = statParts.join('  ·  ');
                document.body.appendChild(statsEl);
                // Pin the scrubber bar (+ docked button cluster, vertical mode) open for as
                // long as this is up -- they read as one announcement and should disappear
                // together, not the scrubber fading independently on its own idle timer.
                if (typeof chromeState.pinChromeVisible === 'function') chromeState.pinChromeVisible();
                setTimeout(() => {
                    if (statsEl.parentNode) statsEl.remove();
                    if (typeof chromeState.unpinChromeVisible === 'function') chromeState.unpinChromeVisible();
                }, 12000);
            }, revealDelay);
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

// Reactive title updates come from player/resync.js's onSocket('changeMedia', ...)
// handler (setTimeout(triggerTitleInject, 350) once the media genuinely changes) —
// the characterData MutationObserver that used to watch the header for any DOM
// change has been removed as redundant with that socket-driven trigger.
export function watchMovieTitle() {
    triggerTitleInject();
    // First-load robustness: on a cold load the title/header often aren't ready
    // when we boot, so poll for ~20s, re-trying the lookup until the title resolves.
    let tries = 0;
    const poll = setInterval(() => {
        triggerTitleInject();
        if (++tries >= 14) clearInterval(poll);
    }, 1500);
}
