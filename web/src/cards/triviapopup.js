import { fetchImdbTrivia, fetchCastAndDirector, fetchPersonTrivia, fetchPersonKnownFor } from '../metadata/imdb.js';
import { npState } from './nowplaying.js';
import { isYouTubeMedia } from '../titleinject.js';
import { triviaPopupEnabled, triviaPopupFrequency } from '../store.js';
import { inSubtitlesMode, addSubtitleTrivia, clearSubtitleTrivia, SUBTITLE_LINE_TTL_MS } from './subtitles.js';
import { isMovieSubtitlesVisible } from '../subtitles/overlay.js';
import { isTv } from '../tvdetect.js';
import { tpSafeImageUrl, tpDueFact, tpCatchUpFact, tpDriveInAction, TP_DRIVEIN_SEEN_KEY } from '../trivia/curated.js';
import { fetchCuratedTrivia, fetchDriveInCard, CURATED_RECHECK_MS } from '../trivia/sources.js';
import { showDriveInCard, hideDriveInCard, isDriveInCardUp } from './driveincard.js';

/* ==========================================================
   POP-UP TRIVIA BUBBLES — "VH1 Pop-up Video" style ambient trivia.
   Ported from the sibling PC userscript's trivia-popup module. Reuses
   fetchImdbTrivia() (metadata/imdb.js, already cached per tconst) and
   npState (cards/nowplaying.js) instead of the PC script's separate
   _currentImdbId global -- same poll-and-diff idiom (no pub/sub exists
   in this codebase for "movie changed"; titleinject.js writes npState.data
   directly, so this just diffs it on a lightweight heartbeat, which
   doubles as the scheduler that decides when the next bubble is due).

   Settings here are poll-per-use, not event-driven (Settings Save just
   writes localStorage, nothing notifies running code), so
   triviaPopupEnabled() and the playback-eligibility check both get
   re-read every time a pop is attempted, not just once at boot --
   otherwise turning the toggle off mid-movie wouldn't stop already-
   scheduled popups.

   Also mixes in cast & crew facts (top 3 billed cast + first-credited
   director's own trivia, capped 3/person, plus a synthesized "also
   known for"/"also starred in" line) alongside the movie's own trivia --
   ported from the same base-script module's cast/crew enrichment
   follow-up. Queue items are { text, byline } objects so those facts can
   show an attribution line; movie-own trivia keeps byline: null.
   Enrichment is fetched non-blockingly after the movie's own trivia is
   already queued/scheduled, so a slow cast/crew burst can't stall the
   base feature.

   Movies with a curated Pop-up Video file (trivia/sources.js) skip all of
   that and run in timeline mode instead: hand-picked facts timed to the
   movie, so everyone in the channel sees each one at the same moment, and
   missed ones (late join / seek) surface in the gaps. Movies in Joe Bob's
   Drive-In Totals CSV also get the animated Drive-In Totals card at 0:15
   (cards/driveincard.js) -- on TV only; phones list it in the Trivia card.
========================================================== */

const TP_POLL_MS      = 3000;            // heartbeat: detect movie change + drive the scheduler

// Gap range (ms) between pops, keyed by the "Pop-up frequency" setting -- read fresh on every
// scheduling decision (see _tpScheduleNextPop), same poll-per-use reasoning as triviaPopupEnabled().
// 'occasional' is the original/default timing; 'frequent' and 'rare' bracket it.
const TP_GAP_TIERS = {
    frequent:   [45 * 1000,      90 * 1000],
    occasional: [3 * 60 * 1000,  6 * 60 * 1000],
    rare:       [8 * 60 * 1000, 15 * 60 * 1000],
};
function _tpGapRange() {
    return TP_GAP_TIERS[triviaPopupFrequency()] || TP_GAP_TIERS.occasional;
}

const TP_RETRY_MS     = 20 * 1000;       // recheck delay when blocked (paused/YouTube/setting off)
const TP_VISIBLE_MS   = 20 * 1000;       // how long a bubble stays up before auto-dismissing
const TP_EXIT_ANIM_MS = 300;             // must match overlays.css's .sc-tp-out transition-duration
const TP_MAX_FACT_LEN = 280;             // skip trivia entries longer than this -- too much text to pop up legibly
const TP_PERSON_TRIVIA_CAP = 3;          // per person, after the TP_MAX_FACT_LEN filter -- keeps 4 people's trivia from drowning out the movie's own facts

function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// undefined (not null) so "no movie identified yet" (npState.data == null)
// still counts as a change exactly once, on the very first tick.
let _tpLastImdbId = undefined;
let _tpQueue = [];        // shuffled remaining { text, byline } items for the current movie
let _tpExhausted = false; // true once _tpQueue has been fully consumed for this movie -- no reshuffle/repeat
let _tpPopTimer = null;
let _tpBubbleEl = null;
let _tpDismissTimer = null;
let _tpTimeline = null;  // curated facts (sorted by t) for the current movie; null = IMDb random-gap mode
let _tpDriveIn = null;   // the current movie's Drive-In Totals card, or null
let _tpLastPopAt = 0;    // Date.now() of the last bubble/card -- spaces out catch-up pops
let _tpCuratedRecheckAt = 0; // when to look for a curated file again while the movie has none

// Short-lived, single-slot record of trivia texts already popped for the
// current movie -- survives a page reload (buffering, app relaunch) so the
// queue rebuild doesn't immediately re-show what was already seen. Sliding
// TTL: a still-in-progress movie keeps refreshing savedAt and stays
// remembered; switching movies invalidates the old entry via the id check.
const LS_TRIVIA_SEEN = 'sc_trivia_popup_seen';
const TRIVIA_SEEN_TTL_MS = 3 * 60 * 60 * 1000; // 3h, sliding

function _tpLoadSeenTexts(id) {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(LS_TRIVIA_SEEN)); } catch (e) { return []; }
    if (!raw || raw.id !== id) return [];
    if (!raw.savedAt || Date.now() - raw.savedAt > TRIVIA_SEEN_TTL_MS) return [];
    return Array.isArray(raw.texts) ? raw.texts : [];
}

function _tpMarkSeen(id, text) {
    if (!id) return;
    const texts = _tpLoadSeenTexts(id);
    if (!texts.includes(text)) texts.push(text);
    try { localStorage.setItem(LS_TRIVIA_SEEN, JSON.stringify({ id, texts, savedAt: Date.now() })); } catch (e) {}
}

// Session-only mute for the bubbles, toggled from the top-bar "Pop-ups" button
// (renderTriviaPopupButton, bottom of file). NOT persisted -- a page reload with
// the setting still on brings the bubbles back. Muting pulls any on-screen bubble
// and cancels the pending pop; unmuting resumes after a short delay rather than
// waiting out a full frequency gap.
let _tpMuted = false;
const TP_RESUME_MS = 1500;

function _tpKnownForFact(person, knownFor) {
    if (!knownFor) return null;
    const titleYear = knownFor.year ? `${knownFor.title} (${knownFor.year})` : knownFor.title;
    if (person.role === 'director') return `${person.name} is also known for ${titleYear}.`;
    const charPart = person.character ? ` (${person.character})` : '';
    return `${person.name}${charPart} also starred in ${titleYear}.`;
}

// Fetches per-person trivia + known-for for cast/director concurrently, and
// folds it all into { text, byline } queue items. Never throws -- every
// fetch it calls already resolves to null/[] on failure.
async function _tpBuildCastCrewItems(people, excludeTconst, excludeSeriesTconst) {
    const items = [];
    await Promise.all(people.map(async (person) => {
        const [trivia, knownFor] = await Promise.all([
            fetchPersonTrivia(person.nconst),
            fetchPersonKnownFor(person.nconst, excludeTconst, excludeSeriesTconst),
        ]);
        const byline = `${person.name} — ${person.role === 'director' ? 'Director' : (person.character || 'Cast')}`;
        trivia
            .filter(t => t.length <= TP_MAX_FACT_LEN)
            .slice(0, TP_PERSON_TRIVIA_CAP)
            .forEach(t => items.push({ text: t, byline }));
        const knownForFact = _tpKnownForFact(person, knownFor);
        if (knownForFact) items.push({ text: knownForFact, byline: null });
    }));
    return items;
}

function _tpShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ==========================================================
   SCHEDULER
========================================================== */

function _tpResetForNewMovie(id) {
    clearTimeout(_tpPopTimer); _tpPopTimer = null;
    _tpDismissBubble(true); // hard-remove instantly -- stale trivia, no exit animation
    clearSubtitleTrivia();
    hideDriveInCard(true);
    _tpDriveIn = null;
    _tpQueue = [];
    _tpExhausted = false;
    _tpTimeline = null;
    // First catch-up no sooner than the catch-up gap after the movie is
    // identified, so a late joiner isn't greeted by a bubble instantly.
    _tpLastPopAt = Date.now();
    _tpCuratedRecheckAt = Date.now() + CURATED_RECHECK_MS;
    if (!id) return; // not identified yet; next poll tick will retry

    // Drive-In Totals card, for any movie in Joe Bob's list -- independent of
    // whether it runs curated or on IMDb trivia. TV only: on a phone the
    // Trivia card lists it instead (cards/trivia.js).
    if (isTv) {
        fetchDriveInCard(id).then(card => {
            if (id !== _tpLastImdbId) return; // movie changed again while this was in flight
            _tpDriveIn = card;
        });
    }

    // Curated file first. If there is one, the movie runs in timeline mode
    // (_tpTimelineTick on the heartbeat) and none of the IMDb / cast /
    // known-for fetching happens -- the generator already folded those
    // sources in. No file / bad file -> the IMDb path, unchanged.
    fetchCuratedTrivia(id).then(curated => {
        if (id !== _tpLastImdbId) return; // movie changed again while this was in flight
        if (curated) { _tpTimeline = curated.facts; return; }
        _tpStartImdbQueue(id);
    });
}

// The original (pre-curated) behavior: shuffled IMDb movie trivia plus
// cast/crew enrichment, popped at random per-viewer gaps.
function _tpStartImdbQueue(id) {
    fetchImdbTrivia(id).then(async items => {
        if (id !== _tpLastImdbId) return; // movie changed again while this was in flight
        const seenTexts = _tpLoadSeenTexts(id);
        const movieItems = (items || [])
            .filter(text => !seenTexts.includes(text))
            .map(text => ({ text, byline: null }));

        // Queue + schedule off the movie's own trivia immediately -- so a
        // slow or failed cast/crew enrichment burst below (up to ~9 extra
        // network calls, no request timeout on nativeHttpGet) can never
        // block the base feature. Enrichment items, if any land, are merged
        // into whatever's left in the queue afterward, not waited on up
        // front.
        _tpQueue = _tpShuffle(movieItems);
        _tpScheduleNextPop(); // safe on an empty queue too -- it just marks _tpExhausted

        // Cast/crew enrichment is gated on the setting being on *right now*
        // -- an intentional tradeoff that avoids ~9 extra network calls per
        // movie for users who leave this off. The movie's own trivia above
        // stays unconditional since it's shared with the trivia card and
        // cheap either way.
        if (!triviaPopupEnabled()) return;

        // Movies only. For a TV episode the "top cast"/"director" credits are
        // the series regulars and the episode's director; their trivia swamps
        // the episode's own and rarely relates to what's on screen.
        if (npState.data && npState.data.episode != null) return;

        const result = await fetchCastAndDirector(id);
        if (id !== _tpLastImdbId) return; // movie changed again while this was in flight
        if (!result || !result.people.length) return;
        // Belt-and-suspenders episode guard for when the filename parser missed
        // the season/episode marker: IMDb itself says this title has a parent series.
        if (result.seriesTconst) return;

        const castCrewItems = await _tpBuildCastCrewItems(result.people, id, result.seriesTconst);
        if (id !== _tpLastImdbId) return; // movie changed again while this was in flight
        // Re-read seen texts -- a pop may have fired while this was in flight.
        const seenTextsNow = _tpLoadSeenTexts(id);
        const freshCastCrewItems = castCrewItems.filter(it => !seenTextsNow.includes(it.text));
        if (!freshCastCrewItems.length) return;

        // Merge into whatever's left unconsumed (some movie trivia may
        // already have been popped by now) and reshuffle. If the queue had
        // already run dry (marked exhausted above, or drained by a pop
        // while this was in flight), un-exhaust and (re)start scheduling --
        // otherwise a pop timer is already ticking and will simply pick up
        // these items when it fires.
        _tpQueue = _tpShuffle(_tpQueue.concat(freshCastCrewItems));
        if (_tpExhausted) { _tpExhausted = false; _tpScheduleNextPop(); }
    });
}

function _tpScheduleNextPop() {
    clearTimeout(_tpPopTimer);
    // A curated file can arrive mid-movie (_tpRecheckCurated) while an IMDb
    // enrichment fetch is still in flight -- the timeline owns the movie then.
    if (_tpTimeline || _tpExhausted || !_tpQueue.length) { _tpExhausted = true; return; }
    if (_tpMuted) return; // unmuting reschedules -- see _tpApplyMute
    const [minGap, maxGap] = _tpGapRange();
    const gap = minGap + Math.random() * (maxGap - minGap);
    _tpPopTimer = setTimeout(_tpAttemptPop, gap);
}

function _tpMoviePlaying() {
    if (isYouTubeMedia()) return false;
    const v = document.querySelector('#videowrap video');
    return !!v && !v.paused;
}

function _tpAttemptPop() {
    const curId = npState.data && npState.data.imdbId;
    if (curId !== _tpLastImdbId) return; // stale timer from a since-reset movie
    if (_tpMuted) return; // muted mid-flight; _tpApplyMute reschedules on unmute
    if (_tpTimeline) return; // switched to a curated timeline since this timer was armed

    // Real downloaded movie subtitles (subtitles/ui.js) already occupy the bottom
    // of the screen -- a pop-up bubble competing for the same real estate (or
    // just being a second block of on-screen text at once) is exactly the kind
    // of collision this blocks, same "recheck soon, don't consume the queue"
    // treatment as paused/YouTube/disabled/Drive-In card up below.
    if (!_tpCanPop() || isDriveInCardUp()) {
        // Blocked, not exhausted -- recheck soon without consuming a queue item.
        _tpPopTimer = setTimeout(_tpAttemptPop, TP_RETRY_MS);
        return;
    }

    // Skip (don't display, don't wait out a gap for) any entry too long to
    // read comfortably in a small popup -- keep pulling from the queue
    // until a short-enough one turns up or the queue runs dry.
    let fact = null;
    while (_tpQueue.length) {
        const candidate = _tpQueue.shift();
        if (candidate.text.length <= TP_MAX_FACT_LEN) { fact = candidate; break; }
    }
    if (!fact) { _tpExhausted = true; return; } // ran out (including all-too-long) -- no more for this movie

    showTriviaBubble(fact);
    _tpMarkSeen(_tpLastImdbId, fact.text);
    _tpLastPopAt = Date.now();
    _tpScheduleNextPop(); // arms the next pop, or flips _tpExhausted if that was the last one
}

// Shared gate for anything that puts trivia over the movie. Poll-per-use.
function _tpCanPop() {
    return triviaPopupEnabled() && !_tpMuted && _tpMoviePlaying() && !isMovieSubtitlesVisible();
}

const _tpCurrentTime = () => {
    const v = document.querySelector('#videowrap video');
    return v ? v.currentTime : NaN;
};

// Drive-In Totals card (TV only -- _tpDriveIn stays null on a phone): every
// heartbeat, show it when it's due at 0:15 (or missed, for a late joiner).
// Waits for any bubble already up; bubbles then wait for the card.
function _tpDriveInTick() {
    const curId = npState.data && npState.data.imdbId;
    if (!_tpDriveIn || curId !== _tpLastImdbId) return;
    if (!_tpCanPop() || isDriveInCardUp() || _tpBubbleEl) return;
    const seen = _tpLoadSeenTexts(_tpLastImdbId);
    const sinceLastPop = (Date.now() - _tpLastPopAt) / 1000;
    if (!tpDriveInAction(_tpDriveIn, _tpCurrentTime(), seen, sinceLastPop)) return;
    showDriveInCard(_tpDriveIn, () => { _tpLastPopAt = Date.now(); });
    _tpMarkSeen(_tpLastImdbId, TP_DRIVEIN_SEEN_KEY);
}

// Timeline mode's whole scheduler: every heartbeat, pop whichever curated
// fact is due at the current playback position (synced for everyone);
// otherwise, in the gaps, catch up on a fact this viewer missed by joining
// late, seeking, or being paused past its window. Frequency and the seen-set
// are re-read every tick, so a mid-movie setting change applies right away.
function _tpTimelineTick() {
    const curId = npState.data && npState.data.imdbId;
    if (!_tpTimeline || curId !== _tpLastImdbId) return;
    if (!_tpCanPop() || isDriveInCardUp()) return;
    if (_tpBubbleEl) return; // let the current bubble finish; the next fact's 20s window usually outlasts it
    const t = _tpCurrentTime();
    const tier = triviaPopupFrequency() || 'occasional';
    const seen = _tpLoadSeenTexts(_tpLastImdbId);
    const sinceLastPop = (Date.now() - _tpLastPopAt) / 1000;
    const fact = tpDueFact(_tpTimeline, t, tier, seen) || tpCatchUpFact(_tpTimeline, t, tier, seen, sinceLastPop);
    if (!fact) return;
    showTriviaBubble(fact);
    _tpMarkSeen(_tpLastImdbId, fact.text);
    _tpLastPopAt = Date.now();
}

// The movie has no curated file (yet). The generator publishes during the
// weekend, so look again every CURATED_RECHECK_MS; when one appears, switch
// from IMDb random gaps to the timeline -- facts already passed then surface
// through catch-up.
function _tpRecheckCurated(id) {
    _tpCuratedRecheckAt = Date.now() + CURATED_RECHECK_MS;
    fetchCuratedTrivia(id).then(curated => {
        if (!curated || id !== _tpLastImdbId || _tpTimeline) return;
        clearTimeout(_tpPopTimer); _tpPopTimer = null;
        _tpQueue = [];
        _tpExhausted = true;
        _tpTimeline = curated.facts;
    });
}

function _tpMoviePollTick() {
    const curId = npState.data && npState.data.imdbId;
    if (curId !== _tpLastImdbId) {
        _tpLastImdbId = curId;
        _tpResetForNewMovie(_tpLastImdbId);
    }
    if (!_tpTimeline && _tpLastImdbId && Date.now() >= _tpCuratedRecheckAt) _tpRecheckCurated(_tpLastImdbId);
    _tpDriveInTick();
    _tpTimelineTick();
}

export function triviaPopupBoot() {
    _tpMoviePollTick();
    setInterval(_tpMoviePollTick, TP_POLL_MS);
}

/* ==========================================================
   BUBBLE UI
========================================================== */

// Corner-badge glyphs -- grindhouse-flavored, drawn from scratch (no
// copied assets), black/red/bone palette. Each entry is just the glyph
// markup; showTriviaBubble() wraps whichever one gets picked in the
// shared black-circle-plus-red-ring backdrop below, so adding another
// variant later is a one-line addition to this array.
const TP_ICON_SVGS = {
    // Skull + blood drip
    skull: `<path d="M30 10 C19 10 12 18 12 27 C12 33 15 38 19 41 L19 47 L24 47 L24 43 L27 43 L27 47 L33 47 L33 43 L36 43 L36 47 L41 47 L41 41 C45 38 48 33 48 27 C48 18 41 10 30 10 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="22" cy="26" r="5" fill="#000"/>
     <circle cx="38" cy="26" r="5" fill="#000"/>
     <polygon points="30,30 27,36 33,36" fill="#000"/>
     <path d="M39 16 C39 16 43 22 41 27 C40 30 36 30 35 27 C33 23 39 16 39 16 Z"
          fill="#c81d25" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Cracked tombstone
    tombstone: `<path d="M14 54 V30 C14 16 22 8 30 8 C38 8 46 16 46 30 V54 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <path d="M30 12 L26 26 L34 30 L28 44 L33 54" stroke="#000" stroke-width="2" fill="none"/>
     <line x1="30" y1="18" x2="30" y2="26" stroke="#000" stroke-width="2"/>
     <line x1="26" y1="21" x2="34" y2="21" stroke="#000" stroke-width="2"/>`,
    // Film reel
    reel: `<circle cx="30" cy="30" r="18" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="30" cy="30" r="4" fill="#000"/>
     <circle cx="30" cy="16" r="4.5" fill="#000"/>
     <circle cx="30" cy="44" r="4.5" fill="#000"/>
     <circle cx="18" cy="23" r="4.5" fill="#000"/>
     <circle cx="18" cy="37" r="4.5" fill="#000"/>
     <circle cx="42" cy="23" r="4.5" fill="#000"/>
     <circle cx="42" cy="37" r="4.5" fill="#000"/>`,

    // --- Sci-fi (toxic-green #39d98a accent) ---

    // Flying saucer
    saucer: `<ellipse cx="30" cy="33" rx="22" ry="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <ellipse cx="30" cy="24" rx="11" ry="9" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="36" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>
     <circle cx="30" cy="38" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>
     <circle cx="42" cy="36" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>`,
    // Bug-eyed alien head
    alien: `<path d="M30 6 C14 6 6 20 8 32 C10 44 20 54 30 54 C40 54 50 44 52 32 C54 20 46 6 30 6 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <ellipse cx="20" cy="27" rx="7" ry="10" fill="#000" transform="rotate(-15 20 27)"/>
     <ellipse cx="40" cy="27" rx="7" ry="10" fill="#000" transform="rotate(15 40 27)"/>
     <circle cx="20" cy="27" r="1.8" fill="#39d98a"/>
     <circle cx="40" cy="27" r="1.8" fill="#39d98a"/>`,
    // Rocket ship
    rocket: `<path d="M30 6 C24 6 20 14 20 24 V44 H40 V24 C40 14 36 6 30 6 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="30" cy="20" r="5" fill="#39d98a" stroke="#000" stroke-width="2"/>
     <polygon points="20,38 10,50 20,50" fill="#d8d8d8" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
     <polygon points="40,38 50,50 40,50" fill="#d8d8d8" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
     <path d="M24 44 C24 44 22 54 30 58 C38 54 36 44 36 44 Z"
          fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Robot head
    robot: `<rect x="14" y="16" width="32" height="28" rx="4" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <line x1="30" y1="16" x2="30" y2="6" stroke="#000" stroke-width="2.5"/>
     <circle cx="30" cy="5" r="3" fill="#39d98a" stroke="#000" stroke-width="1.5"/>
     <circle cx="30" cy="28" r="7" fill="#000"/>
     <circle cx="30" cy="28" r="3" fill="#39d98a"/>
     <rect x="20" y="38" width="20" height="4" fill="#000"/>
     <circle cx="16" cy="20" r="2" fill="#3a2a1a"/>
     <circle cx="44" cy="20" r="2" fill="#3a2a1a"/>`,
    // Radioactive trefoil
    radioactive: `<circle cx="30" cy="30" r="20" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(0 30 30)"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(120 30 30)"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(240 30 30)"/>
     <circle cx="30" cy="30" r="5" fill="#000"/>`,

    // --- Action (marquee-gold #e8b923 accent) ---

    // Explosion burst
    explosion: `<polygon points="30,4 35,19 48,12 41,25 56,30 41,35 48,48 35,41 30,56 25,41 12,48 19,35 4,30 19,25 12,12 25,19"
             fill="#e8b923" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <polygon points="30,16 33,24 40,20 36,27 44,30 36,33 40,40 33,36 30,44 27,36 20,40 25,33 16,30 25,27 20,20 27,25"
             fill="#c81d25" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Crosshair scope
    crosshair: `<circle cx="30" cy="30" r="21" fill="#f4f1ea" stroke="#c81d25" stroke-width="4"/>
     <rect x="6" y="28" width="15" height="4" fill="#000"/>
     <rect x="39" y="28" width="15" height="4" fill="#000"/>
     <rect x="28" y="6" width="4" height="15" fill="#000"/>
     <rect x="28" y="39" width="4" height="15" fill="#000"/>
     <circle cx="30" cy="30" r="4" fill="#e8b923" stroke="#000" stroke-width="1.5"/>`,
    // Brass knuckles
    knuckles: `<circle cx="14" cy="20" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="26" cy="18" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="38" cy="18" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="50" cy="20" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <rect x="10" y="26" width="44" height="8" rx="3" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>`,

    // --- Comedy (marquee-gold #e8b923 accent) ---

    // Disco ball
    disco: `<circle cx="30" cy="30" r="20" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <path d="M12 30 H48 M13 20 H47 M13 40 H47 M20 12 V48 M30 10 V50 M40 12 V48"
          stroke="#000" stroke-width="1.5" fill="none"/>
     <polyline points="46,10 50,6" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>
     <polyline points="50,14 55,12" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>
     <polyline points="44,6 47,2" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>`,
    // Boombox
    boombox: `<rect x="6" y="18" width="48" height="30" rx="5" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="33" r="10" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="33" r="4" fill="#000"/>
     <circle cx="42" cy="33" r="10" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="42" cy="33" r="4" fill="#000"/>
     <rect x="24" y="10" width="12" height="8" rx="2" fill="#e8b923" stroke="#000" stroke-width="2"/>`,
    // Aviator sunglasses
    sunglasses: `<ellipse cx="18" cy="30" rx="12" ry="10" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <ellipse cx="42" cy="30" rx="12" ry="10" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <rect x="27" y="27" width="6" height="4" fill="#000"/>
     <line x1="6" y1="27" x2="0" y2="21" stroke="#000" stroke-width="3" stroke-linecap="round"/>
     <line x1="54" y1="27" x2="60" y2="21" stroke="#000" stroke-width="3" stroke-linecap="round"/>
     <polyline points="12,26 18,23" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>`,

    // --- Curated-fact topics (named by the generator, not random-picked by genre) ---

    // Drive-in window speaker -- Joe Bob / Drive-In Totals
    joebob: `<path d="M22 14 V8 H38 V14" fill="none" stroke="#000" stroke-width="2.5"/>
     <rect x="14" y="14" width="32" height="34" rx="5" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="30" cy="31" r="10" fill="#3a2a1a" stroke="#000" stroke-width="2"/>
     <path d="M22 31 H38 M24 26 H36 M24 36 H36" stroke="#000" stroke-width="1.5"/>
     <rect x="24" y="48" width="12" height="5" fill="#c81d25" stroke="#000" stroke-width="1.5"/>`,
    // Banknote -- budget / box office
    money: `<rect x="8" y="16" width="44" height="28" rx="3" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <rect x="12" y="20" width="36" height="20" rx="2" fill="none" stroke="#000" stroke-width="1"/>
     <circle cx="30" cy="30" r="9" fill="#e8b923" stroke="#000" stroke-width="2"/>
     <text x="30" y="35" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="14" font-weight="900" fill="#000">$</text>`,
    // Two-reel movie camera -- production / behind the scenes
    camera: `<circle cx="20" cy="18" r="9" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="38" cy="18" r="9" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="20" cy="18" r="2.5" fill="#000"/>
     <circle cx="38" cy="18" r="2.5" fill="#000"/>
     <rect x="10" y="28" width="34" height="20" rx="3" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>
     <polygon points="44,32 54,26 54,50 44,44" fill="#d8d8d8" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="20" cy="38" r="3" fill="#c81d25"/>`,
    // Walk-of-fame star -- cast
    star: `<polygon points="30,6 36,22 53,22 39,32 44,49 30,39 16,49 21,32 7,22 24,22"
             fill="#e8b923" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="30" cy="28" r="4" fill="#c81d25" stroke="#000" stroke-width="1.5"/>`,
    // Chain links -- ties to other movies
    link: `<rect x="6" y="22" width="28" height="16" rx="8" fill="none" stroke="#000" stroke-width="7"/>
     <rect x="6" y="22" width="28" height="16" rx="8" fill="none" stroke="#d8d8d8" stroke-width="3.5"/>
     <rect x="26" y="22" width="28" height="16" rx="8" fill="none" stroke="#000" stroke-width="7"/>
     <rect x="26" y="22" width="28" height="16" rx="8" fill="none" stroke="#e8b923" stroke-width="3.5"/>`,
    // Ribbon microphone -- interview quotes
    mic: `<rect x="20" y="6" width="20" height="28" rx="10" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <path d="M24 14 H36 M24 20 H36 M24 26 H36" stroke="#000" stroke-width="1.5"/>
     <path d="M14 26 C14 38 22 42 30 42 C38 42 46 38 46 26" fill="none" stroke="#000" stroke-width="2.5"/>
     <line x1="30" y1="42" x2="30" y2="52" stroke="#000" stroke-width="3"/>
     <rect x="20" y="51" width="20" height="4" rx="1" fill="#c81d25" stroke="#000" stroke-width="1.5"/>`,
    // "CUT" stamp -- censorship / banned / alternate versions
    censor: `<g transform="rotate(-12 30 30)">
       <rect x="7" y="17" width="46" height="26" rx="3" fill="#f4f1ea" stroke="#c81d25" stroke-width="3"/>
       <text x="30" y="36" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="15" font-weight="900" fill="#c81d25">CUT</text>
     </g>`,
    // Trophy -- awards
    trophy: `<path d="M18 12 H10 C10 22 14 24 18 24 M42 12 H50 C50 22 46 24 42 24" fill="none" stroke="#000" stroke-width="2.5"/>
     <path d="M18 8 H42 V22 C42 30 36 36 30 36 C24 36 18 30 18 22 Z" fill="#e8b923" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <rect x="27" y="36" width="6" height="8" fill="#e8b923" stroke="#000" stroke-width="2"/>
     <rect x="18" y="44" width="24" height="8" rx="1" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>`,
};
const TP_ICON_KEYS = Object.keys(TP_ICON_SVGS);

// Curated facts name their icon (the key set is a contract with the generator
// repo, so only ever ADD keys); anything unknown or missing gets a random one.
function tpPickIconKey(iconKey) {
    if (iconKey && TP_ICON_KEYS.includes(iconKey)) return iconKey;
    return TP_ICON_KEYS[Math.floor(Math.random() * TP_ICON_KEYS.length)];
}

// Randomizes where the bubble lands, using its own *measured* rendered
// size (boxWidthPx/boxHeightPx -- see showTriviaBubble, which appends it
// to the DOM invisibly and measures before calling this) so the chosen
// spot always keeps the whole box inside the video area, regardless of
// trivia text length or which layout (TV sidebar, phone landscape, phone
// vertical bottom-sheet split) happens to be active.
//
// Unlike the PC script's version -- which reasons in vw/vh percentages
// around a fixed-width desktop sidebar -- this measures #videowrap's own
// current on-screen rect directly, so it stays correct across this app's
// several very different chat layouts with no per-mode math. Falls back
// to the full viewport if #videowrap isn't found (shouldn't happen once
// the channel UI has loaded).
function _tpRandomPosition(boxWidthPx, boxHeightPx) {
    const wrap = document.getElementById('videowrap');
    const rect = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    const marginPx = 14;
    const halfW = boxWidthPx / 2;

    let leftMinPx = rect.left + marginPx + halfW;
    let leftMaxPx = rect.left + rect.width - marginPx - halfW;
    if (leftMaxPx < leftMinPx) { // box wider than the available space -- just center it in what's there
        const mid = rect.left + rect.width / 2;
        leftMinPx = leftMaxPx = mid;
    }

    // Prefer the bottom third of the video area; fall back to whatever vertical room
    // actually fits if the video area is too short for that. (Subtitles chat mode never
    // gets here -- trivia joins the subtitle pills there, see _tpShowSubtitleTrivia.)
    const bottomThirdTopPx = rect.top + rect.height * (2 / 3);
    let topMinPx = Math.max(rect.top + marginPx, bottomThirdTopPx);
    let topMaxPx = rect.bottom - marginPx - boxHeightPx;
    if (topMaxPx < topMinPx) topMinPx = topMaxPx = Math.max(rect.top + marginPx, rect.bottom - marginPx - boxHeightPx);

    return {
        leftPx: leftMinPx + Math.random() * (leftMaxPx - leftMinPx),
        topPx: topMinPx + Math.random() * (topMaxPx - topMinPx),
    };
}

/* ==========================================================
   POP SOUND -- synthesized (no audio file) via Web Audio API, so this
   adds a function, not a shipped asset. A single AudioContext is created
   lazily on first pop and reused after that (creating a fresh one per pop
   would be wasteful and can hit browser limits on concurrent contexts).
   Wrapped in try/catch since AudioContext can be unavailable/blocked in
   some environments -- silently skipping the sound is preferable to
   breaking the popup over it.
========================================================== */

let _tpAudioCtx = null;
function _tpGetAudioCtx() {
    if (!_tpAudioCtx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        _tpAudioCtx = new Ctor();
    }
    if (_tpAudioCtx.state === 'suspended') _tpAudioCtx.resume();
    return _tpAudioCtx;
}

// Short burst of filtered white noise -- the sharp "click" transient a
// real pop needs at its onset, which a pure oscillator can't produce.
function _tpNoiseBurst(ac, { start, dur, freq, q, peak }) {
    const size = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, size, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bp).connect(gain).connect(ac.destination);
    src.start(start);
    src.stop(start + dur + 0.01);
}

// The squishy body after the click -- pitch bends up then settles back
// down (a membrane snapping, not a straight sweep), through a lowpass
// filter whose cutoff falls at the same time for a rubbery, muffled tail.
function _tpBubbleTone(ac, { start, dur, freqStart, freqPeak, freqEnd, lpStart, lpEnd, q, peak }) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(freqPeak, start + dur * 0.4);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(lpStart, start);
    lp.frequency.exponentialRampToValueAtTime(lpEnd, start + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(lp).connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
}

function _tpPlayPopSound() {
    try {
        const ac = _tpGetAudioCtx();
        const t = ac.currentTime;
        _tpNoiseBurst(ac, { start: t, dur: 0.02, freq: 1800, q: 2.5, peak: 0.55 });
        _tpBubbleTone(ac, { start: t, dur: 0.13, freqStart: 220, freqPeak: 600, freqEnd: 380, lpStart: 2600, lpEnd: 600, q: 8, peak: 0.3 });
    } catch (e) {}
}

// Lays a circle-cropped IMDb headshot (curated person facts) over the badge's
// icon, then moves the red ring back on top. Built with DOM APIs (URL via
// setAttribute, never interpolated into markup). If the image fails to load it
// removes itself and the icon underneath shows -- no separate fallback path.
function _tpAddHeadshot(svg, url) {
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', 'sc-tp-headshot-clip');
    const disc = document.createElementNS(NS, 'circle');
    disc.setAttribute('cx', '30'); disc.setAttribute('cy', '30'); disc.setAttribute('r', '25.5');
    clip.appendChild(disc);
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', url);
    img.setAttribute('x', '4.5'); img.setAttribute('y', '4.5');
    img.setAttribute('width', '51'); img.setAttribute('height', '51');
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('clip-path', 'url(#sc-tp-headshot-clip)');
    img.addEventListener('error', () => img.remove());
    svg.insertBefore(clip, svg.firstChild);
    svg.appendChild(img);
    const ring = svg.querySelector('circle[stroke]');
    if (ring) svg.appendChild(ring); // ring above the photo
}

// Subtitles chat mode: the fact flows through the subtitle pill stream (cards/subtitles.js)
// instead of a free-floating bubble -- one area of on-screen text, not two. Styled as its own
// pill (bone-white + red badge, overlays.css .sc-subtitle-trivia) so it never reads as chat.
// Icon only, no headshot: the pill is re-rendered via innerHTML on every chat message, and
// _tpAddHeadshot's DOM-built <image> wouldn't survive that.
function _tpShowSubtitleTrivia(fact) {
    const icon = TP_ICON_SVGS[tpPickIconKey(fact.icon)];
    const bylineHtml = fact.byline ? `<span class="sc-subtitle-trivia-byline">${_escHtml(fact.byline)}</span>` : '';
    addSubtitleTrivia(`<div class="sc-subtitle-pill sc-subtitle-trivia">` +
        `<svg class="sc-subtitle-trivia-badge" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="30" cy="30" r="27" fill="#000"/>` +
        `<circle cx="30" cy="30" r="27" fill="none" stroke="#c81d25" stroke-width="3"/>${icon}</svg>` +
        `<span class="sc-subtitle-trivia-text">${_escHtml(fact.text)}${bylineHtml}</span></div>`, SUBTITLE_LINE_TTL_MS);
}

function showTriviaBubble(fact) {
    _tpDismissBubble(true); // no double-stacking if one was somehow still up
    _tpPlayPopSound();
    if (inSubtitlesMode()) { _tpShowSubtitleTrivia(fact); return; }

    _tpBubbleEl = document.createElement('div');
    _tpBubbleEl.id = 'sc-tp-bubble';
    const icon = TP_ICON_SVGS[tpPickIconKey(fact.icon)];
    const bylineHtml = fact.byline ? `<div id="sc-tp-byline">${_escHtml(fact.byline)}</div>` : '';
    _tpBubbleEl.innerHTML = `
        <svg id="sc-tp-tail" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="27" fill="#000"/>
            <circle cx="30" cy="30" r="27" fill="none" stroke="#c81d25" stroke-width="3"/>
            ${icon}
        </svg>
        <div id="sc-tp-text">${_escHtml(fact.text)}${bylineHtml}</div>`;
    if (tpSafeImageUrl(fact.image)) _tpAddHeadshot(_tpBubbleEl.querySelector('#sc-tp-tail'), fact.image);

    // Append first (still invisible -- opacity:0 until .sc-tp-in below) so
    // its real rendered width/height can be measured, then use that to pick
    // a position guaranteed to fit -- see _tpRandomPosition()'s comment.
    document.body.appendChild(_tpBubbleEl);

    const pos = _tpRandomPosition(_tpBubbleEl.offsetWidth, _tpBubbleEl.offsetHeight);
    _tpBubbleEl.style.setProperty('left', pos.leftPx + 'px', 'important');
    _tpBubbleEl.style.setProperty('top', pos.topPx + 'px', 'important');

    requestAnimationFrame(() => _tpBubbleEl && _tpBubbleEl.classList.add('sc-tp-in'));

    _tpBubbleEl.addEventListener('click', () => _tpDismissBubble(false));
    _tpBubbleEl.addEventListener('mouseenter', () => clearTimeout(_tpDismissTimer));
    _tpBubbleEl.addEventListener('mouseleave', _tpArmDismissTimer);
    _tpArmDismissTimer();
}

function _tpArmDismissTimer() {
    clearTimeout(_tpDismissTimer);
    _tpDismissTimer = setTimeout(() => _tpDismissBubble(false), TP_VISIBLE_MS);
}

function _tpDismissBubble(instant) {
    clearTimeout(_tpDismissTimer); _tpDismissTimer = null;
    if (!_tpBubbleEl) return;
    const el = _tpBubbleEl;
    _tpBubbleEl = null;
    if (instant) { el.remove(); return; }
    el.classList.add('sc-tp-out');
    setTimeout(() => el.remove(), TP_EXIT_ANIM_MS);
}

/* ==========================================================
   TOP-BAR "POP-UPS" BUTTON — session mute/resume toggle. All the DOM + state
   lives here; titleinject.js just calls renderTriviaPopupButton() when the
   now-playing movie changes (the same spot the retired #sc-trivia-btn was
   managed from). Session-only: not persisted, a reload brings the bubbles back.
========================================================== */

const TP_BTN_ID = 'sc-trivia-popup-btn';

function _tpApplyMute() {
    if (_tpMuted) {
        clearTimeout(_tpPopTimer); _tpPopTimer = null;
        _tpDismissBubble(true); // pull whatever's on screen right now
        clearSubtitleTrivia();
        hideDriveInCard(false);
    } else if (!_tpTimeline && !_tpExhausted && _tpQueue.length) {
        // (Timeline mode needs nothing -- the heartbeat picks up the next due fact.)
        // Resume promptly -- don't make the user wait out a fresh frequency gap.
        clearTimeout(_tpPopTimer);
        _tpPopTimer = setTimeout(_tpAttemptPop, TP_RESUME_MS);
    }
    _tpSyncButton();
}

function _tpToggleMute() { _tpMuted = !_tpMuted; _tpApplyMute(); }

function _tpSyncButton() {
    const btn = document.getElementById(TP_BTN_ID);
    if (!btn) return;
    // Fixed-width dot so the label doesn't shift between states: ● active, ○ muted.
    btn.innerHTML = `<span class="sc-tp-dot">${_tpMuted ? '○' : '●'}</span>Pop-ups`;
    btn.title = _tpMuted
        ? 'Pop-up trivia muted for this session — tap to resume'
        : 'Mute pop-up trivia bubbles for this session';
    btn.setAttribute('aria-pressed', _tpMuted ? 'true' : 'false');
}

// Called by titleinject.js on every now-playing change. Shows the button only
// when the feature is enabled AND a real movie with a matched IMDb id is playing
// (the old #sc-trivia-btn's visibility rule); removes it otherwise. Inserted left
// of Up Next / Coming Attractions so the header row reads
// Pop-ups │ Up Next │ Coming Attractions.
export function renderTriviaPopupButton() {
    const shouldShow = triviaPopupEnabled() && !!(npState.data && npState.data.imdbId);
    let btn = document.getElementById(TP_BTN_ID);
    if (!shouldShow) { if (btn) btn.remove(); return; }
    if (!btn) {
        btn = document.createElement('button');
        btn.id = TP_BTN_ID;
        btn.type = 'button';
        btn.dataset.noTvCaption = '1'; // ●/○ + label is self-explanatory; no remote caption
        btn.addEventListener('click', (e) => { e.stopPropagation(); _tpToggleMute(); });
        const header = document.getElementById('videowrap-header');
        const anchor = document.getElementById('sc-up-next-btn') || document.getElementById('sc-poster-toggle');
        if (header && anchor && anchor.parentNode === header) header.insertBefore(btn, anchor);
        else (header || document.body).appendChild(btn);
    }
    _tpSyncButton();
}
