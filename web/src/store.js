/* ==========================================================
   API KEYS — stored in localStorage, managed via settings modal.
   Keys are never hard-coded; the settings modal handles first-run.
========================================================== */
export const LS_TMDB       = 'sc_tmdb_key';
export const LS_ONBOARDED  = 'sc_onboarded';  // set once the settings have been shown on first launch
export const LS_SPELLCHECK = 'sc_spellcheck'; // 'off' to disable, anything else = enabled
export const LS_CHAT_FONT  = 'sc_chat_fontsize';
export const LS_MOVIE_LINKS = 'sc_movie_links'; // 'off' to hide IMDb/Letterboxd/Wiki links
export const LS_COUCH      = 'sc_couch_mode'; // 'on' = chat input grows big & readable while typing
export const LS_WATCHALONG = 'sc_watch_along'; // 'on' = hide the chat input + guest login (read-only)
export const LS_CAST_MUTE  = 'sc_cast_fallback_mute'; // 'on' = mute fallback (YouTube) playback on this device while casting
export const getKey   = id => localStorage.getItem(id) || '';
export const setKey   = (id, v) => localStorage.setItem(id, v.trim());
export const hasKey   = id => !!getKey(id);
export const spellCheckEnabled = () => getKey(LS_SPELLCHECK) !== 'off';
export const movieLinksEnabled = () => getKey(LS_MOVIE_LINKS) !== 'off';
export const couchModeEnabled  = () => getKey(LS_COUCH) === 'on';
export const watchAlongEnabled = () => getKey(LS_WATCHALONG) === 'on';
export const castFallbackMuted = () => getKey(LS_CAST_MUTE) === 'on'; // default: unmuted
