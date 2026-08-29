import { usernameToColor } from './usercolors.js';
import { getExternalUserEmoji } from './useremoji.js';
import { onSocket } from './socket.js';
import { showLineupScreen } from './lineup/screen.js';
import { showUpNextCard } from './cards/upnext.js';

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
    // Appended into the header (like #sc-up-next-btn already is) so portrait
    // layout can lay it out in the header's normal flex flow instead of
    // computing its position from the viewport. Fixed-position geometry
    // (landscape/TV) is computed against the viewport regardless of DOM
    // parent, so this is safe for those layouts too.
    const header = document.getElementById('videowrap-header');
    (header || document.body).appendChild(toggleBtn);
}

/* ==========================================================
   UP NEXT TOGGLE — preview of what's scheduled after the current film.
========================================================== */

export function initUpNextButton() {
    if (document.getElementById('sc-up-next-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'sc-up-next-btn';
    btn.textContent = 'Up Next';
    btn.title = "Preview what's playing next";
    btn.dataset.noTvCaption = '1';
    btn.addEventListener('click', () => showUpNextCard());
    const header = document.getElementById('videowrap-header');
    (header || document.body).appendChild(btn);
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
    const wrap = document.createElement('div');
    wrap.id = 'sc-usercount-btn';
    header.appendChild(wrap);

    // Two counts, ported from the desktop userscript: "Connected" (🗨) is who's actively
    // chatting, "Online" (👁) is everyone in the userlist including idle/AFK.
    const connectedBtn = document.createElement('button');
    connectedBtn.id = 'sc-usercount-connected';
    connectedBtn.className = 'sc-usercount-part';
    connectedBtn.title = 'Connected';
    wrap.appendChild(connectedBtn);

    const onlineBtn = document.createElement('button');
    onlineBtn.id = 'sc-usercount-online';
    onlineBtn.className = 'sc-usercount-part';
    onlineBtn.title = 'Online';
    wrap.appendChild(onlineBtn);

    // Create users panel
    const panel = document.createElement('div');
    panel.id = 'sc-users-panel';
    document.body.appendChild(panel);

    let activeMode = null; // 'connected' | 'online' | null
    let lastTotal = 0;

    // CyTube structure: <span>(rank icon)</span>[<span>(afk icon)</span>]<span>Name</span> --
    // idle/AFK users get an extra icon span before the name, so the username is always the
    // LAST span, not a fixed index.
    const readItemUsername = (item) => {
        const spans = item.querySelectorAll('span');
        return spans[spans.length - 1]?.textContent?.trim() || '';
    };

    const getUserItems = () => [...document.querySelectorAll('#userlist .userlist_item')];
    const sortByName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

    // "Connected" -- actively chatting, excludes idle/AFK users.
    const getConnectedUsers = () => getUserItems()
        .filter(item => !item.classList.contains('userlist_afk'))
        .map(readItemUsername)
        .filter(Boolean)
        .sort(sortByName);

    // "Online" -- everyone in the userlist, idle or not. Active users grouped first,
    // idle users after, each sorted alphabetically.
    const getOnlineUsers = () => {
        const all = getUserItems()
            .map(item => ({ name: readItemUsername(item), afk: item.classList.contains('userlist_afk') }))
            .filter(u => u.name);
        const active = all.filter(u => !u.afk).sort((a, b) => sortByName(a.name, b.name));
        const idle = all.filter(u => u.afk).sort((a, b) => sortByName(a.name, b.name));
        return [...active, ...idle];
    };

    const updateCount = (n) => {
        const connected = getConnectedUsers().length;
        // n comes from the 'usercount' socket event (a plain integer) when available.
        // Falls back to a DOM read of CyTube's own #usercount (accurate, socket-driven
        // on its own), then to our connected-only tally for the initial pre-join call.
        const total = (typeof n === 'number') ? n : (() => {
            const cytubCount = document.getElementById('usercount');
            const raw = cytubCount?.textContent?.match(/\d+/)?.[0];
            return raw ? parseInt(raw) : connected;
        })();
        lastTotal = total;
        connectedBtn.textContent = `🗨 ${connected}`;
        onlineBtn.textContent = `👁 ${total}`;
    };

    const renderPanel = () => {
        const users = activeMode === 'online'
            ? getOnlineUsers()
            : getConnectedUsers().map(name => ({ name, afk: false }));
        const headerText = activeMode === 'online' ? `${users.length} of ${lastTotal} online` : `${users.length} connected`;
        panel.innerHTML = `
            <div class="sc-users-panel-header">${headerText}</div>
            ${users.map(u => {
                const color = usernameToColor(u.name);
                const emoji = getExternalUserEmoji(u.name);
                const emojiHtml = emoji ? `<span class="sc-users-panel-emoji">${emoji}</span>` : '';
                const afkClass = u.afk ? ' sc-users-panel-afk' : '';
                return `<div class="sc-users-panel-name${afkClass}" style="color:${color}">${emojiHtml}${u.name}</div>`;
            }).join('')}
        `;
    };

    const closePanel = () => {
        panel.style.display = 'none';
        connectedBtn.classList.remove('sc-users-active');
        onlineBtn.classList.remove('sc-users-active');
        activeMode = null;
    };

    const openPanel = (mode, modeBtn) => {
        activeMode = mode;
        renderPanel();
        panel.style.display = 'block';
        connectedBtn.classList.toggle('sc-users-active', modeBtn === connectedBtn);
        onlineBtn.classList.toggle('sc-users-active', modeBtn === onlineBtn);
    };

    const handleModeClick = (mode, modeBtn) => e => {
        e.stopPropagation();
        if (activeMode === mode) closePanel();
        else openPanel(mode, modeBtn);
    };

    connectedBtn.addEventListener('click', handleModeClick('connected', connectedBtn));
    onlineBtn.addEventListener('click', handleModeClick('online', onlineBtn));

    document.addEventListener('click', e => {
        if (activeMode && !panel.contains(e.target) && !connectedBtn.contains(e.target) && !onlineBtn.contains(e.target)) {
            closePanel();
        }
    });

    // Update count and panel when userlist changes
    const ul = document.getElementById('userlist');
    if (ul) {
        new MutationObserver(() => {
            updateCount();
            if (activeMode) renderPanel();
        }).observe(ul, { childList: true, subtree: true });
    }

    // Socket-driven: CyTube emits 'usercount' with the new online total directly.
    onSocket('usercount', (n) => { updateCount(n); if (activeMode === 'online') renderPanel(); });

    updateCount();
}
