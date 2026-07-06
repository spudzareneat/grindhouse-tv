# Tonight's Lineup Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen, TV-only "Tonight's Lineup" schedule rail — opened from the existing
Coming Attractions poster strip — first as a fake-data prototype to validate feel on-device, then
(after explicit go-ahead) wired to the real Letterboxd + timing/ETA pipeline.

**Architecture:** New module directory `web/src/lineup/` (Phase 1 modularization convention). One
interface, `getTonightsLineup()` in `lineup/data.js`, separates the screen's rendering/nav code
(`lineup/screen.js`, unchanged between stages) from the data source (Stage 0 fixture → Stage 1
Letterboxd fetch + TMDB match + bumper-gap timing model). The screen registers as a new
`OVERLAY_IDS` entry in the existing `tvnav.js` D-pad system, reusing its geometric scorer for
Left/Right paging — no new nav algorithm.

**Tech Stack:** Same as the rest of `web/`: esbuild bundle (`npm run bundle`), `node --test` for
pure functions, eslint (`no-undef`). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-05-tonights-lineup-design.md`.

## Global Constraints

- **Never rename these window globals** — native code calls them: `__scTvKey`, `__scHttpResolve`,
  `__scStaleResync`, `__scSetCastMode`, `__scSetPlayerMuted`, `__scEnterCastFallback`, `__gdRealMeta`,
  and the JS→native interface object `CytubeNative`.
- **The bundle is committed**: after any source change, run `npm run bundle` inside `web/` and
  commit the regenerated `app/src/main/assets/cytube_mobile.js` in the same commit.
- **`npm run lint` must pass** before every commit that touches `web/src/`.
- **This is a TV-only feature** (`isTv`-gated) — zero change to phone/tablet behavior or layout.
- **Device checkpoints are hard stops.** Stage 0's checkpoint requires explicit user go-ahead
  before any Stage 1 work begins. If no device is attached, stop and ask the user to run the
  checkpoint — do not skip it.
- **Move/add-only where noted**: this is new code, not an extraction, so ordinary incremental
  commits are fine — but don't fold unrelated cleanup into these commits.
- Original files for reference: `web/src/tvnav.js`, `web/src/posters.js`, `web/src/styles/tv.css`,
  `web/src/cards/nowplaying.js` — all read in full during planning; line numbers below match their
  current state before this plan's edits begin.

---

## Stage 0 — Fake-data prototype (real production code, hardcoded data source)

### Task 1: `lineup/data.js` — the interface, backed by a fixture

**Files:**
- Create: `web/src/lineup/data.js`

**Interfaces:**
- Produces: `getTonightsLineup()` — async, returns `{ items: [{ cleanTitle, cleanYear, poster,
  backdrop, overview, etaLabel, isNowPlaying }] }`. This exact shape is what `lineup/screen.js`
  (Task 2) consumes and is directly passable to `showNowPlayingCard()` from
  `web/src/cards/nowplaying.js`. `etaLabel` is a ready-to-display string (`'≈ 9:20 PM'`, `'~ 11:00
  PM'`, `'LATE'`, or `''` when `isNowPlaying` is true) — Stage 1 computes this via `timing.js`;
  Stage 0 hardcodes it.

- [ ] **Step 1:** Create `web/src/lineup/data.js`:

```js
// The one interface lineup/screen.js consumes. Stage 0: a hardcoded fixture covering every
// visual state (now playing / exact / approx / late precision) so the screen's on-TV feel can
// be device-tested before any network code exists. Stage 1 replaces this implementation with
// the real Letterboxd + timing pipeline — screen.js does not change.
export async function getTonightsLineup() {
    return {
        items: [
            {
                cleanTitle: 'The Beyond', cleanYear: '1981', isNowPlaying: true, etaLabel: '',
                poster: null, backdrop: null,
                overview: 'A woman inherits a Louisiana hotel built over one of the seven gateways to Hell.',
            },
            {
                cleanTitle: 'American Hunter', cleanYear: '1988', isNowPlaying: false, etaLabel: '≈ 9:20 PM',
                poster: null, backdrop: null,
                overview: 'A grizzled ex-mercenary is hired to track a killer through the wilderness.',
            },
            {
                cleanTitle: 'Zombie Holocaust', cleanYear: '1980', isNowPlaying: false, etaLabel: '~ 11:00 PM',
                poster: null, backdrop: null,
                overview: 'A series of grisly murders at a New York hospital leads to a remote island of cannibals.',
            },
            {
                cleanTitle: 'Nightbeast', cleanYear: '1982', isNowPlaying: false, etaLabel: 'LATE',
                poster: null, backdrop: null,
                overview: 'An alien crash-lands and terrorizes a small town.',
            },
            {
                cleanTitle: 'Sole Survivor', cleanYear: '1984', isNowPlaying: false, etaLabel: 'LATE',
                poster: null, backdrop: null,
                overview: 'A plane crash survivor is stalked by the shadowy figures of everyone who was meant to die with her.',
            },
        ],
    };
}
```

- [ ] **Step 2:** `cd web && npm run lint` — expect no errors (plain ES module, no undefined
      globals).
- [ ] **Step 3:** Commit:

```bash
git add web/src/lineup/data.js
git commit -m "feat: Tonight's Lineup data interface (Stage 0 fixture)"
```

### Task 2: `lineup/screen.js` — rail renderer + D-pad-ready DOM

**Files:**
- Create: `web/src/lineup/screen.js`

**Interfaces:**
- Consumes: `getTonightsLineup()` from `./data.js` (Task 1); `showNowPlayingCard(data, opts)` from
  `../cards/nowplaying.js` (existing, signature confirmed by reading the file — tolerates missing
  `poster`/`backdrop`/etc., requires `cleanTitle` or `backdrop` to be present).
- Produces: `showLineupScreen()`, `hideLineupScreen()` — consumed by `posters.js` (Task 5) and
  `tvnav.js` (Task 3).

- [ ] **Step 1:** Create `web/src/lineup/screen.js`:

```js
import { getTonightsLineup } from './data.js';
import { showNowPlayingCard } from '../cards/nowplaying.js';

/* ==========================================================
   TONIGHT'S LINEUP — full-screen TV schedule rail, opened from
   the Coming Attractions poster strip. OK on a film opens the
   existing Now-Playing card in browse mode. Registered as an
   OVERLAY_IDS-trapped overlay in tvnav.js (see that file).
========================================================== */

function ensureScreenDom() {
    let screen = document.getElementById('sc-lineup-screen');
    if (screen) return screen;
    screen = document.createElement('div');
    screen.id = 'sc-lineup-screen';
    screen.innerHTML = `
        <div id="sc-lineup-header">Tonight's Lineup</div>
        <div id="sc-lineup-rail"></div>`;
    document.body.appendChild(screen);
    return screen;
}

function renderLoading(screen) {
    screen.querySelector('#sc-lineup-rail').innerHTML =
        '<div id="sc-lineup-loading">Fetching tonight’s lineup…</div>';
}

function renderItems(screen, data) {
    const rail = screen.querySelector('#sc-lineup-rail');
    const items = (data && data.items) || [];
    if (!items.length) {
        rail.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
        return;
    }
    rail.innerHTML = '';
    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sc-lineup-item' + (item.isNowPlaying ? ' sc-lineup-item-current' : '');
        btn.innerHTML = `
            <div class="sc-lineup-poster" style="${item.poster ? `background-image:url(${item.poster})` : ''}"></div>
            <div class="sc-lineup-title">${item.cleanTitle}${item.cleanYear ? ` (${item.cleanYear})` : ''}</div>
            <div class="sc-lineup-eta">${item.isNowPlaying ? 'NOW PLAYING' : (item.etaLabel || '')}</div>`;
        btn.addEventListener('click', () => showNowPlayingCard(item, { autoHide: false }));
        rail.appendChild(btn);
    });
}

// Toggles visibility SYNCHRONOUSLY (before the data fetch resolves) so tvnav.js's
// openOverlay() detects the new overlay immediately — activate()'s "did an overlay just
// open" check runs right after this function returns, with no await in between.
export function showLineupScreen() {
    const screen = ensureScreenDom();
    screen.classList.add('sc-lineup-visible');
    renderLoading(screen);
    getTonightsLineup()
        .then(data => renderItems(screen, data))
        .catch(() => { renderItems(screen, { items: [] }); });
}

export function hideLineupScreen() {
    const screen = document.getElementById('sc-lineup-screen');
    if (screen) screen.classList.remove('sc-lineup-visible');
}
```

- [ ] **Step 2:** `cd web && npm run lint` — expect no errors.
- [ ] **Step 3:** Commit:

```bash
git add web/src/lineup/screen.js
git commit -m "feat: Tonight's Lineup screen renderer (rail + NP-card handoff)"
```

### Task 3: Wire the screen into `tvnav.js` (nested-overlay focus stack + registration)

`preOverlayFocusEl` (added in Phase 2's Back-from-overlay work) is a single slot — it can't handle
Lineup screen opening the Now-Playing card as a *child* overlay (Back should close the card back to
the lineup rail, then a second Back should close the rail back to the poster strip). Generalize it
to a stack; this also makes any future nested-overlay case work for free.

**Files:**
- Modify: `web/src/tvnav.js`

**Interfaces:**
- Consumes: `hideLineupScreen` from `./lineup/screen.js` (Task 2).

- [ ] **Step 1:** Add the import alongside the other overlay-content imports near the top of the
      file:

```js
import { hideNowPlayingCard } from './cards/nowplaying.js';
import { hideLineupScreen } from './lineup/screen.js';
import { pickDirectional } from './tvnav/geometry.js';
```

- [ ] **Step 2:** Inside `initTvNav()`, replace the single-slot variable:

```js
    let focusEl = null;
    let preOverlayFocusEl = null;
```

with a stack:

```js
    let focusEl = null;
    let overlayFocusStack = [];
```

- [ ] **Step 3:** Add `'sc-lineup-screen'` to `OVERLAY_IDS`:

```js
    const OVERLAY_IDS = ['sc-settings-overlay', 'sc-modal-overlay', 'sc-trivia-card', 'sc-users-panel', 'sc-poll-panel', 'sc-np-card', 'sc-lineup-screen'];
```

- [ ] **Step 4:** Add the Lineup-screen visibility gate to `openOverlay()` (mirrors the existing
      `sc-np-card`/`sc-trivia-card` per-id checks):

```js
    const openOverlay = () => {
        for (const id of OVERLAY_IDS) {
            const o = document.getElementById(id);
            if (o && isVisible(o) &&
                (id !== 'sc-np-card' || o.classList.contains('sc-np-visible')) &&
                (id !== 'sc-trivia-card' || o.classList.contains('sc-show')) &&
                (id !== 'sc-lineup-screen' || o.classList.contains('sc-lineup-visible'))) return o;
        }
        return null;
    };
```

- [ ] **Step 5:** Replace `restoreFocusAfterOverlayClose()` to pop the stack instead of reading the
      single slot:

```js
    // Back-from-overlay restores focus to whatever opened it (settings gear, trivia
    // button, the poster that opened the Lineup screen, ...). A stack so a nested
    // overlay (Now-Playing card opened FROM the Lineup screen) unwinds one level at a
    // time instead of jumping straight back to whatever opened the outermost one.
    function restoreFocusAfterOverlayClose() {
        const restore = overlayFocusStack.pop() || null;
        clearFocus();
        if (restore && isVisible(restore)) setFocus(restore);
    }
```

- [ ] **Step 6:** In `activate()`, replace the opener-tracking bookkeeping:

```js
        const opener = focusEl;
        const hadOverlay = !!openOverlay();
        focusEl.click();
        if (!hadOverlay && openOverlay()) preOverlayFocusEl = opener;
        if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
```

with:

```js
        const opener = focusEl;
        const openBefore = openOverlay();
        focusEl.click();
        const openAfter = openOverlay();
        // Push whenever the topmost overlay actually changed — covers both "no overlay
        // was open" (openBefore is null) and "a DIFFERENT overlay opened on top of one
        // that was already open" (Now-Playing card opened from within the Lineup screen).
        if (openAfter && openAfter !== openBefore) overlayFocusStack.push(opener);
        if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
```

- [ ] **Step 7:** In `closeTop()`, add a Lineup-screen case right after the existing Now-Playing
      card case:

```js
        const np = document.getElementById('sc-np-card');
        if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); restoreFocusAfterOverlayClose(); return true; }
        const lineup = document.getElementById('sc-lineup-screen');
        if (lineup && lineup.classList.contains('sc-lineup-visible')) { hideLineupScreen(); restoreFocusAfterOverlayClose(); return true; }
        for (const id of ['sc-users-panel', 'sc-poll-panel']) {
```

- [ ] **Step 8:** `cd web && npm run lint` — expect no errors (this also catches if any
      `preOverlayFocusEl` reference was missed; grep the file for that name to confirm zero
      remaining occurrences).
- [ ] **Step 9:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` — expect
      `bundled OK` and exit 0.
- [ ] **Step 10:** Commit:

```bash
git add web/src/tvnav.js app/src/main/assets/cytube_mobile.js
git commit -m "refactor: generalize Back-from-overlay focus restore into a stack, register Lineup screen"
```

### Task 4: CSS for the Lineup screen

**Files:**
- Modify: `web/src/styles/tv.css`

- [ ] **Step 1:** Insert this block immediately before the `/* Vertical phones (if enabled there):
      stack poster above text */` comment (right after the trivia-card rules, so it sits alongside
      the other full-screen TV overlays):

```css
            /* ── TONIGHT'S LINEUP (full-screen TV schedule rail) ─────────────── */
            #sc-lineup-screen {
                position: fixed !important; inset: 0 !important;
                z-index: 20500 !important; /* below #sc-np-card (21000) so OK on a film covers this */
                background: rgba(6,4,9,0.97) !important;
                display: none !important; flex-direction: column !important;
                align-items: flex-start !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
                padding: 5vh 4vw !important; box-sizing: border-box !important;
            }
            #sc-lineup-screen.sc-lineup-visible { display: flex !important; }
            #sc-lineup-header {
                color: #fff !important; font-size: 15px !important; font-weight: 700 !important;
                letter-spacing: 0.14em !important; text-transform: uppercase !important;
                opacity: 0.6 !important; margin-bottom: 28px !important;
            }
            #sc-lineup-rail {
                display: flex !important; gap: 22px !important; width: 100% !important;
                overflow-x: auto !important; overflow-y: hidden !important;
                padding: 8px 4px 16px !important; scrollbar-width: none !important;
            }
            #sc-lineup-rail::-webkit-scrollbar { display: none !important; }
            #sc-lineup-loading { color: rgba(255,255,255,0.6) !important; font-size: 18px !important; }
            .sc-lineup-item {
                flex: 0 0 220px !important; background: transparent !important; border: none !important;
                color: #fff !important; cursor: pointer !important; text-align: left !important;
                padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 10px !important;
            }
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: cover !important; background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 10px 30px rgba(0,0,0,0.5) !important;
            }
            .sc-lineup-title { font-size: 15px !important; font-weight: 600 !important; line-height: 1.3 !important; }
            .sc-lineup-eta { font-size: 13px !important; color: rgba(255,255,255,0.6) !important; }
            .sc-lineup-item-current .sc-lineup-eta { color: var(--np-accent, #ff5b73) !important; font-weight: 700 !important; }
            body.sc-tv .sc-lineup-item { flex-basis: 260px !important; }
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 364px !important; }
            body.sc-tv .sc-lineup-title { font-size: 19px !important; }
            body.sc-tv .sc-lineup-eta { font-size: 16px !important; }
```

- [ ] **Step 2:** In the same file, add `#sc-lineup-screen` to the Picture-in-Picture hidden-elements
      selector list so PiP still hides it like every other overlay:

```css
            html body.sc-pip #sc-np-card, html body.sc-pip #sc-trivia-card,
            html body.sc-pip #sc-lineup-screen,
            html body.sc-pip #sc-mobile-input-row, html body.sc-pip .video-js .vjs-control-bar {
```

- [ ] **Step 3:** `cd web && npm run bundle` — confirm it succeeds; grep the generated bundle for
      `sc-lineup-screen` to confirm the CSS text made it in:
      `grep -c sc-lineup-screen ../app/src/main/assets/cytube_mobile.js` → non-zero.
- [ ] **Step 4:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "style: Tonight's Lineup full-screen rail"
```

### Task 5 (REVISED 2026-07-05 after device checkpoint): Entry point — toggle button opens the Lineup screen directly (TV only)

> **Revision note:** the original Task 5 (OK on an individual poster inside the small strip
> opens the Lineup screen) was implemented, reviewed, and device-tested. On the real TV it felt
> janky — hover-zoom-into-the-small-strip, then OK-into-the-full-screen, then Back-Back-out was
> too many steps stacked on top of each other. User feedback: skip the small strip navigation
> entirely on TV — the "Coming Attractions" toggle button should open the full-screen Lineup
> directly, one press, no intermediate zoom step. The small strip + hover-zoom stay completely
> unchanged for phone (this was never TV-gated there). This only changes `posters.js` — Tasks
> 2-4's screen/nav/CSS work is unaffected, because `sc-poster-toggle` was already reachable via
> D-pad in `tvnav.js`'s `MAIN_IDS`, and Task 3's depth-based overlay-stack fix generically detects
> "a new overlay opened" from *any* element's click, not specifically a poster's.

**Files:**
- Modify: `web/src/posters.js`

**Interfaces:**
- Consumes: `isTv` from `./tvdetect.js`; `showLineupScreen` from `./lineup/screen.js` (Task 2).

- [ ] **Step 1:** Add imports at the top of the file:

```js
import { usernameToColor } from './usercolors.js';
import { chromeState } from './chrome/state.js';
import { onSocket } from './socket.js';
import { isTv } from './tvdetect.js';
import { showLineupScreen } from './lineup/screen.js';
```

- [ ] **Step 2:** Do NOT add any click handler to the individual poster `<a>` wrappers (the
      original Task 5 approach) — revert that if present. Instead, modify the toggle button's
      existing click handler (in `initPosterStrip()`, the `toggleBtn.addEventListener('click', ...)`
      block) so that on TV it opens the Lineup screen directly instead of toggling the small
      strip's visibility:

```js
    toggleBtn.addEventListener('click', () => {
        // TV: skip the small strip + hover-zoom entirely, open the full-screen Lineup
        // rail directly — one press, no intermediate zoom step. Phone behavior (toggle
        // the small strip) is completely unchanged.
        if (isTv) { showLineupScreen(); return; }
        const visible = strip.classList.toggle('sc-poster-visible');
        toggleBtn.classList.toggle('sc-poster-toggle-active', visible);
        // Tell the top bar system whether strip is open
        chromeState.topBarIsOpen = visible;
        if (visible && chromeState.topBarWake) {
            chromeState.topBarWake(); // wake and keep awake
        }
        // If closing, restart the idle timer via a mousemove wake
        // (the next mousemove in the zone will restart it naturally)
    });
```

  This makes the small strip's `.sc-poster-visible` class permanently untoggled on TV, so
  `tvnav.js`'s existing Coming-Attractions-reel D-pad special-casing in `move()` (entering the
  strip, Left/Right paging posters, Up/Down exiting) becomes unreachable there — intentionally
  left in place rather than removed, since it's still live and load-bearing for phone/tablet
  touch navigation of the same strip, and this revision's scope is the TV entry point only.

- [ ] **Step 3:** `cd web && npm run lint` — expect no errors.
- [ ] **Step 4:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` — expect
      `bundled OK` and exit 0.
- [ ] **Step 5:** Commit:

```bash
git add web/src/posters.js app/src/main/assets/cytube_mobile.js
git commit -m "fix: TV toggle button opens Tonight's Lineup directly (skip small strip)"
```

### Task 5e (added after 2nd round of device feedback): Now-Playing card progress bar only for the item actually playing

> **Feedback:** browsing a non-current film from the Lineup rail showed the Now-Playing card's
> elapsed/total/remaining progress bar — but that bar always reflects whatever's *actually*
> playing right now, so on a browsed (non-current) item it's misleading. Keep it only when the
> browsed item IS the one actually playing.

**Files:**
- Modify: `web/src/cards/nowplaying.js`
- Modify: `web/src/lineup/screen.js`

**Interfaces:**
- `showNowPlayingCard(data, opts)` gains `opts.showProgress` (default `true` — every existing
  call site keeps showing progress unchanged; only the Lineup rail's new call site passes `false`
  for non-current items).

- [ ] **Step 1:** In `web/src/cards/nowplaying.js`'s `showNowPlayingCard`, replace:

```js
    card.classList.add('sc-np-visible');

    // Live elapsed / total / remaining bar — refreshes while the card is up.
    // This is the remote-friendly stand-in for hovering a scrubber: summon the
    // card (title button / 'i') and the progress updates in place.
    _renderNpProgress();
    clearInterval(_npProgTimer);
    _npProgTimer = setInterval(_renderNpProgress, 500);
```

with:

```js
    card.classList.add('sc-np-visible');

    // Live elapsed / total / remaining bar — only meaningful for the item that's actually
    // playing right now (this is the remote-friendly stand-in for hovering a scrubber).
    // Browsing a different item from Tonight's Lineup passes showProgress: false so it
    // doesn't show the real now-playing item's progress mislabeled under this title.
    const progWrap = card.querySelector('#sc-np-progress');
    if (opts.showProgress !== false) {
        _renderNpProgress();
        clearInterval(_npProgTimer);
        _npProgTimer = setInterval(_renderNpProgress, 500);
    } else {
        clearInterval(_npProgTimer);
        if (progWrap) progWrap.style.display = 'none';
    }
```

- [ ] **Step 2:** In `web/src/lineup/screen.js`'s `renderItems`, change the click handler:

```js
        btn.addEventListener('click', () => showNowPlayingCard(item, { autoHide: false }));
```

to:

```js
        btn.addEventListener('click', () => showNowPlayingCard(item, { autoHide: false, showProgress: item.isNowPlaying }));
```

- [ ] **Step 3:** `cd web && npm run lint` — expect no errors.
- [ ] **Step 4:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` — expect
      `bundled OK` and exit 0.
- [ ] **Step 5:** Commit:

```bash
git add web/src/cards/nowplaying.js web/src/lineup/screen.js app/src/main/assets/cytube_mobile.js
git commit -m "fix: Now-Playing card only shows progress for the item actually playing"
```

### Task 4c (added after 2nd round of device feedback): Lineup rail CSS polish

> **Feedback:** (1) the D-pad focus ring outlines the whole tile (poster + title + eta stacked),
> which looks strange — should highlight just the poster art, matching how the "now playing"
> marker is already scoped. (2) scrolling to a later page and back can leave a poster's left edge
> chopped (a `scrollIntoView({inline:'nearest'})` quirk with flex + gap). (3) the rail's scrollbar
> is hidden entirely — should be visible so the total count/position is legible.

**Files:**
- Modify: `web/src/styles/tv.css`

- [ ] **Step 1:** Replace the entire Lineup CSS block (from the `/* ── TONIGHT'S LINEUP
      (full-screen TV schedule rail) ─────────────── */` comment through the last
      `body.sc-tv .sc-lineup-eta { font-size: 16px !important; }` line — i.e. everything Task 4
      added) with:

```css
            /* ── TONIGHT'S LINEUP (full-screen TV schedule rail) ─────────────── */
            #sc-lineup-screen {
                position: fixed !important; inset: 0 !important;
                z-index: 20500 !important; /* below #sc-np-card (21000) so OK on a film covers this */
                background: rgba(6,4,9,0.97) !important;
                display: none !important; flex-direction: column !important;
                align-items: flex-start !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
                padding: 5vh 4vw !important; box-sizing: border-box !important;
            }
            #sc-lineup-screen.sc-lineup-visible { display: flex !important; }
            #sc-lineup-header {
                color: #fff !important; font-size: 15px !important; font-weight: 700 !important;
                letter-spacing: 0.14em !important; text-transform: uppercase !important;
                opacity: 0.6 !important; margin-bottom: 28px !important;
            }
            #sc-lineup-rail {
                display: flex !important; gap: 22px !important; width: 100% !important;
                overflow-x: auto !important; overflow-y: hidden !important;
                padding: 8px 4px 16px !important;
                /* Snap fully to each item so paging Left/Right (and scrolling back) always
                   settles on a whole poster — without this, scrollIntoView({inline:'nearest'})
                   can leave a partially-scrolled position that chops a poster's edge. */
                scroll-snap-type: x mandatory !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.28) transparent !important;
            }
            #sc-lineup-rail::-webkit-scrollbar { height: 8px !important; }
            #sc-lineup-rail::-webkit-scrollbar-track { background: rgba(255,255,255,0.05) !important; border-radius: 10px !important; }
            #sc-lineup-rail::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.28) !important; border-radius: 10px !important;
                border: 2px solid transparent !important; background-clip: padding-box !important;
            }
            #sc-lineup-rail::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45) !important; background-clip: padding-box !important; }
            body.sc-tv #sc-lineup-rail::-webkit-scrollbar { height: 10px !important; }
            #sc-lineup-loading { color: rgba(255,255,255,0.6) !important; font-size: 18px !important; }
            .sc-lineup-item {
                flex: 0 0 220px !important; background: transparent !important; border: none !important;
                color: #fff !important; cursor: pointer !important; text-align: left !important;
                padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 10px !important;
                scroll-snap-align: start !important;
            }
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: cover !important; background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 10px 30px rgba(0,0,0,0.5) !important;
            }
            .sc-lineup-title { font-size: 15px !important; font-weight: 600 !important; line-height: 1.3 !important; }
            .sc-lineup-eta { font-size: 13px !important; color: rgba(255,255,255,0.6) !important; }
            .sc-lineup-item-current .sc-lineup-eta { color: var(--np-accent, #ff5b73) !important; font-weight: 700 !important; }
            /* D-pad focus ring highlights just the poster art (not the whole tile — title/eta
               stay plain), matching how the "now playing" marker above is scoped. Overrides
               the generic body.sc-tv .sc-tv-focus rule via higher selector specificity. */
            body.sc-tv .sc-lineup-item.sc-tv-focus { outline: none !important; box-shadow: none !important; }
            body.sc-tv .sc-lineup-item.sc-tv-focus .sc-lineup-poster {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32), 0 10px 30px rgba(0,0,0,0.5) !important;
            }
            body.sc-tv .sc-lineup-item { flex-basis: 260px !important; }
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 364px !important; }
            body.sc-tv .sc-lineup-title { font-size: 19px !important; }
            body.sc-tv .sc-lineup-eta { font-size: 16px !important; }
```

- [ ] **Step 2:** `cd web && npm run bundle` — confirm it succeeds; grep the generated bundle for
      `scroll-snap-type` to confirm the new CSS made it in.
- [ ] **Step 3:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "style: Lineup rail poster-only focus ring, scroll-snap, visible scrollbar"
```

### Task 6 (DEVICE, stage gate): Validate feel on the TV — STOP for explicit go-ahead

This is the checkpoint the whole staged approach exists for. Do not start Stage 1 without an
explicit go/no-ahead from the user after this device pass.

- [ ] **Step 1:** `./gradlew assembleDebug`, install on the TV device, launch, `adb logcat -s
      GrindhouseWeb` in a separate terminal to catch any JS errors.
- [ ] **Step 2:** Open the Coming Attractions poster strip (as today). D-pad onto a poster (hover-zoom
      should behave exactly as before).
- [ ] **Step 3:** Press OK on a poster. Expect: the full-screen Lineup rail opens, showing the 5
      fixture entries (The Beyond marked "NOW PLAYING", then the ≈/~/LATE examples in order).
- [ ] **Step 4:** D-pad Left/Right across the rail. Expect: focus moves smoothly item-to-item, same
      one-item-at-a-time feel as the existing poster strip.
- [ ] **Step 5:** Press OK on a non-"now playing" item. Expect: the Now-Playing card opens in browse
      mode showing that item's title/year/overview (no poster/backdrop art expected — fixture has
      none).
- [ ] **Step 6:** Press Back once. Expect: the Now-Playing card closes, focus ring returns to the
      film's button in the Lineup rail (not the poster strip).
- [ ] **Step 7:** Press Back again. Expect: the Lineup screen closes, focus ring returns to the
      poster that was originally pressed in the strip.
- [ ] **Step 8:** Regression-check existing overlays still restore focus correctly (single-level,
      unaffected by the stack change): open Settings, press Back — focus returns to the gear. Open
      Trivia (if a movie with an IMDb id is loaded), press Back — focus returns to the Trivia button.
- [ ] **Step 9:** Full existing smoke list per `docs/superpowers/plans/2026-07-03-phase1-foundations.md`
      (splash, chat send, `C` cycle, settings save/persist, poster strip hover-zoom) to confirm no
      regressions elsewhere.
- [ ] **Step 10: STOP.** Report the results to the user and wait for an explicit go-ahead before
      starting any Stage 1 task below. If the feel is wrong, do not proceed to "fix" it inside Stage
      1 — flag it and revisit the design (same discipline as the zone-based-nav rejection).

---

## Stage 1 — Real Letterboxd + timing pipeline (only after Task 6's go-ahead)

### Task 7: `lineup/timing.js` — pure ETA-precision and bumper-gap functions (TDD)

**Files:**
- Create: `web/src/lineup/timing.js`
- Test: `web/test/timing.test.mjs`

**Interfaces:**
- Produces: `formatEta(hour24, minute, precision)` → string; `medianGapSeconds(observedGaps)` →
  number or `null`. Both pure, no DOM/socket dependency — consumed by Task 9's real
  `getTonightsLineup()` implementation.

- [ ] **Step 1:** Write the failing test `web/test/timing.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { formatEta, medianGapSeconds } from '../src/lineup/timing.js';

test('formatEta: exact precision uses the ≈ prefix', () => {
    assert.strictEqual(formatEta(21, 20, 'exact'), '≈ 9:20 PM');
});
test('formatEta: approx precision uses the ~ prefix', () => {
    assert.strictEqual(formatEta(23, 0, 'approx'), '~ 11:00 PM');
});
test('formatEta: late precision ignores the time and returns LATE', () => {
    assert.strictEqual(formatEta(3, 45, 'late'), 'LATE');
});
test('formatEta: midnight hour formats as 12, not 0', () => {
    assert.strictEqual(formatEta(0, 5, 'exact'), '≈ 12:05 AM');
});
test('formatEta: noon hour formats as 12 PM, not 0 PM', () => {
    assert.strictEqual(formatEta(12, 0, 'exact'), '≈ 12:00 PM');
});

test('medianGapSeconds: empty input returns null', () => {
    assert.strictEqual(medianGapSeconds([]), null);
});
test('medianGapSeconds: single value returns itself', () => {
    assert.strictEqual(medianGapSeconds([120]), 120);
});
test('medianGapSeconds: odd count returns the middle value', () => {
    assert.strictEqual(medianGapSeconds([150, 90, 120]), 120);
});
test('medianGapSeconds: even count averages the two middle values', () => {
    assert.strictEqual(medianGapSeconds([60, 150, 90, 120]), 105);
});
```

- [ ] **Step 2:** Run it to confirm it fails because the module doesn't exist yet:
      `cd web && node --test test/timing.test.mjs` → expect a module-not-found error.
- [ ] **Step 3:** Create `web/src/lineup/timing.js`:

```js
/* ==========================================================
   TONIGHT'S LINEUP — timing/ETA model.
   Precision decays honestly the further out an estimate is: 'exact' (current
   feature's remaining runtime + one learned bumper gap), 'approx' (further out,
   compounding uncertainty), 'late' (tail of the night — running order only).
========================================================== */

// hour24/minute describe a local wall-clock time already computed by the caller
// (kept as plain numbers, not a Date, so this stays pure and timezone-independent).
export function formatEta(hour24, minute, precision) {
    if (precision === 'late') return 'LATE';
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let h = hour24 % 12;
    if (h === 0) h = 12;
    const mm = String(minute).padStart(2, '0');
    const prefix = precision === 'approx' ? '~' : '≈';
    return `${prefix} ${h}:${mm} ${period}`;
}

// Running median of observed bumper-gap durations (seconds) between features,
// used both to refine tonight's remaining ETAs and as the cold-start default for
// future nights (per the vision doc's "persist the learned gap" note).
export function medianGapSeconds(observedGaps) {
    if (!observedGaps.length) return null;
    const sorted = [...observedGaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

- [ ] **Step 4:** Run the test again: `node --test test/timing.test.mjs` → expect all PASS.
- [ ] **Step 5:** `npm run lint` — expect no errors.
- [ ] **Step 6:** Commit:

```bash
git add web/src/lineup/timing.js web/test/timing.test.mjs
git commit -m "feat: Tonight's Lineup timing model (ETA formatting + bumper-gap median)"
```

### Task 8: `lineup/letterboxd.js` — pure parsers (TDD) + fetch orchestration

**Files:**
- Create: `web/src/lineup/letterboxd.js`
- Test: `web/test/letterboxd.test.mjs`

**Interfaces:**
- Consumes: `nativeHttpGet` from `../native.js` (existing, confirmed by reading the file — resolves
  `{ status, body }` or rejects).
- Produces: `findCurrentWeekListUrl(listsPageHtml)` → string or `null`; `parseListTitles(listPageHtml)`
  → `[{ title, year }]`; `fetchTonightsSchedule()` → `Promise<[{ title, year }]>` (the network
  orchestration, not unit-tested — see Task 9).

> **Verified against the live site 2026-07-05** (`curl.exe` from the local machine, per CLAUDE.md's
> network-testing note): `letterboxd.com/420grindhouse/lists/` returns 200 with a browser UA. The
> current week's list href repeats 4× per list (plain link, then `/likes/`, `/edit/` variants) but
> the plain link for the newest week is always first in document order, so "first
> `grindhouse-schedule` match" still correctly picks it. **Important correction from the design
> spec's assumption:** the list page's `<meta name="description">` only samples ~5 of the list's
> films ("A list of 27 films compiled on Letterboxd, including X, Y, Z, W and V…"), not the full
> schedule — parsing it would silently truncate every schedule to 5 items. The real, complete,
> ordered source is each poster's `data-item-name="Title (Year)"` attribute — confirmed present on
> all 27 films in a real fetched list, in schedule order, e.g.:
> `data-item-name="American Hunter (1988)"`. Apostrophes are HTML-encoded (`America&#039;s Deadliest
> Home Video (1993)`) and need decoding.

- [ ] **Step 1:** Write the failing test `web/test/letterboxd.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { findCurrentWeekListUrl, parseListTitles } from '../src/lineup/letterboxd.js';

const LISTS_PAGE_FIXTURE = `
<div class="list-set">
  <a href="/420grindhouse/list/general-favorites/">General Favorites</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/">This week's schedule</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/likes/">Likes</a>
  <a href="/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/edit/">Edit</a>
  <a href="/420grindhouse/list/weekend-grindhouse-schedule-fri-6-26-sun/">Last week's schedule</a>
</div>`;

test('findCurrentWeekListUrl picks the first grindhouse-schedule link (lists are newest-first)', () => {
    assert.strictEqual(
        findCurrentWeekListUrl(LISTS_PAGE_FIXTURE),
        'https://letterboxd.com/420grindhouse/list/4th-of-july-weekend-grindhouse-schedule-fri-1/'
    );
});
test('findCurrentWeekListUrl returns null when no schedule link is present', () => {
    assert.strictEqual(findCurrentWeekListUrl('<a href="/420grindhouse/list/other/">Other</a>'), null);
});

// Real snippet shape captured from a live list page (2026-07-05) — each poster carries its
// full title+year here, unlike the meta description (which only samples ~5 of the list).
const LIST_PAGE_FIXTURE = `<html><body><ul class="poster-list">
<li><div class="film-poster" data-image-width="125" data-image-height="187" data-item-name="American Hunter (1988)" data-item-slug="american-hunter" data-item-link="/film/american-hunter/"></div></li>
<li><div class="film-poster" data-item-name="America&#039;s Deadliest Home Video (1993)" data-item-slug="americas-deadliest-home-video"></div></li>
<li><div class="film-poster" data-item-name="American Cyborg: Steel Warrior (1993)" data-item-slug="american-cyborg-steel-warrior"></div></li>
</ul></body></html>`;

test('parseListTitles extracts every "Title (Year)" from each poster\'s data-item-name', () => {
    assert.deepStrictEqual(parseListTitles(LIST_PAGE_FIXTURE), [
        { title: 'American Hunter', year: '1988' },
        { title: 'America\'s Deadliest Home Video', year: '1993' },
        { title: 'American Cyborg: Steel Warrior', year: '1993' },
    ]);
});
test('parseListTitles returns an empty array when there are no posters', () => {
    assert.deepStrictEqual(parseListTitles('<html><body></body></html>'), []);
});
```

- [ ] **Step 2:** Run it to confirm it fails: `cd web && node --test test/letterboxd.test.mjs` →
      expect a module-not-found error.
- [ ] **Step 3:** Create `web/src/lineup/letterboxd.js`:

```js
import { nativeHttpGet } from '../native.js';

/* ==========================================================
   TONIGHT'S LINEUP — Letterboxd schedule fetch.
   letterboxd.com/420grindhouse/lists/ is reachable with a browser UA and no
   login (generic bots get 403 — the native HTTP bridge already sends one for
   IMDb the same way). Lists are newest-first; every weekly slug contains
   'grindhouse-schedule', so the first match is "this week". Each poster on the
   list page carries the full "Title (Year)" as a data-item-name attribute —
   the <meta name="description"> was tried first but only samples ~5 of the
   list's films, not the full schedule (confirmed against the live site).
========================================================== */
const LISTS_URL = 'https://letterboxd.com/420grindhouse/lists/';
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// Lists render newest-first, so the first href containing 'grindhouse-schedule'
// is the current week's list. Returns the absolute URL, or null if none is found.
export function findCurrentWeekListUrl(listsPageHtml) {
    const m = listsPageHtml.match(/href="(\/420grindhouse\/list\/[^"]*grindhouse-schedule[^"]*\/)"/i);
    return m ? 'https://letterboxd.com' + m[1] : null;
}

function decodeHtmlEntities(s) {
    return s
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Every poster on the list page carries data-item-name="Title (Year)", in schedule order —
// this is the complete, ordered list (unlike the meta description's ~5-title sample).
export function parseListTitles(listPageHtml) {
    const re = /data-item-name="([^"]*)"/g;
    const items = [];
    let m;
    while ((m = re.exec(listPageHtml))) {
        const decoded = decodeHtmlEntities(m[1]);
        const ym = decoded.match(/^(.*)\s\((\d{4})\)$/);
        if (ym) items.push({ title: ym[1].trim(), year: ym[2] });
    }
    return items;
}

// Fetches and parses tonight's schedule. Throws on any failure (network, no
// current-week link found, no titles parsed) — the caller (data.js) catches
// this and falls back to the Now/Next-only view.
export async function fetchTonightsSchedule() {
    const listsRes = await nativeHttpGet(LISTS_URL, BROWSER_HEADERS);
    if (!listsRes || listsRes.status !== 200) throw new Error('Letterboxd lists HTTP ' + (listsRes && listsRes.status));
    const listUrl = findCurrentWeekListUrl(listsRes.body);
    if (!listUrl) throw new Error('no current-week schedule list found');
    const listRes = await nativeHttpGet(listUrl, BROWSER_HEADERS);
    if (!listRes || listRes.status !== 200) throw new Error('Letterboxd list HTTP ' + (listRes && listRes.status));
    const titles = parseListTitles(listRes.body);
    if (!titles.length) throw new Error('no titles parsed from schedule list');
    return titles;
}
```

- [ ] **Step 4:** Run the test again: `node --test test/letterboxd.test.mjs` → expect all PASS
      (adjust the apostrophe-case assertion per the note above if it doesn't match on the first try).
- [ ] **Step 5:** `npm run lint` — expect no errors.
- [ ] **Step 6:** Commit:

```bash
git add web/src/lineup/letterboxd.js web/test/letterboxd.test.mjs
git commit -m "feat: Letterboxd schedule fetch + parsers for Tonight's Lineup"
```

### Task 9: Wire `data.js`'s real implementation

Replace the Stage 0 fixture with the real pipeline: fetch once per session, merge with live socket
data for current-item detection, TMDB-match each title, fall back to Now/Next-only on any failure.
`screen.js` (Task 2) does not change — only this file's internals.

**Files:**
- Modify: `web/src/lineup/data.js`

**Interfaces:**
- Consumes: `fetchTonightsSchedule` from `./letterboxd.js` (Task 8); `lookupMovie` from
  `../metadata/tmdb.js` (existing — confirmed signature `lookupMovie(title, year)` returning
  `{cleanTitle, cleanYear, poster, backdrop, overview, runtime, ...}`); `movieState` from
  `../metadata/tmdb.js` for the current title; `onSocket` from `../socket.js`;
  `getCurrentMediaSeconds`/`getCurrentPlaybackSeconds` from `../mediatime.js` (existing — live
  duration/playhead, already used by `cards/nowplaying.js` the same way); `formatEta`/
  `medianGapSeconds` from `./timing.js` (Task 7).

- [ ] **Step 1:** Replace the full contents of `web/src/lineup/data.js`:

```js
import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, medianGapSeconds } from './timing.js';

/* ==========================================================
   TONIGHT'S LINEUP — data interface consumed by lineup/screen.js.
   Fetches + caches the Letterboxd schedule once per session, locates "now" in
   it via the live current title, and projects each future item's ETA from
   TMDB runtimes plus a learned median bumper-gap. Falls back to a
   Now/Next-only view (built purely from live changeMedia data) if the
   Letterboxd fetch fails, or to running-order-only (no times) if "now" can't
   be placed on the list (e.g. a bumper is currently playing).
========================================================== */

let _scheduleCache = null;   // [{title, year}] for the whole night, or null before first fetch
let _fetchFailed = false;    // sticky for the session once Letterboxd is unreachable
let _lastChangeMedia = null; // most recent changeMedia payload (title), for the fallback
let _observedGapSeconds = []; // durations (s) of changeMedia items that didn't match the schedule
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) item started

// Learn bumper-gap duration live: a changeMedia title that doesn't match anything in
// tonight's schedule is a bumper; the time between it starting and the next
// (matched-or-not) changeMedia is one observed gap sample.
onSocket('changeMedia', (d) => {
    const title = d && d.title;
    const matchesSchedule = !!(title && _scheduleCache &&
        _scheduleCache.some(s => s.title.toLowerCase() === title.toLowerCase()));
    if (title && !matchesSchedule && _scheduleCache) {
        _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1000);
        _lastUnmatchedStart = null;
    }
    _lastChangeMedia = d || null;
});

async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    try {
        _scheduleCache = await fetchTonightsSchedule();
    } catch (e) {
        _fetchFailed = true;
    }
}

// Now/Next-only fallback: only what a plain viewer can see live, no future lineup.
function fallbackItems() {
    const items = [];
    if (movieState.lastMovieTitle) {
        items.push({
            cleanTitle: movieState.lastMovieTitle, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: true, etaLabel: '',
        });
    }
    if (_lastChangeMedia && _lastChangeMedia.title && _lastChangeMedia.title !== movieState.lastMovieTitle) {
        items.push({
            cleanTitle: _lastChangeMedia.title, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: 'LATE',
        });
    }
    return items;
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return { items: fallbackItems() };

    const infos = await Promise.all(_scheduleCache.map(({ title, year }) => lookupMovie(title, year)));
    const currentIndex = _scheduleCache.findIndex(s =>
        movieState.lastMovieTitle && s.title.toLowerCase() === movieState.lastMovieTitle.toLowerCase());

    if (currentIndex === -1) {
        // Can't place "now" on the list (e.g. a bumper is playing right now, or the
        // current title didn't match) — running order only, no times, per the vision
        // doc's "never display precision the data can't support."
        return {
            items: _scheduleCache.map(({ title, year }, i) => ({
                cleanTitle: infos[i].cleanTitle || title,
                cleanYear: infos[i].cleanYear || year,
                poster: infos[i].poster || null,
                backdrop: infos[i].backdrop || null,
                overview: infos[i].overview || '',
                isNowPlaying: false,
                etaLabel: 'LATE',
            })),
        };
    }

    const learnedGap = medianGapSeconds(_observedGapSeconds) ?? 600; // 10-min cold-start default
    let cumulative = Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds());
    const items = [];
    for (let i = currentIndex; i < _scheduleCache.length; i++) {
        const { title, year } = _scheduleCache[i];
        const info = infos[i];
        const base = {
            cleanTitle: info.cleanTitle || title,
            cleanYear: info.cleanYear || year,
            poster: info.poster || null,
            backdrop: info.backdrop || null,
            overview: info.overview || '',
        };
        const offset = i - currentIndex;
        if (offset === 0) { items.push({ ...base, isNowPlaying: true, etaLabel: '' }); continue; }

        cumulative += learnedGap; // a bumper precedes this feature
        const precision = offset === 1 ? 'exact' : offset <= 3 ? 'approx' : 'late';
        const eta = new Date(Date.now() + cumulative * 1000);
        items.push({ ...base, isNowPlaying: false, etaLabel: formatEta(eta.getHours(), eta.getMinutes(), precision) });
        cumulative += info.runtime ? info.runtime * 60 : 0; // then this feature's own runtime
    }
    return { items };
}
```

- [ ] **Step 2:** `cd web && npm run lint` — expect no errors.
- [ ] **Step 3:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` — expect
      `bundled OK` and exit 0.
- [ ] **Step 4:** Commit:

```bash
git add web/src/lineup/data.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: Tonight's Lineup real Letterboxd pipeline (Stage 1)"
```

### Task 10 (DEVICE, stage gate): Validate the real pipeline + fallback path

- [ ] **Step 1:** `./gradlew assembleDebug`, install, launch on the TV against the live room,
      `adb logcat -s GrindhouseWeb` open in a separate terminal.
- [ ] **Step 2:** Open the poster strip, OK on a poster. Expect: "Fetching tonight's lineup…" briefly,
      then the real schedule (titles matched from the live Letterboxd list, current item marked
      "NOW PLAYING").
- [ ] **Step 3:** Check the ETA precision decay on the rail: the item immediately after "NOW
      PLAYING" should show a `≈ H:MM AM/PM` estimate, items 2-3 out should show `~ H:MM AM/PM`, and
      anything further out should show `LATE` with no time — matching the honest-precision-decay
      rule (never display precision the data can't support).
- [ ] **Step 3b:** Confirm "NOW PLAYING" actually lands on the film that's really airing right now.
      `data.js`'s `currentIndex` match is case-insensitive raw-string equality between
      `movieState.lastMovieTitle` (the cleaned filename/YouTube title) and the Letterboxd list's
      title — this can miss if the two differ in punctuation/wording even after cleaning. If it's
      ever wrong, note the two exact title strings that failed to match; a follow-up could match via
      TMDB id instead (both sides already run through `lookupMovie`) rather than raw string equality.
- [ ] **Step 4:** OK on a non-current film. Expect: Now-Playing card in browse mode with real
      TMDB poster/backdrop/overview (when TMDB is configured with a key in Settings).
- [ ] **Step 5:** Force the fallback path: temporarily break `LISTS_URL` in `letterboxd.js` (e.g.
      point it at a 404), rebuild, reinstall, reopen the Lineup screen. Expect: no crash, the
      Now/Next-only fallback view built from `changeMedia` appears instead. Revert the temporary
      change afterward and do not commit it.
- [ ] **Step 6:** Full existing smoke list (same as Task 6, Step 9) to confirm no regressions.
- [ ] **Step 7: STOP.** Report results to the user and confirm Tonight's Lineup is complete, or
      note any follow-up (e.g. persisting the learned bumper gap across nights, which the vision
      doc mentions as a nice-to-have but this plan keeps session-only).

---

## Round 3 amendments (real-device + domain-knowledge feedback, added 2026-07-06)

Live-tested against the actual room and Letterboxd site during Task 10 (see ledger). Feedback:
the Letterboxd list spans the whole weekend undifferentiated by day (a linked Reddit post breaks
it down by day, but that's explicitly out of scope for now -- "let's try starting with" simpler);
the screen should show the real list title + a standing disclaimer instead of the static "Tonight's
Lineup" label; estimates should only be attempted for the next 4 upcoming films (not just 3); a
new cold-start case (current time is Friday before the usual noon-Pacific start, no live anchor at
all) should give exactly one estimate (the first film, at Friday noon) and nothing else; browsing a
film should show its IMDb parental-guide chips (the data was already being fetched by `lookupMovie`
but silently dropped when building each item); poster art aspect ratio doesn't match TMDB's actual
2:3 ratio, causing crop.

### Task 8b: `letterboxd.js` -- parse the list's own title

**Files:**
- Modify: `web/src/lineup/letterboxd.js`
- Modify: `web/test/letterboxd.test.mjs`

**Interfaces:**
- Produces: `parseListTitle(listPageHtml)` -> string or `null`. `fetchTonightsSchedule()`'s return
  shape changes from `[{title, year}]` to `{ listTitle, items: [{title, year}] }`.

> **Verified against the live site 2026-07-06** (`curl.exe`): the list page's
> `<meta property="og:title" content="...">` carries the list's own clean title with no
> site-suffix to strip (e.g. `"4th of July Weekend Grindhouse Schedule - Fri 7/3 - Sun 7/5/26"`)
> -- cleaner than the `<title>` tag, which appends `" bull Letterboxd"`.

- [ ] **Step 1:** Add to `web/test/letterboxd.test.mjs` (alongside the existing tests, same file):

```js
import { findCurrentWeekListUrl, parseListTitle, parseListTitles } from '../src/lineup/letterboxd.js';
```

(replacing the existing `import { findCurrentWeekListUrl, parseListTitles } from '../src/lineup/letterboxd.js';` line -- same import, just adding `parseListTitle`), and add these two tests:

```js
const TITLE_FIXTURE = '<html><head><meta property="og:title" content="4th of July Weekend Grindhouse Schedule - Fri 7/3 - Sun 7/5/26"></head><body></body></html>';

test('parseListTitle extracts the lists own title from og:title', () => {
    assert.strictEqual(parseListTitle(TITLE_FIXTURE), '4th of July Weekend Grindhouse Schedule - Fri 7/3 - Sun 7/5/26');
});
test('parseListTitle returns null when og:title is missing', () => {
    assert.strictEqual(parseListTitle('<html><head></head><body></body></html>'), null);
});
```

- [ ] **Step 2:** Run to confirm the two new tests fail (module doesn't export `parseListTitle`
      yet): `cd web && node --test test/letterboxd.test.mjs`.
- [ ] **Step 3:** In `web/src/lineup/letterboxd.js`, add the new function (place it after
      `findCurrentWeekListUrl`, before `decodeHtmlEntities`):

```js
// The list page's <meta property="og:title"> carries the list's own clean title, no
// site-suffix to strip (unlike the <title> tag, which appends a Letterboxd suffix).
export function parseListTitle(listPageHtml) {
    const m = listPageHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
    return m ? decodeHtmlEntities(m[1]).trim() : null;
}
```

  Note: this places a call to `decodeHtmlEntities` before its definition in the file -- that's fine
  for a `function` declaration (hoisted), but move `parseListTitle` to after
  `decodeHtmlEntities` instead if you'd rather avoid relying on hoisting; either ordering works.

- [ ] **Step 4:** Change `fetchTonightsSchedule`'s return value -- replace:

```js
    const titles = parseListTitles(listRes.body);
    if (!titles.length) throw new Error('no titles parsed from schedule list');
    return titles;
```

with:

```js
    const items = parseListTitles(listRes.body);
    if (!items.length) throw new Error('no titles parsed from schedule list');
    return { listTitle: parseListTitle(listRes.body), items };
```

- [ ] **Step 5:** Run all tests again: `node --test test/letterboxd.test.mjs` -> expect all PASS.
- [ ] **Step 6:** `npm run lint` -- expect no errors.
- [ ] **Step 7:** Commit:

```bash
git add web/src/lineup/letterboxd.js web/test/letterboxd.test.mjs
git commit -m "feat: parse the Letterboxd list's own title for the Lineup screen header"
```

### Task 9b: `data.js` -- real list title, 4-film estimate window, Friday cold-start, parental-guide passthrough

**Files:**
- Modify: `web/src/lineup/data.js`

**Interfaces:**
- Consumes: `fetchTonightsSchedule()`'s new `{ listTitle, items }` shape (Task 8b).
- Produces: `getTonightsLineup()` now returns `{ listTitle, items: [...] }` (items gain `rating`,
  `genres`, `parentalGuide`, `killCount`, `imdbId` fields, passed straight through from `lookupMovie`
  so browsing a film in `showNowPlayingCard` shows the same IMDb parental-guide chips/kill count
  the real now-playing card shows).

- [ ] **Step 1:** Replace the full contents of `web/src/lineup/data.js`:

```js
import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, medianGapSeconds } from './timing.js';

/* ==========================================================
   TONIGHT'S LINEUP -- data interface consumed by lineup/screen.js.
   Fetches + caches the Letterboxd schedule once per session, locates "now" in
   it via the live current title, and projects each of the next 4 upcoming
   films' ETA from TMDB runtimes plus a learned median bumper-gap (beyond that,
   compounding uncertainty isn't worth displaying as a time). Falls back to a
   Now/Next-only view (built purely from live changeMedia data) if the
   Letterboxd fetch fails, or to running-order-only (no times) if "now" can't
   be placed on the list -- except the one case where a coarse anchor still
   exists without a live match: Friday before the marathon's usual noon-Pacific
   start, where the first film gets a single "starts around then" estimate.
========================================================== */

let _scheduleCache = null;   // [{title, year}] for the whole weekend, or null before first fetch
let _listTitle = null;       // the real Letterboxd list's own title, shown as the screen header
let _fetchFailed = false;    // sticky for the session once Letterboxd is unreachable
let _lastChangeMedia = null; // most recent changeMedia payload (title), for the fallback
let _observedGapSeconds = []; // durations (s) of changeMedia items that didn't match the schedule
let _lastUnmatchedStart = null; // Date.now() when the current unmatched (bumper) item started

const FALLBACK_LIST_TITLE = 'Now / Next';
const MAX_ESTIMATED_AHEAD = 4; // only the next N upcoming films get any time estimate at all

// Learn bumper-gap duration live: a changeMedia title that doesn't match anything in
// tonight's schedule is a bumper; the time between it starting and the next
// (matched-or-not) changeMedia is one observed gap sample.
onSocket('changeMedia', (d) => {
    const title = d && d.title;
    const matchesSchedule = !!(title && _scheduleCache &&
        _scheduleCache.some(s => s.title.toLowerCase() === title.toLowerCase()));
    if (title && !matchesSchedule && _scheduleCache) {
        _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
        _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1000);
        _lastUnmatchedStart = null;
    }
    _lastChangeMedia = d || null;
});

async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    try {
        const result = await fetchTonightsSchedule();
        _scheduleCache = result.items;
        _listTitle = result.listTitle;
    } catch (e) {
        _fetchFailed = true;
    }
}

// Now/Next-only fallback: only what a plain viewer can see live, no future lineup.
function fallbackItems() {
    const items = [];
    if (movieState.lastMovieTitle) {
        items.push({
            cleanTitle: movieState.lastMovieTitle, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: true, etaLabel: '',
        });
    }
    if (_lastChangeMedia && _lastChangeMedia.title && _lastChangeMedia.title !== movieState.lastMovieTitle) {
        items.push({
            cleanTitle: _lastChangeMedia.title, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: 'LATE',
        });
    }
    return items;
}

// True only during the narrow window this heuristic exists for: the list is usually posted
// mid-week and showtime is "about Noon PST" on Friday, so before Friday noon Pacific we have
// no live anchor yet but CAN still make one coarse guess (the first film starts around then).
function isFridayBeforeNoonPacific(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    return weekday === 'Fri' && hour < 12;
}

// Every item's TMDB/IMDb-enriched fields, shared by both the matched and unmatched branches
// below -- including parentalGuide/killCount/imdbId/rating/genres, which lookupMovie() already
// fetches but earlier code dropped when building each item (browsing a film from the rail
// showed none of the parent-guide chips the real now-playing card shows).
function buildBase(info, title, year) {
    return {
        cleanTitle: info.cleanTitle || title,
        cleanYear: info.cleanYear || year,
        poster: info.poster || null,
        backdrop: info.backdrop || null,
        overview: info.overview || '',
        rating: info.rating ?? null,
        genres: info.genres || [],
        parentalGuide: info.parentalGuide || null,
        killCount: info.killCount ?? null,
        imdbId: info.imdbId || null,
    };
}

export async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return { listTitle: FALLBACK_LIST_TITLE, items: fallbackItems() };

    const infos = await Promise.all(_scheduleCache.map(({ title, year }) => lookupMovie(title, year)));
    const currentIndex = _scheduleCache.findIndex(s =>
        movieState.lastMovieTitle && s.title.toLowerCase() === movieState.lastMovieTitle.toLowerCase());

    if (currentIndex === -1) {
        // Can't place "now" on the list (a bumper is playing, an off-schedule item is airing,
        // or the marathon hasn't started this week) -- running order only, no times, per the
        // vision doc's "never display precision the data can't support" -- except the single
        // Friday-before-noon case, where the first film gets one coarse estimate.
        const fridayEstimate = isFridayBeforeNoonPacific();
        return {
            listTitle: _listTitle || FALLBACK_LIST_TITLE,
            items: _scheduleCache.map(({ title, year }, i) => ({
                ...buildBase(infos[i], title, year),
                isNowPlaying: false,
                etaLabel: (fridayEstimate && i === 0) ? '≈ Fri 12:00 PM' : 'LATE',
            })),
        };
    }

    const learnedGap = medianGapSeconds(_observedGapSeconds) ?? 600; // 10-min cold-start default
    let cumulative = Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds());
    const items = [];
    for (let i = currentIndex; i < _scheduleCache.length; i++) {
        const { title, year } = _scheduleCache[i];
        const info = infos[i];
        const base = buildBase(info, title, year);
        const offset = i - currentIndex;
        if (offset === 0) { items.push({ ...base, isNowPlaying: true, etaLabel: '' }); continue; }

        cumulative += learnedGap; // a bumper precedes this feature
        if (offset > MAX_ESTIMATED_AHEAD) {
            items.push({ ...base, isNowPlaying: false, etaLabel: 'LATE' });
        } else {
            const precision = offset === 1 ? 'exact' : 'approx';
            const eta = new Date(Date.now() + cumulative * 1000);
            items.push({ ...base, isNowPlaying: false, etaLabel: formatEta(eta.getHours(), eta.getMinutes(), precision) });
        }
        cumulative += info.runtime ? info.runtime * 60 : 0; // then this feature's own runtime
    }
    return { listTitle: _listTitle || FALLBACK_LIST_TITLE, items };
}
```

- [ ] **Step 2:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 3:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 4:** Commit:

```bash
git add web/src/lineup/data.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: real list title, 4-film estimate window, Friday cold-start estimate, parental-guide passthrough"
```

### Task 9c: `screen.js` + `tv.css` -- dynamic header/subtitle, poster aspect-ratio fix

**Files:**
- Modify: `web/src/lineup/screen.js`
- Modify: `web/src/styles/tv.css`

**Interfaces:**
- Consumes: `data.listTitle` from `getTonightsLineup()` (Task 9b).

- [ ] **Step 1:** In `web/src/lineup/screen.js`'s `ensureScreenDom`, replace:

```js
    screen.innerHTML = `
        <div id="sc-lineup-header">Tonight's Lineup</div>
        <div id="sc-lineup-rail"></div>`;
```

with:

```js
    screen.innerHTML = `
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <div id="sc-lineup-rail"></div>`;
```

- [ ] **Step 2:** In the same file's `renderItems`, set the header text from the real list title
      (add this as the first line of the function body):

```js
function renderItems(screen, data) {
    const header = screen.querySelector('#sc-lineup-header');
    if (header) header.textContent = (data && data.listTitle) || 'Grindhouse Lineup';
    const rail = screen.querySelector('#sc-lineup-rail');
```

  (keep the rest of the function exactly as it is -- only the two new lines are added before the
  existing `const rail = ...` line).

- [ ] **Step 3:** In `web/src/styles/tv.css`, replace the header rule:

```css
            #sc-lineup-header {
                color: #fff !important; font-size: 15px !important; font-weight: 700 !important;
                letter-spacing: 0.14em !important; text-transform: uppercase !important;
                opacity: 0.6 !important; margin-bottom: 28px !important;
            }
```

with (dropping the small-caps "eyebrow" treatment now that this holds a real, longer title, and
adding the new subtitle):

```css
            #sc-lineup-header {
                color: #fff !important; font-size: 20px !important; font-weight: 700 !important;
                line-height: 1.25 !important; margin-bottom: 4px !important;
            }
            #sc-lineup-subtitle {
                color: rgba(255,255,255,0.45) !important; font-size: 12px !important;
                margin-bottom: 24px !important;
            }
            body.sc-tv #sc-lineup-header { font-size: 26px !important; }
            body.sc-tv #sc-lineup-subtitle { font-size: 15px !important; }
```

- [ ] **Step 4:** In the same file, fix the poster aspect ratio to TMDB's real 2:3 ratio (currently
      220x308 / 260x364, neither of which is exactly 2:3, causing `background-size: cover` to crop
      the art) -- replace:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
```

with:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 330px !important; border-radius: 8px !important;
```

  and replace:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 364px !important; }
```

with:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 390px !important; }
```

- [ ] **Step 5:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 6:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 7:** Commit:

```bash
git add web/src/lineup/screen.js web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "feat: Lineup screen shows the real list title + disclaimer, fix poster aspect ratio"
```

### Task 10b (DEVICE, stage gate): Validate Round 3 changes -- STOP for explicit go-ahead

- [ ] **Step 1:** Rebuild, reinstall, launch on the TV against the live room.
- [ ] **Step 2:** Open the Lineup screen. Expect: the header shows the REAL current Letterboxd
      list title (not "Tonight's Lineup"), with "Titles/times may be subject to change." beneath
      it in a smaller, muted line.
- [ ] **Step 3:** Confirm posters fill their frame without visible cropping at the top/bottom.
- [ ] **Step 4:** If the current room item matches the schedule: confirm only the next 4 upcoming
      films show a time estimate (approx/exact), and the 5th-and-beyond show `LATE`.
- [ ] **Step 5:** If it's currently Friday before ~noon Pacific and nothing matches: confirm the
      first film shows an estimate around Friday noon and every other film shows `LATE` with no
      other times. On any other day/time with no match, confirm every film shows `LATE` (no
      Friday estimate).
- [ ] **Step 6:** OK on a film. Expect: the Now-Playing card in browse mode now shows IMDb
      parent-guide chips (and kill count, if in the community JSONL) exactly like the real
      now-playing card does.
- [ ] **Step 7: STOP.** Report results to the user and confirm Tonight's Lineup is complete, or
      note any follow-up.

### Task 9d (found during controller's own device smoke test, before handing to user): posters get flex-shrunk shorter than their specified size

**Files:**
- Modify: `web/src/styles/tv.css`

`.sc-lineup-poster` sits inside `.sc-lineup-item`, which is `display: flex; flex-direction:
column` — making HEIGHT the flex main axis for the poster. A flex item's `flex-shrink` defaults to
`1`, so on a screen where the item's available height is tight (verified live on a 960x540 test
device), the poster compresses below its specified `height` even though `width` stays correct —
silently reintroducing the aspect-ratio distortion Task 9c just fixed, just via a different
mechanism (flex compression instead of `background-size: cover` cropping).

- [ ] **Step 1:** In `web/src/styles/tv.css`, add `flex-shrink: 0` to `.sc-lineup-poster` — replace:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 330px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: cover !important; background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            }
```

with:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 330px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: cover !important; background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                flex-shrink: 0 !important; /* keep the 2:3 box exact; the item column may
                                              scroll/overflow before the poster compresses */
            }
```

- [ ] **Step 2:** `cd web && npm run bundle` — confirm it succeeds.
- [ ] **Step 3:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "fix: prevent Lineup poster art from being flex-shrunk off its 2:3 ratio"
```

### Task 9e (device feedback on Task 9c/9d): revert frame size, use `background-size: contain` instead

**Files:**
- Modify: `web/src/styles/tv.css`

> **Feedback:** growing the frame to TMDB's exact 2:3 ratio (Task 9c/9d) fixed the cropping but
> made the whole card too big -- the poster now dominates the tile, the leftmost item's edge
> doesn't fit in the panel, and there's no longer room to read a title/eta line below it. The
> actual fix should keep the ORIGINAL, liked frame size (220x308 base / 260x364 TV) and instead
> switch `background-size` from `cover` (crops to fill the box, which is what caused the original
> cropping complaint) to `contain` (scales the whole image to fit inside the box, preserving its
> aspect ratio -- a small letterbox gap on the sides is a much smaller cost than either cropping or
> blowing up the frame). `flex-shrink: 0` (Task 9d) stays -- still good practice regardless of size.

- [ ] **Step 1:** Replace the poster rule -- change:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 330px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: cover !important; background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                flex-shrink: 0 !important; /* keep the 2:3 box exact; the item column may
                                              scroll/overflow before the poster compresses */
            }
```

to:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: contain !important; background-repeat: no-repeat !important;
                background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                flex-shrink: 0 !important; /* keep the box exact regardless of available space */
            }
```

- [ ] **Step 2:** Revert the TV-size override -- change:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 390px !important; }
```

to:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 364px !important; }
```

- [ ] **Step 3:** `cd web && npm run bundle` -- confirm it succeeds.
- [ ] **Step 4:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "fix: revert Lineup poster frame to original size, use background-size:contain to avoid cropping"
```

### Task 9f (device feedback: still clipped): shrink header/subtitle/poster to fit the actual viewport, add shadow clearance

**Files:**
- Modify: `web/src/styles/tv.css`

> **Root cause traced on the actual test device (960x540):** the full vertical stack (screen
> padding + header + subtitle + rail padding + poster + gap + title + gap + eta) sums to more than
> the 540px viewport height once the header holds the REAL list title (a full sentence, e.g. 63
> characters) at the size tuned for the old short static label -- at that font size the sentence
> likely wraps to 2 lines, pushing the bottom of the tile (title/eta) off-screen. Separately, the
> "left side clipped" look is the poster's box-shadow/focus-ring glow getting cut off by the rail's
> own `overflow-x: auto` boundary, since the rail's left padding (4px) isn't enough clearance for a
> 30px shadow blur + focus outline on the leftmost item (nothing to scroll into on that side to
> reveal the rest of the effect). Fix: shrink header/subtitle text and margins (it's holding a
> sentence now, not a short label), reduce screen padding, trim the poster a bit further, reduce
> shadow blur radius (needs less clearance), widen the rail's side padding for shadow/focus
> clearance, and add `overflow-y: auto` on the screen itself as a safety net for even tighter
> screens.

- [ ] **Step 1:** Replace the screen padding -- change:

```css
            #sc-lineup-screen {
                position: fixed !important; inset: 0 !important;
                z-index: 20500 !important; /* below #sc-np-card (21000) so OK on a film covers this */
                background: rgba(6,4,9,0.97) !important;
                display: none !important; flex-direction: column !important;
                align-items: flex-start !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
                padding: 5vh 4vw !important; box-sizing: border-box !important;
            }
```

to:

```css
            #sc-lineup-screen {
                position: fixed !important; inset: 0 !important;
                z-index: 20500 !important; /* below #sc-np-card (21000) so OK on a film covers this */
                background: rgba(6,4,9,0.97) !important;
                display: none !important; flex-direction: column !important;
                align-items: flex-start !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
                padding: 2vh 4vw !important; box-sizing: border-box !important;
                overflow-y: auto !important; /* safety net: never let content become unreachable
                                                 on an especially short screen */
            }
```

- [ ] **Step 2:** Shrink the header/subtitle (it now holds a full sentence-length real list title,
      not a short static label) -- change:

```css
            #sc-lineup-header {
                color: #fff !important; font-size: 20px !important; font-weight: 700 !important;
                line-height: 1.25 !important; margin-bottom: 4px !important;
            }
            #sc-lineup-subtitle {
                color: rgba(255,255,255,0.45) !important; font-size: 12px !important;
                margin-bottom: 24px !important;
            }
            body.sc-tv #sc-lineup-header { font-size: 26px !important; }
            body.sc-tv #sc-lineup-subtitle { font-size: 15px !important; }
```

to:

```css
            #sc-lineup-header {
                color: #fff !important; font-size: 14px !important; font-weight: 700 !important;
                line-height: 1.25 !important; margin-bottom: 4px !important;
            }
            #sc-lineup-subtitle {
                color: rgba(255,255,255,0.45) !important; font-size: 11px !important;
                margin-bottom: 12px !important;
            }
            body.sc-tv #sc-lineup-header { font-size: 15px !important; }
            body.sc-tv #sc-lineup-subtitle { font-size: 12px !important; }
```

- [ ] **Step 3:** Widen the rail's side padding so the poster's shadow/focus-ring has clearance
      instead of being clipped by the scroll container's own edge -- change:

```css
            #sc-lineup-rail {
                display: flex !important; gap: 22px !important; width: 100% !important;
                overflow-x: auto !important; overflow-y: hidden !important;
                padding: 8px 4px 16px !important;
```

to:

```css
            #sc-lineup-rail {
                display: flex !important; gap: 22px !important; width: 100% !important;
                overflow-x: auto !important; overflow-y: hidden !important;
                padding: 8px 24px 14px !important;
```

- [ ] **Step 4:** Reduce the poster's shadow blur (needs less clearance, and reads lighter) and
      trim the TV poster size a bit further for safety margin on short screens -- change:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: contain !important; background-repeat: no-repeat !important;
                background-position: center !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                flex-shrink: 0 !important; /* keep the box exact regardless of available space */
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 10px 30px rgba(0,0,0,0.5) !important;
            }
```

to:

```css
            .sc-lineup-poster {
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: contain !important; background-repeat: no-repeat !important;
                background-position: center !important;
                box-shadow: 0 6px 14px rgba(0,0,0,0.45) !important;
                flex-shrink: 0 !important; /* keep the box exact regardless of available space */
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
```

- [ ] **Step 5:** Match the reduced shadow blur in the focus-ring rule -- change:

```css
            body.sc-tv .sc-lineup-item.sc-tv-focus .sc-lineup-poster {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32), 0 10px 30px rgba(0,0,0,0.5) !important;
            }
```

to:

```css
            body.sc-tv .sc-lineup-item.sc-tv-focus .sc-lineup-poster {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
```

- [ ] **Step 6:** Trim the TV poster/title/eta sizes for extra safety margin on short screens --
      change:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 364px !important; }
            body.sc-tv .sc-lineup-title { font-size: 19px !important; }
            body.sc-tv .sc-lineup-eta { font-size: 16px !important; }
```

to:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 340px !important; }
            body.sc-tv .sc-lineup-title { font-size: 16px !important; }
            body.sc-tv .sc-lineup-eta { font-size: 14px !important; }
```

- [ ] **Step 7:** `cd web && npm run bundle` -- confirm it succeeds.
- [ ] **Step 8:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "fix: shrink Lineup header/subtitle/poster to fit short screens, add shadow clearance"
```

### Task 9g (device feedback: visible side borders): make the TV poster frame an exact 2:3 ratio

**Files:**
- Modify: `web/src/styles/tv.css`

> **Feedback:** posters now fit and aren't cropped, but there are visible empty bars on the left
> and right of the art. Cause: `background-size: contain` only avoids cropping — it doesn't
> eliminate letterboxing/pillarboxing if the FRAME's own ratio doesn't match the image's ratio. The
> current TV frame (260x340) isn't exactly 2:3 (TMDB posters are always 2:3), so `contain` adds
> side bars to preserve the image's real proportions inside a frame that's proportionally too wide.
> Fix: narrow the width to exactly 2:3 at the height already confirmed to fit vertically (340px,
> verified via the Task 9f device pass) -- 226x339 is an exact 2:3 pair (226*3 = 339*2 = 678) and
> keeps the same vertical footprint, so no further viewport-fit re-verification should be needed.

- [ ] **Step 1:** Change the TV poster size to an exact 2:3 ratio -- replace:

```css
            body.sc-tv .sc-lineup-poster { width: 260px !important; height: 340px !important; }
```

with:

```css
            body.sc-tv .sc-lineup-poster { width: 226px !important; height: 339px !important; }
```

- [ ] **Step 2:** The item's flex-basis (which sets the column's overall width, currently matching
      the old 260px poster width) should shrink to match, so the tile's own box isn't wider than
      its poster -- replace:

```css
            body.sc-tv .sc-lineup-item { flex-basis: 260px !important; }
```

with:

```css
            body.sc-tv .sc-lineup-item { flex-basis: 226px !important; }
```

- [ ] **Step 3:** `cd web && npm run bundle` -- confirm it succeeds.
- [ ] **Step 4:** Commit:

```bash
git add web/src/styles/tv.css app/src/main/assets/cytube_mobile.js
git commit -m "fix: make the Lineup TV poster frame an exact 2:3 ratio, eliminating side letterboxing"
```

### Task 9h (device feedback: real bug): D-pad can't scroll the Lineup rail past the initially-visible items

**Files:**
- Modify: `web/src/tvnav.js`

> **Root cause:** the Lineup screen was designed to rely on the generic overlay `candidates()`
> path (scoped cone-weighted scorer) for Left/Right paging, on the assumption that being an
> `OVERLAY_IDS` member was enough. It isn't: `candidates()`'s generic list is filtered through
> `isVisible()`, which explicitly excludes any element whose bounding rect is off-screen
> (`r.right < 0 || r.left > innerWidth`). For a horizontally-scrolling rail, items beyond the
> initially-visible window are off-screen and therefore never enter the candidate list at all —
> so the D-pad can never move focus to them (a chicken-and-egg problem: an item only becomes
> visible once scrolled into view, but it can only be scrolled into view by first being focused).
> This is exactly the problem the Coming Attractions poster strip already solves with its own
> explicit, NOT-`isVisible`-filtered special case in `move()` — the Lineup rail needs the same
> treatment.

**Interfaces:**
- No new exports; this only adds a new branch inside `web/src/tvnav.js`'s existing `move()`
  function.

- [ ] **Step 1:** In `web/src/tvnav.js`'s `move(dir)`, insert a new special case immediately after
      the existing Coming Attractions poster-strip block and before the generic
      `const { scope, list } = candidates();` fallback. Find this exact code (the end of the
      poster-strip block):

```js
                    // up / down → step back out of the reel onto the toggle
                    posterZoom(focusEl, false);
                    if (toggle) setFocus(toggle);
                    return;
                }
            }
        }

        const { scope, list } = candidates();
```

Replace it with:

```js
                    // up / down → step back out of the reel onto the toggle
                    posterZoom(focusEl, false);
                    if (toggle) setFocus(toggle);
                    return;
                }
            }
        }

        // Tonight's Lineup rail: a horizontal reel like the Coming Attractions strip above —
        // items scrolled past the rail's edge are off-viewport but still valid targets, so
        // (like the poster strip) this list is NOT isVisible-filtered. Without this, the
        // generic candidates() path below would strand navigation at whatever's currently
        // on-screen, since isVisible() excludes anything scrolled out of view.
        const lineupScreen = document.getElementById('sc-lineup-screen');
        if (lineupScreen && lineupScreen.classList.contains('sc-lineup-visible') &&
            (dir === 'left' || dir === 'right')) {
            const rail = document.getElementById('sc-lineup-rail');
            const items = rail ? [...rail.querySelectorAll('.sc-lineup-item')] : [];
            if (items.length) {
                const i = items.indexOf(focusEl);
                const ni = dir === 'right' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
                setFocus(items[ni]);
                return;
            }
        }

        const { scope, list } = candidates();
```

- [ ] **Step 2:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 3:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 4:** Commit:

```bash
git add web/src/tvnav.js app/src/main/assets/cytube_mobile.js
git commit -m "fix: Lineup rail Left/Right can now reach items scrolled off the initial view"
```

### Task 9i (design change per user's domain knowledge + real list data): parse the list's Published date

**Files:**
- Modify: `web/src/lineup/letterboxd.js`
- Modify: `web/test/letterboxd.test.mjs`

> **Context:** the user asked whether we know when a fetched Letterboxd list was actually created,
> to tell a genuinely current list apart from a stale one left over from a prior week (relevant
> Mon/Tue, before the new list is posted ~Wednesday). Checked the real list page
> (`curl.exe`, 2026-07-06): it carries exactly one machine-readable timestamp,
> `<span class="published">Published <time datetime="2026-07-01T16:00:37.212Z">`. This task parses
> it; Task 9k uses it to gate on "is this list from the current week" using the actual system
> clock, rather than guessing from a fixed day-count or day-of-week.

**Interfaces:**
- Produces: `parseListPublishedDate(listPageHtml)` -> ISO datetime string or `null`.
  `fetchTonightsSchedule()`'s return shape gains a `publishedAt` field:
  `{ listTitle, publishedAt, items }`.

- [ ] **Step 1:** Add to `web/test/letterboxd.test.mjs` -- update the import line:

```js
import { findCurrentWeekListUrl, parseListPublishedDate, parseListTitle, parseListTitles } from '../src/lineup/letterboxd.js';
```

and add these two tests (the fixture is the real captured markup, 2026-07-06):

```js
const PUBLISHED_FIXTURE = '<p class="list-date"> <span class="published">Published <time datetime="2026-07-01T16:00:37.212Z" class="timeago -longform timeago-pending">2026-07-01T16:00:37.212Z</time></span> </p>';

test('parseListPublishedDate extracts the ISO timestamp from the Published span', () => {
    assert.strictEqual(parseListPublishedDate(PUBLISHED_FIXTURE), '2026-07-01T16:00:37.212Z');
});
test('parseListPublishedDate returns null when there is no Published span', () => {
    assert.strictEqual(parseListPublishedDate('<p>no date here</p>'), null);
});
```

- [ ] **Step 2:** Run to confirm the two new tests fail (module doesn't export
      `parseListPublishedDate` yet): `cd web && node --test test/letterboxd.test.mjs`.
- [ ] **Step 3:** In `web/src/lineup/letterboxd.js`, add the new function (place it after
      `parseListTitle`):

```js
// The list page's "Published <time datetime="...">" gives the list's own creation timestamp --
// used (Task 9k) to tell a genuinely current list apart from a stale one left from a prior week.
export function parseListPublishedDate(listPageHtml) {
    const m = listPageHtml.match(/<span class="published">[^<]*<time datetime="([^"]*)"/i);
    return m ? m[1] : null;
}
```

- [ ] **Step 4:** Change `fetchTonightsSchedule`'s return value -- replace:

```js
    const items = parseListTitles(listRes.body);
    if (!items.length) throw new Error('no titles parsed from schedule list');
    return { listTitle: parseListTitle(listRes.body), items };
```

with:

```js
    const items = parseListTitles(listRes.body);
    if (!items.length) throw new Error('no titles parsed from schedule list');
    return {
        listTitle: parseListTitle(listRes.body),
        publishedAt: parseListPublishedDate(listRes.body),
        items,
    };
```

- [ ] **Step 5:** Run all tests again: `node --test test/letterboxd.test.mjs` -- expect all PASS.
- [ ] **Step 6:** `npm run lint` -- expect no errors.
- [ ] **Step 7:** Commit:

```bash
git add web/src/lineup/letterboxd.js web/test/letterboxd.test.mjs
git commit -m "feat: parse the Letterboxd list's Published date"
```

### Task 9j: `timing.js` -- current-week check (using system time) + widened cold-start window

**Files:**
- Modify: `web/src/lineup/timing.js`
- Modify: `web/test/timing.test.mjs`

**Interfaces:**
- Produces: `isListForCurrentWeek(publishedAt, now = new Date())` -> boolean.
  `isBeforeFridayNoonPacific(now = new Date())` -> boolean (moved here from `data.js`, widened,
  and now independently unit-tested for the first time).

> Per the user: rather than a fuzzy "N days old" threshold, use the actual system clock to check
> whether the list's Published date falls in the *current* Mon-Sun calendar week (Pacific). A list
> published Wednesday always covers the Fri-Sun immediately following, in the same Mon-Sun week --
> so "published this week" is equivalent to "covers the upcoming/current weekend". This correctly
> flips from `true` to `false` exactly at the Monday boundary, which is precisely the "no longer
> Fri-Sun, and no new list yet" gap the user described.

- [ ] **Step 1:** Add to `web/test/timing.test.mjs` the new tests (alongside the existing ones --
      add this import line if not already present, and these test cases):

```js
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from '../src/lineup/timing.js';

// Fixed reference dates -- 2026-07-01 was confirmed a Wednesday from a real captured list page.
const PUBLISHED = '2026-07-01T16:00:37.212Z'; // Wed 2026-07-01, 09:00 PDT

test('isListForCurrentWeek: true for "now" later the same week (Friday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-03T20:00:00.000Z')), true);
});
test('isListForCurrentWeek: true for "now" on the last day of that week (Sunday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-05T20:00:00.000Z')), true);
});
test('isListForCurrentWeek: false once "now" crosses into the next week (Monday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-06T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false well into the next week (Wednesday)', () => {
    assert.strictEqual(isListForCurrentWeek(PUBLISHED, new Date('2026-07-08T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false when publishedAt is null', () => {
    assert.strictEqual(isListForCurrentWeek(null, new Date('2026-07-03T20:00:00.000Z')), false);
});
test('isListForCurrentWeek: false when publishedAt is unparseable', () => {
    assert.strictEqual(isListForCurrentWeek('not-a-date', new Date('2026-07-03T20:00:00.000Z')), false);
});

test('isBeforeFridayNoonPacific: true on Wednesday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-01T20:00:00.000Z')), true);
});
test('isBeforeFridayNoonPacific: true on Thursday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-02T20:00:00.000Z')), true);
});
test('isBeforeFridayNoonPacific: true Friday morning before noon Pacific', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-03T18:00:00.000Z')), true); // 11:00 PDT
});
test('isBeforeFridayNoonPacific: false Friday afternoon after noon Pacific', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-03T20:00:00.000Z')), false); // 13:00 PDT
});
test('isBeforeFridayNoonPacific: false on Saturday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-04T20:00:00.000Z')), false);
});
test('isBeforeFridayNoonPacific: false on Monday', () => {
    assert.strictEqual(isBeforeFridayNoonPacific(new Date('2026-07-06T20:00:00.000Z')), false);
});
```

  (If `formatEta`/`medianGapSeconds` are already imported from a prior task's test additions in
  this file, merge the import list rather than duplicating the import statement.)

- [ ] **Step 2:** Run to confirm the new tests fail (functions don't exist yet):
      `cd web && node --test test/timing.test.mjs`.
- [ ] **Step 3:** Add to `web/src/lineup/timing.js` (after the existing `medianGapSeconds`):

```js
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_MS = 86400000;

// A UTC-anchored timestamp for just d's Pacific CALENDAR DATE (no time-of-day) -- safe for
// day-difference arithmetic regardless of DST, since we never touch the time component.
function pacificDateOnly(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (t) => parts.find(p => p.type === t).value;
    return Date.UTC(+get('year'), +get('month') - 1, +get('day'));
}

function pacificWeekday(d) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).format(d);
}

// True if the list's Published timestamp falls within the current Mon-Sun week (Pacific) --
// i.e. this is genuinely the current week's list, not a stale one left from a prior week. A
// list published Wednesday always covers the Fri-Sun immediately following, in the same
// Mon-Sun calendar week, so "published this week" is equivalent to "covers the
// upcoming/current weekend".
export function isListForCurrentWeek(publishedAt, now = new Date()) {
    if (!publishedAt) return false;
    const pub = new Date(publishedAt);
    if (isNaN(pub.getTime())) return false;

    const todayIdx = WEEKDAY_INDEX[pacificWeekday(now)];
    const daysSinceMonday = (todayIdx + 6) % 7; // Mon=0 ... Sun=6
    const startOfWeek = pacificDateOnly(now) - daysSinceMonday * DAY_MS;
    const startOfNextWeek = startOfWeek + 7 * DAY_MS;

    const pubDay = pacificDateOnly(pub);
    return pubDay >= startOfWeek && pubDay < startOfNextWeek;
}

// True during the window the list exists but nothing live has started yet: the list is
// typically posted Wednesday for the upcoming Fri-Sun marathon, and showtime is "about Noon
// PST" on Friday. Wed/Thu/Fri-before-noon get one coarse "the first film starts around then"
// guess; Sat/Sun (marathon likely live already) and Mon/Tue don't -- and by the time this is
// checked, the caller has already confirmed via isListForCurrentWeek() that the list itself is
// genuinely current, so Mon/Tue staleness is handled separately, not by this function.
export function isBeforeFridayNoonPacific(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    if (weekday === 'Wed' || weekday === 'Thu') return true;
    if (weekday === 'Fri') return hour < 12;
    return false;
}
```

- [ ] **Step 4:** Run the tests again: `node --test test/timing.test.mjs` -- expect all PASS.
- [ ] **Step 5:** `npm run lint` -- expect no errors.
- [ ] **Step 6:** Commit:

```bash
git add web/src/lineup/timing.js web/test/timing.test.mjs
git commit -m "feat: current-week check (system time) + widened cold-start estimate window"
```

### Task 9k: `data.js` -- gate on the list actually being current, wire the widened estimate window

**Files:**
- Modify: `web/src/lineup/data.js`

**Interfaces:**
- Consumes: `isListForCurrentWeek`, `isBeforeFridayNoonPacific` from `./timing.js` (Task 9j);
  `fetchTonightsSchedule()`'s `publishedAt` field (Task 9i).

- [ ] **Step 1:** Update the imports -- replace:

```js
import { formatEta, medianGapSeconds } from './timing.js';
```

with:

```js
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from './timing.js';
```

- [ ] **Step 2:** Remove the now-redundant local `isFridayBeforeNoonPacific` function entirely --
      delete this whole block (it's replaced by the imported `isBeforeFridayNoonPacific`):

```js
// True only during the narrow window this heuristic exists for: the list is usually posted
// mid-week and showtime is "about Noon PST" on Friday, so before Friday noon Pacific we have
// no live anchor yet but CAN still make one coarse guess (the first film starts around then).
function isFridayBeforeNoonPacific(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    return weekday === 'Fri' && hour < 12;
}
```

- [ ] **Step 3:** Gate `ensureSchedule()` on the list actually being for the current week -- replace:

```js
async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    try {
        const result = await fetchTonightsSchedule();
        _scheduleCache = result.items;
        _listTitle = result.listTitle;
    } catch (e) {
        _fetchFailed = true;
    }
}
```

with:

```js
async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    try {
        const result = await fetchTonightsSchedule();
        if (!isListForCurrentWeek(result.publishedAt)) {
            // Stale -- this list covers a weekend from a prior week (most likely Mon/Tue,
            // before the new one is posted ~Wednesday). Treat it the same as a fetch
            // failure: fall back to the Now/Next-only view rather than show a whole
            // already-aired weekend's lineup as if it were still upcoming.
            _fetchFailed = true;
            return;
        }
        _scheduleCache = result.items;
        _listTitle = result.listTitle;
    } catch (e) {
        _fetchFailed = true;
    }
}
```

- [ ] **Step 4:** Update the call site -- replace:

```js
        const fridayEstimate = isFridayBeforeNoonPacific();
```

with:

```js
        const fridayEstimate = isBeforeFridayNoonPacific();
```

  (the local variable name `fridayEstimate` and the `'≈ Fri 12:00 PM'` label text stay exactly as
  they are -- only where the deciding function comes from changes.)

- [ ] **Step 5:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 6:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 7:** Commit:

```bash
git add web/src/lineup/data.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: fall back when the fetched list isn't for the current week"
```

### Task 9l (device feedback): extract MOTD poster-image reading into a shared module

**Files:**
- Create: `web/src/motd.js`
- Modify: `web/src/posters.js`

> **Context:** the "Now/Next" fallback (used when Letterboxd is unreachable or this week's list
> hasn't posted yet) doesn't work well as a user experience. Feedback: fall back to the same
> admin-curated "Coming Attractions" poster art the small strip already shows instead -- there's
> always something real to look at that way. Both the poster strip (`posters.js`) and the Lineup
> fallback (`lineup/data.js`, Task 9m) need the same MOTD-image-reading logic. Putting it in a
> shared `motd.js` (rather than having `data.js` import from `posters.js` directly) avoids a
> circular import: `posters.js` already imports `showLineupScreen` from `lineup/screen.js`, which
> imports `getTonightsLineup` from `lineup/data.js` -- `data.js` importing back from `posters.js`
> would complete a cycle.

**Interfaces:**
- Produces: `getMotdPosterImages()` -> array of `<img>` elements (empty array if `#motdrow`
  doesn't exist or has no qualifying images). Consumed by `posters.js` (this task) and
  `lineup/data.js` (Task 9m).

- [ ] **Step 1:** Create `web/src/motd.js`:

```js
/* ==========================================================
   MOTD POSTER IMAGES -- the admin-curated "Coming Attractions" art from
   #motdrow. Shared by the small poster strip (posters.js) and the
   Tonight's Lineup fallback (lineup/data.js) when Letterboxd isn't
   usable, so there's still real curated art to look at either way.
========================================================== */
export function getMotdPosterImages() {
    const motd = document.getElementById('motdrow');
    if (!motd) return [];
    return [...motd.querySelectorAll('img')].filter((img) => {
        // Poster images in the MOTD are 125x175 — keep portrait-ish images, skip wide banners.
        const w = parseInt(img.getAttribute('width') || '0', 10);
        const h = parseInt(img.getAttribute('height') || '0', 10);
        return h >= 100 && w <= 200;
    });
}
```

- [ ] **Step 2:** In `web/src/posters.js`, add the import at the top of the file:

```js
import { getMotdPosterImages } from './motd.js';
```

- [ ] **Step 3:** In `initPosterStrip()`, replace the inline MOTD lookup/filter -- change:

```js
export function initPosterStrip() {
    const motd = document.getElementById('motdrow');
    if (!motd) return;

    // Build the poster strip container from MOTD images
    const imgs = [...motd.querySelectorAll('img')].filter(img => {
        // Read HTML attributes (not rendered dimensions — motdrow is hidden so rendered = 0)
        const w = parseInt(img.getAttribute('width') || 0);
        const h = parseInt(img.getAttribute('height') || 0);
        // Poster images in the MOTD are 125x175 — keep portrait-ish images, skip wide banners
        return h >= 100 && w <= 200;
    });
    if (!imgs.length) return;
```

to:

```js
export function initPosterStrip() {
    // Build the poster strip container from MOTD images
    const imgs = getMotdPosterImages();
    if (!imgs.length) return;
```

- [ ] **Step 4:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 5:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 6 (DEVICE smoke, quick check only):** the small Coming Attractions poster strip
      (phone/touch behavior, or the toggle-button path if somehow reached) should look and behave
      completely unchanged -- this step is a pure refactor with no intended behavior change.
- [ ] **Step 7:** Commit:

```bash
git add web/src/motd.js web/src/posters.js app/src/main/assets/cytube_mobile.js
git commit -m "refactor: extract MOTD poster-image reading into a shared module"
```

### Task 9m (device feedback): fall back to the static Coming Attractions art, not a live Now/Next view

**Files:**
- Modify: `web/src/lineup/data.js`

**Interfaces:**
- Consumes: `getMotdPosterImages()` from `../motd.js` (Task 9l).

- [ ] **Step 1:** Add the import -- change:

```js
import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from './timing.js';
```

to:

```js
import { fetchTonightsSchedule } from './letterboxd.js';
import { lookupMovie, movieState } from '../metadata/tmdb.js';
import { onSocket } from '../socket.js';
import { getCurrentMediaSeconds, getCurrentPlaybackSeconds } from '../mediatime.js';
import { formatEta, isBeforeFridayNoonPacific, isListForCurrentWeek, medianGapSeconds } from './timing.js';
import { getMotdPosterImages } from '../motd.js';
```

- [ ] **Step 2:** Rename the fallback title constant to match what it now actually shows -- change:

```js
const FALLBACK_LIST_TITLE = 'Now / Next';
```

to:

```js
const FALLBACK_LIST_TITLE = 'Coming Attractions';
```

- [ ] **Step 3:** Rewrite `fallbackItems()` -- replace:

```js
// Now/Next-only fallback: only what a plain viewer can see live, no future lineup.
function fallbackItems() {
    const items = [];
    if (movieState.lastMovieTitle) {
        items.push({
            cleanTitle: movieState.lastMovieTitle, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: true, etaLabel: '',
        });
    }
    if (_lastChangeMedia && _lastChangeMedia.title && _lastChangeMedia.title !== movieState.lastMovieTitle) {
        items.push({
            cleanTitle: _lastChangeMedia.title, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: 'LATE',
        });
    }
    return items;
}
```

with:

```js
// Fallback when Letterboxd is unreachable or this week's list hasn't posted yet: the current
// item (if known) plus the same admin-curated "Coming Attractions" art the small poster strip
// shows -- no real title/time data for those, but still something real to look at instead of
// an empty or thin live-only view.
function fallbackItems() {
    const items = [];
    if (movieState.lastMovieTitle) {
        items.push({
            cleanTitle: movieState.lastMovieTitle, cleanYear: null,
            poster: null, backdrop: null, overview: '',
            isNowPlaying: true, etaLabel: '',
        });
    }
    getMotdPosterImages().forEach((img) => {
        items.push({
            cleanTitle: img.title || img.alt || 'Coming Attraction', cleanYear: null,
            poster: img.src, backdrop: null, overview: '',
            isNowPlaying: false, etaLabel: 'LATE',
        });
    });
    return items;
}
```

  Note: `_lastChangeMedia` is still read by the bumper-gap-learning `onSocket('changeMedia', ...)`
  listener elsewhere in this file -- only `fallbackItems()`'s own use of it is removed here, the
  variable itself and that listener are untouched.

- [ ] **Step 4:** `cd web && npm run lint` -- expect no errors.
- [ ] **Step 5:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` -- expect
      `bundled OK` and exit 0.
- [ ] **Step 6:** Commit:

```bash
git add web/src/lineup/data.js app/src/main/assets/cytube_mobile.js
git commit -m "fix: Lineup fallback shows the static Coming Attractions art, not a thin Now/Next view"
```
