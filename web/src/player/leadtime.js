/* ==========================================================
   MOVIE LEAD TIME — run N seconds ahead of the group's synced
   position during movies (not YouTube). Cushions against the
   user's own buffering: if playback stalls, the next mediaUpdate
   correction pushes back up to "group position + lead" instead
   of merely "group position".

   Rather than nudging video.currentTime ourselves (which would
   fight CyTube's own drift correction), an interceptor is
   prepended to the same mediaUpdate listener array chrome/buttons.js's
   Free-watch desync feature already knows how to locate (via the
   shared getMediaUpdateListeners()) — it adds the configured lead
   to the payload's currentTime before CyTube's own handler(s) see
   it, so CyTube's normal seek/smoothing logic settles the player
   the configured amount ahead. This composes with desync for free:
   freezeSync freezes whatever's registered under the mediaUpdate
   key (the interceptor, wrapping CyTube's real handlers) as one
   unit, and thawSync restores it as-is.
========================================================== */
import { getKey, setKey, LS_MOVIE_LEAD } from '../store.js';
import { isYouTubeMedia } from '../titleinject.js';
import { getMediaUpdateListeners } from '../chrome/buttons.js';

export const MOVIE_LEAD_MIN = 0, MOVIE_LEAD_MAX = 10, MOVIE_LEAD_DEFAULT = 2;

export function getMovieLeadSec() {
    const v = parseInt(getKey(LS_MOVIE_LEAD), 10);
    return (Number.isFinite(v) && v >= MOVIE_LEAD_MIN && v <= MOVIE_LEAD_MAX) ? v : MOVIE_LEAD_DEFAULT;
}

export function setMovieLeadSec(v) {
    const clamped = Math.min(MOVIE_LEAD_MAX, Math.max(MOVIE_LEAD_MIN, Number.isFinite(v) ? v : MOVIE_LEAD_DEFAULT));
    setKey(LS_MOVIE_LEAD, String(clamped));
    return clamped;
}

function installMovieLeadInterceptor() {
    const loc = getMediaUpdateListeners();
    if (!loc) { console.log('[Grindhouse] movie-lead: mediaUpdate listeners not found yet, will retry'); return false; }
    const original = loc.store === '_callbacks' ? socket._callbacks[loc.key] : socket._events[loc.key];
    const originalList = Array.isArray(original) ? original : (original ? [original] : []);
    console.log(`[Grindhouse] movie-lead: installing interceptor via ${loc.store}, wrapping ${originalList.length} existing listener(s)`);

    function interceptor(data) {
        try {
            const lead = getMovieLeadSec();
            if (lead > 0 && !isYouTubeMedia() && typeof data?.currentTime === 'number') {
                data.currentTime += lead;
            }
        } catch (e) {}
        for (const fn of originalList) fn(data);
    }

    if (loc.store === '_callbacks') socket._callbacks[loc.key] = [interceptor];
    else socket._events[loc.key] = interceptor;
    return true;
}

export function initMovieLeadOffset() {
    let tries = 0;
    const poll = setInterval(() => {
        if (typeof socket === 'undefined' || !socket) {
            if (++tries >= 14) { console.log('[Grindhouse] movie-lead: gave up, socket never became available'); clearInterval(poll); }
            return;
        }
        const ok = installMovieLeadInterceptor();
        if (ok) { console.log('[Grindhouse] movie-lead: interceptor installed successfully'); }
        if (ok || ++tries >= 14) {
            if (!ok) console.log('[Grindhouse] movie-lead: gave up after max retries, interceptor not installed');
            clearInterval(poll);
        }
    }, 1500);
}
