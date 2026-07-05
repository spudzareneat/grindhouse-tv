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

### Task 5: Entry point — OK on a poster opens the Lineup screen (TV only)

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

- [ ] **Step 2:** In `initPosterStrip()`'s `imgs.forEach(...)` loop, add a click handler on the
      wrapper anchor (right after it's created, before it's appended to the strip):

```js
        const wrap = document.createElement('a');
        wrap.appendChild(thumb);
        // TV only: OK opens the full Tonight's Lineup screen instead of just the
        // hover-zoom preview (which tvnav.js's setPosterFocus already triggers on
        // focus). The click event still bubbles to the document-level dismiss
        // handler above, which collapses the zoom — harmless, since we're navigating
        // to a full-screen overlay anyway.
        if (isTv) wrap.addEventListener('click', () => showLineupScreen());
        strip.appendChild(wrap);
```

- [ ] **Step 3:** `cd web && npm run lint` — expect no errors.
- [ ] **Step 4:** `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` — expect
      `bundled OK` and exit 0.
- [ ] **Step 5:** Commit:

```bash
git add web/src/posters.js app/src/main/assets/cytube_mobile.js
git commit -m "feat: OK on a poster opens Tonight's Lineup (TV)"
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
