# Zone-Based TV D-Pad Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `initTvNav()`'s single whole-page geometric focus scorer in `web/src/tvnav.js` with the five-zone model from the approved design spec, so cross-region nav bugs (e.g. Right-from-mute landing on the settings gear) are structurally impossible instead of patched with more special cases.

**Architecture:** Two small pure modules carry the parts of the algorithm that don't need a DOM — `web/src/tvnav/geometry.js` (the existing cone-weighted nearest-neighbor scorer, extracted verbatim) and `web/src/tvnav/doors.js` (the zone-to-zone door table, brand new and pure). `web/src/tvnav.js` keeps everything DOM-dependent: the four zone candidate-list builders, `zoneOf()`, and the rewritten `move()`/`closeTop()`. `initLoginTvNav()` and everything outside `tvnav.js` is untouched.

**Tech Stack:** No new dependencies. Same esbuild/`node:test`/eslint toolchain Phase 1 set up in `web/`. Runs in an isolated git worktree per `superpowers:using-git-worktrees` — do not execute this plan against the primary checkout.

**Spec:** `docs/superpowers/specs/2026-07-05-zone-based-tv-nav-design.md`. Implements Phase 2 of `docs/redesign-vision.md`.

## Global Constraints

- **Zero change to non-TV behavior** — every touched function is already gated behind `initTvNav()`'s `if (!isTv) return;` at the top of the file.
- **No changes to `initLoginTvNav()`** — it has its own separate, unrelated `candidates()`/`move()` pair earlier in the same file (lines 15–101 as of this writing). Do not touch it.
- **No changes to which elements exist or what they do when activated** — this plan only changes *how focus moves between them*. `setFocus`/`clearFocus`/`activate`/`revealChrome`, `tvNavState.setFocus`, and `window.__scTvKey`'s signature are unchanged (per the design's "What doesn't change" section), except for the one documented behavior change in Task 4 (Back-from-overlay restores focus).
- **The control-bar Left/Right x-order-stepping special case (today's `move()`, the block starting `// Control bar: Left/Right steps strictly along the bar's own controls in x-order`) is retired in Task 3**, not preserved. It was a patch for exactly the bug class zone-scoping eliminates structurally (see design's Problem section) — once Player Bar is its own candidate list, the geometric scorer alone gets Right-from-mute to CC correctly. Task 3's device checkpoint re-verifies this specific case to confirm the retirement was safe.
- **The bundle is committed**: after any change under `web/src/`, run `cd web && npm run bundle` and commit the regenerated `app/src/main/assets/cytube_mobile.js` in the same commit.
- **Lint clean**: `cd web && npm run lint` must pass after every step that touches `web/src/`.
- **Never send a real message into the live CyTube chat during testing.** `sc-chat-textarea` is a Chat-zone candidate, so device checks will D-pad onto it. Verify reachability/focus only (`document.activeElement.id === 'sc-chat-textarea'` via `tools/cdp.mjs`) and tab-autocomplete (Tab key, no Enter) without submitting. If a step is at risk of triggering a real send, first intercept the socket emit:
  ```bash
  node tools/cdp.mjs "window.__scChatIntercept=[];const s=window.socket;const orig=s.emit.bind(s);s.emit=(ev,...a)=>{if(ev==='chatMsg'){window.__scChatIntercept.push(a);return;}return orig(ev,...a);};"
  ```
  then afterward reload the page (`node tools/cdp.mjs "location.reload()"`) and grep `#messagebuffer` in a fresh `getOuterHTML`/logcat check to confirm the test string never appears.
- **Device checkpoint protocol:**
  - Ordinary *(DEVICE)* checkpoints (Tasks 1 and 4): if the user can test right now, drive it live and get their explicit confirmation before moving on; if they can't right now, stop and wait — resume this same task later, no release needed.
  - *(DEVICE, STAGE GATE)* checkpoints (Tasks 3 and 5) are different: if the user isn't physically at the TV, cut a release so they can test independently later without a live adb session. Bump `versionCode` by 1 and `versionName` to `2.6.0-rc1` (Task 3) / `2.6.0-rc2` (Task 5, if it needs a second round) / `2.6.0` (final, only once the user confirms Phase 2 is done), `assembleRelease`, copy to `grindhouse-v<versionName>.apk`, commit + push, `gh release create v<versionName> grindhouse-v<versionName>.apk --prerelease --notes-file <notes>` (drop `--prerelease` only on the final tag). Then **stop** — do not start the next task until the user confirms they tested the sideload.
- Current baseline: `versionCode 20` / `versionName "2.5.3"` (`app/build.gradle.kts`).

---

### Task 1: Extract the cone-weighted scorer into `web/src/tvnav/geometry.js`

Move-only: pin today's exact scoring algorithm behind a pure, testable function before anything about zones changes. `move()`'s behavior must be bit-for-bit identical after this task.

**Files:**
- Create: `web/src/tvnav/geometry.js`
- Create: `web/test/geometry.test.mjs`
- Modify: `web/src/tvnav.js` (the generic-scorer block inside `move()`, currently the code between `const { scope, list } = candidates();` and the scroll-fallback at the end of `move()`)

**Interfaces:**
- Produces: `pickDirectional(dir, curRect, rects)` — `dir` is `'left'|'right'|'up'|'down'`, `curRect`/each of `rects` is a plain `{left, top, width, height}` (a `DOMRect` satisfies this). `rects[i]` may be `null` (skip, e.g. the currently-focused element). Returns the index of the best match in `rects`, or `-1` if none qualify. Two-tier: a same-45°-cone candidate (`primary >= perp`) always beats an off-cone one regardless of raw score.

- [ ] **Step 1:** Create `web/test/geometry.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { pickDirectional } from '../src/tvnav/geometry.js';

test('no candidate in the pressed direction returns -1', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const behind = { left: 0, top: 100, width: 40, height: 40 }; // to the left
    assert.strictEqual(pickDirectional('right', cur, [behind]), -1);
});

test('nearest candidate wins when there is no cone conflict', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const near = { left: 160, top: 100, width: 40, height: 40 };
    const far = { left: 260, top: 100, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', cur, [near, far]), 0);
});

test('null entries (the focused element itself) are skipped', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const near = { left: 160, top: 100, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', cur, [null, near]), 1);
});

test('an on-axis candidate beats a closer off-cone one (the mute-vs-CC-button case)', () => {
    // cur = mute button. gear = closer overall but mostly above (off-cone).
    // cc = further away but directly to the right (on-cone). This is the exact
    // shape of the bug that motivated zone-scoping: geometry alone can prefer a
    // nearby button in an unrelated cluster over the correct one dead ahead.
    const mute = { left: 100, top: 500, width: 40, height: 40 };
    const gear = { left: 108, top: 490, width: 40, height: 40 };
    const cc   = { left: 160, top: 505, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', mute, [gear, cc]), 1); // cc, not gear
});
```

- [ ] **Step 2:** Run it to confirm it fails because the module doesn't exist yet:

Run: `cd web && node --test test/geometry.test.mjs`
Expected: FAIL — `Cannot find module '../src/tvnav/geometry.js'`

- [ ] **Step 3:** Create `web/src/tvnav/geometry.js`:

```js
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
```

- [ ] **Step 4:** Run it again to confirm it passes:

Run: `cd web && node --test test/geometry.test.mjs`
Expected: 4 passing

- [ ] **Step 5:** In `web/src/tvnav.js`, add the import at the top of the file (alongside the existing imports):

```js
import { pickDirectional } from './tvnav/geometry.js';
```

- [ ] **Step 6:** In `initTvNav()`'s `move()` function, find this block (the generic scorer, immediately after the poster-strip special case and before the final scroll-fallback):

```js
        const { scope, list } = candidates();
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }

        const cur = focusEl.getBoundingClientRect();
        const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
        // Two tiers: a candidate within 45° of the pressed direction (primary >= perp)
        // always beats one off to the side, however close the latter scores. Without
        // this, Right from the mute button picks the settings gear (4px rightward but
        // a whole cluster-height up) over the CC button dead ahead across the bar.
        // Off-cone candidates remain as fallback so loose diagonal hops still work.
        let best = null, bestScore = Infinity, cone = null, coneScore = Infinity;
        for (const el of list) {
            if (el === focusEl) continue;
            const r = el.getBoundingClientRect();
            const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
            let primary, perp;
            if (dir === 'left')       { if (dx > -4) continue; primary = -dx; perp = Math.abs(dy); }
            else if (dir === 'right') { if (dx < 4)  continue; primary = dx;  perp = Math.abs(dy); }
            else if (dir === 'up')    { if (dy > -4) continue; primary = -dy; perp = Math.abs(dx); }
            else                      { if (dy < 4)  continue; primary = dy;  perp = Math.abs(dx); }
            const score = primary + perp * 2;
            if (primary >= perp && score < coneScore) { coneScore = score; cone = el; }
            if (score < bestScore) { bestScore = score; best = el; }
        }
        if (cone) best = cone;
        if (best) { setFocus(best); return; }
        // No neighbour that way — scroll a scrollable region if we're in one
        if (dir === 'up' || dir === 'down') {
            const sc = (scope.querySelector && scope.querySelector('#sc-trivia-list, #sc-settings-modal, #messagebuffer')) ||
                       document.getElementById('messagebuffer');
            if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += (dir === 'down' ? 140 : -140);
        }
```

Replace it with:

```js
        const { scope, list } = candidates();
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }

        const cur = focusEl.getBoundingClientRect();
        const idx = pickDirectional(dir, cur, list.map(el => el === focusEl ? null : el.getBoundingClientRect()));
        if (idx !== -1) { setFocus(list[idx]); return; }
        // No neighbour that way — scroll a scrollable region if we're in one
        if (dir === 'up' || dir === 'down') {
            const sc = (scope.querySelector && scope.querySelector('#sc-trivia-list, #sc-settings-modal, #messagebuffer')) ||
                       document.getElementById('messagebuffer');
            if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += (dir === 'down' ? 140 : -140);
        }
```

`candidates()`, `MAIN_IDS`, and the control-bar x-order-stepping special case are untouched in this task — that cleanup is Task 3's job, together with the zone rewrite it depends on.

- [ ] **Step 7:** `cd web && npm run lint && npm run bundle && npm test`. Expected: lint clean, `bundled OK`, all tests (including the new geometry ones) pass.
- [ ] **Step 8 (DEVICE):** Build, install, run the full existing TV smoke pass (splash, chat reachability without sending, `C` cycle, settings open/save/persist, trivia, poster strip, and a full D-pad sweep of the current whole-page nav — CC/quality reachable, drawer reachable, chat reachable). This is a pure refactor: behavior must be bit-for-bit identical to before this task. Any difference is a bug in this extraction, not an intentional change.
- [ ] **Step 9:** Commit:

```bash
git add web/src/tvnav/geometry.js web/test/geometry.test.mjs web/src/tvnav.js app/src/main/assets/cytube_mobile.js
git commit -m "refactor: extract cone-weighted D-pad scorer into tvnav/geometry.js"
```

---

### Task 2: Door table module `web/src/tvnav/doors.js`

Pure addition, not wired into `tvnav.js` yet — nothing observable changes, so no device checkpoint.

**Files:**
- Create: `web/src/tvnav/doors.js`
- Create: `web/test/doors.test.mjs`

**Interfaces:**
- Produces: `ZONE` (an object of the four zone name constants: `TOP_STRIP`, `DRAWER`, `PLAYER`, `CHAT` — no `OVERLAY` constant, since the overlay/menu trap is handled separately in `tvnav.js` exactly as it is today). `resolveDoor(zone, dir, playerBarEmpty)` — `zone` is one of the `ZONE` values, `dir` is `'left'|'right'|'up'|'down'`, `playerBarEmpty` is a boolean. Returns the destination zone name if `dir` is a door out of `zone`, or `null` if it isn't (meaning: move within the current zone instead).

- [ ] **Step 1:** Create `web/test/doors.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { ZONE, resolveDoor } from '../src/tvnav/doors.js';

test('Top Strip: Down is the only door (to Player, or Chat if Player Bar is empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'down', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'down', true), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'up', false), null);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'left', false), null);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'right', false), null);
});

test('Control Drawer: Up goes to Top Strip, Right goes to Player (or Chat if empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'right', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'right', true), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'left', false), null);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'down', false), null);
});

test('Player Bar: Up/Left/Right are doors, Down is not', () => {
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'left', false), ZONE.DRAWER);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'right', false), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'down', false), null);
});

test('Chat: Up goes to Top Strip, Left goes to Player (or Drawer if Player Bar is empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'left', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'left', true), ZONE.DRAWER);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'right', false), null);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'down', false), null);
});
```

- [ ] **Step 2:** Run it to confirm it fails:

Run: `cd web && node --test test/doors.test.mjs`
Expected: FAIL — `Cannot find module '../src/tvnav/doors.js'`

- [ ] **Step 3:** Create `web/src/tvnav/doors.js`:

```js
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
```

- [ ] **Step 4:** Run it again:

Run: `cd web && node --test test/doors.test.mjs`
Expected: 4 passing

- [ ] **Step 5:** `cd web && npm run lint`. Expected: passes (the file isn't imported anywhere yet, so this only checks its own syntax/globals).
- [ ] **Step 6:** Commit:

```bash
git add web/src/tvnav/doors.js web/test/doors.test.mjs
git commit -m "feat: pure door-table module for zone-based TV nav (not yet wired)"
```

---

### Task 3: Rewire `move()` to the zone model (STAGE GATE)

The core deliverable: zone candidate-list builders, `zoneOf()`, and `move()`/`candidates()` rewritten to dispatch through `resolveDoor()` instead of scoring one merged whole-page list. Retires `MAIN_IDS` and the control-bar x-order-stepping special case (superseded — see Global Constraints).

**Files:**
- Modify: `web/src/tvnav.js`

**Interfaces:**
- Consumes: `pickDirectional(dir, curRect, rects)` from Task 1, `ZONE`/`resolveDoor(zone, dir, playerBarEmpty)` from Task 2.
- Produces (internal to `initTvNav()`, not exported — nothing outside this file calls them): `topStripCandidates()`, `drawerCandidates()`, `playerBarCandidates()`, `chatCandidates()`, `ZONE_BUILDERS` (a `{ [zoneName]: builderFn }` map), `zoneOf(el)`, `moveWithin(list, dir, scrollScope)`.

- [ ] **Step 1:** Add the import at the top of `web/src/tvnav.js`, alongside the Task 1 import:

```js
import { ZONE, resolveDoor } from './tvnav/doors.js';
```

- [ ] **Step 2:** Find this block in `initTvNav()` (currently right after `openVjsMenu()` / `controlBarTargets()`):

```js
    // 'sc-drm-open' first so it's the default focus when the DRM fallback is up; it's only a
    // candidate while the overlay exists (getElementById is null otherwise). It lives in the main
    // cluster — NOT OVERLAY_IDS — so the remote can still reach chat and the controls.
    const MAIN_IDS = ['sc-drm-open', 'sc-title-text', 'sc-chatmode-btn', 'sc-emote-proxy', 'sc-desync-btn', 'sc-settings-btn',
        'sc-usercount-btn', 'sc-poll-btn', 'sc-poster-toggle', 'sc-trivia-btn', 'sc-newmsg-pill', 'sc-chat-collapse-btn', 'sc-chat-textarea'];
    const FOCUS_SEL = 'button, a[href], input:not([type=hidden]), textarea, select, [tabindex]';

    const makeFocusable = (el) => {
        if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.tabIndex = -1;
    };

    function candidates() {
        // An open captions/quality menu traps focus to its items (Back closes it).
        const menu = openVjsMenu();
        if (menu) {
            const list = [...menu.querySelectorAll('.vjs-menu-item')].filter(isVisible);
            if (list.length) return { scope: menu, list };
        }
        const ov = openOverlay();
        if (ov) {
            let list = [...ov.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter(e => !e.disabled);
            if (!list.length) list = [ov]; // a click-to-dismiss overlay (e.g. the now-playing card)
            return { scope: ov, list };
        }
        const main = MAIN_IDS.map(id => document.getElementById(id)).filter(el =>
            el && isVisible(el) &&
            // The new-message pill is opacity-hidden (still sized) until shown — only
            // make it a focus target while it's actually visible.
            (el.id !== 'sc-newmsg-pill' || el.classList.contains('sc-show')));
        // Append the player's own controls so CC / quality / (free-watch) seek are
        // reachable by spatial nav alongside the app chrome.
        return { scope: document, list: main.concat(controlBarTargets()) };
    }
```

Replace it with:

```js
    // Zone model (see docs/superpowers/specs/2026-07-05-zone-based-tv-nav-design.md).
    // 'sc-drm-open' is first in Player Bar so it's the default focus when the DRM
    // fallback is up; it's only a candidate while that overlay exists in the DOM.
    const FOCUS_SEL = 'button, a[href], input:not([type=hidden]), textarea, select, [tabindex]';

    const makeFocusable = (el) => {
        if (!el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.tabIndex = -1;
    };

    function topStripCandidates() {
        const title = document.getElementById('sc-title-text');
        const badges = [...document.querySelectorAll('.sc-movie-link')];
        const trivia = document.getElementById('sc-trivia-btn');
        const toggle = document.getElementById('sc-poster-toggle');
        return [title, ...badges, trivia, toggle].filter(el => el && isVisible(el));
    }
    function drawerCandidates() {
        return ['sc-chatmode-btn', 'sc-desync-btn', 'sc-settings-btn']
            .map(id => document.getElementById(id)).filter(el => el && isVisible(el));
    }
    function playerBarCandidates() {
        const drm = document.getElementById('sc-drm-open');
        return [drm, ...controlBarTargets()].filter(el => el && isVisible(el));
    }
    function chatCandidates() {
        const header = ['sc-usercount-btn', 'sc-poll-btn', 'sc-chat-collapse-btn']
            .map(id => document.getElementById(id)).filter(el => el && isVisible(el));
        const emote = document.getElementById('sc-emote-proxy');
        const pill = document.getElementById('sc-newmsg-pill');
        const textarea = document.getElementById('sc-chat-textarea');
        // The new-message pill is opacity-hidden (still sized) until shown — only
        // make it a focus target while it's actually visible.
        return [...header, emote, (pill && pill.classList.contains('sc-show')) ? pill : null, textarea]
            .filter(el => el && isVisible(el));
    }
    const ZONE_BUILDERS = {
        [ZONE.TOP_STRIP]: topStripCandidates,
        [ZONE.DRAWER]: drawerCandidates,
        [ZONE.PLAYER]: playerBarCandidates,
        [ZONE.CHAT]: chatCandidates,
    };
    function zoneOf(el) {
        if (!el) return null;
        for (const name of Object.keys(ZONE_BUILDERS)) {
            if (ZONE_BUILDERS[name]().includes(el)) return name;
        }
        return null;
    }

    // Move within a single candidate list via the cone-weighted scorer, falling
    // back to scrolling scrollScope if nothing qualifies in an Up/Down press.
    function moveWithin(list, dir, scrollScope) {
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }
        const cur = focusEl.getBoundingClientRect();
        const idx = pickDirectional(dir, cur, list.map(el => el === focusEl ? null : el.getBoundingClientRect()));
        if (idx !== -1) { setFocus(list[idx]); return; }
        if ((dir === 'up' || dir === 'down') && scrollScope && scrollScope.scrollHeight > scrollScope.clientHeight) {
            scrollScope.scrollTop += (dir === 'down' ? 140 : -140);
        }
    }
```

- [ ] **Step 3:** In `move()`, find the control-bar x-order-stepping special case (retired — superseded by Player Bar zone scoping):

```js
        // Control bar: Left/Right steps strictly along the bar's own controls in
        // x-order. Spatial scoring is unreliable here — chrome buttons can sit a
        // hair inside the pressed direction's half-plane and steal the move, which
        // is how Right from mute ended up on the settings gear instead of CC.
        // Falls through at either end so the remote can still leave the bar. Skipped
        // while a captions/quality menu is open so the first press enters the menu
        // (candidates() scopes to its items) instead of sliding along the bar.
        if (focusEl && (dir === 'left' || dir === 'right') && !openVjsMenu()) {
            const barEls = controlBarTargets();
            if (barEls.includes(focusEl)) {
                const sorted = barEls.slice().sort((a, b) =>
                    a.getBoundingClientRect().left - b.getBoundingClientRect().left);
                const i = sorted.indexOf(focusEl);
                const ni = dir === 'right' ? i + 1 : i - 1;
                if (ni >= 0 && ni < sorted.length) { setFocus(sorted[ni]); return; }
            }
        }

```

Delete this block entirely (including the blank line after it).

- [ ] **Step 4:** Immediately after that deletion, find the trapped-scope handling and the generic-scorer call this task's earlier steps left behind:

```js
        const { scope, list } = candidates();
        if (!list.length) return;
        if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) { setFocus(list[0]); return; }

        const cur = focusEl.getBoundingClientRect();
        const idx = pickDirectional(dir, cur, list.map(el => el === focusEl ? null : el.getBoundingClientRect()));
        if (idx !== -1) { setFocus(list[idx]); return; }
        // No neighbour that way — scroll a scrollable region if we're in one
        if (dir === 'up' || dir === 'down') {
            const sc = (scope.querySelector && scope.querySelector('#sc-trivia-list, #sc-settings-modal, #messagebuffer')) ||
                       document.getElementById('messagebuffer');
            if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += (dir === 'down' ? 140 : -140);
        }
```

Replace it with:

```js
        // Trapped scopes: an open captions/quality menu or an open overlay claim the
        // whole D-pad until Back, exactly as before zones existed.
        const menu = openVjsMenu();
        if (menu) {
            const list = [...menu.querySelectorAll('.vjs-menu-item')].filter(isVisible);
            moveWithin(list, dir, null);
            return;
        }
        const ov = openOverlay();
        if (ov) {
            let list = [...ov.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter(e => !e.disabled);
            if (!list.length) list = [ov]; // a click-to-dismiss overlay (e.g. the now-playing card)
            const scrollScope = ov.querySelector('#sc-trivia-list, #sc-settings-modal, #messagebuffer') ||
                document.getElementById('messagebuffer');
            moveWithin(list, dir, scrollScope);
            return;
        }

        // Zone model: move within the current zone, or step through a door to the
        // adjacent zone's first candidate (matches today's list[0] fallback for
        // "nothing focused yet" — door hops are infrequent enough that geometric
        // nearest-to-exit-point isn't worth the extra complexity).
        const zone = zoneOf(focusEl) || ZONE.TOP_STRIP;
        const playerBarEmpty = playerBarCandidates().length === 0;
        const door = resolveDoor(zone, dir, playerBarEmpty);
        if (door) {
            const targetList = ZONE_BUILDERS[door]();
            if (targetList.length) setFocus(targetList[0]);
            return;
        }
        moveWithin(ZONE_BUILDERS[zone](), dir, document.getElementById('messagebuffer'));
```

- [ ] **Step 5:** Check the whole file for any remaining reference to `candidates()` or `MAIN_IDS` inside `initTvNav()` (there should be none — `initLoginTvNav()`'s own unrelated `candidates()` earlier in the file is untouched):

Run: `grep -n "MAIN_IDS\|candidates()" web/src/tvnav.js`
Expected: only the two hits inside `initLoginTvNav()` (its `const list = candidates();` and `const l = candidates();`), nothing else.

- [ ] **Step 6:** `cd web && npm run lint && npm run bundle && npm test`. Expected: lint clean (no leftover reference to the deleted `MAIN_IDS`/`candidates`), `bundled OK`, all tests pass.
- [ ] **Step 7 (DEVICE, STAGE GATE):** Full D-pad pass through all 5 zones and every door:
  - Up from Control Drawer, Player Bar, and Chat all land in Top Strip.
  - Down from Top Strip lands in Player Bar (raw/Drive item queued, so the video.js control bar exists).
  - Right from Control Drawer → Player Bar; Left from Player Bar → Control Drawer; Right from Player Bar → Chat; Left from Chat → Player Bar.
  - **Re-verify the CC/quality reachability case this redesign targets:** with a raw/Drive item playing, from the mute button, press Right — must land on CC (or the next real control), never the settings gear. This confirms zone-scoping alone (not the retired x-order special case) fixes it.
  - **Empty Player Bar fallthrough:** queue a YouTube item (no video.js control bar). Down from Top Strip must land in Chat, not get stuck. Right from Control Drawer must land in Chat directly.
  - Within-zone movement still works: Coming Attractions reel (Down from toggle enters it, Left/Right scrolls, Up/Down exits), desync-gated scrubber seek (Left/Right steps ±10s only while free-watch is on).
  - Chat reachability per the chat-safety rule above — do not send a real message.
  - If the user isn't at the device: follow the STAGE GATE protocol in Global Constraints (cut `2.6.0-rc1` as a prerelease, stop).
- [ ] **Step 8:** Commit:

```bash
git add web/src/tvnav.js
git commit -m "refactor: rewire TV D-pad nav to the five-zone model"
```

---

### Task 4: Back-from-overlay restores focus

The one documented behavior change: closing Overlay-stack member (settings, review modal, trivia, now-playing, users/poll panel) via Back returns focus to whatever opened it, instead of clearing focus outright. Scope is exactly the "Overlay stack" zone from the design spec — the poster strip is *not* in that zone (it's Top Strip's own reel) and keeps its current clear-on-close behavior.

**Files:**
- Modify: `web/src/tvnav.js`

- [ ] **Step 1:** In `initTvNav()`, declare a new tracking variable near the top, right after `let focusEl = null;`:

```js
    let preOverlayFocusEl = null;
```

- [ ] **Step 2:** Find `activate()`:

```js
    function activate() {
        if (!focusEl) { move('right'); return; }
        // OK on the scrubber would click at its origin and jump to 0 — seeking is
        // Left/Right only, so swallow the press here.
        if (focusEl.classList && focusEl.classList.contains('vjs-progress-control')) return;
        if (focusEl.tagName === 'TEXTAREA' || focusEl.tagName === 'INPUT') {
            if (focusEl.type === 'checkbox' || focusEl.type === 'range') focusEl.click();
            else { try { focusEl.focus(); } catch (e) {} } // let the on-screen keyboard open (if not suppressed)
            return;
        }
        // Picking a captions/quality item closes the menu — hand the ring back to its
        // control-bar button so we aren't stranded on the now-hidden item. closest()
        // finds the wrapper <div>; the focus candidate is its inner <button>.
        const ownerWrap = focusEl.classList && focusEl.classList.contains('vjs-menu-item') &&
            focusEl.closest('.vjs-menu-button');
        const ownerBtn = ownerWrap && ownerWrap.querySelector('button.vjs-menu-button');
        focusEl.click();
        if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
    }
```

Replace the last three lines (`const ownerWrap = ...` through the final `if (ownerBtn ...)`) with:

```js
        const ownerWrap = focusEl.classList && focusEl.classList.contains('vjs-menu-item') &&
            focusEl.closest('.vjs-menu-button');
        const ownerBtn = ownerWrap && ownerWrap.querySelector('button.vjs-menu-button');
        // Remember what opened an overlay so Back can restore focus to it instead
        // of just clearing the ring (see restoreFocusAfterOverlayClose()).
        const opener = focusEl;
        const hadOverlay = !!openOverlay();
        focusEl.click();
        if (!hadOverlay && openOverlay()) preOverlayFocusEl = opener;
        if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) { clearFocus(); setFocus(ownerBtn); }
    }
```

- [ ] **Step 3:** Add a new function right after `clearFocus()`:

```js
    // Back-from-overlay restores focus to whatever opened it (settings gear,
    // trivia button, ...) instead of leaving the ring cleared. Falls back to a
    // plain clearFocus() if the opener is gone or hidden.
    function restoreFocusAfterOverlayClose() {
        const restore = preOverlayFocusEl;
        preOverlayFocusEl = null;
        clearFocus();
        if (restore && isVisible(restore)) setFocus(restore);
    }
```

- [ ] **Step 4:** In `closeTop()`, replace the settings/modal/trivia/now-playing/users-poll branches' `clearFocus()` calls with `restoreFocusAfterOverlayClose()`. The vjs-menu branch (already restores focus to its own button) and the poster-strip branch (out of scope — not an Overlay-stack member) are unchanged. Find:

```js
        const settings = document.getElementById('sc-settings-overlay');
        if (settings && isVisible(settings)) {
            const c = document.getElementById('sc-settings-cancel');
            if (c) c.click(); else settings.remove();
            clearFocus(); return true;
        }
        const modal = document.getElementById('sc-modal-overlay');
        if (modal && isVisible(modal)) { (document.getElementById('sc-btn-cancel') || { click() { modal.remove(); } }).click(); clearFocus(); return true; }
        const trivia = document.getElementById('sc-trivia-card');
        if (trivia && trivia.classList.contains('sc-show')) { hideTriviaCard(); clearFocus(); return true; }
        const np = document.getElementById('sc-np-card');
        if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); clearFocus(); return true; }
        for (const id of ['sc-users-panel', 'sc-poll-panel']) {
            const p = document.getElementById(id);
            if (p && isVisible(p)) { p.style.display = 'none'; clearFocus(); return true; }
        }
```

Replace with:

```js
        const settings = document.getElementById('sc-settings-overlay');
        if (settings && isVisible(settings)) {
            const c = document.getElementById('sc-settings-cancel');
            if (c) c.click(); else settings.remove();
            restoreFocusAfterOverlayClose(); return true;
        }
        const modal = document.getElementById('sc-modal-overlay');
        if (modal && isVisible(modal)) { (document.getElementById('sc-btn-cancel') || { click() { modal.remove(); } }).click(); restoreFocusAfterOverlayClose(); return true; }
        const trivia = document.getElementById('sc-trivia-card');
        if (trivia && trivia.classList.contains('sc-show')) { hideTriviaCard(); restoreFocusAfterOverlayClose(); return true; }
        const np = document.getElementById('sc-np-card');
        if (np && np.classList.contains('sc-np-visible')) { hideNowPlayingCard(); restoreFocusAfterOverlayClose(); return true; }
        for (const id of ['sc-users-panel', 'sc-poll-panel']) {
            const p = document.getElementById(id);
            if (p && isVisible(p)) { p.style.display = 'none'; restoreFocusAfterOverlayClose(); return true; }
        }
```

- [ ] **Step 5:** `cd web && npm run lint && npm run bundle && npm test`. Expected: all pass.
- [ ] **Step 6 (DEVICE):** Open Settings via OK on the gear, press Back, confirm the focus ring is back on the gear (`node tools/cdp.mjs "document.activeElement && document.activeElement.id"` should report `sc-settings-btn`, and visually the orange ring is on it). Repeat for the trivia button (`T` shortcut or OK on `sc-trivia-btn`) → Back → ring back on `sc-trivia-btn`. Also confirm the poster strip still just clears focus on Back (unchanged, out of scope).
- [ ] **Step 7:** Commit:

```bash
git add web/src/tvnav.js
git commit -m "feat: Back-from-overlay restores focus to the element that opened it"
```

---

### Task 5: Full regression pass and phase close-out (STAGE GATE)

**Files:** none (verification only, plus the release artifacts).

- [ ] **Step 1:** `cd web && npm run lint && npm test && npm run bundle` all green. `node --check ../app/src/main/assets/cytube_mobile.js` exits 0.
- [ ] **Step 2 (DEVICE, STAGE GATE):** Run the design spec's full testing list end-to-end:
  - Full D-pad pass through all 5 zones and every door (repeat Task 3's checklist as a final confirmation).
  - CC/quality reachability re-verified on a raw/Drive item.
  - Empty-Player-Bar fallthrough re-verified on a live YouTube item.
  - Back-from-overlay focus restoration for settings and trivia (repeat Task 4's checklist).
  - Full existing smoke list (splash, chat reachability without a real send, `C` cycle, settings save/persist, poster strip) to confirm no regressions.
  - If the user isn't at the device: cut `2.6.0-rc2` as a prerelease per the STAGE GATE protocol and stop; otherwise get explicit confirmation that Phase 2 is done.
- [ ] **Step 3 (release, once the user confirms on-device):** Per the CLAUDE.md release recap: bump `versionCode` to 21 and `versionName` to `"2.6.0"` in `app/build.gradle.kts`, `assembleRelease`, copy `app-release.apk` → `grindhouse-v2.6.0.apk`, commit + push, `gh release create v2.6.0 grindhouse-v2.6.0.apk --notes-file <notes describing the zone-based nav rewrite>`.

## Verification (end of Phase 2)

- `cd web && npm run lint && npm test && npm run bundle` all green.
- `node --check app/src/main/assets/cytube_mobile.js` exits 0.
- Full manual smoke list plus the zone/door matrix passes on-device (TV), with no real chat message ever sent during testing.
- `git log --oneline` shows one concern per commit: geometry extraction, door table, zone rewiring, focus-restore.
