# Portrait header cleanup: robust title truncation + icon buttons

**Date:** 2026-07-16
**Status:** Approved

## Problem

On phone in portrait (`body.sc-vertical`), two bugs in the title header:

1. **Coming Attractions button drifts over the video.** It's positioned via
   `position:fixed; top: env(safe-area-inset-top, 0px)` (in the
   `@media (max-width: 540px)` block in `web/src/styles/base.css`), while
   `#videowrap-header` right next to it stays pinned at `top: 0` with no such
   inset. On phones that report a nonzero `safe-area-inset-top` (status bar
   height under an edge-to-edge WebView), the button detaches visually from
   the header and lands inside the video frame. Confirmed via a live
   screenshot — what looked like our button overlapping the video was
   actually the movie's own trailer-reel bumper graphic, but investigating it
   surfaced this real, reproducible-by-CSS-inspection bug.
2. **Trivia button is simply `display: none` in portrait** (`web/src/styles/tv.css`,
   comment: "title bar is too narrow") — never given a portrait layout at all.

Both buttons use independent `position:fixed` + hand-computed viewport math
(`top`, `right: calc(20vw + 150px)`, `env(...)`) instead of participating in
the header's actual DOM flow. The IMDb/Letterboxd/Wikipedia link badges
(`#sc-movie-links`) don't have this problem because they're genuine DOM
children of the header, laid out inline — that's the pattern to extend to
the other two buttons.

There's a secondary, related risk: because the header today is a single
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis` block
containing the title text followed by the badges, a long title can crowd out
or clip the badges themselves (no guaranteed truncation boundary between
"title" and "everything after it").

## Fix

### 1. Flex-row header restructure (`body.sc-vertical`, all widths)

`#videowrap-header` becomes a real flex container in portrait:

```css
body.sc-vertical #videowrap-header {
    display: flex;
    align-items: center;
    gap: 6px;
}
body.sc-vertical #videowrap-header .pull-left {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
body.sc-vertical #sc-movie-links,
body.sc-vertical #sc-trivia-btn,
body.sc-vertical #sc-poster-toggle {
    position: static;
    flex-shrink: 0;
}
```

`.pull-left` is CyTube's native title container and is already one of the
elements `titleinject.js` targets/queries directly
(`document.querySelector('#videowrap-header .pull-left')`), so no JS change
is needed to identify or wrap the title text — the truncation boundary falls
out of giving `.pull-left` its own `flex: 1; min-width: 0` box. This is what
"caps the title length": the title shrinks and ellipsizes, the badges and
buttons after it never move or get clipped, on any title length.

`#sc-movie-links` is already inserted as a sibling of `.pull-left` inside
`#videowrap-header` (`titleinject.js`, `injectMovieLinks`), and `#sc-trivia-btn`
is already appended into `#videowrap-header` (`cards/nowplaying.js`,
`bindTitle`) — both already live in the right DOM location for this to work
with zero JS changes.

`#sc-poster-toggle` is the one exception: `posters.js` currently does
`document.body.appendChild(toggleBtn)`. Change this to append into
`#videowrap-header` instead (fall back to `document.body` if the header
isn't in the DOM yet, matching existing defensive style elsewhere in the
codebase). This is safe for landscape/TV too — `position: fixed` geometry is
computed against the viewport regardless of DOM parent (no ancestor between
header and body sets `transform`/`filter`/`contain`, which are the only
things that would change a fixed element's containing block) — so
`sc-horizontal`/`sc-tv` styling, which keeps `position: fixed` with the
existing `top`/`right` overlay math, is unaffected by the reparent.

The `position: static; flex-shrink: 0` overrides above only apply under
`body.sc-vertical`, so this override is scoped correctly — landscape and TV
keep their current fixed-overlay CSS untouched.

### 2. Icon-only buttons, scoped to phone width only

Inside the existing `@media (max-width: 540px), (max-height: 540px)` phone
breakpoint (`base.css`), under `body.sc-vertical`:

- `#sc-poster-toggle`: replace the `"Coming Attractions"` text content with
  🍿 (popcorn emoji), drop `text-transform`/`letter-spacing` styling that
  only made sense for text, size as a ~32×32px tap target, keep
  `title="Show tonight's lineup"` for accessibility/long-press tooltip.
- `#sc-trivia-btn`: replace `"Trivia"` text content with 💡 (lightbulb
  emoji), same ~32×32px sizing, keep a `title=` tooltip attribute (e.g.
  `"Trivia"`).

Order left-to-right after the title: badges (i/L/W) → 💡 Trivia → 🍿 Coming
Attractions.

Tablet-width portrait (`sc-vertical` outside the ≤540px breakpoint) keeps the
current text labels — it has room, and the reported bug is phone-specific.
The flex-row structural fix from step 1 still applies at tablet width (it's
what prevents this class of positioning bug everywhere), only the icon glyph
swap is phone-only.

Existing behavior preserved unchanged: `.sc-bar-dim` opacity fade/dim-on-idle
handling (class-based, unaffected by `position: static` vs `fixed`), Trivia's
conditional creation (only once `npState.data.imdbId` is known — still
`display:none` → now just "not yet appended" for phones without a resolved
movie), click handlers, and the existing `data-noTvCaption` markers.

### Out of scope

- Landscape (`sc-horizontal`), TV (`sc-tv`), and PiP/cast layouts — no
  changes.
- Tablet-width portrait icon-ification (explicitly deferred; text labels
  stay).
- TV remote nav (`tvnav.js` `MAIN_IDS`) — both buttons are already TV-nav
  targets; reparenting into the header does not change their `id`s or click
  handlers, so no `tvnav.js` changes are anticipated. Verify during
  implementation that focus-ring geometry (`tvnav/geometry.js`, if it reads
  bounding boxes) still resolves correctly now that the elements are in
  normal flow instead of `position: fixed` — TV never sets `sc-vertical`, so
  this is a belt-and-suspenders check, not an expected behavior change.

## Testing

No phone device is attached this session (only the TV box). Implementation
must be verified against a real phone in portrait — screenshot or live
on-device check — before considering this shippable, per the pattern used
for the "Bottom-sheet chat split" work (memory:
`vsplit-bottom-sheet-shipped` — bugs there were only caught via live
non-default-state testing).
