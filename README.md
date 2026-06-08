# Grindhouse

A native **Android app for [CyTube](https://cytu.be)** — built for the couch on **Android TV** and tuned for **phones** too. It wraps a CyTube channel in a clean, cinematic shell so a watch‑party feels like a real streaming app instead of a web page.

> One app, two skins: it detects Android TV (Leanback) vs. phone at runtime and adapts the whole layout, controls, and chrome accordingly.

## Features

- **Cinematic shell** — branded splash that holds until the video is actually playing, then a 3‑second *Now‑Playing* intro card (TMDB backdrop, rating, runtime, genres).
- **Three chat layouts** — cycle **Sidebar → Overlay → Hidden** (press `C` or the on‑screen control); a translucent corner overlay or full‑bleed cinema, your call.
- **IMDb Parent Guide & Trivia** — severity chips (Sex/Violence/Profanity/Drugs/Frightening) on the card, plus a summonable Trivia panel (`T` or the title link).
- **Auto title cleanup** — pulls clean titles, posters, and IMDb/Letterboxd/Wiki links from TMDB; even attempts a match for full‑length YouTube movies.
- **TV‑first controls** — left‑edge control drawer, auto‑hiding chrome, larger type, focus rings, lock‑screen‑friendly playback.
- **Physical keyboard friendly** — optional on‑screen‑keyboard suppression so a hardware keyboard/mouse setup doesn't pop the soft keyboard.
- **Picture‑in‑Picture** on phones; clean exit on TV.

## Install

1. Download `app-release.apk` from the [latest release](../../releases/latest).
2. On your device, allow **“install unknown apps”** for your browser or file manager.
3. Open the APK and install. Requires **Android 10+**.

The same APK installs on phones and Android TV. On TV it appears on the home row with its own banner.

## Settings

Open the **⚙ settings** (in the control drawer) to:

- Add a free **TMDB API key** (unlocks posters, backdrops, links, and the info card).
- Toggle movie links, the on‑screen keyboard, grammar review, and chat font size.
- Log in to / switch CyTube accounts.

IMDb Parent Guide and Trivia need no key.

## Build from source

Open the project in **Android Studio** and hit Run, or from the command line:

```bash
./gradlew assembleDebug      # development build
./gradlew assembleRelease    # signed release (requires keystore.properties — see below)
```

Release signing reads a git‑ignored `keystore.properties` (pointing at a local keystore). Debug and release install **side by side** (the debug build uses a `.debug` package id), so you can develop without touching the installed release.

## How it works

It's a `WebView` wrapper that loads a CyTube channel and injects a single styling/behavior script (`app/src/main/assets/cytube_mobile.js`). A small native bridge handles secure key storage, the soft‑keyboard control, and CORS‑free HTTP for the IMDb/TMDB lookups.

## Notes

- IMDb data is fetched from IMDb's public GraphQL endpoint and is **for personal, non‑commercial use** per their terms.
- This is a hobby project and isn't affiliated with CyTube, IMDb, or TMDB.
