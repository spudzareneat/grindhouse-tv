# Grindhouse Redesign Vision

*Confirmed scope, 2026-07-03. Interactive concept mockups accompany this doc (Claude artifact "Grindhouse — Redesign Concepts").*

## Architecture verdict: keep it

A ground-up native rewrite (Compose + ExoPlayer + a direct socket.io client) was considered and rejected:

- CyTube's player zoo (YouTube iframe, Google Drive, raw files) comes **free** in a WebView; native YouTube playback on TV without one is a licensing/tech minefield.
- Sync, chat, emotes, auth, and playlist ride CyTube's own client code and stay compatible as CyTube updates.
- The native shell (~1,100 lines) does exactly what only native can do — encrypted keys, Cast SDK, PiP, D-pad capture, the Drive proxy — and nothing more.

The redesign therefore restructures the injected layer and improves UX on top of the existing WebView + injection model. Every feature below is client-side only; the app keeps its zero-backend property.

## Confirmed scope

### Structural

1. **Modularize `cytube_mobile.js`** (6,164 lines: ~3k logic, ~3k CSS in template literals). Split into modules (`metadata/`, `chat/`, `tv-nav/`, `theme/`, `cast/`) with an esbuild bundle step that still emits the single injected asset. Unlocks unit tests for the pure functions that keep regressing (`parseMovieFilename`, readability checks, nav scoring) and real `.css` files.
2. **Event-driven over DOM-watching.** The script already uses `socket.on('changeMedia'/'chatMsg'/'mediaUpdate')` in places, but also runs ~15 MutationObservers and standing intervals (emote watch @1s, monitor watch @800ms, Chat-Only media hold @1s). Migrate to socket events plus narrowly-scoped observers — battery, fewer races, and Chat-Only stops fighting the sync conductor once a second.
3. **Zone-based TV navigation.** Replace whole-page geometric focus scoring with five explicit zones — **Top Strip** (cleaned title + movie links + trivia button + the Coming Attractions poster reel) / **Control Drawer** / **Player Bar** / **Chat** / **Overlay stack** (settings, trivia panel, title card — each traps focus until Back). D-pad moves within a zone; zone transitions happen only at defined doors (e.g., Up from the player bar or chat always lands in the Top Strip; Left/Right traverse the poster reel within it). Geometric scoring survives *inside* a zone, where it works. Kills the recurring nav-tuning bug class (the CC/quality reachability fix was a symptom).
4. **Settings schema.** One settings object with declared defaults + migration replacing the loose `sc_*` localStorage keys (where `'off'` means enabled for some keys and `'on'` for others). Tabbed modal: Account / Appearance / Playback / Chat / Updates.

### UX

- **Phone-as-keyboard for TV.** `LocalMediaProxy` already runs an HTTP server on the TV; add a `/type` endpoint and a QR pairing card in Settings. A phone on the same Wi-Fi becomes the room's keyboard — no cloud, nothing leaves the LAN. Removes the worst TV moment (the on-screen keyboard).
- **Swipe between chat layouts** in vertical mode, with a visible mode pill — replaces the blind 4-state cycle button.
- **Bottom-sheet chat** in vertical mode — drag to any video/chat ratio; Chat-Only gets an explicit "Paused · Muted" banner instead of silently killing audio.
- **Promote Cast out of "experimental".** Castability badge on the current item ("Casts to TV" / "Plays on phone"), and honest slate copy during YouTube fallback.

### New features

- **Tonight's Lineup screen** — full-screen, D-pad-navigable weekend schedule on TV. Letterboxd supplies the *what*; live room telemetry supplies the *when*.
  - **Letterboxd integration (feasibility verified 2026-07-03):** `letterboxd.com/420grindhouse/lists/` returns 200 with a browser UA (the native HTTP bridge already fetches IMDb this way; generic bots get 403). Lists are newest-first and every weekly slug contains `grindhouse-schedule`, so "current week" = first matching `/420grindhouse/list/*schedule*/` link. The list page carries film titles in `alt` attributes and the `<meta name="description">` includes titles **with years** ("American Hunter (1988), …") for clean TMDB matching via the existing pipeline. The list notes only say "Showtime starts each day at about Noon PST" — never a source of per-film times.
  - **Timing model (viewer rank only — verified against the live room 2026-07-03):** the channel hides playlist *items* below moderator rank (`seeplaylist: 2`, not changeable for us), but a plain viewer still receives `changeMedia` (exact title + duration of **every** item as it starts, bumpers included), `mediaUpdate` (~5 s position + pause state), and `setPlaylistMeta` (queue **count** and **total** runtime — 31 items / 12 h 25 m when probed mid-marathon, so the room does queue far ahead). Times are therefore *estimated*, not read:
    1. TMDB-match the current item against the list (existing `parseMovieFilename` pipeline) → which feature is on + exact remaining time.
    2. Future features use TMDB runtimes.
    3. Bumper gaps are **learned live**: any `changeMedia` item that doesn't match the list is a bumper with an observed exact duration; keep a running median inter-feature gap. Calibration: `setPlaylistMeta.rawTime − Σ(remaining features' runtimes) ≈ total remaining bumper time` when the queue plausibly covers the rest of the day. Persist the learned gap across nights as the cold-start default.
    4. Re-anchor every ETA on each `changeMedia`; freeze while paused.
  - **Honest precision decay in the UI:** next feature "≈ 9:20 PM" (±5 min: exact remainder + one gap), mid-evening "~", tail of the night "LATE" (running order only, no time). Never display precision the data can't support.
  - **OK on any film opens the existing Now-Playing card in browse mode** (TMDB backdrop/poster/runtime, IMDb parent-guide chips, trivia) — the card renderer decouples from "currently playing" and is otherwise reused as-is.
  - Fallback when the Letterboxd fetch fails: Now/Next only, from `changeMedia`.
- **In-app update install** — extend the existing GitHub release checker with DownloadManager + a PackageInstaller intent: one-click update on TV instead of a link-out.
- **Watch stats** — local counters keyed off `changeMedia` ("34 features, 61 hours with this room").
- **Accessibility pass** — TalkBack labels on all injected buttons (there are none today); caption size/style controls surfaced in Settings.

### Explicitly out of scope

Un-hardcoding the channel URL, first-run coach marks, unread badge, film-grain toggle, summonable now-playing card, quick-reaction rail, reactions overlay, intermission bumpers, screensaver, multi-channel browsing, any server-side component.

## Phasing

| Phase | Contents |
|---|---|
| **1 — Foundations** | esbuild modularization · socket-event migration · settings schema + tabbed modal |
| **2 — TV Nav** | zone-based D-pad model |
| **3 — Features** | phone-as-keyboard · Tonight's Lineup (Letterboxd) · swipe + bottom-sheet chat · Cast promotion · in-app update install · watch stats · accessibility pass |

## What stays untouched (the soul of the app)

Splash-until-actually-playing · Now-Playing hero card · the `C` chat-layout cycle · the cast conductor (phone = brain, TV = renderer) · desync-gated seeking · Couch Mode / Watch-Along / LanguageTool review · the poster strip.
