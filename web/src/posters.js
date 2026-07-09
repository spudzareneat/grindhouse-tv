import { usernameToColor } from './usercolors.js';
import { onSocket } from './socket.js';
import { showLineupScreen } from './lineup/screen.js';

/* ==========================================================
   COMING ATTRACTIONS TOGGLE — opens the full-screen Tonight's Lineup on
   every platform. (Named initPosterStrip for its settings.js call sites;
   the small hover-zoom poster strip this used to toggle on phone/tablet
   was retired once Lineup itself became reachable there.)
========================================================== */

export function initPosterStrip() {
    if (document.getElementById('sc-poster-toggle')) return; // re-init guard (settings.js calls this on MOTD updates)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sc-poster-toggle';
    toggleBtn.textContent = "Coming Attractions";
    toggleBtn.title = "Show tonight's lineup";
    toggleBtn.dataset.noTvCaption = '1'; // button text is self-explanatory; no remote caption
    toggleBtn.addEventListener('click', () => showLineupScreen());
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
