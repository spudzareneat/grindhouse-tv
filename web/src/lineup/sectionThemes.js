/* ==========================================================
   TONIGHT'S LINEUP -- per-section font + color theme.
   Each of the 9 recurring section names (a slow-changing, closed set) gets
   its own Google Font + accent color, tying a grouping's header and its
   background wash together. Fonts are loaded once via a single combined
   Google Fonts CSS2 request (ensureThemeFontsLoaded()) -- an ordinary https
   resource fetched by the WebView's own <link> handling, unlike the
   file:///android_asset/ background-art approach this replaces (which
   Chromium blocks outright as a sub-resource on an https-loaded page).
========================================================== */

const THEMES = {
    'funky-cheese-friday':          { font: 'Boogaloo',           color: '#e0a92a', wash: '#2b210a' },
    'friday-grindhouse-a-go-go':    { font: 'Chewy',               color: '#ec4899', wash: '#2a0e1c' },
    'friday-night-freak-show':      { font: 'Creepster',           color: '#52c41a', wash: '#0f2109' },
    'psychedelic-saturday':         { font: "'Rubik Wet Paint'",   color: '#a855f7', wash: '#200c2b' },
    'saturday-prime-time-drive-in': { font: 'Monoton',             color: '#22d3ee', wash: '#06232a' },
    'red-light-saturday-night':     { font: "'Vast Shadow'",       color: '#ef4444', wash: '#2b0a0a' },
    'the-sunday-classics':          { font: 'Cinzel',              color: '#9f2b4a', wash: '#200810' },
    'sunday-slop-o-rama':           { font: 'Eater',               color: '#a3b125', wash: '#1c1f08' },
    'last-call-sunday-night':       { font: "'Bungee Shade'",      color: '#6366f1', wash: '#12102b' },
};

// Any future/unrecognized section name (the mod renaming or adding a block) falls back to
// the app's normal font and a neutral wash, rather than an unstyled or broken-looking block.
const DEFAULT_THEME = { font: null, color: '#9aa0a8', wash: '#14141a' };

export function getSectionTheme(slug) {
    return THEMES[slug] || DEFAULT_THEME;
}

const FONT_FAMILIES = ['Boogaloo', 'Chewy', 'Creepster', 'Rubik+Wet+Paint', 'Monoton', 'Vast+Shadow', 'Cinzel', 'Eater', 'Bungee+Shade'];
const FONTS_LINK_ID = 'sc-lineup-theme-fonts';

// Idempotent -- safe to call on every showLineupScreen(); only injects the <link> once per
// page load (checked by id, not a module-level flag, so it survives module re-evaluation).
export function ensureThemeFontsLoaded() {
    if (document.getElementById(FONTS_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONTS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONT_FAMILIES.map(f => `family=${f}`).join('&')}&display=swap`;
    document.head.appendChild(link);
}
