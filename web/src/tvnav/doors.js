// The only legal cross-zone D-pad transitions (see
// docs/superpowers/specs/2026-07-05-zone-based-tv-nav-design.md). Everything
// not listed here is a no-door direction: the caller moves within the
// current zone's own candidate list instead (geometric scoring via
// tvnav/geometry.js), never jumping zones.
//
//   [========= Top Strip (full width) =========]
//   [Control Drawer] [ Player Bar ] [   Chat   ]
export const ZONE = { TOP_STRIP: 'topstrip', DRAWER: 'drawer', PLAYER: 'player', CHAT: 'chat' };

export function resolveDoor(zone, dir, playerBarEmpty) {
    if (zone === ZONE.TOP_STRIP) {
        if (dir === 'down') return playerBarEmpty ? ZONE.CHAT : ZONE.PLAYER;
        return null;
    }
    if (zone === ZONE.DRAWER) {
        if (dir === 'up') return ZONE.TOP_STRIP;
        if (dir === 'right') return playerBarEmpty ? ZONE.CHAT : ZONE.PLAYER;
        return null;
    }
    if (zone === ZONE.PLAYER) {
        if (dir === 'up') return ZONE.TOP_STRIP;
        if (dir === 'left') return ZONE.DRAWER;
        if (dir === 'right') return ZONE.CHAT;
        return null;
    }
    if (zone === ZONE.CHAT) {
        if (dir === 'up') return ZONE.TOP_STRIP;
        if (dir === 'left') return playerBarEmpty ? ZONE.DRAWER : ZONE.PLAYER;
        return null;
    }
    return null;
}
