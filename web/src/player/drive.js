import { nativeHttpGet } from '../native.js';

/* ==========================================================
   GOOGLE DRIVE VIDEO SUPPORT
   Some items in the playlist are Google Drive videos. CyTube can
   play them but needs a privileged cross-origin fetch to
   docs.google.com (normally supplied by a Tampermonkey userscript,
   which we don't have in the app). We expose the same hooks CyTube
   looks for — window.getGoogleDriveMetadata(id, cb) plus the
   hasDriveUserscript / driveUserscriptVersion flags — backed by the
   native HTTP bridge (CORS-free). Ported from
   cytube-google-drive.user.js v1.7.0.
========================================================== */
export function initGoogleDrive() {
    const ITAG_QMAP = { 37:1080, 46:1080, 22:720, 45:720, 59:480, 44:480, 35:480, 18:360, 43:360, 34:360 };
    const ITAG_CMAP = { 43:'video/webm', 44:'video/webm', 45:'video/webm', 46:'video/webm',
                        18:'video/mp4', 22:'video/mp4', 37:'video/mp4', 59:'video/mp4',
                        35:'video/flv', 34:'video/flv' };

    // Route each stream through the native localhost media proxy (http://127.0.0.1:<port>/gd?u=…)
    // so the WebView can SEEK against a real HTTP server — shouldInterceptRequest can only stream
    // linearly, which left CyTube's sync-seek stuck on a spinner. 127.0.0.1 is a secure context,
    // so this isn't mixed-content-blocked on the https page.
    let _gdProxyBase = '';
    try {
        if (window.CytubeNative && typeof CytubeNative.gdProxyBase === 'function') {
            _gdProxyBase = CytubeNative.gdProxyBase();
        }
    } catch (e) {}
    function viaProxy(link) {
        return _gdProxyBase ? (_gdProxyBase + encodeURIComponent(link)) : link;
    }

    function mapLinks(links) {
        const videos = { 1080:[], 720:[], 480:[], 360:[] };
        Object.keys(links).forEach(function (itag) {
            itag = parseInt(itag, 10);
            if (!ITAG_QMAP.hasOwnProperty(itag)) return;
            videos[ITAG_QMAP[itag]].push({ itag: itag, contentType: ITAG_CMAP[itag], link: viaProxy(links[itag]) });
        });
        return videos;
    }

    function getVideoInfo(id, cb) {
        const url = 'https://docs.google.com/get_video_info?authuser=&docid=' + id + '&sle=true&hl=en';
        // Google binds the returned stream URL to the User-Agent that requested get_video_info
        // (the `eaua` param). The native bridge would otherwise send a Dalvik UA, which poisons
        // the stream (403 on playback). Send the browser UA — the same one the stream proxy uses.
        nativeHttpGet(url, { 'Accept': '*/*', 'User-Agent': navigator.userAgent }).then(function (res) {
            try {
                if (!res || res.status !== 200) {
                    return cb('Google Drive request failed: HTTP ' + (res ? res.status : '?'));
                }
                const text = res.body || '';
                // Google sometimes redirects to a login page when cookies are missing.
                if (/accounts\.google\.com\/ServiceLogin/.test(text)) {
                    return cb('Google Docs request failed: This video requires you be logged ' +
                        'into a Google account. Open your Gmail in another tab and then refresh video.');
                }
                const data = {};
                text.split('&').forEach(function (kv) {
                    const pair = kv.split('=');
                    data[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                });
                if (data.status === 'fail') {
                    return cb('Google Drive request failed: ' +
                        unescape(data.reason || '').replace(/\+/g, ' '));
                }
                if (!data.fmt_stream_map) {
                    return cb('Google has removed the video streams associated with this item. ' +
                        ' It can no longer be played.');
                }
                data.links = {};
                data.fmt_stream_map.split(',').forEach(function (item) {
                    const pair = item.split('|');
                    data.links[pair[0]] = pair[1];
                });
                data.videoMap = mapLinks(data.links);
                cb(null, data);
            } catch (e) {
                cb('Google Drive parse error: ' + (e && e.message ? e.message : e));
            }
        }).catch(function (e) {
            cb('Google Drive request failed: ' + (e && e.message ? e.message : 'network error'));
        });
    }

    // Install the real implementation. The native document-start stub may have already
    // set window.getGoogleDriveMetadata to a queueing shim and registered hasDriveUserscript
    // before CyTube's scripts ran; we replace it here and drain anything it queued (e.g. the
    // Drive video that was already loading when the app opened).
    window.__gdRealMeta = getVideoInfo;
    window.getGoogleDriveMetadata = getVideoInfo;
    window.hasDriveUserscript = true;
    window.driveUserscriptVersion = '1.7';
    if (Array.isArray(window.__gdQueue) && window.__gdQueue.length) {
        const queued = window.__gdQueue.splice(0);
        queued.forEach(function (p) { getVideoInfo(p[0], p[1]); });
    }
    console.log('[CyTube SC] Google Drive metadata helper ready');
}
