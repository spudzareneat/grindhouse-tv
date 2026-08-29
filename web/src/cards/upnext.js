/* ==========================================================
   UP NEXT CARD — embeds the channel's own "CyTube Schedule & Queue" bot
   dashboard (bot.420grindhouseserver.com), matching the desktop
   userscript's up-next module exactly. This is NOT derived from the
   Tonight's Lineup/Reddit schedule data (that's Coming Attractions, a
   separate feature) -- CyTube's native playlist queue turned out, per the
   userscript's own live testing, to not be what's actually useful here;
   the community bot's dashboard is the real "what's coming up" source.

   The bot's cross-origin content can't be D-pad-focused (a real iframe
   limitation, same as the desktop userscript's own mouse/keyboard-only
   experience with it) -- what IS D-pad reachable is this app's own chrome
   around it: the trigger button (MAIN_IDS) and the close button
   (OVERLAY_IDS), same as every other card in this app.
========================================================== */

const UPNEXT_BOT_URL = 'https://bot.420grindhouseserver.com';
const UPNEXT_LOAD_TIMEOUT_MS = 10000;

let _frameCreated = false;

// Lazy-created on first open rather than eagerly at boot, so a viewer who
// never opens the panel never pays for a background iframe load. Races the
// iframe's own load event against a timeout and falls back to an error
// message if neither a real load nor content shows up in time -- a
// cross-origin frame gives no other reliable "is it up" signal.
function ensureFrame(body) {
    if (_frameCreated) return;
    _frameCreated = true;

    const iframe = document.createElement('iframe');
    iframe.id = 'sc-upnext-frame';
    iframe.title = 'Upcoming queue';
    iframe.style.display = 'none';

    let settled = false;
    const showFrame = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        body.querySelector('.sc-upnext-loading')?.remove();
        iframe.style.display = 'block';
    };
    const showError = () => {
        if (settled) return;
        settled = true;
        body.innerHTML = '<div class="sc-upnext-error">Schedule unavailable right now.</div>';
    };
    iframe.addEventListener('load', showFrame);
    iframe.addEventListener('error', showError);
    const timeoutId = setTimeout(showError, UPNEXT_LOAD_TIMEOUT_MS);

    iframe.src = UPNEXT_BOT_URL;
    body.appendChild(iframe);
}

export function showUpNextCard() {
    let card = document.getElementById('sc-upnext-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'sc-upnext-card';
        card.innerHTML = `
            <div id="sc-upnext-head">
                <span>Up Next</span>
                <button id="sc-upnext-close" type="button">✕</button>
            </div>
            <div id="sc-upnext-body"><div class="sc-upnext-loading">Loading…</div></div>`;
        document.body.appendChild(card);
        card.querySelector('#sc-upnext-close').addEventListener('click', hideUpNextCard);
    }
    card.classList.add('sc-upnext-visible');
    ensureFrame(card.querySelector('#sc-upnext-body'));
}

export function hideUpNextCard() {
    document.getElementById('sc-upnext-card')?.classList.remove('sc-upnext-visible');
}
