import { usernameToColor } from './usercolors.js';
import { chromeState } from './chrome/state.js';
import { onSocket } from './socket.js';
import { isTv } from './tvdetect.js';
import { showLineupScreen } from './lineup/screen.js';
import { getMotdPosterImages } from './motd.js';

/* ==========================================================
   POSTER STRIP — toggle show/hide the MOTD poster images
========================================================== */

export function initPosterStrip() {
    // Build the poster strip container from MOTD images
    const imgs = getMotdPosterImages();
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
        // TV: skip the small strip + hover-zoom entirely, open the full-screen Lineup
        // rail directly — one press, no intermediate zoom step. Phone behavior (toggle
        // the small strip) is completely unchanged.
        if (isTv) { showLineupScreen(); return; }
        const visible = strip.classList.toggle('sc-poster-visible');
        toggleBtn.classList.toggle('sc-poster-toggle-active', visible);
        // Tell the top bar system whether strip is open
        chromeState.topBarIsOpen = visible;
        if (visible && chromeState.topBarWake) {
            chromeState.topBarWake(); // wake and keep awake
        }
        // If closing, restart the idle timer via a mousemove wake
        // (the next mousemove in the zone will restart it naturally)
    });
    document.body.appendChild(toggleBtn);
}

/* ==========================================================
   POLL / ANNOUNCEMENT WATCHER
========================================================== */

export function initPollWatcher() {
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

    // Watch for poll changes. CyTube's own client updates #pollwrap's DOM in response
    // to these same events (its handlers are registered long before ours), so we can
    // keep reacting by re-scraping the DOM rather than parsing the socket payloads.
    const reactToPollChange = () => {
        updateBtn();
        if (panelOpen) renderPanel();
    };
    onSocket('newPoll', reactToPollChange);
    onSocket('updatePoll', reactToPollChange);
    onSocket('closePoll', reactToPollChange);

    updateBtn();
} // end _initPollWatcher

/* ==========================================================
   USER COUNT PANEL
========================================================== */

export function initUserCount() {
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

    const updateCount = (n) => {
        // n comes from the 'usercount' socket event (a plain integer). Falls back to a
        // DOM read for the initial pre-join call, before any socket event has fired.
        const count = (typeof n === 'number') ? n : (() => {
            const cytubCount = document.getElementById('usercount');
            const raw = cytubCount?.textContent?.match(/\d+/)?.[0];
            return raw ? parseInt(raw) : getUsers().length;
        })();
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

    // Socket-driven: CyTube emits 'usercount' with the new count directly.
    onSocket('usercount', (n) => updateCount(n));

    updateCount();
}
