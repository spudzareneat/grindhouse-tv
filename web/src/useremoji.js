/* ==========================================================
   USER EMOJI PREFIXES
   The channel runs its own userscript (loaded as channel JS, see
   channelscript.js) that defines a `userStyles` map of
   `{ username: [emoji, color] }`. Rather than keeping a second copy
   in this app that drifts out of sync, read that map live off the
   channel -- colors are skipped since usercolors.js already assigns
   everyone a color via hash, only the emoji is pulled in.

   CyTube's client inserts embedded channel JS via jQuery's
   `.text().appendTo()` (see channelCSSJS in calzoneman/sync's
   www/js/callbacks.js), which runs the script through jQuery's
   DOMEval wrapper -- confirmed on-device that this does NOT leak
   the script's top-level `const`/`let` bindings onto the real page
   global object, only into closures the script itself creates (its
   own addUserStyles() can see userStyles, nothing outside it can).
   So `userStyles` can't be read as a global. `CHANNEL.js` (the raw
   source text CyTube keeps regardless of that scoping quirk) can --
   parse the object literal back out of it instead.
========================================================== */
let _cachedSourceText = null;
let _cachedStyles = null;

function parseUserStyles(jsText) {
    const m = jsText.match(/const\s+userStyles\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    try {
        const obj = new Function('return (' + m[1] + ')')();
        return (obj && typeof obj === 'object') ? obj : null;
    } catch (e) {
        return null;
    }
}

export function getExternalUserEmoji(username) {
    const jsText = window.CHANNEL && CHANNEL.js;
    if (!jsText) return null;
    if (jsText !== _cachedSourceText) {
        _cachedSourceText = jsText;
        _cachedStyles = parseUserStyles(jsText);
    }
    if (!_cachedStyles) return null;
    const entry = _cachedStyles[username];
    if (Array.isArray(entry)) return entry[0] || null;
    if (typeof entry === 'string') return entry;
    return null;
}
