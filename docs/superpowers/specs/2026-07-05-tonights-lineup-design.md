# Tonight's Lineup Screen — Design

**Status:** Approved 2026-07-05. Implements the "Tonight's Lineup screen" item of Phase 3,
`docs/redesign-vision.md`.

## Problem

The room's nightly schedule lives on Letterboxd, and a plain viewer can't see the playlist itself
(`seeplaylist: 2`), only what's currently playing and rough queue totals. There's no in-app way to
see "what's on tonight and roughly when" — the vision doc scoped a full-screen, D-pad-navigable
answer to that, backed by a Letterboxd fetch + an estimated (not exact) timing model.

Context for this design's sequencing: two prior TV-interaction redesigns in this project (zone-based
D-pad nav, landscape control-cluster seam-anchoring) were fully built, device-tested, and code-reviewed
before being rejected on-feel once tried live on the TV. This is a new full-screen TV surface, so the
same risk applies. This design deliberately splits into a fake-data prototype stage (validate feel)
before a real-data stage (validate correctness), rather than building both at once.

## Goals

- A full-screen TV view of tonight's lineup, opened from the existing Coming Attractions poster strip.
- Reuse the poster strip's existing Left/Right paging gesture at full-screen scale, so the interaction
  model is continuous with something the user already navigates today — not a new spatial model.
- Validate the screen's on-TV feel with fake data before writing any Letterboxd/timing pipeline code.
- Estimated (not exact) per-film times, with honest precision decay, per the vision doc's timing model.
- Zero change to phone/tablet layouts — this is a TV-only screen (`isTv` gated), matching every other
  TV-nav concept in the codebase.

## Non-goals

- No changes to the existing poster strip's own internal layout/hover-zoom code, beyond changing what
  its OK handler does.
- No changes to the Now-Playing card renderer itself — only a new caller (browse mode from within this
  screen), reusing it as-is per the vision doc ("the card renderer decouples from 'currently playing'").
- No exact scheduling, no server component, no persistence of the fetched list beyond the app session.

## Design

### Modules

New directory `web/src/lineup/`, following the Phase 1 modularization convention (one concern per
file, bundled via the existing esbuild pipeline):

- **`lineup/screen.js`** — full-screen rail renderer + D-pad wiring. Registered in `tvnav.js` as an
  `OVERLAY_IDS`-trapped overlay (like settings/trivia): Left/Right page through the rail using the
  existing cone-weighted scorer scoped to just this screen's candidates; OK on a film opens the
  Now-Playing card in browse mode; Back closes the screen and restores focus to the poster that opened
  it (reusing the existing `restoreFocusAfterOverlayClose` machinery from Phase 2).
- **`lineup/data.js`** — the one interface the screen consumes: `getTonightsLineup()` →
  `{ items: [{ title, poster, eta, precision, isNowPlaying }] }`. `precision` is one of
  `'exact' | 'approx' | 'late'`, matching the vision doc's ≈ / ~ / LATE decay. **Stage 0** implements
  this with a hardcoded fixture. **Stage 1** replaces the implementation; `screen.js` does not change.
- **`lineup/letterboxd.js`** (Stage 1 only) — fetches `letterboxd.com/420grindhouse/lists/` with a
  browser UA via the existing native HTTP bridge, finds the current week via the `grindhouse-schedule`
  slug match, parses titles+years out of the list page's `<meta name="description">`.
- **`lineup/timing.js`** (Stage 1 only) — the ETA model: TMDB-match the current item via the existing
  `parseMovieFilename`/TMDB pipeline to find where "now" sits in the list; TMDB runtimes for future
  features; a running median bumper-gap learned from `changeMedia` items that don't match the list;
  re-anchor on every `changeMedia`, freeze while paused (all per the vision doc's already-verified
  model).

### Entry point

The poster strip's existing OK handler (`posters.js`, Phase 1's `POSTER STRIP` module) changes from
hover-zoom-only to opening `lineup/screen.js`, landing the rail's initial focus on the pressed poster's
position. Hover-zoom-on-focus (not OK) is unchanged.

### Data flow & staging

**Stage 0 — fake-data prototype.** `data.js` returns ~6 fixture entries chosen to exercise every
visual state on the real TV: one `isNowPlaying`, one `exact`, one `approx`, one `late`. `screen.js`,
the `tvnav.js` overlay wiring, and the poster-strip entry point are all real, production code — nothing
here is deleted in Stage 1, only `data.js`'s implementation is swapped.

> **Device checkpoint — stop and confirm feel before Stage 1.** Load the fixture, open from the poster
> strip, D-pad across the full rail, OK into the Now-Playing card, Back out twice (card, then screen).
> Do not proceed to Stage 1 without explicit go-ahead.

**Stage 1 — real pipeline.** On the first poster-strip open of the session, fetch and parse the
Letterboxd list (cached in memory for the rest of the session — no refetch on subsequent Lineup
opens). Merge with live `changeMedia` / `mediaUpdate` / `setPlaylistMeta` socket data for timing.
`data.js` now calls `letterboxd.js` + `timing.js` instead of returning the fixture.

### Error handling

- Letterboxd fetch fails or times out → fall back to a Now/Next-only view built purely from
  `changeMedia` (structurally the same shape `data.js` returned in Stage 0, just derived from live
  data instead of a fixture) — per the vision doc's specified fallback. Never blocks the screen from
  opening.
- A parsed title fails to TMDB-match → show the cleaned filename with no poster art; still show its
  estimated time if its position in the queue is known from bumper-gap learning.
- Empty rail (fetch failed AND no live data yet, e.g. right at app start) → screen shows a single
  "Fetching tonight's lineup…" placeholder card rather than opening to nothing.

### Testing

- `node:test` characterization tests (Phase 1 style — real inputs, hard-coded expected outputs) for
  the pure functions in `timing.js`: the precision-decay classifier and the bumper-gap median
  calculation; and in `letterboxd.js`: the current-week-slug matcher and the meta-description title
  parser (using a saved sample page fragment as fixture input).
- `screen.js`'s D-pad/overlay wiring gets device smoke only, matching how the rest of `tvnav.js` is
  tested today.

### Device checkpoints

1. **End of Stage 0** — hard stop, fake data, full D-pad/OK/Back pass, explicit go-ahead required.
2. **End of Stage 1** — full pipeline against the live room, fallback path forced (e.g. by simulating
   a fetch failure), plus the existing Phase 1/2 smoke list to confirm no regressions elsewhere.
