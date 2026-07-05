// Cone-weighted nearest-neighbor scoring for D-pad spatial navigation, scoped
// to whatever candidate list the caller passes in (a single zone, an open
// overlay, an open video.js menu). Operates on plain rects so it needs no DOM
// and is unit-testable directly.
//
// Two tiers: a candidate within 45 degrees of the pressed direction
// (primary >= perp) always beats one off to the side, however close the
// latter scores raw. Without this, Right from a mute button can pick a
// settings gear a few pixels closer but a whole cluster-height above, instead
// of the button dead ahead across the same control bar.
export function pickDirectional(dir, curRect, rects) {
    const cx = curRect.left + curRect.width / 2, cy = curRect.top + curRect.height / 2;
    let best = -1, bestScore = Infinity, cone = -1, coneScore = Infinity;
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r) continue;
        const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
        let primary, perp;
        if (dir === 'left')       { if (dx > -4) continue; primary = -dx; perp = Math.abs(dy); }
        else if (dir === 'right') { if (dx < 4)  continue; primary = dx;  perp = Math.abs(dy); }
        else if (dir === 'up')    { if (dy > -4) continue; primary = -dy; perp = Math.abs(dx); }
        else                      { if (dy < 4)  continue; primary = dy;  perp = Math.abs(dx); }
        const score = primary + perp * 2;
        if (primary >= perp && score < coneScore) { coneScore = score; cone = i; }
        if (score < bestScore) { bestScore = score; best = i; }
    }
    return cone !== -1 ? cone : best;
}
