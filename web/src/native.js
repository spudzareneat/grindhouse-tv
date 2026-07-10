/* ==========================================================
   NATIVE HTTP (CORS-free) — used for API-key validation and
   any API that doesn't send CORS headers. Falls back gracefully
   when the native bridge isn't present.
========================================================== */
const _scHttpCbs = {};
if (typeof window !== 'undefined') {
    window.__scHttpResolve = function (id, res) {
        const cb = _scHttpCbs[id];
        if (cb) { delete _scHttpCbs[id]; cb(res); }
    };
}
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

/* ==========================================================
   APP UPDATE INSTALL — download the release APK and launch the
   system installer. Progress arrives as repeated ticks (not a
   single resolve) via window.__scUpdateProgress.
========================================================== */
const _scUpdateCbs = {};
if (typeof window !== 'undefined') {
    window.__scUpdateProgress = function (id, tick) {
        const cb = _scUpdateCbs[id];
        if (cb) cb(tick);
        if (tick && (tick.phase === 'installing' || tick.phase === 'error')) delete _scUpdateCbs[id];
    };
}

export function canInstallUpdates() {
    try { return !!(window.CytubeNative && CytubeNative.canInstallUpdates && CytubeNative.canInstallUpdates()); }
    catch (e) { return false; }
}

export function requestInstallPermission() {
    try { if (window.CytubeNative && CytubeNative.requestInstallPermission) CytubeNative.requestInstallPermission(); }
    catch (e) {}
}

export function nativeDownloadAndInstall(url, onProgress) {
    return new Promise((resolve, reject) => {
        if (!(window.CytubeNative && typeof CytubeNative.downloadAndInstallUpdate === 'function')) {
            reject(new Error('native update install unavailable'));
            return;
        }
        const id = 'u' + Math.random().toString(36).slice(2);
        _scUpdateCbs[id] = (tick) => {
            if (onProgress) onProgress(tick);
            if (tick.phase === 'installing') resolve(tick);
            else if (tick.phase === 'error') reject(new Error(tick.error || 'download failed'));
        };
        try { CytubeNative.downloadAndInstallUpdate(id, url); }
        catch (e) { delete _scUpdateCbs[id]; reject(e); }
    });
}
