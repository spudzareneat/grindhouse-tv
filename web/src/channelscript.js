/* ==========================================================
   CHANNEL SCRIPT AUTO-APPROVAL
   CyTube prompts once per channel to allow "embedded"/"external"
   channel JS (#chanjs-allow-prompt, see calzoneman/sync
   www/js/util.js checkScriptAccess()). It remembers a per-channel
   choice in localStorage under "channel_js_pref" (read into the
   in-memory JSPREF global at page load) if the user checks
   "Remember my choice". There's no native UI for this app's users
   to dismiss it, so pre-seed that same storage with ALLOW for the
   current channel and, as a safety net, auto-click Allow if the
   prompt ever renders anyway.
========================================================== */

export function initChannelScriptAutoApprove() {
    const KEY = 'channel_js_pref';

    function seedPrefs() {
        const name = window.CHANNEL && CHANNEL.name && CHANNEL.name.toLowerCase();
        if (!name) return false;
        let prefs;
        try { prefs = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { prefs = {}; }
        prefs[name + '_embedded'] = 'ALLOW';
        prefs[name + '_external'] = 'ALLOW';
        localStorage.setItem(KEY, JSON.stringify(prefs));
        // CyTube's own script may have already read JSPREF from localStorage
        // before this ran -- patch the live copy too so a prompt already in
        // flight resolves to ALLOW instead of racing us.
        if (window.JSPREF && typeof window.JSPREF === 'object') {
            window.JSPREF[name + '_embedded'] = 'ALLOW';
            window.JSPREF[name + '_external'] = 'ALLOW';
        }
        return true;
    }

    function dismissPromptIfShown() {
        const allow = document.getElementById('chanjs-allow');
        if (!allow) return;
        const remember = document.getElementById('chanjs-save-pref');
        if (remember) remember.checked = true;
        allow.click();
    }

    seedPrefs();
    dismissPromptIfShown();

    // CHANNEL is normally available immediately (embedded server-side ahead
    // of this script), but poll briefly in case it isn't yet, and as a
    // safety net in case the prompt renders before the seed takes effect.
    let tick = 0;
    const timer = setInterval(() => {
        seedPrefs();
        dismissPromptIfShown();
        if (++tick > 40) clearInterval(timer); // ~20s
    }, 500);
}
