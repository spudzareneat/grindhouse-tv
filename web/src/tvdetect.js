// Detect TV. Prefer the authoritative native leanback flag (via the bridge);
// fall back to a screen/touch heuristic only if the bridge isn't present
// (e.g. running as a plain userscript in a browser).
export const isTv = (function () {
    try {
        if (window.CytubeNative && typeof CytubeNative.isTv === 'function') return !!CytubeNative.isTv();
    } catch (e) {}
    return window.screen.width >= 1280 && !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
})();
