import { nativeHttpGet } from './native.js';

/* ==========================================================
   APP UPDATE CHECK — compares the installed version against the
   latest GitHub Release. If newer, the settings gear is highlighted
   and the settings panel surfaces the release notes + a download link.
   Uses the native CORS-free httpGet against the public GitHub API.
========================================================== */
const LS_UPDATE_CACHE  = 'sc_update_cache'; // {ts, tag, notes, url} from the last good check
const GH_RELEASES_API  = 'https://api.github.com/repos/spudzareneat/grindhouse-tv/releases/latest';
export const GH_RELEASES_PAGE = 'https://github.com/spudzareneat/grindhouse-tv/releases/latest';
export let _updateInfo = null; // {available, current, latest, notes, url} once a check has run
let _pulsedThisSession = false; // the gear highlights+pulses once for ~30s, then retires
let _highlightRetired = false;  // after that window the gear returns to its normal color

export function _appVersion() {
    try { if (window.CytubeNative && CytubeNative.appVersion) return String(CytubeNative.appVersion() || ''); } catch (e) {}
    return '';
}
// Pull the leading numeric X.Y.Z out of a version/tag string ("v2.6", "2.5-cast-exp-debug"),
// plus a prerelease stage/number ("3.0-beta17" -> [3, 0, 0, 0, 17], "3.0-rc1" -> [3, 0, 0, 1, 1],
// "3.0" -> [3, 0, 0, 2, 0]). Stage orders beta < rc < final so e.g. "3.0-rc1" outranks every beta
// of 3.0 but a plain "3.0" still outranks the rc.
function _verTuple(s) {
    const str = String(s || '');
    const m = str.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    const beta = str.match(/beta\.?(\d+)/i);
    const rc = str.match(/\brc\.?(\d+)/i);
    let stage = 2, num = 0;
    if (beta) { stage = 0; num = +beta[1] || 0; }
    else if (rc) { stage = 1; num = +rc[1] || 0; }
    return [
        m ? (+m[1] || 0) : 0,
        m ? (+m[2] || 0) : 0,
        m ? (+m[3] || 0) : 0,
        stage,
        num,
    ];
}
export function _verNewer(a, b) { // true if a is strictly newer than b
    const x = _verTuple(a), y = _verTuple(b);
    for (let i = 0; i < 5; i++) { if (x[i] !== y[i]) return x[i] > y[i]; }
    return false;
}
// Pick the release's installable APK out of its GitHub asset list (every Grindhouse
// release carries exactly one, named grindhouse-v<version>.apk — see CLAUDE.md's
// release recap). Returns null if no .apk asset is present.
export function _pickApkAsset(assets) {
    const list = Array.isArray(assets) ? assets : [];
    const found = list.find(a => a && typeof a.name === 'string' && a.name.endsWith('.apk'));
    if (!found) return null;
    return {
        url: found.browser_download_url || null,
        size: typeof found.size === 'number' ? found.size : null,
    };
}
function _markUpdateAvailable(on) {
    const btn = document.getElementById('sc-settings-btn');
    if (!btn) return;
    if (!on) { btn.classList.remove('sc-has-update', 'sc-has-update-pulse'); return; }
    if (_highlightRetired) return; // already had its 30s — leave the gear at its normal color
    btn.classList.add('sc-has-update');
    if (!_pulsedThisSession) {
        // Highlight + pulse once for ~30s when an update is first noticed, then drop the
        // highlight entirely so it isn't an endless distraction (the update still shows in
        // the settings panel). _highlightRetired stops later checks re-applying it.
        _pulsedThisSession = true;
        btn.classList.add('sc-has-update-pulse');
        setTimeout(() => {
            _highlightRetired = true;
            const b = document.getElementById('sc-settings-btn');
            if (b) b.classList.remove('sc-has-update', 'sc-has-update-pulse');
        }, 30000);
    }
}

// Resolve the latest release and refresh _updateInfo + the gear highlight.
// force=false serves a 6h cache so launches don't hammer the API.
export async function checkForUpdate(force) {
    const current = _appVersion();
    if (!force) {
        try {
            const c = JSON.parse(localStorage.getItem(LS_UPDATE_CACHE) || 'null');
            if (c && c.ts && (Date.now() - c.ts) < 6 * 3600 * 1000) {
                _updateInfo = {
                    available: _verNewer(c.tag, current), current, latest: c.tag, notes: c.notes || '',
                    url: c.url || GH_RELEASES_PAGE, apkUrl: c.apkUrl || null, apkSize: c.apkSize || null,
                };
                _markUpdateAvailable(_updateInfo.available);
                return _updateInfo;
            }
        } catch (e) {}
    }
    const res = await nativeHttpGet(GH_RELEASES_API, {
        'User-Agent': 'GrindhouseTV-UpdateCheck',
        'Accept': 'application/vnd.github+json'
    });
    if (!res || res.status < 200 || res.status >= 300) throw new Error('release lookup failed (' + (res && res.status) + ')');
    const rel = JSON.parse(res.body || '{}');
    const tag = rel.tag_name || rel.name || '';
    const notes = rel.body || '';
    const url = rel.html_url || GH_RELEASES_PAGE;
    const apkAsset = _pickApkAsset(rel.assets);
    const apkUrl = apkAsset && apkAsset.url;
    const apkSize = apkAsset && apkAsset.size;
    try { localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify({ ts: Date.now(), tag, notes, url, apkUrl, apkSize })); } catch (e) {}
    _updateInfo = { available: _verNewer(tag, current), current, latest: tag, notes, url, apkUrl, apkSize };
    _markUpdateAvailable(_updateInfo.available);
    return _updateInfo;
}

export function initUpdateCheck() {
    // Quiet background check a few seconds after boot (throttled by the 6h cache).
    setTimeout(() => { checkForUpdate(false).catch(() => {}); }, 4000);
}
