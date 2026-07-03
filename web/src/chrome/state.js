// Shared "auto-hide chrome" state — the top bar, left/right edge reveal drawers,
// and the TV remote's chrome-wake re-armer all read/write this from several
// otherwise-independent modules (posters, chrome buttons, TV nav).
export const chromeState = {
    topBarWake: null,        // wake fn set by initTopBar; called to un-dim the top bar
    topBarIsOpen: false,     // true while the poster strip (or similar) holds the bar open
    leftZoneReveal: null,    // expose so video-tap can trigger both chrome systems together
    rightZoneReveal: null,   // vertical-mode right-edge drawer
    chromeWake: null,        // re-arms the TV chrome auto-hide (remote keys bypass DOM events)
};
