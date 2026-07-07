# Phone-as-Keyboard — Design

**Status:** Approved 2026-07-07. Implements the "Phone-as-keyboard for TV" item of Phase 3,
`docs/redesign-vision.md`.

## Problem

The worst moment on the TV build is the on-screen keyboard: typing a chat message, logging in, or
pasting a TMDB API key with a D-pad means hunting-and-pecking across an on-screen grid one remote
click at a time. `LocalMediaProxy` already runs a localhost HTTP server on the TV (for Google Drive
byte-range proxying); the vision doc's proposal is to add a `/type` endpoint so a phone on the same
Wi-Fi can act as the room's keyboard — no cloud, nothing leaves the LAN.

## Goals

- Pair a phone to the TV via a QR code shown in Settings; typing on the phone mirrors live into
  whatever text field currently has focus on the TV.
- Cover every text field on the TV — chat, CyTube login (username/password), and Settings text
  fields (TMDB API key) — not just chat.
- Feel like a wireless keyboard: per-keystroke live mirroring, not type-then-submit.
- While a phone is actively paired and connected, suppress the Android on-screen keyboard so it
  doesn't compete for screen space (reusing the existing `CytubeNative.setSuppressKeyboard` path).
- Zero new runtime dependencies beyond one small vendored (offline, MIT) QR-encoder file — no CDN,
  no network calls beyond the existing LAN traffic.
- TV-only (`isTv` gated) — phones already have keyboards, so the Settings section doesn't appear on
  phone/tablet builds.

## Non-goals

- No multi-phone pairing. One active pairing at a time; pairing a new phone (or restarting the TV
  app) silently revokes the previous one. No explicit "Unpair" button for this iteration.
- No persistence of the pairing token across app restarts — it's in-memory only in `LocalMediaProxy`.
- No WebSocket implementation. See "Transport approach" below for why.
- No encryption of the LAN traffic. This is documented as an accepted trade-off, not solved here —
  see "Security note."

## Transport approach

Three options were considered:

- **A — Native push (chosen).** The phone POSTs each keystroke to a new `/type` route on
  `LocalMediaProxy` (the same raw-`ServerSocket` handler that already serves the Drive proxy and
  `/slate`). Kotlin forwards it to the page immediately via `webView.evaluateJavascript(...)` — the
  same mechanism already used for `__scTvKey` (D-pad forwarding) and `__scSetCastMode` (cast). No
  polling loop drives the actual typing channel; latency is one LAN round-trip. A separate, low-
  frequency (~1s) status poll carries only the "which field / connected?" indicator — not keystrokes
  — from both the phone page and the open Settings modal.
- **B — Pure short-poll both directions.** TV polls `/type/poll` every ~250ms for text changes.
  Simpler mental model, but reintroduces a standing interval on the TV exactly when Phase 1 (item #2,
  event-driven over DOM-watching) is trying to eliminate those, and adds perceptible input lag.
- **C — Real WebSocket.** Best theoretical latency, but `LocalMediaProxy` is hand-rolled sockets with
  no library available — implementing the WS handshake/framing by hand buys a latency win Approach A
  already gets via direct push.

Approach A reuses three patterns already proven in this codebase (raw-socket HTTP handling, CORS
headers already present on proxy responses via `Access-Control-Allow-Origin: *`, and native→JS push
via `evaluateJavascript`), and best matches the project's existing "event-driven, narrowly-scoped"
direction.

## Design

### Pairing lifecycle

Settings → Playback tab (existing tab, already has the "Disable on-screen keyboard" toggle; TV-only
section) gets a new "Phone Keyboard" group with a "Pair a phone" button. Tapping it:

1. Calls a new synchronous bridge method `CytubeNative.phoneKeyboardUrl(): String` (same call shape
   as the existing `gdProxyBase()`).
2. Native generates a fresh random token, discarding any previous pairing, and returns
   `http://<lan-ip>:<port>/type?t=<token>`, using `MainActivity`'s existing `lanIpAddress()` helper
   (currently `private`; the Cast feature already relies on it — promote its visibility as needed).
3. The Settings JS renders that URL as a QR code via a small vendored offline encoder
   (`web/src/vendor/qrcode.js` — MIT-licensed, single file, no network at runtime).
4. A status line under the QR polls `http://127.0.0.1:<port>/type/status?t=<token>` once per second,
   **only while the Settings modal is open**, flipping between "Waiting for phone…" and "Phone
   connected ✓".

### Phone-side page

Served by `LocalMediaProxy` at `GET /type?t=<token>` as a self-contained HTML string (same pattern as
`serveSlate`'s byte response) — no external resources, no build step needed on that side. Contents:

- One text `<input>`, autofocus, plus a "Send ⏎" button.
- On every `input` event: `POST /type?t=<token>` with `{ text, commit: false }`.
- On Enter/Go (the phone's own IME action) or the Send button: same POST with `commit: true`.
- Polls its own `/type/status?t=<token>` every ~1s to:
  - show a label for whatever TV field it's currently driving (Chat message / Username / Password /
    TMDB API key), sourced from the TV's last-focused element;
  - switch `input.type` to `password` when the status marks the field as masked, so a glance at the
    phone doesn't reveal a password being typed;
  - auto-clear its own input when a `revision` counter in the status response changes, meaning the TV
    moved focus to a different field.

### TV-side JS (`web/src/chat/keyboard.js`, new module)

- A `focusin`/`focusout` listener on `document` tracks the active editable element and calls
  `CytubeNative.setKeyboardFieldLabel(label, masked)` whenever it changes, so the phone's status
  endpoint has fresh data to serve.
- `window.__scPhoneKeyboard = (text, commit) => { ... }` is the native push target:
  - sets `document.activeElement.value = text` (no-ops if the active element isn't a text field);
  - dispatches a real `input` event so CyTube's own listeners and the existing chat-textarea logic
    (`installChatTextarea` in `settings.js`) fire exactly as if the user had typed it;
  - on `commit`, synthesizes an `Enter` keydown/keyup on the active element.
- While a phone is paired and connected, calls the existing `CytubeNative.setSuppressKeyboard(true)`
  path (the one already wired to the "Disable on-screen keyboard" toggle) so the Android soft
  keyboard doesn't pop up and fight the phone for screen space. Reverts when the phone disconnects
  (no status poll response within a short grace window) or is unpaired by a new pairing.

### Native (`LocalMediaProxy.kt`)

Extends the existing `handle()` dispatch (alongside `/slate` and the `/gd?u=` Drive proxy) with:

- `GET /type` — serve the phone-page HTML (token in the query string, checked before serving).
- `POST /type` — parse the `{ text, commit }` JSON body, validate the token, and forward to
  `MainActivity` (via a small callback interface, matching how the proxy already reports to the
  activity for the cast slate) which runs the `evaluateJavascript` push on the UI thread.
- `GET /type/status` — return `{ label, masked, revision, connected }` as JSON, with
  `Access-Control-Allow-Origin: *` (matching the existing proxy responses), so both the phone page and
  the Settings-modal loopback poll can read it via `fetch()`.

### Security note

Worth stating plainly since scope includes password fields: this is LAN-only, no different in trust
model from the existing Drive proxy (which already accepts arbitrary URLs on a `0.0.0.0`-bound socket
with zero auth token at all). A per-pairing random token is *more* auth than that existing proxy has
today. Text transits as cleartext HTTP on the local network, same as the rest of this app's local-only
traffic. This is an accepted, documented trade-off — not something this design attempts to solve with
TLS or LAN-scoped encryption.

## Testing plan

No pure functions worth unit-testing here — this is native-bridge wiring plus DOM event plumbing, so
verification is by device testing:

- Pair a phone from Settings; confirm the QR encodes a URL that loads the phone page over the LAN.
- Type into chat, the CyTube login fields, and the Settings TMDB-key field; confirm live mirroring
  and that Enter/commit behaves correctly for each (send chat, submit login, no-op for the key field).
- Confirm the phone page shows the correct field label and masks input for the password field.
- Confirm the on-screen keyboard is suppressed while the phone is connected and returns to normal
  once it disconnects.
- Re-pair a second phone and confirm the first one's requests are rejected (stale token).
- Restart the TV app and confirm the old token no longer works.
