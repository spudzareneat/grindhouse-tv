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
3. **Zone-based TV navigation.** Replace whole-page geometric focus scoring with explicit zones — Player Bar / Chat / Control Drawer / Overlay stack. D-pad moves within a zone; zone transitions happen only at defined edges; overlays trap focus until Back. Geometric scoring survives *inside* a zone, where it works. Kills the recurring nav-tuning bug class (the CC/quality reachability fix was a symptom).
4. **Settings schema.** One settings object with declared defaults + migration replacing the loose `sc_*` localStorage keys (where `'off'` means enabled for some keys and `'on'` for others). Tabbed modal: Account / Appearance / Playback / Chat / Updates.

### UX

- **Phone-as-keyboard for TV.** `LocalMediaProxy` already runs an HTTP server on the TV; add a `/type` endpoint and a QR pairing card in Settings. A phone on the same Wi-Fi becomes the room's keyboard — no cloud, nothing leaves the LAN. Removes the worst TV moment (the on-screen keyboard).
- **Swipe between chat layouts** in vertical mode, with a visible mode pill — replaces the blind 4-state cycle button.
- **Bottom-sheet chat** in vertical mode — drag to any video/chat ratio; Chat-Only gets an explicit "Paused · Muted" banner instead of silently killing audio.
- **Promote Cast out of "experimental".** Castability badge on the current item ("Casts to TV" / "Plays on phone"), and honest slate copy during YouTube fallback.

### New features

- **Tonight's Lineup screen** — full-screen, D-pad-navigable weekend schedule on TV.
  - **Letterboxd integration (feasibility verified 2026-07-03):** `letterboxd.com/420grindhouse/lists/` returns 200 with a browser UA (the native HTTP bridge already fetches IMDb this way; generic bots get 403). Lists are newest-first and every weekly slug contains `grindhouse-schedule`, so "current week" = first matching `/420grindhouse/list/*schedule*/` link. The list page carries film titles in `alt` attributes and the `<meta name="description">` includes titles **with years** ("American Hunter (1988), …") for clean TMDB matching via the existing pipeline; list notes carry showtime text.
  - Fallback when no list matches: build the lineup from CyTube's own (currently CSS-hidden) playlist data.
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
