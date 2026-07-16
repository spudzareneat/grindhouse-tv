# Portrait Header Icon Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the phone-portrait header so Coming Attractions and Trivia can never drift off-position or get clipped, and give phone-width portrait compact icon buttons instead of text labels.

**Architecture:** `#videowrap-header` becomes a real CSS flex row in `body.sc-vertical`. The title (`.pull-left`) is the only flexible box (`flex:1; min-width:0` + ellipsis); the movie-link badges, Trivia, and Coming Attractions are `flex-shrink:0` and `position:static`, so they sit in normal document flow instead of being independently `position:fixed` with hand-computed viewport math. One JS change (`posters.js`) makes the Coming Attractions button a DOM child of the header so it can participate in that flex row (Trivia is already a header child). A phone-only (`max-width:540px`) media query then swaps both buttons' visible glyph to an emoji via `::before` — the real `textContent` stays as-is for the accessible label/tooltip, so no further JS change is needed for the icon swap.

**Tech Stack:** Vanilla JS + hand-written CSS (esbuild bundles `web/src/**` into `app/src/main/assets/cytube_mobile.js`, injected into a CyTube page inside an Android WebView). No DOM/CSS test framework exists in this repo (`web/test/*.test.mjs` covers pure-logic modules only — parsing, geometry, etc. — via Node's built-in test runner, no jsdom).

## Global Constraints

- Only `body.sc-vertical` styling changes. `body.sc-horizontal` and `body.sc-tv` keep their existing `position:fixed` overlay behavior untouched — TV never sets `sc-vertical`, so it is unaffected by any of these edits regardless.
- Icon-only glyph swap is scoped to the existing `@media (max-width: 540px), (max-height: 540px)` phone breakpoint. Tablet-width portrait (`sc-vertical` outside that breakpoint) keeps the current text labels ("Coming Attractions" / "Trivia").
- `app/src/main/assets/cytube_mobile.js` is a **generated file** (its own banner says so) — never hand-edit it. All source changes go in `web/src/**`; regenerate with `cd web && npm run bundle`.
- No jsdom/DOM-testing dependency exists and this plan does not add one — that would be new testing infrastructure beyond this fix's scope. Verification for the CSS/DOM-reparenting changes is: `npm run lint`, `npm test` (existing pure-logic suite, must stay green — regressions there would indicate an unrelated break), a successful `assembleDebug` build, and a manual on-device/screenshot check.
- No phone is attached this session (only a TV box, confirmed via `adb shell getprop ro.build.characteristics` → `tv,nosdcard`). The final on-device portrait check in Task 4 cannot be completed synchronously — flag it clearly rather than claiming it done.
- Building requires `JAVA_HOME` pointed at Android Studio's JBR (see `CLAUDE.md`): `export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`.

---

### Task 1: Reparent the Coming Attractions button into the header

**Files:**
- Modify: `web/src/posters.js:12-21` (`initPosterStrip`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `#sc-poster-toggle` is now a DOM child of `#videowrap-header` (falls back to `document.body` only if the header isn't in the DOM yet). Task 2's CSS flex rules rely on `#sc-poster-toggle` being inside `#videowrap-header` — they will not visually apply correctly until this task lands.

- [ ] **Step 1: Change the append target**

In `web/src/posters.js`, replace:

```js
export function initPosterStrip() {
    if (document.getElementById('sc-poster-toggle')) return; // re-init guard (settings.js calls this on MOTD updates)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sc-poster-toggle';
    toggleBtn.textContent = "Coming Attractions";
    toggleBtn.title = "Show tonight's lineup";
    toggleBtn.dataset.noTvCaption = '1'; // button text is self-explanatory; no remote caption
    toggleBtn.addEventListener('click', () => showLineupScreen());
    document.body.appendChild(toggleBtn);
}
```

with:

```js
export function initPosterStrip() {
    if (document.getElementById('sc-poster-toggle')) return; // re-init guard (settings.js calls this on MOTD updates)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sc-poster-toggle';
    toggleBtn.textContent = "Coming Attractions";
    toggleBtn.title = "Show tonight's lineup";
    toggleBtn.dataset.noTvCaption = '1'; // button text is self-explanatory; no remote caption
    toggleBtn.addEventListener('click', () => showLineupScreen());
    // Appended into the header (like #sc-trivia-btn already is) so portrait
    // layout can lay it out in the header's normal flex flow instead of
    // computing its position from the viewport. Fixed-position geometry
    // (landscape/TV) is computed against the viewport regardless of DOM
    // parent, so this is safe for those layouts too.
    const header = document.getElementById('videowrap-header');
    (header || document.body).appendChild(toggleBtn);
}
```

- [ ] **Step 2: Lint**

Run: `cd web && npm run lint`
Expected: no errors (this is a same-shape DOM call, no new patterns ESLint would flag).

- [ ] **Step 3: Commit**

```bash
git add web/src/posters.js
git commit -m "fix: append Coming Attractions button into the header, not body"
```

---

### Task 2: Flex-row header restructure (all `sc-vertical` widths)

**Files:**
- Modify: `web/src/styles/base.css:99-108` (`body.sc-vertical #videowrap-header`)
- Modify: `web/src/styles/base.css:390-395` (`body.sc-vertical #sc-poster-toggle`)
- Modify: `web/src/styles/tv.css:503-504` (`body.sc-vertical #sc-trivia-btn`)

**Interfaces:**
- Consumes: `#sc-poster-toggle` being a DOM child of `#videowrap-header` (Task 1). `#sc-trivia-btn` and `#sc-movie-links` are already header children (no change needed to produce that).
- Produces: a header that lays out as `[.pull-left title][#sc-movie-links][#sc-trivia-btn][#sc-poster-toggle]` in one flex row under `body.sc-vertical`, at any portrait width. Task 3's icon-only styling is scoped inside this same flex row via a narrower media query.

- [ ] **Step 1: Make the header a flex row and give the title the only flexible box**

In `web/src/styles/base.css`, replace:

```css
            /* Vertical: header is a real title bar above the video, not an overlay */
            body.sc-vertical #videowrap-header {
                width: 100vw !important;
                height: 36px !important; line-height: 36px !important;
                padding: 0 8px !important;
                background: rgba(12,10,20,0.92) !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                z-index: 10003 !important;
                text-shadow: none !important;
            }
```

with:

```css
            /* Vertical: header is a real title bar above the video, not an overlay.
               Flex row so the title/badges/action buttons share one line without
               any of them computing their own position from the viewport — the
               title is the only flexible box (shrinks + ellipsizes); everything
               else is flex-shrink:0 so it can never be pushed off-screen or
               clipped by a long title. This replaces the old position:fixed +
               viewport-math approach that let #sc-poster-toggle drift off its
               header alignment on phones with a nonzero safe-area-inset-top. */
            body.sc-vertical #videowrap-header {
                width: 100vw !important;
                height: 36px !important; line-height: 36px !important;
                padding: 0 8px !important;
                background: rgba(12,10,20,0.92) !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                z-index: 10003 !important;
                text-shadow: none !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            body.sc-vertical #videowrap-header .pull-left {
                flex: 1 1 auto !important;
                min-width: 0 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            body.sc-vertical #sc-movie-links {
                flex-shrink: 0 !important;
            }
```

- [ ] **Step 2: Retire `#sc-poster-toggle`'s fixed positioning in vertical**

In `web/src/styles/base.css`, replace:

```css
            body.sc-vertical #sc-poster-toggle {
                top: 0 !important;
                right: 0 !important;
                left: auto !important;
                bottom: auto !important;
            }
```

with:

```css
            /* Flows in the header's flex row instead of computing its own
               position from the viewport — see the #videowrap-header flex
               rules above. */
            body.sc-vertical #sc-poster-toggle {
                position: static !important;
                flex-shrink: 0 !important;
            }
```

- [ ] **Step 3: Retire `#sc-trivia-btn`'s `display:none` in vertical**

In `web/src/styles/tv.css`, replace:

```css
            /* Trivia button hidden in vertical — title bar is too narrow */
            body.sc-vertical #sc-trivia-btn { display: none !important; }
```

with:

```css
            /* Flows in the header's flex row instead of computing its own
               position from the viewport — see the #videowrap-header flex
               rules in base.css. Previously hidden entirely in vertical
               because the old fixed-position math had nowhere to put it. */
            body.sc-vertical #sc-trivia-btn {
                position: static !important;
                flex-shrink: 0 !important;
            }
```

- [ ] **Step 4: Lint and run the existing test suite**

Run: `cd web && npm run lint && npm test`
Expected: lint clean; all existing tests in `web/test/*.test.mjs` still pass (none of them touch CSS or these modules, so this is a regression guard, not new coverage).

- [ ] **Step 5: Commit**

```bash
git add web/src/styles/base.css web/src/styles/tv.css
git commit -m "fix: lay out portrait header as a flex row instead of fixed-position math"
```

---

### Task 3: Icon-only buttons on narrow phones + right-edge safe-area fix

**Files:**
- Modify: `web/src/styles/base.css:397-411` (existing `@media (max-width: 540px), (max-height: 540px)` block)

**Interfaces:**
- Consumes: the flex row from Task 2 (`#sc-poster-toggle` and `#sc-trivia-btn` as `flex-shrink:0` header children).
- Produces: on phone-width portrait only, both buttons render as 32×32px emoji tap targets (🍿 / 💡); `textContent` and `title` attributes are unchanged, so the accessible label and long-press tooltip stay intact. Nothing later in this plan depends on this task.

- [ ] **Step 1: Replace the button-specific safe-area rule with header-level right padding, and add the icon-swap rules**

In `web/src/styles/base.css`, replace:

```css
            /* Phones draw edge-to-edge, so rounded display corners / cutouts clip the
               top-corner chrome (movie title at the left, Coming Attractions at the right).
               Nudge them in from the very edge. Scoped to phones (≤540px on the short side,
               either orientation) so TV and tablets — which are larger — are untouched;
               env() adds extra room on devices that actually report a display cutout. */
            @media (max-width: 540px), (max-height: 540px) {
                body.sc-horizontal #videowrap-header,
                body.sc-vertical   #videowrap-header {
                    padding-left: max(18px, env(safe-area-inset-left, 0px)) !important;
                }
                body.sc-vertical #sc-poster-toggle {
                    right: max(16px, env(safe-area-inset-right, 0px)) !important;
                    top: env(safe-area-inset-top, 0px) !important;
                }
            }
```

with:

```css
            /* Phones draw edge-to-edge, so rounded display corners / cutouts clip the
               top-corner chrome (movie title at the left, action buttons at the right).
               Nudge them in from the very edge. Scoped to phones (≤540px on the short side,
               either orientation) so TV and tablets — which are larger — are untouched;
               env() adds extra room on devices that actually report a display cutout. */
            @media (max-width: 540px), (max-height: 540px) {
                body.sc-horizontal #videowrap-header,
                body.sc-vertical   #videowrap-header {
                    padding-left: max(18px, env(safe-area-inset-left, 0px)) !important;
                }
                /* Right-edge cutout/corner protection for the header's trailing flex
                   items (Trivia, Coming Attractions) — mirrors padding-left above.
                   This replaced per-button `right`/`top` positioning: now that both
                   buttons flow in the header (Task 2), a header-level padding-right
                   does the same job without either button needing to know its own
                   screen position — which is what let Coming Attractions drift off
                   in the first place (a mismatched `top: env(safe-area-inset-top)`
                   applied to the button but not to the header next to it). */
                body.sc-vertical #videowrap-header {
                    padding-right: max(16px, env(safe-area-inset-right, 0px)) !important;
                }
                /* Narrow phones: Coming Attractions and Trivia shrink to icon-only tap
                   targets so they never compete with the title for space. Real
                   textContent stays as the accessible label/tooltip source (title=
                   attribute); the emoji is a ::before so no JS change is needed here.
                   Tablet-width portrait (outside this media query) keeps the text
                   labels — there's room and this bug is phone-specific. */
                body.sc-vertical #sc-poster-toggle,
                body.sc-vertical #sc-trivia-btn {
                    width: 32px !important;
                    height: 32px !important;
                    padding: 0 !important;
                    font-size: 0 !important;
                    justify-content: center !important;
                }
                body.sc-vertical #sc-poster-toggle::before { content: "🍿" !important; font-size: 18px !important; }
                body.sc-vertical #sc-trivia-btn::before { content: "💡" !important; font-size: 18px !important; }
            }
```

- [ ] **Step 2: Lint**

Run: `cd web && npm run lint`
Expected: no errors (CSS-only change; esbuild's `.css` loader is `text`, not parsed/linted by ESLint).

- [ ] **Step 3: Commit**

```bash
git add web/src/styles/base.css
git commit -m "feat: icon-only Coming Attractions / Trivia buttons on narrow phones"
```

---

### Task 4: Rebuild, build-verify, and flag manual on-device check

**Files:**
- Modify (generated, via command — do not hand-edit): `app/src/main/assets/cytube_mobile.js`

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: an updated `cytube_mobile.js` asset and a debug APK proving the project still builds. No later task depends on this one.

- [ ] **Step 1: Regenerate the bundled asset**

Run: `cd web && npm run bundle`
Expected output: `bundled OK`

- [ ] **Step 2: Confirm only the generated asset changed alongside the source edits**

Run: `git status --short`
Expected: `app/src/main/assets/cytube_mobile.js` listed as modified, alongside the already-committed `web/src/**` changes from Tasks 1-3 (this file is committed separately here since it's a build artifact regenerated from source, not hand-edited).

- [ ] **Step 3: Commit the regenerated bundle**

```bash
git add app/src/main/assets/cytube_mobile.js
git commit -m "chore: rebuild cytube_mobile.js bundle"
```

- [ ] **Step 4: Sanity-build the debug APK**

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. This only proves the project still compiles and packages — it does **not** verify the layout looks right, since WebView-injected JS/CSS has no build-time layout check.

- [ ] **Step 5: Flag the outstanding manual verification**

No phone is attached this session (only a TV box). Before this is shippable, install the rebuilt debug APK on an actual phone, open a channel in portrait with a movie playing, and confirm:
- Coming Attractions and Trivia render as small icon buttons at the right edge of the title bar, vertically aligned with the title text — not floating over the video.
- A long movie title truncates with an ellipsis and never pushes the icons out of view.
- Tapping each icon still opens Tonight's Lineup / the Trivia card respectively.
- Rotate to a tablet-width portrait screen (or resize if testing via a resizable emulator) and confirm the text labels ("Coming Attractions" / "Trivia") still show there, unchanged.

Do not mark this task complete — or report the fix as done to the user — until this on-device check has actually happened. State this explicitly rather than assuming success from the build passing.

---

## Self-Review Notes

- **Spec coverage:** flex-row restructure (Task 2) ✓, title truncation via `.pull-left` ellipsis (Task 2, Step 1) ✓, icon-only phone buttons with 🍿/💡 (Task 3) ✓, tablet keeps text labels (Task 3, scoped to the narrow media query only) ✓, `#sc-poster-toggle` reparenting (Task 1) ✓, landscape/TV untouched (no edits to any `sc-horizontal`/`sc-tv`-scoped rule) ✓, on-device verification called out explicitly (Task 4) ✓.
- **Placeholder scan:** no TBD/TODO; every CSS/JS step shows complete before/after code, not a description of intent.
- **Type/name consistency:** `#sc-poster-toggle`, `#sc-trivia-btn`, `#sc-movie-links`, `#videowrap-header`, `.pull-left` are used identically across all three tasks; no renames introduced.
- **No fabricated tests:** this repo has no DOM/CSS test harness (only pure-logic Node tests). The plan does not invent jsdom coverage it can't actually exercise; it relies on lint + the existing regression suite + a real build + an explicitly-flagged manual check, matching how the "Bottom-sheet chat split" and other layout work in this repo has actually been verified (see `CLAUDE.md`/memory: `vsplit-bottom-sheet-shipped`).
