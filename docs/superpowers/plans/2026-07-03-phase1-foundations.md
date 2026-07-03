# Phase 1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the injected script into esbuild modules with tests, migrate DOM-polling to CyTube socket events, and centralize settings — with zero user-visible behavior change.

**Architecture:** The app stays a WebView shell (`MainActivity.kt`) that injects one JS asset. That asset becomes a **generated bundle**: source moves to `web/src/*`, esbuild bundles it back to `app/src/main/assets/cytube_mobile.js` (committed, so the Android build never needs Node). Extraction is move-only, one module per commit, verified on device between steps.

**Tech Stack:** esbuild (dev-only), Node's built-in `node:test` (no test framework dep), eslint@8 with `no-undef` as a cross-module safety net. No new runtime dependencies. WebView floor is Android 10 (Chromium ≥ 74 → ES2018 is safe).

**Spec:** `docs/redesign-vision.md` (structural items 1, 2, 4).

## Global Constraints

- **Never rename these window globals** — native code calls them: `__scTvKey`, `__scHttpResolve`, `__scStaleResync`, `__scSetCastMode`, `__scSetPlayerMuted`, `__scEnterCastFallback`, `__gdRealMeta` (drained by the `DRIVE_EARLY_STUB` queue in `MainActivity.kt`), and the JS→native interface object `CytubeNative`.
- **Preserve the `/login` early-return**: the script must keep doing almost nothing on `location.pathname.startsWith('/login')` except installing the login TV nav (see the `initLoginTvNav` section of the original file).
- **Move-only commits**: while extracting, never "improve" code in the same commit that moves it. If you spot a bug, note it and finish the move first.
- **Preserve top-to-bottom execution order**: `web/src/main.js` must import modules in the exact order their sections appear in the original file, and side-effectful statements stay side-effectful at import time.
- **Keep all existing DOM ids and `localStorage` keys byte-identical** (TV nav, native code, and existing installs depend on them).
- **The bundle is committed**: after any source change, run `npm run bundle` inside `web/` and commit the regenerated `app/src/main/assets/cytube_mobile.js` in the same commit.
- **Don't touch any Kotlin file in Phase 1.**
- Original file for reference during extraction: `app/src/main/assets/cytube_mobile.js` at the commit before Task 1 (6,164 lines). Locate sections by their banner comments (`/* ===== NAME ===== */`), **not** by line number — numbers shift as you extract.
- **Device checkpoints**: steps marked *DEVICE* need the app run on a phone/TV (`./gradlew assembleDebug`, install, watch `adb logcat -s GrindhouseWeb`). If no device is attached, stop and ask the user to run the checkpoint — do not skip it and do not proceed past a stage boundary without it. Remote-input note: with the local CDP tooling, OK is `__scTvKey('center')` — `'ok'` is not a valid direction.

**Manual smoke list** (used by every *DEVICE* checkpoint; test only what the step touched, run the full list at stage boundaries):
1. Splash holds until video plays, then hides. 2. Chat: send a message; tab-complete a username. 3. `C` cycles chat layouts; layout persists across restart. 4. Settings opens, saves a toggle, persists. 5. `T` opens trivia; title links present. 6. Poster strip toggles. 7. TV: D-pad reaches drawer, CC/quality menu, chat input; Back backgrounds the app. 8. Update check shows current release in Settings.

---

## Stage A — esbuild pipeline + modularization

### Task A1: Build pipeline with the legacy file wrapped unchanged

**Files:**
- Create: `web/package.json`, `web/build.mjs`, `web/.gitignore`, `web/src/main.js`
- Move: `app/src/main/assets/cytube_mobile.js` → `web/src/legacy.js` (git mv, content untouched)
- Generate: `app/src/main/assets/cytube_mobile.js` (now a build artifact, still committed)

**Interfaces:**
- Produces: `npm run bundle` (from `web/`) regenerates the asset; `npm test` runs `node --test`.

- [ ] **Step 1:** `git mv app/src/main/assets/cytube_mobile.js web/src/legacy.js`
- [ ] **Step 2:** Create `web/package.json`:

```json
{
  "name": "grindhouse-web",
  "private": true,
  "type": "module",
  "scripts": {
    "bundle": "node build.mjs",
    "test": "node --test test/",
    "lint": "eslint src/"
  },
  "devDependencies": { "esbuild": "^0.21.0", "eslint": "^8.57.0" }
}
```

- [ ] **Step 3:** Create `web/build.mjs`:

```js
import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2018',
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: '/* GENERATED FILE — do not edit. Source: web/src/**. Rebuild: cd web && npm run bundle */' },
  loader: { '.css': 'text' },
  outfile: '../app/src/main/assets/cytube_mobile.js',
});
console.log('bundled OK');
```

- [ ] **Step 4:** Create `web/src/main.js` containing exactly:

```js
import './legacy.js';
```

- [ ] **Step 5:** Create `web/.gitignore` containing `node_modules/`. Run `cd web && npm install && npm run bundle`. Expected: `bundled OK`.
- [ ] **Step 6:** `node --check ../app/src/main/assets/cytube_mobile.js` → exits 0. Open the bundle: confirm it still starts with the banner + an IIFE and contains `__scTvKey`.
- [ ] **Step 7 (DEVICE):** Build, install, run smoke items 1–5. Behavior must be identical to before.
- [ ] **Step 8:** Commit: `build: bundle injected script with esbuild (legacy wrapped unchanged)`

### Task A2: eslint no-undef safety net

Cross-module mistakes won't fail the esbuild build (a missed import becomes a silent `window.foo === undefined` at runtime). `no-undef` catches them at lint time.

**Files:**
- Create: `web/.eslintrc.json`

- [ ] **Step 1:** Create `web/.eslintrc.json`:

```json
{
  "root": true,
  "env": { "browser": true, "es2022": true },
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "rules": { "no-undef": "error", "no-unused-vars": "off" },
  "globals": {
    "socket": "readonly", "CLIENT": "readonly", "PLAYER": "readonly",
    "CHANNEL": "readonly", "CytubeNative": "readonly"
  }
}
```

- [ ] **Step 2:** `cd web && npm run lint`. Expected: passes on `legacy.js` (fix the globals list, never the code, if a legitimate CyTube page global is reported — add it to `"globals"`).
- [ ] **Step 3:** Commit: `build: lint with no-undef as extraction safety net`

### Task A3: Characterization tests for the pure functions

Pin current behavior **before** moving anything. These are approval tests: run the real function on real inputs, then hard-code the observed outputs as expectations.

**Files:**
- Create: `web/test/parse.test.mjs`, `web/test/readability.test.mjs`, `web/test/usercolors.test.mjs`
- Create: `web/src/parse.js`, `web/src/readability.js`, `web/src/usercolors.js` (extracted in Step 2)

**Interfaces:**
- Produces: `parse.js` exports `parseMovieFilename(raw)`; `readability.js` exports `detectReadabilityIssues(text)`; `usercolors.js` exports the name-hash/color function (use its existing name from the `USER COLOR SYSTEM` banner section).

- [ ] **Step 1:** Read the three sections in `web/src/legacy.js` (banners: `MOVIE TITLE CLEANING`, `READABILITY CHECKS`, `USER COLOR SYSTEM`). Note each function's exact signature and return shape.
- [ ] **Step 2:** Cut each function (and any private helpers/constants only it uses) into its module file with `export`. In `legacy.js`, add `import { parseMovieFilename } from './parse.js';` etc. at the top. `npm run lint` must pass — if it reports `no-undef` inside a moved function, the function had a hidden dependency; move or import that too.
- [ ] **Step 3:** Print actual outputs to build the expectations:

```bash
cd web && node -e "import('./src/parse.js').then(m => { for (const s of ['White.Fire.[1984].mkv','The.Patriot.2000.1080p.mp4','Uncle Sam','Some.Movie.2019.REMASTERED.x264-GRP.avi']) console.log(JSON.stringify(m.parseMovieFilename(s))); })"
```

- [ ] **Step 4:** Write the tests with the observed values pasted in as `deepStrictEqual` expectations (one `test()` per input; same pattern for `detectReadabilityIssues` with inputs like `'HELLO EVERYONE'`, `'asdfjkl;asdf'`, `'great movie!!!!!'`, `'a normal sentence.'`, and for the color hash with a few usernames).

```js
// web/test/parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { parseMovieFilename } from '../src/parse.js';
test('scene-style filename', () => {
  assert.deepStrictEqual(parseMovieFilename('White.Fire.[1984].mkv'), /* paste observed */);
});
```

- [ ] **Step 5:** `npm test` → all pass. `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js` → OK.
- [ ] **Step 6 (DEVICE):** Smoke item 5 (title cleanup + links still correct) and chat colors unchanged.
- [ ] **Step 7:** Commit: `refactor: extract pure functions with characterization tests`

### Task A4: Extract the CSS into .css files

**Files:**
- Create: `web/src/styles/base.css`, `web/src/styles/tv.css`, `web/src/styles/overlays.css` (split at the big CSS banner groups; exact grouping is your call, ids/rules byte-identical)
- Modify: `web/src/legacy.js`, `web/src/main.js`

- [ ] **Step 1:** Locate where `legacy.js` builds its giant CSS template literal(s) (starting at the `CSS + LOAD INIT` banner and the later TV/overlay blocks) and how it injects them (`<style>` append).
- [ ] **Step 2:** Cut the literal contents into the `.css` files. In `legacy.js`: `import baseCss from './styles/base.css';` (the esbuild `text` loader makes these plain strings) and concatenate in the original order into the same injection call. Nothing about injection timing changes.
- [ ] **Step 3:** `npm run bundle`; confirm the bundle still contains a distinctive rule (grep the bundle for `sc-poster-strip`). `node --check` passes.
- [ ] **Step 4 (DEVICE):** Full smoke list quickly — this touches everything visually. Compare against a screenshot taken before if unsure.
- [ ] **Step 5:** Commit: `refactor: move injected CSS to real .css files (bundled as text)`

### Task A5–A15: Extract feature modules, one per task/commit

**The extraction ritual (every module):**
1. Cut the banner-delimited section(s) into the module file, exporting its entry points; leave an `import` in `legacy.js` (or `main.js` once `legacy.js` shrinks away) at the exact spot the section used to occupy so execution order is unchanged.
2. `npm run lint` — fix every `no-undef` by importing/exporting the missing identifier (this is how you find hidden coupling; move shared state into the module that owns it and export accessors).
3. `npm run bundle && node --check ../app/src/main/assets/cytube_mobile.js && npm test`.
4. *DEVICE*: smoke only what the module owns (listed per task below).
5. Commit `refactor: extract <module>`.

Do them in this order (lowest coupling first). Banner names are from the original file:

| Task | Module | Original banner section(s) | Device smoke |
|---|---|---|---|
| A5 | `web/src/native.js` | `NATIVE HTTP (CORS-free)` | Settings → “Test key” works; trivia loads |
| A6 | `web/src/update.js` | `APP UPDATE CHECK` | Settings → App Updates shows release |
| A7 | `web/src/metadata/tmdb.js` | `MOVIE LINKS — TMDB lookup…` | Title links (IMDb/Letterboxd/Wiki) appear |
| A8 | `web/src/metadata/imdb.js` | `IMDb GraphQL…` | Parent-guide chips + trivia content |
| A9 | `web/src/cards/nowplaying.js` + `web/src/cards/trivia.js` | `NOW-PLAYING HERO CARD`, `TRIVIA CARD` | Card at feature start (TV); `T` panel |
| A10 | `web/src/player/drive.js` + `web/src/player/drm.js` + `web/src/player/resync.js` | `GOOGLE DRIVE VIDEO SUPPORT`, `YOUTUBE DRM FALLBACK`, the `__scStaleResync` block | A Drive item plays & seeks; app-switch resume |
| A11 | `web/src/grammar.js` | `LANGUAGETOOL…`, `INLINE ERROR REVIEW MODAL`, `SEND FLOW` | Misspelled message triggers review; send works |
| A12 | `web/src/chat/input.js` | `CHAT USERNAMES`, `TAB AUTOCOMPLETE`, `EMOTE MIRROR`, `CHAT TEXTAREA INSTALLATION`, `EMOTE BUTTON RELOCATION` | Autocomplete, emote button, typing on TV |
| A13 | `web/src/posters.js` | `POSTER STRIP`, `POLL / ANNOUNCEMENT WATCHER`, `USER COUNT PANEL` | Poster strip, poll popup, user count |
| A14 | `web/src/chat/modes.js` + `web/src/chrome.js` | chat-mode/pill/mention/leftzone/rightzone/tap-reveal functions (between the `CSS + LOAD INIT` and `TV REMOTE NAVIGATION` banners) + `FLOATING BUTTONS`/`DESYNC BUTTON`/settings-button add | `C` cycle, mention toast, edge drawers, desync |
| A15 | `web/src/tvnav.js` | `TV REMOTE NAVIGATION`, `initLoginTvNav`, `BOOT` | Full TV D-pad pass (smoke item 7) + login page nav |

- [ ] A5 … - [ ] A15 (one checkbox per task; each task = the 5-step ritual above)

- [ ] **Task A16: Retire `legacy.js`.** After A15, `legacy.js` should be only the settings modal (Stage C rewrites it) plus the API-keys/env/store top section. Rename what remains to `web/src/store.js` (keys/accessors) and `web/src/settings.js` (modal), update imports in `main.js`, ritual steps 2–5, commit `refactor: legacy.js fully dissolved`.
- [ ] **Task A17 (DEVICE, stage gate):** Full smoke list on phone **and** TV. Fix regressions before Stage B. Commit any fixes individually.

---

## Stage B — socket events replace polling/observers

### Task B1: `whenSocket` helper

**Files:** Create: `web/src/socket.js`; Test: `web/test/socket.test.mjs`

**Interfaces:**
- Produces: `whenSocket(cb)` — calls `cb(socket)` now if `window.socket` exists and has `.on`, else retries every 500 ms up to 60 s then gives up silently. Also `onSocket(event, handler)` = `whenSocket(s => s.on(event, handler))`.

- [ ] **Step 1:** Write the test (stub `window`): socket appears late → callback fires once; never appears → no throw.
- [ ] **Step 2:** Implement:

```js
// web/src/socket.js
export function whenSocket(cb, tries = 120) {
  const s = (typeof window !== 'undefined') && window.socket;
  if (s && typeof s.on === 'function') { cb(s); return; }
  if (tries <= 0) return;
  setTimeout(() => whenSocket(cb, tries - 1), 500);
}
export function onSocket(event, handler) { whenSocket(s => s.on(event, handler)); }
```

- [ ] **Step 3:** `npm test` passes. Commit: `feat: whenSocket helper for event-driven wiring`

### Tasks B2–B6: one migration per task

Each task: replace the polling mechanism with `onSocket(...)`, keep behavior identical, `npm run lint && npm run bundle && npm test`, *DEVICE* verify the feature, commit `refactor: <feature> is socket-driven`.

- [ ] **B2 — user count:** replace the MutationObserver in the `USER COUNT PANEL` code with `onSocket('usercount', n => updateCount(n))` (event payload is the integer; verified live 2026-07-03). Keep one initial DOM read at init for the pre-join value.
- [ ] **B3 — poll watcher:** replace the body-level observer with `onSocket('newPoll', showPanel)`, `onSocket('updatePoll', updatePanel)`, `onSocket('closePoll', hidePanel)`, mapping payloads to what the DOM scraper currently extracts (open the panel code to match fields; CyTube emits `{title, options, counts, timestamp}`-shaped data — log one real event to confirm before wiring).
- [ ] **B4 — emote mirror:** replace `emoteWatchInterval` (1 s poll) with `onSocket('emoteList', list => rebuildMirror(list))` + one initial rebuild at init.
- [ ] **B5 — title injection:** replace the `characterData` observers on the title header with `onSocket('changeMedia', d => triggerTitleInject(d.title))` + one initial call. Keep the observer **deleted**, not commented.
- [ ] **B6 — Chat-Only media hold:** replace the 1 s `_chatOnlyTimer` with: hold once on entry, re-hold on `onSocket('changeMedia', …)` and `onSocket('mediaUpdate', …)` while `_inChatOnly`, plus a 5 s safety interval (down from 1 s). The monitor-orientation 800 ms interval: replace with `matchMedia('(orientation: portrait)').addEventListener('change', …)` + `window.addEventListener('resize', …)` calling `applyMonitorLayout()`.
- [ ] **Task B7 (DEVICE, stage gate):** Full smoke + specifically: poll opens while in Chat-Only; emote picker after a mod edits emotes (or force by re-emitting); battery sanity — `adb shell top` shows the app near-idle when chat is quiet.

---

## Stage C — settings schema + tabbed modal

### Task C1: Schema module

**Files:** Create: `web/src/settings/schema.js`; Test: `web/test/schema.test.mjs`; Modify: `web/src/store.js` (its accessors move here)

**Interfaces:**
- Produces: `getSetting(name)` / `setSetting(name, value)` returning/accepting normalized types (booleans as booleans). **Storage keys and their legacy representations stay byte-identical** — no migration, existing installs must read the same values.

- [ ] **Step 1:** Write failing tests against a localStorage stub covering: defaults when unset; the two inverted keys; round-trip.
- [ ] **Step 2:** Implement:

```js
// web/src/settings/schema.js — storage stays legacy-compatible; normalization lives here.
const DEFS = {
  tmdbKey:      { key: 'sc_tmdb_key',           type: 'string', def: '' },
  onboarded:    { key: 'sc_onboarded',          type: 'flag',   def: false },          // set = true
  spellcheck:   { key: 'sc_spellcheck',         type: 'offbool', def: true },          // 'off' disables
  movieLinks:   { key: 'sc_movie_links',        type: 'offbool', def: true },
  chatFontSize: { key: 'sc_chat_fontsize',      type: 'string', def: '' },
  couchMode:    { key: 'sc_couch_mode',         type: 'onbool', def: false },          // 'on' enables
  watchAlong:   { key: 'sc_watch_along',        type: 'onbool', def: false },
  castMute:     { key: 'sc_cast_fallback_mute', type: 'onbool', def: false },
  chatMode:     { key: 'sc_chat_mode',          type: 'string', def: 'sidebar' },
  updateCache:  { key: 'sc_update_cache',       type: 'json',   def: null },
};
export function getSetting(n) {
  const d = DEFS[n]; const raw = localStorage.getItem(d.key);
  if (raw === null || raw === '') return d.def;
  if (d.type === 'offbool') return raw !== 'off';
  if (d.type === 'onbool') return raw === 'on';
  if (d.type === 'flag') return true;
  if (d.type === 'json') { try { return JSON.parse(raw); } catch { return d.def; } }
  return raw;
}
export function setSetting(n, v) {
  const d = DEFS[n];
  if (d.type === 'offbool') return localStorage.setItem(d.key, v ? 'on' : 'off');
  if (d.type === 'onbool') return localStorage.setItem(d.key, v ? 'on' : '');
  if (d.type === 'flag') return localStorage.setItem(d.key, '1');
  if (d.type === 'json') return localStorage.setItem(d.key, JSON.stringify(v));
  localStorage.setItem(d.key, String(v).trim());
}
```

- [ ] **Step 3:** Tests pass. **Step 4:** Replace every direct `sc_*` accessor across `web/src/` with schema calls (grep `getKey(LS_`, `couchModeEnabled`, `spellCheckEnabled`, `movieLinksEnabled`, `watchAlongEnabled`, `castFallbackMuted` — keep those helper names as thin wrappers over `getSetting` where they're widely used). Lint + bundle + test. **Step 5 (DEVICE):** toggles persist; a pre-existing install keeps its settings (verify by not clearing app data). **Step 6:** Commit.

### Task C2: Tabbed settings modal

**Files:** Modify: `web/src/settings.js`, `web/src/styles/overlays.css`

- [ ] **Step 1:** Read `openSettingsModal` end-to-end and inventory every control and its element id.
- [ ] **Step 2:** Reorganize into five tab panes — **Account** (CyTube login/switch), **Appearance** (chat font size, movie links), **Playback** (cast fallback mute, on-screen keyboard suppression), **Chat** (grammar review, couch mode, watch-along), **Updates** (version, check, release notes + download) — a `<nav>` of tab buttons toggling `display` on five `<div>` panes inside the existing modal container. **Every existing control keeps its current element id.** The TMDB key field goes at the top of **Account** (above login) — it's the app's one required key. First-run behavior (modal auto-opens when no TMDB key is set) is unchanged, and first-run must land on the Account tab.
- [ ] **Step 3:** TV check: the settings overlay is one focus-trapped zone for the D-pad — tab buttons must be reachable (they're ordinary focusable elements inside the overlay, the existing nav picks them up).
- [ ] **Step 4 (DEVICE):** first-run flow (clear app data once), every toggle on every tab, TV navigation through all five tabs. **Step 5:** Commit `feat: tabbed settings modal`.

### Task C3 (stage gate, DEVICE)

- [ ] Full smoke list on phone and TV. Tag the repo state mentally as “Phase 1 complete”; open a PR for the whole branch if working on one, or confirm all commits are pushed.

## Verification (end of Phase 1)

- `cd web && npm run lint && npm test && npm run bundle` all green.
- `node --check app/src/main/assets/cytube_mobile.js` exits 0.
- Full manual smoke list passes on **phone and TV**, including a pre-existing install (settings survive).
- `git log --oneline` shows one concern per commit; no commit mixes a move with a behavior change.
