// Storage stays legacy-compatible; normalization lives here.
const DEFS = {
    tmdbKey:      { key: 'sc_tmdb_key',           type: 'string', def: '' },
    onboarded:    { key: 'sc_onboarded',          type: 'flag',   def: false },          // set = true
    spellcheck:   { key: 'sc_spellcheck',         type: 'offbool', def: true },          // 'off' disables
    movieLinks:   { key: 'sc_movie_links',        type: 'offbool', def: true },
    autoEmbed:    { key: 'sc_autoembed_images',   type: 'offbool', def: true },          // 'off' disables
    chatFontSize: { key: 'sc_chat_fontsize',      type: 'string', def: '' },
    movieLead:    { key: 'sc_movie_lead_sec',     type: 'string', def: '' },             // clamped 0-10 in player/leadtime.js, like chatFontSize
    couchMode:    { key: 'sc_couch_mode',         type: 'onbool', def: false },          // 'on' enables
    watchAlong:   { key: 'sc_watch_along',        type: 'onbool', def: false },
    castMute:     { key: 'sc_cast_fallback_mute', type: 'onbool', def: false },
    lineupTiming: { key: 'sc_lineup_timing',      type: 'onbool', def: false },          // Experimental; off by default
    chatMode:     { key: 'sc_chat_mode',          type: 'string', def: 'sidebar' },
    vertSplit:    { key: 'sc_vert_split',         type: 'number', def: 50 },
    updateCache:  { key: 'sc_update_cache',       type: 'json',   def: null },
};
export function getSetting(n) {
    const d = DEFS[n]; const raw = localStorage.getItem(d.key);
    if (raw === null || raw === '') return d.def;
    if (d.type === 'offbool') return raw !== 'off';
    if (d.type === 'onbool') return raw === 'on';
    if (d.type === 'flag') return true;
    if (d.type === 'number') { const num = parseFloat(raw); return Number.isFinite(num) ? num : d.def; }
    if (d.type === 'json') { try { return JSON.parse(raw); } catch { return d.def; } }
    return raw;
}
export function setSetting(n, v) {
    const d = DEFS[n];
    if (d.type === 'offbool') return localStorage.setItem(d.key, v ? 'on' : 'off');
    if (d.type === 'onbool') return localStorage.setItem(d.key, v ? 'on' : '');
    if (d.type === 'flag') return localStorage.setItem(d.key, '1');
    if (d.type === 'json') return localStorage.setItem(d.key, JSON.stringify(v));
    localStorage.setItem(d.key, String(v).trim());
}
