/* ==========================================================
   DOCK CLUSTER LAYOUT — the bottom-docked button row (Cast, Free-Watch,
   Subtitles, Settings, View/chat-mode) used to be N independent
   position:fixed elements, each with its own hand-computed `right: Npx`
   spaced at a 38px pitch -- fine as long as every button always existed,
   but a conditionally-absent one (no Cast on TV, no Subtitles without an
   OpenSubtitles key) left a dead gap since nothing ever closed it.

   Every .sc-dock-btn now reads its own `right` offset from a
   --sc-dock-slot custom property (0 = innermost, closest to the chat
   seam) instead of a hardcoded value; <body> carries --sc-dock-count so
   the scrubber (.vjs-control-bar) can grow into whatever space a hidden
   button frees up. This module just (re)computes those two numbers from
   whichever buttons currently exist and are visible -- see
   styles/{base,tv,overlays}.css for the calc() that consumes them.
========================================================== */

// Innermost (closest to the seam) to outermost (closest to the scrubber).
const DOCK_ORDER = ['sc-chatmode-btn', 'sc-settings-btn', 'sc-subtitles-btn', 'sc-desync-btn', 'sc-cast-btn'];

export function layoutDock() {
    let slot = 0;
    for (const id of DOCK_ORDER) {
        const el = document.getElementById(id);
        if (!el || el.classList.contains('sc-hidden')) continue;
        el.style.setProperty('--sc-dock-slot', String(slot));
        slot++;
    }
    document.body.style.setProperty('--sc-dock-count', String(slot));
}
