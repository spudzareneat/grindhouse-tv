/* ==========================================================
   API KEYS — stored in localStorage, managed via settings modal.
   Keys are never hard-coded; the settings modal handles first-run.
========================================================== */
import { getSetting } from './settings/schema.js';

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
// Thin wrappers over settings/schema.js's typed DEFS — same names/signatures as
// before so every existing call site keeps working unchanged; storage keys and
// their on/off/'' representations are byte-identical (schema.js just documents
// and normalizes what these already did).
export const spellCheckEnabled = () => getSetting('spellcheck');
export const movieLinksEnabled = () => getSetting('movieLinks');
export const couchModeEnabled  = () => getSetting('couchMode');
export const watchAlongEnabled = () => getSetting('watchAlong');
export const castFallbackMuted = () => getSetting('castMute'); // default: unmuted
