/* ==========================================================
   API KEYS — stored in localStorage, managed via settings modal.
   Keys are never hard-coded; the settings modal handles first-run.
========================================================== */
import { getSetting } from './settings/schema.js';

export const LS_TMDB       = 'sc_tmdb_key';
export const LS_OPENSUBTITLES = 'sc_opensubtitles_key';
export const LS_SUBTITLE_CACHE = 'sc_subtitle_cache_v1'; // downloaded SRT cues by imdbId, so a restart doesn't re-spend a download
export const LS_ONBOARDED  = 'sc_onboarded';  // set once the settings have been shown on first launch
export const LS_SPELLCHECK = 'sc_spellcheck'; // 'off' to disable, anything else = enabled
export const LS_CHAT_FONT  = 'sc_chat_fontsize';
export const LS_AUTOEMBED  = 'sc_autoembed_images'; // 'off' to disable auto-embedding chat image links
export const LS_MOVIE_LEAD = 'sc_movie_lead_sec'; // seconds to run ahead of sync during movies (not YouTube); 0 = off
export const LS_COUCH      = 'sc_couch_mode'; // 'on' = chat input grows big & readable while typing
export const LS_WATCHALONG = 'sc_watch_along'; // 'on' = hide the chat input + guest login (read-only)
export const LS_CAST_MUTE  = 'sc_cast_fallback_mute'; // 'on' = mute fallback (YouTube) playback on this device while casting
export const LS_LINEUP_TIMING = 'sc_lineup_timing'; // 'on' = Experimental: live NOW PLAYING/ETA tracking for the lineup; off by default
export const LS_TRIVIA_POPUP  = 'sc_trivia_popup'; // 'on' = Experimental: ambient pop-up IMDb trivia bubbles during movies; off by default
export const LS_TRIVIA_POPUP_FREQ = 'sc_trivia_popup_freq'; // 'frequent' | 'occasional' | 'rare' -- how often pop-up trivia bubbles appear
export const LS_SUBTITLE_OPACITY   = 'sc_subtitle_opacity';   // 0.2-0.9 background opacity of each subtitle pill
export const LS_SUBTITLE_FONTSIZE  = 'sc_subtitle_fontsize';  // px, separate from the sidebar chat's own font size
export const LS_SUBTITLE_LINES     = 'sc_subtitle_lines';     // 1-3, how many recent messages stay on screen
export const getKey   = id => localStorage.getItem(id) || '';
export const setKey   = (id, v) => localStorage.setItem(id, v.trim());
export const hasKey   = id => !!getKey(id);
// Thin wrappers over settings/schema.js's typed DEFS — same names/signatures as
// before so every existing call site keeps working unchanged; storage keys and
// their on/off/'' representations are byte-identical (schema.js just documents
// and normalizes what these already did).
export const spellCheckEnabled = () => getSetting('spellcheck');
export const autoEmbedEnabled  = () => getSetting('autoEmbed');
export const couchModeEnabled  = () => getSetting('couchMode');
export const watchAlongEnabled = () => getSetting('watchAlong');
export const castFallbackMuted = () => getSetting('castMute'); // default: unmuted
export const lineupTimingEnabled = () => getSetting('lineupTiming'); // Experimental; default: off
export const triviaPopupEnabled  = () => getSetting('triviaPopup');  // Experimental; default: off
export const triviaPopupFrequency = () => getSetting('triviaPopupFreq'); // 'frequent' | 'occasional' | 'rare'; default: 'occasional'
