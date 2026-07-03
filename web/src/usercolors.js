/* ==========================================================
   USER COLOR SYSTEM
========================================================== */

// djb2-xor hash — better bit spread than the old additive hash, so similar names
// (e.g. "mike"/"mikey") don't land on near-identical hues.
export function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) ^ str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
}
export function usernameToColor(u) {
    // Your own name is always a fixed baby blue so it stands out at a glance.
    try { if (window.CLIENT && CLIENT.name && u === CLIENT.name) return 'hsl(197, 90%, 78%)'; } catch (e) {}
    // Golden-angle stepping (×137.508°) spreads hues as far apart as possible, so
    // distinct usernames get visibly distinct colors instead of clustering.
    const hue = (hashString(u) * 137.508) % 360;
    return `hsl(${hue.toFixed(1)}, 72%, 70%)`;
}
