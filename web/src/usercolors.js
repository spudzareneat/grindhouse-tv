/* ==========================================================
   USER COLOR SYSTEM
========================================================== */
import { getExternalUserColor } from './useremoji.js';

// djb2-xor hash — better bit spread than the old additive hash, so similar names
// (e.g. "mike"/"mikey") don't land on near-identical hues.
export function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) ^ str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
}
export function usernameToColor(u) {
    // Golden-angle stepping (×137.508°) spreads hues as far apart as possible, so
    // distinct usernames get visibly distinct colors instead of clustering.
    const hue = (hashString(u) * 137.508) % 360;
    return `hsl(${hue.toFixed(1)}, 72%, 70%)`;
}

// Single source of truth for "what color is this username" (ported from the
// userscript's resolveUserColor): the channel script's hand-picked userStyles
// color first, else our hash color -- so chat, the users list and subtitle mode
// all agree.
export function resolveUserColor(u) {
    return getExternalUserColor(u) || usernameToColor(u);
}
