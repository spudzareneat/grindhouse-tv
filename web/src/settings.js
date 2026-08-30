import { getChatUsernames } from './chat/usernames.js';
import { syncNativeInputFocus } from './chat/inputfocus.js';
import { emoteState, startEmoteWatcher } from './chat/emotemirror.js';
import { attemptSend } from './chat/grammar.js';
import { handleTabComplete, clearTabCandidates, relocateEmoteButton, applyInputMode } from './chat/input.js';
import { chromeState } from './chrome/state.js';
import { initPosterStrip, initUpNextButton, initPollWatcher, initUserCount } from './posters.js';
import { getChatFontSize, applyChatFontSize } from './chat/fontsize.js';
import { initLoginTvNav, initTvNav, tvNavState } from './tvnav.js';
import {
    initAmbientGlow, initChromeAutohide, initChatModes, cycleChatMode,
    initNewMessagePill, initMentionToast, initChatFont, initLeftZone,
    initVideoTapReveal, initVertControlBand, initRightZone,
} from './chat/modes.js';
import { initDesyncButton, addFloatingButtons, addCastButton } from './chrome/buttons.js';
import { usernameToColor } from './usercolors.js';
import { getExternalUserEmoji } from './useremoji.js';
import { nativeHttpGet } from './native.js';
import { initPhoneKeyboard } from './chat/keyboard.js';
import { renderQrToCanvas } from './vendor/qr.js';
import { _appVersion, checkForUpdate, initUpdateCheck, _updateInfo, GH_RELEASES_PAGE } from './update.js';
import {
    LS_TMDB, LS_ONBOARDED, LS_SPELLCHECK, LS_CHAT_FONT, LS_COUCH, LS_WATCHALONG, LS_CAST_MUTE, LS_LINEUP_TIMING, LS_AUTOEMBED, LS_TRIVIA_POPUP, LS_TRIVIA_POPUP_FREQ,
    LS_SUBTITLE_OPACITY, LS_SUBTITLE_FONTSIZE, LS_SUBTITLE_LINES,
    getKey, setKey, hasKey, spellCheckEnabled, couchModeEnabled, watchAlongEnabled, castFallbackMuted, lineupTimingEnabled, autoEmbedEnabled, triviaPopupEnabled, triviaPopupFrequency,
} from './store.js';
import { fetchImdbParentalGuide } from './metadata/imdb.js';
import { isTv } from './tvdetect.js';
import { movieState, getKillCountDb, validateTmdbKey } from './metadata/tmdb.js';
import { npState, showNowPlayingCard, hideNowPlayingCard, initNowPlayingWatcher } from './cards/nowplaying.js';
import { triviaPopupBoot } from './cards/triviapopup.js';
import {
    initSubtitles, startSubtitlesObserver, refreshSubtitles,
    getSubtitleOpacity, getSubtitleFontSize, getSubtitleLines,
    applySubtitleOpacity, applySubtitleFontSize,
} from './cards/subtitles.js';
import { triggerTitleInject, watchMovieTitle } from './titleinject.js';
import { loadLastAiredSheet } from './metadata/lastaired.js';
import { initGoogleDrive } from './player/drive.js';
import { initMediaWatcher } from './player/resync.js';
import { initYtScrubber } from './player/ytscrubber.js';
import { initSeekHud } from './player/seekhud.js';
import { openExternalUrl } from './player/drm.js';
import { getMovieLeadSec, setMovieLeadSec, initMovieLeadOffset, MOVIE_LEAD_MIN, MOVIE_LEAD_MAX } from './player/leadtime.js';
import { startImageEmbedObserver } from './chat/imageembed.js';
import { startLinkPipObserver } from './chat/linkpip.js';
import { initChannelScriptAutoApprove } from './channelscript.js';
import baseCss from './styles/base.css';
import overlaysCss from './styles/overlays.css';
import tvCss from './styles/tv.css';

// Trivia pop-up frequency, as a slider (0-2) instead of a <select> -- a native <select>'s
// OS-level dropdown popup is unreachable by a TV remote (see tvnav.js's move()/activate() D-pad
// history for the same problem, since fixed there for the general case; this and the subtitle
// line-count control below are the two concrete instances, converted instead of relying on that
// fix so the UI itself doesn't still look/feel like a dropdown you're expected to open).
const TRIVIA_FREQ_STEPS = [
    { value: 'frequent',   label: 'Frequent — about once a minute' },
    { value: 'occasional', label: 'Occasional — every few minutes' },
    { value: 'rare',       label: 'Rare — every 8–15 minutes' },
];
const triviaFreqIndex = (value) => Math.max(0, TRIVIA_FREQ_STEPS.findIndex(s => s.value === value));

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


    // Soft (on-screen) keyboard suppression via inputmode="none".
    // Defaults to ON for TV; the settings toggle overrides on any device.
    const LS_NOKEYBOARD = 'sc_no_soft_keyboard';
    function softKeyboardDisabled() {
        const v = getKey(LS_NOKEYBOARD);
        if (v === 'on')  return true;
        if (v === 'off') return false;
        // Default: suppress the on-screen keyboard when a phone is actively paired (it's
        // driving text entry instead), or when a hardware keyboard is connected (so
        // remote-only TVs with neither keep the on-screen keyboard).
        try { if (window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected()) return true; } catch (e) {}
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
        // window.screen dimensions (what isVerticalMonitor reads) change when the
        // physical monitor/orientation changes — both a media-query match and a
        // resize event fire when that happens, so poll-free detection is reliable here.
        try {
            window.matchMedia('(orientation: portrait)').addEventListener('change', applyMonitorLayout);
        } catch (e) {}
        window.addEventListener('resize', applyMonitorLayout);
    }

    /* ==========================================================
       CHAT USERNAMES — autocomplete + LT ignore list
    ========================================================== */

    /* ==========================================================
       TAB AUTOCOMPLETE
    ========================================================== */

    /* ==========================================================
       LANGUAGETOOL GRAMMAR CHECK
    ========================================================== */


    /* ==========================================================
       EMOTE MIRROR
    ========================================================== */

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
            clearTabCandidates();
            emoteState.lastChatlineValue = originalInput.value;
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

    /* ==========================================================
       EMOTE BUTTON RELOCATION
       CyTube's #emotelistbtn lives inside #leftcontrols which we
       hide in horizontal mode. Clone it outside so it's always visible,
       and forward clicks to the original so CyTube's picker still opens.
    ========================================================== */

    /* ==========================================================
       MOVIE TITLE CLEANING
       Handles filenames like: White.Fire.[1984].mkv
       → returns { title: "White Fire", year: "1984" }
    ========================================================== */

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

    /* ==========================================================
       IMDb GraphQL (public endpoint, via native HTTP to dodge CORS)
       The website's own endpoint accepts arbitrary queries, so we send our
       OWN query (no persisted-hash maintenance). Works over GET; reuses the
       native bridge. Data is "non-commercial use only" per IMDb — fine here.
    ========================================================== */

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

    /* ==========================================================
       NOW-PLAYING HERO CARD (cinematic shell)
       Full-screen card with backdrop art, poster, rating, runtime,
       genres and content warnings. Shows on new media + on pause,
       fades away on play. TV-first; trivially enableable on mobile.
    ========================================================== */

    /* ==========================================================
       USER COLOR SYSTEM
    ========================================================== */

    function applyUserColors() {
        document.querySelectorAll('#messagebuffer [class*="chat-msg-"]').forEach(el => {
            const cls = [...el.classList].find(c => c.startsWith('chat-msg-'));
            if (!cls) return;
            const u = cls.replace('chat-msg-', '');
            const span = el.querySelector('.username');
            if (span) {
                span.style.color = usernameToColor(u);
                span.style.fontWeight = '700';
                // data attribute + CSS ::before, not textContent, so autocomplete/mention
                // matching (which reads the raw name) is unaffected.
                const emoji = getExternalUserEmoji(u);
                if (emoji) span.dataset.emoji = emoji;
            }
            el.classList.toggle('sc-own-msg', !!(window.CLIENT && CLIENT.name && u === CLIENT.name));
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
        let phoneKbStatusTimer = null;

        const overlay = document.createElement('div');
        overlay.id = 'sc-settings-overlay';
        overlay.innerHTML = `
            <div id="sc-settings-modal">
                <div id="sc-settings-title">⚙ Grindhouse Settings</div>
                ${firstRun ? '<div class="sc-settings-intro">First-time setup — everything here is optional. Log in to chat, and enable TMDB for richer movie info. Reopen any time with the ⚙ button.</div>' : ''}

                <nav id="sc-settings-tabs">
                    <button type="button" class="sc-settings-tab" data-tab="account">Account</button>
                    <button type="button" class="sc-settings-tab" data-tab="appearance">Appearance</button>
                    <button type="button" class="sc-settings-tab" data-tab="playback">Playback</button>
                    <button type="button" class="sc-settings-tab" data-tab="chat">Chat</button>
                    ${isTv ? '<button type="button" class="sc-settings-tab" data-tab="keyboard">Phone Keyboard</button>' : ''}
                    <button type="button" class="sc-settings-tab" data-tab="updates">Updates</button>
                </nav>

                <div class="sc-settings-pane" data-pane="account">
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

                            <label class="sc-settings-toggle-label sc-settings-divider">
                                <span class="sc-toggle-row">
                                    <input type="checkbox" id="sc-input-lineuptiming" ${lineupTimingEnabled() ? 'checked' : ''} />
                                    <span class="sc-toggle-text">Coming Attractions live timing (Experimental)</span>
                                </span>
                                <span class="sc-settings-note">Shows NOW PLAYING and estimated start times in Tonight's Lineup. Needs TMDB above for movie runtimes — without it, estimates can't guess well. Off by default, still being tuned.</span>
                            </label>
                        </div>
                    </div>

                    <div class="sc-settings-group">
                        <label class="sc-settings-label">CyTube Account
                            <span class="sc-settings-note">Opens the CyTube login page — your settings here are saved first</span>
                        </label>
                        <button id="sc-login-btn" class="sc-settings-btn-wide" type="button">Log in / Switch Account</button>
                    </div>

                    <div class="sc-settings-group">
                        <label class="sc-settings-label">Support the Channel
                            <span class="sc-settings-note">Opens the 420Grindhouse Patreon page in your browser</span>
                        </label>
                        <button id="sc-patreon-btn" class="sc-settings-btn-wide" type="button">❤ Patreon</button>
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="appearance">
                    <div class="sc-settings-group">
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
                </div>

                <div class="sc-settings-pane" data-pane="playback">
                    <div class="sc-settings-group">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-castmute" ${castFallbackMuted() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Mute fallback audio while casting</span>
                            </span>
                            <span class="sc-settings-note">When a clip can't be cast (e.g. YouTube) it plays on this device instead — turn this on to keep that playback muted by default</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Disable on-screen keyboard</span>
                            </span>
                            <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-label">
                            Movie lead time (seconds ahead of sync)
                            <span class="sc-settings-note">Keeps you a few seconds ahead of the group during movies (not YouTube) — cushions against your own buffering. 0 = off.</span>
                        </label>
                        <input id="sc-input-leadsec" class="sc-settings-input" type="number" min="${MOVIE_LEAD_MIN}" max="${MOVIE_LEAD_MAX}" step="1" value="${getMovieLeadSec()}" style="width:5em" />
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-triviapopup" ${triviaPopupEnabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Pop-up trivia bubbles during movies (Experimental)</span>
                            </span>
                            <span class="sc-settings-note">Shows a small IMDb trivia fact over the video, VH1 Pop-up Video style, then fades out. Off by default. Cycles without repeats and stops once all trivia for the current movie has been shown.</span>
                        </label>
                        <label class="sc-settings-label" style="margin-top:8px">
                            Pop-up frequency
                            <span class="sc-settings-note" id="sc-triviafreq-val">${TRIVIA_FREQ_STEPS[triviaFreqIndex(triviaPopupFrequency())].label}</span>
                        </label>
                        <input type="range" id="sc-input-triviapopup-freq" class="sc-settings-range"
                            min="0" max="${TRIVIA_FREQ_STEPS.length - 1}" step="1" value="${triviaFreqIndex(triviaPopupFrequency())}" />
                    </div>
                </div>

                ${isTv ? `
                <div class="sc-settings-pane" data-pane="keyboard">
                    <div class="sc-settings-group">
                        <label class="sc-settings-label">Phone Keyboard
                            <span class="sc-settings-note">Pair a phone on the same Wi-Fi to type into any field here — chat, login, even this key field</span>
                        </label>
                        <div class="sc-settings-input-row">
                            <button id="sc-pair-phone-btn" class="sc-settings-btn-wide" type="button">Pair a phone</button>
                        </div>
                        <canvas id="sc-phone-qr" class="sc-hidden"></canvas>
                        <div id="sc-phone-qr-status" class="sc-settings-note"></div>
                    </div>
                </div>` : ''}

                <div class="sc-settings-pane" data-pane="chat">
                    <div class="sc-settings-group">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-spellcheck" ${spellCheckEnabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Grammar &amp; spell check popup</span>
                            </span>
                            <span class="sc-settings-note">When off, messages send immediately without review</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-couch" ${couchModeEnabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Couch Mode</span>
                            </span>
                            <span class="sc-settings-note">When typing in sidebar chat, the input grows into a big, easy-to-read box over the video</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-watchalong" ${watchAlongEnabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Watch-Only Mode</span>
                            </span>
                            <span class="sc-settings-note">Hides the chat input and the guest-login box — just read along, no typing</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-autoembed" ${autoEmbedEnabled() ? 'checked' : ''} />
                                <span class="sc-toggle-text">Auto-embed image links in chat</span>
                            </span>
                            <span class="sc-settings-note">Shows a thumbnail preview under messages that link directly to an image, marked "🖼 embedded"</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-label">
                            Chat as TV subtitles
                            <span class="sc-settings-note">"Subtitles" is one of the chat layouts now — cycle to it with the header chat button (or press C) to show recent chat as movie-subtitle lines over the video, each with the sender's chat color and emoji. Ported from the idea in <a href="https://github.com/kburna243/mikes-420grindhouse-app" target="_blank" rel="noopener noreferrer">kburna243/mikes-420grindhouse-app</a>'s subtitle-chat overlay. The controls below tune how it looks.</span>
                        </label>
                        <label class="sc-settings-label" style="margin-top:8px">
                            Subtitle opacity
                            <span class="sc-settings-note" id="sc-subtitle-opacity-val">${Math.round(getSubtitleOpacity() * 100)}%</span>
                        </label>
                        <input type="range" id="sc-input-subtitle-opacity" class="sc-settings-range"
                            min="0.2" max="0.9" step="0.05" value="${getSubtitleOpacity()}" />
                        <label class="sc-settings-label" style="margin-top:8px">
                            Subtitle font size
                            <span class="sc-settings-note" id="sc-subtitle-fontsize-val">${getSubtitleFontSize()}px</span>
                        </label>
                        <input type="range" id="sc-input-subtitle-fontsize" class="sc-settings-range"
                            min="12" max="24" step="1" value="${getSubtitleFontSize()}" />
                        <label class="sc-settings-label" style="margin-top:8px">
                            Lines on screen
                            <span class="sc-settings-note" id="sc-subtitle-lines-val">${getSubtitleLines()}</span>
                        </label>
                        <input type="range" id="sc-input-subtitle-lines" class="sc-settings-range"
                            min="1" max="3" step="1" value="${getSubtitleLines()}" />
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="updates">
                    <div class="sc-settings-group" id="sc-update-group">
                        <label class="sc-settings-label">App Updates
                            <span class="sc-settings-note" id="sc-update-current">Installed: v${_appVersion() || '?'}</span>
                        </label>
                        <div id="sc-update-status" class="sc-settings-note">Checking for updates…</div>
                        <div id="sc-update-notes" class="sc-update-notes sc-hidden"></div>
                        <div class="sc-settings-input-row">
                            <button id="sc-update-check" class="sc-settings-test" type="button">Check now</button>
                        </div>
                        <button id="sc-update-github-link" class="sc-update-github-link sc-hidden" type="button">View release on GitHub ↗</button>
                    </div>
                </div>

                <div id="sc-settings-actions">
                    <button id="sc-settings-cancel">${firstRun ? 'Skip for now' : 'Cancel'}</button>
                    <button id="sc-settings-save">Save</button>
                </div>
                <div id="sc-settings-status"></div>
            </div>`;

        document.body.appendChild(overlay);

        // Every path that closes the modal must also stop the phone-keyboard status poll,
        // or it keeps ticking (and leaking) after the modal is gone.
        const closeSettings = () => { clearInterval(phoneKbStatusTimer); overlay.remove(); };

        // ── Tab switching. First-run always lands on Account (the default/first tab). ──
        const tabs  = [...overlay.querySelectorAll('.sc-settings-tab')];
        const panes = [...overlay.querySelectorAll('.sc-settings-pane')];
        const showTab = (name) => {
            tabs.forEach(t => t.classList.toggle('sc-settings-tab-active', t.dataset.tab === name));
            panes.forEach(p => p.classList.toggle('sc-settings-pane-active', p.dataset.pane === name));
        };
        tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
        showTab('account');

        // The TMDB key is optional — always allow closing (backdrop tap or Cancel/Skip).
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeSettings();
        });
        document.getElementById('sc-settings-cancel').addEventListener('click', () => closeSettings());

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
                    if (i) { if (tvNavState.setFocus) tvNavState.setFocus(i); else i.focus(); }
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
            setTimeout(closeSettings, 800);
        });

        document.getElementById('sc-login-btn').addEventListener('click', () => {
            persistSettings();     // don't lose entries when we navigate away to log in
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        });
        document.getElementById('sc-patreon-btn').addEventListener('click', () => {
            openExternalUrl('https://www.patreon.com/c/420Grindhouse/posts?vanity=420Grindhouse');
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

        // ── Phone Keyboard pairing (TV only) ──────────────────────────────────
        const pairBtn = document.getElementById('sc-pair-phone-btn');
        if (pairBtn) {
            const qrCanvas = document.getElementById('sc-phone-qr');
            const qrStatus = document.getElementById('sc-phone-qr-status');
            pairBtn.addEventListener('click', () => {
                let url = '';
                try { if (window.CytubeNative && CytubeNative.phoneKeyboardUrl) url = CytubeNative.phoneKeyboardUrl(); } catch (e) {}
                if (!url) { qrStatus.textContent = 'Could not start pairing.'; return; }
                renderQrToCanvas(qrCanvas, url);
                qrCanvas.classList.remove('sc-hidden');
                qrStatus.textContent = 'Waiting for phone…';
                clearInterval(phoneKbStatusTimer);
                phoneKbStatusTimer = setInterval(() => {
                    let connected = false;
                    try { connected = !!(window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected()); } catch (e) {}
                    qrStatus.textContent = connected ? 'Phone connected ✓' : 'Waiting for phone…';
                }, 1000);
            });
        }

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

        // ── Coming Attractions live timing toggle (Experimental; applies next lineup open) ─
        const lineupTiming = document.getElementById('sc-input-lineuptiming');
        if (lineupTiming) lineupTiming.addEventListener('change', () => {
            setKey(LS_LINEUP_TIMING, lineupTiming.checked ? 'on' : 'off');
        });

        // ── Auto-embed chat image links toggle (re-scans the visible backlog when re-enabled) ─
        const autoembed = document.getElementById('sc-input-autoembed');
        if (autoembed) autoembed.addEventListener('change', () => {
            setKey(LS_AUTOEMBED, autoembed.checked ? 'on' : 'off');
            startImageEmbedObserver();
        });

        // ── Chat-as-subtitles appearance (applies immediately; the mode itself is toggled via
        // the header chat button/cycleChatMode, not a setting here) ──────────────────────────
        const subOpacity = document.getElementById('sc-input-subtitle-opacity');
        const subOpacityVal = document.getElementById('sc-subtitle-opacity-val');
        if (subOpacity) subOpacity.addEventListener('input', () => {
            const v = parseFloat(subOpacity.value);
            subOpacityVal.textContent = Math.round(v * 100) + '%';
            setKey(LS_SUBTITLE_OPACITY, String(v));
            applySubtitleOpacity(v);
        });
        const subFontSize = document.getElementById('sc-input-subtitle-fontsize');
        const subFontSizeVal = document.getElementById('sc-subtitle-fontsize-val');
        if (subFontSize) subFontSize.addEventListener('input', () => {
            const px = parseInt(subFontSize.value, 10);
            subFontSizeVal.textContent = px + 'px';
            setKey(LS_SUBTITLE_FONTSIZE, String(px));
            applySubtitleFontSize(px);
        });
        const subLines = document.getElementById('sc-input-subtitle-lines');
        const subLinesVal = document.getElementById('sc-subtitle-lines-val');
        if (subLines) subLines.addEventListener('input', () => {
            if (subLinesVal) subLinesVal.textContent = subLines.value;
            setKey(LS_SUBTITLE_LINES, subLines.value);
            refreshSubtitles();
        });

        // ── Movie lead-time-ahead-of-sync (applies live — read fresh on every mediaUpdate tick) ─
        const leadsec = document.getElementById('sc-input-leadsec');
        if (leadsec) leadsec.addEventListener('change', () => {
            leadsec.value = setMovieLeadSec(parseInt(leadsec.value, 10));
        });

        // ── Pop-up trivia bubbles toggle + frequency (both read fresh on every scheduled pop) ─
        const triviapopup = document.getElementById('sc-input-triviapopup');
        if (triviapopup) triviapopup.addEventListener('change', () => {
            setKey(LS_TRIVIA_POPUP, triviapopup.checked ? 'on' : 'off');
        });
        const triviapopupFreq = document.getElementById('sc-input-triviapopup-freq');
        const triviapopupFreqVal = document.getElementById('sc-triviafreq-val');
        if (triviapopupFreq) triviapopupFreq.addEventListener('input', () => {
            const step = TRIVIA_FREQ_STEPS[parseInt(triviapopupFreq.value, 10)];
            if (triviapopupFreqVal) triviapopupFreqVal.textContent = step.label;
            setKey(LS_TRIVIA_POPUP_FREQ, step.value);
        });

        // ── App update check / release notes / external-browser link ──────────
        (function wireUpdateSection() {
            const statusEl = document.getElementById('sc-update-status');
            const notesEl  = document.getElementById('sc-update-notes');
            const checkBtn = document.getElementById('sc-update-check');
            const ghLink   = document.getElementById('sc-update-github-link');
            if (!statusEl || !checkBtn || !ghLink) return;

            const render = (info) => {
                statusEl.className = 'sc-settings-note';
                notesEl.classList.add('sc-hidden');
                ghLink.classList.add('sc-hidden');
                if (!info) { statusEl.textContent = 'Checking for updates…'; return; }
                if (info.available) {
                    statusEl.classList.add('sc-update-yes');
                    statusEl.textContent = 'Update available: ' + info.latest;
                    if (info.notes) { notesEl.textContent = info.notes; notesEl.classList.remove('sc-hidden'); }
                    ghLink.classList.remove('sc-hidden');
                } else {
                    statusEl.classList.add('sc-update-no');
                    statusEl.textContent = info.latest ? '✓ You’re on the latest version (' + info.latest + ')' : '✓ You’re on the latest version';
                }
            };

            if (_updateInfo) render(_updateInfo);
            checkForUpdate(false).then(render).catch(() => {
                if (!_updateInfo) statusEl.textContent = 'Couldn’t reach GitHub to check.';
            });

            ghLink.addEventListener('click', () => {
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

    /* ==========================================================
       TOP BAR — auto-dim/wake for the video chrome
    ========================================================== */

    // Global wake/dim control — exposed via chromeState.topBarWake for other
    // modules (chat, tvnav) to un-dim the bar on activity.
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
            document.getElementById('sc-up-next-btn'),
        ].filter(Boolean);

        const dim = () => {
            if (!playing) return;
            getDimEls().forEach(el => el.classList.add('sc-bar-dim'));
            document.body.classList.add('sc-video-dimmed');
        };

        const wake = () => {
            getDimEls().forEach(el => el.classList.remove('sc-bar-dim'));
            document.body.classList.remove('sc-video-dimmed');
            clearTimeout(idleTimer);
            if (playing) idleTimer = setTimeout(dim, 3500);
        };
        chromeState.topBarWake = wake;

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
        const HEADER_SEL = '#videowrap-header, #sc-top-bar, #sc-title-text, #sc-up-next-btn, #sc-poster-toggle';
        document.addEventListener('click', (e) => {
            if (!bar.classList.contains('sc-bar-dim')) return;   // not faded → normal behaviour
            if (!e.target.closest(HEADER_SEL)) return;           // tap wasn't on the header
            e.preventDefault();
            e.stopPropagation();
            wake();
        }, true); // capture phase: intercept before the element's own handler
    }


    /* ==========================================================
       USER COUNT PANEL
    ========================================================== */

    function initChatHeader() {
        if (document.getElementById('sc-chat-header')) return;
        const header = document.createElement('div');
        header.id = 'sc-chat-header';
        document.body.appendChild(header);
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
            startImageEmbedObserver();
            startLinkPipObserver();
            startSubtitlesObserver();
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
        initPhoneKeyboard(isTv, () => {
            try {
                const connected = window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected();
                if (window.CytubeNative && CytubeNative.setSuppressKeyboard) CytubeNative.setSuppressKeyboard(!!connected);
            } catch (e) {}
        });
        initLoginTvNav();
        return;
    }


    initChannelScriptAutoApprove();
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
        initYtScrubber();
        initSeekHud();
        initChatTimestamps();
        initNowPlayingWatcher();
        initTopBar();
        initDesyncButton();
        initMovieLeadOffset();
        initChatHeader();
        initUserCount();
        initPollWatcher();
        initGoogleDrive();
        initUpdateCheck();
        loadLastAiredSheet();
        triviaPopupBoot();
        initSubtitles();

        // First-run settings modal — only the very first launch, never forced again.
        if (!localStorage.getItem(LS_ONBOARDED)) {
            setTimeout(openSettingsModal, 1200);
        }

        // The Coming Attractions toggle opens Tonight's Lineup, whose real schedule comes
        // from Reddit (see lineup/reddit.js) -- unlike the old MOTD-poster hover-zoom strip
        // this used to open, it doesn't depend on MOTD content at all, so no need to wait
        // for #motdrow images before creating the button.
        initPosterStrip();
        initUpNextButton();

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
            const wasNearBottom = buf && buf.scrollHeight - buf.scrollTop - buf.clientHeight < 80;
            if (buf && wasNearBottom) setTimeout(() => { buf.scrollTop = buf.scrollHeight; }, 120);
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
    initTvNav();
    initPhoneKeyboard(isTv, applySoftKeyboard);

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
        let playingSince = 0, preloadStarted = false, done = false, iv;

        const reveal = () => {
            if (done) return;
            done = true;
            clearInterval(iv);
            npState.introDone = true;
            _scStatus('Ready');

            const data = npState.data || (movieState.lastMovieTitle && movieState.lastMovieTitle.length > 1
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

        // Chat-only mode intentionally never plays media (see enterChatOnly/_coStopMedia in
        // chat/modes.js), so _mediaIsPlaying() below would never go true and this would sit
        // out the full 45s cap on every launch. Skip the wait when that's the mode we're
        // restoring into.
        let chatMode = 'sidebar';
        try { chatMode = localStorage.getItem('sc_chat_mode') || 'sidebar'; } catch (e) {}
        if (chatMode === 'chatonly') return reveal();

        _scStatus('Waiting for stream…');

        iv = setInterval(() => {
            if (done) return;
            if (Date.now() - start >= 45000) return reveal(); // hard cap

            const playing = _mediaIsPlaying();

            if (!playing) { playingSince = 0; return; }
            if (!playingSince) playingSince = Date.now();

            if (!isTv) return reveal();                       // phones: reveal as soon as it's playing

            // TV: preload the backdrop so the card is fully painted before we reveal it
            if (npState.data && npState.data.backdrop && !preloadStarted) {
                preloadStarted = true;
                _scStatus('Loading movie info…');
                const img = new Image();
                img.onload = img.onerror = reveal;
                img.src = npState.data.backdrop;
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
        const CAST_CONTROL_IDS = ['sc-poster-toggle', 'sc-up-next-btn', 'sc-usercount-btn', 'sc-poll-btn', 'sc-settings-btn'];
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
