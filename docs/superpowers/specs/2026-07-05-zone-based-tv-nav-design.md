# Zone-Based TV D-Pad Navigation — Design

**Status:** Approved 2026-07-05. Implements Phase 2 of `docs/redesign-vision.md` ("zone-based TV navigation").

## Problem

`web/src/tvnav.js`'s `initTvNav()` currently scores **every** visible candidate on the page against
the pressed direction using a single cone-weighted geometric distance function (`move()` in the
current code), then falls back to a plain nearest-candidate score if nothing is in the 45° cone.
This has produced a recurring bug class: a button in one part of the page can out-score the
"obviously correct" target in another, because geometry alone doesn't know the two buttons belong
to conceptually unrelated UI regions. The CC/quality reachability fix (merged via PR #1, prior to
this refactor) was a symptom — Right from the mute button was landing on the settings gear instead
of the CC button, purely because the gear was a few pixels closer in one direction despite sitting
in an entirely different part of the screen.

## Goals

- Eliminate the geometry-across-unrelated-regions bug class structurally, not with more special
  cases layered on the existing whole-page scorer.
- Preserve the geometric cone-scoring algorithm where it already works well: **within** a small,
  well-defined region of related controls.
- Zero change to non-TV (phone/tablet) behavior — this only touches `initTvNav()`'s D-pad model.
- Small, testable improvement: Back-from-overlay restores focus to whatever opened it, instead of
  clearing focus outright.

## Non-goals

- No changes to `initLoginTvNav()` (the separate `/login` page nav) — it's a small, independent,
  already-simple system with no zone structure needed.
- No changes to which elements exist or their behavior when activated (OK/click) — this is purely
  about *how focus moves between them*, not what they do.
- No changes to vertical/phone layouts. Zones are a TV-only (`isTv` gated) concept, matching how
  `initTvNav()` already early-returns on non-TV today.

## Design

### Five zones

| Zone | Elements (current IDs) | Notes |
|---|---|---|
| **Top Strip** | `sc-title-text`, `.sc-movie-link` badges, `sc-trivia-btn`, `sc-poster-toggle` + the Coming Attractions reel (`#sc-poster-strip a` items, only while `.sc-poster-visible`) | Spans the full width at the top of the screen |
| **Control Drawer** | `sc-chatmode-btn`, `sc-desync-btn`, `sc-settings-btn` | The left-edge fly-out cluster (`chromeState.leftZoneReveal`) — **not** the emote button, which lives in Chat |
| **Player Bar** | video.js control bar targets (`button.vjs-control`, `button.vjs-menu-button`, `.vjs-progress-control` when desynced) + `sc-drm-open` when the DRM-fallback overlay is showing | Can be **empty** — YouTube-embedded media has no video.js control bar at all (confirmed live, 2026-07-05); this is common, not an edge case |
| **Chat** | `sc-usercount-btn`, `sc-poll-btn`, `sc-chat-collapse-btn` (all in `#sc-chat-header`), `sc-emote-proxy`, `sc-newmsg-pill` (only while `.sc-show`), `sc-chat-textarea` | |
| **Overlay stack** | `sc-settings-overlay`, `sc-modal-overlay`, `sc-trivia-card` (while `.sc-show`), `sc-users-panel`, `sc-poll-panel`, `sc-np-card` (while `.sc-np-visible`) | One at a time (same as today's `openOverlay()`, which returns the first match) — no true nesting |

### Doors (the only legal cross-zone transitions)

```
[========= Top Strip (full width) =========]
[Control Drawer] [ Player Bar ] [   Chat   ]
```

- **Up** from Control Drawer, Player Bar, or Chat → Top Strip, always.
- **Down** from Top Strip → Player Bar. If Player Bar has zero candidates (see above), fall
  through to Chat instead. (There's no case where Control Drawer is the fallback for Down — it's
  reached only via Left/Right — so Down never needs to consider it.)
- **Left/Right** move along the single row Control Drawer ↔ Player Bar ↔ Chat, in that order:
  - Right from Control Drawer → Player Bar (or Chat if Player Bar is empty)
  - Left from Player Bar → Control Drawer; Right from Player Bar → Chat
  - Left from Chat → Player Bar (or Control Drawer if Player Bar is empty)
- **Within** a zone, Left/Right/Up/Down use the existing cone-weighted geometric scorer, scoped to
  just that zone's candidate list. This includes today's special cases that are really "movement
  inside Top Strip": the Coming Attractions reel (Down from toggle enters it, Left/Right scrolls,
  Up/Down exits back to the toggle) and the desync-gated scrubber seek (Left/Right steps the movie
  ±10s instead of moving focus, only while free-watch is on).
- **Overlay stack**: identical to today while a member is open — `candidates()` scopes exclusively
  to the open overlay's own focusable elements (or the overlay element itself, for a
  click-to-dismiss overlay with nothing else focusable inside it), trapping the D-pad until Back.
  **Back** closes the overlay and restores focus to the element that opened it (e.g. the settings
  gear, the trivia button) — tracked as "last focused element before the overlay opened," reusing
  the existing `focusEl` bookkeeping. This is the one behavior change from today (which just calls
  `clearFocus()`).

### What doesn't change

- `setFocus`/`clearFocus`/`activate`/`closeTop`/`revealChrome` keep their current responsibilities.
  `closeTop()`'s per-overlay-type close logic (video.js menu → settings → review modal → trivia →
  now-playing → users/poll panels → poster strip) is unchanged; only what happens to focus
  *afterward* changes (restore vs. clear).
- `tvNavState.setFocus` (the handoff other UI uses to place the remote's focus ring) is unchanged.
- `window.__scTvKey(dir)` keeps the same signature and is still the sole entry point native calls.
- Everything outside `web/src/tvnav.js` is untouched.

### Data flow

`window.__scTvKey(dir)` → `revealChrome()` (unchanged) → for `dir === 'back'`, `closeTop()` (now
also restores focus on success); otherwise, determine the current zone from `focusEl` (or default
to Top Strip if nothing is focused yet), resolve `dir` against that zone's door table, and either:
(a) move within the current zone's candidate list via the existing scorer, or (b) jump through a
door to the target zone's **first candidate** in that zone's element list (matches today's `list[0]`
fallback when nothing is currently focused — simplest option, and door transitions are infrequent
enough that geometric nearest-to-exit-point isn't worth the extra complexity).

### Error handling

- **Empty target zone** (Player Bar with no video.js bar): fall through Down→Chat / Left↔Right
  skip Player Bar as described above. If the *only* three real-content zones are somehow all empty
  (shouldn't happen in practice — Top Strip and Chat always have at least a title and chat
  textarea), a move is a no-op, matching today's "empty candidate list → do nothing" behavior.
- **Overlay disappears externally** while focus is trapped inside it (e.g. a poll closes on its
  own): next `__scTvKey` call re-evaluates `candidates()` fresh, naturally falling through to
  whatever zone applies once the overlay is gone — no new handling needed, this already works
  today for the same reason.
- **DRM overlay**: `sc-drm-open` is only ever a candidate while the DRM-fallback overlay exists in
  the DOM; folding it into Player Bar (rather than Overlay stack, where it lived conceptually
  closest to "MAIN_IDS, not OVERLAY_IDS" before) keeps it reachable without trapping focus, matching
  its current documented intent ("lives in the main cluster... so the remote can still reach chat
  and controls").

### Testing

Same manual-smoke-plus-live-device-verification approach used throughout Phase 1:
- Full D-pad pass through all 5 zones and every door listed above.
- Specifically re-verify the CC/quality reachability case (the bug class this redesign targets) —
  needs a raw/Drive video queued, since YouTube has no video.js control bar (a gap in Phase 1's own
  testing, noted in its final release notes).
- Verify the empty-Player-Bar fallthrough on a live YouTube item (common on this channel).
- Verify Back-from-overlay focus restoration for at least settings and trivia.
- Full existing smoke list (splash, chat send/tab-complete, C-cycle, settings save/persist, poster
  strip) to confirm no regressions — same list Phase 1 used.
