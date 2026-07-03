/* ==========================================================
   NATIVE HTTP (CORS-free) — used for API-key validation and
   any API that doesn't send CORS headers. Falls back gracefully
   when the native bridge isn't present.
========================================================== */
const _scHttpCbs = {};
window.__scHttpResolve = function (id, res) {
    const cb = _scHttpCbs[id];
    if (cb) { delete _scHttpCbs[id]; cb(res); }
};
export function nativeHttpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        if (!(window.CytubeNative && typeof CytubeNative.httpGet === 'function')) {
            reject(new Error('native http unavailable'));
            return;
        }
        const id = 'h' + Math.random().toString(36).slice(2);
        _scHttpCbs[id] = (res) => {
            if (res && res.error) reject(new Error(res.error));
            else resolve(res);
        };
        try { CytubeNative.httpGet(id, url, JSON.stringify(headers)); }
        catch (e) { delete _scHttpCbs[id]; reject(e); }
        // Timeout guard
        setTimeout(() => {
            if (_scHttpCbs[id]) { delete _scHttpCbs[id]; reject(new Error('timeout')); }
        }, 10000);
    });
}
