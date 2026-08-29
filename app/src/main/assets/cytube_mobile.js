/* GENERATED FILE — do not edit. Source: web/src/**. Rebuild: cd web && npm run bundle */
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/native.js
  var native_exports = {};
  __export(native_exports, {
    nativeHttpGet: () => nativeHttpGet
  });
  function nativeHttpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
      if (!(window.CytubeNative && typeof CytubeNative.httpGet === "function")) {
        reject(new Error("native http unavailable"));
        return;
      }
      const id = "h" + Math.random().toString(36).slice(2);
      _scHttpCbs[id] = (res) => {
        if (res && res.error) reject(new Error(res.error));
        else resolve(res);
      };
      try {
        CytubeNative.httpGet(id, url, JSON.stringify(headers));
      } catch (e) {
        delete _scHttpCbs[id];
        reject(e);
      }
      setTimeout(() => {
        if (_scHttpCbs[id]) {
          delete _scHttpCbs[id];
          reject(new Error("timeout"));
        }
      }, 1e4);
    });
  }
  var _scHttpCbs;
  var init_native = __esm({
    "src/native.js"() {
      _scHttpCbs = {};
      if (typeof window !== "undefined") {
        window.__scHttpResolve = function(id, res) {
          const cb = _scHttpCbs[id];
          if (cb) {
            delete _scHttpCbs[id];
            cb(res);
          }
        };
      }
    }
  });

  // src/chat/usernames.js
  function getChatUsernames() {
    const names = /* @__PURE__ */ new Set();
    document.querySelectorAll("#userlist .userlist_item").forEach((item) => {
      var _a;
      const spans = item.querySelectorAll("span");
      const nameSpan = spans.length >= 2 ? spans[1] : spans[0];
      const n = (_a = nameSpan == null ? void 0 : nameSpan.textContent) == null ? void 0 : _a.trim();
      if (n) names.add(n);
    });
    document.querySelectorAll("#messagebuffer .username").forEach((el) => {
      const n = el.textContent.replace(/[:\s]+$/, "").trim();
      if (n) names.add(n);
    });
    return [...names];
  }

  // src/chat/inputfocus.js
  function syncNativeInputFocus() {
    const a = document.activeElement;
    const inField = !!a && (a.id === "sc-chat-textarea" || a.tagName === "TEXTAREA" || a.tagName === "INPUT");
    const modalOpen = !!document.getElementById("sc-modal-overlay");
    try {
      if (window.CytubeNative) CytubeNative.setChatInputFocused(inField || modalOpen);
    } catch (e) {
    }
  }
  window.__scSyncInputFocus = syncNativeInputFocus;

  // src/chat/emotemirror.js
  var emoteState = {
    watchInterval: null,
    lastChatlineValue: ""
  };
  function startEmoteWatcher(originalInput, textarea) {
    if (emoteState.watchInterval) return;
    emoteState.watchInterval = setInterval(() => {
      const current = originalInput.value;
      if (current !== emoteState.lastChatlineValue) {
        textarea.value = current;
        emoteState.lastChatlineValue = current;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new Event("input"));
      }
    }, 80);
  }

  // src/settings/schema.js
  var DEFS = {
    tmdbKey: { key: "sc_tmdb_key", type: "string", def: "" },
    onboarded: { key: "sc_onboarded", type: "flag", def: false },
    // set = true
    spellcheck: { key: "sc_spellcheck", type: "offbool", def: true },
    // 'off' disables
    autoEmbed: { key: "sc_autoembed_images", type: "offbool", def: true },
    // 'off' disables
    chatFontSize: { key: "sc_chat_fontsize", type: "string", def: "" },
    movieLead: { key: "sc_movie_lead_sec", type: "string", def: "" },
    // clamped 0-10 in player/leadtime.js, like chatFontSize
    couchMode: { key: "sc_couch_mode", type: "onbool", def: false },
    // 'on' enables
    watchAlong: { key: "sc_watch_along", type: "onbool", def: false },
    castMute: { key: "sc_cast_fallback_mute", type: "onbool", def: false },
    lineupTiming: { key: "sc_lineup_timing", type: "onbool", def: false },
    // Experimental; off by default
    triviaPopup: { key: "sc_trivia_popup", type: "onbool", def: false },
    // Experimental; off by default
    triviaPopupFreq: { key: "sc_trivia_popup_freq", type: "string", def: "occasional" },
    // 'frequent' | 'occasional' | 'rare'
    chatMode: { key: "sc_chat_mode", type: "string", def: "sidebar" },
    vertSplit: { key: "sc_vert_split", type: "number", def: 50 },
    updateCache: { key: "sc_update_cache", type: "json", def: null }
  };
  function getSetting(n) {
    const d = DEFS[n];
    const raw = localStorage.getItem(d.key);
    if (raw === null || raw === "") return d.def;
    if (d.type === "offbool") return raw !== "off";
    if (d.type === "onbool") return raw === "on";
    if (d.type === "flag") return true;
    if (d.type === "number") {
      const num = parseFloat(raw);
      return Number.isFinite(num) ? num : d.def;
    }
    if (d.type === "json") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return d.def;
      }
    }
    return raw;
  }

  // src/store.js
  var LS_TMDB = "sc_tmdb_key";
  var LS_ONBOARDED = "sc_onboarded";
  var LS_SPELLCHECK = "sc_spellcheck";
  var LS_CHAT_FONT = "sc_chat_fontsize";
  var LS_AUTOEMBED = "sc_autoembed_images";
  var LS_MOVIE_LEAD = "sc_movie_lead_sec";
  var LS_COUCH = "sc_couch_mode";
  var LS_WATCHALONG = "sc_watch_along";
  var LS_CAST_MUTE = "sc_cast_fallback_mute";
  var LS_LINEUP_TIMING = "sc_lineup_timing";
  var LS_TRIVIA_POPUP = "sc_trivia_popup";
  var LS_TRIVIA_POPUP_FREQ = "sc_trivia_popup_freq";
  var LS_SUBTITLE_OPACITY = "sc_subtitle_opacity";
  var LS_SUBTITLE_FONTSIZE = "sc_subtitle_fontsize";
  var LS_SUBTITLE_LINES = "sc_subtitle_lines";
  var getKey = (id) => localStorage.getItem(id) || "";
  var setKey = (id, v) => localStorage.setItem(id, v.trim());
  var hasKey = (id) => !!getKey(id);
  var spellCheckEnabled = () => getSetting("spellcheck");
  var autoEmbedEnabled = () => getSetting("autoEmbed");
  var couchModeEnabled = () => getSetting("couchMode");
  var watchAlongEnabled = () => getSetting("watchAlong");
  var castFallbackMuted = () => getSetting("castMute");
  var lineupTimingEnabled = () => getSetting("lineupTiming");
  var triviaPopupEnabled = () => getSetting("triviaPopup");
  var triviaPopupFrequency = () => getSetting("triviaPopupFreq");

  // src/readability.js
  function detectReadabilityIssues(text) {
    const issues = [];
    const allCaps = text.match(/\b[A-Z]{3,}\b/g);
    if (allCaps) issues.push(`ALL CAPS: "${allCaps.join('", "')}" — hard to read`);
    const repeated = text.match(/(.)\1{4,}/g);
    if (repeated) issues.push(`Repeated characters: "${repeated.join('", "')}" — hard to read`);
    const excessPunct = text.match(/[!?]{3,}/g);
    if (excessPunct) issues.push(`Excessive punctuation: "${excessPunct.join('", "')}"`);
    return issues;
  }

  // src/chat/grammar.js
  var LT_API = "https://api.languagetool.org/v2/check";
  var LT_DISABLED_RULES = [
    "UPPERCASE_SENTENCE_START",
    "PUNCTUATION_PARAGRAPH_END",
    "EN_QUOTES",
    "COMMA_PARENTHESIS_WHITESPACE",
    "WHITESPACE_RULE",
    "CONSECUTIVE_SPACES"
  ].join(",");
  var LT_ENABLED_CATEGORIES = [
    "GRAMMAR",
    "TYPOS",
    "CONFUSED_WORDS"
  ].join(",");
  var LT_PREFIX = "I am writing this message. ";
  function buildAnnotation(text) {
    const names = getChatUsernames();
    const sorted = [...names].sort((a, b) => b.length - a.length);
    const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = [];
    if (escaped.length) {
      parts.push(`@(?:${escaped.join("|")})`);
      parts.push(`(?<![\\w])(?:${escaped.join("|")})(?![\\w])`);
    }
    parts.push("#\\S+");
    parts.push("https?://\\S+");
    const tokenRe = new RegExp(parts.join("|"), "gi");
    const annotation = [];
    let last = 0, match;
    annotation.push({ text: LT_PREFIX });
    while ((match = tokenRe.exec(text)) !== null) {
      if (match.index > last) annotation.push({ text: text.slice(last, match.index) });
      annotation.push({ markup: match[0] });
      last = match.index + match[0].length;
    }
    if (last < text.length) annotation.push({ text: text.slice(last) });
    return annotation;
  }
  async function checkGrammar(text) {
    try {
      const body = new URLSearchParams({
        data: JSON.stringify({ annotation: buildAnnotation(text) }),
        language: "en-US",
        disabledRules: LT_DISABLED_RULES,
        enabledCategories: LT_ENABLED_CATEGORIES
      });
      const res = await fetch(LT_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!res.ok) return [];
      const data = await res.json();
      const prefixLen = LT_PREFIX.length;
      return (data.matches || []).filter((m) => m.offset >= prefixLen).map((m) => ({
        offset: m.offset - prefixLen,
        // re-anchor to original text
        length: m.length,
        message: m.message,
        shortMessage: m.shortMessage || "",
        replacements: (m.replacements || []).slice(0, 5).map((r) => r.value)
      }));
    } catch (e) {
      return [];
    }
  }
  function showReviewModal(text, ltMatches, readabilityIssues, onSend, onCancel) {
    const old = document.getElementById("sc-modal-overlay");
    if (old) old.remove();
    let workingText = text;
    let workingMatches = ltMatches.slice();
    const overlay = document.createElement("div");
    overlay.id = "sc-modal-overlay";
    overlay.innerHTML = `
        <div id="sc-modal">
            <div id="sc-modal-title">⚠️ Review Before Sending</div>
            ${readabilityIssues.length ? `<div id="sc-readability">${readabilityIssues.map((i) => `<div class="sc-readability-issue">⚠️ ${i}</div>`).join("")}</div>` : ""}
            <div id="sc-preview-wrap"><div id="sc-preview"></div></div>
            <div id="sc-error-detail"></div>
            <div id="sc-modal-actions">
                <button id="sc-btn-cancel">✏️ Edit in Chat</button>
                <button id="sc-btn-send">✅ Send</button>
            </div>
            <div id="sc-lt-credit">Grammar by <a href="https://languagetool.org" target="_blank" rel="noopener">LanguageTool</a></div>
        </div>`;
    document.body.appendChild(overlay);
    try {
      if (window.CytubeNative) CytubeNative.setChatInputFocused(true);
    } catch (e) {
    }
    const closeModal = () => {
      overlay.remove();
      setTimeout(syncNativeInputFocus, 0);
    };
    setTimeout(() => {
      var _a;
      return (_a = document.getElementById("sc-btn-send")) == null ? void 0 : _a.focus();
    }, 0);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
        onCancel();
      }
    });
    document.getElementById("sc-btn-cancel").addEventListener("click", () => {
      closeModal();
      onCancel();
    });
    document.getElementById("sc-btn-send").addEventListener("click", () => {
      closeModal();
      onSend(workingText);
    });
    const modalKeyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        overlay.removeEventListener("keydown", modalKeyHandler);
        closeModal();
        setTimeout(() => onSend(workingText), 50);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        overlay.removeEventListener("keydown", modalKeyHandler);
        closeModal();
        onCancel();
      }
    };
    overlay.addEventListener("keydown", modalKeyHandler);
    const cleanupObserver = new MutationObserver(() => {
      if (!document.getElementById("sc-modal-overlay")) {
        cleanupObserver.disconnect();
        syncNativeInputFocus();
      }
    });
    cleanupObserver.observe(document.body, { childList: true });
    function renderPreview() {
      const preview = document.getElementById("sc-preview");
      const detail = document.getElementById("sc-error-detail");
      if (!preview) return;
      const sorted = workingMatches.slice().sort((a, b) => a.offset - b.offset);
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let html = "", pos = 0;
      sorted.forEach((m, i) => {
        if (m.offset > pos) html += esc(workingText.slice(pos, m.offset));
        html += `<span class="sc-error-span" data-idx="${i}" title="${esc(m.shortMessage || m.message)}">${esc(workingText.slice(m.offset, m.offset + m.length))}</span>`;
        pos = m.offset + m.length;
      });
      html += esc(workingText.slice(pos));
      preview.innerHTML = html;
      preview.querySelectorAll(".sc-error-span").forEach((span) => {
        span.addEventListener("click", () => showErrorDetail(sorted[parseInt(span.dataset.idx)]));
      });
      detail.innerHTML = "";
    }
    function showErrorDetail(match) {
      const detail = document.getElementById("sc-error-detail");
      if (!detail) return;
      const sugs = match.replacements;
      detail.innerHTML = `
            <div class="sc-detail-msg">💬 ${match.message}</div>
            <div class="sc-detail-actions">
                ${sugs.length ? sugs.map(
        (s) => `<button class="sc-sug-btn" data-sug="${s.replace(/"/g, "&quot;")}">✔ ${s}</button>`
      ).join("") : "<em>No suggestions</em>"}
                <button class="sc-reject-btn">✖ Ignore</button>
            </div>`;
      detail.querySelectorAll(".sc-sug-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sug = btn.dataset.sug;
          const delta = sug.length - match.length;
          workingText = workingText.slice(0, match.offset) + sug + workingText.slice(match.offset + match.length);
          workingMatches = workingMatches.filter((m) => m !== match);
          workingMatches.forEach((m) => {
            if (m.offset > match.offset) m.offset += delta;
          });
          renderPreview();
        });
      });
      detail.querySelector(".sc-reject-btn").addEventListener("click", () => {
        workingMatches = workingMatches.filter((m) => m !== match);
        renderPreview();
      });
    }
    renderPreview();
  }
  async function attemptSend(textarea, originalInput) {
    const text = textarea.value.trim();
    if (!text) return;
    if (!spellCheckEnabled()) {
      doSend(textarea, originalInput, text);
      return;
    }
    const readabilityIssues = detectReadabilityIssues(text);
    showCheckingIndicator(textarea, true);
    const ltMatches = await checkGrammar(text);
    showCheckingIndicator(textarea, false);
    if (ltMatches.length > 0 || readabilityIssues.length > 0) {
      showReviewModal(
        text,
        ltMatches,
        readabilityIssues,
        (finalText) => {
          textarea.value = finalText;
          doSend(textarea, originalInput, finalText);
        },
        () => textarea.focus()
      );
    } else {
      doSend(textarea, originalInput, text);
    }
  }
  function showCheckingIndicator(textarea, show) {
    let el = document.getElementById("sc-checking");
    if (show && !el) {
      el = document.createElement("div");
      el.id = "sc-checking";
      el.textContent = "🔍 Checking…";
      textarea.parentElement.insertBefore(el, textarea.nextSibling);
    } else if (!show && el) el.remove();
  }
  function doSend(textarea, originalInput, msg) {
    if (!msg) return;
    let sent = false;
    try {
      if (typeof socket !== "undefined" && socket && socket.emit) {
        socket.emit("chatMsg", { msg, meta: {} });
        sent = true;
      }
    } catch (e) {
    }
    if (!sent) {
      originalInput.value = msg;
      emoteState.lastChatlineValue = msg;
      originalInput.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13
      }));
      try {
        if (typeof $ !== "undefined")
          $(originalInput).trigger($.Event("keydown", { which: 13, keyCode: 13, key: "Enter" }));
      } catch (e) {
      }
    }
    textarea.value = "";
    textarea.style.height = "";
    emoteState.lastChatlineValue = "";
    originalInput.value = "";
    textarea.focus();
  }

  // src/socket.js
  function whenSocket(cb, tries = 120) {
    const s = typeof window !== "undefined" && window.socket;
    if (s && typeof s.on === "function") {
      cb(s);
      return;
    }
    if (tries <= 0) return;
    setTimeout(() => whenSocket(cb, tries - 1), 500);
  }
  function onSocket(event, handler) {
    whenSocket((s) => s.on(event, handler));
  }

  // src/cards/emotepicker.js
  var LS_EMOTE_FAVORITES = "sc_emote_favorites";
  var LS_EMOTE_ACTIVE_TAB = "sc_emote_active_tab";
  var LS_EMOTE_PANEL_POS = "sc_emote_panel_pos";
  function readChannelEmotes() {
    try {
      const arr = window.CHANNEL && window.CHANNEL.emotes;
      if (!Array.isArray(arr)) return null;
      const out = [];
      for (const e of arr) {
        if (e && typeof e.name === "string" && e.name && typeof e.image === "string" && e.image) {
          out.push({ name: e.name, image: e.image });
        }
      }
      return out;
    } catch (e) {
      return null;
    }
  }
  function readEmotesFromDom() {
    const out = [];
    document.querySelectorAll("#emotelist img.channel-emote").forEach((img) => {
      const name = img.title;
      const image = img.src;
      if (name && image) out.push({ name, image });
    });
    return out;
  }
  var _forceRenderAttempted = false;
  function scrapeEmotesFallback(allowForceRender) {
    let out = readEmotesFromDom();
    if (out.length || !allowForceRender || _forceRenderAttempted) return out;
    _forceRenderAttempted = true;
    const btn = document.getElementById("emotelistbtn");
    if (btn) {
      try {
        btn.click();
        out = readEmotesFromDom();
      } finally {
        btn.click();
      }
    }
    return out;
  }
  function computeEmoteList(allowForceRender) {
    const fromChannel = readChannelEmotes();
    if (fromChannel !== null) return fromChannel;
    return scrapeEmotesFallback(!!allowForceRender);
  }
  var _emoteData = [];
  function refreshEmoteData(allowForceRender) {
    try {
      _emoteData = computeEmoteList(allowForceRender);
    } catch (e) {
      return;
    }
    warmFavoriteBlobUrls();
    const grid = document.getElementById("sc-emotes-grid");
    if (!grid) return;
    const search = document.getElementById("sc-emotes-search");
    renderActiveTabGrid(grid, search ? search.value : "");
  }
  onSocket("emoteList", () => refreshEmoteData(false));
  onSocket("updateEmote", () => refreshEmoteData(false));
  onSocket("removeEmote", () => refreshEmoteData(false));
  function clampPanelPos(left, top, width, height) {
    return {
      x: Math.min(Math.max(left, -(width - 40)), window.innerWidth - 40),
      y: Math.min(Math.max(top, 0), window.innerHeight - 32)
    };
  }
  function makePanelDraggable(panel, head, draggingClass, onDragEnd) {
    let dragging = false, dragDX = 0, dragDY = 0;
    const setPos = (prop, val) => panel.style.setProperty(prop, val, "important");
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      setPos("left", rect.left + "px");
      setPos("top", rect.top + "px");
      setPos("right", "auto");
      setPos("bottom", "auto");
      dragDX = e.clientX - rect.left;
      dragDY = e.clientY - rect.top;
      dragging = true;
      head.classList.add(draggingClass);
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = panel.getBoundingClientRect();
      const { x, y } = clampPanelPos(e.clientX - dragDX, e.clientY - dragDY, rect.width, rect.height);
      setPos("left", x + "px");
      setPos("top", y + "px");
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      head.classList.remove(draggingClass);
      try {
        head.releasePointerCapture(e.pointerId);
      } catch (err) {
      }
      if (onDragEnd) {
        const rect = panel.getBoundingClientRect();
        onDragEnd(rect.left, rect.top);
      }
    };
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
  }
  function getSavedEmotePanelPos() {
    try {
      const raw = getKey(LS_EMOTE_PANEL_POS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.left === "number" && typeof parsed.top === "number") return parsed;
    } catch (e) {
    }
    return null;
  }
  function saveEmotePanelPos(left, top) {
    try {
      setKey(LS_EMOTE_PANEL_POS, JSON.stringify({ left, top }));
    } catch (e) {
    }
  }
  var _emoteFavorites = /* @__PURE__ */ new Set();
  function loadFavorites() {
    try {
      const arr = JSON.parse(getKey(LS_EMOTE_FAVORITES) || "[]");
      if (Array.isArray(arr)) return new Set(arr.filter((n) => typeof n === "string" && n));
    } catch (e) {
    }
    return /* @__PURE__ */ new Set();
  }
  function saveFavorites() {
    try {
      setKey(LS_EMOTE_FAVORITES, JSON.stringify([..._emoteFavorites]));
    } catch (e) {
    }
  }
  var EMOTE_FAVORITES_CACHE = "sc-emote-favorites-v1";
  function openFavoritesCache() {
    if (!("caches" in window)) return Promise.resolve(null);
    return caches.open(EMOTE_FAVORITES_CACHE).catch(() => null);
  }
  var _favoriteBlobUrls = /* @__PURE__ */ new Map();
  function patchFavoriteTileImage(name, src) {
    document.querySelectorAll("#sc-emotes-panel .sc-emotes-tile").forEach((tile) => {
      if (tile.dataset.emoteName !== name) return;
      const img = tile.querySelector("img");
      if (img && img.src !== src) img.src = src;
    });
  }
  function setFavoriteBlobUrl(name, blob) {
    const objUrl = URL.createObjectURL(blob);
    const prev = _favoriteBlobUrls.get(name);
    _favoriteBlobUrls.set(name, objUrl);
    if (prev) URL.revokeObjectURL(prev);
    patchFavoriteTileImage(name, objUrl);
  }
  async function cacheFavoriteImage(name, url) {
    if (!url) return;
    try {
      const cache = await openFavoritesCache();
      if (!cache) return;
      const res = await fetch(url);
      if (!res.ok) return;
      await cache.put(url, res.clone());
      setFavoriteBlobUrl(name, await res.blob());
    } catch (e) {
    }
  }
  async function evictFavoriteImage(name, url) {
    const blobUrl = _favoriteBlobUrls.get(name);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      _favoriteBlobUrls.delete(name);
    }
    try {
      const cache = await openFavoritesCache();
      if (cache && url) await cache.delete(url);
    } catch (e) {
    }
  }
  async function warmFavoriteBlobUrls() {
    if (!_emoteFavorites.size || !_emoteData.length) return;
    const cache = await openFavoritesCache();
    if (!cache) return;
    for (const e of _emoteData) {
      if (!_emoteFavorites.has(e.name) || _favoriteBlobUrls.has(e.name)) continue;
      try {
        const res = await cache.match(e.image);
        if (res) setFavoriteBlobUrl(e.name, await res.blob());
        else await cacheFavoriteImage(e.name, e.image);
      } catch (err) {
      }
    }
  }
  function toggleFavorite(name) {
    if (!name) return;
    const isFav = !_emoteFavorites.has(name);
    if (isFav) _emoteFavorites.add(name);
    else _emoteFavorites.delete(name);
    saveFavorites();
    refreshAfterFavoriteToggle(name, isFav);
    const emote = _emoteData.find((em) => em.name === name);
    const image = emote && emote.image;
    if (isFav) cacheFavoriteImage(name, image);
    else evictFavoriteImage(name, image);
  }
  function refreshAfterFavoriteToggle(name, isFav) {
    if (_activeTab === "favorites") {
      const grid = document.getElementById("sc-emotes-grid");
      const search = document.getElementById("sc-emotes-search");
      if (grid) renderActiveTabGrid(grid, search ? search.value : "");
      return;
    }
    document.querySelectorAll("#sc-emotes-panel .sc-emotes-star").forEach((star) => {
      if (star.dataset.emoteName === name) setEmoteStarState(star, isFav);
    });
  }
  var _activeTab = "all";
  function getSavedActiveTab() {
    try {
      const raw = getKey(LS_EMOTE_ACTIVE_TAB);
      if (raw === "all" || raw === "favorites") return raw;
    } catch (e) {
    }
    return "all";
  }
  function saveActiveTab(tab) {
    try {
      setKey(LS_EMOTE_ACTIVE_TAB, tab);
    } catch (e) {
    }
  }
  function insertEmoteIntoChat(name) {
    const textarea = document.getElementById("sc-chat-textarea");
    if (!textarea || !name) return;
    const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
    const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + name + textarea.value.slice(end);
    const newPos = start + name.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }
  function _escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function _starLabel(isFav) {
    return isFav ? "Remove from favorites" : "Add to favorites";
  }
  function setEmoteStarState(star, isFav) {
    star.classList.toggle("sc-emotes-star-active", isFav);
    star.setAttribute("aria-pressed", isFav ? "true" : "false");
    const label = _starLabel(isFav);
    star.setAttribute("aria-label", label);
    star.title = label;
    star.textContent = isFav ? "★" : "☆";
  }
  function renderEmoteTile(e, isFav) {
    const name = _escHtml(e.name);
    const starLabel = _starLabel(isFav);
    const src = isFav && _favoriteBlobUrls.has(e.name) ? _favoriteBlobUrls.get(e.name) : e.image;
    return `<button type="button" class="sc-emotes-tile" data-emote-name="${name}"><span class="sc-emotes-spinner" aria-hidden="true"></span><img src="${_escHtml(src)}" alt="${name}" title="${name}" loading="lazy"><span class="sc-emotes-tile-actions"><span class="sc-emotes-star${isFav ? " sc-emotes-star-active" : ""}" role="button" tabindex="0" data-emote-name="${name}" aria-pressed="${isFav ? "true" : "false"}" aria-label="${starLabel}" title="${starLabel}">${isFav ? "★" : "☆"}</span></span></button>`;
  }
  function wireImageLoadSpinners(container) {
    container.querySelectorAll("img").forEach((img) => {
      const tile = img.closest(".sc-emotes-tile");
      if (!tile) return;
      if (img.complete) {
        tile.classList.add("sc-emotes-img-loaded");
        return;
      }
      const onDone = () => tile.classList.add("sc-emotes-img-loaded");
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    });
  }
  function currentTabSourceList() {
    if (_activeTab === "favorites") return _emoteData.filter((e) => _emoteFavorites.has(e.name));
    return _emoteData;
  }
  function renderActiveTabGrid(grid, searchTerm) {
    const source = currentTabSourceList();
    const term = (searchTerm || "").trim().toLowerCase();
    const filtered = term ? source.filter((e) => e.name.toLowerCase().includes(term)) : source;
    if (!filtered.length) {
      const onFavorites = _activeTab === "favorites";
      const msg = onFavorites ? source.length ? "No matching favorites" : "No favorites yet" : source.length ? "No matching emotes" : "No emotes available";
      grid.innerHTML = `<div class="sc-emotes-empty">${msg}</div>`;
      return;
    }
    grid.innerHTML = filtered.map((e) => renderEmoteTile(e, _activeTab === "favorites" || _emoteFavorites.has(e.name))).join("");
    wireImageLoadSpinners(grid);
  }
  function isGifImageUrl(url) {
    if (!url) return false;
    try {
      return /\.gif$/i.test(new URL(url, location.href).pathname);
    } catch (e) {
      return /\.gif(?:[?#]|$)/i.test(url);
    }
  }
  function ensureEmotePreviewEl() {
    let preview = document.getElementById("sc-emotes-preview");
    if (preview) return preview;
    preview = document.createElement("div");
    preview.id = "sc-emotes-preview";
    preview.innerHTML = '<span class="sc-emotes-spinner" aria-hidden="true"></span><img alt="" aria-hidden="true"><span id="sc-emotes-preview-name"></span>';
    const img = preview.querySelector("img");
    const onDone = () => preview.classList.add("sc-emotes-preview-loaded");
    img.addEventListener("load", onDone);
    img.addEventListener("error", onDone);
    document.body.appendChild(preview);
    return preview;
  }
  function positionEmotePreview(preview, tile) {
    const panel = document.getElementById("sc-emotes-panel");
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const pw = preview.offsetWidth, ph = preview.offsetHeight;
    const gap = 8;
    let left = panelRect.right + gap;
    if (left + pw > window.innerWidth) left = panelRect.left - gap - pw;
    left = Math.max(4, Math.min(left, window.innerWidth - pw - 4));
    let top = tileRect.top + tileRect.height / 2 - ph / 2;
    top = Math.max(4, Math.min(top, window.innerHeight - ph - 4));
    preview.style.setProperty("left", left + "px", "important");
    preview.style.setProperty("top", top + "px", "important");
  }
  function showEmotePreview(tile) {
    const img = tile.querySelector("img");
    if (!img || !isGifImageUrl(img.src)) return;
    const preview = ensureEmotePreviewEl();
    const previewImg = preview.querySelector("img");
    if (previewImg.src !== img.src) {
      preview.classList.remove("sc-emotes-preview-loaded");
      previewImg.src = img.src;
    }
    const nameEl = preview.querySelector("#sc-emotes-preview-name");
    if (nameEl) nameEl.textContent = tile.dataset.emoteName || "";
    preview.style.setProperty("display", "block", "important");
    positionEmotePreview(preview, tile);
  }
  function hideEmotePreview() {
    const preview = document.getElementById("sc-emotes-preview");
    if (preview) preview.style.setProperty("display", "none", "important");
  }
  function teardownEmotePreview() {
    _previewTile = null;
    const preview = document.getElementById("sc-emotes-preview");
    if (preview) preview.remove();
  }
  var _previewTile = null;
  function wireEmotePreviewDelegation(body) {
    const enter = (tile) => {
      if (!tile || tile === _previewTile) return;
      _previewTile = tile;
      showEmotePreview(tile);
    };
    const leave = (tile, related) => {
      if (!tile || tile !== _previewTile) return;
      if (related && tile.contains(related)) return;
      _previewTile = null;
      hideEmotePreview();
    };
    body.addEventListener("mouseover", (e) => enter(e.target.closest(".sc-emotes-tile")));
    body.addEventListener("mouseout", (e) => leave(e.target.closest(".sc-emotes-tile"), e.relatedTarget));
    body.addEventListener("focusin", (e) => enter(e.target.closest(".sc-emotes-tile")));
    body.addEventListener("focusout", (e) => leave(e.target.closest(".sc-emotes-tile"), e.relatedTarget));
  }
  function openEmotesPanel() {
    if (document.getElementById("sc-emotes-panel")) return;
    _emoteFavorites = loadFavorites();
    _activeTab = getSavedActiveTab();
    if (!_emoteData.length) refreshEmoteData(true);
    else warmFavoriteBlobUrls();
    const panel = document.createElement("div");
    panel.id = "sc-emotes-panel";
    panel.innerHTML = `
        <div id="sc-emotes-head">
            <span>Emotes</span>
            <button id="sc-emotes-close" type="button">✕</button>
        </div>
        <div id="sc-emotes-body">
            <div id="sc-emotes-tabs" role="tablist">
                <button type="button" class="sc-emotes-tab" data-tab="all" role="tab">All</button>
                <button type="button" class="sc-emotes-tab" data-tab="favorites" role="tab">Favorites</button>
            </div>
            <input type="text" id="sc-emotes-search" class="sc-emotes-search" placeholder="Search emotes…" autocomplete="off">
            <div id="sc-emotes-grid" class="sc-emotes-grid"></div>
        </div>`;
    document.body.appendChild(panel);
    const body = panel.querySelector("#sc-emotes-body");
    const search = panel.querySelector("#sc-emotes-search");
    const tabs = panel.querySelector("#sc-emotes-tabs");
    const grid = panel.querySelector("#sc-emotes-grid");
    const updateTabButtonStates = () => {
      tabs.querySelectorAll(".sc-emotes-tab").forEach((btn) => {
        const active = btn.dataset.tab === _activeTab;
        btn.classList.toggle("sc-emotes-tab-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    };
    updateTabButtonStates();
    renderActiveTabGrid(grid, "");
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".sc-emotes-tab");
      if (!btn || btn.dataset.tab === _activeTab) return;
      _activeTab = btn.dataset.tab;
      saveActiveTab(_activeTab);
      updateTabButtonStates();
      renderActiveTabGrid(grid, search.value);
    });
    search.addEventListener("input", () => renderActiveTabGrid(grid, search.value));
    body.addEventListener("click", (e) => {
      const star = e.target.closest(".sc-emotes-star");
      if (star) {
        e.stopPropagation();
        toggleFavorite(star.dataset.emoteName);
        return;
      }
      const tile = e.target.closest(".sc-emotes-tile");
      if (!tile) return;
      insertEmoteIntoChat(tile.dataset.emoteName);
      closeEmotesPanel();
    });
    body.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const star = e.target.closest(".sc-emotes-star");
      if (!star) return;
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(star.dataset.emoteName);
    });
    wireEmotePreviewDelegation(body);
    panel.querySelector("#sc-emotes-close").addEventListener("click", closeEmotesPanel);
    const saved = getSavedEmotePanelPos();
    if (saved) {
      const rect = panel.getBoundingClientRect();
      const { x, y } = clampPanelPos(saved.left, saved.top, rect.width, rect.height);
      panel.style.setProperty("left", x + "px", "important");
      panel.style.setProperty("top", y + "px", "important");
      panel.style.setProperty("right", "auto", "important");
      panel.style.setProperty("bottom", "auto", "important");
    }
    makePanelDraggable(panel, panel.querySelector("#sc-emotes-head"), "sc-emotes-dragging", (left, top) => {
      saveEmotePanelPos(left, top);
    });
  }
  function closeEmotesPanel() {
    teardownEmotePreview();
    const panel = document.getElementById("sc-emotes-panel");
    if (panel) panel.remove();
  }
  function toggleEmotesPanel() {
    if (document.getElementById("sc-emotes-panel")) closeEmotesPanel();
    else openEmotesPanel();
  }

  // src/chat/input.js
  var tabCandidates = [];
  var tabIndex = 0;
  var tabStart = 0;
  function clearTabCandidates() {
    tabCandidates = [];
  }
  function handleTabComplete(textarea, e) {
    if (e.key !== "Tab") {
      tabCandidates = [];
      return;
    }
    e.preventDefault();
    const val = textarea.value;
    const cursor = textarea.selectionStart;
    if (tabCandidates.length === 0) {
      let i = cursor - 1;
      while (i >= 0 && /\S/.test(val[i])) i--;
      tabStart = i + 1;
      const prefix = val.slice(tabStart, cursor).replace(/^@/, "");
      tabCandidates = getChatUsernames().filter(
        (n) => n.toLowerCase().startsWith(prefix.toLowerCase())
      );
      tabIndex = 0;
    } else {
      tabIndex = (tabIndex + 1) % tabCandidates.length;
    }
    if (tabCandidates.length === 0) return;
    const completion = tabCandidates[tabIndex];
    const atPrefix = tabStart === 0 ? "@" : "";
    const insert = atPrefix + completion + " ";
    const after = val.slice(cursor);
    textarea.value = val.slice(0, tabStart) + insert + after;
    const newCursor = tabStart + insert.length;
    textarea.selectionStart = textarea.selectionEnd = newCursor;
  }
  var _VHS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5628 3728" fill="currentColor" aria-hidden="true"><g transform="matrix(1.3333333,0,0,-1.3333333,0,3728)"><g transform="scale(0.1)"><g transform="scale(2.31715)"><path d="m 16300,9657.36 v -335.45 c -157.2,180.66 -390.4,294.66 -648.5,294.66 H 2567.81 c -260.88,0 -494.75,-115.91 -651.51,-298.23 v 339.02 c 0,353.34 291.56,640.74 649.98,640.74 H 15650 c 358.5,0 650,-287.4 650,-640.74"/></g><g transform="scale(1.06574)"><path d="m 11418,14609.4 h 187.4 V 16300 c -2170.61,-146.3 -3886.11,-1953.4 -3886.11,-4161.2 0,-2207.82 1715.5,-4015.03 3886.11,-4161.31 v 1924.59 c -132.5,17.26 -261.1,46.72 -384.9,86.79 -79.8,26.13 -165.5,-18.86 -189.4,-99.46 l -34.2,-114.57 c -29.3,-98.71 -147.7,-138.87 -231.1,-78.26 l -763.8,555.02 c -83.41,60.6 -81.81,185.5 3.1,244.1 l 98.6,68 c 69.3,47.7 85.5,143.1 36.1,211 -260.06,357.1 -413.47,796.9 -413.47,1272.5 v 1.6 c 0,83.3 -68.31,150.7 -151.73,148.6 l -121.51,-3.1 c -103.15,-2.5 -177.72,97.6 -145.84,195.6 l 291.75,898 c 31.81,98.1 151.07,135.2 232.89,72.5 l 95.24,-72.8 c 66.71,-51.1 162.37,-37.3 211.77,30.6 265.9,366 643.9,645.2 1083.3,787.6 79.8,25.9 122.4,112.7 94.5,191.8 l -39.7,112.8 c -34.3,97.1 37.8,199 141,199"/></g><g transform="scale(2.08529)"><path d="m 14313.8,8330.5 v -864 h 95.9 c 52.6,0 89.5,-52.03 71.9,-101.72 l -20.2,-57.59 c -14.3,-40.47 7.4,-84.83 48.2,-98.07 224.6,-72.79 417.8,-215.46 553.8,-402.53 25.2,-34.67 74,-41.72 108.2,-15.63 l 48.6,37.26 c 41.8,31.98 102.8,12.99 119.1,-37.12 l 149.1,-458.88 c 16.3,-50.11 -21.9,-101.33 -74.6,-100.04 l -62.1,1.63 c -42.6,1.01 -77.6,-33.37 -77.5,-76 v -0.82 c 0,-243.04 -78.5,-467.75 -211.3,-650.32 -25.3,-34.67 -17,-83.49 18.4,-107.85 l 50.5,-34.76 c 43.3,-29.88 44.1,-93.76 1.5,-124.74 l -390.4,-283.6 c -42.6,-31.03 -103.1,-10.5 -118.1,39.99 l -17.4,58.51 c -12.3,41.19 -56.1,64.16 -96.9,50.88 -63.2,-20.53 -129,-35.58 -196.7,-44.41 v -983.6 c 1109.4,74.76 1986.2,998.37 1986.2,2126.75 0,1128.34 -876.8,2051.9 -1986.2,2126.66"/></g><g transform="scale(2.31715)"><path d="m 15169.1,3729.71 c 0,-505.24 -409.6,-914.79 -914.8,-914.79 h -1098.8 c -277.4,0 -502.4,224.93 -502.4,502.38 v 4531.45 c 0,277.42 225,502.4 502.4,502.4 h 1098.9 c 487.9,0 886.5,-381.98 913.3,-863.17 0.9,-17.09 1.4,-34.26 1.4,-51.57 z m -3232.9,-341.07 c 0,-340.98 -276.4,-617.4 -617.4,-617.4 H 6900.45 c -340.98,0 -617.4,276.42 -617.4,617.4 v 4388.71 c 0,340.99 276.42,617.41 617.4,617.41 h 4418.35 c 341,0 617.4,-276.42 617.4,-617.41 z M 5566.1,3317.3 c 0,-277.45 -224.93,-502.38 -502.39,-502.38 H 3964.9 c -505.22,0 -914.78,409.55 -914.78,914.79 v 3706.7 c 0,505.18 409.56,914.74 914.73,914.74 h 1098.86 c 264.47,0 481.2,-204.38 500.96,-463.77 0.95,-12.76 1.43,-25.62 1.43,-38.63 z m 10732.5,5385.84 c -24.1,387.6 -346.1,694.52 -739.8,694.52 H 2660.51 c -409.41,0 -741.25,-331.89 -741.25,-741.25 V 2509.63 c 0,-409.38 331.84,-741.21 741.25,-741.21 H 15558.8 c 409.4,0 741.2,331.83 741.2,741.21 v 6146.78 c 0,15.73 -0.5,31.3 -1.4,46.73"/></g></g></g></svg>';
  function relocateEmoteButton() {
    if (document.getElementById("sc-emote-proxy")) return;
    const original = document.getElementById("emotelistbtn");
    if (!original) return;
    const proxy = document.createElement("button");
    proxy.id = "sc-emote-proxy";
    proxy.innerHTML = _VHS_SVG;
    proxy.title = "Emotes";
    proxy.dataset.tvLabel = "Emotes";
    proxy.setAttribute("aria-label", "Emote Picker");
    proxy.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleEmotesPanel();
    });
    const inputRow = document.getElementById("sc-mobile-input-row");
    if (!inputRow) return;
    inputRow.appendChild(proxy);
  }
  var applyInputMode = () => {
    const inputs = document.getElementsByClassName("emotelist-search");
    if (!inputs.length) return;
    for (const input of inputs) {
      if (input.getAttribute("inputmode") !== "none") input.setAttribute("inputmode", "none");
    }
  };

  // src/chrome/state.js
  var chromeState = {
    topBarWake: null,
    // wake fn set by initTopBar; called to un-dim the top bar
    leftZoneReveal: null,
    // expose so video-tap can trigger both chrome systems together
    rightZoneReveal: null,
    // vertical-mode right-edge drawer
    chromeWake: null,
    // re-arms the TV chrome auto-hide (remote keys bypass DOM events)
    pinChromeVisible: null,
    // suspends the chrome auto-hide idle timer (set by initChromeAutohide)
    unpinChromeVisible: null
    // resumes it and fades immediately, in sync with whatever pinned it
  };

  // src/usercolors.js
  function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) + h ^ str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
  function usernameToColor(u) {
    const hue = hashString(u) * 137.508 % 360;
    return `hsl(${hue.toFixed(1)}, 72%, 70%)`;
  }

  // src/useremoji.js
  var _cachedSourceText = null;
  var _cachedStyles = null;
  function parseUserStyles(jsText) {
    const m = jsText.match(/const\s+userStyles\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) return null;
    try {
      const obj = new Function("return (" + m[1] + ")")();
      return obj && typeof obj === "object" ? obj : null;
    } catch (e) {
      return null;
    }
  }
  function getExternalUserEmoji(username) {
    const jsText = window.CHANNEL && CHANNEL.js;
    if (!jsText) return null;
    if (jsText !== _cachedSourceText) {
      _cachedSourceText = jsText;
      _cachedStyles = parseUserStyles(jsText);
    }
    if (!_cachedStyles) return null;
    const entry = _cachedStyles[username];
    if (Array.isArray(entry)) return entry[0] || null;
    if (typeof entry === "string") return entry;
    return null;
  }

  // src/lineup/reddit.js
  var FEED_URL = "https://www.reddit.com/r/420Grindhouse/.rss";
  var BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  };
  var DAY_NAMES = ["Friday", "Saturday", "Sunday"];
  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function decodeHtmlEntities(s) {
    return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  }
  function parseEntries(feedXml) {
    const entries = [];
    let searchFrom = 0;
    while (true) {
      const start = feedXml.indexOf("<entry>", searchFrom);
      if (start === -1) break;
      const end = feedXml.indexOf("</entry>", start);
      if (end === -1) break;
      const entry = feedXml.slice(start, end + "</entry>".length);
      searchFrom = end + "</entry>".length;
      const idM = entry.match(/<id>([^<]+)<\/id>/);
      const titleM = entry.match(/<title>([^<]+)<\/title>/);
      const contentM = entry.match(/<content type="html">([\s\S]*?)<\/content>/);
      if (!idM || !titleM || !contentM) continue;
      const pubM = entry.match(/<published>([^<]+)<\/published>/);
      entries.push({
        postId: idM[1],
        title: decodeHtmlEntities(titleM[1]),
        publishedAt: pubM ? pubM[1] : null,
        contentHtml: decodeHtmlEntities(contentM[1])
      });
    }
    return entries;
  }
  var CANDIDATE_SCAN_LIMIT = 5;
  function selectCurrentEntry(entries) {
    let best = null;
    for (const entry of entries.slice(0, CANDIDATE_SCAN_LIMIT)) {
      if (!parseDateRange(entry.title, entry.publishedAt)) continue;
      if (!best || new Date(entry.publishedAt) > new Date(best.publishedAt)) best = entry;
    }
    return best;
  }
  function parseDateRange(title, publishedAt) {
    const m = title && title.match(/Fri\D*(\d{1,2})\/(\d{1,2})/i);
    if (!m || !publishedAt) return null;
    const pub = new Date(publishedAt);
    if (isNaN(pub.getTime())) return null;
    const friMonth = parseInt(m[1], 10), friDay = parseInt(m[2], 10);
    const pubMonth = pub.getMonth() + 1;
    const year = pubMonth === 12 && friMonth === 1 ? pub.getFullYear() + 1 : pub.getFullYear();
    const fri = Date.UTC(year, friMonth - 1, friDay);
    const toStr = (ms) => new Date(ms).toISOString().slice(0, 10);
    return { fri: toStr(fri), sat: toStr(fri + 864e5), sun: toStr(fri + 2 * 864e5) };
  }
  function parseListItems(ulInnerHtml) {
    const items = [];
    const liRe = /<li>([\s\S]*?)<\/li>/g;
    let lm;
    while (lm = liRe.exec(ulInnerHtml)) {
      const display = lm[1].replace(/<strong>[^<]*<\/strong>\s*/, "").replace(/<[^>]+>/g, "").trim();
      if (!display) continue;
      const [primary, ...akaParts] = display.split(/\s+aka\s+/i);
      const akas = akaParts.map((a) => a.replace(/\s*\(\d{4}\)\s*$/, "").trim()).filter(Boolean);
      const ym = primary.trim().match(/^(.*?)\s*\((\d{4})\)/);
      if (ym) {
        items.push({ title: ym[1].trim(), year: ym[2], display, akas });
      } else {
        console.warn("[SC] lineup: could not parse title/year from schedule item, showing raw text:", display);
        items.push({ title: primary.trim(), year: null, display, akas });
      }
    }
    return items;
  }
  function itemMatchesTitle(item, title) {
    const t = (title || "").toLowerCase();
    if (item.title.toLowerCase() === t) return true;
    return (item.akas || []).some((a) => a.toLowerCase() === t);
  }
  function parseSchedule(contentHtml) {
    const days = [];
    let currentDay = null;
    let pendingSectionName = null;
    const re = /<strong>([^<]*)<\/strong>|<ul>([\s\S]*?)<\/ul>/g;
    let m;
    while (m = re.exec(contentHtml)) {
      if (m[1] !== void 0) {
        const text = m[1].trim();
        const dayName = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
        if (DAY_NAMES.includes(dayName)) {
          currentDay = { day: dayName, sections: [] };
          days.push(currentDay);
          pendingSectionName = null;
        } else {
          pendingSectionName = text;
        }
      } else if (currentDay && pendingSectionName) {
        const items = parseListItems(m[2]);
        if (items.length) currentDay.sections.push({ name: pendingSectionName, slug: slugify(pendingSectionName), items });
        pendingSectionName = null;
      }
    }
    return days;
  }
  async function fetchTonightsSchedule() {
    const { nativeHttpGet: nativeHttpGet2 } = await Promise.resolve().then(() => (init_native(), native_exports));
    const res = await nativeHttpGet2(FEED_URL, BROWSER_HEADERS);
    if (!res || res.status !== 200) throw new Error("Reddit feed HTTP " + (res && res.status));
    const entries = parseEntries(res.body);
    if (!entries.length) throw new Error("no entries found in feed");
    const entry = selectCurrentEntry(entries);
    if (!entry) throw new Error("no schedule post found in feed");
    const dateRange = parseDateRange(entry.title, entry.publishedAt);
    if (!dateRange) throw new Error("could not parse weekend date range from title: " + entry.title);
    const days = parseSchedule(entry.contentHtml);
    if (!days.length) throw new Error("no days parsed from schedule post");
    const dateByDay = { Friday: dateRange.fri, Saturday: dateRange.sat, Sunday: dateRange.sun };
    return {
      postId: entry.postId,
      title: entry.title,
      publishedAt: entry.publishedAt,
      days: days.map((d) => ({ ...d, date: dateByDay[d.day] || null }))
    };
  }

  // src/metadata/tmdb.js
  init_native();

  // src/metadata/imdb.js
  init_native();
  var IMDB_GQL = "https://caching.graphql.imdb.com/";
  var IMDB_HEADERS = {
    "Accept": "application/graphql+json, application/json",
    "Content-Type": "application/json",
    "x-imdb-client-name": "imdb-web-next-localized",
    "x-imdb-user-language": "en-US",
    "x-imdb-user-country": "US"
  };
  async function imdbQuery(operationName, query, variables) {
    const url = IMDB_GQL + "?operationName=" + encodeURIComponent(operationName) + "&query=" + encodeURIComponent(query) + "&variables=" + encodeURIComponent(JSON.stringify(variables));
    const res = await nativeHttpGet(url, IMDB_HEADERS);
    if (!res || res.status !== 200) throw new Error("IMDb GQL HTTP " + (res && res.status));
    return JSON.parse(res.body);
  }
  var IMDB_MAIN_SEARCH_QUERY = "query MainSearch($term: String!) { mainSearch(first: 20, options: { searchTerm: $term, type: TITLE }) { edges { node { entity { ... on Title { id titleText { text } releaseYear { year } titleType { text id isSeries isEpisode } ratingsSummary { voteCount } } } } } } }";
  function byVoteCountDesc(a, b) {
    var _a, _b, _c, _d;
    return ((_b = (_a = b.ratingsSummary) == null ? void 0 : _a.voteCount) != null ? _b : 0) - ((_d = (_c = a.ratingsSummary) == null ? void 0 : _c.voteCount) != null ? _d : 0);
  }
  var ROMAN_NUMERALS = {
    ii: 2,
    iii: 3,
    iv: 4,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    xi: 11,
    xii: 12,
    xiii: 13,
    xiv: 14,
    xv: 15,
    xvi: 16,
    xvii: 17,
    xviii: 18,
    xix: 19,
    xx: 20
  };
  function normalizeTitle(s) {
    return (s || "").toLowerCase().replace(/^(the|a|an)\s+/, "").split(/[^a-z0-9]+/).filter(Boolean).map((w) => ROMAN_NUMERALS[w] !== void 0 ? String(ROMAN_NUMERALS[w]) : w).join(" ");
  }
  var TITLE_STOPWORDS = /* @__PURE__ */ new Set(["a", "an", "the", "of", "and"]);
  function titleTokens(s) {
    return new Set(normalizeTitle(s).split(" ").filter((w) => w && !TITLE_STOPWORDS.has(w)));
  }
  function titlesMatch(a, b) {
    const setA = titleTokens(a);
    const setB = titleTokens(b);
    if (!setA.size || !setB.size) return false;
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection++;
    return 2 * intersection / (setA.size + setB.size) >= 0.7;
  }
  async function imdbSearchTitle(title, year) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!title) return null;
    try {
      const data = await imdbQuery("MainSearch", IMDB_MAIN_SEARCH_QUERY, { term: title });
      const edges = ((_b = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a.mainSearch) == null ? void 0 : _b.edges) || [];
      const results = edges.map((e) => {
        var _a2;
        return (_a2 = e == null ? void 0 : e.node) == null ? void 0 : _a2.entity;
      }).filter(Boolean);
      const movies = results.filter((r) => {
        var _a2;
        return ((_a2 = r.titleType) == null ? void 0 : _a2.id) === "movie";
      });
      const tvEpisodes = results.filter((r) => {
        var _a2;
        return ((_a2 = r.titleType) == null ? void 0 : _a2.id) === "tvEpisode";
      });
      const nonPodcast = results.filter((r) => {
        var _a2;
        return ((_a2 = r.titleType) == null ? void 0 : _a2.id) !== "podcastEpisode";
      });
      const tiers = [movies, tvEpisodes, nonPodcast, results];
      let titleMatches = [];
      for (const tier of tiers) {
        titleMatches = tier.filter((r) => {
          var _a2;
          return titlesMatch((_a2 = r.titleText) == null ? void 0 : _a2.text, title);
        });
        if (titleMatches.length) break;
      }
      if (!titleMatches.length) return null;
      const yearMatches = year ? titleMatches.filter((r) => {
        var _a2;
        return String((_a2 = r.releaseYear) == null ? void 0 : _a2.year) === String(year);
      }) : [];
      const candidates = yearMatches.length ? yearMatches : titleMatches;
      const best = candidates.slice().sort(byVoteCountDesc)[0] || null;
      if (!best) return null;
      return {
        tconst: best.id,
        title: (_d = (_c = best.titleText) == null ? void 0 : _c.text) != null ? _d : null,
        year: (_f = (_e = best.releaseYear) == null ? void 0 : _e.year) != null ? _f : null,
        titleType: (_h = (_g = best.titleType) == null ? void 0 : _g.id) != null ? _h : null
      };
    } catch (e) {
      return null;
    }
  }
  var IMDB_TITLE_FIELDS_QUERY = "query GHCombined($id: ID!){ title(id:$id){ id ratingsSummary{ aggregateRating voteCount } runtime{ seconds } plot{ plotText{ plainText } } primaryImage{ url width height } titleGenres{ genres{ genre{ text } } } } }";
  async function fetchImdbTitleFields(tconst) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    if (!tconst) return null;
    try {
      const data = await imdbQuery("GHCombined", IMDB_TITLE_FIELDS_QUERY, { id: tconst });
      const t = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a.title;
      if (!t) return null;
      return {
        rating: (_c = (_b = t.ratingsSummary) == null ? void 0 : _b.aggregateRating) != null ? _c : null,
        runtime: ((_d = t.runtime) == null ? void 0 : _d.seconds) != null ? Math.round(t.runtime.seconds / 60) : null,
        overview: (_g = (_f = (_e = t.plot) == null ? void 0 : _e.plotText) == null ? void 0 : _f.plainText) != null ? _g : null,
        poster: (_i = (_h = t.primaryImage) == null ? void 0 : _h.url) != null ? _i : null,
        genres: (_l = (_k = (_j = t.titleGenres) == null ? void 0 : _j.genres) == null ? void 0 : _k.map((g) => {
          var _a2;
          return (_a2 = g.genre) == null ? void 0 : _a2.text;
        }).filter(Boolean)) != null ? _l : null
      };
    } catch (e) {
      return null;
    }
  }
  async function fetchImdbMovieByTitle(title, year) {
    const match = await imdbSearchTitle(title, year);
    if (!match || !match.tconst) return null;
    const fields = await fetchImdbTitleFields(match.tconst);
    return {
      tconst: match.tconst,
      title: match.title,
      year: match.year,
      ...fields || {}
    };
  }
  async function fetchImdbParentalGuide(tconst) {
    if (!tconst) return null;
    const q = "query GHGuide($id: ID!){ title(id:$id){ parentsGuide{ categories{ category{ text } severity{ text } } } } }";
    try {
      const data = await imdbQuery("GHGuide", q, { id: tconst });
      const cats = data && data.data && data.data.title && data.data.title.parentsGuide ? data.data.title.parentsGuide.categories : null;
      if (!cats) return null;
      return cats.map((c) => ({ category: c.category && c.category.text, severity: c.severity && c.severity.text })).filter((c) => c.category && c.severity);
    } catch (e) {
      return null;
    }
  }
  var _triviaCache = {};
  async function fetchImdbTrivia(tconst) {
    if (!tconst) return null;
    if (_triviaCache[tconst]) return _triviaCache[tconst];
    const q = "query GHTrivia($id: ID!){ title(id:$id){ trivia(first: 30){ edges{ node{ text{ plainText } } } } } }";
    try {
      const data = await imdbQuery("GHTrivia", q, { id: tconst });
      const edges = data && data.data && data.data.title && data.data.title.trivia ? data.data.title.trivia.edges : [];
      const items = (edges || []).map((e) => e && e.node && e.node.text && e.node.text.plainText).filter(Boolean);
      _triviaCache[tconst] = items;
      return items;
    } catch (e) {
      return null;
    }
  }
  async function fetchCastAndDirector(tconst) {
    var _a, _b, _c, _d, _e, _f;
    if (!tconst) return null;
    const q = 'query GHCastAndDirector($id: ID!){ title(id:$id){ series{ series{ id } } cast: credits(first: 3, filter: { categories: ["cast"] }) { edges{ node{ name{ id nameText{ text } } ... on Cast { characters{ name } } } } } directors: credits(first: 1, filter: { categories: ["director"] }) { edges{ node{ name{ id nameText{ text } } } } } } }';
    try {
      const data = await imdbQuery("GHCastAndDirector", q, { id: tconst });
      const t = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a.title;
      if (!t) return null;
      const cast = (((_b = t.cast) == null ? void 0 : _b.edges) || []).map((e) => {
        var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i, _j, _k;
        return {
          nconst: (_c2 = (_b2 = (_a2 = e == null ? void 0 : e.node) == null ? void 0 : _a2.name) == null ? void 0 : _b2.id) != null ? _c2 : null,
          name: (_g = (_f2 = (_e2 = (_d2 = e == null ? void 0 : e.node) == null ? void 0 : _d2.name) == null ? void 0 : _e2.nameText) == null ? void 0 : _f2.text) != null ? _g : null,
          character: (_k = (_j = (_i = (_h = e == null ? void 0 : e.node) == null ? void 0 : _h.characters) == null ? void 0 : _i[0]) == null ? void 0 : _j.name) != null ? _k : null,
          role: "cast"
        };
      }).filter((p) => p.nconst && p.name);
      const directors = (((_c = t.directors) == null ? void 0 : _c.edges) || []).map((e) => {
        var _a2, _b2, _c2, _d2, _e2, _f2, _g;
        return {
          nconst: (_c2 = (_b2 = (_a2 = e == null ? void 0 : e.node) == null ? void 0 : _a2.name) == null ? void 0 : _b2.id) != null ? _c2 : null,
          name: (_g = (_f2 = (_e2 = (_d2 = e == null ? void 0 : e.node) == null ? void 0 : _d2.name) == null ? void 0 : _e2.nameText) == null ? void 0 : _f2.text) != null ? _g : null,
          character: null,
          role: "director"
        };
      }).filter((p) => p.nconst && p.name);
      const seen = /* @__PURE__ */ new Set();
      return {
        people: cast.concat(directors).filter((p) => !seen.has(p.nconst) && seen.add(p.nconst)),
        seriesTconst: (_f = (_e = (_d = t.series) == null ? void 0 : _d.series) == null ? void 0 : _e.id) != null ? _f : null
      };
    } catch (e) {
      return null;
    }
  }
  var _personTriviaCache = {};
  async function fetchPersonTrivia(nconst) {
    var _a, _b, _c;
    if (!nconst) return [];
    if (_personTriviaCache[nconst]) return _personTriviaCache[nconst];
    const q = "query GHPersonTrivia($id: ID!){ name(id:$id){ trivia(first: 10){ edges{ node{ text{ plainText } } } } } }";
    try {
      const data = await imdbQuery("GHPersonTrivia", q, { id: nconst });
      const edges = ((_c = (_b = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a.name) == null ? void 0 : _b.trivia) == null ? void 0 : _c.edges) || [];
      const items = edges.map((e) => {
        var _a2, _b2;
        return (_b2 = (_a2 = e == null ? void 0 : e.node) == null ? void 0 : _a2.text) == null ? void 0 : _b2.plainText;
      }).filter(Boolean);
      _personTriviaCache[nconst] = items;
      return items;
    } catch (e) {
      return [];
    }
  }
  var _personKnownForCache = {};
  async function fetchPersonKnownFor(nconst, excludeTconst, excludeSeriesTconst) {
    var _a, _b, _c, _d, _e;
    if (!nconst) return null;
    const cacheKey = `${nconst}|${excludeTconst}|${excludeSeriesTconst || ""}`;
    if (_personKnownForCache[cacheKey] !== void 0) return _personKnownForCache[cacheKey];
    const q = "query GHKnownFor($id: ID!){ name(id:$id){ knownFor(first: 6){ edges{ node{ title{ id titleText{ text } releaseYear{ year } ratingsSummary{ voteCount } } } } } } }";
    try {
      const data = await imdbQuery("GHKnownFor", q, { id: nconst });
      const edges = ((_c = (_b = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a.name) == null ? void 0 : _b.knownFor) == null ? void 0 : _c.edges) || [];
      const titles = edges.map((e) => {
        var _a2;
        return (_a2 = e == null ? void 0 : e.node) == null ? void 0 : _a2.title;
      }).filter((t) => {
        var _a2;
        return t && t.id && t.id !== excludeTconst && t.id !== excludeSeriesTconst && ((_a2 = t.titleText) == null ? void 0 : _a2.text);
      });
      if (!titles.length) {
        _personKnownForCache[cacheKey] = null;
        return null;
      }
      titles.sort((a, b) => {
        var _a2, _b2, _c2, _d2;
        return ((_b2 = (_a2 = b.ratingsSummary) == null ? void 0 : _a2.voteCount) != null ? _b2 : 0) - ((_d2 = (_c2 = a.ratingsSummary) == null ? void 0 : _c2.voteCount) != null ? _d2 : 0);
      });
      const best = titles[0];
      const result = { title: best.titleText.text, year: (_e = (_d = best.releaseYear) == null ? void 0 : _d.year) != null ? _e : null };
      _personKnownForCache[cacheKey] = result;
      return result;
    } catch (e) {
      return null;
    }
  }

  // src/metadata/tmdb.js
  var LINK_DEFS = [
    { key: "imdb", label: "IMDb", color: "#f5c518", fg: "#000", char: "i" },
    { key: "letterboxd", label: "Letterboxd", color: "#2c4a2e", fg: "#00e054", char: "L" },
    { key: "wiki", label: "Wikipedia", color: "#444", fg: "#eee", char: "W" }
  ];
  var LS_MOVIE_CACHE = "sc_movie_cache_v1";
  var MOVIE_CACHE_MAX_AGE_MS = 9 * 24 * 60 * 60 * 1e3;
  var MOVIE_CACHE_MAX_ENTRIES = 300;
  var LS_KILLCOUNT_CACHE = "sc_killcount_cache_v1";
  var KILLCOUNT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1e3;
  var _movieCacheTimestamps = {};
  function loadMovieCache() {
    var _a;
    try {
      const raw = localStorage.getItem(LS_MOVIE_CACHE);
      if (!raw) return;
      const stored = JSON.parse(raw);
      const now = Date.now();
      for (const [key, entry] of Object.entries(stored)) {
        if (entry && ((_a = entry.result) == null ? void 0 : _a.resolved) && now - entry.ts < MOVIE_CACHE_MAX_AGE_MS) {
          movieState.movieLinkCache[key] = entry.result;
          _movieCacheTimestamps[key] = entry.ts;
        }
      }
    } catch (e) {
    }
  }
  function persistMovieCache() {
    try {
      const keys = Object.keys(movieState.movieLinkCache);
      if (keys.length > MOVIE_CACHE_MAX_ENTRIES) {
        const oldestFirst = keys.sort((a, b) => (_movieCacheTimestamps[a] || 0) - (_movieCacheTimestamps[b] || 0));
        for (const k of oldestFirst.slice(0, keys.length - MOVIE_CACHE_MAX_ENTRIES)) {
          delete movieState.movieLinkCache[k];
          delete _movieCacheTimestamps[k];
        }
      }
      const out = {};
      for (const key of Object.keys(movieState.movieLinkCache)) {
        out[key] = { result: movieState.movieLinkCache[key], ts: _movieCacheTimestamps[key] || Date.now() };
      }
      localStorage.setItem(LS_MOVIE_CACHE, JSON.stringify(out));
    } catch (e) {
    }
  }
  var movieState = {
    lastMovieTitle: "",
    movieLinkCache: {}
    // cache by raw title to avoid repeat lookups
  };
  loadMovieCache();
  var killCountDb = null;
  function loadKillCountCache() {
    try {
      const raw = localStorage.getItem(LS_KILLCOUNT_CACHE);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (data && Date.now() - ts < KILLCOUNT_CACHE_MAX_AGE_MS) return data;
    } catch (e) {
    }
    return null;
  }
  function saveKillCountCache(data) {
    try {
      localStorage.setItem(LS_KILLCOUNT_CACHE, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
    }
  }
  async function getKillCountDb() {
    if (killCountDb !== null) return killCountDb;
    const cached = loadKillCountCache();
    if (cached) {
      killCountDb = cached;
      return killCountDb;
    }
    killCountDb = {};
    try {
      const res = await nativeHttpGet("https://raw.githubusercontent.com/lklynet/Kill-Count/main/killcounts.jsonl");
      if (!res || res.status !== 200) throw new Error("HTTP " + (res && res.status));
      let loaded = 0;
      for (const line of res.body.split("\n")) {
        const s = line.trim();
        if (!s) continue;
        try {
          const entry = JSON.parse(s);
          if (entry.tmdb_id != null) {
            killCountDb[String(entry.tmdb_id)] = entry.count;
            loaded++;
          }
        } catch (e) {
        }
      }
      saveKillCountCache(killCountDb);
    } catch (e) {
      console.warn("[CyTube SC] Kill count DB failed to load:", e);
    }
    return killCountDb;
  }
  async function validateTmdbKey(key) {
    if (!key) return "invalid";
    const url = `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url);
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    } catch (e) {
      try {
        const r = await nativeHttpGet(url);
        if (r.status === 200) return "valid";
        if (r.status === 401) return "invalid";
        return "error";
      } catch (e2) {
        return "error";
      }
    }
  }
  async function fetchTmdbSupplemental(imdbId) {
    var _a;
    const empty = { tmdbId: null, poster: null, backdrop: null, killCount: null };
    if (!imdbId || !hasKey(LS_TMDB)) return empty;
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(getKey(LS_TMDB))}`
      );
      if (!res.ok) return empty;
      const data = await res.json();
      const movie = data.movie_results && data.movie_results[0];
      if (!movie) return empty;
      const tmdbId = (_a = movie.id) != null ? _a : null;
      const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
      let killCount = null;
      if (tmdbId != null) {
        const db = await getKillCountDb();
        const count = db[String(tmdbId)];
        if (count !== void 0 && count !== null) killCount = count;
      }
      return { tmdbId, poster, backdrop, killCount };
    } catch (e) {
      return empty;
    }
  }
  async function fetchTmdbPrimary(title, year) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!title || !hasKey(LS_TMDB)) return null;
    try {
      const apiKey = getKey(LS_TMDB);
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&api_key=${encodeURIComponent(apiKey)}`
      );
      if (!searchRes.ok) return null;
      const searchData = await searchRes.json();
      const candidates = (searchData.results || []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
      if (!candidates.length) return null;
      let best = candidates[0];
      if (year) {
        const yearMatch = candidates.find((r) => (r.release_date || r.first_air_date || "").slice(0, 4) === String(year));
        if (yearMatch) best = yearMatch;
      }
      const mediaType = best.media_type;
      const detailsRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${best.id}?append_to_response=external_ids&api_key=${encodeURIComponent(apiKey)}`
      );
      if (!detailsRes.ok) return null;
      const d = await detailsRes.json();
      const imdbId = ((_a = d.external_ids) == null ? void 0 : _a.imdb_id) || null;
      if (!imdbId) return null;
      let killCount = null;
      if (mediaType === "movie" && best.id != null) {
        const db = await getKillCountDb();
        const count = db[String(best.id)];
        if (count !== void 0 && count !== null) killCount = count;
      }
      return {
        imdbId,
        tmdbId: (_b = best.id) != null ? _b : null,
        title: mediaType === "movie" ? (_c = d.title) != null ? _c : null : (_d = d.name) != null ? _d : null,
        year: (d.release_date || d.first_air_date || "").slice(0, 4) || null,
        rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
        runtime: mediaType === "movie" ? (_e = d.runtime) != null ? _e : null : (_g = (_f = d.episode_run_time) == null ? void 0 : _f[0]) != null ? _g : null,
        genres: (d.genres || []).map((g) => g.name).filter(Boolean),
        overview: d.overview || null,
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
        backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
        killCount
      };
    } catch (e) {
      return null;
    }
  }
  async function lookupMovie(title, year) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t;
    const cacheKey = title + (year || "");
    if (movieState.movieLinkCache[cacheKey] !== void 0) return movieState.movieLinkCache[cacheKey];
    let wikiUrl = null;
    const tmdbPrimaryPromise = fetchTmdbPrimary(title, year);
    const wikiPromise = (async () => {
      var _a2, _b2;
      try {
        const searchTitle = title + (year ? " " + year : "") + " film";
        const res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTitle)}&srlimit=1&format=json&origin=*`
        );
        if (!res.ok) return;
        const data = await res.json();
        const hit = (_b2 = (_a2 = data == null ? void 0 : data.query) == null ? void 0 : _a2.search) == null ? void 0 : _b2[0];
        if (hit) wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`;
      } catch (e) {
      }
    })();
    const rawTmdbPrimary = await tmdbPrimaryPromise;
    const tmdbPrimary = rawTmdbPrimary && titlesMatch(rawTmdbPrimary.title, title) ? rawTmdbPrimary : null;
    let imdbResult = null;
    let tmdbSupplemental = null;
    let imdbId;
    if (tmdbPrimary) {
      imdbId = tmdbPrimary.imdbId;
    } else {
      imdbResult = await fetchImdbMovieByTitle(title, year);
      imdbId = (imdbResult == null ? void 0 : imdbResult.tconst) || null;
      tmdbSupplemental = await fetchTmdbSupplemental(imdbId);
    }
    const parentalGuide = await fetchImdbParentalGuide(imdbId);
    await wikiPromise;
    const result = {
      links: {
        imdb: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
        letterboxd: imdbId ? `https://letterboxd.com/imdb/${imdbId}` : null,
        wiki: wikiUrl
      },
      resolved: !!(tmdbPrimary || imdbResult),
      killCount: (_b = (_a = tmdbPrimary == null ? void 0 : tmdbPrimary.killCount) != null ? _a : tmdbSupplemental == null ? void 0 : tmdbSupplemental.killCount) != null ? _b : null,
      parentalGuide,
      imdbId: imdbId || null,
      cleanTitle: (_d = (_c = tmdbPrimary == null ? void 0 : tmdbPrimary.title) != null ? _c : imdbResult == null ? void 0 : imdbResult.title) != null ? _d : null,
      cleanYear: (_f = (_e = tmdbPrimary == null ? void 0 : tmdbPrimary.year) != null ? _e : imdbResult == null ? void 0 : imdbResult.year) != null ? _f : null,
      rating: (_h = (_g = tmdbPrimary == null ? void 0 : tmdbPrimary.rating) != null ? _g : imdbResult == null ? void 0 : imdbResult.rating) != null ? _h : null,
      runtime: (_j = (_i = tmdbPrimary == null ? void 0 : tmdbPrimary.runtime) != null ? _i : imdbResult == null ? void 0 : imdbResult.runtime) != null ? _j : null,
      genres: (_l = (_k = tmdbPrimary == null ? void 0 : tmdbPrimary.genres) != null ? _k : imdbResult == null ? void 0 : imdbResult.genres) != null ? _l : [],
      // TMDB's poster/backdrop take priority over IMDb's; IMDb has no dedicated
      // wide "backdrop" field, so its (usually portrait) poster is reused for
      // both -- the card's CSS crops it to fill, same pattern used when no
      // dedicated backdrop exists.
      poster: (_o = (_n = (_m = tmdbPrimary == null ? void 0 : tmdbPrimary.poster) != null ? _m : tmdbSupplemental == null ? void 0 : tmdbSupplemental.poster) != null ? _n : imdbResult == null ? void 0 : imdbResult.poster) != null ? _o : null,
      backdrop: (_r = (_q = (_p = tmdbPrimary == null ? void 0 : tmdbPrimary.backdrop) != null ? _p : tmdbSupplemental == null ? void 0 : tmdbSupplemental.backdrop) != null ? _q : imdbResult == null ? void 0 : imdbResult.poster) != null ? _r : null,
      overview: (_t = (_s = tmdbPrimary == null ? void 0 : tmdbPrimary.overview) != null ? _s : imdbResult == null ? void 0 : imdbResult.overview) != null ? _t : ""
    };
    if (result.resolved) {
      movieState.movieLinkCache[cacheKey] = result;
      _movieCacheTimestamps[cacheKey] = Date.now();
      persistMovieCache();
    }
    return result;
  }

  // src/mediatime.js
  var mediaState = {
    currentMediaSeconds: 0,
    currentMediaType: "",
    currentYtVideoId: "",
    // 'yt' media's video id, from changeMedia -- for the oEmbed fallback
    currentPlaybackTime: 0,
    // Room's live playhead, tracked ONLY while desynced (chrome/buttons.js) via a dedicated
    // mediaUpdate listener registered after freezeSync() empties the normal one -- see that
    // file's comment. null = no tick received yet this desync session.
    desyncLiveSeconds: null,
    desyncLiveAt: 0,
    desyncLivePaused: false
  };
  function parseTimeToSeconds(t) {
    const parts = String(t).trim().split(":").map(Number);
    if (!parts.length || parts.some(isNaN)) return 0;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  }
  function getCurrentMediaSeconds() {
    if (mediaState.currentMediaSeconds > 0) return mediaState.currentMediaSeconds;
    const el = document.querySelector("#queue .queue_active .qe_time, #queue .queue_entry.active .qe_time");
    if (el) {
      const t = parseTimeToSeconds(el.textContent);
      if (t > 0) return t;
    }
    const v = document.querySelector("#videowrap video");
    if (v && isFinite(v.duration) && v.duration > 0) return v.duration;
    return 0;
  }
  function getCurrentPlaybackSeconds() {
    const v = document.querySelector("#videowrap video");
    if (v && isFinite(v.currentTime) && v.currentTime > 0) return v.currentTime;
    return mediaState.currentPlaybackTime;
  }
  function getDesyncLiveSeconds() {
    if (mediaState.desyncLiveSeconds == null) return null;
    if (mediaState.desyncLivePaused) return mediaState.desyncLiveSeconds;
    return mediaState.desyncLiveSeconds + Math.max(0, (Date.now() - mediaState.desyncLiveAt) / 1e3);
  }
  function formatHMS(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }

  // src/lineup/timing.js
  function formatEta(hour24, minute, precision) {
    if (precision === "late") return "LATE";
    const period = hour24 >= 12 ? "PM" : "AM";
    let h = hour24 % 12;
    if (h === 0) h = 12;
    const mm = String(minute).padStart(2, "0");
    const prefix = precision === "approx" ? "~" : "≈";
    return `${prefix} ${h}:${mm} ${period}`;
  }
  function medianGapSeconds(observedGaps) {
    if (!observedGaps.length) return null;
    const sorted = [...observedGaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function roundEtaMs(etaMs, precision, nowMs) {
    const grid = precision === "exact" ? 5 * 6e4 : 15 * 6e4;
    const round = precision === "exact" ? Math.round : Math.floor;
    const rounded = round(etaMs / grid) * grid;
    if (nowMs != null && rounded < nowMs) return Math.ceil(nowMs / grid) * grid;
    return rounded;
  }
  var MAX_ESTIMATED_AHEAD = 4;
  var MAX_PRE_SHOW = 3;
  function makeGapMsFor(sectionOf, sameSectionGapSeconds, crossSectionGapSeconds) {
    return (idx) => {
      const crossing = sectionOf && idx > 0 && idx < sectionOf.length && sectionOf[idx] !== sectionOf[idx - 1];
      return (crossing ? crossSectionGapSeconds : sameSectionGapSeconds) * 1e3;
    };
  }
  function estimateDayItems({
    nowMs,
    anchorMs,
    runtimesMin,
    sectionOf,
    sameSectionGapSeconds,
    crossSectionGapSeconds,
    dayStatus,
    currentIndex,
    remainingSec,
    furthestPlayedIndex,
    bumperStartMs
  }) {
    const gapMsFor = makeGapMsFor(sectionOf, sameSectionGapSeconds, crossSectionGapSeconds);
    const runtimeMs = (i) => runtimesMin[i] ? runtimesMin[i] * 6e4 : 0;
    const runtimeUnknown = (i) => runtimesMin[i] == null;
    const blank = { played: false, isNowPlaying: false, etaMs: null, precision: "approx" };
    if (dayStatus === "past") {
      return runtimesMin.map(() => ({ ...blank, played: true }));
    }
    const projected = [];
    let cursor = anchorMs;
    runtimesMin.forEach((_, i) => {
      projected.push({ startMs: cursor, endMs: cursor + runtimeMs(i) });
      cursor += runtimeMs(i) + gapMsFor(i + 1);
    });
    if (dayStatus === "today" && currentIndex >= 0) {
      let cumulative = remainingSec != null ? Math.max(0, remainingSec) * 1e3 : 0;
      let confident2 = remainingSec != null;
      return runtimesMin.map((_, idx) => {
        if (idx === currentIndex) return { ...blank, isNowPlaying: true };
        if (idx < currentIndex || idx <= furthestPlayedIndex) return { ...blank, played: true };
        const offset = idx - currentIndex;
        cumulative += gapMsFor(idx);
        const withEta = offset <= MAX_ESTIMATED_AHEAD && confident2 ? { ...blank, etaMs: nowMs + cumulative, precision: offset === 1 ? "exact" : "approx" } : { ...blank };
        if (runtimeUnknown(idx)) confident2 = false;
        cumulative += runtimeMs(idx);
        return withEta;
      });
    }
    if (dayStatus === "today" && furthestPlayedIndex >= 0) {
      let cumulative = (bumperStartMs != null ? bumperStartMs : nowMs) + gapMsFor(furthestPlayedIndex + 1);
      let confident2 = true;
      return runtimesMin.map((_, idx) => {
        if (idx <= furthestPlayedIndex) return { ...blank, played: true };
        const offset = idx - furthestPlayedIndex;
        const withEta = offset <= MAX_ESTIMATED_AHEAD && confident2 ? { ...blank, etaMs: cumulative } : { ...blank };
        if (runtimeUnknown(idx)) confident2 = false;
        cumulative += runtimeMs(idx) + gapMsFor(idx + 1);
        return withEta;
      });
    }
    let guesses = 0;
    let confident = true;
    return runtimesMin.map((_, idx) => {
      const p = projected[idx];
      if (dayStatus === "today") {
        if (p.endMs < nowMs) return { ...blank, played: true };
        if (p.startMs <= nowMs) return { ...blank };
      }
      if (guesses < MAX_PRE_SHOW && confident) {
        guesses++;
        if (runtimeUnknown(idx)) confident = false;
        return { ...blank, etaMs: p.startMs };
      }
      return { ...blank };
    });
  }
  function pacificOffsetMinutes(d) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t).value;
    const hour = parseInt(get("hour"), 10) % 24;
    const asUTC = Date.UTC(+get("year"), +get("month") - 1, +get("day"), hour, +get("minute"), +get("second"));
    return (asUTC - d.getTime()) / 6e4;
  }
  function dayAnchorPacific(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const offsetMinutes = pacificOffsetMinutes(guess);
    return new Date(guess.getTime() - offsetMinutes * 6e4);
  }
  function pacificDateString(now = /* @__PURE__ */ new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  function scheduleExpired(sched, todayStr = pacificDateString()) {
    const lastDate = sched.days.reduce((max, d) => d.date && d.date > max ? d.date : max, "");
    return !lastDate || todayStr > lastDate;
  }

  // src/motd.js
  function getMotdPosterImages() {
    const motd = document.getElementById("motdrow");
    if (!motd) return [];
    return [...motd.querySelectorAll("img")].filter((img) => {
      const w = parseInt(img.getAttribute("width") || "0", 10);
      const h = parseInt(img.getAttribute("height") || "0", 10);
      return h >= 100 && w <= 200;
    });
  }

  // src/parse.js
  function parseMovieFilename(raw) {
    let s = raw.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|divx|xvid|ogv)$/i, "");
    let year = null;
    const yearMatch = s.match(/[\[(](\d{4})[\])]/);
    if (yearMatch) {
      year = yearMatch[1];
      s = s.slice(0, yearMatch.index);
    }
    s = s.replace(/[._]+/g, " ");
    s = s.replace(/[\[(][^\])]*/g, "").replace(/[\])]/, "");
    s = s.replace(/\s+/g, " ").trim();
    return { title: s, year };
  }
  var YT_NOISE = [
    "full movie",
    "full length movie",
    "full length feature",
    "full length film",
    "full length",
    "complete movie",
    "complete film",
    "the complete movie",
    "entire movie",
    "free movie",
    "free film",
    "free online",
    "free to watch",
    "watch online",
    "watch free",
    "watch now",
    "online free",
    "free with ads",
    "with ads",
    "no ads",
    "ad free",
    "official movie",
    "official film",
    "official",
    "exclusive",
    "premiere",
    "world premiere",
    "remastered",
    "restored",
    "colou?ri[sz]ed",
    "subtitle[sd]?",
    "subbed",
    "dubbed",
    "eng sub",
    "hd",
    "fhd",
    "uhd",
    "4k",
    "2k",
    "1080p",
    "720p",
    "480p",
    "high definition",
    "blu-?ray",
    "dvd",
    "web-?dl",
    "uncut",
    "extended",
    "director.?s cut",
    "special edition",
    "classic movie",
    "classic film",
    "cult classic",
    "b-?movie",
    "feature film",
    "feature",
    "cinema",
    "blockbuster",
    "must watch",
    "in english",
    "english movie"
  ];
  var YT_GENRES = [
    "action",
    "thriller",
    "horror",
    "comedy",
    "drama",
    "sci-?fi",
    "science fiction",
    "western",
    "romance",
    "crime",
    "mystery",
    "adventure",
    "fantasy",
    "war",
    "noir",
    "slasher",
    "martial arts",
    "kung fu",
    "documentary",
    "family",
    "musical",
    "animation"
  ];
  function parseYouTubeTitle(raw) {
    let s = " " + raw + " ";
    let year = null;
    const ym = s.match(/\b(19\d{2}|20\d{2})\b/);
    if (ym) year = ym[1];
    s = s.replace(/[\[({][^\])}]*[\])}]/g, " ");
    if (year) s = s.replace(new RegExp("\\b" + year + "\\b", "g"), " ");
    [...YT_NOISE, ...YT_GENRES].forEach((n) => {
      s = s.replace(new RegExp("\\b" + n + "\\b", "gi"), " ");
    });
    s = s.replace(/[^\w\s&':!.,-]/g, " ");
    const segs = s.split(/\s[|–—•:_-]+\s/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 2);
    let title = segs.sort(
      (a, b) => (b.match(/[a-z]/gi) || []).length - (a.match(/[a-z]/gi) || []).length
    )[0] || s;
    title = title.replace(/\s+/g, " ").replace(/^[\s'":.,-]+|[\s'":.,-]+$/g, "").trim();
    return { title, year };
  }

  // src/lineup/data.js
  var LS_LINEUP_CACHE = "sc_lineup_cache_v1";
  var LS_LINEUP_PROGRESS = "sc_lineup_progress_v1";
  var LS_GAP_SAME_SECTION = "sc_lineup_gap_same_v1";
  var LS_GAP_CROSS_SECTION = "sc_lineup_gap_cross_v1";
  var LS_LAST_SECTION = "sc_lineup_last_section_v1";
  var GAP_SAMPLE_CAP = 40;
  var MIN_PLAUSIBLE_FEATURE_SECONDS = 10 * 60;
  var MAX_PLAUSIBLE_GAP_SECONDS = 30 * 60;
  var MIN_PLAUSIBLE_GAP_SECONDS = 15;
  var CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1e3;
  var FALLBACK_LIST_TITLE = "Coming Attractions";
  var PROGRESS_CONFIRM_MS = 5 * 60 * 1e3;
  var _scheduleCache = null;
  var _fetchFailed = false;
  var _revalidating = false;
  var _lastUnmatchedStart = null;
  var _currentMatchedFlatIndex = -1;
  var _pendingProgress = null;
  function readGapSamples(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      return Array.isArray(raw) ? raw.filter((n) => typeof n === "number" && n >= 0) : [];
    } catch (e) {
      return [];
    }
  }
  function pushGapSample(key, arr, sec) {
    arr.push(sec);
    if (arr.length > GAP_SAMPLE_CAP) arr.shift();
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
    }
  }
  var _observedSameSectionGapSeconds = readGapSamples(LS_GAP_SAME_SECTION);
  var _observedCrossSectionGapSeconds = readGapSamples(LS_GAP_CROSS_SECTION);
  function readLastMatchedSection() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_LAST_SECTION));
      return p && p.date === pacificDateString() && typeof p.section === "number" ? p.section : -1;
    } catch (e) {
      return -1;
    }
  }
  function writeLastMatchedSection(section) {
    try {
      localStorage.setItem(LS_LAST_SECTION, JSON.stringify({ date: pacificDateString(), section }));
    } catch (e) {
    }
  }
  var _lastMatchedSection = readLastMatchedSection();
  function readCache() {
    try {
      const raw = localStorage.getItem(LS_LINEUP_CACHE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeCache(schedule) {
    try {
      localStorage.setItem(LS_LINEUP_CACHE, JSON.stringify({ ...schedule, fetchedAt: Date.now() }));
    } catch (e) {
    }
  }
  function allScheduleTitles(sched = _scheduleCache) {
    if (!sched) return [];
    return sched.days.flatMap((d) => d.sections.flatMap((s) => s.items));
  }
  function flatTodayWithSection(sched) {
    const today = sched && sched.days.find((day) => day.date === pacificDateString());
    if (!today) return [];
    const flat = [];
    today.sections.forEach((section, si) => section.items.forEach((item) => flat.push({ si, item })));
    return flat;
  }
  function readProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_LINEUP_PROGRESS));
      return p && p.date === pacificDateString() && p.furthestIndex >= 0 ? p.furthestIndex : -1;
    } catch (e) {
      return -1;
    }
  }
  function writeProgress(furthestIndex) {
    try {
      localStorage.setItem(LS_LINEUP_PROGRESS, JSON.stringify({ date: pacificDateString(), furthestIndex }));
    } catch (e) {
    }
  }
  function commitConfirmedProgress() {
    if (!_pendingProgress) return;
    if (Date.now() - _pendingProgress.since >= PROGRESS_CONFIRM_MS) {
      if (_pendingProgress.idx > readProgress()) writeProgress(_pendingProgress.idx);
      _pendingProgress = null;
    }
  }
  onSocket("changeMedia", (d) => {
    const rawTitle = d && d.title;
    const title = rawTitle ? parseMovieFilename(rawTitle).title : null;
    const sched = _scheduleCache || readCache();
    const declaredSeconds = d && typeof d.seconds === "number" ? d.seconds : null;
    const matchesSchedule = !!(title && sched && (declaredSeconds == null || declaredSeconds >= MIN_PLAUSIBLE_FEATURE_SECONDS) && allScheduleTitles(sched).some((s) => itemMatchesTitle(s, title)));
    const flatToday = flatTodayWithSection(sched);
    const idx = matchesSchedule ? flatToday.findIndex((f) => itemMatchesTitle(f.item, title)) : -1;
    const newSection = idx !== -1 ? flatToday[idx].si : -1;
    _currentMatchedFlatIndex = idx;
    if (rawTitle && !matchesSchedule && sched) {
      if (!_lastUnmatchedStart) _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
      const gapSec = (Date.now() - _lastUnmatchedStart) / 1e3;
      if (_lastMatchedSection !== -1 && newSection !== -1 && gapSec >= MIN_PLAUSIBLE_GAP_SECONDS && gapSec <= MAX_PLAUSIBLE_GAP_SECONDS) {
        if (newSection === _lastMatchedSection) {
          pushGapSample(LS_GAP_SAME_SECTION, _observedSameSectionGapSeconds, gapSec);
        } else {
          pushGapSample(LS_GAP_CROSS_SECTION, _observedCrossSectionGapSeconds, gapSec);
        }
      }
      _lastUnmatchedStart = null;
    }
    commitConfirmedProgress();
    _pendingProgress = null;
    if (matchesSchedule && idx !== -1) {
      _lastMatchedSection = newSection;
      writeLastMatchedSection(newSection);
      if (idx > readProgress()) _pendingProgress = { idx, since: Date.now() };
    }
  });
  async function refetchAndCache() {
    if (_revalidating) return;
    _revalidating = true;
    try {
      const result = await fetchTonightsSchedule();
      _scheduleCache = result;
      writeCache(result);
    } catch (e) {
      console.warn("[SC] lineup refetch failed, keeping existing cache:", e && e.message);
    } finally {
      _revalidating = false;
    }
  }
  async function ensureSchedule() {
    if (!_scheduleCache && !_fetchFailed) {
      const cached = readCache();
      if (cached) _scheduleCache = cached;
    }
    if (_scheduleCache) {
      if (scheduleExpired(_scheduleCache)) {
        await refetchAndCache();
        if (scheduleExpired(_scheduleCache)) {
          await refetchAndCache();
          if (scheduleExpired(_scheduleCache)) {
            console.warn("[SC] lineup schedule still expired after refetch retry -- showing stale cached schedule:", _scheduleCache.title);
          }
        }
      } else if (Date.now() - (_scheduleCache.fetchedAt || 0) > CACHE_MAX_AGE_MS) {
        refetchAndCache();
      }
      return;
    }
    if (_fetchFailed) return;
    try {
      const result = await fetchTonightsSchedule();
      _scheduleCache = result;
      writeCache(result);
    } catch (e) {
      _fetchFailed = true;
      console.warn("[SC] lineup initial fetch failed, falling back:", e && e.message);
    }
  }
  async function fallbackView() {
    const items = [];
    if (movieState.lastMovieTitle) {
      const { title, year } = parseMovieFilename(movieState.lastMovieTitle);
      const info = await lookupMovie(title, year);
      if (!hasKey(LS_TMDB) || info.cleanTitle) {
        items.push({ ...buildBase(info, title, year), isNowPlaying: true, etaLabel: "" });
      }
    }
    getMotdPosterImages().forEach((img) => {
      items.push({
        cleanTitle: img.title || img.alt || "",
        cleanYear: null,
        poster: img.src,
        backdrop: null,
        overview: "",
        isNowPlaying: false,
        etaLabel: "",
        clickable: false
      });
    });
    return {
      listTitle: FALLBACK_LIST_TITLE,
      fallback: true,
      days: [{ day: "Tonight", date: null, isToday: true, sections: [{ name: "", slug: null, items }] }]
    };
  }
  function buildBase(info, title, year) {
    var _a, _b, _c;
    return {
      cleanTitle: info.cleanTitle || title,
      cleanYear: info.cleanYear || year,
      poster: info.poster || null,
      backdrop: info.backdrop || null,
      overview: info.overview || "",
      runtime: (_a = info.runtime) != null ? _a : null,
      rating: (_b = info.rating) != null ? _b : null,
      genres: info.genres || [],
      parentalGuide: info.parentalGuide || null,
      killCount: (_c = info.killCount) != null ? _c : null,
      imdbId: info.imdbId || null
    };
  }
  function buildDaySections(day, dayStatus, infosByKey) {
    var _a, _b;
    const flat = [];
    day.sections.forEach((section, si) => {
      section.items.forEach((item) => flat.push({ section, si, item }));
    });
    const infoFor = (f) => infosByKey.get(f.item.title + "|" + f.item.year) || {};
    if (!lineupTimingEnabled()) {
      const builtFlat2 = flat.map((f) => ({
        ...buildBase(infoFor(f), f.item.title, f.item.year),
        isNowPlaying: false,
        played: false,
        etaLabel: ""
      }));
      return day.sections.map((section, si) => ({
        name: section.name,
        slug: section.slug,
        items: builtFlat2.filter((_, idx) => flat[idx].si === si)
      }));
    }
    const isToday = dayStatus === "today";
    const domTitle = isToday && movieState.lastMovieTitle ? parseMovieFilename(movieState.lastMovieTitle).title : "";
    const domFlatIndex = domTitle ? flat.findIndex((f) => itemMatchesTitle(f.item, domTitle)) : -1;
    const currentFlatIndex = isToday && _currentMatchedFlatIndex !== -1 ? _currentMatchedFlatIndex : domFlatIndex;
    if (isToday) commitConfirmedProgress();
    const nowMs = Date.now();
    const sameSectionGapSeconds = (_a = medianGapSeconds(_observedSameSectionGapSeconds)) != null ? _a : 600;
    const crossSectionGapSeconds = (_b = medianGapSeconds(_observedCrossSectionGapSeconds)) != null ? _b : sameSectionGapSeconds;
    const estimates = estimateDayItems({
      nowMs,
      anchorMs: dayAnchorPacific(day.date).getTime(),
      runtimesMin: flat.map((f) => {
        var _a2;
        return (_a2 = infoFor(f).runtime) != null ? _a2 : null;
      }),
      sectionOf: flat.map((f) => f.si),
      sameSectionGapSeconds,
      crossSectionGapSeconds,
      dayStatus,
      currentIndex: currentFlatIndex,
      // null (not 0) when the duration isn't known yet -- see estimateDayItems for why that
      // distinction matters.
      remainingSec: currentFlatIndex !== -1 && getCurrentMediaSeconds() > 0 ? Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds()) : currentFlatIndex !== -1 ? null : 0,
      furthestPlayedIndex: isToday ? readProgress() : -1,
      bumperStartMs: _lastUnmatchedStart
    });
    const builtFlat = flat.map((f, idx) => {
      const est = estimates[idx];
      const eta = est.etaMs != null ? new Date(roundEtaMs(est.etaMs, est.precision, nowMs)) : null;
      return {
        ...buildBase(infoFor(f), f.item.title, f.item.year),
        isNowPlaying: est.isNowPlaying,
        played: est.played,
        etaLabel: eta ? formatEta(eta.getHours(), eta.getMinutes(), est.precision) : ""
      };
    });
    return day.sections.map((section, si) => ({
      name: section.name,
      slug: section.slug,
      items: builtFlat.filter((_, idx) => flat[idx].si === si)
    }));
  }
  async function lookupItem(item) {
    var _a;
    const primary = await lookupMovie(item.title, item.year);
    if (primary.cleanTitle || !((_a = item.akas) == null ? void 0 : _a.length)) return primary;
    for (const aka of item.akas) {
      const info = await lookupMovie(aka, item.year);
      if (info.cleanTitle) return info;
    }
    return primary;
  }
  async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return fallbackView();
    const allItems = allScheduleTitles();
    const infos = await Promise.all(allItems.map(lookupItem));
    const infosByKey = new Map(allItems.map((item, i) => [item.title + "|" + item.year, infos[i]]));
    const todayStr = pacificDateString();
    const days = _scheduleCache.days.map((day) => ({
      day: day.day,
      date: day.date,
      isToday: day.date === todayStr,
      sections: buildDaySections(
        day,
        day.date < todayStr ? "past" : day.date === todayStr ? "today" : "future",
        infosByKey
      )
    }));
    return { listTitle: _scheduleCache.title || FALLBACK_LIST_TITLE, fallback: false, days };
  }

  // src/tvdetect.js
  var isTv = function() {
    try {
      if (window.CytubeNative && typeof CytubeNative.isTv === "function") return !!CytubeNative.isTv();
    } catch (e) {
    }
    return window.screen.width >= 1280 && !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  }();

  // src/cards/trivia.js
  function _escHtml2(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function showTriviaCard() {
    const tconst = npState.data && npState.data.imdbId;
    if (!tconst) return;
    let card = document.getElementById("sc-trivia-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "sc-trivia-card";
      card.innerHTML = `
            <div id="sc-trivia-panel">
                <div id="sc-trivia-head">
                    <span id="sc-trivia-title">Trivia</span>
                    <button id="sc-trivia-close" type="button">✕</button>
                </div>
                <div id="sc-trivia-list"></div>
            </div>`;
      document.body.appendChild(card);
      card.addEventListener("click", (e) => {
        if (e.target === card) hideTriviaCard();
      });
      card.querySelector("#sc-trivia-close").addEventListener("click", hideTriviaCard);
    }
    card.querySelector("#sc-trivia-title").textContent = "Trivia" + (npState.data.cleanTitle ? " — " + npState.data.cleanTitle : "");
    const list = card.querySelector("#sc-trivia-list");
    list.innerHTML = '<div class="sc-trivia-item">Loading…</div>';
    card.classList.add("sc-show");
    fetchImdbTrivia(tconst).then((items) => {
      if (!document.getElementById("sc-trivia-card")) return;
      if (!items || !items.length) {
        list.innerHTML = '<div class="sc-trivia-item">No trivia found.</div>';
        return;
      }
      list.innerHTML = items.map((t) => `<div class="sc-trivia-item">${_escHtml2(t)}</div>`).join("");
      list.scrollTop = 0;
    });
  }
  function hideTriviaCard() {
    const card = document.getElementById("sc-trivia-card");
    if (card) card.classList.remove("sc-show");
  }
  function toggleTriviaCard() {
    const card = document.getElementById("sc-trivia-card");
    if (card && card.classList.contains("sc-show")) hideTriviaCard();
    else showTriviaCard();
  }

  // src/metadata/lastaired.js
  init_native();
  var LAST_AIRED_CSV_URL = "https://docs.google.com/spreadsheets/d/1B1iL2tX7BC-RnABPnR2G8k0KsrTFyY_WBsF9PFW37Do/export?format=csv&gid=0";
  var LS_LAST_AIRED_CACHE = "sc_last_aired_cache_v1";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
  var lastAiredMap = null;
  function normalizeKey(title, year) {
    const t = String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
    const y = year ? String(year).trim() : "";
    return y ? `${t} (${y})` : t;
  }
  function parseCsvLine(line) {
    const fields = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        fields.push(field);
        field = "";
      } else {
        field += c;
      }
    }
    fields.push(field);
    return fields;
  }
  function parseSheetDate(str) {
    const m = String(str || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = 2e3 + parseInt(m[3], 10);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  }
  function formatLastAiredDate(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function buildLastAiredMap(csvText) {
    const map = /* @__PURE__ */ new Map();
    const aliasEntries = [];
    const lines = String(csvText || "").split(/\r\n|\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const cols = parseCsvLine(line);
      const rawTitleYear = (cols[0] || "").trim();
      if (!rawTitleYear) continue;
      const date = parseSheetDate(cols[1]);
      if (!date) continue;
      const block = (cols[2] || "").trim() || null;
      const m = rawTitleYear.match(/^(.*)\s\((\d{4})\)\s*$/);
      const title = m ? m[1].trim() : rawTitleYear;
      const year = m ? m[2] : "";
      const key = normalizeKey(title, year);
      const existing = map.get(key);
      if (!existing || date.getTime() > existing._ts) {
        map.set(key, { dateStr: formatLastAiredDate(date), block, _ts: date.getTime() });
      }
      if (/ aka /i.test(title)) {
        const parts = title.split(/ aka /i);
        if (parts.length === 2) {
          const dateStr = formatLastAiredDate(date);
          for (const part of parts) {
            const aliasTitle = part.trim();
            if (!aliasTitle) continue;
            aliasEntries.push({ key: normalizeKey(aliasTitle, year), dateStr, block });
          }
        }
      }
    }
    for (const [key, val] of map) map.set(key, { dateStr: val.dateStr, block: val.block });
    for (const alias of aliasEntries) {
      if (!map.has(alias.key)) {
        map.set(alias.key, { dateStr: alias.dateStr, block: alias.block });
      }
    }
    return map;
  }
  async function loadLastAiredSheet() {
    let isFresh = false;
    try {
      const cached = localStorage.getItem(LS_LAST_AIRED_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.map) {
          lastAiredMap = new Map(Object.entries(parsed.map));
          isFresh = !!parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS;
        }
      }
    } catch (e) {
    }
    if (isFresh) return;
    try {
      const res = await nativeHttpGet(LAST_AIRED_CSV_URL);
      if (!res || res.status !== 200) throw new Error("HTTP " + (res && res.status));
      const freshMap = buildLastAiredMap(res.body);
      if (freshMap.size === 0) {
        throw new Error("Last Aired sheet returned no parseable rows");
      }
      lastAiredMap = freshMap;
      try {
        localStorage.setItem(LS_LAST_AIRED_CACHE, JSON.stringify({
          ts: Date.now(),
          map: Object.fromEntries(lastAiredMap)
        }));
      } catch (e) {
      }
    } catch (e) {
      console.warn("[Grindhouse] Last Aired sheet failed to load:", e);
    }
  }
  function getLastAired(title, year) {
    if (!lastAiredMap) return null;
    return lastAiredMap.get(normalizeKey(title, year)) || null;
  }

  // src/cards/nowplaying.js
  var NP_PG_SHORT = {
    "Sex & Nudity": "Sex/Nudity",
    "Violence & Gore": "Violence",
    "Profanity": "Profanity",
    "Alcohol, Drugs & Smoking": "Drugs",
    "Frightening & Intense Scenes": "Frightening"
  };
  var npState = {
    data: null,
    // latest movie data for the card
    introDone: false
    // startup intro card has run (see initIntroSequence)
  };
  var _npHideTimer = null;
  var _npProgTimer = null;
  var _npWatcherInit = false;
  function _renderNpProgress() {
    const card = document.getElementById("sc-np-card");
    if (!card) {
      clearInterval(_npProgTimer);
      return;
    }
    const wrap = card.querySelector("#sc-np-progress");
    const fill = card.querySelector("#sc-np-prog-fill");
    const elapsedEl = card.querySelector("#sc-np-prog-elapsed");
    const totalEl = card.querySelector("#sc-np-prog-total");
    const remainEl = card.querySelector("#sc-np-prog-remain");
    if (!wrap || !fill) return;
    const dur = getCurrentMediaSeconds();
    if (dur > 0) {
      const elapsed = Math.min(getCurrentPlaybackSeconds(), dur);
      const pct = Math.max(0, Math.min(100, elapsed / dur * 100));
      fill.style.setProperty("width", pct + "%", "important");
      elapsedEl.textContent = formatHMS(elapsed);
      totalEl.textContent = formatHMS(dur);
      remainEl.textContent = "−" + formatHMS(dur - elapsed) + " left";
      wrap.style.display = "";
    } else {
      wrap.style.display = "none";
    }
  }
  function _npCardEnabled() {
    return true;
  }
  function _npTitleFontSize(text) {
    const base = isTv ? 60 : document.body.classList.contains("sc-vertical") ? 30 : 44;
    let scale = 1;
    if (text.length > 60) scale = 0.5;
    else if (text.length > 40) scale = 0.65;
    else if (text.length > 25) scale = 0.8;
    return Math.round(base * scale);
  }
  var _npScrollTimer = null;
  var _npScrollRaf = null;
  var _NP_SCROLL_DELAY = 3500;
  function _autoScrollOverview() {
    clearTimeout(_npScrollTimer);
    cancelAnimationFrame(_npScrollRaf);
    const card = document.getElementById("sc-np-card");
    const ov = card && card.querySelector("#sc-np-overview");
    if (!ov) return 0;
    ov.scrollTop = 0;
    const dist = ov.scrollHeight - ov.clientHeight;
    if (dist <= 4) return 0;
    const dur = Math.min(12e3, Math.max(2500, dist / 24 * 1e3));
    _npScrollTimer = setTimeout(() => {
      const start = ov.scrollTop;
      const span = ov.scrollHeight - ov.clientHeight - start;
      if (span <= 0) return;
      const t0 = performance.now();
      const step = (now) => {
        const c = document.getElementById("sc-np-card");
        if (!c || !c.classList.contains("sc-np-visible")) return;
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        ov.scrollTop = start + span * e;
        if (p < 1) _npScrollRaf = requestAnimationFrame(step);
      };
      _npScrollRaf = requestAnimationFrame(step);
    }, _NP_SCROLL_DELAY);
    return _NP_SCROLL_DELAY + dur;
  }
  function showNowPlayingCard(data, opts = {}) {
    if (!data || !data.cleanTitle && !data.backdrop) return;
    let card = document.getElementById("sc-np-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "sc-np-card";
      card.innerHTML = `
            <div id="sc-np-backdrop"></div>
            <div id="sc-np-scrim"></div>
            <div id="sc-np-content">
                <img id="sc-np-poster" alt="" />
                <div id="sc-np-info">
                    <div id="sc-np-eyebrow">Now Playing</div>
                    <div id="sc-np-title"></div>
                    <div id="sc-np-meta"></div>
                    <div id="sc-np-overview"></div>
                    <div id="sc-np-chips"></div>
                    <div id="sc-np-progress">
                        <div id="sc-np-prog-bar"><div id="sc-np-prog-fill"></div></div>
                        <div id="sc-np-prog-times">
                            <span id="sc-np-prog-elapsed">0:00</span>
                            <span id="sc-np-prog-remain"></span>
                            <span id="sc-np-prog-total">0:00</span>
                        </div>
                    </div>
                    <div id="sc-np-actions">
                        <div id="sc-np-links"></div>
                        <button id="sc-np-trivia-btn" type="button">Trivia</button>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(card);
      card.addEventListener("click", hideNowPlayingCard);
      card.querySelector("#sc-np-trivia-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        showTriviaCard();
      });
    }
    const title = data.cleanTitle || movieState.lastMovieTitle || "";
    const year = data.cleanYear ? ` (${data.cleanYear})` : "";
    const bd = card.querySelector("#sc-np-backdrop");
    const poster = card.querySelector("#sc-np-poster");
    const meta = card.querySelector("#sc-np-meta");
    const chips = card.querySelector("#sc-np-chips");
    bd.style.backgroundImage = data.backdrop ? `url(${data.backdrop})` : "none";
    if (data.poster) {
      poster.src = data.poster;
      poster.style.display = "";
    } else poster.style.display = "none";
    const eyebrow = card.querySelector("#sc-np-eyebrow");
    eyebrow.style.display = opts.showProgress !== false ? "" : "none";
    const triviaBtn = card.querySelector("#sc-np-trivia-btn");
    const showTrivia = opts.showProgress !== false && !!(npState.data && npState.data.imdbId);
    triviaBtn.style.display = showTrivia ? "" : "none";
    const linksRow = card.querySelector("#sc-np-links");
    linksRow.innerHTML = "";
    if (!isTv && data.links) {
      LINK_DEFS.forEach(({ key, label, color, fg, char }) => {
        const url = data.links[key];
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = `${label}: "${title}"`;
        a.className = "sc-np-link";
        a.style.background = color;
        a.style.color = fg;
        a.textContent = char;
        a.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.CytubeNative && typeof CytubeNative.openInApp === "function") {
            e.preventDefault();
            CytubeNative.openInApp(url);
          }
        });
        linksRow.appendChild(a);
      });
    }
    const titleEl = card.querySelector("#sc-np-title");
    const titleText = title + year;
    titleEl.textContent = titleText;
    titleEl.style.setProperty("font-size", _npTitleFontSize(titleText) + "px", "important");
    card.querySelector("#sc-np-overview").textContent = data.overview || "";
    const metaParts = [];
    if (data.rating) metaParts.push(`⭐ ${data.rating}`);
    if (data.runtime) metaParts.push(`${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`);
    if (data.genres && data.genres.length) metaParts.push(data.genres.slice(0, 3).join(" · "));
    const lastAired = getLastAired(title, data.cleanYear);
    if (lastAired) metaParts.push(`📅 Last aired ${lastAired.dateStr}`);
    meta.textContent = metaParts.join("     ");
    const chipHtml = [];
    (data.parentalGuide || []).forEach((pg) => {
      const sev = String(pg.severity || "").toLowerCase();
      const label = NP_PG_SHORT[pg.category] || pg.category;
      chipHtml.push(`<span class="sc-np-chip sc-sev-${sev}">${label}: ${pg.severity}</span>`);
    });
    if (data.killCount !== null && data.killCount !== void 0) {
      chipHtml.push(`<span class="sc-np-chip">💀 ${data.killCount} kills</span>`);
    }
    chips.innerHTML = chipHtml.join("");
    card.classList.add("sc-np-visible");
    const progWrap = card.querySelector("#sc-np-progress");
    if (opts.showProgress !== false) {
      _renderNpProgress();
      clearInterval(_npProgTimer);
      _npProgTimer = setInterval(_renderNpProgress, 500);
    } else {
      clearInterval(_npProgTimer);
      if (progWrap) progWrap.style.display = "none";
    }
    _autoScrollOverview();
    clearTimeout(_npHideTimer);
    if (opts.autoHide) {
      _npHideTimer = setTimeout(hideNowPlayingCard, opts.autoHideMs || 2e4);
    }
  }
  function hideNowPlayingCard() {
    const card = document.getElementById("sc-np-card");
    if (card) card.classList.remove("sc-np-visible");
    clearTimeout(_npHideTimer);
    clearInterval(_npProgTimer);
    clearTimeout(_npScrollTimer);
    cancelAnimationFrame(_npScrollRaf);
  }
  function initNowPlayingWatcher() {
    if (_npWatcherInit) return;
    _npWatcherInit = true;
    const toggle = () => {
      const card = document.getElementById("sc-np-card");
      if (card && card.classList.contains("sc-np-visible")) hideNowPlayingCard();
      else if (npState.data) showNowPlayingCard(npState.data, { autoHide: false });
    };
    document.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "i" || e.key === "I") toggle();
      else if (e.key === "t" || e.key === "T") toggleTriviaCard();
    });
  }

  // src/lineup/sectionThemes.js
  var THEMES = {
    "funky-cheese-friday": { font: "Boogaloo", color: "#e0a92a", wash: "#2b210a" },
    "friday-grindhouse-a-go-go": { font: "Chewy", color: "#ec4899", wash: "#2a0e1c" },
    "friday-night-freak-show": { font: "Creepster", color: "#52c41a", wash: "#0f2109" },
    "psychedelic-saturday": { font: "'Rubik Wet Paint'", color: "#a855f7", wash: "#200c2b" },
    "saturday-prime-time-drive-in": { font: "Monoton", color: "#22d3ee", wash: "#06232a" },
    "red-light-saturday-night": { font: "'Vast Shadow'", color: "#ef4444", wash: "#2b0a0a" },
    "the-sunday-classics": { font: "Cinzel", color: "#b8b8b8", wash: "#1c1c1c" },
    "sunday-slop-o-rama": { font: "Eater", color: "#a3b125", wash: "#1c1f08" },
    "last-call-sunday-night": { font: "'Bungee Shade'", color: "#6366f1", wash: "#12102b" }
  };
  var DEFAULT_THEME = { font: null, color: "#9aa0a8", wash: "#14141a" };
  function getSectionTheme(slug) {
    return THEMES[slug] || DEFAULT_THEME;
  }
  var FONT_FAMILIES = ["Boogaloo", "Chewy", "Creepster", "Rubik+Wet+Paint", "Monoton", "Vast+Shadow", "Cinzel", "Eater", "Bungee+Shade", "Bebas+Neue", "Alfa+Slab+One"];
  var FONTS_LINK_ID = "sc-lineup-theme-fonts";
  function ensureThemeFontsLoaded() {
    if (document.getElementById(FONTS_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONTS_LINK_ID;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${FONT_FAMILIES.map((f) => `family=${f}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }

  // src/player/scrubber.js
  function neutralizeVjsInactivityTimer() {
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p && typeof p.options === "function") p.options({ inactivityTimeout: 0 });
    } catch (e) {
    }
  }
  function wakeVideoControls() {
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p && typeof p.userActive === "function") {
        p.userActive(true);
        if (typeof p.reportUserActivity === "function") p.reportUserActivity();
        return;
      }
    } catch (e) {
    }
    const el = document.querySelector("#videowrap .video-js");
    if (el) {
      el.classList.add("vjs-user-active");
      el.classList.remove("vjs-user-inactive");
    }
  }
  var _scrubHoldTimer = null;
  function holdScrubber(on) {
    if (on) {
      wakeVideoControls();
      if (!_scrubHoldTimer) _scrubHoldTimer = setInterval(wakeVideoControls, 1e3);
      return;
    }
    if (!_scrubHoldTimer) return;
    clearInterval(_scrubHoldTimer);
    _scrubHoldTimer = null;
  }

  // src/cards/upnext.js
  var UPNEXT_BOT_URL = "https://bot.420grindhouseserver.com";
  var UPNEXT_LOAD_TIMEOUT_MS = 1e4;
  var _frameCreated = false;
  function ensureFrame(body) {
    if (_frameCreated) return;
    _frameCreated = true;
    const iframe = document.createElement("iframe");
    iframe.id = "sc-upnext-frame";
    iframe.title = "Upcoming queue";
    iframe.style.display = "none";
    let settled = false;
    const showFrame = () => {
      var _a;
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      (_a = body.querySelector(".sc-upnext-loading")) == null ? void 0 : _a.remove();
      iframe.style.display = "block";
    };
    const showError = () => {
      if (settled) return;
      settled = true;
      body.innerHTML = '<div class="sc-upnext-error">Schedule unavailable right now.</div>';
    };
    iframe.addEventListener("load", showFrame);
    iframe.addEventListener("error", showError);
    const timeoutId = setTimeout(showError, UPNEXT_LOAD_TIMEOUT_MS);
    iframe.src = UPNEXT_BOT_URL;
    body.appendChild(iframe);
  }
  function showUpNextCard() {
    let card = document.getElementById("sc-upnext-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "sc-upnext-card";
      card.innerHTML = `
            <div id="sc-upnext-head">
                <span>Up Next</span>
                <button id="sc-upnext-close" type="button">✕</button>
            </div>
            <div id="sc-upnext-body"><div class="sc-upnext-loading">Loading…</div></div>`;
      document.body.appendChild(card);
      card.querySelector("#sc-upnext-close").addEventListener("click", hideUpNextCard);
    }
    card.classList.add("sc-upnext-visible");
    ensureFrame(card.querySelector("#sc-upnext-body"));
  }
  function hideUpNextCard() {
    var _a;
    (_a = document.getElementById("sc-upnext-card")) == null ? void 0 : _a.classList.remove("sc-upnext-visible");
  }

  // src/cards/linkpip.js
  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
      if (host === "youtube.com" || host === "m.youtube.com") {
        if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
        if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
        if (u.pathname === "/watch" && u.searchParams.has("v")) return u.searchParams.get("v");
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  function isPipLink(url) {
    return !!extractYouTubeId(url);
  }
  function mutePlayer() {
    try {
      const vid = document.querySelector("#videowrap video");
      if (vid) {
        const state = { kind: "video", muted: vid.muted };
        vid.muted = true;
        return state;
      }
    } catch (e) {
    }
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p) {
        const wasMuted = typeof p.isMuted === "function" ? !!p.isMuted() : typeof p.muted === "function" ? !!p.muted() : false;
        if (typeof p.mute === "function") p.mute();
        else if (typeof p.muted === "function") p.muted(true);
        return { kind: "wrapper", muted: wasMuted };
      }
    } catch (e) {
    }
    return null;
  }
  function restorePlayer(state) {
    if (!state || state.muted) return;
    if (state.kind === "video") {
      try {
        const vid = document.querySelector("#videowrap video");
        if (vid) vid.muted = false;
      } catch (e) {
      }
      return;
    }
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p) {
        if (typeof p.unMute === "function") p.unMute();
        else if (typeof p.muted === "function") p.muted(false);
      }
    } catch (e) {
    }
  }
  var _pipMuteState = null;
  var _outsideClickHandler = null;
  function openLinkPip(url) {
    const id = extractYouTubeId(url);
    if (!id) return;
    closeLinkPip();
    let panel = document.getElementById("sc-link-pip-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "sc-link-pip-panel";
      panel.innerHTML = `
            <div id="sc-link-pip-head">
                <span>Preview</span>
                <button id="sc-link-pip-close" type="button">✕</button>
            </div>
            <div id="sc-link-pip-body"></div>`;
      document.body.appendChild(panel);
      panel.querySelector("#sc-link-pip-close").addEventListener("click", closeLinkPip);
    }
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`;
    iframe.allow = "autoplay; encrypted-media";
    iframe.className = "sc-link-pip-frame";
    iframe.setAttribute("frameborder", "0");
    const body = panel.querySelector("#sc-link-pip-body");
    body.innerHTML = "";
    body.appendChild(iframe);
    panel.classList.add("sc-link-pip-visible");
    _outsideClickHandler = (e) => {
      if (!panel.contains(e.target)) closeLinkPip();
    };
    setTimeout(() => document.addEventListener("click", _outsideClickHandler, true), 0);
    _pipMuteState = mutePlayer();
  }
  function closeLinkPip() {
    const panel = document.getElementById("sc-link-pip-panel");
    if (panel) {
      panel.classList.remove("sc-link-pip-visible");
      const body = panel.querySelector("#sc-link-pip-body");
      if (body) body.innerHTML = "";
    }
    if (_outsideClickHandler) {
      document.removeEventListener("click", _outsideClickHandler, true);
      _outsideClickHandler = null;
    }
    if (_pipMuteState) {
      restorePlayer(_pipMuteState);
      _pipMuteState = null;
    }
  }

  // src/tvnav/geometry.js
  function pickDirectional(dir, curRect, rects) {
    const cx = curRect.left + curRect.width / 2, cy = curRect.top + curRect.height / 2;
    let best = -1, bestScore = Infinity, cone = -1, coneScore = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      let primary, perp;
      if (dir === "left") {
        if (dx > -4) continue;
        primary = -dx;
        perp = Math.abs(dy);
      } else if (dir === "right") {
        if (dx < 4) continue;
        primary = dx;
        perp = Math.abs(dy);
      } else if (dir === "up") {
        if (dy > -4) continue;
        primary = -dy;
        perp = Math.abs(dx);
      } else {
        if (dy < 4) continue;
        primary = dy;
        perp = Math.abs(dx);
      }
      const score = primary + perp * 2;
      if (primary >= perp && score < coneScore) {
        coneScore = score;
        cone = i;
      }
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return cone !== -1 ? cone : best;
  }

  // src/tvnav.js
  var tvNavState = { setFocus: null, preBackHooks: [] };
  function initLoginTvNav() {
    let isTv2 = false;
    try {
      if (window.CytubeNative && CytubeNative.isTv) isTv2 = !!CytubeNative.isTv();
    } catch (e) {
    }
    if (!isTv2) isTv2 = window.screen.width >= 1280 && !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
    if (!isTv2) return;
    const style = document.createElement("style");
    style.textContent = ".sc-tv-focus{outline:3px solid #e0701a !important;outline-offset:2px !important;box-shadow:0 0 0 5px rgba(224,112,26,0.32) !important;border-radius:5px !important;}";
    (document.head || document.documentElement).appendChild(style);
    let focusEl = null;
    const isVisible = (el) => {
      if (!el || !el.getBoundingClientRect) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    const FOCUS_SEL = "input:not([type=hidden]), button, a[href], select, textarea, [tabindex]";
    const candidates = () => [...document.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter((e) => !e.disabled);
    function setFocus(el) {
      if (!el) return;
      if (focusEl && focusEl !== el) focusEl.classList.remove("sc-tv-focus");
      focusEl = el;
      el.classList.add("sc-tv-focus");
      try {
        el.focus({ preventScroll: true });
      } catch (e) {
      }
      try {
        el.scrollIntoView({ block: "nearest" });
      } catch (e) {
      }
    }
    function move(dir) {
      const list = candidates();
      if (!list.length) return;
      if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) {
        setFocus(list[0]);
        return;
      }
      const cur = focusEl.getBoundingClientRect();
      const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
      let best = null, bestScore = Infinity;
      for (const el of list) {
        if (el === focusEl) continue;
        const r = el.getBoundingClientRect();
        const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
        let primary, perp;
        if (dir === "left") {
          if (dx > -4) continue;
          primary = -dx;
          perp = Math.abs(dy);
        } else if (dir === "right") {
          if (dx < 4) continue;
          primary = dx;
          perp = Math.abs(dy);
        } else if (dir === "up") {
          if (dy > -4) continue;
          primary = -dy;
          perp = Math.abs(dx);
        } else {
          if (dy < 4) continue;
          primary = dy;
          perp = Math.abs(dx);
        }
        const score = primary + perp * 2;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) setFocus(best);
    }
    function activate() {
      if (!focusEl) {
        move("down");
        return;
      }
      const tag = focusEl.tagName, type = (focusEl.type || "").toLowerCase();
      if (tag === "INPUT" && !/^(checkbox|radio|submit|button|reset)$/.test(type) || tag === "TEXTAREA") {
        try {
          focusEl.focus();
        } catch (e) {
        }
      } else {
        focusEl.click();
      }
    }
    window.__scTvKey = function(dir) {
      try {
        if (dir === "back") {
          if (history.length > 1) history.back();
          else {
            try {
              if (window.CytubeNative && CytubeNative.tvBack) CytubeNative.tvBack();
            } catch (e) {
            }
          }
          return;
        }
        if (dir === "center") activate();
        else move(dir);
      } catch (e) {
      }
    };
    const seed = () => {
      const l = candidates();
      if (l.length) setFocus(l.find((e) => e.tagName === "INPUT" && /^(text|password|email)$/i.test(e.type)) || l[0]);
    };
    if (document.readyState === "complete" || document.readyState === "interactive") seed();
    else window.addEventListener("DOMContentLoaded", seed);
  }
  function initTvNav() {
    if (!isTv) return;
    let focusEl = null;
    let overlayFocusStack = [];
    const isVisible = (el) => {
      if (!el || !el.getBoundingClientRect) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return false;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    const OVERLAY_IDS = ["sc-settings-overlay", "sc-modal-overlay", "sc-trivia-card", "sc-users-panel", "sc-poll-panel", "sc-np-card", "sc-upnext-card", "sc-link-pip-panel", "sc-emotes-panel", "sc-lineup-screen"];
    const isOverlayOpen = (id, o) => !!(o && isVisible(o) && (id !== "sc-np-card" || o.classList.contains("sc-np-visible")) && (id !== "sc-upnext-card" || o.classList.contains("sc-upnext-visible")) && (id !== "sc-trivia-card" || o.classList.contains("sc-show")) && (id !== "sc-link-pip-panel" || o.classList.contains("sc-link-pip-visible")) && (id !== "sc-lineup-screen" || o.classList.contains("sc-lineup-visible")));
    const openOverlay = () => {
      for (const id of OVERLAY_IDS) {
        const o = document.getElementById(id);
        if (isOverlayOpen(id, o)) return o;
      }
      return null;
    };
    const countOpenOverlays = () => {
      let n = 0;
      for (const id of OVERLAY_IDS) {
        if (isOverlayOpen(id, document.getElementById(id))) n++;
      }
      return n;
    };
    const isDesynced = () => {
      const b = document.getElementById("sc-desync-btn");
      return !!(b && b.classList.contains("sc-desync-active"));
    };
    const openVjsMenu = () => {
      const m = document.querySelector("#videowrap .vjs-menu.vjs-lock-showing");
      return m && [...m.querySelectorAll(".vjs-menu-item")].some(isVisible) ? m : null;
    };
    function controlBarTargets() {
      try {
        const bar = document.querySelector("#videowrap .vjs-control-bar");
        if (!bar || !isVisible(bar)) return [];
        const allowSeek = isDesynced();
        return [...bar.querySelectorAll("button.vjs-control, button.vjs-menu-button, .vjs-progress-control")].filter((c) => {
          if (!isVisible(c)) return false;
          if (c.classList.contains("vjs-progress-control") && !allowSeek) return false;
          if (c.disabled || c.classList.contains("vjs-disabled")) return false;
          return true;
        });
      } catch (e) {
        return [];
      }
    }
    const MAIN_IDS = [
      "sc-drm-open",
      "sc-title-text",
      "sc-chatmode-btn",
      "sc-emote-proxy",
      "sc-desync-btn",
      "sc-settings-btn",
      "sc-usercount-connected",
      "sc-usercount-online",
      "sc-poll-btn",
      "sc-poster-toggle",
      "sc-up-next-btn",
      "sc-newmsg-pill",
      "messagebuffer",
      "sc-chat-textarea"
    ];
    const CHAT_HEADER_IDS = ["sc-usercount-connected", "sc-usercount-online", "sc-poll-btn"];
    const FOCUS_SEL = "button, a[href], input:not([type=hidden]), textarea, select, [tabindex]";
    const makeFocusable = (el) => {
      if (!el.hasAttribute("tabindex") && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.tabIndex = -1;
    };
    function candidates() {
      const menu = openVjsMenu();
      if (menu) {
        const list = [...menu.querySelectorAll(".vjs-menu-item")].filter(isVisible);
        if (list.length) return { scope: menu, list };
      }
      const ov = openOverlay();
      if (ov) {
        let list = [...ov.querySelectorAll(FOCUS_SEL)].filter(isVisible).filter((e) => !e.disabled);
        if (!list.length) list = [ov];
        return { scope: ov, list };
      }
      const main = MAIN_IDS.map((id) => document.getElementById(id)).filter((el) => el && isVisible(el) && // The new-message pill is opacity-hidden (still sized) until shown — only
      // make it a focus target while it's actually visible.
      (el.id !== "sc-newmsg-pill" || el.classList.contains("sc-show")));
      return { scope: document, list: main.concat(controlBarTargets()) };
    }
    function clearFocus() {
      document.querySelectorAll(".sc-tv-focus").forEach((e) => e.classList.remove("sc-tv-focus"));
      try {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      } catch (e) {
      }
      holdScrubber(false);
      focusEl = null;
    }
    function restoreFocusAfterOverlayClose() {
      const restore = overlayFocusStack.pop() || null;
      clearFocus();
      if (restore && isVisible(restore)) setFocus(restore);
    }
    function setFocus(el) {
      if (!el) return;
      makeFocusable(el);
      if (el.hasAttribute && el.hasAttribute("title")) el.removeAttribute("title");
      if (focusEl && focusEl.id === "sc-chat-textarea" && el.id !== "sc-chat-textarea") wakeVideoControls();
      holdScrubber(!!(el.closest && el.closest("#videowrap-header, .video-js")));
      document.querySelectorAll(".sc-tv-focus").forEach((e) => {
        if (e !== el) e.classList.remove("sc-tv-focus");
      });
      focusEl = el;
      el.classList.add("sc-tv-focus");
      try {
        el.focus({ preventScroll: true });
      } catch (e) {
      }
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (e) {
      }
    }
    tvNavState.setFocus = setFocus;
    const SEEK_RAMP = [10, 10, 10, 10, 30, 30, 30, 60, 60, 120];
    function seekStepSeconds(repeatCount) {
      const i = Math.max(0, Math.min(SEEK_RAMP.length - 1, repeatCount | 0));
      return SEEK_RAMP[i];
    }
    function clampForwardToLive(current, next, delta) {
      if (delta <= 0) return next;
      const live = getDesyncLiveSeconds();
      return live != null ? Math.max(current, Math.min(next, live)) : next;
    }
    function seekBy(dirSign, repeatCount) {
      const delta = dirSign * seekStepSeconds(repeatCount);
      try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.currentTime === "function") {
          const current = p.currentTime() || 0;
          const next = Math.max(0, current + delta);
          p.currentTime(clampForwardToLive(current, next, delta));
          wakeVideoControls();
          return;
        }
      } catch (e) {
      }
      const v = document.querySelector("#videowrap video");
      if (v) {
        try {
          const current = v.currentTime;
          v.currentTime = clampForwardToLive(current, Math.max(0, current + delta), delta);
          wakeVideoControls();
        } catch (e) {
        }
      }
    }
    function jumpToLive() {
      const live = getDesyncLiveSeconds();
      if (live == null) return;
      try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.currentTime === "function") {
          p.currentTime(Math.max(0, live));
          wakeVideoControls();
          return;
        }
      } catch (e) {
      }
      const v = document.querySelector("#videowrap video");
      if (v) {
        try {
          v.currentTime = Math.max(0, live);
          wakeVideoControls();
        } catch (e) {
        }
      }
    }
    function move(dir, repeatCount) {
      if (focusEl && focusEl.classList && focusEl.classList.contains("vjs-progress-control") && (dir === "left" || dir === "right")) {
        if (isDesynced()) seekBy(dir === "right" ? 1 : -1, repeatCount || 0);
        return;
      }
      if (focusEl && focusEl.classList && focusEl.classList.contains("vjs-progress-control") && dir === "down") {
        const next = document.getElementById("sc-settings-btn");
        if (next && isVisible(next)) {
          setFocus(next);
          return;
        }
      }
      if (focusEl && (dir === "left" || dir === "right") && !openVjsMenu()) {
        const barEls = controlBarTargets();
        if (barEls.includes(focusEl)) {
          const sorted = barEls.slice().sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
          const i = sorted.indexOf(focusEl);
          const ni = dir === "right" ? i + 1 : i - 1;
          if (ni >= 0 && ni < sorted.length) {
            setFocus(sorted[ni]);
            return;
          }
        }
      }
      if (focusEl && focusEl.type === "range" && (dir === "left" || dir === "right")) {
        const step = parseFloat(focusEl.step) || 1;
        const min = focusEl.min !== "" ? parseFloat(focusEl.min) : -Infinity;
        const max = focusEl.max !== "" ? parseFloat(focusEl.max) : Infinity;
        let v = (parseFloat(focusEl.value) || 0) + (dir === "right" ? step : -step);
        focusEl.value = Math.max(min, Math.min(max, v));
        focusEl.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      const lineupScreen = document.getElementById("sc-lineup-screen");
      if (lineupScreen && lineupScreen.classList.contains("sc-lineup-visible")) {
        const rail = focusEl && focusEl.closest(".sc-lineup-rail");
        if (rail && (dir === "left" || dir === "right")) {
          const items = [...rail.querySelectorAll(".sc-lineup-item")];
          const i = items.indexOf(focusEl);
          const ni = dir === "right" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
          setFocus(items[ni]);
          return;
        }
        if (rail && (dir === "up" || dir === "down")) {
          const items = [...rail.querySelectorAll(".sc-lineup-item")];
          const myIndex = items.indexOf(focusEl);
          const target = stepLineupSection(dir === "down" ? 1 : -1, myIndex);
          if (target) {
            setFocus(target);
            return;
          }
          const activeTab = document.querySelector(".sc-lineup-daytab-active");
          if (activeTab) {
            setFocus(activeTab);
            return;
          }
        }
        const onDayRow = focusEl && (focusEl.classList.contains("sc-lineup-daytab") || focusEl.id === "sc-lineup-close");
        if (onDayRow && dir === "down") {
          const body = document.getElementById("sc-lineup-body");
          const firstItem = body && body.querySelector(".sc-lineup-item");
          if (firstItem) {
            setFocus(firstItem);
            return;
          }
        }
        if (dir === "right" && focusEl && focusEl.classList.contains("sc-lineup-daytab")) {
          const tabs = [...document.querySelectorAll(".sc-lineup-daytab")];
          if (focusEl === tabs[tabs.length - 1]) {
            const close = document.getElementById("sc-lineup-close");
            if (close) {
              setFocus(close);
              return;
            }
          }
        }
        if (dir === "left" && focusEl && focusEl.id === "sc-lineup-close") {
          const tabs = [...document.querySelectorAll(".sc-lineup-daytab")];
          const lastTab = tabs[tabs.length - 1];
          if (lastTab) {
            setFocus(lastTab);
            return;
          }
        }
      }
      {
        const buf = document.getElementById("messagebuffer");
        const onHeaderBtn = focusEl && CHAT_HEADER_IDS.includes(focusEl.id);
        const onLog = focusEl && focusEl.id === "messagebuffer";
        const onTextarea = focusEl && focusEl.id === "sc-chat-textarea";
        if (onHeaderBtn && (dir === "left" || dir === "right")) {
          const i = CHAT_HEADER_IDS.indexOf(focusEl.id);
          const step = dir === "right" ? 1 : -1;
          for (let ni = i + step; ni >= 0 && ni < CHAT_HEADER_IDS.length; ni += step) {
            const el = document.getElementById(CHAT_HEADER_IDS[ni]);
            if (el && isVisible(el)) {
              setFocus(el);
              return;
            }
          }
        }
        if (onHeaderBtn && dir === "down" && buf && isVisible(buf)) {
          setFocus(buf);
          return;
        }
        if (onTextarea && dir === "up" && buf && isVisible(buf)) {
          setFocus(buf);
          return;
        }
        if (onLog && buf && (dir === "up" || dir === "down")) {
          const scrollable = buf.scrollHeight > buf.clientHeight;
          const atTop = buf.scrollTop <= 0;
          const atBottom = buf.scrollTop + buf.clientHeight >= buf.scrollHeight - 1;
          if (dir === "down") {
            if (scrollable && !atBottom) {
              buf.scrollTop += 140;
              return;
            }
            const ta = document.getElementById("sc-chat-textarea");
            if (ta && isVisible(ta)) {
              setFocus(ta);
              return;
            }
          } else {
            if (scrollable && !atTop) {
              buf.scrollTop -= 140;
              return;
            }
            const firstHeader = CHAT_HEADER_IDS.map((id) => document.getElementById(id)).find((e) => e && isVisible(e));
            if (firstHeader) {
              setFocus(firstHeader);
              return;
            }
          }
        }
      }
      const { scope, list } = candidates();
      if (!list.length) return;
      if (!focusEl || !list.includes(focusEl) || !isVisible(focusEl)) {
        setFocus(list[0]);
        return;
      }
      const cur = focusEl.getBoundingClientRect();
      const idx = pickDirectional(dir, cur, list.map((el) => el === focusEl ? null : el.getBoundingClientRect()));
      if (idx !== -1) {
        setFocus(list[idx]);
        return;
      }
      if (dir === "up" || dir === "down") {
        const sc = scope.querySelector && scope.querySelector("#sc-trivia-list, #sc-settings-modal, #sc-upnext-body, #messagebuffer") || document.getElementById("messagebuffer");
        if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += dir === "down" ? 140 : -140;
      }
    }
    function activate() {
      if (!focusEl) {
        move("right");
        return;
      }
      if (focusEl.classList && focusEl.classList.contains("vjs-progress-control")) {
        if (isDesynced()) jumpToLive();
        return;
      }
      if (focusEl.tagName === "TEXTAREA" || focusEl.tagName === "INPUT") {
        if (focusEl.type === "checkbox" || focusEl.type === "range") focusEl.click();
        else {
          try {
            focusEl.focus();
          } catch (e) {
          }
        }
        return;
      }
      const ownerWrap = focusEl.classList && focusEl.classList.contains("vjs-menu-item") && focusEl.closest(".vjs-menu-button");
      const ownerBtn = ownerWrap && ownerWrap.querySelector("button.vjs-menu-button");
      const opener = focusEl;
      const depthBefore = countOpenOverlays();
      focusEl.click();
      const depthAfter = countOpenOverlays();
      if (depthAfter > depthBefore) {
        overlayFocusStack.push(opener);
      } else if (depthAfter < depthBefore) {
        restoreFocusAfterOverlayClose();
        return;
      }
      if (ownerBtn && isVisible(ownerBtn) && !openVjsMenu()) {
        clearFocus();
        setFocus(ownerBtn);
      }
    }
    function closeTop() {
      for (const hook of tvNavState.preBackHooks) {
        if (hook()) return true;
      }
      const menu = openVjsMenu();
      if (menu) {
        const wrap = menu.closest(".vjs-menu-button");
        const btn = wrap && wrap.querySelector("button.vjs-menu-button");
        if (btn) {
          try {
            btn.click();
          } catch (e) {
            try {
              menu.classList.remove("vjs-lock-showing");
            } catch (e2) {
            }
          }
        } else {
          try {
            menu.classList.remove("vjs-lock-showing");
          } catch (e) {
          }
        }
        clearFocus();
        if (btn && isVisible(btn)) setFocus(btn);
        return true;
      }
      const settings = document.getElementById("sc-settings-overlay");
      if (settings && isVisible(settings)) {
        const c = document.getElementById("sc-settings-cancel");
        if (c) c.click();
        else settings.remove();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const modal = document.getElementById("sc-modal-overlay");
      if (modal && isVisible(modal)) {
        (document.getElementById("sc-btn-cancel") || { click() {
          modal.remove();
        } }).click();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const trivia = document.getElementById("sc-trivia-card");
      if (trivia && trivia.classList.contains("sc-show")) {
        hideTriviaCard();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const np = document.getElementById("sc-np-card");
      if (np && np.classList.contains("sc-np-visible")) {
        hideNowPlayingCard();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const upNext = document.getElementById("sc-upnext-card");
      if (upNext && upNext.classList.contains("sc-upnext-visible")) {
        hideUpNextCard();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const linkPip = document.getElementById("sc-link-pip-panel");
      if (linkPip && linkPip.classList.contains("sc-link-pip-visible")) {
        closeLinkPip();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const emotes = document.getElementById("sc-emotes-panel");
      if (emotes && isVisible(emotes)) {
        closeEmotesPanel();
        restoreFocusAfterOverlayClose();
        return true;
      }
      const lineup = document.getElementById("sc-lineup-screen");
      if (lineup && lineup.classList.contains("sc-lineup-visible")) {
        hideLineupScreen();
        restoreFocusAfterOverlayClose();
        return true;
      }
      for (const id of ["sc-users-panel", "sc-poll-panel"]) {
        const p = document.getElementById(id);
        if (p && isVisible(p)) {
          p.style.display = "none";
          restoreFocusAfterOverlayClose();
          return true;
        }
      }
      return false;
    }
    function revealChrome() {
      if (typeof chromeState.leftZoneReveal === "function") chromeState.leftZoneReveal(4e3);
      else document.body.classList.add("sc-leftzone");
      if (typeof chromeState.chromeWake === "function") chromeState.chromeWake();
      else document.body.classList.remove("sc-chrome-hidden");
      if (typeof chromeState.topBarWake === "function") chromeState.topBarWake();
    }
    window.__scTvKey = function(dir, repeatCount) {
      try {
        if (dir === "back") {
          if (!closeTop()) {
            try {
              if (window.CytubeNative && CytubeNative.tvBack) CytubeNative.tvBack();
            } catch (e) {
            }
          }
          return;
        }
        revealChrome();
        if (dir === "center") activate();
        else move(dir, repeatCount || 0);
      } catch (e) {
      }
    };
  }

  // src/lineup/screen.js
  var _lastData = null;
  var _activeDay = null;
  var _activeSectionIndex = 0;
  function ensureScreenDom() {
    ensureThemeFontsLoaded();
    let screen2 = document.getElementById("sc-lineup-screen");
    if (screen2) return screen2;
    screen2 = document.createElement("div");
    screen2.id = "sc-lineup-screen";
    screen2.innerHTML = `
        <button id="sc-lineup-close" type="button">✕</button>
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <nav id="sc-lineup-daytabs"></nav>
        <div id="sc-lineup-body"></div>
        <svg width="0" height="0" style="position:absolute">
            <filter id="sc-ticket-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="noise"/>
                <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/>
            </filter>
        </svg>`;
    screen2.querySelector("#sc-lineup-close").addEventListener("click", hideLineupScreen);
    document.body.appendChild(screen2);
    return screen2;
  }
  function renderLoading(screen2) {
    screen2.querySelector("#sc-lineup-daytabs").innerHTML = "";
    screen2.querySelector("#sc-lineup-body").innerHTML = '<div id="sc-lineup-loading">Fetching tonight’s lineup…</div>';
  }
  function fallbackTitleFontSize(text) {
    if (text.length > 55) return 10;
    if (text.length > 38) return 12;
    return 14;
  }
  function itemButton(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sc-lineup-item" + (item.isNowPlaying ? " sc-lineup-item-current" : "") + (item.played ? " sc-lineup-item-played" : "") + (item.clickable === false ? " sc-lineup-item-static" : "");
    const titleText = `${item.cleanTitle}${item.cleanYear ? ` (${item.cleanYear})` : ""}`;
    const etaText = item.isNowPlaying ? "NOW PLAYING" : item.etaLabel || "";
    btn.innerHTML = `
        <div class="sc-lineup-poster" style="${item.poster ? `background-image:url(${item.poster})` : ""}">
            ${!item.poster ? `<div class="sc-lineup-poster-fallback" style="font-size:${fallbackTitleFontSize(titleText)}px">${titleText}</div>` : ""}
            ${etaText ? `<div class="sc-lineup-eta">${etaText}</div>` : ""}
        </div>`;
    if (item.clickable !== false) {
      btn.addEventListener("click", () => showNowPlayingCard(item, { autoHide: false, showProgress: item.isNowPlaying }));
    }
    return btn;
  }
  function sectionEl(section) {
    const el = document.createElement("div");
    el.className = "sc-lineup-section";
    const theme = getSectionTheme(section.slug);
    el.style.setProperty("--sc-lineup-wash", theme.wash);
    if (section.name) {
      const name = document.createElement("div");
      name.className = "sc-lineup-section-name";
      name.style.setProperty("color", theme.color, "important");
      if (theme.font) name.style.setProperty("font-family", `${theme.font}, cursive`, "important");
      name.textContent = section.name;
      el.appendChild(name);
    }
    const rail = document.createElement("div");
    rail.className = "sc-lineup-rail";
    section.items.forEach((item) => rail.appendChild(itemButton(item)));
    el.appendChild(rail);
    return el;
  }
  function renderDayTabs(screen2, days) {
    const tabs = screen2.querySelector("#sc-lineup-daytabs");
    tabs.innerHTML = "";
    days.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sc-lineup-daytab" + (d.day === _activeDay ? " sc-lineup-daytab-active" : "");
      btn.innerHTML = `<span class="sc-lineup-daytab-label">${d.day}</span>`;
      btn.addEventListener("click", () => showDay(screen2, d.day));
      tabs.appendChild(btn);
    });
  }
  function renderBody(screen2, days) {
    const body = screen2.querySelector("#sc-lineup-body");
    body.innerHTML = "";
    const day = days.find((d) => d.day === _activeDay) || days[0];
    if (!day || !day.sections.length) {
      body.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
      return;
    }
    if (isTv) {
      if (_activeSectionIndex >= day.sections.length) _activeSectionIndex = 0;
      body.appendChild(sectionEl(day.sections[_activeSectionIndex]));
    } else {
      day.sections.forEach((section) => body.appendChild(sectionEl(section)));
    }
  }
  function showDay(screen2, day) {
    _activeDay = day;
    _activeSectionIndex = 0;
    const tabs = [...screen2.querySelectorAll(".sc-lineup-daytab")];
    tabs.forEach((t) => t.classList.toggle("sc-lineup-daytab-active", t.textContent === day));
    renderBody(screen2, _lastData.days);
  }
  function stepLineupSection(delta, columnIndex) {
    if (!_lastData || _lastData.fallback) return null;
    const days = _lastData.days || [];
    const day = days.find((d) => d.day === _activeDay) || days[0];
    if (!day) return null;
    const newIndex = _activeSectionIndex + delta;
    if (newIndex < 0 || newIndex >= day.sections.length) return null;
    _activeSectionIndex = newIndex;
    const screen2 = document.getElementById("sc-lineup-screen");
    renderBody(screen2, days);
    const rail = screen2.querySelector(".sc-lineup-rail");
    if (!rail) return null;
    const items = [...rail.querySelectorAll(".sc-lineup-item")];
    return items[Math.min(columnIndex, items.length - 1)] || null;
  }
  function renderFallback(screen2, data) {
    screen2.querySelector("#sc-lineup-daytabs").innerHTML = "";
    const body = screen2.querySelector("#sc-lineup-body");
    body.innerHTML = "";
    const items = data.days && data.days[0] && data.days[0].sections[0] && data.days[0].sections[0].items || [];
    if (!items.length) {
      body.innerHTML = '<div id="sc-lineup-loading">No lineup available right now.</div>';
      return;
    }
    const section = document.createElement("div");
    section.className = "sc-lineup-section sc-lineup-section-fallback";
    const rail = document.createElement("div");
    rail.className = "sc-lineup-rail";
    items.forEach((item) => rail.appendChild(itemButton(item)));
    section.appendChild(rail);
    body.appendChild(section);
  }
  function renderItems(screen2, data) {
    const header = screen2.querySelector("#sc-lineup-header");
    if (header) header.textContent = data && data.listTitle || "Grindhouse Lineup";
    _lastData = data;
    if (!data || data.fallback) {
      renderFallback(screen2, data || { days: [] });
      return;
    }
    const days = data.days || [];
    _activeDay = (days.find((d) => d.isToday) || days[0] || {}).day || null;
    _activeSectionIndex = 0;
    renderDayTabs(screen2, days);
    renderBody(screen2, days);
    if (tvNavState.setFocus) {
      const activeTab = screen2.querySelector(".sc-lineup-daytab-active");
      if (activeTab) tvNavState.setFocus(activeTab);
    }
  }
  function showLineupScreen() {
    const screen2 = ensureScreenDom();
    screen2.classList.add("sc-lineup-visible");
    renderLoading(screen2);
    getTonightsLineup().then((data) => renderItems(screen2, data)).catch(() => {
      renderItems(screen2, { fallback: true, days: [] });
    });
  }
  function hideLineupScreen() {
    const screen2 = document.getElementById("sc-lineup-screen");
    if (screen2) screen2.classList.remove("sc-lineup-visible");
  }

  // src/posters.js
  function initPosterStrip() {
    if (document.getElementById("sc-poster-toggle")) return;
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "sc-poster-toggle";
    toggleBtn.textContent = "Coming Attractions";
    toggleBtn.title = "Show tonight's lineup";
    toggleBtn.dataset.noTvCaption = "1";
    toggleBtn.addEventListener("click", () => showLineupScreen());
    const header = document.getElementById("videowrap-header");
    (header || document.body).appendChild(toggleBtn);
  }
  function initUpNextButton() {
    if (document.getElementById("sc-up-next-btn")) return;
    const btn = document.createElement("button");
    btn.id = "sc-up-next-btn";
    btn.textContent = "Up Next";
    btn.title = "Preview what's playing next";
    btn.dataset.noTvCaption = "1";
    btn.addEventListener("click", () => showUpNextCard());
    const header = document.getElementById("videowrap-header");
    (header || document.body).appendChild(btn);
  }
  function initPollWatcher() {
    const tryInit = () => {
      const pollwrap = document.getElementById("pollwrap");
      if (!pollwrap) {
        const bodyObs = new MutationObserver(() => {
          if (document.getElementById("pollwrap")) {
            bodyObs.disconnect();
            tryInit();
          }
        });
        bodyObs.observe(document.body, { childList: true, subtree: true });
        return;
      }
      _initPollWatcher(pollwrap);
    };
    tryInit();
  }
  function _initPollWatcher(pollwrap) {
    const header = document.getElementById("sc-chat-header");
    if (!header) return;
    const btn = document.createElement("button");
    btn.id = "sc-poll-btn";
    btn.title = "Channel announcement / poll";
    btn.textContent = "POLL";
    header.appendChild(btn);
    const panel = document.createElement("div");
    panel.id = "sc-poll-panel";
    panel.style.display = "none";
    document.body.appendChild(panel);
    let panelOpen = false;
    const renderPanel = () => {
      var _a, _b, _c, _d, _e;
      const well = pollwrap.querySelector(".well.active") || pollwrap.querySelector(".well");
      if (!well) {
        panel.innerHTML = "";
        return;
      }
      const h = ((_b = (_a = well.querySelector("h3")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
      const opts = [...well.querySelectorAll(".option")].map((o) => {
        const btn2 = o.querySelector("button");
        const text = o.textContent.replace((btn2 == null ? void 0 : btn2.textContent) || "", "").trim();
        const links = [...o.querySelectorAll("a")].map(
          (a) => `<a href="${a.href}" target="_blank" rel="noopener noreferrer">${a.textContent}</a>`
        );
        let html = o.innerHTML.replace(/<button[^>]*>.*?<\/button>/i, "").trim();
        return `<div class="sc-poll-option">${html}</div>`;
      });
      const label = ((_d = (_c = well.querySelector(".label")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || "";
      const author = ((_e = well.querySelector(".label")) == null ? void 0 : _e.getAttribute("title")) || "";
      panel.innerHTML = `
            <div class="sc-poll-header">${h}</div>
            <div class="sc-poll-options">${opts.join("")}</div>
            ${label ? `<div class="sc-poll-meta">${author ? author + " · " : ""}${label}</div>` : ""}
        `;
    };
    const hasPollContent = () => {
      const activeWell = pollwrap.querySelector(".well.active") || pollwrap.querySelector(".well");
      return !!(activeWell && activeWell.textContent.trim().length > 10);
    };
    const updateBtn = () => {
      const hasContent = hasPollContent();
      btn.style.display = hasContent ? "" : "none";
      if (!hasContent && panelOpen) {
        panel.style.display = "none";
        panelOpen = false;
        btn.classList.remove("sc-poll-btn-active");
      }
    };
    btn.addEventListener("click", () => {
      panelOpen = !panelOpen;
      if (panelOpen) {
        renderPanel();
        panel.style.display = "block";
        btn.classList.add("sc-poll-btn-active");
      } else {
        panel.style.display = "none";
        btn.classList.remove("sc-poll-btn-active");
      }
    });
    document.addEventListener("click", (e) => {
      if (panelOpen && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = "none";
        panelOpen = false;
        btn.classList.remove("sc-poll-btn-active");
      }
    });
    const reactToPollChange = () => {
      updateBtn();
      if (panelOpen) renderPanel();
    };
    onSocket("newPoll", reactToPollChange);
    onSocket("updatePoll", reactToPollChange);
    onSocket("closePoll", reactToPollChange);
    updateBtn();
  }
  function initUserCount() {
    const header = document.getElementById("sc-chat-header");
    if (!header) return;
    const wrap = document.createElement("div");
    wrap.id = "sc-usercount-btn";
    header.appendChild(wrap);
    const connectedBtn = document.createElement("button");
    connectedBtn.id = "sc-usercount-connected";
    connectedBtn.className = "sc-usercount-part";
    connectedBtn.title = "Connected";
    wrap.appendChild(connectedBtn);
    const onlineBtn = document.createElement("button");
    onlineBtn.id = "sc-usercount-online";
    onlineBtn.className = "sc-usercount-part";
    onlineBtn.title = "Online";
    wrap.appendChild(onlineBtn);
    const panel = document.createElement("div");
    panel.id = "sc-users-panel";
    document.body.appendChild(panel);
    let activeMode = null;
    let lastTotal = 0;
    const readItemUsername = (item) => {
      var _a, _b;
      const spans = item.querySelectorAll("span");
      return ((_b = (_a = spans[spans.length - 1]) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
    };
    const getUserItems = () => [...document.querySelectorAll("#userlist .userlist_item")];
    const sortByName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
    const getConnectedUsers = () => getUserItems().filter((item) => !item.classList.contains("userlist_afk")).map(readItemUsername).filter(Boolean).sort(sortByName);
    const getOnlineUsers = () => {
      const all = getUserItems().map((item) => ({ name: readItemUsername(item), afk: item.classList.contains("userlist_afk") })).filter((u) => u.name);
      const active = all.filter((u) => !u.afk).sort((a, b) => sortByName(a.name, b.name));
      const idle = all.filter((u) => u.afk).sort((a, b) => sortByName(a.name, b.name));
      return [...active, ...idle];
    };
    const updateCount = (n) => {
      const connected = getConnectedUsers().length;
      const total = typeof n === "number" ? n : (() => {
        var _a, _b;
        const cytubCount = document.getElementById("usercount");
        const raw = (_b = (_a = cytubCount == null ? void 0 : cytubCount.textContent) == null ? void 0 : _a.match(/\d+/)) == null ? void 0 : _b[0];
        return raw ? parseInt(raw) : connected;
      })();
      lastTotal = total;
      connectedBtn.textContent = `🗨 ${connected}`;
      onlineBtn.textContent = `👁 ${total}`;
    };
    const renderPanel = () => {
      const users = activeMode === "online" ? getOnlineUsers() : getConnectedUsers().map((name) => ({ name, afk: false }));
      const headerText = activeMode === "online" ? `${users.length} of ${lastTotal} online` : `${users.length} connected`;
      panel.innerHTML = `
            <div class="sc-users-panel-header">${headerText}</div>
            ${users.map((u) => {
        const color = usernameToColor(u.name);
        const emoji = getExternalUserEmoji(u.name);
        const emojiHtml = emoji ? `<span class="sc-users-panel-emoji">${emoji}</span>` : "";
        const afkClass = u.afk ? " sc-users-panel-afk" : "";
        return `<div class="sc-users-panel-name${afkClass}" style="color:${color}">${emojiHtml}${u.name}</div>`;
      }).join("")}
        `;
    };
    const closePanel = () => {
      panel.style.display = "none";
      connectedBtn.classList.remove("sc-users-active");
      onlineBtn.classList.remove("sc-users-active");
      activeMode = null;
    };
    const openPanel = (mode, modeBtn) => {
      activeMode = mode;
      renderPanel();
      panel.style.display = "block";
      connectedBtn.classList.toggle("sc-users-active", modeBtn === connectedBtn);
      onlineBtn.classList.toggle("sc-users-active", modeBtn === onlineBtn);
    };
    const handleModeClick = (mode, modeBtn) => (e) => {
      e.stopPropagation();
      if (activeMode === mode) closePanel();
      else openPanel(mode, modeBtn);
    };
    connectedBtn.addEventListener("click", handleModeClick("connected", connectedBtn));
    onlineBtn.addEventListener("click", handleModeClick("online", onlineBtn));
    document.addEventListener("click", (e) => {
      if (activeMode && !panel.contains(e.target) && !connectedBtn.contains(e.target) && !onlineBtn.contains(e.target)) {
        closePanel();
      }
    });
    const ul = document.getElementById("userlist");
    if (ul) {
      new MutationObserver(() => {
        updateCount();
        if (activeMode) renderPanel();
      }).observe(ul, { childList: true, subtree: true });
    }
    onSocket("usercount", (n) => {
      updateCount(n);
      if (activeMode === "online") renderPanel();
    });
    updateCount();
  }

  // src/chat/fontsize.js
  function getChatFontSize() {
    const v = parseInt(getKey(LS_CHAT_FONT), 10);
    if (Number.isFinite(v) && v >= 10 && v <= 32) return v;
    return document.body && document.body.classList.contains("sc-tv") ? 18 : 14;
  }
  function applyChatFontSize(px) {
    const buf = document.getElementById("messagebuffer");
    if (buf) buf.style.setProperty("font-size", px + "px", "important");
    const ta = document.getElementById("sc-chat-textarea");
    if (ta) {
      const overlay = document.body && document.body.classList.contains("sc-chat-overlay");
      ta.style.setProperty("font-size", (overlay ? 13 : px) + "px", "important");
    }
  }

  // src/cards/subtitles.js
  var DEFAULT_OPACITY = 0.6;
  var DEFAULT_FONTSIZE = 15;
  var DEFAULT_LINES = 3;
  function clampLines(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(3, Math.max(1, v)) : DEFAULT_LINES;
  }
  function clampOpacity(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(0.9, Math.max(0.2, v)) : DEFAULT_OPACITY;
  }
  function clampFontSize(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(24, Math.max(12, v)) : DEFAULT_FONTSIZE;
  }
  function getSubtitleOpacity() {
    return clampOpacity(getKey(LS_SUBTITLE_OPACITY) || DEFAULT_OPACITY);
  }
  function getSubtitleFontSize() {
    return clampFontSize(getKey(LS_SUBTITLE_FONTSIZE) || DEFAULT_FONTSIZE);
  }
  function getSubtitleLines() {
    return clampLines(getKey(LS_SUBTITLE_LINES) || DEFAULT_LINES);
  }
  function applySubtitleOpacity(v) {
    document.body.style.setProperty("--sc-subtitle-opacity", String(clampOpacity(v)));
  }
  function applySubtitleFontSize(px) {
    document.body.style.setProperty("--sc-subtitle-fontsize", clampFontSize(px) + "px");
  }
  function _escHtml3(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function extractSubtitleLine(msgEl) {
    const cls = [...msgEl.classList].find((c) => c.startsWith("chat-msg-"));
    if (!cls) return null;
    const username = cls.replace("chat-msg-", "");
    const clone = msgEl.cloneNode(true);
    clone.querySelectorAll(".timestamp, .username, .sc-img-embed").forEach((el) => el.remove());
    const html = clone.innerHTML.trim();
    if (!html) return null;
    return { username, color: usernameToColor(username), emoji: getExternalUserEmoji(username), html };
  }
  function renderSubtitleLine(line) {
    const emojiHtml = line.emoji ? `<span class="sc-subtitle-emoji">${_escHtml3(line.emoji)}</span>` : "";
    return `<div class="sc-subtitle-pill">${emojiHtml}<span class="sc-subtitle-name" style="color:${line.color}">${_escHtml3(line.username)}:</span> <span class="sc-subtitle-text">${line.html}</span></div>`;
  }
  function ensureContainer() {
    let el = document.getElementById("sc-subtitles-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "sc-subtitles-overlay";
      document.body.appendChild(el);
    }
    return el;
  }
  function inSubtitlesMode() {
    try {
      return localStorage.getItem("sc_chat_mode") === "subtitles";
    } catch (e) {
      return false;
    }
  }
  function refreshSubtitles() {
    if (!inSubtitlesMode()) return;
    const container = ensureContainer();
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    const maxLines = getSubtitleLines();
    const all = [...buf.querySelectorAll('[class*="chat-msg-"]')];
    const lines = all.slice(-maxLines).map(extractSubtitleLine).filter(Boolean);
    container.innerHTML = lines.map(renderSubtitleLine).join("");
  }
  function initSubtitles() {
    ensureContainer();
    applySubtitleOpacity(getSubtitleOpacity());
    applySubtitleFontSize(getSubtitleFontSize());
    refreshSubtitles();
  }
  var _subtitlesObserverStarted = false;
  function startSubtitlesObserver() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    if (_subtitlesObserverStarted) {
      refreshSubtitles();
      return;
    }
    _subtitlesObserverStarted = true;
    new MutationObserver(refreshSubtitles).observe(buf, { childList: true, subtree: true });
    refreshSubtitles();
  }

  // src/chat/modes.js
  function initAmbientGlow() {
    if (isTv) return;
    const el = document.createElement("div");
    el.id = "sc-ambient";
    document.body.appendChild(el);
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let disabled = false;
    const sample = () => {
      if (disabled) return;
      const v = document.querySelector("#videowrap video");
      if (!v || v.paused || v.readyState < 2 || !v.videoWidth) return;
      try {
        ctx.drawImage(v, 0, 0, 16, 9);
        const d = ctx.getImageData(0, 0, 16, 9).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const max = Math.max(r, g, b) || 1;
        const boost = (c) => Math.min(255, Math.round(c * (1 + c / max * 0.35)));
        r = boost(r);
        g = boost(g);
        b = boost(b);
        document.documentElement.style.setProperty("--sc-ambient-color", `rgba(${r},${g},${b},0.5)`);
        document.documentElement.style.setProperty("--np-accent", `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`);
      } catch (e) {
        disabled = true;
        document.body.classList.add("sc-ambient-off");
      }
    };
    setInterval(sample, 2500);
  }
  function initChromeAutohide() {
    if (!isTv && !document.body.classList.contains("sc-vertical")) return;
    let neutralizeAttempts = 0;
    const tryNeutralize = () => {
      neutralizeVjsInactivityTimer();
      if (!(window.PLAYER && window.PLAYER.player) && neutralizeAttempts++ < 20) setTimeout(tryNeutralize, 500);
    };
    tryNeutralize();
    onSocket("changeMedia", neutralizeVjsInactivityTimer);
    let timer = null;
    let pinned = false;
    const hide = () => {
      if (!pinned) document.body.classList.add("sc-chrome-hidden");
    };
    const show = () => {
      document.body.classList.remove("sc-chrome-hidden");
      if (typeof chromeState.topBarWake === "function") chromeState.topBarWake();
      clearTimeout(timer);
      if (!pinned) timer = setTimeout(hide, 4e3);
    };
    ["mousemove", "keydown", "click", "touchstart", "wheel"].forEach((ev) => document.addEventListener(ev, show, { passive: true }));
    chromeState.chromeWake = show;
    chromeState.pinChromeVisible = () => {
      pinned = true;
      clearTimeout(timer);
      show();
    };
    chromeState.unpinChromeVisible = () => {
      pinned = false;
      clearTimeout(timer);
      hide();
    };
    timer = setTimeout(hide, 4e3);
  }
  var _CHAT_MODES = isTv ? ["sidebar", "overlay", "subtitles", "hidden"] : ["sidebar", "overlay", "subtitles", "hidden", "chatonly"];
  var _CHAT_MODE_ICONS = { sidebar: "▐", overlay: "▣", hidden: "⊠", subtitles: "💬", chatonly: "☰" };
  var _CHAT_MODE_LABELS = { sidebar: "Sidebar", overlay: "Overlay", hidden: "Hidden", subtitles: "Subtitles", chatonly: "Chat Only" };
  var _chatOnlyTimer = null;
  var _inChatOnly = false;
  function _coStopMedia() {
    try {
      const vid = document.querySelector("#videowrap video");
      if (vid) {
        vid.muted = true;
        if (!vid.paused) vid.pause();
      }
    } catch (e) {
    }
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p) {
        if (typeof p.pauseVideo === "function") p.pauseVideo();
        else if (typeof p.pause === "function") {
          try {
            p.pause();
          } catch (e) {
          }
        }
        if (typeof p.mute === "function") p.mute();
        else if (typeof p.muted === "function") p.muted(true);
      }
    } catch (e) {
    }
  }
  onSocket("changeMedia", () => {
    if (_inChatOnly) _coStopMedia();
  });
  onSocket("mediaUpdate", () => {
    if (_inChatOnly) _coStopMedia();
  });
  function enterChatOnly() {
    _inChatOnly = true;
    _coStopMedia();
    clearInterval(_chatOnlyTimer);
    _chatOnlyTimer = setInterval(_coStopMedia, 5e3);
  }
  function exitChatOnly() {
    if (!_inChatOnly) return;
    _inChatOnly = false;
    clearInterval(_chatOnlyTimer);
    _chatOnlyTimer = null;
    try {
      const vid = document.querySelector("#videowrap video");
      if (vid) vid.muted = false;
    } catch (e) {
    }
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p) {
        if (typeof p.unMute === "function") p.unMute();
        else if (typeof p.muted === "function") p.muted(false);
        if (typeof p.playVideo === "function") p.playVideo();
        else if (typeof p.play === "function") {
          try {
            p.play();
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
  }
  function applyChatMode(mode) {
    _CHAT_MODES.forEach((m) => document.body.classList.toggle("sc-chat-" + m, m === mode));
    try {
      localStorage.setItem("sc_chat_mode", mode);
    } catch (e) {
    }
    if (mode === "chatonly") enterChatOnly();
    else exitChatOnly();
    if (mode === "subtitles") refreshSubtitles();
    const btn = document.getElementById("sc-chatmode-btn");
    if (btn) {
      btn.textContent = _CHAT_MODE_ICONS[mode] || "▐";
      const label = _CHAT_MODE_LABELS[mode] || mode;
      btn.title = "Chat: " + label + " (press C)";
      btn.dataset.tvLabel = "Chat: " + label;
    }
    applyChatFontSize(getChatFontSize());
    const buf = document.getElementById("messagebuffer");
    if (buf) {
      const toBottom = () => {
        buf.scrollTop = buf.scrollHeight;
      };
      requestAnimationFrame(() => requestAnimationFrame(toBottom));
      [120, 320, 600].forEach((ms) => setTimeout(toBottom, ms));
    }
  }
  function cycleChatMode() {
    let cur = "sidebar";
    try {
      cur = localStorage.getItem("sc_chat_mode") || "sidebar";
    } catch (e) {
    }
    applyChatMode(_CHAT_MODES[(_CHAT_MODES.indexOf(cur) + 1) % _CHAT_MODES.length]);
  }
  function initChatModes() {
    let saved = "sidebar";
    try {
      saved = localStorage.getItem("sc_chat_mode") || "sidebar";
    } catch (e) {
    }
    if (!_CHAT_MODES.includes(saved)) saved = "sidebar";
    if (!document.getElementById("sc-chatmode-btn")) {
      const btn = document.createElement("button");
      btn.id = "sc-chatmode-btn";
      btn.type = "button";
      btn.title = "Cycle chat layout (press C)";
      btn.addEventListener("click", cycleChatMode);
      document.body.appendChild(btn);
    }
    if (!document.getElementById("sc-chatonly-banner")) {
      const banner = document.createElement("div");
      banner.id = "sc-chatonly-banner";
      banner.textContent = "Paused · Muted";
      document.body.appendChild(banner);
    }
    applyChatMode(saved);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "c" && e.key !== "C") return;
      const t = e.target;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      cycleChatMode();
    });
  }
  function initNewMessagePill() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    const pill = document.createElement("div");
    pill.id = "sc-newmsg-pill";
    pill.textContent = "↓ New messages";
    document.body.appendChild(pill);
    const nearBottom = () => buf.scrollHeight - buf.scrollTop - buf.clientHeight < 80;
    const toBottom = () => {
      buf.scrollTop = buf.scrollHeight;
      pill.classList.remove("sc-show");
    };
    pill.addEventListener("click", toBottom);
    buf.addEventListener("scroll", () => {
      if (nearBottom()) pill.classList.remove("sc-show");
    }, { passive: true });
    new MutationObserver(() => {
      if (nearBottom()) buf.scrollTop = buf.scrollHeight;
      else pill.classList.add("sc-show");
    }).observe(buf, { childList: true });
  }
  function initMentionToast() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    const myName = () => {
      try {
        return window.CLIENT && CLIENT.name ? String(CLIENT.name) : "";
      } catch (e) {
        return "";
      }
    };
    let toast = null, toastTimer = null;
    const show = (name, text) => {
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "sc-mention-toast";
        toast.addEventListener("click", () => toast.classList.remove("sc-show"));
        document.body.appendChild(toast);
      }
      toast.innerHTML = `<span class="sc-mt-name"></span><span class="sc-mt-text"></span>`;
      toast.querySelector(".sc-mt-name").textContent = name + ":";
      toast.querySelector(".sc-mt-text").textContent = " " + text;
      toast.classList.add("sc-show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("sc-show"), 6e3);
    };
    new MutationObserver((muts) => {
      const me = myName().toLowerCase();
      muts.forEach((m) => m.addedNodes.forEach((node) => {
        var _a, _b, _c;
        if (node.nodeType !== 1) return;
        const isMention = ((_a = node.classList) == null ? void 0 : _a.contains("nick-highlight")) || me && node.textContent && node.textContent.toLowerCase().includes("@" + me);
        if (!isMention) return;
        const name = ((_c = (_b = node.querySelector(".username")) == null ? void 0 : _b.textContent) == null ? void 0 : _c.replace(/[:\s]+$/, "").trim()) || "Mention";
        const clone = node.cloneNode(true);
        clone.querySelectorAll(".timestamp, .username").forEach((el) => el.remove());
        const text = clone.textContent.replace(/^[\s:]+/, "").trim().slice(0, 180);
        show(name, text);
      }));
    }).observe(buf, { childList: true });
  }
  function initChatFont() {
    applyChatFontSize(getChatFontSize());
  }
  function initLeftZone() {
    let hideTimer = null;
    const THRESH = 120;
    const scheduleHide = (ms) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => document.body.classList.remove("sc-leftzone"), ms);
    };
    const reveal = (autoHideMs) => {
      clearTimeout(hideTimer);
      document.body.classList.add("sc-leftzone");
      if (autoHideMs) scheduleHide(autoHideMs);
    };
    chromeState.leftZoneReveal = reveal;
    if (!document.getElementById("sc-cluster-grip")) {
      const grip = document.createElement("div");
      grip.id = "sc-cluster-grip";
      grip.title = "Controls";
      grip.addEventListener("mouseenter", reveal);
      grip.addEventListener("click", reveal);
      document.body.appendChild(grip);
    }
    document.addEventListener("mousemove", (e) => {
      if (e.clientX <= THRESH) reveal();
      else if (document.body.classList.contains("sc-leftzone")) scheduleHide(550);
    }, { passive: true });
    document.addEventListener("touchstart", (e) => {
      const x = e.touches[0] ? e.touches[0].clientX : 1e9;
      if (x <= THRESH) {
        reveal(3500);
      }
    }, { passive: true });
  }
  var VSPLIT_MIN = 25;
  var VSPLIT_MAX = 75;
  function initVertControlBand() {
    if (document.getElementById("sc-vert-ctrl-band")) return;
    const band = document.createElement("div");
    band.id = "sc-vert-ctrl-band";
    document.body.appendChild(band);
    const saved = getSetting("vertSplit");
    const initial = Math.min(VSPLIT_MAX, Math.max(VSPLIT_MIN, saved));
    document.body.style.setProperty("--sc-split", String(initial));
    let dragging = false;
    band.addEventListener("pointerdown", (e) => {
      dragging = true;
      band.classList.add("sc-dragging");
      band.setPointerCapture(e.pointerId);
    });
    band.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const pct = Math.min(VSPLIT_MAX, Math.max(VSPLIT_MIN, e.clientY / window.innerHeight * 100));
      document.body.style.setProperty("--sc-split", String(pct));
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      band.classList.remove("sc-dragging");
      const pct = Math.min(VSPLIT_MAX, Math.max(VSPLIT_MIN, e.clientY / window.innerHeight * 100));
      localStorage.setItem("sc_vert_split", String(pct));
    };
    band.addEventListener("pointerup", endDrag);
    band.addEventListener("pointercancel", endDrag);
  }
  function initRightZone() {
    let hideTimer = null;
    const THRESH = 100;
    const scheduleHide = (ms) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => document.body.classList.remove("sc-rightzone"), ms);
    };
    const reveal = (ms) => {
      clearTimeout(hideTimer);
      document.body.classList.add("sc-rightzone");
      if (ms) scheduleHide(ms);
    };
    chromeState.rightZoneReveal = reveal;
    if (!document.getElementById("sc-vert-ctrl-grip")) {
      const grip = document.createElement("div");
      grip.id = "sc-vert-ctrl-grip";
      grip.title = "Controls";
      grip.addEventListener("click", () => reveal(3500));
      document.body.appendChild(grip);
    }
    document.addEventListener("touchstart", (e) => {
      var _a;
      if (!document.body.classList.contains("sc-vertical")) return;
      const x = (_a = e.touches[0]) == null ? void 0 : _a.clientX;
      if (x != null && window.innerWidth - x <= THRESH) reveal(3500);
    }, { passive: true });
  }
  function initVideoTapReveal() {
    const REVEAL_MS = 4e3;
    let scrubReleaseTimer = null;
    const tap = document.createElement("div");
    tap.id = "sc-video-tap";
    tap.addEventListener("click", () => {
      if (chromeState.topBarWake) chromeState.topBarWake();
      if (chromeState.leftZoneReveal) chromeState.leftZoneReveal(REVEAL_MS);
      if (chromeState.rightZoneReveal) chromeState.rightZoneReveal(REVEAL_MS);
      holdScrubber(true);
      clearTimeout(scrubReleaseTimer);
      scrubReleaseTimer = setTimeout(() => holdScrubber(false), REVEAL_MS);
    });
    document.body.appendChild(tap);
  }

  // src/chrome/buttons.js
  function getMediaUpdateListeners() {
    var _a, _b;
    const key = "$mediaUpdate";
    if ((_a = socket._callbacks) == null ? void 0 : _a[key]) return { store: "_callbacks", key };
    if ((_b = socket._events) == null ? void 0 : _b.mediaUpdate) return { store: "_events", key: "mediaUpdate" };
    return null;
  }
  function initDesyncButton() {
    const btn = document.createElement("button");
    btn.id = "sc-desync-btn";
    btn.textContent = "⟳";
    btn.title = "Free watch — click to watch freely, click again to re-sync";
    btn.dataset.tvLabel = "Free Watch";
    document.body.appendChild(btn);
    let desynced = false;
    let savedListeners = null;
    function trackLiveRoomPosition(data) {
      if (data && typeof data.currentTime === "number") {
        mediaState.desyncLiveSeconds = data.currentTime;
        mediaState.desyncLiveAt = Date.now();
      }
      if (data && typeof data.paused === "boolean") mediaState.desyncLivePaused = data.paused;
    }
    const freezeSync = () => {
      var _a;
      const loc = getMediaUpdateListeners();
      if (!loc) {
        console.warn("[CyTube SC] Could not find mediaUpdate listeners to freeze");
        return;
      }
      if (loc.store === "_callbacks") {
        savedListeners = socket._callbacks[loc.key].slice();
        socket._callbacks[loc.key] = [];
      } else {
        savedListeners = socket._events[loc.key];
        delete socket._events[loc.key];
      }
      console.log("[CyTube SC] Sync frozen — removed", (_a = savedListeners == null ? void 0 : savedListeners.length) != null ? _a : 1, "mediaUpdate listener(s)");
    };
    const thawSync = () => {
      if (!savedListeners) return;
      const loc = getMediaUpdateListeners();
      if ((loc == null ? void 0 : loc.store) === "_callbacks") {
        socket._callbacks[loc.key] = savedListeners;
      } else {
        socket._events = socket._events || {};
        socket._events["mediaUpdate"] = savedListeners;
      }
      savedListeners = null;
      console.log("[CyTube SC] Sync restored");
      if (typeof socket !== "undefined" && socket) {
        socket.emit("playerReady");
      }
    };
    function turnOn() {
      freezeSync();
      mediaState.desyncLiveSeconds = null;
      mediaState.desyncLivePaused = false;
      try {
        socket.on("mediaUpdate", trackLiveRoomPosition);
      } catch (e) {
      }
      btn.classList.add("sc-desync-active");
      btn.title = "Free watch ON — click to re-sync";
      const bar = document.querySelector("#videowrap .vjs-control-bar .vjs-progress-control");
      if (bar && tvNavState.setFocus) tvNavState.setFocus(bar);
    }
    function turnOff() {
      try {
        socket.off("mediaUpdate", trackLiveRoomPosition);
      } catch (e) {
      }
      thawSync();
      mediaState.desyncLiveSeconds = null;
      btn.classList.remove("sc-desync-active");
      btn.title = "Free watch — click to watch freely";
    }
    btn.addEventListener("click", () => {
      if (typeof socket === "undefined" || !socket) return;
      desynced = !desynced;
      if (desynced) turnOn();
      else turnOff();
    });
    let _lastMediaKey = "";
    onSocket("changeMedia", (data) => {
      const key = (data && (data.id || "")) + "|" + (data && (data.title || ""));
      if (key === _lastMediaKey) return;
      _lastMediaKey = key;
      if (desynced) {
        desynced = false;
        turnOff();
      }
    });
  }
  function addFloatingButtons() {
    if (document.getElementById("fs-toggle-btn")) return;
    const fsBtn = document.createElement("button");
    fsBtn.id = "fs-toggle-btn";
    fsBtn.textContent = "⛶";
    fsBtn.title = "Toggle Fullscreen";
    fsBtn.addEventListener("click", () => {
      document.fullscreenElement ? document.exitFullscreen().catch(() => {
      }) : document.documentElement.requestFullscreen().catch(() => {
      });
    });
    document.body.appendChild(fsBtn);
    document.addEventListener("fullscreenchange", () => {
      fsBtn.style.display = document.fullscreenElement ? "none" : "";
    });
  }
  function addCastButton() {
    let onTv = false;
    try {
      onTv = !!(window.CytubeNative && CytubeNative.isTv && CytubeNative.isTv());
    } catch (e) {
    }
    if (onTv) return;
    if (document.getElementById("sc-cast-btn")) return;
    const btn = document.createElement("button");
    btn.id = "sc-cast-btn";
    btn.type = "button";
    btn.title = "Cast to TV";
    btn.dataset.tvLabel = "Cast";
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>';
    btn.addEventListener("click", function() {
      try {
        if (window.CytubeNative && CytubeNative.startCasting) CytubeNative.startCasting();
      } catch (e) {
      }
    });
    document.body.appendChild(btn);
  }

  // src/settings.js
  init_native();

  // src/chat/keyboard.js
  function isEditable(el) {
    return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT");
  }
  function labelFor(el) {
    if (!el) return "Text field";
    if (el.id === "sc-chat-textarea") return "Chat message";
    if (el.type === "password") return "Password";
    if (el.id === "sc-input-tmdb") return "TMDB API key";
    if (el.id === "username" || el.name === "username") return "Username";
    return "Text field";
  }
  function reportFocusedField() {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    try {
      if (window.CytubeNative && CytubeNative.setKeyboardFieldLabel) {
        CytubeNative.setKeyboardFieldLabel(labelFor(el), el.type === "password");
      }
    } catch (e) {
    }
  }
  function applyPhoneInput(text, commit) {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) {
      ["keydown", "keyup"].forEach((type) => {
        el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true }));
      });
    }
  }
  function initPhoneKeyboard(isTvDevice, recheckSoftKeyboard) {
    if (!isTvDevice) return;
    document.addEventListener("focusin", reportFocusedField);
    window.__scPhoneKeyboard = applyPhoneInput;
    setInterval(() => {
      try {
        recheckSoftKeyboard();
      } catch (e) {
      }
    }, 1e3);
  }

  // node_modules/qrcode-generator/dist/qrcode.mjs
  var qrcode = function(typeNumber, errorCorrectionLevel) {
    const PAD0 = 236;
    const PAD1 = 17;
    let _typeNumber = typeNumber;
    const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null;
    let _moduleCount = 0;
    let _dataCache = null;
    const _dataList = [];
    const _this = {};
    const makeImpl = function(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        const modules = new Array(moduleCount);
        for (let row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (let col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }
      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    };
    const setupPositionProbePattern = function(row, col) {
      for (let r = -1; r <= 7; r += 1) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c += 1) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };
    const getBestMaskPattern = function() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i += 1) {
        makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    };
    const setupTimingPattern = function() {
      for (let r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = r % 2 == 0;
      }
      for (let c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = c % 2 == 0;
      }
    };
    const setupPositionAdjustPattern = function() {
      const pos = QRUtil.getPatternPosition(_typeNumber);
      for (let i = 0; i < pos.length; i += 1) {
        for (let j = 0; j < pos.length; j += 1) {
          const row = pos[i];
          const col = pos[j];
          if (_modules[row][col] != null) {
            continue;
          }
          for (let r = -2; r <= 2; r += 1) {
            for (let c = -2; c <= 2; c += 1) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };
    const setupTypeNumber = function(test) {
      const bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };
    const setupTypeInfo = function(test, maskPattern) {
      const data = _errorCorrectionLevel << 3 | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }
      _modules[_moduleCount - 8][8] = !test;
    };
    const mapData = function(data, maskPattern) {
      let inc = -1;
      let row = _moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (let col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col -= 1;
        while (true) {
          for (let c = 0; c < 2; c += 1) {
            if (_modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) == 1;
              }
              const mask = maskFunc(row, col - c);
              if (mask) {
                dark = !dark;
              }
              _modules[row][col - c] = dark;
              bitIndex -= 1;
              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };
    const createBytes = function(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r += 1) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i += 1) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
        }
      }
      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }
      for (let i = 0; i < maxEcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }
      return data;
    };
    const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
      const buffer = qrBitBuffer();
      for (let i = 0; i < dataList.length; i += 1) {
        const data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }
      return createBytes(buffer, rsBlocks);
    };
    _this.addData = function(data, mode) {
      mode = mode || "Byte";
      let newData = null;
      switch (mode) {
        case "Numeric":
          newData = qrNumber(data);
          break;
        case "Alphanumeric":
          newData = qrAlphaNum(data);
          break;
        case "Byte":
          newData = qr8BitByte(data);
          break;
        case "Kanji":
          newData = qrKanji(data);
          break;
        default:
          throw "mode:" + mode;
      }
      _dataList.push(newData);
      _dataCache = null;
    };
    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + "," + col;
      }
      return _modules[row][col];
    };
    _this.getModuleCount = function() {
      return _moduleCount;
    };
    _this.make = function() {
      if (_typeNumber < 1) {
        let typeNumber2 = 1;
        for (; typeNumber2 < 40; typeNumber2++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
          const buffer = qrBitBuffer();
          for (let i = 0; i < _dataList.length; i++) {
            const data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
            data.write(buffer);
          }
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }
        _typeNumber = typeNumber2;
      }
      makeImpl(false, getBestMaskPattern());
    };
    _this.createTableTag = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      let qrHtml = "";
      qrHtml += '<table style="';
      qrHtml += " border-width: 0px; border-style: none;";
      qrHtml += " border-collapse: collapse;";
      qrHtml += " padding: 0px; margin: " + margin + "px;";
      qrHtml += '">';
      qrHtml += "<tbody>";
      for (let r = 0; r < _this.getModuleCount(); r += 1) {
        qrHtml += "<tr>";
        for (let c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += " border-width: 0px; border-style: none;";
          qrHtml += " border-collapse: collapse;";
          qrHtml += " padding: 0px; margin: 0px;";
          qrHtml += " width: " + cellSize + "px;";
          qrHtml += " height: " + cellSize + "px;";
          qrHtml += " background-color: ";
          qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
          qrHtml += ";";
          qrHtml += '"/>';
        }
        qrHtml += "</tr>";
      }
      qrHtml += "</tbody>";
      qrHtml += "</table>";
      return qrHtml;
    };
    _this.createSvgTag = function(cellSize, margin, alt, title) {
      let opts = {};
      if (typeof arguments[0] == "object") {
        opts = arguments[0];
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      alt = typeof alt === "string" ? { text: alt } : alt || {};
      alt.text = alt.text || null;
      alt.id = alt.text ? alt.id || "qrcode-description" : null;
      title = typeof title === "string" ? { text: title } : title || {};
      title.text = title.text || null;
      title.id = title.text ? title.id || "qrcode-title" : null;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let c, mc, r, mr, qrSvg = "", rect;
      rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
      qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
      qrSvg += ">";
      qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
      qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';
      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c)) {
            mc = c * cellSize + margin;
            qrSvg += "M" + mc + "," + mr + rect;
          }
        }
      }
      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += "</svg>";
      return qrSvg;
    };
    _this.createDataURL = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          const c = Math.floor((x - min) / cellSize);
          const r = Math.floor((y - min) / cellSize);
          return _this.isDark(r, c) ? 0 : 1;
        } else {
          return 1;
        }
      });
    };
    _this.createImgTag = function(cellSize, margin, alt) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let img = "";
      img += "<img";
      img += ' src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += ' width="';
      img += size;
      img += '"';
      img += ' height="';
      img += size;
      img += '"';
      if (alt) {
        img += ' alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += "/>";
      return img;
    };
    const escapeXml = function(s) {
      let escaped = "";
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charAt(i);
        switch (c) {
          case "<":
            escaped += "&lt;";
            break;
          case ">":
            escaped += "&gt;";
            break;
          case "&":
            escaped += "&amp;";
            break;
          case '"':
            escaped += "&quot;";
            break;
          default:
            escaped += c;
            break;
        }
      }
      return escaped;
    };
    const _createHalfASCII = function(margin) {
      const cellSize = 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r1, r2, p;
      const blocks = {
        "██": "█",
        "█ ": "▀",
        " █": "▄",
        "  ": " "
      };
      const blocksLastLineNoMargin = {
        "██": "▀",
        "█ ": "▀",
        " █": " ",
        "  ": " "
      };
      let ascii = "";
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = "█";
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = " ";
          }
          if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += " ";
          } else {
            p += "█";
          }
          ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
        }
        ascii += "\n";
      }
      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("▀");
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;
      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }
      cellSize -= 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r, p;
      const white = Array(cellSize + 1).join("██");
      const black = Array(cellSize + 1).join("  ");
      let ascii = "";
      let line = "";
      for (y = 0; y < size; y += 1) {
        r = Math.floor((y - min) / cellSize);
        line = "";
        for (x = 0; x < size; x += 1) {
          p = 1;
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }
          line += p ? white : black;
        }
        for (r = 0; r < cellSize; r += 1) {
          ascii += line + "\n";
        }
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      const length = _this.getModuleCount();
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? "black" : "white";
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    };
    return _this;
  };
  qrcode.stringToBytes = function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      bytes.push(c & 255);
    }
    return bytes;
  };
  qrcode.createStringToBytes = function(unicodeData, numChars) {
    const unicodeMap = function() {
      const bin = base64DecodeInputStream(unicodeData);
      const read = function() {
        const b = bin.read();
        if (b == -1) throw "eof";
        return b;
      };
      let count = 0;
      const unicodeMap2 = {};
      while (true) {
        const b0 = bin.read();
        if (b0 == -1) break;
        const b1 = read();
        const b2 = read();
        const b3 = read();
        const k = String.fromCharCode(b0 << 8 | b1);
        const v = b2 << 8 | b3;
        unicodeMap2[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + " != " + numChars;
      }
      return unicodeMap2;
    }();
    const unknownChar = "?".charCodeAt(0);
    return function(s) {
      const bytes = [];
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          const b = unicodeMap[s.charAt(i)];
          if (typeof b == "number") {
            if ((b & 255) == b) {
              bytes.push(b);
            } else {
              bytes.push(b >>> 8);
              bytes.push(b & 255);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };
  var QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3
  };
  var QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
  };
  var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  var QRUtil = function() {
    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    const _this = {};
    const getBCHDigit = function(data) {
      let digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };
    _this.getBCHTypeInfo = function(data) {
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
      }
      return (data << 10 | d) ^ G15_MASK;
    };
    _this.getBCHTypeNumber = function(data) {
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
      }
      return data << 12 | d;
    };
    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };
    _this.getMaskFunction = function(maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return function(i, j) {
            return (i + j) % 2 == 0;
          };
        case QRMaskPattern.PATTERN001:
          return function(i, j) {
            return i % 2 == 0;
          };
        case QRMaskPattern.PATTERN010:
          return function(i, j) {
            return j % 3 == 0;
          };
        case QRMaskPattern.PATTERN011:
          return function(i, j) {
            return (i + j) % 3 == 0;
          };
        case QRMaskPattern.PATTERN100:
          return function(i, j) {
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN101:
          return function(i, j) {
            return i * j % 2 + i * j % 3 == 0;
          };
        case QRMaskPattern.PATTERN110:
          return function(i, j) {
            return (i * j % 2 + i * j % 3) % 2 == 0;
          };
        case QRMaskPattern.PATTERN111:
          return function(i, j) {
            return (i * j % 3 + (i + j) % 2) % 2 == 0;
          };
        default:
          throw "bad maskPattern:" + maskPattern;
      }
    };
    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    };
    _this.getLengthInBits = function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10;
          case QRMode.MODE_ALPHA_NUM:
            return 9;
          case QRMode.MODE_8BIT_BYTE:
            return 8;
          case QRMode.MODE_KANJI:
            return 8;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12;
          case QRMode.MODE_ALPHA_NUM:
            return 11;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 10;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 14;
          case QRMode.MODE_ALPHA_NUM:
            return 13;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 12;
          default:
            throw "mode:" + mode;
        }
      } else {
        throw "type:" + type;
      }
    };
    _this.getLostPoint = function(qrcode2) {
      const moduleCount = qrcode2.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          let sameCount = 0;
          const dark = qrcode2.isDark(row, col);
          for (let r = -1; r <= 1; r += 1) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }
            for (let c = -1; c <= 1; c += 1) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }
              if (r == 0 && c == 0) {
                continue;
              }
              if (dark == qrcode2.isDark(row + r, col + c)) {
                sameCount += 1;
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }
      ;
      for (let row = 0; row < moduleCount - 1; row += 1) {
        for (let col = 0; col < moduleCount - 1; col += 1) {
          let count = 0;
          if (qrcode2.isDark(row, col)) count += 1;
          if (qrcode2.isDark(row + 1, col)) count += 1;
          if (qrcode2.isDark(row, col + 1)) count += 1;
          if (qrcode2.isDark(row + 1, col + 1)) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }
      let darkCount = 0;
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount; row += 1) {
          if (qrcode2.isDark(row, col)) {
            darkCount += 1;
          }
        }
      }
      const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    };
    return _this;
  }();
  var QRMath = function() {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i]] = i;
    }
    const _this = {};
    _this.glog = function(n) {
      if (n < 1) {
        throw "glog(" + n + ")";
      }
      return LOG_TABLE[n];
    };
    _this.gexp = function(n) {
      while (n < 0) {
        n += 255;
      }
      while (n >= 256) {
        n -= 255;
      }
      return EXP_TABLE[n];
    };
    return _this;
  }();
  var qrPolynomial = function(num, shift) {
    if (typeof num.length == "undefined") {
      throw num.length + "/" + shift;
    }
    const _num = function() {
      let offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      const _num2 = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i += 1) {
        _num2[i] = num[i + offset];
      }
      return _num2;
    }();
    const _this = {};
    _this.getAt = function(index) {
      return _num[index];
    };
    _this.getLength = function() {
      return _num.length;
    };
    _this.multiply = function(e) {
      const num2 = new Array(_this.getLength() + e.getLength() - 1);
      for (let i = 0; i < _this.getLength(); i += 1) {
        for (let j = 0; j < e.getLength(); j += 1) {
          num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return qrPolynomial(num2, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }
      const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      const num2 = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i += 1) {
        num2[i] = _this.getAt(i);
      }
      for (let i = 0; i < e.getLength(); i += 1) {
        num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      }
      return qrPolynomial(num2, 0).mod(e);
    };
    return _this;
  };
  var QRRSBlock = function() {
    const RS_BLOCK_TABLE = [
      // L
      // M
      // Q
      // H
      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],
      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],
      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],
      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],
      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],
      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],
      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],
      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],
      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],
      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],
      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],
      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],
      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],
      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],
      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],
      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],
      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],
      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],
      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],
      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],
      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],
      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],
      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],
      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],
      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],
      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],
      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],
      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],
      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],
      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],
      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];
    const qrRSBlock = function(totalCount, dataCount) {
      const _this2 = {};
      _this2.totalCount = totalCount;
      _this2.dataCount = dataCount;
      return _this2;
    };
    const _this = {};
    const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == "undefined") {
        throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
      }
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i += 1) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount));
        }
      }
      return list;
    };
    return _this;
  }();
  var qrBitBuffer = function() {
    const _buffer = [];
    let _length = 0;
    const _this = {};
    _this.getBuffer = function() {
      return _buffer;
    };
    _this.getAt = function(index) {
      const bufIndex = Math.floor(index / 8);
      return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
    };
    _this.put = function(num, length) {
      for (let i = 0; i < length; i += 1) {
        _this.putBit((num >>> length - i - 1 & 1) == 1);
      }
    };
    _this.getLengthInBits = function() {
      return _length;
    };
    _this.putBit = function(bit) {
      const bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }
      if (bit) {
        _buffer[bufIndex] |= 128 >>> _length % 8;
      }
      _length += 1;
    };
    return _this;
  };
  var qrNumber = function(data) {
    const _mode = QRMode.MODE_NUMBER;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const data2 = _data;
      let i = 0;
      while (i + 2 < data2.length) {
        buffer.put(strToNum(data2.substring(i, i + 3)), 10);
        i += 3;
      }
      if (i < data2.length) {
        if (data2.length - i == 1) {
          buffer.put(strToNum(data2.substring(i, i + 1)), 4);
        } else if (data2.length - i == 2) {
          buffer.put(strToNum(data2.substring(i, i + 2)), 7);
        }
      }
    };
    const strToNum = function(s) {
      let num = 0;
      for (let i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i));
      }
      return num;
    };
    const chatToNum = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      }
      throw "illegal char :" + c;
    };
    return _this;
  };
  var qrAlphaNum = function(data) {
    const _mode = QRMode.MODE_ALPHA_NUM;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const s = _data;
      let i = 0;
      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
          11
        );
        i += 2;
      }
      if (i < s.length) {
        buffer.put(getCode(s.charAt(i)), 6);
      }
    };
    const getCode = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      } else if ("A" <= c && c <= "Z") {
        return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
      } else {
        switch (c) {
          case " ":
            return 36;
          case "$":
            return 37;
          case "%":
            return 38;
          case "*":
            return 39;
          case "+":
            return 40;
          case "-":
            return 41;
          case ".":
            return 42;
          case "/":
            return 43;
          case ":":
            return 44;
          default:
            throw "illegal char :" + c;
        }
      }
    };
    return _this;
  };
  var qr8BitByte = function(data) {
    const _mode = QRMode.MODE_8BIT_BYTE;
    const _data = data;
    const _bytes = qrcode.stringToBytes(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _bytes.length;
    };
    _this.write = function(buffer) {
      for (let i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };
    return _this;
  };
  var qrKanji = function(data) {
    const _mode = QRMode.MODE_KANJI;
    const _data = data;
    const stringToBytes2 = qrcode.stringToBytes;
    !function(c, code) {
      const test = stringToBytes2(c);
      if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
        throw "sjis not supported.";
      }
    }("友", 38726);
    const _bytes = stringToBytes2(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };
    _this.write = function(buffer) {
      const data2 = _bytes;
      let i = 0;
      while (i + 1 < data2.length) {
        let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
        if (33088 <= c && c <= 40956) {
          c -= 33088;
        } else if (57408 <= c && c <= 60351) {
          c -= 49472;
        } else {
          throw "illegal char at " + (i + 1) + "/" + c;
        }
        c = (c >>> 8 & 255) * 192 + (c & 255);
        buffer.put(c, 13);
        i += 2;
      }
      if (i < data2.length) {
        throw "illegal char at " + (i + 1);
      }
    };
    return _this;
  };
  var byteArrayOutputStream = function() {
    const _bytes = [];
    const _this = {};
    _this.writeByte = function(b) {
      _bytes.push(b & 255);
    };
    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };
    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (let i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };
    _this.writeString = function(s) {
      for (let i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i));
      }
    };
    _this.toByteArray = function() {
      return _bytes;
    };
    _this.toString = function() {
      let s = "";
      s += "[";
      for (let i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ",";
        }
        s += _bytes[i];
      }
      s += "]";
      return s;
    };
    return _this;
  };
  var base64EncodeOutputStream = function() {
    let _buffer = 0;
    let _buflen = 0;
    let _length = 0;
    let _base64 = "";
    const _this = {};
    const writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode2(b & 63));
    };
    const encode2 = function(n) {
      if (n < 0) {
        throw "n:" + n;
      } else if (n < 26) {
        return 65 + n;
      } else if (n < 52) {
        return 97 + (n - 26);
      } else if (n < 62) {
        return 48 + (n - 52);
      } else if (n == 62) {
        return 43;
      } else if (n == 63) {
        return 47;
      } else {
        throw "n:" + n;
      }
    };
    _this.writeByte = function(n) {
      _buffer = _buffer << 8 | n & 255;
      _buflen += 8;
      _length += 1;
      while (_buflen >= 6) {
        writeEncoded(_buffer >>> _buflen - 6);
        _buflen -= 6;
      }
    };
    _this.flush = function() {
      if (_buflen > 0) {
        writeEncoded(_buffer << 6 - _buflen);
        _buffer = 0;
        _buflen = 0;
      }
      if (_length % 3 != 0) {
        const padlen = 3 - _length % 3;
        for (let i = 0; i < padlen; i += 1) {
          _base64 += "=";
        }
      }
    };
    _this.toString = function() {
      return _base64;
    };
    return _this;
  };
  var base64DecodeInputStream = function(str) {
    const _str = str;
    let _pos = 0;
    let _buffer = 0;
    let _buflen = 0;
    const _this = {};
    _this.read = function() {
      while (_buflen < 8) {
        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw "unexpected end of file./" + _buflen;
        }
        const c = _str.charAt(_pos);
        _pos += 1;
        if (c == "=") {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/)) {
          continue;
        }
        _buffer = _buffer << 6 | decode(c.charCodeAt(0));
        _buflen += 6;
      }
      const n = _buffer >>> _buflen - 8 & 255;
      _buflen -= 8;
      return n;
    };
    const decode = function(c) {
      if (65 <= c && c <= 90) {
        return c - 65;
      } else if (97 <= c && c <= 122) {
        return c - 97 + 26;
      } else if (48 <= c && c <= 57) {
        return c - 48 + 52;
      } else if (c == 43) {
        return 62;
      } else if (c == 47) {
        return 63;
      } else {
        throw "c:" + c;
      }
    };
    return _this;
  };
  var gifImage = function(width, height) {
    const _width = width;
    const _height = height;
    const _data = new Array(width * height);
    const _this = {};
    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };
    _this.write = function(out) {
      out.writeString("GIF87a");
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(128);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(255);
      out.writeByte(255);
      out.writeByte(255);
      out.writeString(",");
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);
      const lzwMinCodeSize = 2;
      const raster = getLZWRaster(lzwMinCodeSize);
      out.writeByte(lzwMinCodeSize);
      let offset = 0;
      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }
      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0);
      out.writeString(";");
    };
    const bitOutputStream = function(out) {
      const _out = out;
      let _bitLength = 0;
      let _bitBuffer = 0;
      const _this2 = {};
      _this2.write = function(data, length) {
        if (data >>> length != 0) {
          throw "length over";
        }
        while (_bitLength + length >= 8) {
          _out.writeByte(255 & (data << _bitLength | _bitBuffer));
          length -= 8 - _bitLength;
          data >>>= 8 - _bitLength;
          _bitBuffer = 0;
          _bitLength = 0;
        }
        _bitBuffer = data << _bitLength | _bitBuffer;
        _bitLength = _bitLength + length;
      };
      _this2.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };
      return _this2;
    };
    const getLZWRaster = function(lzwMinCodeSize) {
      const clearCode = 1 << lzwMinCodeSize;
      const endCode = (1 << lzwMinCodeSize) + 1;
      let bitLength = lzwMinCodeSize + 1;
      const table = lzwTable();
      for (let i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i));
      }
      table.add(String.fromCharCode(clearCode));
      table.add(String.fromCharCode(endCode));
      const byteOut = byteArrayOutputStream();
      const bitOut = bitOutputStream(byteOut);
      bitOut.write(clearCode, bitLength);
      let dataIndex = 0;
      let s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      while (dataIndex < _data.length) {
        const c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
        if (table.contains(s + c)) {
          s = s + c;
        } else {
          bitOut.write(table.indexOf(s), bitLength);
          if (table.size() < 4095) {
            if (table.size() == 1 << bitLength) {
              bitLength += 1;
            }
            table.add(s + c);
          }
          s = c;
        }
      }
      bitOut.write(table.indexOf(s), bitLength);
      bitOut.write(endCode, bitLength);
      bitOut.flush();
      return byteOut.toByteArray();
    };
    const lzwTable = function() {
      const _map = {};
      let _size = 0;
      const _this2 = {};
      _this2.add = function(key) {
        if (_this2.contains(key)) {
          throw "dup key:" + key;
        }
        _map[key] = _size;
        _size += 1;
      };
      _this2.size = function() {
        return _size;
      };
      _this2.indexOf = function(key) {
        return _map[key];
      };
      _this2.contains = function(key) {
        return typeof _map[key] != "undefined";
      };
      return _this2;
    };
    return _this;
  };
  var createDataURL = function(width, height, getPixel) {
    const gif = gifImage(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y));
      }
    }
    const b = byteArrayOutputStream();
    gif.write(b);
    const base64 = base64EncodeOutputStream();
    const bytes = b.toByteArray();
    for (let i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();
    return "data:image/gif;base64," + base64;
  };
  var qrcode_default = qrcode;
  var stringToBytes = qrcode.stringToBytes;

  // src/vendor/qr.js
  function encode(text) {
    for (let type = 1; type <= 40; type++) {
      try {
        const qr = qrcode_default(type, "M");
        qr.addData(text);
        qr.make();
        return qr;
      } catch (e) {
      }
    }
    throw new Error("QR encode failed: data too long");
  }
  function renderQrToCanvas(canvas, text, moduleSize = 6) {
    const qr = encode(text);
    const count = qr.getModuleCount();
    canvas.width = count * moduleSize;
    canvas.height = count * moduleSize;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }

  // src/update.js
  init_native();
  var LS_UPDATE_CACHE = "sc_update_cache";
  var GH_RELEASES_API = "https://api.github.com/repos/spudzareneat/grindhouse-tv/releases/latest";
  var GH_RELEASES_PAGE = "https://github.com/spudzareneat/grindhouse-tv/releases/latest";
  var _updateInfo = null;
  var _pulsedThisSession = false;
  var _highlightRetired = false;
  function _appVersion() {
    try {
      if (window.CytubeNative && CytubeNative.appVersion) return String(CytubeNative.appVersion() || "");
    } catch (e) {
    }
    return "";
  }
  function _verTuple(s) {
    const str = String(s || "");
    const m = str.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    const beta = str.match(/beta\.?(\d+)/i);
    const rc = str.match(/\brc\.?(\d+)/i);
    let stage = 2, num = 0;
    if (beta) {
      stage = 0;
      num = +beta[1] || 0;
    } else if (rc) {
      stage = 1;
      num = +rc[1] || 0;
    }
    return [
      m ? +m[1] || 0 : 0,
      m ? +m[2] || 0 : 0,
      m ? +m[3] || 0 : 0,
      stage,
      num
    ];
  }
  function _verNewer(a, b) {
    const x = _verTuple(a), y = _verTuple(b);
    for (let i = 0; i < 5; i++) {
      if (x[i] !== y[i]) return x[i] > y[i];
    }
    return false;
  }
  function _pickApkAsset(assets) {
    const list = Array.isArray(assets) ? assets : [];
    const found = list.find((a) => a && typeof a.name === "string" && a.name.endsWith(".apk"));
    if (!found) return null;
    return {
      url: found.browser_download_url || null,
      size: typeof found.size === "number" ? found.size : null
    };
  }
  function _markUpdateAvailable(on) {
    const btn = document.getElementById("sc-settings-btn");
    if (!btn) return;
    if (!on) {
      btn.classList.remove("sc-has-update", "sc-has-update-pulse");
      return;
    }
    if (_highlightRetired) return;
    btn.classList.add("sc-has-update");
    if (!_pulsedThisSession) {
      _pulsedThisSession = true;
      btn.classList.add("sc-has-update-pulse");
      setTimeout(() => {
        _highlightRetired = true;
        const b = document.getElementById("sc-settings-btn");
        if (b) b.classList.remove("sc-has-update", "sc-has-update-pulse");
      }, 3e4);
    }
  }
  async function checkForUpdate(force) {
    const current = _appVersion();
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(LS_UPDATE_CACHE) || "null");
        if (c && c.ts && Date.now() - c.ts < 6 * 3600 * 1e3) {
          _updateInfo = {
            available: _verNewer(c.tag, current),
            current,
            latest: c.tag,
            notes: c.notes || "",
            url: c.url || GH_RELEASES_PAGE,
            apkUrl: c.apkUrl || null,
            apkSize: c.apkSize || null
          };
          _markUpdateAvailable(_updateInfo.available);
          return _updateInfo;
        }
      } catch (e) {
      }
    }
    const res = await nativeHttpGet(GH_RELEASES_API, {
      "User-Agent": "GrindhouseTV-UpdateCheck",
      "Accept": "application/vnd.github+json"
    });
    if (!res || res.status < 200 || res.status >= 300) throw new Error("release lookup failed (" + (res && res.status) + ")");
    const rel = JSON.parse(res.body || "{}");
    const tag = rel.tag_name || rel.name || "";
    const notes = rel.body || "";
    const url = rel.html_url || GH_RELEASES_PAGE;
    const apkAsset = _pickApkAsset(rel.assets);
    const apkUrl = apkAsset && apkAsset.url;
    const apkSize = apkAsset && apkAsset.size;
    try {
      localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify({ ts: Date.now(), tag, notes, url, apkUrl, apkSize }));
    } catch (e) {
    }
    _updateInfo = { available: _verNewer(tag, current), current, latest: tag, notes, url, apkUrl, apkSize };
    _markUpdateAvailable(_updateInfo.available);
    return _updateInfo;
  }
  function initUpdateCheck() {
    setTimeout(() => {
      checkForUpdate(false).catch(() => {
      });
    }, 4e3);
  }

  // src/titleinject.js
  init_native();
  var NP_AUTO_HIDE_MS = isTv ? 1e4 : 8e3;
  var NP_AUTO_MIN_SECONDS = 45 * 60;
  function _npShouldAutoAnnounce(isYt) {
    return !isYt && getCurrentMediaSeconds() >= NP_AUTO_MIN_SECONDS;
  }
  function isYouTubeMedia() {
    try {
      const p = window.PLAYER || window.player;
      if (p && p.type === "yt") return true;
      if (p && p.mediaType === "yt") return true;
    } catch (e) {
    }
    if (document.querySelector('#ytapiplayer iframe[src*="youtube.com"]')) return true;
    if (document.querySelector('#ytapiplayer[src*="youtube.com"]')) return true;
    return false;
  }
  function _domYtVideoId() {
    const el = document.querySelector('#ytapiplayer iframe[src*="youtube.com"]');
    if (!el) return "";
    const src = el.getAttribute("src") || "";
    const m = src.match(/[?&]v=([\w-]{11})/) || src.match(/\/embed\/([\w-]{11})/);
    return m ? m[1] : "";
  }
  function fetchYtOembed(videoId) {
    if (!videoId) return Promise.resolve(null);
    const watchUrl = "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId);
    const url = "https://www.youtube.com/oembed?url=" + encodeURIComponent(watchUrl) + "&format=json";
    return nativeHttpGet(url).then((res) => {
      if (!res || res.status !== 200) return null;
      try {
        return JSON.parse(res.body);
      } catch (e) {
        return null;
      }
    }).catch(() => null);
  }
  function applyCleanTitleDom(titleEl, movieData) {
    const { cleanTitle, cleanYear } = movieData;
    if (!cleanTitle || !titleEl) return;
    const newText = cleanTitle + (cleanYear ? ` (${cleanYear})` : "");
    let span = titleEl.querySelector(":scope > #sc-title-text") || document.getElementById("sc-title-text");
    if (!span) {
      span = document.createElement("span");
      span.id = "sc-title-text";
      span.style.cursor = "pointer";
      span.title = "Movie info";
      span.dataset.noTvCaption = "1";
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        if (npState.data) showNowPlayingCard(npState.data, { autoHide: false });
      });
      const textNode = [...titleEl.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (textNode) textNode.parentNode.replaceChild(span, textNode);
      else titleEl.insertBefore(span, titleEl.firstChild);
    }
    span.textContent = newText;
  }
  function injectMovieLinks(titleEl) {
    const rawTitle = titleEl.textContent.trim().replace(/^currently\s+playing[:\s]*/i, "").replace(/^now\s+playing[:\s]*/i, "").trim();
    if (!rawTitle || rawTitle.length < 2) return;
    if (rawTitle === movieState.lastMovieTitle) {
      if (npState.data && !titleEl.querySelector("#sc-title-text")) {
        applyCleanTitleDom(titleEl, npState.data);
      }
      return;
    }
    movieState.lastMovieTitle = rawTitle;
    ["sc-movie-stats", "sc-trivia-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    npState.data = null;
    const isYt = isYouTubeMedia();
    let ytSeconds = 0;
    if (isYt) {
      ytSeconds = getCurrentMediaSeconds();
      if (ytSeconds < 3600) {
        const videoId = mediaState.currentYtVideoId || _domYtVideoId();
        if (videoId) {
          fetchYtOembed(videoId).then((info) => {
            if (!info || !info.title) return;
            if (movieState.lastMovieTitle !== rawTitle) return;
            const movieData = {
              cleanTitle: info.title,
              cleanYear: null,
              poster: info.thumbnail_url || null,
              backdrop: info.thumbnail_url || null,
              overview: info.author_name ? `Uploaded by ${info.author_name}` : null,
              rating: null,
              runtime: null,
              genres: [],
              parentalGuide: null,
              killCount: null,
              imdbId: null,
              links: {}
            };
            npState.data = movieData;
            applyCleanTitleDom(titleEl, movieData);
          });
        }
        return;
      }
    }
    const { title, year } = isYt ? parseYouTubeTitle(rawTitle) : parseMovieFilename(rawTitle);
    if (!title || title.length < 2) return;
    lookupMovie(title, year).then((movieData) => {
      const { killCount, parentalGuide, cleanTitle, cleanYear } = movieData;
      if (isYt) {
        if (!cleanTitle) return;
        if (movieData.runtime && ytSeconds) {
          const diff = Math.abs(movieData.runtime - ytSeconds / 60);
          if (diff > 30) return;
        }
      }
      npState.data = movieData;
      if (_npCardEnabled() && npState.introDone && _npShouldAutoAnnounce(isYt)) showNowPlayingCard(movieData, { autoHide: true, autoHideMs: NP_AUTO_HIDE_MS });
      applyCleanTitleDom(titleEl, movieData);
      const statParts = [];
      if (killCount !== null) statParts.push(`💀 ${killCount} on-screen kills`);
      if (parentalGuide && parentalGuide.length) {
        const PG_SEV_DOT = { Severe: "🔴", Moderate: "🟡", Mild: "🟢", None: "" };
        parentalGuide.forEach(({ category, severity }) => {
          const dot = PG_SEV_DOT[severity] || "";
          if (dot) statParts.push(`${dot} ${category}`);
        });
      }
      const lastAired = getLastAired(cleanTitle || title, cleanYear || year);
      if (lastAired) statParts.push(`📅 Last aired ${lastAired.dateStr}`);
      const old = document.getElementById("sc-movie-stats");
      if (old) old.remove();
      if (statParts.length) {
        const cardWillAutoShow = _npCardEnabled() && npState.introDone && _npShouldAutoAnnounce(isYt);
        const revealDelay = cardWillAutoShow ? NP_AUTO_HIDE_MS : 0;
        setTimeout(() => {
          if (movieState.lastMovieTitle !== rawTitle) return;
          const statsEl = document.createElement("div");
          statsEl.id = "sc-movie-stats";
          statsEl.textContent = statParts.join("  ·  ");
          document.body.appendChild(statsEl);
          if (typeof chromeState.pinChromeVisible === "function") chromeState.pinChromeVisible();
          setTimeout(() => {
            if (statsEl.parentNode) statsEl.remove();
            if (typeof chromeState.unpinChromeVisible === "function") chromeState.unpinChromeVisible();
          }, 12e3);
        }, revealDelay);
      }
    });
  }
  var _PLAYING_RE = /^\s*(currently|now)\s+playing\s*:?\s*/i;
  function stripPlayingPrefix(el) {
    el.querySelectorAll("strong, b, span, .label").forEach((c) => {
      if (c.childElementCount === 0 && /^\s*(currently|now)\s+playing\s*:?\s*$/i.test(c.textContent)) {
        c.style.display = "none";
      }
    });
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3 && _PLAYING_RE.test(n.textContent)) {
        n.textContent = n.textContent.replace(_PLAYING_RE, "");
      }
    });
  }
  function triggerTitleInject() {
    for (const el of [
      document.getElementById("currenttitle"),
      document.querySelector("#videowrap-header .pull-left"),
      document.querySelector("#videowrap-header span"),
      document.querySelector(".video-title")
    ]) {
      if (el && el.textContent.trim()) {
        stripPlayingPrefix(el);
        injectMovieLinks(el);
        return;
      }
    }
  }
  function watchMovieTitle() {
    triggerTitleInject();
    let tries = 0;
    const poll = setInterval(() => {
      triggerTitleInject();
      if (++tries >= 14) clearInterval(poll);
    }, 1500);
  }

  // src/cards/triviapopup.js
  var TP_POLL_MS = 3e3;
  var TP_GAP_TIERS = {
    frequent: [45 * 1e3, 90 * 1e3],
    occasional: [3 * 60 * 1e3, 6 * 60 * 1e3],
    rare: [8 * 60 * 1e3, 15 * 60 * 1e3]
  };
  function _tpGapRange() {
    return TP_GAP_TIERS[triviaPopupFrequency()] || TP_GAP_TIERS.occasional;
  }
  var TP_RETRY_MS = 20 * 1e3;
  var TP_VISIBLE_MS = 20 * 1e3;
  var TP_EXIT_ANIM_MS = 300;
  var TP_MAX_FACT_LEN = 280;
  var TP_PERSON_TRIVIA_CAP = 3;
  function _escHtml4(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  var _tpLastImdbId = void 0;
  var _tpQueue = [];
  var _tpExhausted = false;
  var _tpPopTimer = null;
  var _tpBubbleEl = null;
  var _tpDismissTimer = null;
  function _tpKnownForFact(person, knownFor) {
    if (!knownFor) return null;
    const titleYear = knownFor.year ? `${knownFor.title} (${knownFor.year})` : knownFor.title;
    if (person.role === "director") return `${person.name} is also known for ${titleYear}.`;
    const charPart = person.character ? ` (${person.character})` : "";
    return `${person.name}${charPart} also starred in ${titleYear}.`;
  }
  async function _tpBuildCastCrewItems(people, excludeTconst, excludeSeriesTconst) {
    const items = [];
    await Promise.all(people.map(async (person) => {
      const [trivia, knownFor] = await Promise.all([
        fetchPersonTrivia(person.nconst),
        fetchPersonKnownFor(person.nconst, excludeTconst, excludeSeriesTconst)
      ]);
      const byline = `${person.name} — ${person.role === "director" ? "Director" : person.character || "Cast"}`;
      trivia.filter((t) => t.length <= TP_MAX_FACT_LEN).slice(0, TP_PERSON_TRIVIA_CAP).forEach((t) => items.push({ text: t, byline }));
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
  function _tpResetForNewMovie(id) {
    clearTimeout(_tpPopTimer);
    _tpPopTimer = null;
    _tpDismissBubble(true);
    _tpQueue = [];
    _tpExhausted = false;
    if (!id) return;
    fetchImdbTrivia(id).then(async (items) => {
      if (id !== _tpLastImdbId) return;
      const movieItems = (items || []).map((text) => ({ text, byline: null }));
      _tpQueue = _tpShuffle(movieItems);
      _tpScheduleNextPop();
      if (!triviaPopupEnabled()) return;
      const result = await fetchCastAndDirector(id);
      if (id !== _tpLastImdbId) return;
      if (!result || !result.people.length) return;
      const castCrewItems = await _tpBuildCastCrewItems(result.people, id, result.seriesTconst);
      if (id !== _tpLastImdbId) return;
      if (!castCrewItems.length) return;
      _tpQueue = _tpShuffle(_tpQueue.concat(castCrewItems));
      if (_tpExhausted) {
        _tpExhausted = false;
        _tpScheduleNextPop();
      }
    });
  }
  function _tpScheduleNextPop() {
    clearTimeout(_tpPopTimer);
    if (_tpExhausted || !_tpQueue.length) {
      _tpExhausted = true;
      return;
    }
    const [minGap, maxGap] = _tpGapRange();
    const gap = minGap + Math.random() * (maxGap - minGap);
    _tpPopTimer = setTimeout(_tpAttemptPop, gap);
  }
  function _tpMoviePlaying() {
    if (isYouTubeMedia()) return false;
    const v = document.querySelector("#videowrap video");
    return !!v && !v.paused;
  }
  function _tpAttemptPop() {
    const curId = npState.data && npState.data.imdbId;
    if (curId !== _tpLastImdbId) return;
    if (!triviaPopupEnabled() || !_tpMoviePlaying()) {
      _tpPopTimer = setTimeout(_tpAttemptPop, TP_RETRY_MS);
      return;
    }
    let fact = null;
    while (_tpQueue.length) {
      const candidate = _tpQueue.shift();
      if (candidate.text.length <= TP_MAX_FACT_LEN) {
        fact = candidate;
        break;
      }
    }
    if (!fact) {
      _tpExhausted = true;
      return;
    }
    showTriviaBubble(fact);
    _tpScheduleNextPop();
  }
  function _tpMoviePollTick() {
    const curId = npState.data && npState.data.imdbId;
    if (curId !== _tpLastImdbId) {
      _tpLastImdbId = curId;
      _tpResetForNewMovie(_tpLastImdbId);
    }
  }
  function triviaPopupBoot() {
    _tpMoviePollTick();
    setInterval(_tpMoviePollTick, TP_POLL_MS);
  }
  var TP_ICONS = [
    // Skull + blood drip
    `<path d="M30 10 C19 10 12 18 12 27 C12 33 15 38 19 41 L19 47 L24 47 L24 43 L27 43 L27 47 L33 47 L33 43 L36 43 L36 47 L41 47 L41 41 C45 38 48 33 48 27 C48 18 41 10 30 10 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="22" cy="26" r="5" fill="#000"/>
     <circle cx="38" cy="26" r="5" fill="#000"/>
     <polygon points="30,30 27,36 33,36" fill="#000"/>
     <path d="M39 16 C39 16 43 22 41 27 C40 30 36 30 35 27 C33 23 39 16 39 16 Z"
          fill="#c81d25" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Cracked tombstone
    `<path d="M14 54 V30 C14 16 22 8 30 8 C38 8 46 16 46 30 V54 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <path d="M30 12 L26 26 L34 30 L28 44 L33 54" stroke="#000" stroke-width="2" fill="none"/>
     <line x1="30" y1="18" x2="30" y2="26" stroke="#000" stroke-width="2"/>
     <line x1="26" y1="21" x2="34" y2="21" stroke="#000" stroke-width="2"/>`,
    // Film reel
    `<circle cx="30" cy="30" r="18" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="30" cy="30" r="4" fill="#000"/>
     <circle cx="30" cy="16" r="4.5" fill="#000"/>
     <circle cx="30" cy="44" r="4.5" fill="#000"/>
     <circle cx="18" cy="23" r="4.5" fill="#000"/>
     <circle cx="18" cy="37" r="4.5" fill="#000"/>
     <circle cx="42" cy="23" r="4.5" fill="#000"/>
     <circle cx="42" cy="37" r="4.5" fill="#000"/>`,
    // --- Sci-fi (toxic-green #39d98a accent) ---
    // Flying saucer
    `<ellipse cx="30" cy="33" rx="22" ry="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <ellipse cx="30" cy="24" rx="11" ry="9" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="36" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>
     <circle cx="30" cy="38" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>
     <circle cx="42" cy="36" r="2.2" fill="#39d98a" stroke="#000" stroke-width="1.2"/>`,
    // Bug-eyed alien head
    `<path d="M30 6 C14 6 6 20 8 32 C10 44 20 54 30 54 C40 54 50 44 52 32 C54 20 46 6 30 6 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <ellipse cx="20" cy="27" rx="7" ry="10" fill="#000" transform="rotate(-15 20 27)"/>
     <ellipse cx="40" cy="27" rx="7" ry="10" fill="#000" transform="rotate(15 40 27)"/>
     <circle cx="20" cy="27" r="1.8" fill="#39d98a"/>
     <circle cx="40" cy="27" r="1.8" fill="#39d98a"/>`,
    // Rocket ship
    `<path d="M30 6 C24 6 20 14 20 24 V44 H40 V24 C40 14 36 6 30 6 Z"
          fill="#f4f1ea" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="30" cy="20" r="5" fill="#39d98a" stroke="#000" stroke-width="2"/>
     <polygon points="20,38 10,50 20,50" fill="#d8d8d8" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
     <polygon points="40,38 50,50 40,50" fill="#d8d8d8" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
     <path d="M24 44 C24 44 22 54 30 58 C38 54 36 44 36 44 Z"
          fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Robot head
    `<rect x="14" y="16" width="32" height="28" rx="4" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <line x1="30" y1="16" x2="30" y2="6" stroke="#000" stroke-width="2.5"/>
     <circle cx="30" cy="5" r="3" fill="#39d98a" stroke="#000" stroke-width="1.5"/>
     <circle cx="30" cy="28" r="7" fill="#000"/>
     <circle cx="30" cy="28" r="3" fill="#39d98a"/>
     <rect x="20" y="38" width="20" height="4" fill="#000"/>
     <circle cx="16" cy="20" r="2" fill="#3a2a1a"/>
     <circle cx="44" cy="20" r="2" fill="#3a2a1a"/>`,
    // Radioactive trefoil
    `<circle cx="30" cy="30" r="20" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(0 30 30)"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(120 30 30)"/>
     <path d="M30 30 L23 15 L37 15 Z" fill="#39d98a" stroke="#000" stroke-width="1.5" stroke-linejoin="round" transform="rotate(240 30 30)"/>
     <circle cx="30" cy="30" r="5" fill="#000"/>`,
    // --- Action (marquee-gold #e8b923 accent) ---
    // Explosion burst
    `<polygon points="30,4 35,19 48,12 41,25 56,30 41,35 48,48 35,41 30,56 25,41 12,48 19,35 4,30 19,25 12,12 25,19"
             fill="#e8b923" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
     <polygon points="30,16 33,24 40,20 36,27 44,30 36,33 40,40 33,36 30,44 27,36 20,40 25,33 16,30 25,27 20,20 27,25"
             fill="#c81d25" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Crosshair scope
    `<circle cx="30" cy="30" r="21" fill="#f4f1ea" stroke="#c81d25" stroke-width="4"/>
     <rect x="6" y="28" width="15" height="4" fill="#000"/>
     <rect x="39" y="28" width="15" height="4" fill="#000"/>
     <rect x="28" y="6" width="4" height="15" fill="#000"/>
     <rect x="28" y="39" width="4" height="15" fill="#000"/>
     <circle cx="30" cy="30" r="4" fill="#e8b923" stroke="#000" stroke-width="1.5"/>`,
    // Brass knuckles
    `<circle cx="14" cy="20" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="26" cy="18" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="38" cy="18" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <circle cx="50" cy="20" r="8" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <rect x="10" y="26" width="44" height="8" rx="3" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>`,
    // --- Comedy (marquee-gold #e8b923 accent) ---
    // Disco ball
    `<circle cx="30" cy="30" r="20" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <path d="M12 30 H48 M13 20 H47 M13 40 H47 M20 12 V48 M30 10 V50 M40 12 V48"
          stroke="#000" stroke-width="1.5" fill="none"/>
     <polyline points="46,10 50,6" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>
     <polyline points="50,14 55,12" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>
     <polyline points="44,6 47,2" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>`,
    // Boombox
    `<rect x="6" y="18" width="48" height="30" rx="5" fill="#3a2a1a" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="33" r="10" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="18" cy="33" r="4" fill="#000"/>
     <circle cx="42" cy="33" r="10" fill="#f4f1ea" stroke="#000" stroke-width="2.5"/>
     <circle cx="42" cy="33" r="4" fill="#000"/>
     <rect x="24" y="10" width="12" height="8" rx="2" fill="#e8b923" stroke="#000" stroke-width="2"/>`,
    // Aviator sunglasses
    `<ellipse cx="18" cy="30" rx="12" ry="10" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <ellipse cx="42" cy="30" rx="12" ry="10" fill="#d8d8d8" stroke="#000" stroke-width="2.5"/>
     <rect x="27" y="27" width="6" height="4" fill="#000"/>
     <line x1="6" y1="27" x2="0" y2="21" stroke="#000" stroke-width="3" stroke-linecap="round"/>
     <line x1="54" y1="27" x2="60" y2="21" stroke="#000" stroke-width="3" stroke-linecap="round"/>
     <polyline points="12,26 18,23" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>`
  ];
  function _tpRandomPosition(boxWidthPx, boxHeightPx) {
    const wrap = document.getElementById("videowrap");
    const rect = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    const marginPx = 14;
    const halfW = boxWidthPx / 2;
    let leftMinPx = rect.left + marginPx + halfW;
    let leftMaxPx = rect.left + rect.width - marginPx - halfW;
    if (leftMaxPx < leftMinPx) {
      const mid = rect.left + rect.width / 2;
      leftMinPx = leftMaxPx = mid;
    }
    const bottomThirdTopPx = rect.top + rect.height * (2 / 3);
    let topMinPx = Math.max(rect.top + marginPx, bottomThirdTopPx);
    let topMaxPx = rect.bottom - marginPx - boxHeightPx;
    if (topMaxPx < topMinPx) topMinPx = topMaxPx = Math.max(rect.top + marginPx, rect.bottom - marginPx - boxHeightPx);
    return {
      leftPx: leftMinPx + Math.random() * (leftMaxPx - leftMinPx),
      topPx: topMinPx + Math.random() * (topMaxPx - topMinPx)
    };
  }
  var _tpAudioCtx = null;
  function _tpGetAudioCtx() {
    if (!_tpAudioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      _tpAudioCtx = new Ctor();
    }
    if (_tpAudioCtx.state === "suspended") _tpAudioCtx.resume();
    return _tpAudioCtx;
  }
  function _tpNoiseBurst(ac, { start, dur, freq, q, peak }) {
    const size = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, size, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 3e-3);
    gain.gain.exponentialRampToValueAtTime(1e-4, start + dur);
    src.connect(bp).connect(gain).connect(ac.destination);
    src.start(start);
    src.stop(start + dur + 0.01);
  }
  function _tpBubbleTone(ac, { start, dur, freqStart, freqPeak, freqEnd, lpStart, lpEnd, q, peak }) {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(freqPeak, start + dur * 0.4);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = q;
    lp.frequency.setValueAtTime(lpStart, start);
    lp.frequency.exponentialRampToValueAtTime(lpEnd, start + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 6e-3);
    gain.gain.exponentialRampToValueAtTime(1e-4, start + dur);
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
    } catch (e) {
    }
  }
  function showTriviaBubble(fact) {
    _tpDismissBubble(true);
    _tpPlayPopSound();
    _tpBubbleEl = document.createElement("div");
    _tpBubbleEl.id = "sc-tp-bubble";
    const icon = TP_ICONS[Math.floor(Math.random() * TP_ICONS.length)];
    const bylineHtml = fact.byline ? `<div id="sc-tp-byline">${_escHtml4(fact.byline)}</div>` : "";
    _tpBubbleEl.innerHTML = `
        <svg id="sc-tp-tail" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="27" fill="#000"/>
            <circle cx="30" cy="30" r="27" fill="none" stroke="#c81d25" stroke-width="3"/>
            ${icon}
        </svg>
        <div id="sc-tp-text">${_escHtml4(fact.text)}${bylineHtml}</div>`;
    document.body.appendChild(_tpBubbleEl);
    const pos = _tpRandomPosition(_tpBubbleEl.offsetWidth, _tpBubbleEl.offsetHeight);
    _tpBubbleEl.style.setProperty("left", pos.leftPx + "px", "important");
    _tpBubbleEl.style.setProperty("top", pos.topPx + "px", "important");
    requestAnimationFrame(() => _tpBubbleEl && _tpBubbleEl.classList.add("sc-tp-in"));
    _tpBubbleEl.addEventListener("click", () => _tpDismissBubble(false));
    _tpBubbleEl.addEventListener("mouseenter", () => clearTimeout(_tpDismissTimer));
    _tpBubbleEl.addEventListener("mouseleave", _tpArmDismissTimer);
    _tpArmDismissTimer();
  }
  function _tpArmDismissTimer() {
    clearTimeout(_tpDismissTimer);
    _tpDismissTimer = setTimeout(() => _tpDismissBubble(false), TP_VISIBLE_MS);
  }
  function _tpDismissBubble(instant) {
    clearTimeout(_tpDismissTimer);
    _tpDismissTimer = null;
    if (!_tpBubbleEl) return;
    const el = _tpBubbleEl;
    _tpBubbleEl = null;
    if (instant) {
      el.remove();
      return;
    }
    el.classList.add("sc-tp-out");
    setTimeout(() => el.remove(), TP_EXIT_ANIM_MS);
  }

  // src/player/drive.js
  init_native();
  function initGoogleDrive() {
    const ITAG_QMAP = { 37: 1080, 46: 1080, 22: 720, 45: 720, 59: 480, 44: 480, 35: 480, 18: 360, 43: 360, 34: 360 };
    const ITAG_CMAP = {
      43: "video/webm",
      44: "video/webm",
      45: "video/webm",
      46: "video/webm",
      18: "video/mp4",
      22: "video/mp4",
      37: "video/mp4",
      59: "video/mp4",
      35: "video/flv",
      34: "video/flv"
    };
    let _gdProxyBase = "";
    try {
      if (window.CytubeNative && typeof CytubeNative.gdProxyBase === "function") {
        _gdProxyBase = CytubeNative.gdProxyBase();
      }
    } catch (e) {
    }
    function viaProxy(link) {
      return _gdProxyBase ? _gdProxyBase + encodeURIComponent(link) : link;
    }
    function mapLinks(links) {
      const videos = { 1080: [], 720: [], 480: [], 360: [] };
      Object.keys(links).forEach(function(itag) {
        itag = parseInt(itag, 10);
        if (!ITAG_QMAP.hasOwnProperty(itag)) return;
        videos[ITAG_QMAP[itag]].push({ itag, contentType: ITAG_CMAP[itag], link: viaProxy(links[itag]) });
      });
      return videos;
    }
    function getVideoInfo(id, cb) {
      const url = "https://docs.google.com/get_video_info?authuser=&docid=" + id + "&sle=true&hl=en";
      nativeHttpGet(url, { "Accept": "*/*", "User-Agent": navigator.userAgent }).then(function(res) {
        try {
          if (!res || res.status !== 200) {
            return cb("Google Drive request failed: HTTP " + (res ? res.status : "?"));
          }
          const text = res.body || "";
          if (/accounts\.google\.com\/ServiceLogin/.test(text)) {
            return cb("Google Docs request failed: This video requires you be logged into a Google account. Open your Gmail in another tab and then refresh video.");
          }
          const data = {};
          text.split("&").forEach(function(kv) {
            const pair = kv.split("=");
            data[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || "");
          });
          if (data.status === "fail") {
            return cb("Google Drive request failed: " + unescape(data.reason || "").replace(/\+/g, " "));
          }
          if (!data.fmt_stream_map) {
            return cb("Google has removed the video streams associated with this item.  It can no longer be played.");
          }
          data.links = {};
          data.fmt_stream_map.split(",").forEach(function(item) {
            const pair = item.split("|");
            data.links[pair[0]] = pair[1];
          });
          data.videoMap = mapLinks(data.links);
          cb(null, data);
        } catch (e) {
          cb("Google Drive parse error: " + (e && e.message ? e.message : e));
        }
      }).catch(function(e) {
        cb("Google Drive request failed: " + (e && e.message ? e.message : "network error"));
      });
    }
    window.__gdRealMeta = getVideoInfo;
    window.getGoogleDriveMetadata = getVideoInfo;
    window.hasDriveUserscript = true;
    window.driveUserscriptVersion = "1.7";
    if (Array.isArray(window.__gdQueue) && window.__gdQueue.length) {
      const queued = window.__gdQueue.splice(0);
      queued.forEach(function(p) {
        getVideoInfo(p[0], p[1]);
      });
    }
    console.log("[CyTube SC] Google Drive metadata helper ready");
  }

  // src/player/drm.js
  var drmState = { checkTimer: null };
  function openExternalUrl(url) {
    try {
      if (window.CytubeNative && typeof CytubeNative.openExternal === "function") {
        CytubeNative.openExternal(url);
      } else {
        window.open(url, "_blank");
      }
    } catch (e) {
    }
  }
  function hideDrmOverlay() {
    const o = document.getElementById("sc-drm-overlay");
    if (o) o.remove();
  }
  function showDrmOverlay(videoId, title) {
    hideDrmOverlay();
    const wrap = document.getElementById("videowrap") || document.body;
    if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    const url = "https://cytu.be/r/420Grindhouse";
    const safeTitle = (title || "This title").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
    const o = document.createElement("div");
    o.id = "sc-drm-overlay";
    o.innerHTML = '<div id="sc-drm-box"><div id="sc-drm-icon">🔒</div><div id="sc-drm-title">' + safeTitle + ' can’t play in the app</div><div id="sc-drm-msg">It’s a DRM-protected <b>YouTube Movies</b> title and the in-app player can’t decrypt it. Open <b>Grindhouse</b> in your browser — it plays there, with the room and chat still in sync.</div><div id="sc-drm-actions"><button id="sc-drm-open" class="sc-drm-btn">Open Grindhouse in Browser</button></div></div>';
    wrap.appendChild(o);
    const btn = document.getElementById("sc-drm-open");
    if (btn) btn.addEventListener("click", () => openExternalUrl(url));
  }
  function checkYtDrm(tries) {
    const p = window.PLAYER;
    if (!p || p.mediaType !== "yt") {
      hideDrmOverlay();
      return;
    }
    let vd = null;
    try {
      vd = p.yt && p.yt.getVideoData ? p.yt.getVideoData() : null;
    } catch (e) {
    }
    if (vd && vd.errorCode) {
      showDrmOverlay(vd.video_id, vd.title);
      return;
    }
    if ((tries || 0) < 10) {
      drmState.checkTimer = setTimeout(() => checkYtDrm((tries || 0) + 1), 1e3);
    }
  }

  // src/player/resync.js
  function initMediaWatcher() {
    if (typeof socket === "undefined" || !socket || typeof socket.on !== "function") {
      setTimeout(initMediaWatcher, 600);
      return;
    }
    let _lastMediaKey = "";
    let _lastChangeMediaData = null;
    let _roomPaused = false;
    let _resyncArmed = false;
    let _resyncTimer = null;
    const renderedDuration = () => {
      try {
        const p = window.PLAYER;
        if (p && p.yt && typeof p.yt.getDuration === "function") {
          const d = p.yt.getDuration();
          if (d > 0) return d;
        }
      } catch (e) {
      }
      try {
        const v = document.querySelector("#ytapiplayer video, video");
        if (v && v.duration > 0 && isFinite(v.duration)) return v.duration;
      } catch (e) {
      }
      return null;
    };
    const playheadProbe = () => {
      try {
        const p = window.PLAYER;
        if (p && p.yt && typeof p.yt.getCurrentTime === "function") {
          const t = p.yt.getCurrentTime();
          if (typeof t === "number") return t;
        }
      } catch (e) {
      }
      try {
        const v = document.querySelector("#ytapiplayer video, video");
        if (v && typeof v.currentTime === "number") return v.currentTime;
      } catch (e) {
      }
      return null;
    };
    const rebuildPlayer = (d) => {
      try {
        if (typeof loadMediaPlayer === "function" && d) loadMediaPlayer(d);
      } catch (e) {
      }
    };
    const maybeRebuildIfStale = () => {
      try {
        const d = _lastChangeMediaData;
        if (!d || _roomPaused) return;
        const expected = typeof d.seconds === "number" && d.seconds > 0 ? d.seconds : null;
        const rendered = renderedDuration();
        if (expected != null && rendered != null && Math.abs(rendered - expected) > 4) {
          rebuildPlayer(d);
          return;
        }
        const t1 = playheadProbe();
        if (t1 == null) return;
        setTimeout(() => {
          if (_roomPaused) return;
          const t2 = playheadProbe();
          if (t2 != null && Math.abs(t2 - t1) < 0.25) rebuildPlayer(d);
        }, 2e3);
      } catch (e) {
      }
    };
    let _reconnectWaitAttempts = 0;
    const MAX_RECONNECT_WAIT_ATTEMPTS = 6;
    const armStaleCheck = () => {
      if (typeof loadMediaPlayer !== "function") {
        location.reload();
        return;
      }
      _resyncArmed = true;
      clearTimeout(_resyncTimer);
      _resyncTimer = setTimeout(() => {
        if (!_resyncArmed) return;
        if (socket.connected === false) {
          if (++_reconnectWaitAttempts >= MAX_RECONNECT_WAIT_ATTEMPTS) {
            location.reload();
            return;
          }
          armStaleCheck();
          return;
        }
        _resyncArmed = false;
        _reconnectWaitAttempts = 0;
        maybeRebuildIfStale();
      }, 1e4);
    };
    window.__scStaleResync = armStaleCheck;
    socket.on("changeMedia", (data) => {
      try {
        _lastChangeMediaData = data;
        if (data && typeof data.paused === "boolean") _roomPaused = data.paused;
        if (_resyncArmed) {
          _resyncArmed = false;
          _reconnectWaitAttempts = 0;
          clearTimeout(_resyncTimer);
          setTimeout(maybeRebuildIfStale, 4e3);
        }
        mediaState.currentMediaSeconds = data && typeof data.seconds === "number" ? data.seconds : 0;
        mediaState.currentMediaType = data && data.type ? data.type : "";
        mediaState.currentYtVideoId = data && data.type === "yt" && data.id ? data.id : "";
        const key = (data && (data.id || "")) + "|" + (data && (data.title || ""));
        if (key !== _lastMediaKey) {
          _lastMediaKey = key;
          movieState.lastMovieTitle = "";
          npState.data = null;
          clearTimeout(drmState.checkTimer);
          hideDrmOverlay();
          if (mediaState.currentMediaType === "yt") drmState.checkTimer = setTimeout(() => checkYtDrm(0), 1500);
        }
        setTimeout(triggerTitleInject, 350);
      } catch (e) {
      }
    });
    socket.on("mediaUpdate", (data) => {
      if (data && typeof data.currentTime === "number") mediaState.currentPlaybackTime = data.currentTime;
      if (data && typeof data.paused === "boolean") _roomPaused = data.paused;
    });
    let _wasDisconnected = false;
    socket.on("disconnect", () => {
      _wasDisconnected = true;
    });
    socket.on("connect", () => {
      if (_wasDisconnected) {
        _wasDisconnected = false;
        armStaleCheck();
      }
    });
    setTimeout(() => {
      if (window.PLAYER && window.PLAYER.mediaType === "yt") checkYtDrm(0);
    }, 2500);
  }

  // src/player/ytscrubber.js
  var _el = null;
  var _timer = null;
  function ensureEl() {
    if (_el) return _el;
    _el = document.createElement("div");
    _el.id = "sc-yt-scrubber";
    _el.innerHTML = `
        <span id="sc-yt-scrubber-elapsed">0:00</span>
        <div id="sc-yt-scrubber-track"><div id="sc-yt-scrubber-fill"></div></div>
        <span id="sc-yt-scrubber-remain">-0:00</span>`;
    document.body.appendChild(_el);
    return _el;
  }
  function render() {
    if (document.querySelector("#videowrap .vjs-control-bar")) {
      if (_el) _el.style.display = "none";
      return;
    }
    const dur = getCurrentMediaSeconds();
    if (!(dur > 0)) {
      if (_el) _el.style.display = "none";
      return;
    }
    const el = ensureEl();
    el.style.display = "flex";
    const elapsed = Math.min(getCurrentPlaybackSeconds(), dur);
    const pct = Math.max(0, Math.min(100, elapsed / dur * 100));
    el.querySelector("#sc-yt-scrubber-fill").style.setProperty("width", pct + "%", "important");
    el.querySelector("#sc-yt-scrubber-elapsed").textContent = formatHMS(elapsed);
    el.querySelector("#sc-yt-scrubber-remain").textContent = "-" + formatHMS(dur - elapsed);
  }
  function initYtScrubber() {
    if (_timer) return;
    render();
    _timer = setInterval(render, 500);
  }

  // src/player/seekhud.js
  var _el2 = null;
  var _timer2 = null;
  function isDesyncActive() {
    const b = document.getElementById("sc-desync-btn");
    return !!(b && b.classList.contains("sc-desync-active"));
  }
  function ensureEl2() {
    if (_el2) return _el2;
    _el2 = document.createElement("div");
    _el2.id = "sc-seek-hud";
    _el2.innerHTML = `
        <span id="sc-seek-hud-pos">0:00 / 0:00</span>
        <span id="sc-seek-hud-live"></span>`;
    document.body.appendChild(_el2);
    return _el2;
  }
  function render2() {
    if (!isDesyncActive() || !document.querySelector("#videowrap .vjs-control-bar")) {
      if (_el2) _el2.style.display = "none";
      return;
    }
    const dur = getCurrentMediaSeconds();
    const pos = getCurrentPlaybackSeconds();
    if (!(dur > 0)) {
      if (_el2) _el2.style.display = "none";
      return;
    }
    const el = ensureEl2();
    el.style.display = "flex";
    el.querySelector("#sc-seek-hud-pos").textContent = `${formatHMS(pos)} / ${formatHMS(dur)}`;
    const live = getDesyncLiveSeconds();
    const liveEl = el.querySelector("#sc-seek-hud-live");
    if (live == null) {
      liveEl.textContent = "";
    } else {
      const behind = Math.max(0, live - pos);
      liveEl.textContent = behind < 1 ? "at live" : `${formatHMS(behind)} behind live`;
    }
  }
  function initSeekHud() {
    if (_timer2) return;
    render2();
    _timer2 = setInterval(render2, 500);
  }

  // src/player/leadtime.js
  var MOVIE_LEAD_MIN = 0;
  var MOVIE_LEAD_MAX = 10;
  var MOVIE_LEAD_DEFAULT = 2;
  function getMovieLeadSec() {
    const v = parseInt(getKey(LS_MOVIE_LEAD), 10);
    return Number.isFinite(v) && v >= MOVIE_LEAD_MIN && v <= MOVIE_LEAD_MAX ? v : MOVIE_LEAD_DEFAULT;
  }
  function setMovieLeadSec(v) {
    const clamped = Math.min(MOVIE_LEAD_MAX, Math.max(MOVIE_LEAD_MIN, Number.isFinite(v) ? v : MOVIE_LEAD_DEFAULT));
    setKey(LS_MOVIE_LEAD, String(clamped));
    return clamped;
  }
  function installMovieLeadInterceptor() {
    const loc = getMediaUpdateListeners();
    if (!loc) {
      console.log("[Grindhouse] movie-lead: mediaUpdate listeners not found yet, will retry");
      return false;
    }
    const original = loc.store === "_callbacks" ? socket._callbacks[loc.key] : socket._events[loc.key];
    const originalList = Array.isArray(original) ? original : original ? [original] : [];
    console.log(`[Grindhouse] movie-lead: installing interceptor via ${loc.store}, wrapping ${originalList.length} existing listener(s)`);
    function interceptor(data) {
      try {
        const lead = getMovieLeadSec();
        if (lead > 0 && !isYouTubeMedia() && typeof (data == null ? void 0 : data.currentTime) === "number") {
          data.currentTime += lead;
        }
      } catch (e) {
      }
      for (const fn of originalList) fn(data);
    }
    if (loc.store === "_callbacks") socket._callbacks[loc.key] = [interceptor];
    else socket._events[loc.key] = interceptor;
    return true;
  }
  function initMovieLeadOffset() {
    let tries = 0;
    const poll = setInterval(() => {
      if (typeof socket === "undefined" || !socket) {
        if (++tries >= 14) {
          console.log("[Grindhouse] movie-lead: gave up, socket never became available");
          clearInterval(poll);
        }
        return;
      }
      const ok = installMovieLeadInterceptor();
      if (ok) {
        console.log("[Grindhouse] movie-lead: interceptor installed successfully");
      }
      if (ok || ++tries >= 14) {
        if (!ok) console.log("[Grindhouse] movie-lead: gave up after max retries, interceptor not installed");
        clearInterval(poll);
      }
    }, 1500);
  }

  // src/chat/imageembed.js
  init_native();
  var IMAGE_LINK_RE = /\.(jpe?g|png|gif|webp|bmp)(\?[^\s"']*)?$/i;
  var IMAGE_HOST_ALLOWLIST = ["postimg.cc", "ibb.co", "prnt.sc"];
  var LS_BANNED = "sc_img_banned_urls";
  var _cachedEmoteHeight = 0;
  function emoteInlineHeight() {
    const els = document.querySelectorAll("#messagebuffer .channel-emote, #messagebuffer .emote");
    let maxH = 0;
    els.forEach((el) => {
      const h = el.getBoundingClientRect().height;
      if (h > maxH) maxH = h;
    });
    if (maxH > 4) _cachedEmoteHeight = Math.round(maxH);
    return _cachedEmoteHeight > 4 ? _cachedEmoteHeight : 48;
  }
  function getBannedUrls() {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_BANNED) || "[]"));
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  }
  function saveBannedUrls(set) {
    try {
      localStorage.setItem(LS_BANNED, JSON.stringify([...set]));
    } catch (e) {
    }
  }
  function isBanned(url) {
    return getBannedUrls().has(url);
  }
  function isImageHostPage(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return IMAGE_HOST_ALLOWLIST.includes(host);
    } catch (e) {
      return false;
    }
  }
  function filenameFromUrl(url) {
    try {
      const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
      return seg ? decodeURIComponent(seg) : url;
    } catch (e) {
      return url;
    }
  }
  function extractOgImage(html) {
    let m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (!m) m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return m ? m[1] : null;
  }
  function resolveOgImage(pageUrl) {
    return nativeHttpGet(pageUrl).then((res) => {
      if (!res || res.status !== 200) return null;
      const raw = extractOgImage(res.body || "");
      if (!raw) return null;
      try {
        return new URL(raw, pageUrl).href;
      } catch (e) {
        return null;
      }
    }).catch(() => null);
  }
  var ogImageCache = /* @__PURE__ */ new Map();
  function resolveOgImageCached(url) {
    if (!ogImageCache.has(url)) {
      const p = resolveOgImage(url);
      p.then((result) => {
        if (result === null) ogImageCache.delete(url);
      });
      ogImageCache.set(url, p);
    }
    return ogImageCache.get(url);
  }
  function findImageLinks(msgEl) {
    return [...msgEl.querySelectorAll("a[href]")].filter((a) => !a.dataset.scEmbedded && !a.closest(".sc-img-embed") && (a.protocol === "http:" || a.protocol === "https:") && IMAGE_LINK_RE.test(a.href));
  }
  function findImageHostPageLinks(msgEl) {
    return [...msgEl.querySelectorAll("a[href]")].filter((a) => !a.dataset.scEmbedded && !a.closest(".sc-img-embed") && (a.protocol === "http:" || a.protocol === "https:") && isImageHostPage(a.href));
  }
  function rescrollChatIfNearBottom() {
    const b = document.getElementById("messagebuffer");
    if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 60) b.scrollTop = b.scrollHeight;
  }
  function buildEmbed(a, initialSrc) {
    a.style.display = "none";
    const wrap = document.createElement("div");
    wrap.className = "sc-img-embed";
    const link = document.createElement("a");
    link.href = a.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.style.setProperty("max-height", Math.round(emoteInlineHeight() * 1.25) + "px", "important");
    link.appendChild(img);
    const badge = document.createElement("span");
    badge.className = "sc-img-embed-badge";
    const badgeLabel = document.createElement("span");
    badgeLabel.textContent = initialSrc ? "🖼 embedded" : "🖼 loading…";
    const toggleBtn = document.createElement("span");
    toggleBtn.className = "sc-img-embed-toggle";
    toggleBtn.textContent = "🔗";
    toggleBtn.title = "Show link instead of image";
    toggleBtn.addEventListener("click", () => {
      const showingImage = link.style.display !== "none";
      link.style.display = showingImage ? "none" : "";
      a.style.display = showingImage ? "" : "none";
      badgeLabel.textContent = showingImage ? "🔗 link only" : "🖼 embedded";
      toggleBtn.title = showingImage ? "Show image instead of link" : "Show link instead of image";
    });
    const banBtn = document.createElement("span");
    banBtn.className = "sc-img-embed-ban";
    banBtn.textContent = "🚫";
    banBtn.title = "Hide this image everywhere and don't embed it again";
    banBtn.addEventListener("click", () => banUrl(a.href));
    badge.appendChild(badgeLabel);
    badge.appendChild(toggleBtn);
    badge.appendChild(banBtn);
    wrap.appendChild(link);
    wrap.appendChild(badge);
    if (initialSrc) {
      img.title = filenameFromUrl(initialSrc);
      img.onerror = () => {
        wrap.remove();
        a.style.display = "";
      };
      img.onload = rescrollChatIfNearBottom;
      img.src = initialSrc;
    }
    return { wrap, link, img, badgeLabel };
  }
  function applyEmbeddedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    const { wrap } = buildEmbed(a, a.href);
    msgEl.appendChild(wrap);
    a._scUi = wrap;
    rescrollChatIfNearBottom();
  }
  function applyResolvedEmbedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    const { wrap, link, img, badgeLabel } = buildEmbed(a, null);
    msgEl.appendChild(wrap);
    a._scUi = wrap;
    resolveOgImageCached(a.href).then((imgUrl) => {
      if (!wrap.isConnected) return;
      if (!imgUrl) {
        wrap.remove();
        a.style.display = "";
        if (a._scUi === wrap) a._scUi = null;
        return;
      }
      link.href = imgUrl;
      img.title = filenameFromUrl(imgUrl);
      img.onerror = () => {
        wrap.remove();
        a.style.display = "";
      };
      img.onload = rescrollChatIfNearBottom;
      img.src = imgUrl;
      badgeLabel.textContent = "🖼 embedded";
      rescrollChatIfNearBottom();
    });
  }
  function applyBannedState(a) {
    const msgEl = a.closest('[class*="chat-msg-"]');
    if (!msgEl) return;
    a.style.display = "";
    const badge = document.createElement("span");
    badge.className = "sc-img-embed-badge sc-img-embed-banned";
    const label = document.createElement("span");
    label.textContent = "🚫 image hidden";
    const unbanBtn = document.createElement("span");
    unbanBtn.className = "sc-img-embed-unban";
    unbanBtn.textContent = "↩ unban";
    unbanBtn.title = "Show this image again";
    unbanBtn.addEventListener("click", () => unbanUrl(a.href));
    badge.appendChild(label);
    badge.appendChild(unbanBtn);
    msgEl.appendChild(badge);
    a._scUi = badge;
  }
  function sweepUrl(url, applyFn) {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    buf.querySelectorAll("a[data-sc-embedded]").forEach((a) => {
      if (a.href !== url) return;
      if (a._scUi) a._scUi.remove();
      applyFn(a);
    });
  }
  function banUrl(url) {
    const set = getBannedUrls();
    set.add(url);
    saveBannedUrls(set);
    sweepUrl(url, applyBannedState);
  }
  function unbanUrl(url) {
    const set = getBannedUrls();
    set.delete(url);
    saveBannedUrls(set);
    sweepUrl(url, isImageHostPage(url) ? applyResolvedEmbedState : applyEmbeddedState);
  }
  function renderLink(a) {
    a.dataset.scEmbedded = "1";
    if (isBanned(a.href)) applyBannedState(a);
    else applyEmbeddedState(a);
  }
  function renderHostPageLink(a) {
    a.dataset.scEmbedded = "1";
    if (isBanned(a.href)) applyBannedState(a);
    else applyResolvedEmbedState(a);
  }
  function scanImageEmbeds(buf) {
    if (!autoEmbedEnabled()) return;
    buf.querySelectorAll('[class*="chat-msg-"]').forEach((msgEl) => {
      findImageLinks(msgEl).forEach(renderLink);
      findImageHostPageLinks(msgEl).forEach(renderHostPageLink);
    });
  }
  var _imageEmbedObserverStarted = false;
  function startImageEmbedObserver() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    if (_imageEmbedObserverStarted) {
      scanImageEmbeds(buf);
      return;
    }
    _imageEmbedObserverStarted = true;
    new MutationObserver(() => scanImageEmbeds(buf)).observe(buf, { childList: true, subtree: true });
    scanImageEmbeds(buf);
  }

  // src/chat/linkpip.js
  function findQualifyingLinks(msgEl) {
    return [...msgEl.querySelectorAll("a[href]")].filter((a) => !a.dataset.scPipChecked && (a.protocol === "http:" || a.protocol === "https:") && isPipLink(a.href));
  }
  function isOverlayCurrentlyOpen() {
    const checks = [
      ["sc-settings-overlay", null],
      ["sc-modal-overlay", null],
      ["sc-trivia-card", "sc-show"],
      ["sc-users-panel", null],
      ["sc-poll-panel", null],
      ["sc-np-card", "sc-np-visible"],
      ["sc-upnext-card", "sc-upnext-visible"],
      ["sc-link-pip-panel", "sc-link-pip-visible"],
      ["sc-lineup-screen", "sc-lineup-visible"]
    ];
    return checks.some(([id, cls]) => {
      const el = document.getElementById(id);
      if (!el || getComputedStyle(el).display === "none") return false;
      if (cls && !el.classList.contains(cls)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 3 && r.height > 3;
    });
  }
  var promptEl = null;
  var promptTimer = null;
  var pendingUrl = null;
  var _prevFocusEl = null;
  function buildPrompt() {
    const el = document.createElement("div");
    el.id = "sc-link-pip-prompt";
    el.innerHTML = `<button id="sc-link-pip-prompt-btn" type="button">
        <span class="sc-lpp-label">New video</span>
        <span class="sc-lpp-action">View this?</span>
    </button>`;
    document.body.appendChild(el);
    el.querySelector("#sc-link-pip-prompt-btn").addEventListener("click", confirmLinkPip);
    return el;
  }
  function dismissLinkPipPrompt() {
    if (!promptEl) return;
    clearTimeout(promptTimer);
    const btn = promptEl.querySelector("button");
    promptEl.classList.remove("sc-show");
    pendingUrl = null;
    if (_prevFocusEl && document.activeElement === btn && tvNavState.setFocus && _prevFocusEl.isConnected) {
      tvNavState.setFocus(_prevFocusEl);
    }
    _prevFocusEl = null;
  }
  function confirmLinkPip() {
    const url = pendingUrl;
    clearTimeout(promptTimer);
    if (promptEl) promptEl.classList.remove("sc-show");
    pendingUrl = null;
    _prevFocusEl = null;
    if (url) openLinkPip(url);
  }
  function showLinkPipPrompt(url) {
    pendingUrl = url;
    if (!promptEl) promptEl = buildPrompt();
    promptEl.classList.add("sc-show");
    clearTimeout(promptTimer);
    promptTimer = setTimeout(dismissLinkPipPrompt, 7e3);
    if (!isOverlayCurrentlyOpen() && tvNavState.setFocus) {
      _prevFocusEl = document.querySelector(".sc-tv-focus");
      tvNavState.setFocus(promptEl.querySelector("button"));
    } else {
      _prevFocusEl = null;
    }
  }
  var _linkPipObserverStarted = false;
  function startLinkPipObserver() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    if (_linkPipObserverStarted) return;
    _linkPipObserverStarted = true;
    tvNavState.preBackHooks.push(() => {
      if (promptEl && promptEl.classList.contains("sc-show")) {
        dismissLinkPipPrompt();
        return true;
      }
      return false;
    });
    new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1 || !node.matches || !node.matches('[class*="chat-msg-"]')) return;
        const link = findQualifyingLinks(node)[0];
        if (link) {
          link.dataset.scPipChecked = "1";
          showLinkPipPrompt(link.href);
        }
      }));
    }).observe(buf, { childList: true });
  }

  // src/channelscript.js
  function initChannelScriptAutoApprove() {
    const KEY = "channel_js_pref";
    function seedPrefs() {
      const name = window.CHANNEL && CHANNEL.name && CHANNEL.name.toLowerCase();
      if (!name) return false;
      let prefs;
      try {
        prefs = JSON.parse(localStorage.getItem(KEY)) || {};
      } catch (e) {
        prefs = {};
      }
      prefs[name + "_embedded"] = "ALLOW";
      prefs[name + "_external"] = "ALLOW";
      localStorage.setItem(KEY, JSON.stringify(prefs));
      if (window.JSPREF && typeof window.JSPREF === "object") {
        window.JSPREF[name + "_embedded"] = "ALLOW";
        window.JSPREF[name + "_external"] = "ALLOW";
      }
      return true;
    }
    function dismissPromptIfShown() {
      const allow = document.getElementById("chanjs-allow");
      if (!allow) return;
      const remember = document.getElementById("chanjs-save-pref");
      if (remember) remember.checked = true;
      allow.click();
    }
    seedPrefs();
    dismissPromptIfShown();
    let tick = 0;
    const timer = setInterval(() => {
      seedPrefs();
      dismissPromptIfShown();
      if (++tick > 40) clearInterval(timer);
    }, 500);
  }

  // src/styles/base.css
  var base_default = `
            /* ===== SHARED HIDDEN ELEMENTS ===== */
            nav.navbar, #drinkbarwrap, #announcements, #playlistrow,
            #resizewrap, footer, #userlisttoggle, #rightcontrols,
            .modal-header, .timestamp, .modal-footer { display: none !important; }
            body { background-image: none !important; background: #000 !important; }
            .modal, .popover, .dropdown-menu { z-index: 20001 !important; }
            .modal-dialog { margin: 0 auto !important; }

            /* Video tap-to-wake interceptor.
               z-index 10000 = above the video (9999) but below all controls (10001+).
               pointer-events:none normally so video controls work; flips to auto only
               when the top bar is dimmed (sc-video-dimmed on body), intercepting the
               first tap to reveal chrome. Works for iframes (YouTube/Drive) where
               document-level click listeners never receive iframe taps. */
            #sc-video-tap {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 79vw !important; height: 100vh !important;
                z-index: 10000 !important; pointer-events: none !important;
                -webkit-tap-highlight-color: transparent !important;
                cursor: pointer !important;
            }
            body.sc-vertical #sc-video-tap { width: 100vw !important; height: 55vh !important; }
            body.sc-chat-hidden #sc-video-tap, body.sc-chat-subtitles #sc-video-tap { width: 100vw !important; height: 100vh !important; }
            body.sc-chat-overlay.sc-horizontal #sc-video-tap { width: 100vw !important; }
            body.sc-video-dimmed #sc-video-tap { pointer-events: auto !important; }
            #resize-video-smaller, #resize-video-larger { display: none !important; }
            /* Remove pause and fullscreen from video.js control bar */
            .video-js .vjs-play-control { display: none !important; }
            .video-js .vjs-fullscreen-control { display: none !important; }
            /* Userlist — hidden but fully rendered so all users appear in DOM */
            #userlist {
                visibility: hidden !important;
                position: absolute !important;
                pointer-events: none !important;
                height: auto !important;
                overflow: hidden !important;
            }
            #userlisttoggle { display: none !important; }
            /* ── TOP BAR SYSTEM ────────────────────────────────────────────────────
               A single gradient band overlays the top of the video.
               After a few seconds the gradient, icons and Coming Attractions
               fade out leaving only the title. Mouse-over restores everything.
               If the poster strip is open nothing fades.

               States driven by .sc-bar-dim on #sc-top-bar:
                 (no class)    = fully visible
                 .sc-bar-dim   = gradient/icons/toggle faded, title stays
            ─────────────────────────────────────────────────────────────────── */

            /* Gradient overlay behind the whole bar */
            /* Gradient starts below the header row so it never alpha-composites
               over the title/pills/toggle — those have their own background */
            #sc-top-bar {
                position: fixed !important;
                top: 20px !important; /* start below the header bar */
                left: 0 !important;
                width: 80vw !important; height: 40px !important;
                z-index: 10001 !important; /* above video */
                pointer-events: none !important;
                background: linear-gradient(
                    to bottom,
                    rgba(0,0,0,0.35) 0%,
                    rgba(0,0,0,0)    100%
                ) !important;
                transition: opacity 1.5s ease !important;
                opacity: 1 !important;
            }
            /* Vertical: title bar is a solid strip — no gradient overlay needed */
            body.sc-vertical #sc-top-bar { display: none !important; }
            #sc-top-bar.sc-bar-dim { opacity: 0 !important; }

            /* Header — dark background fades out with gradient when dimmed */
            #videowrap-header {
                border: 0 !important;
                background: rgba(0,0,0,0.55) !important;
                padding: 3px 8px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                color: #fff !important;
                text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.9) !important;
                letter-spacing: 0.01em !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                width: 80vw !important;
                box-sizing: border-box !important;
                position: fixed !important;
                top: 0 !important; left: 0 !important;
                z-index: 10002 !important;
                pointer-events: auto !important;
                transition: background 1.5s ease, color 1.5s ease, text-shadow 1.5s ease !important;
            }
            #videowrap-header.sc-bar-dim {
                background: transparent !important;
                color: rgba(255,255,255,0.32) !important;
                text-shadow: none !important;
            }
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
            /* CyTube's title wrapper is #currenttitle on some rooms/skins and .pull-left on
               others -- titleinject.js's triggerTitleInject() already tries both selectors
               for that reason (see its own comment). Missing #currenttitle here meant the
               title never got flex-grow on this room, so it sat at its own narrow content
               width and #sc-poster-toggle/#sc-up-next-btn just trailed immediately after it
               instead of being pushed to the header's right edge. */
            body.sc-vertical #videowrap-header .pull-left,
            body.sc-vertical #videowrap-header #currenttitle {
                flex: 1 1 auto !important;
                min-width: 0 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            /* Title bar dims text but keeps its solid background */
            body.sc-vertical #videowrap-header.sc-bar-dim {
                background: rgba(12,10,20,0.92) !important;
                color: rgba(255,255,255,0.35) !important;
                text-shadow: none !important;
            }
            /* Hide the "Currently Playing:" prefix label */
            /* Hide CyTube's original usercount */
            #usercount { display: none !important; }

            /* Chat header bar — sits above #chatwrap */
            #sc-chat-header {
                position: fixed !important;
                top: 0 !important; right: 5px !important;
                width: calc(19vw - 5px) !important; height: 28px !important;
                z-index: 10003 !important;
                background: rgba(0,0,0,0.7) !important;
                border: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 0 8px !important;
                box-sizing: border-box !important;
            }
            /* Vertical: chat header repositioned into the left side of the control band */
            body.sc-vertical #sc-chat-header {
                display: flex !important;
                position: fixed !important;
                left: 0 !important; right: auto !important; width: auto !important;
                top: calc(var(--sc-split, 50) * 1vh) !important; height: 44px !important; bottom: auto !important;
                background: transparent !important;
                z-index: 10001 !important;
                padding: 0 12px !important;
                border: none !important; box-shadow: none !important;
            }
            #sc-usercount-btn { display: flex !important; align-items: center !important; }
            .sc-usercount-part, #sc-poll-btn {
                background: transparent !important;
                border: none !important;
                font-size: 10px !important;
                font-weight: 700 !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                color: rgba(255,255,255,0.5) !important;
                cursor: pointer !important;
                padding: 0 4px !important;
                font-family: inherit !important;
                transition: color 0.2s !important;
                line-height: 28px !important;
            }
            .sc-usercount-part { margin: 0 3px !important; }
            body.sc-vertical .sc-usercount-part,
            body.sc-vertical #sc-poll-btn {
                line-height: 44px !important;
                height: 44px !important;
                padding: 0 8px !important;
                -webkit-appearance: none !important;
                appearance: none !important;
            }
            .sc-usercount-part:hover, #sc-poll-btn:hover { color: rgba(255,255,255,0.9) !important; }
            .sc-usercount-part.sc-users-active,
            #sc-poll-btn.sc-poll-btn-active { color: white !important; }

            /* Users panel — drops down from usercount, same style as poll panel */
            #sc-users-panel {
                position: fixed !important;
                top: 28px !important;
                right: 5px !important;
                width: calc(19vw - 5px) !important;
                z-index: 19000 !important;
                background: rgba(10,10,20,0.95) !important;
                border: 1px solid #3a3a3a !important;
                border-top: none !important;
                border-radius: 0 0 0 8px !important;
                padding: 10px 12px !important;
                color: rgba(255,255,255,0.88) !important;
                font-size: 12px !important;
                line-height: 1.6 !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
                max-height: 60vh !important;
                overflow-y: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.15) transparent !important;
                display: none;
            }
            body.sc-vertical #sc-users-panel {
                top: auto !important;
                bottom: calc((100 - var(--sc-split, 50)) * 1vh - 44px) !important;
                right: 5px !important;
                width: calc(100vw - 5px) !important;
                max-height: 40vh !important;
            }
            .sc-users-panel-header {
                font-size: 10px !important;
                font-weight: 700 !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                color: rgba(255,255,255,0.4) !important;
                margin-bottom: 8px !important;
                padding-bottom: 6px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            }
            .sc-users-panel-name {
                padding: 1px 0 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            .sc-users-panel-name.sc-users-panel-afk {
                opacity: 0.55 !important;
                font-style: italic !important;
            }
            /* Same fixed-width emoji slot as #messagebuffer .username[data-emoji]::before */
            .sc-users-panel-emoji {
                display: inline-block !important;
                width: 1.3em !important;
                margin-right: 0.15em !important;
                text-align: center !important;
            }

            #videowrap-header .pull-left > span:first-child,
            #videowrap-header .label,
            #videowrap-header b { display: none !important; }
            #videowrap-header strong { font-weight: 500 !important; }

            /* Movie link icons — background fades to transparent when dimmed,
               /* Coming Attractions button — fades with gradient */
            #sc-poster-toggle {
                color: rgba(255,255,255,0.55) !important;
                transition: opacity 1.5s ease, color 0.2s ease !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            #sc-poster-toggle.sc-bar-dim {
                opacity: 0 !important;
                /* stays tap-targetable so the first tap can wake the bar, not act */
            }
            #sc-poster-toggle:hover { color: rgba(255,255,255,0.9) !important; }
            /* Pull the control bar out of embed-responsive's constrained box
               and pin it as a fixed element flush to the bottom of the screen.
               Right edge stops just before the settings button. */
            /* ===== VIDEO.JS CONTROL BAR — pill style matching our UI buttons =====
               #sc-yt-scrubber (player/ytscrubber.js) shares every one of this bar's
               positioning rules throughout this file and tv.css -- added directly to
               each selector list rather than duplicated as parallel rules, so the two
               can never drift out of sync. It's YouTube's own equivalent: video.js
               never runs for YouTube media (a raw iframe, no .vjs-control-bar at all),
               so without this a YouTube-playing room showed no scrubber whatsoever
               while every other media type did. Read-only (no seek) -- see that file's
               own header comment for why. */
            .video-js .vjs-control-bar, #sc-yt-scrubber {
                position: fixed !important;
                bottom: 4px !important;
                left: 4px !important;
                right: calc(20vw + 150px) !important;
                width: auto !important;
                margin: 0 !important;
                z-index: 10001 !important;
                /* Pill-style bar */
                background: rgba(255,255,255,0.08) !important;
                border-radius: 999px !important;
                padding: 0 8px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                backdrop-filter: blur(4px) !important;
            }
            /* Vertical-mode positioning (bottom/left/right) for this bar lives in tv.css --
               it also reserves room for the docked settings/desync/chatmode cluster and
               fades the bar in sync with them, so keeping one copy avoids the two drifting
               out of sync (see tv.css's own comment there). */

            /* Free-watch (desync) position readout — "elapsed / total" + "N behind live",
               shown only while desynced (player/seekhud.js). Echoes the control bar's own
               pill styling, docked just above it. */
            #sc-seek-hud {
                position: fixed !important;
                bottom: 40px !important; left: 4px !important;
                z-index: 10001 !important;
                display: none;
                align-items: center !important;
                gap: 8px !important;
                padding: 4px 10px !important;
                background: rgba(255,255,255,0.08) !important;
                border-radius: 999px !important;
                backdrop-filter: blur(4px) !important;
                font-size: 12px !important;
                color: rgba(255,255,255,0.75) !important;
                font-variant-numeric: tabular-nums !important;
            }
            /* Echoes #sc-desync-btn.sc-desync-active's own amber (below) so the HUD visibly
               matches the desync-active button's color language. */
            #sc-seek-hud-live { color: #ffcc44 !important; }
            body.sc-vertical #sc-seek-hud {
                bottom: calc((100 - var(--sc-split, 50)) * 1vh + 40px) !important;
            }

            /* Individual control buttons — match pill button style */
            .video-js .vjs-control {
                color: rgba(255,255,255,0.55) !important;
                transition: color 0.3s ease, background 0.3s ease !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-control:hover {
                color: white !important;
                background: rgba(255,255,255,0.12) !important;
            }

            /* Progress / seek bar */
            .video-js .vjs-progress-control {
                border-radius: 999px !important;
                overflow: visible !important;
            }
            .video-js .vjs-progress-holder {
                background: rgba(255,255,255,0.15) !important;
                border-radius: 999px !important;
                height: 4px !important;
                transition: height 0.15s !important;
            }
            .video-js .vjs-progress-holder:hover { height: 6px !important; }
            .video-js .vjs-play-progress {
                background: rgba(255,255,255,0.75) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-play-progress::before {
                color: white !important;
                font-size: 10px !important;
                top: -3px !important;
            }
            .video-js .vjs-load-progress {
                background: rgba(255,255,255,0.1) !important;
                border-radius: 999px !important;
            }

            /* #sc-yt-scrubber's own internals -- styled to match .vjs-progress-holder/
               .vjs-play-progress exactly (see player/ytscrubber.js). */
            #sc-yt-scrubber-elapsed, #sc-yt-scrubber-remain {
                font-size: 12px !important; color: rgba(255,255,255,0.75) !important;
                font-variant-numeric: tabular-nums !important; flex-shrink: 0 !important;
                line-height: 1 !important;
            }
            #sc-yt-scrubber-track {
                flex: 1 1 auto !important; height: 4px !important; margin: 0 8px !important;
                background: rgba(255,255,255,0.15) !important; border-radius: 999px !important;
                overflow: hidden !important;
            }
            #sc-yt-scrubber-fill {
                height: 100% !important; width: 0% !important;
                background: rgba(255,255,255,0.75) !important; border-radius: 999px !important;
            }
            body.sc-tv #sc-yt-scrubber-elapsed, body.sc-tv #sc-yt-scrubber-remain { font-size: 15px !important; }

            /* Volume slider */
            .video-js .vjs-volume-bar {
                background: rgba(255,255,255,0.15) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-volume-level {
                background: rgba(255,255,255,0.75) !important;
                border-radius: 999px !important;
            }
            .video-js .vjs-volume-level::before {
                color: white !important;
                font-size: 10px !important;
            }

            /* Time display */
            .video-js .vjs-time-control {
                color: rgba(255,255,255,0.55) !important;
                font-size: 11px !important;
                line-height: 32px !important;
                padding: 0 4px !important;
                min-width: 0 !important;
            }

            /* Big play button — pill style */
            .video-js .vjs-big-play-button {
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                margin: 0 !important;
                background: rgba(255,255,255,0.08) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 999px !important;
                width: 60px !important;
                height: 60px !important;
                line-height: 60px !important;
                font-size: 24px !important;
                color: rgba(255,255,255,0.8) !important;
                transition: background 0.3s ease, color 0.3s ease !important;
                backdrop-filter: blur(4px) !important;
            }
            .video-js .vjs-big-play-button:hover {
                background: rgba(255,255,255,0.18) !important;
                color: white !important;
            }
            .video-js:hover .vjs-big-play-button { opacity: 1 !important; }

            /* ===== MOTD — keep hidden, we extract images ourselves ===== */
            #motdrow { display: none !important; }

            /* Toggle button — right side of the header bar, same line as the title */
            #sc-poster-toggle {
                position: fixed !important;
                top: 0 !important;
                right: 20vw !important;  /* stops at the chat panel edge */
                left: auto !important;
                z-index: 10003 !important;
                background: transparent !important;
                border: none !important;
                border-radius: 0 !important;
                padding: 2px 8px !important;
                font-size: 10px !important;
                cursor: pointer !important;
                letter-spacing: 0.06em !important;
                text-transform: uppercase !important;
                white-space: nowrap !important;
                line-height: 1 !important;
                height: 20px !important;
                display: flex !important;
                align-items: center !important;
            }
            /* Flows in the header's flex row instead of computing its own
               position from the viewport — see the #videowrap-header flex
               rules above. */
            body.sc-vertical #sc-poster-toggle {
                position: static !important;
                flex-shrink: 0 !important;
            }

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
                   This replaced per-button \`right\`/\`top\` positioning: now that both
                   buttons flow in the header (Task 2), a header-level padding-right
                   does the same job without either button needing to know its own
                   screen position — which is what let Coming Attractions drift off
                   in the first place (a mismatched \`top: env(safe-area-inset-top)\`
                   applied to the button but not to the header next to it). */
                body.sc-vertical #videowrap-header {
                    padding-right: max(16px, env(safe-area-inset-right, 0px)) !important;
                }
                /* Narrow phones: Coming Attractions and Up Next shrink to icon-only tap
                   targets so they never compete with the title for space. Real
                   textContent stays as the accessible label/tooltip source (title=
                   attribute); the emoji is a ::before so no JS change is needed here.
                   Tablet-width portrait (outside this media query) keeps the text
                   labels — there's room and this bug is phone-specific. */
                body.sc-vertical #sc-poster-toggle,
                body.sc-vertical #sc-up-next-btn {
                    width: 32px !important;
                    height: 32px !important;
                    padding: 0 !important;
                    font-size: 0 !important;
                    justify-content: center !important;
                }
                /* Color emoji glyphs ignore CSS \`color\` (they're rendered from the
                   platform's color-emoji font, not a text glyph) — grayscale() is
                   the only way to make them match the header's muted gray chrome. */
                body.sc-vertical #sc-poster-toggle::before { content: "🍿" !important; font-size: 18px !important; filter: grayscale(1) !important; }
                body.sc-vertical #sc-up-next-btn::before { content: "⏭" !important; font-size: 18px !important; filter: grayscale(1) !important; }
            }

            /* Stats bar — floats over bottom-left of video, auto-hides after 12s */
            #sc-movie-stats {
                position: fixed !important;
                bottom: 40px !important;
                left: 12px !important;
                z-index: 19000 !important;
                background: rgba(0,0,0,0.75) !important;
                color: rgba(255,255,255,0.9) !important;
                font-size: 13px !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                letter-spacing: 0.03em !important;
                line-height: 1.4 !important;
                pointer-events: none !important;
                max-width: 75vw !important;
                animation: sc-stats-fadein 0.4s ease !important;
            }
            @keyframes sc-stats-fadein {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            /* Vertical: the base bottom:40px is measured from the whole viewport, which in the
               portrait video/chat split lands down near the chat panel, not over the video where
               it reads as "movie info". Anchor it to the video's own bottom edge instead, same
               offset as #sc-seek-hud (40px above the seam) so it clears the scrubber row's own
               controls (tv.css) rather than sitting on top of them. */
            body.sc-vertical #sc-movie-stats {
                bottom: calc((100 - var(--sc-split, 50)) * 1vh + 40px) !important;
                left: 12px !important;
            }


            /* ===== FLOATING BUTTONS (body-level, always visible) ===== */
            #sc-desync-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important; height: 28px !important;
                padding: 0 !important;
                font-size: 15px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
            }
            #sc-desync-btn:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }
            #sc-desync-btn.sc-desync-active {
                color: #ffcc44 !important;
                background: rgba(255,200,50,0.18) !important;
            }
            #fs-toggle-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                font-size: 15px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
            }
            #fs-toggle-btn:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }
            /* Emote button — absolute inside the input row, overlapping the textarea's
               right edge. Takes zero flex space; textarea gets matching padding-right. */
            #sc-mobile-input-row { position: relative !important; }
            #sc-emote-proxy {
                position: absolute !important;
                right: 6px !important; top: 50% !important;
                transform: translateY(-50%) !important;
                z-index: 1 !important;
                background: none !important; border: none !important;
                color: rgba(255,255,255,0.4) !important;
                cursor: pointer !important; padding: 4px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                -webkit-tap-highlight-color: transparent !important;
                transition: color 0.2s ease !important;
            }
            /* Portrait: shift left to clear the send button */
            body.sc-vertical #sc-emote-proxy { right: calc(44px + 14px) !important; }
            /* Overlay mode: chat is too compact for an emote icon */
            body.sc-chat-overlay #sc-emote-proxy { display: none !important; }
            #sc-emote-proxy:hover { color: rgba(255,255,255,0.85) !important; }
            #sc-emote-proxy svg { width: 20px !important; height: auto !important; display: block !important; }
            body.sc-tv #sc-emote-proxy svg { width: 26px !important; }
            /* Stop text running behind the icon */
            #sc-chat-textarea { padding-right: 34px !important; }
            #fs-toggle-btn:focus { outline: none !important; }

            /* ===== HORIZONTAL LAYOUT (widescreen) ===== */
            body.sc-horizontal #videowrap {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 79vw !important; height: 100vh !important;
                z-index: 9999 !important; background: black !important;
            }
            body.sc-horizontal #videowrap .embed-responsive,
            body.sc-horizontal #ytapiplayer {
                width: 79vw !important; height: 100vh !important;
            }
            body.sc-horizontal #chatwrap {
                position: fixed !important; top: 28px !important; right: 0 !important;
                width: 19vw !important; height: calc(100vh - 28px) !important;
                z-index: 9999 !important; background: rgba(0,0,0,0.7) !important;
                overflow: hidden !important; padding: 0 !important; margin: 0 !important;
                box-sizing: border-box !important;
                border: none !important;
                display: flex !important; flex-direction: column !important;
            }
            /* One consistent 8px inset for everything in the chat column, so the
               messages, input and header all share the same left/right edge. */
            body.sc-horizontal #chatwrap > * { margin-left: 0 !important; margin-right: 0 !important; box-sizing: border-box !important; width: 100% !important; }
            body.sc-horizontal #messagebuffer,
            body.sc-horizontal #sc-mobile-input-row { padding-left: 8px !important; padding-right: 8px !important; }
            body.sc-horizontal #sc-chat-header { padding: 0 8px !important; margin: 0 !important; }
            /* Hide send button in horizontal — Enter key sends */
            body.sc-horizontal #sc-send-btn { display: none !important; }
            body.sc-horizontal #sc-mobile-input-row { padding: 4px 0 !important; }
            body.sc-horizontal #leftcontrols { display: none !important; }
            body.sc-horizontal #fs-toggle-btn {
                bottom: 6px !important; right: calc(20vw + 70px) !important;
            }

            /* ===== VERTICAL LAYOUT (portrait) — YouTube-style stack =====
               Title strip (36px) → video (ends at --sc-split vh) → control band (44px) → chat */
            body.sc-vertical #videowrap {
                position: fixed !important; top: 36px !important; left: 0 !important;
                width: 100vw !important; height: calc(var(--sc-split, 50) * 1vh - 36px) !important;
                z-index: 9999 !important; background: black !important;
                border: none !important; outline: none !important;
                box-shadow: none !important;
            }
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer {
                width: 100vw !important; height: calc(var(--sc-split, 50) * 1vh - 36px) !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            body.sc-vertical .video-js {
                margin: 0 !important;
                padding: 0 !important;
                left: 0 !important;
            }
            body.sc-vertical .vjs-tech {
                left: 0 !important;
                margin: 0 !important;
            }
            body.sc-vertical #chatwrap {
                position: fixed !important; bottom: 0 !important; left: 0 !important;
                width: 100vw !important; height: calc((100 - var(--sc-split, 50)) * 1vh - 44px) !important;
                z-index: 9999 !important; background: rgba(16,14,24,0.97) !important;
                overflow: hidden !important; padding: 0 5px !important;
                display: flex !important; flex-direction: column !important;
            }
            body.sc-vertical #messagebuffer { font-size: 15px !important; }

            /* Vertical: all buttons in one right-pinned row flush on top of the chat panel.
               leftcontrols hides its own internal layout; we show a proxy row instead. */
            body.sc-vertical #leftcontrols { display: none !important; }

            /* fs button: right-pinned, sitting exactly on the chat top edge */
            body.sc-vertical #fs-toggle-btn {
                bottom: 43vh !important;
                right: 84px !important; left: auto !important;
            }

            /* ===== SHARED CHAT ELEMENTS ===== */
            /* No borders anywhere in the chat column except the message input box */
            #chatwrap, #chatwrap *:not(#sc-chat-textarea),
            #sc-chat-header, #sc-chat-header * {
                border: none !important; box-shadow: none !important;
            }
            /* Vertical: header band shares the chat's background so there's no seam */
            body.sc-vertical #sc-chat-header { background: rgba(0,0,0,0.85) !important; }
            #messagebuffer {
                flex: 1 !important; height: auto !important;
                width: 100% !important; box-sizing: border-box !important;
                padding-left: 0 !important; padding-right: 0 !important; margin: 0 !important;
                background: transparent !important; color: white !important; border: none !important;
                font-family: 'Inter', 'Roboto', system-ui, sans-serif !important;
                font-size: 14px !important; overflow-x: hidden !important; overflow-y: auto !important; padding-bottom: 5px !important;
            }
            /* Long usernames / links must wrap, never widen the panel */
            #messagebuffer, #messagebuffer * {
                overflow-wrap: anywhere !important; word-break: break-word !important;
                max-width: 100% !important;
            }
            #messagebuffer .username[data-emoji]::before {
                content: attr(data-emoji);
                display: inline-block;
                width: 1.3em;
                text-align: center;
                vertical-align: -0.1em;
                line-height: 1;
                margin-right: 2px;
            }
            #messagebuffer .sc-own-msg {
                background: rgba(125, 200, 255, 0.07) !important;
                margin: 0 -4px !important; padding: 1px 4px !important;
                border-radius: 3px !important;
            }
            /* Mention ping -- overrides CyTube's default flat-gray .nick-highlight */
            #messagebuffer .nick-highlight {
                background: rgba(185, 130, 255, 0.14) !important;
                border-left: 2px solid rgba(185, 130, 255, 0.75) !important;
                margin: 0 -4px 0 -6px !important; padding: 1px 4px 1px 4px !important;
                border-radius: 3px !important;
            }
            .sc-img-embed { display: block !important; margin-top: 4px !important; }
            .sc-img-embed img {
                display: block !important;
                max-width: 100% !important;
                border-radius: 4px !important;
                cursor: pointer !important;
            }
            .sc-img-embed-badge {
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
                font-size: 10px !important;
                color: rgba(244,244,242,0.45) !important;
                margin-top: 2px !important;
            }
            .sc-img-embed-toggle {
                cursor: pointer !important;
                font-size: 11px !important;
                opacity: 0.6 !important;
                line-height: 1 !important;
            }
            .sc-img-embed-toggle:hover { opacity: 1 !important; }
            .sc-img-embed-ban {
                cursor: pointer !important;
                font-size: 11px !important;
                opacity: 0.6 !important;
                line-height: 1 !important;
            }
            .sc-img-embed-ban:hover { opacity: 1 !important; }
            .sc-img-embed-unban {
                cursor: pointer !important;
                opacity: 0.7 !important;
                text-decoration: underline !important;
            }
            .sc-img-embed-unban:hover { opacity: 1 !important; }
            #sc-chat-textarea {
                width: 100% !important; min-height: 44px !important; max-height: 120px !important;
                background: rgba(255,255,255,0.1) !important; color: white !important;
                border: 1px solid rgba(255,255,255,0.3) !important; border-radius: 4px !important;
                padding: 6px 8px !important; font-size: 14px !important; font-family: inherit !important;
                resize: none !important; overflow-y: auto !important;
                box-sizing: border-box !important; line-height: 1.4 !important;
                outline: none !important; transition: border-color 0.2s !important; flex-shrink: 0 !important;
            }
            #sc-chat-textarea:focus {
                border-color: rgba(255,255,255,0.7) !important;
                background: rgba(255,255,255,0.15) !important;
            }
            #sc-chat-textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
            #sc-checking {
                font-size: 11px !important; color: rgba(255,255,200,0.6) !important;
                padding: 2px 4px !important; flex-shrink: 0 !important;
            }

`;

  // src/styles/overlays.css
  var overlays_default = `            /* ===== REVIEW MODAL ===== */
            #sc-modal-overlay {
                position: fixed !important; inset: 0 !important;
                background: rgba(0,0,0,0.8) !important; z-index: 99999 !important;
                display: flex !important; align-items: center !important;
                justify-content: center !important; font-family: system-ui, sans-serif !important;
            }
            #sc-modal {
                background: #13131f !important; border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 12px !important; padding: 20px !important;
                max-width: 520px !important; width: 94vw !important; color: white !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important; max-height: 85vh !important;
                overflow-y: auto !important; display: flex !important; flex-direction: column !important; gap: 12px !important;
            }
            #sc-modal-title { font-size: 16px !important; font-weight: 700 !important; color: #f0c040 !important; margin: 0 !important; }
            #sc-readability { display: flex !important; flex-direction: column !important; gap: 4px !important; }
            .sc-readability-issue {
                font-size: 12px !important; color: #ffd080 !important;
                background: rgba(255,200,80,0.08) !important; border-radius: 4px !important; padding: 4px 8px !important;
            }
            #sc-preview-wrap {
                background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 6px !important; padding: 10px 12px !important;
                line-height: 1.6 !important; font-size: 14px !important; color: #e0e0e0 !important; word-break: break-word !important;
            }
            .sc-error-span {
                background: rgba(255,80,80,0.25) !important; border-bottom: 2px solid #ff5555 !important;
                border-radius: 2px !important; cursor: pointer !important; padding: 0 1px !important; transition: background 0.15s !important;
            }
            .sc-error-span:hover { background: rgba(255,80,80,0.45) !important; }
            #sc-error-detail {
                background: rgba(255,255,255,0.04) !important; border-radius: 6px !important;
                padding: 8px 10px !important; font-size: 13px !important; min-height: 36px !important; color: #ccc !important;
            }
            #sc-error-detail:empty { display: none !important; }
            .sc-detail-msg { margin-bottom: 8px !important; color: #ffcccc !important; }
            .sc-detail-actions { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; }
            .sc-sug-btn {
                background: rgba(60,180,100,0.2) !important; color: #90ffa0 !important;
                border: 1px solid rgba(60,200,100,0.4) !important; border-radius: 5px !important;
                padding: 4px 10px !important; cursor: pointer !important; font-size: 12px !important;
            }
            .sc-sug-btn:hover { background: rgba(60,180,100,0.4) !important; }
            .sc-reject-btn {
                background: rgba(255,255,255,0.07) !important; color: #aaa !important;
                border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 5px !important;
                padding: 4px 10px !important; cursor: pointer !important; font-size: 12px !important;
            }
            .sc-reject-btn:hover { background: rgba(255,255,255,0.14) !important; }
            #sc-modal-actions { display: flex !important; gap: 10px !important; justify-content: flex-end !important; }
            #sc-btn-cancel {
                background: rgba(255,255,255,0.08) !important; color: #ccc !important;
                border: 1px solid rgba(255,255,255,0.2) !important; border-radius: 6px !important;
                padding: 7px 16px !important; cursor: pointer !important; font-size: 13px !important;
            }
            #sc-btn-cancel:hover { background: rgba(255,255,255,0.16) !important; }
            #sc-btn-send {
                background: rgba(60,180,100,0.25) !important; color: #90ffa0 !important;
                border: 1px solid rgba(60,200,100,0.5) !important; border-radius: 6px !important;
                padding: 7px 16px !important; cursor: pointer !important; font-size: 13px !important; font-weight: 600 !important;
            }
            #sc-btn-send:hover { background: rgba(60,180,100,0.4) !important; }
            #sc-lt-credit { font-size: 10px !important; color: rgba(255,255,255,0.25) !important; text-align: right !important; }
            #sc-lt-credit a { color: rgba(255,255,255,0.35) !important; }

            /* ===== SETTINGS BUTTON ===== */
            #sc-settings-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                font-size: 13px !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease !important;
                line-height: 1 !important;
            }
            #sc-settings-btn:hover {
                color: white !important;
                background: rgba(255,255,255,0.22) !important;
            }
            /* A newer release is available — static green highlight (always while available) */
            #sc-settings-btn.sc-has-update {
                color: #7dffa0 !important;
                box-shadow: 0 0 0 2px rgba(125,255,160,0.32), 0 0 6px rgba(125,255,160,0.28) !important;
            }
            /* …and a brief attention pulse, removed after ~30s so it isn't endless */
            #sc-settings-btn.sc-has-update.sc-has-update-pulse {
                animation: sc-gear-update-pulse 2s ease-in-out infinite !important;
            }
            @keyframes sc-gear-update-pulse {
                0%, 100% { box-shadow: 0 0 0 2px rgba(125,255,160,0.35), 0 0 6px rgba(125,255,160,0.35) !important; }
                50%      { box-shadow: 0 0 0 2px rgba(125,255,160,0.7), 0 0 16px rgba(125,255,160,0.8) !important; }
            }

            /* ===== CAST BUTTON (mobile only) — fourth slot in the docked scrubber-row
               cluster, alongside chatmode/desync/settings ===== */
            /* Used to be a leftzone/rightzone fly-out (hidden behind an edge swipe or a
               barely-visible grip) -- same discoverability trap as the old Chat-Only escape
               gesture: effectively invisible until you already knew it was there. Docked
               permanently instead, same size/pitch/fade as its row-mates, so it reads as
               "one of the buttons" instead of something to be found by accident. */
            #sc-cast-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                padding: 0 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease, opacity 0.6s ease !important;
                line-height: 1 !important;
            }
            #sc-cast-btn:hover { color: white !important; background: rgba(255,255,255,0.22) !important; }
            #sc-cast-btn.sc-cast-active { color: #7dffa0 !important; background: rgba(125,255,160,0.18) !important; }
            /* Horizontal: same row as chatmode/desync/settings, one slot past settings
               (38px pitch, matching their own 8/46/84 spacing). */
            body.sc-horizontal #sc-cast-btn {
                left: auto !important; bottom: 4px !important; top: auto !important;
                right: calc(19vw + 122px) !important;
                width: 32px !important; height: 32px !important; font-size: 13px !important;
                opacity: 1 !important; pointer-events: auto !important; transform: none !important;
            }
            /* Vertical: same row, one slot past settings (right:84 + 38px pitch). */
            body.sc-vertical #sc-cast-btn {
                top: auto !important; bottom: calc((100 - var(--sc-split, 50)) * 1vh + 4px) !important;
                right: 122px !important; left: auto !important;
                width: 32px !important; height: 32px !important; font-size: 13px !important;
                opacity: 1 !important; pointer-events: auto !important; transform: none !important;
            }

            /* ===== SETTINGS MODAL ===== */
            #sc-settings-overlay {
                position: fixed !important; inset: 0 !important;
                background: rgba(0,0,0,0.85) !important;
                z-index: 99998 !important;
                display: flex !important;
                align-items: center !important; justify-content: center !important;
                font-family: system-ui, sans-serif !important;
            }
            #sc-settings-modal {
                background: #0e0e1a !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 12px !important;
                padding: 24px !important;
                width: min(480px, 94vw) !important;
                color: white !important;
                box-shadow: 0 16px 48px rgba(0,0,0,0.8) !important;
                display: flex !important; flex-direction: column !important; gap: 16px !important;
                max-height: 90vh !important; overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
            }
            /* Validate-key button sits inline with each key input */
            .sc-settings-input-row { display: flex !important; gap: 8px !important; align-items: stretch !important; }
            .sc-settings-input-row .sc-settings-input { flex: 1 !important; }
            .sc-settings-test {
                flex-shrink: 0 !important;
                background: rgba(192,176,255,0.15) !important;
                color: #c0b0ff !important;
                border: 1px solid rgba(192,176,255,0.35) !important;
                border-radius: 6px !important;
                padding: 0 16px !important; font-size: 13px !important; font-weight: 600 !important;
                cursor: pointer !important;
            }
            .sc-settings-test:disabled { opacity: 0.5 !important; cursor: default !important; }
            .sc-settings-test-status { font-size: 12px !important; min-height: 14px !important; }
            .sc-settings-test-status.sc-test-ok      { color: #7dffa0 !important; }
            .sc-settings-test-status.sc-test-bad     { color: #ff8080 !important; }
            .sc-settings-test-status.sc-test-pending { color: rgba(255,255,255,0.55) !important; }
            /* Chat font-size slider + live sample */
            .sc-settings-range { width: 100% !important; accent-color: #c0b0ff !important; cursor: pointer !important; }
            .sc-font-sample {
                margin-top: 10px !important; padding: 10px 12px !important;
                background: rgba(255,255,255,0.05) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 6px !important; color: rgba(255,255,255,0.88) !important;
                line-height: 1.4 !important;
            }
            #sc-settings-title {
                font-size: 17px !important; font-weight: 700 !important;
                color: #c0b0ff !important;
            }
            .sc-settings-intro {
                font-size: 13px !important; color: rgba(255,255,255,0.6) !important;
                line-height: 1.5 !important;
                background: rgba(255,255,255,0.04) !important;
                border-radius: 6px !important; padding: 8px 10px !important;
            }
            .sc-settings-group {
                display: flex !important; flex-direction: column !important; gap: 5px !important;
            }
            .sc-settings-label {
                font-size: 13px !important; font-weight: 600 !important;
                color: rgba(255,255,255,0.85) !important;
                display: flex !important; flex-direction: column !important; gap: 2px !important;
            }
            .sc-settings-note {
                font-weight: 400 !important; font-size: 11px !important;
                color: rgba(255,255,255,0.4) !important;
            }
            .sc-settings-input {
                background: rgba(255,255,255,0.07) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 6px !important;
                color: white !important;
                padding: 8px 10px !important;
                font-size: 13px !important;
                font-family: monospace !important;
                outline: none !important;
                width: 100% !important; box-sizing: border-box !important;
            }
            .sc-settings-input:focus {
                border-color: rgba(192,176,255,0.6) !important;
                background: rgba(255,255,255,0.1) !important;
            }
            .sc-settings-link {
                font-size: 11px !important; color: rgba(192,176,255,0.7) !important;
                text-decoration: none !important; align-self: flex-start !important;
            }
            .sc-settings-link:hover { color: #c0b0ff !important; text-decoration: underline !important; }
            .sc-settings-toggle-group, .sc-settings-divider {
                border-top: 1px solid rgba(255,255,255,0.08) !important; padding-top: 12px !important;
            }
            .sc-settings-toggle-label {
                display: flex !important; flex-direction: column !important; gap: 4px !important;
                cursor: pointer !important; font-size: 13px !important;
                font-weight: 600 !important; color: rgba(255,255,255,0.85) !important;
            }
            /* checkbox sits INLINE with its label; the note drops underneath */
            .sc-toggle-row {
                display: flex !important; align-items: center !important; gap: 9px !important;
            }
            .sc-toggle-row input[type="checkbox"] {
                width: 17px !important; height: 17px !important; margin: 0 !important;
                flex: 0 0 auto !important; cursor: pointer !important; accent-color: #c0b0ff !important;
            }
            .sc-toggle-text { line-height: 1.2 !important; }
            #sc-tmdb-fields {
                display: flex !important; flex-direction: column !important; gap: 6px !important;
                margin: 8px 0 0 26px !important;
            }
            #sc-tmdb-fields.sc-hidden { display: none !important; }
            .sc-settings-btn-wide {
                background: rgba(192,176,255,0.2) !important; color: #c0b0ff !important;
                border: 1px solid rgba(192,176,255,0.4) !important; border-radius: 6px !important;
                padding: 9px 18px !important; font-size: 13px !important; font-weight: 600 !important;
                cursor: pointer !important; width: 100% !important;
            }
            .sc-settings-btn-wide:hover { background: rgba(192,176,255,0.32) !important; }
            #sc-phone-qr {
                display: block !important; margin: 14px auto !important;
                background: #fff !important; padding: 14px !important; border-radius: 14px !important;
                width: min(100%, 320px) !important; height: auto !important;
                image-rendering: pixelated !important; image-rendering: crisp-edges !important;
            }
            #sc-phone-qr.sc-hidden { display: none !important; }
            /* App-update section + the settings-gear "update available" highlight */
            #sc-update-notes {
                white-space: pre-wrap !important; max-height: 130px !important; overflow-y: auto !important;
                margin: 6px 0 8px !important; padding: 8px 10px !important;
                background: rgba(255,255,255,0.05) !important; border-radius: 6px !important;
                font-size: 12px !important; line-height: 1.45 !important; color: rgba(255,255,255,0.78) !important;
            }
            #sc-update-notes.sc-hidden, #sc-update-github-link.sc-hidden { display: none !important; }
            #sc-update-status.sc-update-yes { color: #7dffa0 !important; font-weight: 600 !important; }
            #sc-update-status.sc-update-no  { color: rgba(255,255,255,0.5) !important; }
            .sc-update-github-link {
                display: block !important; margin-top: 8px !important; width: 100% !important;
                background: transparent !important; border: none !important; cursor: pointer !important;
                text-align: center !important; font-size: 12px !important;
                color: rgba(255,255,255,0.5) !important; text-decoration: none !important;
            }
            .sc-update-github-link:hover { color: rgba(255,255,255,0.75) !important; }
            #sc-settings-actions {
                display: flex !important; gap: 10px !important; justify-content: flex-end !important;
                margin-top: 4px !important;
            }
            #sc-settings-cancel {
                background: rgba(255,255,255,0.08) !important; color: #aaa !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 6px !important; padding: 8px 18px !important;
                cursor: pointer !important; font-size: 13px !important;
            }
            #sc-settings-cancel:hover { background: rgba(255,255,255,0.14) !important; }
            #sc-settings-save {
                background: rgba(192,176,255,0.2) !important; color: #c0b0ff !important;
                border: 1px solid rgba(192,176,255,0.4) !important;
                border-radius: 6px !important; padding: 8px 18px !important;
                cursor: pointer !important; font-size: 13px !important; font-weight: 600 !important;
            }
            #sc-settings-save:hover { background: rgba(192,176,255,0.35) !important; }

            /* Tabbed settings modal */
            #sc-settings-tabs {
                display: flex !important; gap: 2px !important;
                border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                margin: 0 0 2px 0 !important; padding: 0 !important;
            }
            .sc-settings-tab {
                background: none !important; border: none !important;
                border-bottom: 2px solid transparent !important;
                color: rgba(255,255,255,0.5) !important;
                font-size: 13px !important; font-weight: 600 !important;
                padding: 8px 10px !important; cursor: pointer !important;
                font-family: inherit !important;
            }
            .sc-settings-tab.sc-settings-tab-active {
                color: #c0b0ff !important;
                border-bottom-color: #c0b0ff !important;
            }
            .sc-settings-pane {
                display: none !important; flex-direction: column !important; gap: 16px !important;
            }
            .sc-settings-pane.sc-settings-pane-active { display: flex !important; }

            /* Poll panel */
            #sc-poll-panel {
                position: fixed !important;
                top: 28px !important;
                right: 5px !important;
                width: calc(19vw - 5px) !important;
                z-index: 19000 !important;
                background: rgba(10,10,20,0.95) !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 8px !important;
                padding: 12px 14px !important;
                max-width: 100% !important;
                color: rgba(255,255,255,0.88) !important;
                font-size: 13px !important;
                line-height: 1.5 !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
                font-family: system-ui, sans-serif !important;
            }
            body.sc-vertical #sc-poll-panel {
                right: 0 !important;
                top: auto !important;
                bottom: calc(42vh + 42px) !important;
                max-width: 98vw !important;
            }
            .sc-poll-header {
                font-weight: 600 !important;
                font-size: 14px !important;
                color: #f0c040 !important;
                margin-bottom: 8px !important;
                padding-bottom: 6px !important;
                border-bottom: 1px solid rgba(255,255,255,0.1) !important;
            }
            .sc-poll-option {
                margin-bottom: 6px !important;
                color: rgba(255,255,255,0.82) !important;
                font-size: 13px !important;
            }
            .sc-poll-option a {
                color: #7eb8f7 !important;
                word-break: break-all !important;
            }
            .sc-poll-meta {
                margin-top: 8px !important;
                font-size: 11px !important;
                color: rgba(255,255,255,0.35) !important;
                text-align: right !important;
            }

            #sc-settings-status {
                font-size: 12px !important; color: #90ffa0 !important;
                text-align: center !important; min-height: 16px !important;
            }

            /* DRM (YouTube Movies) fallback overlay — covers the dead YT iframe */
            #sc-drm-overlay {
                position: absolute !important; inset: 0 !important;
                z-index: 60 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: radial-gradient(ellipse at center, rgba(20,12,28,0.92), rgba(8,6,12,0.97)) !important;
                font-family: 'Inter', system-ui, sans-serif !important;
                padding: 24px !important; text-align: center !important;
            }
            #sc-drm-box { max-width: 560px !important; }
            #sc-drm-icon { font-size: 40px !important; margin-bottom: 10px !important; }
            #sc-drm-title {
                font-size: 22px !important; font-weight: 700 !important; color: #fff !important;
                margin-bottom: 10px !important; line-height: 1.25 !important;
            }
            #sc-drm-msg {
                font-size: 14px !important; color: rgba(255,255,255,0.72) !important;
                line-height: 1.5 !important; margin-bottom: 20px !important;
            }
            #sc-drm-msg b { color: #c0b0ff !important; }
            .sc-drm-btn {
                background: #c0b0ff !important; color: #1a1020 !important; border: none !important;
                border-radius: 8px !important; padding: 12px 26px !important;
                font-size: 15px !important; font-weight: 700 !important; cursor: pointer !important;
                font-family: inherit !important;
            }

            /* ===== POP-UP TRIVIA BUBBLE ===== */
            /* Styled after the classic VH1 Pop-up Video caption bubble: plain
               white card, thick black outline, bold black text, no close
               button -- it just times out on its own. left/top are set inline
               (with !important) by triviapopup.js on every pop, clamped to
               #videowrap's own rect -- see that file's _tpRandomPosition(). */
            #sc-tp-bubble {
                position: fixed !important;
                left: 50% !important;
                top: 50% !important;
                z-index: 15500 !important; /* above video chrome, below settings/review modals (~99998+) and the trivia card (21800) */
                max-width: min(460px, 88vw) !important;
                display: flex !important;
                align-items: center !important;
                padding: 30px 20px 16px 36px !important;
                background: #ffffff !important;
                border: 5px solid #000 !important;
                border-radius: 20px !important;
                box-shadow: 0 6px 18px rgba(0,0,0,0.55) !important;
                font-family: 'Arial Rounded MT Bold','Comic Sans MS',sans-serif !important;
                opacity: 0 !important;
                transform: scale(0.001) !important;
                transition: transform 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            #sc-tp-bubble.sc-tp-in {
                opacity: 0.9 !important;
                transform: scale(1) !important;
            }
            #sc-tp-bubble.sc-tp-out {
                opacity: 0 !important;
                transform: scale(0.85) !important;
                transition-duration: 0.3s !important;
            }
            #sc-tp-tail {
                position: absolute !important;
                top: -18px !important;
                left: -22px !important;
                width: 48px !important;
                height: 48px !important;
                overflow: visible !important;
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)) !important;
            }
            #sc-tp-text {
                color: #0a0a0a !important;
                font-size: 15px !important;
                font-weight: 700 !important;
                line-height: 1.35 !important;
            }
            #sc-tp-byline {
                color: #4a4a4a !important;
                font-family: 'Arial Rounded MT Bold','Comic Sans MS',sans-serif !important;
                font-size: 12px !important;
                font-weight: 400 !important;
                line-height: 1.3 !important;
                margin-top: 6px !important;
            }
            .sc-drm-btn:focus { outline: 3px solid #fff !important; outline-offset: 2px !important; }
`;

  // src/styles/tv.css
  var tv_default = `            html, body { width: 100vw !important; overflow-x: hidden !important; background: #000 !important; }

            /* Clean, distance-legible chat type (Inter, falling back to Roboto/system) */
            #messagebuffer, #messagebuffer *, #sc-chat-textarea {
                font-family: 'Inter', 'Roboto', system-ui, -apple-system, sans-serif !important;
                letter-spacing: 0.005em !important;
            }
            #messagebuffer { line-height: 1.35 !important; }
            body.sc-tv #messagebuffer { font-weight: 500 !important; }
            /* Poll notifications carry a hardcoded 14pt size — make them match chat */
            #messagebuffer .poll-notify { font-size: inherit !important; }

            /* App is always fullscreen — the toggle is redundant */
            #fs-toggle-btn { display: none !important; }

            /* Compact control icons on phones (TV scales these up to 52px below) */
            #sc-desync-btn, #sc-settings-btn, #sc-cast-btn {
                width: 36px !important; height: 36px !important; font-size: 15px !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            /* #sc-cast-btn already carries its own opacity transition (overlays.css, loaded
               before this file so it wins there); desync/settings had none anywhere, so they
               popped instantly on every chrome-hidden toggle while the scrubber and
               #sc-chatmode-btn (both 0.6s ease) faded smoothly next to them in the same row --
               same trigger, visibly out of sync. */
            #sc-desync-btn, #sc-settings-btn {
                transition: opacity 0.6s ease !important;
            }
            /* Prevent input zoom on mobile */
            #sc-chat-textarea { font-size: 16px !important; }

            /* ── VERTICAL (portrait phone): YouTube-style stack ─── */
            /* Title strip (36px) → video (--sc-split vh) → ctrl band (44px) → chat.
               --sc-split is a unitless 0-100 custom prop (video/chat seam position, in vh);
               default 50 reproduces the original fixed 50/50 split. Set live by the drag
               handler on #sc-vert-ctrl-band (see initVertControlBand). */
            body.sc-vertical #videowrap,
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer    { height: calc(var(--sc-split, 50) * 1vh - 36px) !important; }
            body.sc-vertical #chatwrap       { height: calc((100 - var(--sc-split, 50)) * 1vh - 44px) !important; }
            body.sc-vertical #sc-users-panel { bottom: calc((100 - var(--sc-split, 50)) * 1vh - 44px) !important; }
            body.sc-vertical #sc-poll-panel  { bottom: calc((100 - var(--sc-split, 50)) * 1vh - 44px) !important; }
            /* Three buttons sit in the video's own scrubber row (its bottom edge, just above
               the seam) — same anchor as .vjs-control-bar/#sc-yt-scrubber right below, so they
               read as an extension of the video's own controls, not the chat header underneath
               (which lives in the seam band, #sc-vert-ctrl-band, one row down). */
            /* 32px to match the control bar's own fixed height (base.css), same "extension of
               the bar" sizing as the horizontal docked row below. */
            body.sc-vertical #sc-chatmode-btn,
            body.sc-vertical #sc-desync-btn,
            body.sc-vertical #sc-settings-btn {
                width: 32px !important; height: 32px !important; font-size: 13px !important;
                top: auto !important; bottom: calc((100 - var(--sc-split, 50)) * 1vh + 4px) !important;
                left: auto !important; transform: none !important;
                opacity: 1 !important; pointer-events: auto !important;
            }
            body.sc-vertical #sc-chatmode-btn { right: 8px !important; }
            body.sc-vertical #sc-desync-btn   { right: 46px !important; }
            body.sc-vertical #sc-settings-btn { right: 84px !important; }
            /* Scrubber stops well short of the docked row -- video.js renders its own PiP/cast/
               quality-menu icons flush against the bar's own right edge (no reservation of
               their own), so the gap has to clear THOSE, not just the bar's flex-filled
               progress track. 200px (bare minimum for our 4 buttons -- cast joined the row
               below, matching the horizontal layout further down) put them close enough to
               visually read as overlapping. */
            body.sc-vertical .video-js .vjs-control-bar, body.sc-vertical #sc-yt-scrubber { bottom: calc((100 - var(--sc-split, 50)) * 1vh + 4px) !important; left: 4px !important; right: 200px !important; }
            /* Fade together with the scrubber on idle (see initChromeAutohide/
               neutralizeVjsInactivityTimer, chat/modes.js + player/scrubber.js) instead of
               staying permanently visible while the scrubber fades on its own timer. */
            body.sc-vertical.sc-chrome-hidden #sc-chatmode-btn,
            body.sc-vertical.sc-chrome-hidden #sc-desync-btn,
            body.sc-vertical.sc-chrome-hidden #sc-settings-btn,
            body.sc-vertical.sc-chrome-hidden #sc-cast-btn {
                opacity: 0 !important; pointer-events: none !important;
            }

            /* Control band element — dark strip between video and chat; also the drag handle
               for resizing the split (see initVertControlBand). */
            #sc-vert-ctrl-band { display: none !important; }
            body.sc-vertical #sc-vert-ctrl-band {
                display: flex !important; align-items: center !important; justify-content: center !important;
                position: fixed !important; left: 0 !important; right: 0 !important;
                top: calc(var(--sc-split, 50) * 1vh) !important; height: 44px !important;
                background: rgba(8,6,12,0.95) !important;
                z-index: 10000 !important;
                border-top: 1px solid rgba(255,255,255,0.10) !important;
                border-bottom: 1px solid rgba(255,255,255,0.07) !important;
                touch-action: none !important;
            }
            /* Grip-pill — visual affordance that the band is a drag handle */
            body.sc-vertical #sc-vert-ctrl-band::before {
                content: "" !important;
                width: 36px !important; height: 4px !important;
                border-radius: 2px !important;
                background: rgba(255,255,255,0.28) !important;
                pointer-events: none !important;
            }
            body.sc-vertical #sc-vert-ctrl-band.sc-dragging::before { background: rgba(255,255,255,0.5) !important; }
            /* Grip — thin pill on the right edge of the control band. Used to reveal
               #sc-cast-btn (initRightZone's sole purpose); cast is docked permanently now
               (overlays.css), so sc-rightzone no longer controls anything -- nothing left
               to hint at, so the grip itself stays hidden. */
            #sc-vert-ctrl-grip { display: none !important; }

            /* Hide ctrl band, grip, and buttons while keyboard is up */
            body.sc-kb-open.sc-vertical #sc-vert-ctrl-band,
            body.sc-kb-open.sc-vertical #sc-vert-ctrl-grip {
                opacity: 0 !important; pointer-events: none !important;
            }

            /* ── KEYBOARD OPEN (sc-kb-open) ──────────────────── */
            /* edge-to-edge mode breaks adjustResize — vh never updates,
               so we drive layout with explicit px values from visualViewport */
            body.sc-kb-open.sc-vertical #videowrap,
            body.sc-kb-open.sc-vertical #videowrap .embed-responsive,
            body.sc-kb-open.sc-vertical #ytapiplayer {
                height: var(--sc-vid-h) !important;
            }
            /* The tap-to-wake catcher is sized off a stale 55vh (see comment above) — without
               this it still spans the pre-keyboard video height and, whenever the chrome has
               auto-dimmed (pointer-events:auto), silently eats touch-scroll over the chat area
               that's since been repositioned up above it. */
            body.sc-kb-open.sc-vertical #sc-video-tap {
                height: var(--sc-vid-h) !important;
            }
            body.sc-kb-open.sc-vertical #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* ── VERTICAL keyboard open ─────────────────────── */
            /* Hide floating buttons while typing */
            body.sc-kb-open.sc-vertical #sc-chatmode-btn,
            body.sc-kb-open.sc-vertical #sc-desync-btn,
            body.sc-kb-open.sc-vertical #sc-settings-btn,
            body.sc-kb-open.sc-vertical #sc-cast-btn,
            body.sc-kb-open #sc-top-bar,
            body.sc-kb-open #sc-chat-header {
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* ── HORIZONTAL keyboard open ───────────────────── */
            body.sc-kb-open.sc-horizontal #videowrap,
            body.sc-kb-open.sc-horizontal #videowrap .embed-responsive,
            body.sc-kb-open.sc-horizontal #ytapiplayer {
                height: var(--sc-vid-h) !important;
            }
            /* Same stale-height fix as vertical — matters when the chat-overlay layout
               (100vw tap catcher) is active over a keyboard-shrunk chat area. */
            body.sc-kb-open.sc-horizontal #sc-video-tap {
                height: var(--sc-vid-h) !important;
            }
            body.sc-kb-open.sc-horizontal #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* Lift floating buttons above the keyboard */
            body.sc-kb-open.sc-horizontal #sc-chatmode-btn,
            body.sc-kb-open.sc-horizontal #sc-desync-btn,
            body.sc-kb-open.sc-horizontal #fs-toggle-btn,
            body.sc-kb-open.sc-horizontal #sc-settings-btn {
                bottom: calc(var(--sc-kb-h) + 6px) !important;
            }

            /* ── HORIZONTAL (landscape phone / tablet / TV) ──── */
            /* Control row — docked immediately left of the chat sidebar, in a gap reserved by
               narrowing the seek bar's own right edge, so the row reads as a genuine extension
               of it: same 32px height as .vjs-control-bar (base.css), same 4px bottom offset,
               identical on TV as everywhere else (the bar itself never scales for TV). Always
               visible -- #sc-cast-btn (mobile-only) joins this row too, see overlays.css. */
            body.sc-horizontal #sc-chatmode-btn,
            body.sc-horizontal #sc-desync-btn,
            body.sc-horizontal #sc-settings-btn {
                left: auto !important; bottom: 4px !important; top: auto !important;
                width: 32px !important; height: 32px !important; font-size: 13px !important;
                opacity: 1 !important; pointer-events: auto !important; transform: none !important;
                transition: opacity 0.3s ease, transform 0.3s ease !important;
            }
            body.sc-horizontal #sc-chatmode-btn { right: calc(19vw + 8px)  !important; }
            body.sc-horizontal #sc-desync-btn   { right: calc(19vw + 46px) !important; }
            body.sc-horizontal #sc-settings-btn { right: calc(19vw + 84px) !important; }
            /* Slide out to the right in sync with the scrubber's own idle fade (same
               body.sc-chrome-hidden trigger that fades .vjs-control-bar itself, below) --
               mirrors the desktop userscript's "gap buttons slide out to the right on idle". */
            body.sc-tv.sc-chrome-hidden #sc-chatmode-btn,
            body.sc-tv.sc-chrome-hidden #sc-desync-btn,
            body.sc-tv.sc-chrome-hidden #sc-settings-btn {
                transform: translateX(60px) !important; opacity: 0 !important; pointer-events: none !important;
            }

            /* Drawer "grip" — used to reveal the leftzone cluster, but the only thing that
               ever lived there was #sc-cast-btn, now docked permanently in the row above
               (overlays.css) instead of hidden behind this. Nothing left to hint at. */
            #sc-cluster-grip { display: none !important; }
            /* Seek bar stops short of the docked row (matching bottom so the row reads as one
               continuous control strip). Reservation sized for the 32px buttons above. */
            body.sc-horizontal .video-js .vjs-control-bar, body.sc-horizontal #sc-yt-scrubber { left: 4px !important; right: calc(19vw + 162px) !important; }

            /* ── TV: larger text, focus ring on interactive items ─ */
            body.sc-tv #messagebuffer { font-size: 18px !important; }
            body.sc-tv #sc-chat-textarea { font-size: 18px !important; }
            /* Base highlight tints (base.css) are tuned for a phone held at arm's length --
               too faint to read from couch distance on a TV. Punch up opacity/border for both. */
            body.sc-tv #messagebuffer .sc-own-msg {
                background: rgba(125, 200, 255, 0.22) !important;
                border-left: 2px solid rgba(125, 200, 255, 0.7) !important;
                margin: 0 -4px 0 -6px !important; padding: 1px 4px 1px 4px !important;
            }
            body.sc-tv #messagebuffer .nick-highlight {
                background: rgba(185, 130, 255, 0.32) !important;
                border-left: 3px solid rgba(185, 130, 255, 0.95) !important;
            }
            body.sc-tv :focus { outline: 3px solid rgba(255,255,255,0.8) !important; }
            /* D-pad focus highlight (remote navigation) */
            body.sc-tv .sc-tv-focus {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32) !important;
                border-radius: 5px !important;
            }
            /* TV caption — label that appears beside the D-pad focused element */
            body.sc-tv #sc-tv-caption {
                position: fixed !important; z-index: 30001 !important;
                background: rgba(0,0,0,0.82) !important; color: #fff !important;
                font-size: 12px !important; font-weight: 700 !important;
                padding: 5px 14px !important; border-radius: 6px !important;
                pointer-events: none !important; white-space: nowrap !important;
                opacity: 0 !important; transition: opacity 0.15s ease !important;
                letter-spacing: 0.06em !important; text-transform: uppercase !important;
            }
            body.sc-tv #sc-tv-caption.sc-show { opacity: 1 !important; }

            /* ── TV: slick chat input ─────────────────────────── */
            body.sc-tv #sc-mobile-input-row { gap: 10px !important; padding: 6px 0 8px !important; }
            body.sc-tv #sc-chat-textarea {
                min-height: 50px !important;
                background: rgba(255,255,255,0.07) !important;
                border: 1.5px solid rgba(255,255,255,0.14) !important;
                border-radius: 14px !important;
                padding: 12px 16px !important;
                caret-color: #e0701a !important;
                transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease !important;
            }
            /* Typing focus: soft amber glow instead of the harsh white outline */
            body.sc-tv #sc-chat-textarea:focus {
                outline: none !important;
                border-color: rgba(224,112,26,0.85) !important;
                background: rgba(255,255,255,0.10) !important;
                box-shadow: 0 0 0 1px rgba(224,112,26,0.30), 0 0 20px rgba(224,112,26,0.22) !important;
            }
            /* D-pad landing on the input uses the same glow, not the boxy ring */
            body.sc-tv #sc-chat-textarea.sc-tv-focus {
                outline: none !important;
                border-color: rgba(224,112,26,0.85) !important;
                box-shadow: 0 0 0 1px rgba(224,112,26,0.30), 0 0 20px rgba(224,112,26,0.22) !important;
            }
            /* The message log is a large scrollable region -- an outline box around all of it
               would be visual noise, so focus reads as an inset accent edge instead. */
            body.sc-tv #messagebuffer.sc-tv-focus {
                outline: none !important;
                box-shadow: inset 4px 0 0 #e0701a, inset -4px 0 0 rgba(224,112,26,0.25) !important;
            }
            body.sc-tv #sc-send-btn {
                width: 50px !important; height: 50px !important; font-size: 20px !important;
                background: rgba(255,255,255,0.09) !important;
                border: 1.5px solid rgba(255,255,255,0.14) !important;
                transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease !important;
            }
            body.sc-tv #sc-send-btn:focus,
            body.sc-tv #sc-send-btn.sc-tv-focus {
                outline: none !important;
                border-color: rgba(224,112,26,0.85) !important;
                background: rgba(224,112,26,0.18) !important;
                box-shadow: 0 0 0 1px rgba(224,112,26,0.30), 0 0 20px rgba(224,112,26,0.22) !important;
            }
            body.sc-tv #sc-chat-textarea::placeholder { color: rgba(255,255,255,0.32) !important; }

            /* ── COUCH MODE — input swells into a big readable compose box while typing ──
               Active when the setting is on (body.sc-couch) and you're typing in the
               horizontal sidebar layout. The box lifts out of the chat column over the video.

               Open is a TWO-STEP move so it's smooth even on older TV hardware:
               • body.sc-couch-prep  — pins the input as a FIXED box at its COLLAPSED size.
                 JS flushes layout here so the browser has a clean start state.
               • body.sc-couch-typing — then animates only width + height/padding to the big
                 box. Because position is already fixed, nothing snaps; the box just grows.
               We never transition "all" (it flashes through bad intermediate layout states),
               and the costly frosted blur is switched on only AFTER the grow settles. */
            body.sc-couch #sc-mobile-input-row {
                transition: width 0.34s cubic-bezier(0.22, 1, 0.36, 1) !important;
            }
            body.sc-couch #sc-chat-textarea {
                transition: min-height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
                            max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
                            font-size  0.34s cubic-bezier(0.22, 1, 0.36, 1),
                            padding    0.34s cubic-bezier(0.22, 1, 0.36, 1),
                            border-radius 0.34s ease,
                            background-color 0.3s ease,
                            backdrop-filter 0.25s ease,
                            -webkit-backdrop-filter 0.25s ease !important;
            }
            body.sc-couch #messagebuffer {
                transition: padding-bottom 0.34s cubic-bezier(0.22, 1, 0.36, 1) !important;
            }
            /* Lift the chat column's stacking context above the video (both sit at z-index
               9999, with the video later in the DOM) so the fixed box can paint over it. */
            body.sc-couch.sc-couch-prep.sc-horizontal #chatwrap {
                z-index: 10010 !important; overflow: visible !important;
            }
            /* PREP: the input becomes a fixed box at (about) its normal collapsed footprint.
               Explicit width avoids width:100% resolving to the whole viewport once fixed. */
            body.sc-couch.sc-couch-prep.sc-horizontal #sc-mobile-input-row {
                position: fixed !important;
                right: 0 !important; bottom: 0 !important; left: auto !important; top: auto !important;
                width: 19vw !important; z-index: 10011 !important;
                margin: 0 !important; box-sizing: border-box !important;
            }
            body.sc-couch.sc-couch-prep.sc-horizontal #messagebuffer { padding-bottom: 56px !important; }
            /* EXPANDED: grow width + add the panel gradient (position inherited from prep). */
            body.sc-couch.sc-couch-typing.sc-horizontal #sc-mobile-input-row {
                width: 46vw !important;
                padding: 18px 20px 20px !important;
                align-items: stretch !important;
                background: linear-gradient(to top, rgba(0,0,0,0.72) 52%, rgba(0,0,0,0) 100%) !important;
            }
            body.sc-couch.sc-couch-typing.sc-horizontal #sc-chat-textarea {
                min-height: 26vh !important; max-height: 26vh !important;
                line-height: 1.45 !important;
                padding: 16px 18px !important; border-radius: 16px !important;
                background-color: rgba(14,14,18,0.62) !important;
            }
            /* Frosted blur (+ a touch more transparency) only once the box has finished
               expanding — cheap during the grow, lush once it's settled. */
            body.sc-couch.sc-couch-typing.sc-couch-settled.sc-horizontal #sc-chat-textarea {
                background-color: rgba(14,14,18,0.55) !important;
                backdrop-filter: blur(7px) !important;
                -webkit-backdrop-filter: blur(7px) !important;
            }
            /* Bigger box on a TV viewed from the couch (font itself is set inline from JS). */
            body.sc-couch.sc-couch-typing.sc-tv.sc-horizontal #sc-chat-textarea {
                min-height: 30vh !important; max-height: 30vh !important;
            }
            /* Reserve space at the bottom of the chat so no messages sit BEHIND the
               translucent box and bleed through it. They slide up as the box grows. */
            body.sc-couch.sc-couch-typing.sc-horizontal #messagebuffer { padding-bottom: 34vh !important; }
            body.sc-couch.sc-couch-typing.sc-tv.sc-horizontal #messagebuffer { padding-bottom: 38vh !important; }
            /* Keep the compose box clean — drop the floating emote icon while it's open */
            body.sc-couch-typing #sc-emote-proxy { opacity: 0 !important; pointer-events: none !important; }

            /* TV: keep the settings modal inside the overscan-safe area and scrollable */
            body.sc-tv #sc-settings-overlay { padding: 6vh 8vw !important; box-sizing: border-box !important; }
            body.sc-tv #sc-settings-modal {
                max-height: 84vh !important; width: min(620px, 84vw) !important;
                padding: 28px !important;
            }
            body.sc-tv #sc-settings-title { font-size: 22px !important; }
            body.sc-tv .sc-settings-input,
            body.sc-tv .sc-settings-test { font-size: 16px !important; }
            body.sc-tv #sc-settings-save,
            body.sc-tv #sc-settings-cancel,
            body.sc-tv #sc-login-btn { font-size: 16px !important; padding: 12px 22px !important; }

            /* Send button */
            #sc-send-btn {
                flex-shrink: 0 !important; background: rgba(255,255,255,0.12) !important;
                border: none !important; border-radius: 50% !important;
                width: 44px !important; height: 44px !important;
                color: rgba(255,255,255,0.85) !important; font-size: 18px !important;
                cursor: pointer !important; display: flex !important;
                align-items: center !important; justify-content: center !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-mobile-input-row {
                display: flex !important; align-items: flex-end !important;
                gap: 8px !important; width: 100% !important; padding: 4px 0 !important;
            }
            #sc-mobile-input-row #sc-chat-textarea { flex: 1 !important; }

            /* ── WATCH-ONLY MODE — hide chat input + guest login ─ */
            /* #sc-mobile-input-row wraps the textarea, send + emote buttons;
               #chatline is CyTube's original input; #guestlogin is the guest box
               that appears below the input when not signed in. Hidden in both the
               sidebar and overlay chat layouts. messagebuffer reflows to fill. */
            body.sc-watchalong #sc-mobile-input-row,
            body.sc-watchalong #chatline,
            body.sc-watchalong #guestlogin,
            body.sc-watchalong #sc-emote-proxy { display: none !important; }

            /* ── NOW-PLAYING HERO CARD ───────────────────────── */
            #sc-np-card {
                position: fixed !important; inset: 0 !important;
                z-index: 21000 !important;
                background: #000 !important;   /* black base when there's no backdrop image */
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.5s ease !important;
                overflow: hidden !important;
                font-family: system-ui, sans-serif !important;
            }
            #sc-np-card.sc-np-visible { opacity: 1 !important; pointer-events: auto !important; }
            #sc-np-backdrop {
                position: absolute !important; inset: 0 !important;
                background-size: cover !important; background-position: center !important;
                transform: scale(1.05) !important;
                filter: saturate(1.1) !important;
            }
            #sc-np-scrim {
                position: absolute !important; inset: 0 !important;
                background:
                    linear-gradient(90deg, rgba(8,3,6,0.97) 0%, rgba(8,3,6,0.82) 40%, rgba(8,3,6,0.45) 100%),
                    linear-gradient(0deg, rgba(8,3,6,0.95) 0%, rgba(8,3,6,0) 45%) !important;
            }
            #sc-np-content {
                position: absolute !important;
                left: 6% !important; bottom: 12% !important; right: 6% !important;
                display: flex !important; gap: 32px !important; align-items: flex-end !important;
            }
            #sc-np-poster {
                width: 200px !important; border-radius: 10px !important;
                box-shadow: 0 16px 48px rgba(0,0,0,0.8) !important;
                flex-shrink: 0 !important;
            }
            #sc-np-info { color: #fff !important; max-width: 60% !important; }
            #sc-np-eyebrow {
                font-size: 13px !important; font-weight: 700 !important;
                letter-spacing: 0.18em !important; text-transform: uppercase !important;
                color: var(--np-accent, #ff5b73) !important; margin-bottom: 10px !important;
            }
            /* Font-size for long titles is shrunk in JS (see showNowPlayingCard) based on
               length -- this line-clamp is just the hard backstop so a title long enough to
               still wrap past 3 lines at the smallest tier truncates with an ellipsis instead
               of pushing the card's bottom-anchored content off the top of the screen. */
            #sc-np-title {
                font-size: 44px !important; font-weight: 800 !important; line-height: 1.05 !important;
                text-shadow: 0 2px 16px rgba(0,0,0,0.8) !important; margin-bottom: 14px !important;
                display: -webkit-box !important; -webkit-line-clamp: 3 !important;
                -webkit-box-orient: vertical !important; overflow: hidden !important;
            }
            #sc-np-meta {
                font-size: 17px !important; color: rgba(255,255,255,0.82) !important;
                margin-bottom: 16px !important; font-weight: 500 !important;
            }
            #sc-np-overview {
                font-size: 16px !important; line-height: 1.5 !important;
                color: rgba(255,255,255,0.72) !important; margin-bottom: 16px !important;
                /* Fixed window (≈4 lines, scales with font-size via em) that we then
                   auto-scroll to reveal the rest — no scrollbar, just a clipped glide. */
                max-height: 6em !important; overflow: hidden !important;
            }
            #sc-np-overview::-webkit-scrollbar { display: none !important; }
            #sc-np-chips { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
            #sc-np-progress { margin-top: 18px !important; max-width: 520px !important; }
            #sc-np-prog-bar {
                height: 6px !important; border-radius: 3px !important;
                background: rgba(255,255,255,0.18) !important; overflow: hidden !important;
            }
            #sc-np-prog-fill {
                height: 100% !important; width: 0% !important;
                background: var(--np-accent, #e0701a) !important; border-radius: 3px !important;
                transition: width 0.45s linear !important;
            }
            #sc-np-prog-times {
                display: flex !important; justify-content: space-between !important;
                align-items: baseline !important; margin-top: 8px !important;
                font-variant-numeric: tabular-nums !important;
                font-size: 14px !important; color: rgba(255,255,255,0.85) !important;
            }
            #sc-np-prog-remain { color: rgba(255,255,255,0.6) !important; font-size: 13px !important; }
            /* Actions row -- links (phone/tablet only, see nowplaying.js) + Trivia, grouped
               together so both read as the card's "do something" affordances. */
            #sc-np-actions {
                display: flex !important; align-items: center !important;
                gap: 12px !important; flex-wrap: wrap !important;
                margin-top: 14px !important;
            }
            #sc-np-links { display: flex !important; gap: 10px !important; }
            /* IMDb/Letterboxd/Wikipedia badges -- 48px clears the ~44px minimum comfortable
               touch target (phone/tablet only; TV never renders these -- see nowplaying.js). */
            .sc-np-link {
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                width: 48px !important; height: 48px !important;
                border-radius: 12px !important;
                font-size: 20px !important; font-weight: 900 !important;
                text-decoration: none !important;
                line-height: 1 !important; font-family: Georgia, serif !important;
                flex-shrink: 0 !important; cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(0,0,0,0.4) !important;
                transition: transform 0.15s ease, filter 0.2s ease !important;
            }
            .sc-np-link:hover { filter: brightness(1.15) !important; }
            .sc-np-link:active { transform: scale(0.92) !important; }
            /* Trivia entry point -- same size/style as .sc-np-link above (they sit in the same
               #sc-np-actions row) rather than its own bespoke pill. */
            #sc-np-trivia-btn {
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                height: 48px !important; padding: 0 20px !important;
                border-radius: 12px !important;
                font-size: 15px !important; font-weight: 900 !important;
                color: rgba(255,255,255,0.92) !important;
                background: rgba(255,255,255,0.14) !important;
                border: none !important;
                cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(0,0,0,0.4) !important;
                transition: transform 0.15s ease, filter 0.2s ease, background 0.2s ease !important;
            }
            #sc-np-trivia-btn:hover { background: rgba(255,255,255,0.22) !important; filter: brightness(1.15) !important; }
            #sc-np-trivia-btn:active { transform: scale(0.92) !important; }
            body.sc-tv #sc-np-prog-bar { height: 8px !important; }
            body.sc-tv #sc-np-prog-times { font-size: 18px !important; }
            body.sc-tv #sc-np-prog-remain { font-size: 16px !important; }
            .sc-np-chip {
                font-size: 13px !important; color: rgba(255,255,255,0.9) !important;
                background: rgba(255,255,255,0.12) !important;
                border: 1px solid rgba(255,255,255,0.18) !important;
                border-radius: 999px !important; padding: 5px 12px !important;
                backdrop-filter: blur(4px) !important;
            }
            /* Parent-guide severity colors */
            .sc-np-chip.sc-sev-none     { background: rgba(120,120,130,0.30) !important; border-color: rgba(160,160,170,0.4) !important; }
            .sc-np-chip.sc-sev-mild     { background: rgba(60,160,80,0.32)  !important; border-color: rgba(90,200,110,0.5) !important; color: #c9ffd4 !important; }
            .sc-np-chip.sc-sev-moderate { background: rgba(200,150,40,0.34)  !important; border-color: rgba(230,180,60,0.55) !important; color: #ffe9b8 !important; }
            .sc-np-chip.sc-sev-severe   { background: rgba(200,60,50,0.38)   !important; border-color: rgba(235,90,80,0.6) !important; color: #ffd2cc !important; }
            :root { --np-accent: #ff5b73; }

            /* TV: scale the card up for the couch */
            body.sc-tv #sc-np-poster { width: 260px !important; }
            body.sc-tv #sc-np-title { font-size: 60px !important; }
            body.sc-tv #sc-np-meta { font-size: 22px !important; }
            body.sc-tv #sc-np-overview { font-size: 20px !important; }
            body.sc-tv .sc-np-chip { font-size: 16px !important; padding: 7px 16px !important; }

            /* ── UP NEXT LINK (subtle, top-right next to Coming Attractions) ── */
            #sc-up-next-btn {
                position: fixed !important; top: 0 !important;
                right: calc(20vw + 150px) !important; left: auto !important;
                z-index: 10003 !important;
                background: transparent !important; border: none !important;
                color: rgba(255,255,255,0.55) !important;
                font-size: 10px !important; letter-spacing: 0.06em !important;
                text-transform: uppercase !important; white-space: nowrap !important;
                line-height: 1 !important; height: 20px !important; padding: 2px 8px !important;
                display: flex !important; align-items: center !important; cursor: pointer !important;
                opacity: 1 !important; transition: opacity 1.5s ease, color 0.2s ease !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-up-next-btn:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-up-next-btn.sc-bar-dim { opacity: 0 !important; }
            /* Flows in the header's flex row instead of computing its own
               position from the viewport — see the #videowrap-header flex
               rules in base.css. Previously hidden entirely in vertical
               because the old fixed-position math had nowhere to put it. */
            body.sc-vertical #sc-up-next-btn {
                position: static !important;
                flex-shrink: 0 !important;
            }
            body.sc-tv #sc-up-next-btn { font-size: 12px !important; }

            /* ── UP NEXT CARD — embeds the channel's schedule/queue bot dashboard,
               matching the desktop userscript's own panel exactly (iframe, not a
               native reimplementation -- see cards/upnext.js). ─────────────────── */
            #sc-upnext-card {
                position: fixed !important;
                top: 60px !important; right: 8px !important;
                width: min(760px, calc(100vw - 10px)) !important;
                height: 70vh !important;
                z-index: 20800 !important;
                background: rgba(10,10,20,0.95) !important;
                border: 1px solid #aaaaaa !important;
                border-radius: 8px !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
                overflow: hidden !important;
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.3s ease !important;
                display: flex !important; flex-direction: column !important;
            }
            #sc-upnext-card.sc-upnext-visible { opacity: 1 !important; pointer-events: auto !important; }
            body.sc-vertical #sc-upnext-card { right: 5px !important; left: 5px !important; width: auto !important; height: 50vh !important; top: 60px !important; }
            #sc-upnext-head {
                display: flex !important; align-items: center !important; justify-content: space-between !important;
                padding: 8px 12px !important;
                border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                flex-shrink: 0 !important;
                font-size: 12px !important; font-weight: 700 !important;
                letter-spacing: 0.04em !important; text-transform: uppercase !important;
                color: rgba(255,255,255,0.7) !important;
            }
            #sc-upnext-close {
                background: rgba(255,255,255,0.1) !important; border: none !important; color: #fff !important;
                width: 24px !important; height: 24px !important; border-radius: 50% !important;
                cursor: pointer !important; font-size: 11px !important; flex-shrink: 0 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
            }
            #sc-upnext-close:hover { background: rgba(255,255,255,0.2) !important; }
            /* overflow-x: hidden, not auto -- the zoomed iframe below is sized to fit
               within 100% width exactly (with a safety margin), so there's nothing to
               scroll sideways; allowing horizontal scroll here just let content get
               silently clipped past the right edge with no way back to it. */
            #sc-upnext-body { flex: 1 !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: hidden !important; }
            #sc-upnext-body::-webkit-scrollbar { width: 10px !important; }
            #sc-upnext-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.05) !important; border-radius: 10px !important; margin: 6px 0 !important; }
            #sc-upnext-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28) !important; border-radius: 10px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
            #sc-upnext-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45) !important; background-clip: padding-box !important; }
            body.sc-tv #sc-upnext-body::-webkit-scrollbar { width: 14px !important; }
            /* Not !important -- cards/upnext.js toggles the iframe's own style.display
               between 'none' (waiting on load/timeout) and 'block' (once it loads); an
               !important rule here would always beat that inline style and permanently
               show a blank frame instead of the loading/error state underneath it. */
            #sc-upnext-frame { width: 100% !important; height: 100% !important; border: none !important; }
            .sc-upnext-loading, .sc-upnext-error {
                display: flex !important; align-items: center !important; justify-content: center !important;
                height: 100% !important; padding: 20px !important;
                color: rgba(255,255,255,0.5) !important; font-size: 13px !important; text-align: center !important;
            }
            body.sc-tv #sc-upnext-head { font-size: 13px !important; padding: 6px 10px !important; }
            body.sc-tv #sc-upnext-close { width: 26px !important; height: 26px !important; font-size: 12px !important; }
            body.sc-tv .sc-upnext-loading, body.sc-tv .sc-upnext-error { font-size: 19px !important; }
            /* TV: the bot's dashboard is a desktop-sized page (tables/text sized for a
               monitor an arm's length away) rendered 1:1 in the iframe -- on a big screen
               that reads as one or two giant rows with everything else needing a scroll
               most viewers won't think to try. Two fixes together: a much bigger panel
               (more screen real estate to work with), and \`zoom\` on the iframe itself to
               shrink the page's effective rendering so more of the schedule is visible at
               once without scrolling. \`zoom\` (not \`transform: scale\`) is used because it
               actually reflows the child page at the smaller size instead of just
               rescaling a rasterized layer, so its own internal proportions/line-wrapping
               stay sane instead of just shrinking blurrily. The iframe's width/height are
               scaled up by the inverse of the zoom factor first, since \`zoom\` shrinks the
               box's rendered size along with its content -- without the compensation the
               iframe would visually occupy less than the full panel, leaving empty space
               around it, instead of filling it while showing more content within it.
               Width is deliberately UNDER the exact inverse (166.7%) -- #sc-upnext-body now
               has overflow-x: hidden (no sideways scroll, see above), so any width overrun
               would silently clip content with no way to reach it; a few percent of unused
               space on the right is a far better failure mode than that. Height has no such
               constraint (vertical overflow is the whole point -- that's what the scrollbar
               is for), so it stays at the exact inverse. */
            body.sc-tv #sc-upnext-card { width: min(1200px, 94vw) !important; height: 84vh !important; top: 30px !important; }
            body.sc-tv #sc-upnext-frame { zoom: 0.6 !important; width: 160% !important; height: 166.7% !important; }

            #sc-trivia-card {
                position: fixed !important; inset: 0 !important; z-index: 21800 !important;
                background: rgba(0,0,0,0.62) !important; backdrop-filter: blur(3px) !important;
                display: none !important; align-items: center !important; justify-content: center !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
            }
            #sc-trivia-card.sc-show { display: flex !important; }
            #sc-trivia-panel {
                width: min(820px, 86vw) !important; max-height: 82vh !important;
                background: rgba(14,10,18,0.97) !important;
                border: 1px solid rgba(255,255,255,0.14) !important;
                border-radius: 14px !important; overflow: hidden !important;
                display: flex !important; flex-direction: column !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
            }
            #sc-trivia-head {
                display: flex !important; align-items: center !important; justify-content: space-between !important;
                padding: 16px 20px !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                flex-shrink: 0 !important;
            }
            #sc-trivia-title { font-size: 18px !important; font-weight: 800 !important; color: var(--np-accent,#ff5b73) !important; }
            #sc-trivia-close {
                background: rgba(255,255,255,0.1) !important; border: none !important; color: #fff !important;
                width: 32px !important; height: 32px !important; border-radius: 50% !important;
                cursor: pointer !important; font-size: 14px !important; flex-shrink: 0 !important;
            }
            #sc-trivia-close:hover { background: rgba(255,255,255,0.2) !important; }
            #sc-trivia-list {
                overflow-y: auto !important; padding: 4px 20px 20px !important;
                -webkit-overflow-scrolling: touch !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.28) transparent !important;
            }
            #sc-trivia-list::-webkit-scrollbar { width: 10px !important; }
            #sc-trivia-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05) !important; border-radius: 10px !important; margin: 6px 0 !important; }
            #sc-trivia-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28) !important; border-radius: 10px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
            #sc-trivia-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45) !important; background-clip: padding-box !important; }
            body.sc-tv #sc-trivia-list::-webkit-scrollbar { width: 14px !important; }
            .sc-trivia-item {
                color: rgba(255,255,255,0.86) !important; font-size: 14px !important; line-height: 1.5 !important;
                padding: 12px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            }
            body.sc-tv #sc-trivia-panel { width: min(1100px, 84vw) !important; max-height: 84vh !important; }
            body.sc-tv #sc-trivia-title { font-size: 26px !important; }
            body.sc-tv #sc-trivia-close { width: 44px !important; height: 44px !important; font-size: 20px !important; }
            body.sc-tv .sc-trivia-item { font-size: 20px !important; padding: 16px 0 !important; }

            /* ── TONIGHT'S LINEUP (full-screen TV schedule, day tabs + sections) ─── */
            #sc-lineup-screen {
                position: fixed !important; inset: 0 !important;
                z-index: 20500 !important; /* below #sc-np-card (21000) so OK on a film covers this */
                background: rgba(6,4,9,0.97) !important;
                display: none !important; flex-direction: column !important;
                align-items: flex-start !important; justify-content: flex-start !important;
                font-family: 'Inter','Roboto',system-ui,sans-serif !important;
                padding: 2vh 4vw !important; box-sizing: border-box !important;
            }
            #sc-lineup-screen.sc-lineup-visible { display: flex !important; }
            #sc-lineup-close {
                position: absolute !important; top: 16px !important; right: 16px !important;
                background: rgba(255,255,255,0.1) !important; border: none !important; color: #fff !important;
                width: 32px !important; height: 32px !important; border-radius: 50% !important;
                cursor: pointer !important; font-size: 14px !important; z-index: 1 !important;
            }
            #sc-lineup-close:hover { background: rgba(255,255,255,0.2) !important; }
            body.sc-tv #sc-lineup-close { width: 44px !important; height: 44px !important; font-size: 20px !important; }
            #sc-lineup-header {
                color: #fff !important; font-size: 14px !important; font-weight: 700 !important;
                line-height: 1.25 !important; margin-bottom: 4px !important;
                max-width: calc(100% - 50px) !important; /* clear the close button */
            }
            #sc-lineup-subtitle {
                color: rgba(255,255,255,0.45) !important; font-size: 11px !important;
                margin-bottom: 12px !important;
            }
            body.sc-tv #sc-lineup-header { font-size: 15px !important; }
            body.sc-tv #sc-lineup-subtitle { font-size: 12px !important; }
            #sc-lineup-body {
                width: 100% !important; display: flex !important; flex-direction: column !important; gap: 20px !important;
                flex: 1 1 auto !important; min-height: 0 !important;
                /* Phone/tablet (base): every section in the active day stacks here, each sized to
                   its own content -- native touch-scroll moves between them, no swipe/gesture
                   code (this codebase has none). TV overrides below: stepLineupSection() in
                   screen.js swaps in exactly one (full-height) section at a time instead (a
                   Netflix-row-style pager), so there's nothing to scroll there. */
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
            }
            body.sc-tv #sc-lineup-body { overflow: hidden !important; gap: 0 !important; }

            /* Day tabs — ticket-stub shape (torn-off-a-strip perforation + a paper-grain
               texture), replacing the old plain pill/solid-fill-box look. The whole-page
               geometric scorer still handles Left/Right across tabs and Up/Down into the
               first section on its own (no special-case nav code needed, see tvnav.js). */
            #sc-lineup-daytabs {
                display: flex !important; gap: 14px !important; margin: 0 -6px 6px !important;
                padding: 0 6px !important; /* room for the focus outline/box-shadow at the scroll edges below --
                    without this the first/last tab's ring gets clipped by overflow-x; the matching
                    negative margin keeps the row visually flush with the header/subtitle above it */
                flex-shrink: 0 !important; /* never squashed by #sc-lineup-body's flex sibling */
                overflow-x: auto !important; /* safety net on very narrow phones -- scrolls rather than breaking */
            }
            .sc-lineup-daytab {
                position: relative !important; overflow: hidden !important;
                background: #c9c2b8 !important; border: 1px solid #b0a89c !important;
                color: #4a4238 !important; font-family: 'Alfa Slab One', serif !important; font-weight: 400 !important;
                font-size: 13px !important; letter-spacing: 0.01em !important;
                padding: 9px 16px 9px 24px !important; border-radius: 3px !important; cursor: pointer !important;
            }
            .sc-lineup-daytab-label { position: relative !important; z-index: 2 !important; }
            /* Perforation edge: a dashed tear-line plus a column of punch-holes just inside it,
               like the tab was torn off a longer ticket strip. The hole color is hardcoded to
               match #sc-lineup-screen's own near-opaque background (rgba(6,4,9,0.97)) since a
               real cutout isn't possible on an opaque button -- this fakes it convincingly
               enough at the sizes these tabs render at. */
            .sc-lineup-daytab::before {
                content: '' !important; position: absolute !important; z-index: 1 !important;
                left: 9px !important; top: 4px !important; bottom: 4px !important; width: 7px !important;
                border-left: 2px dashed rgba(0,0,0,0.2) !important;
                background-image: radial-gradient(circle, #060409 2.5px, transparent 2.6px) !important;
                background-size: 7px 12px !important; background-repeat: repeat-y !important;
            }
            /* Subtle paper-grain texture (SVG filter defined once in screen.js's template) --
               feTurbulence ignores the element's own pixels, so this pseudo-element just
               becomes translucent noise layered over the ticket; kept faint (matrix alpha
               0.08) so it reads as slightly rough cardstock rather than visual noise. */
            .sc-lineup-daytab::after {
                content: '' !important; position: absolute !important; inset: 0 !important; z-index: 1 !important;
                filter: url(#sc-ticket-grain) !important; pointer-events: none !important;
            }
            /* Deep ticket-red + a torn edge for the selected day, replacing the old solid
               burnt-orange "highlight box". Still a static UI chrome color (not the
               video-sampled --np-accent) so it doesn't shift with whatever's playing. The tear
               runs the full left edge (where the perforation implies it was ripped off the
               strip) plus small nicks at both right corners -- most of the right edge stays
               straight so it doesn't read as a fully ragged shape. */
            /* No border on any red state -- the fill color (plus the tear shape for selected)
               is enough signal on its own; a border rim on top just added visual noise. */
            .sc-lineup-daytab-active {
                background: #7a1f1a !important; border: none !important; color: #f5e4c8 !important;
                clip-path: polygon(
                    6% 0%, 88% 0%, 94% 4%, 100% 9%, 95% 14%, 100% 19%,
                    100% 81%, 95% 86%, 100% 91%, 94% 96%, 88% 100%, 6% 100%,
                    2% 97%, 9% 92%, 5% 84%, 9% 76%, 6% 66%, 9% 56%, 5% 46%, 9% 36%, 6% 26%, 9% 16%, 2% 6%, 6% 0%
                ) !important;
            }
            .sc-lineup-daytab-active::before { border-left-color: rgba(245,228,200,0.3) !important; }
            body.sc-tv .sc-lineup-daytab { font-size: 15px !important; padding: 11px 20px 11px 26px !important; }
            /* Focused (remote is pointing here, not yet committed): a lighter/warmer red fill
               instead of the old orange outline ring, so focus and selection both read through
               the same "red means highlighted" language -- the tear is what narrows it down to
               the actually-selected day. */
            body.sc-tv .sc-lineup-daytab.sc-tv-focus {
                background: #96332b !important; border: none !important; color: #f5e4c8 !important;
                outline: none !important; box-shadow: none !important;
            }
            body.sc-tv .sc-lineup-daytab.sc-tv-focus::before { border-left-color: rgba(245,228,200,0.3) !important; }
            /* Selected AND focused at once (remote sitting on today's already-chosen day) gets
               its own third shade -- distinct from either state alone, so the three meanings
               (pointed-at, chosen, both) each read as a different red rather than one silently
               overriding the other. */
            body.sc-tv .sc-lineup-daytab-active.sc-tv-focus {
                background: #c0392b !important; border: none !important;
            }

            /* Base (phone/tablet): each section sizes to its own content and several stack in
               normal flow -- native scroll moves between them, so there's no reason to pad one
               out to a full screenful (confirmed on a tall tablet: forcing height:100% there
               left huge empty gradient space above/below a single 3-poster row). TV overrides
               to height:100% below: there's only ever one section at a time (the pager's
               current one), and filling the screen is exactly the point there. Background is a
               gradient washed with the section's own theme color (see sectionThemes.js --
               --sc-lineup-wash is set per-instance in screen.js) tying its header and its row of
               posters together. */
            .sc-lineup-section {
                position: relative !important; width: 100% !important;
                flex-shrink: 0 !important;
                border-radius: 10px !important; overflow: hidden !important;
                background: linear-gradient(160deg, var(--sc-lineup-wash, #14141a) 0%, #0a080d 78%) !important;
                display: flex !important; flex-direction: column !important; justify-content: center !important;
                padding: 14px 0 16px !important; box-sizing: border-box !important;
            }
            /* TV pager: the single current section fills the screen (flex-shrink:0 keeps it at
               that full height instead of being proportionally squashed -- confirmed during the
               original TV build: without this, poster art rendered at ~40% height, silently
               clipped by this element's own overflow:hidden). */
            body.sc-tv .sc-lineup-section { height: 100% !important; }
            .sc-lineup-section-fallback { background: none !important; padding: 0 !important; }
            .sc-lineup-section-name {
                font-weight: 700 !important; font-size: 24px !important;
                padding: 0 24px 14px !important; text-shadow: 0 2px 10px rgba(0,0,0,0.55) !important;
                /* color/font-family are set per-instance in screen.js (each section's theme) --
                   these are just safety defaults for before that runs. letter-spacing/uppercase
                   deliberately omitted: these are expressive display fonts (Creepster, Monoton,
                   Vast Shadow, ...), forcing tracking/case on them fights their own design. */
                color: #fff !important;
            }
            body.sc-tv .sc-lineup-section-name { font-size: 30px !important; }
            /* Narrower portrait phones: shrink slightly so the wider display fonts (Boogaloo,
               Vast Shadow, ...) wrap cleanly instead of running close to the edge. */
            body.sc-vertical:not(.sc-tv) .sc-lineup-section-name { font-size: 20px !important; }
            .sc-lineup-rail {
                position: relative !important;
                display: flex !important; gap: 22px !important; width: 100% !important;
                overflow-x: auto !important; overflow-y: hidden !important;
                padding: 8px 24px 14px !important;
                /* Snap fully to each item so paging Left/Right (and scrolling back) always
                   settles on a whole poster — without this, scrollIntoView({inline:'nearest'})
                   can leave a partially-scrolled position that chops a poster's edge. */
                scroll-snap-type: x mandatory !important;
                /* Mandatory snap otherwise ignores the container's own padding as reserved
                   space and skips past it — this keeps the first/last item's snap position
                   inside the padding instead of flush with the unpadded scrollport edge. */
                scroll-padding: 8px 24px 14px !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.28) transparent !important;
            }
            .sc-lineup-rail::-webkit-scrollbar { height: 8px !important; }
            .sc-lineup-rail::-webkit-scrollbar-track { background: rgba(255,255,255,0.05) !important; border-radius: 10px !important; }
            .sc-lineup-rail::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.28) !important; border-radius: 10px !important;
                border: 2px solid transparent !important; background-clip: padding-box !important;
            }
            .sc-lineup-rail::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45) !important; background-clip: padding-box !important; }
            body.sc-tv .sc-lineup-rail::-webkit-scrollbar { height: 10px !important; }
            #sc-lineup-loading { color: rgba(255,255,255,0.6) !important; font-size: 18px !important; }
            .sc-lineup-item {
                flex: 0 0 185px !important; background: transparent !important; border: none !important;
                color: #fff !important; cursor: pointer !important; text-align: left !important;
                padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 10px !important;
                scroll-snap-align: start !important;
            }
            .sc-lineup-poster {
                position: relative !important; /* anchors the eta badge + no-art fallback title below */
                width: 185px !important; height: 278px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: contain !important; background-repeat: no-repeat !important;
                background-position: center !important;
                box-shadow: 0 6px 14px rgba(0,0,0,0.45) !important;
                flex-shrink: 0 !important; /* keep the box exact regardless of available space */
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
            /* Already-shown films tonight (and every film on a past day's tab) dim to
               grayscale; the D-pad focus outline below still applies, so grayed posters
               stay reachable/legible for the remote. */
            .sc-lineup-item-played .sc-lineup-poster {
                filter: grayscale(1) !important;
                opacity: 0.45 !important;
            }
            /* Narrower portrait phones: smaller posters so more of the next one peeks in as a
               "there's more, scroll me" hint (the rail already scrolls horizontally regardless
               of size -- this is purely a fit/affordance tweak, still an exact 2:3 ratio). */
            body.sc-vertical:not(.sc-tv) .sc-lineup-item { flex-basis: 150px !important; }
            body.sc-vertical:not(.sc-tv) .sc-lineup-poster { width: 150px !important; height: 225px !important; }
            .sc-lineup-title { font-size: 15px !important; font-weight: 600 !important; line-height: 1.3 !important; }
            /* No TMDB match at all -- the poster box shows the movie's own title/year instead of
               sitting empty; the item's external .sc-lineup-title is omitted in this case (see
               screen.js) so the name isn't shown twice. */
            .sc-lineup-poster-fallback {
                position: absolute !important; inset: 0 !important; display: flex !important;
                align-items: center !important; justify-content: center !important; text-align: center !important;
                padding: 14px !important; box-sizing: border-box !important; overflow: hidden !important;
                color: rgba(255,255,255,0.85) !important; font-weight: 600 !important;
                line-height: 1.35 !important;
            }
            /* Start-time estimate, overlaid directly on the poster art (a caption bar pinned to
               its bottom edge) instead of a separate line below -- readable over any art via the
               gradient backing, regardless of NOW PLAYING/estimated/blank state. Bebas Neue is a
               marquee-style condensed face (loaded with the theme fonts, see sectionThemes.js);
               it runs visually small for its px size, hence 18px where the old face used 13px. */
            .sc-lineup-eta {
                position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                padding: 18px 10px 6px !important; box-sizing: border-box !important;
                background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 100%) !important;
                border-radius: 0 0 8px 8px !important;
                font-family: 'Bebas Neue', 'Inter', 'Roboto', system-ui, sans-serif !important;
                font-size: 18px !important; font-weight: 400 !important; letter-spacing: 0.06em !important;
                color: rgba(255,255,255,0.85) !important;
                text-align: center !important;
            }
            .sc-lineup-item-current .sc-lineup-eta { color: var(--np-accent, #ff5b73) !important; }
            /* D-pad focus ring highlights just the poster art (not the whole tile — title/eta
               stay plain), matching how the "now playing" marker above is scoped. Overrides
               the generic body.sc-tv .sc-tv-focus rule via higher selector specificity. */
            body.sc-tv .sc-lineup-item.sc-tv-focus { outline: none !important; box-shadow: none !important; }
            body.sc-tv .sc-lineup-item.sc-tv-focus .sc-lineup-poster {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(224,112,26,0.32), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
            /* Display-only fallback items (Coming Attractions art with no real title/time data)
               get a gray focus ring instead of orange, signaling there's nothing to select. */
            body.sc-tv .sc-lineup-item-static.sc-tv-focus .sc-lineup-poster {
                outline: 3px solid #888 !important; outline-offset: 2px !important;
                box-shadow: 0 0 0 5px rgba(136,136,136,0.32), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
            body.sc-tv .sc-lineup-item { flex-basis: 190px !important; }
            body.sc-tv .sc-lineup-poster { width: 190px !important; height: 285px !important; }
            body.sc-tv .sc-lineup-title { font-size: 16px !important; }
            body.sc-tv .sc-lineup-eta { font-size: 14px !important; }

            /* Vertical phones (if enabled there): stack poster above text */
            body.sc-vertical #sc-np-content { flex-direction: column !important; align-items: flex-start !important; gap: 18px !important; bottom: 8% !important; }
            body.sc-vertical #sc-np-poster { width: 130px !important; }
            body.sc-vertical #sc-np-title { font-size: 30px !important; }
            body.sc-vertical #sc-np-info { max-width: 90% !important; }

            /* ── AMBIENT GLOW ────────────────────────────────── */
            #sc-ambient {
                position: fixed !important; inset: 0 !important;
                z-index: 10000 !important; pointer-events: none !important;
                box-shadow: inset 0 0 160px 36px var(--sc-ambient-color, rgba(0,0,0,0)) !important;
                transition: box-shadow 1.6s ease !important;
            }
            body.sc-ambient-off #sc-ambient { display: none !important; }
            /* Ambient glow is a TV-only cinematic touch — no edge glow on phones */
            body:not(.sc-tv) #sc-ambient { display: none !important; }

            /* ── PICTURE-IN-PICTURE: show ONLY the video, full-bleed ──────────────
               html-prefixed so these win over the body.sc-vertical / .sc-horizontal
               layout rules (which otherwise tie on specificity and come later). */
            html body.sc-pip #videowrap,
            html body.sc-pip #videowrap .embed-responsive,
            html body.sc-pip #ytapiplayer,
            html body.sc-pip #ytapiplayer iframe,
            html body.sc-pip .video-js,
            html body.sc-pip .vjs-tech {
                position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                width: 100vw !important; height: 100vh !important; z-index: 2147483647 !important;
                margin: 0 !important; background: #000 !important;
            }
            html body.sc-pip #chatwrap, html body.sc-pip #sc-chat-header, html body.sc-pip #sc-ambient,
            html body.sc-pip #sc-top-bar, html body.sc-pip #videowrap-header,
            html body.sc-pip #sc-movie-stats, html body.sc-pip #sc-poster-toggle,
            html body.sc-pip #sc-up-next-btn, html body.sc-pip #sc-chatmode-btn, html body.sc-pip #sc-cluster-grip,
            html body.sc-pip #sc-desync-btn, html body.sc-pip #sc-settings-btn,
            html body.sc-pip #sc-users-panel, html body.sc-pip #sc-poll-panel,
            html body.sc-pip #sc-np-card, html body.sc-pip #sc-trivia-card, html body.sc-pip #sc-subtitles-overlay,
            html body.sc-pip #sc-upnext-card, html body.sc-pip #sc-link-pip-panel, html body.sc-pip #sc-link-pip-prompt,
            html body.sc-pip #sc-lineup-screen,
            html body.sc-pip #sc-mobile-input-row, html body.sc-pip .video-js .vjs-control-bar,
            html body.sc-pip #sc-yt-scrubber, html body.sc-pip #sc-seek-hud {
                display: none !important;
            }
            /* Chat-Only + PiP: the video is deliberately paused/muted/hidden in this mode
               (see enterChatOnly, chat/modes.js), so the general rule above just leaves a
               blank window behind the "Paused · Muted" banner -- a movie-shaped PiP window
               makes no sense here. Show the chat itself instead (read-only -- no room/point
               typing into a floating PiP window, so the input row stays hidden same as
               above). Higher specificity than both the general PiP hide-list and chatonly's
               own #chatwrap rule (2 body classes vs. their 1), so this wins over each. */
            html body.sc-pip.sc-chat-chatonly #chatwrap {
                display: flex !important; flex-direction: column !important;
                position: fixed !important; inset: 0 !important;
                width: 100vw !important; height: 100vh !important;
                z-index: 2147483647 !important;
                background: #0c0a14 !important;
                padding: 6px !important; box-sizing: border-box !important;
            }
            html body.sc-pip.sc-chat-chatonly #messagebuffer {
                font-size: 11px !important; line-height: 1.3 !important;
            }
            html body.sc-pip.sc-chat-chatonly #sc-chatonly-banner { display: none !important; }

            /* ── CAST MODE: phone becomes a chat remote with a top control bar ─────
               While casting, the movie plays on the TV, so on the device we hide the
               player and give the screen to chat. A dedicated top bar (#sc-cast-bar,
               built in JS) holds the title plus the relocated controls (coming
               attractions, trivia, users, poll, settings) and a Stop Casting button.
               The player must keep PLAYING for the sync conductor's clock, so we make it
               invisible via opacity/z-index rather than display:none (which can pause it). */
            html body.sc-cast #videowrap,
            html body.sc-cast #videowrap .embed-responsive,
            html body.sc-cast #ytapiplayer,
            html body.sc-cast #ytapiplayer iframe,
            html body.sc-cast .video-js,
            html body.sc-cast .vjs-tech {
                opacity: 0 !important; z-index: -1 !important; pointer-events: none !important;
            }
            /* The cast top bar — only present/visible in cast mode */
            #sc-cast-bar { display: none !important; }
            html body.sc-cast #sc-cast-bar {
                display: flex !important; align-items: center !important;
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 40px !important;
                padding: 0 12px !important; gap: 14px !important; box-sizing: border-box !important;
                background: rgba(12,10,20,0.97) !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                z-index: 10006 !important;
            }
            /* Title takes the remaining width and ellipsises; still opens the now-playing card */
            html body.sc-cast #sc-cast-title-slot {
                flex: 1 1 auto !important; min-width: 0 !important;
                overflow: hidden !important; white-space: nowrap !important; text-overflow: ellipsis !important;
                color: #fff !important; font-size: 13px !important; font-weight: 500 !important;
            }
            /* The relocated title header sits inline inside the slot (strip its fixed-overlay
               styling). It always carries the current title, raw text or #sc-title-text span. */
            html body.sc-cast #sc-cast-title-slot #videowrap-header {
                position: static !important; width: auto !important; max-width: 100% !important;
                height: auto !important; line-height: normal !important;
                padding: 0 !important; margin: 0 !important;
                background: transparent !important; border: none !important; box-shadow: none !important;
                z-index: auto !important; color: #fff !important;
                font-size: 13px !important; font-weight: 500 !important; opacity: 1 !important;
                white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
            }
            /* Don't let the idle dimmer fade the title while it's in the cast bar */
            html body.sc-cast #sc-cast-title-slot #videowrap-header.sc-bar-dim {
                opacity: 1 !important; color: #fff !important; background: transparent !important;
            }
            html body.sc-cast #sc-cast-title-slot #sc-title-text {
                color: #fff !important; opacity: 1 !important; pointer-events: auto !important;
            }
            html body.sc-cast #sc-cast-controls {
                display: flex !important; align-items: center !important;
                gap: 14px !important; flex: 0 0 auto !important;
            }
            /* Neutralise each relocated control's own fixed positioning / hover-hide so
               they simply flow inside the bar. */
            html body.sc-cast #sc-cast-bar #sc-poster-toggle,
            html body.sc-cast #sc-cast-bar #sc-up-next-btn,
            html body.sc-cast #sc-cast-bar #sc-usercount-btn,
            html body.sc-cast #sc-cast-bar #sc-poll-btn,
            html body.sc-cast #sc-cast-bar #sc-settings-btn,
            html body.sc-cast #sc-cast-bar #sc-cast-stop-btn {
                position: static !important; top: auto !important; left: auto !important;
                right: auto !important; bottom: auto !important;
                opacity: 1 !important; transform: none !important; pointer-events: auto !important;
                margin: 0 !important; box-shadow: none !important;
                display: inline-flex !important; align-items: center !important;
            }
            html body.sc-cast #sc-cast-stop-btn {
                background: #b3261e !important; color: #fff !important; border: none !important;
                border-radius: 6px !important; padding: 5px 12px !important;
                font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important;
                white-space: nowrap !important;
            }
            html body.sc-cast #sc-cast-stop-btn:hover { background: #c8352c !important; }
            /* Chat fills everything under the bar down to the bottom */
            html body.sc-cast #chatwrap {
                position: fixed !important; top: 40px !important; bottom: 0 !important;
                left: 0 !important; right: 0 !important;
                width: 100vw !important; height: auto !important;
                z-index: 9999 !important; background: rgba(16,14,24,0.97) !important;
                display: flex !important; flex-direction: column !important;
                padding: 0 8px !important;
            }
            /* Respect the on-screen keyboard (vars driven by the existing IME logic) and
               don't inherit the video/chat split heights — chat owns the screen here. */
            html body.sc-cast.sc-kb-open #chatwrap {
                top: 40px !important; height: auto !important;
                bottom: var(--sc-kb-h, 0px) !important;
            }
            /* Keep the send button usable on a touch tablet even in landscape */
            html body.sc-cast #sc-send-btn { display: inline-flex !important; }
            /* The send button is visible in cast mode, so push the emote icon left of it
               (back into the chat area) the same way portrait does — otherwise they overlap. */
            html body.sc-cast #sc-emote-proxy { right: calc(44px + 14px) !important; }
            /* Hide video-only chrome that isn't relocated into the bar (the pop-up panels
               triggered from the bar — users/poll/trivia/now-playing — stay available). */
            html body.sc-cast #sc-chatmode-btn,
            html body.sc-cast #sc-desync-btn,
            html body.sc-cast #fs-toggle-btn,
            html body.sc-cast #sc-cast-btn,
            html body.sc-cast #sc-top-bar,
            html body.sc-cast #sc-movie-stats,
            html body.sc-cast #sc-vert-ctrl-band,
            html body.sc-cast #sc-vert-ctrl-grip {
                display: none !important;
            }

            /* ── AUTO-HIDING CHROME (TV) ─────────────────────── */
            body.sc-tv .video-js .vjs-control-bar, body.sc-tv #sc-yt-scrubber, body.sc-tv #sc-seek-hud { transition: opacity 0.6s ease !important; }
            /* The control cluster is governed by the left-edge reveal, not this.
               Here we just fade the seek bar + hide the cursor when idle. */
            body.sc-tv.sc-chrome-hidden .video-js .vjs-control-bar,
            body.sc-tv.sc-chrome-hidden #sc-yt-scrubber,
            body.sc-tv.sc-chrome-hidden #sc-seek-hud {
                opacity: 0 !important; pointer-events: none !important;
            }
            body.sc-tv #sc-seek-hud { font-size: 15px !important; bottom: 44px !important; }
            body.sc-tv.sc-chrome-hidden { cursor: none !important; }

            /* ── AUTO-HIDING CHROME (vertical phone) ───────────── */
            /* Same idea as TV above, but here the docked cluster (#sc-chatmode-btn etc.,
               earlier in this file) shares the row and must fade with it -- see
               initChromeAutohide's vertical-mode branch (chat/modes.js). */
            body.sc-vertical .video-js .vjs-control-bar, body.sc-vertical #sc-yt-scrubber, body.sc-vertical #sc-seek-hud { transition: opacity 0.6s ease !important; }
            body.sc-vertical.sc-chrome-hidden .video-js .vjs-control-bar,
            body.sc-vertical.sc-chrome-hidden #sc-yt-scrubber,
            body.sc-vertical.sc-chrome-hidden #sc-seek-hud {
                opacity: 0 !important; pointer-events: none !important;
            }

            /* ── CHAT LAYOUT MODES ───────────────────────────── */
            /* Hidden: full-bleed cinema — drop chat AND the title / coming-attractions chrome.
               Subtitles shares every one of these rules (it's the same full-bleed layout,
               just with #sc-subtitles-overlay drawn on top instead of losing chat entirely --
               see the CHAT-AS-SUBTITLES block further down) -- each selector below lists
               body.sc-chat-subtitles right alongside body.sc-chat-hidden. */
            body.sc-chat-hidden #chatwrap, body.sc-chat-subtitles #chatwrap,
            body.sc-chat-hidden #sc-chat-header, body.sc-chat-subtitles #sc-chat-header,
            body.sc-chat-hidden #sc-users-panel, body.sc-chat-subtitles #sc-users-panel,
            body.sc-chat-hidden #sc-poll-panel, body.sc-chat-subtitles #sc-poll-panel,
            body.sc-chat-hidden #sc-top-bar, body.sc-chat-subtitles #sc-top-bar,
            body.sc-chat-hidden #videowrap-header, body.sc-chat-subtitles #videowrap-header,
            body.sc-chat-hidden #sc-poster-toggle, body.sc-chat-subtitles #sc-poster-toggle { display: none !important; }
            body.sc-chat-hidden.sc-horizontal #videowrap, body.sc-chat-subtitles.sc-horizontal #videowrap,
            body.sc-chat-hidden.sc-horizontal #videowrap .embed-responsive, body.sc-chat-subtitles.sc-horizontal #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-horizontal #ytapiplayer, body.sc-chat-subtitles.sc-horizontal #ytapiplayer { width: 100vw !important; }
            /* Widened from a bare 16px to match the docked button row's own reservation
               math (base horizontal rule, "19vw + 124px") minus the now-absent chat
               sidebar's 19vw -- without this the buttons stayed anchored to where the
               sidebar edge WOULD be and sat directly on top of the (now much wider,
               chat-less) scrubber instead of docking beside it. */
            body.sc-chat-hidden.sc-horizontal .video-js .vjs-control-bar, body.sc-chat-subtitles.sc-horizontal .video-js .vjs-control-bar,
            body.sc-chat-hidden.sc-horizontal #sc-yt-scrubber, body.sc-chat-subtitles.sc-horizontal #sc-yt-scrubber { right: 162px !important; }
            body.sc-chat-hidden.sc-horizontal #sc-chatmode-btn, body.sc-chat-subtitles.sc-horizontal #sc-chatmode-btn { right: 8px   !important; }
            body.sc-chat-hidden.sc-horizontal #sc-desync-btn,   body.sc-chat-subtitles.sc-horizontal #sc-desync-btn   { right: 46px  !important; }
            body.sc-chat-hidden.sc-horizontal #sc-settings-btn, body.sc-chat-subtitles.sc-horizontal #sc-settings-btn { right: 84px  !important; }
            body.sc-chat-hidden.sc-horizontal #sc-cast-btn,     body.sc-chat-subtitles.sc-horizontal #sc-cast-btn     { right: 122px !important; }
            body.sc-chat-hidden.sc-vertical #videowrap, body.sc-chat-subtitles.sc-vertical #videowrap,
            body.sc-chat-hidden.sc-vertical #videowrap .embed-responsive, body.sc-chat-subtitles.sc-vertical #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-vertical #ytapiplayer, body.sc-chat-subtitles.sc-vertical #ytapiplayer { height: 100vh !important; }
            /* chat-hidden/subtitles vertical: suppress the ctrl band (no black bar mid-screen); slide buttons from bottom-right */
            body.sc-chat-hidden.sc-vertical #sc-vert-ctrl-band, body.sc-chat-subtitles.sc-vertical #sc-vert-ctrl-band { display: none !important; }
            body.sc-chat-hidden.sc-vertical #sc-vert-ctrl-grip,
            body.sc-chat-subtitles.sc-vertical #sc-vert-ctrl-grip {
                top: auto !important; bottom: 0 !important;
            }
            /* Same row as the scrubber (bottom:4px below), not stacked above it -- the
               scrubber's own base rule already reserves right:160px for this cluster, so
               there's no horizontal overlap to dodge by floating the buttons higher. Read as
               one control strip, and (via #sc-desync-btn/#sc-settings-btn's shared transition
               above, plus #sc-chatmode-btn's and the scrubber's own) fades with it as one.
               The cast button joins the row (it otherwise floats mid-screen at the
               --sc-split control-band position). */
            body.sc-chat-hidden.sc-vertical #sc-chatmode-btn,
            body.sc-chat-subtitles.sc-vertical #sc-chatmode-btn,
            body.sc-chat-hidden.sc-vertical #sc-desync-btn,
            body.sc-chat-subtitles.sc-vertical #sc-desync-btn,
            body.sc-chat-hidden.sc-vertical #sc-settings-btn,
            body.sc-chat-subtitles.sc-vertical #sc-settings-btn,
            body.sc-chat-hidden.sc-vertical #sc-cast-btn,
            body.sc-chat-subtitles.sc-vertical #sc-cast-btn {
                top: auto !important; bottom: 4px !important;
            }
            /* Video-only fills the screen, so the scrubber belongs at the screen bottom —
               not at the --sc-split "above the chat header" spot used when chat is present. */
            body.sc-chat-hidden.sc-vertical .video-js .vjs-control-bar,
            body.sc-chat-subtitles.sc-vertical .video-js .vjs-control-bar,
            body.sc-chat-hidden.sc-vertical #sc-yt-scrubber,
            body.sc-chat-subtitles.sc-vertical #sc-yt-scrubber {
                bottom: 4px !important;
            }

            /* ── CHAT-ONLY: a keyboard-free, video-free chat screen — turns the device
               (handy on a TV) into a pure chat client. The player is hidden here AND
               paused/muted in JS, so the whole screen is chat. Works in both orientations. */
            body.sc-chat-chatonly #videowrap,
            body.sc-chat-chatonly #videowrap .embed-responsive,
            body.sc-chat-chatonly #ytapiplayer,
            body.sc-chat-chatonly #ytapiplayer iframe,
            body.sc-chat-chatonly .video-js,
            body.sc-chat-chatonly .vjs-tech,
            body.sc-chat-chatonly .video-js .vjs-control-bar,
            body.sc-chat-chatonly #sc-yt-scrubber,
            body.sc-chat-chatonly #sc-top-bar,
            body.sc-chat-chatonly #videowrap-header,
            body.sc-chat-chatonly #sc-movie-stats,
            body.sc-chat-chatonly #sc-poster-toggle,
            body.sc-chat-chatonly #sc-up-next-btn,
            body.sc-chat-chatonly #sc-desync-btn,
            body.sc-chat-chatonly #fs-toggle-btn,
            body.sc-chat-chatonly #sc-cast-btn,
            body.sc-chat-chatonly #sc-vert-ctrl-band {
                display: none !important;
            }
            body.sc-chat-chatonly #sc-cluster-grip { display: none !important; }
            /* No reveal drawer here on purpose -- a gesture-gated escape is exactly what
               trapped a user in landscape (the swipe only worked in portrait, leaving a
               near-invisible corner sliver as the only way out). These two buttons are the
               way out of Chat-Only, so they're permanently visible/tappable in the top header
               band instead, in both orientations -- same "just dock it, no reveal" pattern
               the Hidden (video-only) mode already uses successfully above. */
            body.sc-chat-chatonly #sc-vert-ctrl-grip { display: none !important; }
            body.sc-chat-chatonly #sc-chatmode-btn,
            body.sc-chat-chatonly #sc-settings-btn {
                display: flex !important;
                position: fixed !important;
                top: -2px !important; bottom: auto !important; left: auto !important;
                opacity: 1 !important; pointer-events: auto !important;
                z-index: 10012 !important;
            }
            body.sc-chat-chatonly #sc-chatmode-btn { right: 8px !important; }
            body.sc-chat-chatonly #sc-settings-btn { right: 50px !important; }
            /* Chat header is a clean full-width top bar; the fly-out grip on its right edge
               (above) is the way out, so the inline "›" collapse button is hidden here. */
            body.sc-chat-chatonly #sc-chat-header {
                display: flex !important; position: fixed !important;
                top: 0 !important; left: 0 !important; right: auto !important;
                width: 100vw !important; height: 32px !important;
                background: rgba(12,10,20,0.97) !important;
                z-index: 10010 !important;
                padding: 0 10px !important; box-sizing: border-box !important;
            }
            /* Explicit "video is paused/muted" indicator — chat-only silently stops the
               player (_coStopMedia); this makes that state visible instead of a mystery.
               Sits inside the 32px header bar, which has nothing else in chat-only mode
               to overlap. */
            #sc-chatonly-banner { display: none !important; }
            body.sc-chat-chatonly #sc-chatonly-banner {
                display: flex !important; align-items: center !important; justify-content: center !important;
                position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
                height: 32px !important; width: 100vw !important;
                font-size: 11px !important; letter-spacing: 0.04em !important;
                color: rgba(255,200,140,0.85) !important;
                pointer-events: none !important;
                z-index: 10011 !important;
            }
            /* Chat fills the screen under the header bar */
            body.sc-chat-chatonly #chatwrap {
                position: fixed !important;
                top: 32px !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                width: 100vw !important; height: auto !important;
                z-index: 9999 !important;
                background: rgba(16,14,24,0.97) !important;
                display: flex !important; flex-direction: column !important;
                box-sizing: border-box !important; padding: 0 8px !important;
            }
            /* Respect the on-screen keyboard if it opens (vars driven by the IME logic) */
            body.sc-chat-chatonly.sc-kb-open #chatwrap {
                top: 32px !important; height: auto !important; bottom: var(--sc-kb-h, 0px) !important;
            }
            /* Message list takes all the room above the input row */
            body.sc-chat-chatonly #messagebuffer { flex: 1 1 auto !important; }
            /* Keep the send button usable (no physical keyboard assumed), and shift the
               emote icon left of it so the two don't stack (send is hidden in plain
               horizontal, so the emote normally sits at the right edge). */
            body.sc-chat-chatonly #sc-send-btn { display: inline-flex !important; }
            body.sc-chat-chatonly #sc-emote-proxy { right: calc(44px + 14px) !important; }

            /* Overlay: video full width, chat floats translucent over the right */
            /* ── OVERLAY: minimal chat in the top-right corner over full video ── */
            body.sc-chat-overlay.sc-horizontal #videowrap,
            body.sc-chat-overlay.sc-horizontal #videowrap .embed-responsive,
            body.sc-chat-overlay.sc-horizontal #ytapiplayer { width: 100vw !important; }
            /* No sidebar in overlay — the scrubber spans the full video width (the default
               horizontal rule reserves 19vw for the chat column that isn't there here).
               Widened from a bare 16px, and the docked buttons get the matching
               zero-sidebar offsets, for the same reason as chat-hidden mode above --
               otherwise they sit on top of the now-wider scrubber instead of beside it. */
            body.sc-chat-overlay.sc-horizontal .video-js .vjs-control-bar,
            body.sc-chat-overlay.sc-horizontal #sc-yt-scrubber { right: 162px !important; }
            body.sc-chat-overlay.sc-horizontal #sc-chatmode-btn { right: 8px   !important; }
            body.sc-chat-overlay.sc-horizontal #sc-desync-btn   { right: 46px  !important; }
            body.sc-chat-overlay.sc-horizontal #sc-settings-btn { right: 84px  !important; }
            body.sc-chat-overlay.sc-horizontal #sc-cast-btn     { right: 122px !important; }

            /* Hide every bit of chrome — title bar, coming attractions, user/poll header */
            body.sc-chat-overlay.sc-horizontal #sc-top-bar,
            body.sc-chat-overlay.sc-horizontal #videowrap-header,
            body.sc-chat-overlay.sc-horizontal #sc-movie-stats,
            body.sc-chat-overlay.sc-horizontal #sc-poster-toggle,
            body.sc-chat-overlay.sc-horizontal #sc-chat-header { display: none !important; }

            /* Chat = small top-right corner panel, dark transparent, no borders */
            body.sc-chat-overlay.sc-horizontal #chatwrap {
                top: 0 !important; right: 0 !important; left: auto !important;
                width: 30vw !important; height: 46vh !important;
                background: rgba(8,6,12,0.42) !important;
                border: none !important; border-radius: 0 0 0 10px !important;
                padding: 10px !important; box-sizing: border-box !important;
                z-index: 10002 !important;
            }
            body.sc-chat-overlay.sc-horizontal #messagebuffer {
                text-shadow: 0 1px 4px rgba(0,0,0,0.9) !important;
            }
            /* Kill any stray borders/outlines/shadows around the chat in overlay */
            body.sc-chat-overlay.sc-horizontal #chatwrap,
            body.sc-chat-overlay.sc-horizontal #chatwrap *,
            body.sc-chat-overlay.sc-horizontal #messagebuffer,
            body.sc-chat-overlay.sc-horizontal #sc-mobile-input-row,
            body.sc-chat-overlay.sc-horizontal #chatwrap .input-group,
            body.sc-chat-overlay.sc-horizontal #chatwrap .form-control {
                border: none !important; box-shadow: none !important; outline: none !important;
            }
            /* Shrink posted images / emotes to a quarter size in the corner chat */
            body.sc-chat-overlay.sc-horizontal #messagebuffer img {
                zoom: 0.25 !important;
                max-width: 100% !important; height: auto !important;
            }
            /* One-line, borderless, no-placeholder input on the same transparent bg */
            body.sc-chat-overlay.sc-horizontal #sc-mobile-input-row { padding: 2px 0 0 !important; }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea {
                min-height: 0 !important; height: 26px !important; max-height: 26px !important;
                background: rgba(0,0,0,0.5) !important; border: none !important; box-shadow: none !important;
                border-radius: 6px !important;
                padding: 3px 8px !important; font-size: 13px !important; line-height: 1.4 !important;
                overflow-y: auto !important; resize: none !important;
            }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea:focus {
                background: rgba(0,0,0,0.68) !important; border: none !important;
            }
            body.sc-chat-overlay.sc-horizontal #sc-chat-textarea::placeholder { color: transparent !important; }
            body.sc-chat-overlay.sc-horizontal #sc-newmsg-pill {
                right: 2vw !important; top: calc(46vh - 38px) !important; bottom: auto !important;
            }

            /* ── OVERLAY (vertical): same idea as the horizontal version above -- full-height
               video, chat floats as a translucent panel in the top-right corner (previously
               this mode had no vertical styling at all, so picking it while in portrait did
               nothing -- looked identical to Sidebar). Buttons/scrubber stay docked at the
               screen BOTTOM (unlike horizontal, where they share the chat panel's top-right
               row) so they don't collide with the chat panel up top. */
            /* top:0 is required, not just height:100vh -- #videowrap's vertical-mode base
               rule starts it at top:36px to reserve the title strip (#videowrap-header),
               which overlay hides below for full immersion; without resetting top too, a
               36px gap at the very top exposes the native CyTube navbar underneath it. */
            body.sc-chat-overlay.sc-vertical #videowrap,
            body.sc-chat-overlay.sc-vertical #videowrap .embed-responsive,
            body.sc-chat-overlay.sc-vertical #ytapiplayer { top: 0 !important; height: 100vh !important; }
            /* No control band/seam in overlay -- video is full-bleed -- so the docked
               button row and scrubber pin to the screen bottom instead of the --sc-split
               seam, same fix chat-hidden's vertical mode already applies above. Same
               bottom:4px as the scrubber below (not stacked above it) -- its own base rule
               already reserves right:160px for this cluster, so there's no horizontal
               overlap to dodge by floating the buttons higher; read as one control strip and
               fade with it as one. Cast stays gesture-revealed (sc-rightzone) as normal,
               just repositioned to match. */
            body.sc-chat-overlay.sc-vertical #sc-vert-ctrl-band { display: none !important; }
            body.sc-chat-overlay.sc-vertical #sc-vert-ctrl-grip { display: none !important; }
            body.sc-chat-overlay.sc-vertical #sc-chatmode-btn,
            body.sc-chat-overlay.sc-vertical #sc-desync-btn,
            body.sc-chat-overlay.sc-vertical #sc-settings-btn,
            body.sc-chat-overlay.sc-vertical #sc-cast-btn {
                top: auto !important; bottom: 4px !important;
            }
            body.sc-chat-overlay.sc-vertical .video-js .vjs-control-bar,
            body.sc-chat-overlay.sc-vertical #sc-yt-scrubber {
                bottom: 4px !important;
            }
            /* Hide every bit of chrome — title bar, coming attractions, chat header —
               same full-immersion intent as the horizontal overlay above. */
            body.sc-chat-overlay.sc-vertical #sc-top-bar,
            body.sc-chat-overlay.sc-vertical #videowrap-header,
            body.sc-chat-overlay.sc-vertical #sc-movie-stats,
            body.sc-chat-overlay.sc-vertical #sc-poster-toggle,
            body.sc-chat-overlay.sc-vertical #sc-chat-header { display: none !important; }

            /* Chat = small top-right corner panel, dark transparent, no borders */
            body.sc-chat-overlay.sc-vertical #chatwrap {
                top: 0 !important; bottom: auto !important; left: auto !important; right: 0 !important;
                width: 62vw !important; height: 40vh !important;
                background: rgba(8,6,12,0.42) !important;
                border: none !important; border-radius: 0 0 0 10px !important;
                padding: 10px !important; box-sizing: border-box !important;
                z-index: 10002 !important;
            }
            body.sc-chat-overlay.sc-vertical #messagebuffer {
                text-shadow: 0 1px 4px rgba(0,0,0,0.9) !important;
            }
            body.sc-chat-overlay.sc-vertical #chatwrap,
            body.sc-chat-overlay.sc-vertical #chatwrap *,
            body.sc-chat-overlay.sc-vertical #messagebuffer,
            body.sc-chat-overlay.sc-vertical #sc-mobile-input-row,
            body.sc-chat-overlay.sc-vertical #chatwrap .input-group,
            body.sc-chat-overlay.sc-vertical #chatwrap .form-control {
                border: none !important; box-shadow: none !important; outline: none !important;
            }
            /* Shrink posted images / emotes to a quarter size in the corner chat */
            body.sc-chat-overlay.sc-vertical #messagebuffer img {
                zoom: 0.25 !important;
                max-width: 100% !important; height: auto !important;
            }
            /* One-line, borderless, no-placeholder input on the same transparent bg */
            body.sc-chat-overlay.sc-vertical #sc-mobile-input-row { padding: 2px 0 0 !important; }
            body.sc-chat-overlay.sc-vertical #sc-chat-textarea {
                min-height: 0 !important; height: 26px !important; max-height: 26px !important;
                background: rgba(0,0,0,0.5) !important; border: none !important; box-shadow: none !important;
                border-radius: 6px !important;
                padding: 3px 8px !important; font-size: 13px !important; line-height: 1.4 !important;
                overflow-y: auto !important; resize: none !important;
            }
            body.sc-chat-overlay.sc-vertical #sc-chat-textarea:focus {
                background: rgba(0,0,0,0.68) !important; border: none !important;
            }
            body.sc-chat-overlay.sc-vertical #sc-chat-textarea::placeholder { color: transparent !important; }
            body.sc-chat-overlay.sc-vertical #sc-newmsg-pill {
                right: 2vw !important; top: calc(40vh - 38px) !important; bottom: auto !important;
            }

            /* ── CHAT-AS-SUBTITLES (cards/subtitles.js) ───────────────────────────────
               A chatMode value (chat/modes.js), not an independent toggle -- reached the
               same way sidebar/overlay/hidden/chat-only are, via the header chat button or
               'C'. Behaves like Hidden (full-bleed cinema, chat chrome hidden) with recent
               messages rendered as pills over the bottom of the video instead of losing
               them entirely -- see the "body.sc-chat-hidden..." selectors throughout this
               file, each of which also lists "body.sc-chat-subtitles..." alongside it.
               --sc-subtitle-opacity/--sc-subtitle-fontsize are set on <body> by
               applySubtitleOpacity/applySubtitleFontSize (cards/subtitles.js), same
               "JS sets a custom prop, CSS reads it" idiom as --sc-split. */
            #sc-subtitles-overlay {
                display: none !important;
                position: fixed !important; z-index: 10001 !important;
                left: 6vw !important; right: 6vw !important; bottom: 48px !important;
                flex-direction: column !important; align-items: center !important;
                gap: 4px !important; pointer-events: none !important;
            }
            body.sc-chat-subtitles #sc-subtitles-overlay { display: flex !important; }
            .sc-subtitle-pill {
                max-width: 100% !important; box-sizing: border-box !important;
                background: rgba(0,0,0,var(--sc-subtitle-opacity, 0.6)) !important;
                color: #fff !important;
                border-radius: 8px !important;
                padding: 4px 12px !important;
                font-family: 'Inter', 'Roboto', system-ui, sans-serif !important;
                font-size: var(--sc-subtitle-fontsize, 15px) !important;
                line-height: 1.35 !important;
                text-shadow: 0 1px 4px rgba(0,0,0,0.9) !important;
                overflow-wrap: anywhere !important; word-break: break-word !important;
            }
            .sc-subtitle-pill img { max-height: 1.4em !important; vertical-align: middle !important; }
            .sc-subtitle-emoji { display: inline-block !important; width: 1.3em !important; text-align: center !important; margin-right: 2px !important; }
            .sc-subtitle-name { font-weight: 700 !important; }

            /* Sidebar: header matches the chat panel exactly (same box, same padding) */
            body.sc-horizontal #sc-chat-header {
                right: 0 !important; width: 19vw !important;
                box-sizing: border-box !important; padding: 0 8px !important;
            }

            /* Shape/color only -- position (left/right/top/bottom) is owned entirely by the
               docked-row rules (horizontal) and the control-band rules (vertical) earlier in
               this file, so none of that is set here. */
            #sc-chatmode-btn {
                position: fixed !important;
                z-index: 20050 !important;
                width: 36px !important; height: 36px !important; border-radius: 50% !important;
                background: rgba(0,0,0,0.6) !important;
                border: 1px solid rgba(255,255,255,0.25) !important;
                color: rgba(255,255,255,0.9) !important; cursor: pointer !important;
                font-size: 15px !important; line-height: 1 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                transition: opacity 0.6s ease, background 0.2s ease !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-chatmode-btn:hover { background: rgba(0,0,0,0.85) !important; }

            /* ── NEW-MESSAGES PILL ───────────────────────────── */
            #sc-newmsg-pill {
                position: fixed !important; z-index: 19500 !important;
                background: var(--np-accent, #ff5b73) !important; color: #160409 !important;
                font-size: 13px !important; font-weight: 800 !important;
                padding: 7px 16px !important; border-radius: 999px !important;
                cursor: pointer !important; box-shadow: 0 6px 20px rgba(0,0,0,0.55) !important;
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.25s ease !important;
            }
            #sc-newmsg-pill.sc-show { opacity: 1 !important; pointer-events: auto !important; }
            body.sc-horizontal #sc-newmsg-pill { right: calc(19vw + 16px) !important; bottom: 56px !important; }
            body.sc-vertical   #sc-newmsg-pill { left: 50% !important; transform: translateX(-50%) !important; bottom: calc((100 - var(--sc-split, 50)) * 1vh - 44px + 12px) !important; }
            body.sc-tv #sc-newmsg-pill { font-size: 17px !important; padding: 10px 22px !important; }
            /* Hide CyTube's native "New Messages Below" bar — our pill replaces it. */
            #newmessages-indicator, #newmessages-indicator-bghack { display: none !important; }

            /* ── MENTION TOAST ───────────────────────────────── */
            #sc-mention-toast {
                position: fixed !important; top: 26px !important; left: 50% !important;
                transform: translateX(-50%) translateY(-20px) !important;
                z-index: 21500 !important;
                background: rgba(20,8,14,0.97) !important; color: #fff !important;
                border: 1px solid var(--np-accent, #ff5b73) !important;
                border-radius: 12px !important; padding: 12px 18px !important;
                max-width: 72vw !important; box-shadow: 0 10px 36px rgba(0,0,0,0.65) !important;
                opacity: 0 !important; pointer-events: none !important; cursor: pointer !important;
                transition: opacity 0.35s ease, transform 0.35s ease !important;
                font-size: 14px !important; line-height: 1.4 !important;
            }
            #sc-mention-toast.sc-show { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; pointer-events: auto !important; }
            #sc-mention-toast .sc-mt-name { color: var(--np-accent, #ff5b73) !important; font-weight: 800 !important; margin-right: 6px !important; }
            body.sc-tv #sc-mention-toast { font-size: 21px !important; padding: 16px 26px !important; top: 40px !important; }

            /* ── LINK PIP PROMPT — auto-focused "View this?" pill for a new YouTube link
               posted in chat. Styled on #sc-mention-toast's conventions. ─────────────── */
            #sc-link-pip-prompt {
                position: fixed !important; top: 26px !important; left: 50% !important;
                transform: translateX(-50%) translateY(-20px) !important;
                z-index: 21600 !important;
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.35s ease, transform 0.35s ease !important;
            }
            #sc-link-pip-prompt.sc-show { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; pointer-events: auto !important; }
            #sc-link-pip-prompt-btn {
                display: flex !important; align-items: center !important; gap: 10px !important;
                background: rgba(20,8,14,0.97) !important; color: #fff !important;
                border: 1px solid var(--np-accent, #ff5b73) !important;
                border-radius: 999px !important; padding: 12px 20px !important;
                box-shadow: 0 10px 36px rgba(0,0,0,0.65) !important;
                cursor: pointer !important; font-size: 14px !important; line-height: 1.3 !important;
            }
            #sc-link-pip-prompt-btn .sc-lpp-label { color: rgba(255,255,255,0.65) !important; }
            #sc-link-pip-prompt-btn .sc-lpp-action { font-weight: 800 !important; color: var(--np-accent, #ff5b73) !important; }
            body.sc-tv #sc-link-pip-prompt { top: 40px !important; }
            body.sc-tv #sc-link-pip-prompt-btn { font-size: 21px !important; padding: 16px 26px !important; }

            /* ── LINK PIP PANEL — floating YouTube preview opened from the prompt ──────── */
            #sc-link-pip-panel {
                position: fixed !important; right: 24px !important; bottom: 24px !important;
                width: min(420px, 44vw) !important;
                background: rgba(14,10,18,0.97) !important;
                border: 1px solid rgba(255,255,255,0.14) !important;
                border-radius: 12px !important; overflow: hidden !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
                z-index: 21200 !important;
                opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.3s ease !important;
            }
            #sc-link-pip-panel.sc-link-pip-visible { opacity: 1 !important; pointer-events: auto !important; }
            #sc-link-pip-head {
                display: flex !important; align-items: center !important; justify-content: space-between !important;
                padding: 8px 12px !important; color: rgba(255,255,255,0.75) !important;
                font-size: 13px !important; font-weight: 700 !important;
                border-bottom: 1px solid rgba(255,255,255,0.1) !important;
            }
            #sc-link-pip-close {
                background: rgba(255,255,255,0.1) !important; border: none !important; color: #fff !important;
                width: 26px !important; height: 26px !important; border-radius: 50% !important;
                cursor: pointer !important; font-size: 12px !important; flex-shrink: 0 !important;
            }
            #sc-link-pip-close:hover { background: rgba(255,255,255,0.2) !important; }
            #sc-link-pip-body { position: relative !important; width: 100% !important; aspect-ratio: 16 / 9 !important; }
            .sc-link-pip-frame { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; border: none !important; }
            body.sc-tv #sc-link-pip-panel { width: min(560px, 38vw) !important; right: 32px !important; bottom: 32px !important; }
            body.sc-tv #sc-link-pip-head { font-size: 17px !important; padding: 12px 16px !important; }
            body.sc-tv #sc-link-pip-close { width: 38px !important; height: 38px !important; font-size: 16px !important; }

            /* ── EMOTE PICKER — replaces CyTube's native #emotelist popup ──────── */
            #sc-emotes-panel {
                position: fixed !important;
                z-index: 30002 !important;
                width: 340px !important; max-width: 92vw !important;
                max-height: 56vh !important;
                display: flex !important; flex-direction: column !important;
                background: #0c0c0e !important;
                border: 1px solid rgba(244,244,242,0.14) !important;
                border-radius: 12px !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important;
                color: #f4f4f2 !important; font-size: 13px !important;
                font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
            }
            #sc-emotes-head {
                display: flex !important; align-items: center !important; justify-content: space-between !important;
                flex: none !important;
                padding: 10px 16px !important;
                border-bottom: 1px solid rgba(244,244,242,0.08) !important;
                font-weight: 700 !important; font-size: 14px !important; color: #3ecbff !important;
                letter-spacing: 0.01em !important;
                cursor: grab !important; user-select: none !important; touch-action: none !important;
            }
            #sc-emotes-head.sc-emotes-dragging { cursor: grabbing !important; }
            #sc-emotes-close {
                background: transparent !important; border: none !important; color: rgba(244,244,242,0.62) !important;
                font-size: 15px !important; cursor: pointer !important; padding: 0 4px !important;
                transition: color 120ms ease !important;
            }
            #sc-emotes-close:hover { color: #f4f4f2 !important; }
            #sc-emotes-body {
                padding: 10px 12px 12px !important;
                display: flex !important; flex-direction: column !important; gap: 8px !important;
                flex: 1 1 auto !important; min-height: 0 !important;
            }
            .sc-emotes-search {
                flex: none !important;
                background: rgba(255,255,255,0.06) !important; color: #f4f4f2 !important;
                border: 1px solid rgba(255,255,255,0.18) !important; border-radius: 6px !important;
                padding: 6px 10px !important; font-size: 13px !important;
                box-sizing: border-box !important; width: 100% !important;
                transition: border-color 120ms ease !important;
            }
            .sc-emotes-search:hover, .sc-emotes-search:focus { border-color: rgba(62,203,255,0.5) !important; }
            .sc-emotes-search::placeholder { color: rgba(244,244,242,0.34) !important; }
            .sc-emotes-grid {
                flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important;
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)) !important;
                gap: 6px !important;
                align-content: start !important;
                scrollbar-width: thin !important; scrollbar-color: rgba(244,244,242,0.2) #000 !important;
            }
            .sc-emotes-grid::-webkit-scrollbar { width: 10px !important; }
            .sc-emotes-grid::-webkit-scrollbar-track { background: #000 !important; }
            .sc-emotes-grid::-webkit-scrollbar-thumb {
                background: rgba(244,244,242,0.2) !important; border-radius: 6px !important; border: 2px solid #000 !important;
            }
            .sc-emotes-grid::-webkit-scrollbar-thumb:hover { background: #3ecbff !important; }
            .sc-emotes-tile {
                position: relative !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: rgba(244,244,242,0.04) !important;
                border: 1px solid rgba(244,244,242,0.08) !important; border-radius: 6px !important;
                padding: 4px !important; height: 60px !important; box-sizing: border-box !important;
                cursor: pointer !important;
                transition: background-color 120ms ease, border-color 120ms ease !important;
            }
            .sc-emotes-tile:hover, .sc-emotes-tile:focus-visible, .sc-emotes-tile.sc-tv-focus {
                background: rgba(62,203,255,0.14) !important; border-color: #3ecbff !important;
                outline: none !important;
            }
            .sc-emotes-tile img {
                max-width: 100% !important; max-height: 46px !important;
                display: block !important; pointer-events: none !important;
                opacity: 0 !important; transition: opacity 150ms ease !important;
            }
            .sc-emotes-tile.sc-emotes-img-loaded img { opacity: 1 !important; }
            .sc-emotes-spinner {
                position: absolute !important; top: 50% !important; left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 18px !important; height: 18px !important; box-sizing: border-box !important;
                border: 2px solid rgba(244,244,242,0.18) !important;
                border-top-color: #3ecbff !important;
                border-radius: 50% !important;
                animation: sc-emotes-spin 700ms linear infinite !important;
                pointer-events: none !important;
            }
            .sc-emotes-tile.sc-emotes-img-loaded .sc-emotes-spinner { display: none !important; }
            @keyframes sc-emotes-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
            .sc-emotes-tile-actions {
                position: absolute !important; top: 2px !important; right: 2px !important;
                pointer-events: none !important;
            }
            .sc-emotes-star {
                pointer-events: auto !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                width: 16px !important; height: 16px !important;
                font-size: 12px !important; line-height: 1 !important;
                color: rgba(244,244,242,0.5) !important;
                background: rgba(0,0,0,0.4) !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                transition: color 120ms ease, transform 120ms ease !important;
            }
            .sc-emotes-star:hover, .sc-emotes-star:focus-visible, .sc-emotes-star.sc-tv-focus {
                color: #f4f4f2 !important; outline: none !important; transform: scale(1.12) !important;
            }
            .sc-emotes-star-active { color: #ffd24a !important; }
            .sc-emotes-star-active:hover, .sc-emotes-star-active:focus-visible { color: #ffdd70 !important; }
            .sc-emotes-empty {
                grid-column: 1 / -1 !important;
                padding: 18px 4px !important; text-align: center !important;
                color: rgba(244,244,242,0.4) !important; font-size: 12px !important;
            }
            #sc-emotes-tabs { display: flex !important; gap: 4px !important; flex: none !important; }
            .sc-emotes-tab {
                flex: 1 1 0 !important;
                background: rgba(255,255,255,0.04) !important; color: rgba(244,244,242,0.62) !important;
                border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 6px !important;
                padding: 6px 8px !important; font-size: 12px !important; font-weight: 600 !important;
                cursor: pointer !important; text-align: center !important;
                transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease !important;
            }
            .sc-emotes-tab:hover { color: #f4f4f2 !important; border-color: rgba(62,203,255,0.4) !important; }
            .sc-emotes-tab-active {
                background: rgba(62,203,255,0.16) !important; color: #3ecbff !important; border-color: #3ecbff !important;
            }

            /* Default spawn point -- anchored near #sc-emote-proxy's own position in each
               layout (base.css), offset past its footprint so the trigger stays clickable
               once the panel is open. Only applies while no saved drag position exists. */
            body.sc-horizontal #sc-emotes-panel {
                bottom: 54px !important; right: 8px !important;
                width: 340px !important; max-height: 50vh !important;
            }
            body.sc-vertical #sc-emotes-panel {
                bottom: 60px !important; right: 8px !important;
                width: 280px !important; max-height: 60vh !important;
            }
            body.sc-vertical .sc-emotes-grid {
                grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)) !important;
            }
            body.sc-tv .sc-emotes-tile { height: 76px !important; }
            body.sc-tv .sc-emotes-search { font-size: 17px !important; padding: 9px 12px !important; }
            body.sc-tv .sc-emotes-tab { font-size: 15px !important; padding: 8px 10px !important; }
            body.sc-tv #sc-emotes-head { font-size: 17px !important; }
            body.sc-tv #sc-emotes-close { width: 32px !important; height: 32px !important; font-size: 19px !important; }

            /* Floating GIF preview -- appended to <body>, not the grid, so it's never
               clipped by .sc-emotes-grid's own overflow:auto. */
            #sc-emotes-preview {
                position: fixed !important;
                z-index: 30003 !important;
                display: none !important;
                pointer-events: none !important;
                background: #0c0c0e !important;
                border: 1px solid rgba(244,244,242,0.14) !important;
                border-radius: 10px !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important;
                padding: 6px !important;
                box-sizing: border-box !important;
            }
            #sc-emotes-preview img {
                display: block !important;
                width: 176px !important; height: 176px !important;
                object-fit: contain !important;
                opacity: 0 !important;
                transition: opacity 100ms ease !important;
            }
            #sc-emotes-preview.sc-emotes-preview-loaded img { opacity: 1 !important; }
            #sc-emotes-preview.sc-emotes-preview-loaded .sc-emotes-spinner { display: none !important; }
            #sc-emotes-preview-name {
                display: block !important;
                width: 176px !important; max-width: 176px !important;
                margin-top: 6px !important;
                color: #f4f4f2 !important; font-size: 12px !important; text-align: center !important;
                white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
                box-sizing: border-box !important;
            }
`;

  // src/settings.js
  (function() {
    "use strict";
    function applyWatchAlong() {
      if (!document.body) return;
      document.body.classList.toggle("sc-watchalong", watchAlongEnabled());
    }
    function applyCouchMode() {
      if (!document.body) return;
      document.body.classList.toggle("sc-couch", couchModeEnabled());
      if (!couchModeEnabled())
        document.body.classList.remove("sc-couch-typing", "sc-couch-prep", "sc-couch-settled");
    }
    let _couchIdleTimer = null;
    let _couchSettleTimer = null;
    let _couchPrepTimer = null;
    function couchFontPx() {
      return getChatFontSize() + 3;
    }
    function couchTypingOn() {
      if (!couchModeEnabled() || !document.body.classList.contains("sc-chat-sidebar")) return;
      couchIdleKick();
      if (document.body.classList.contains("sc-couch-typing")) return;
      clearTimeout(_couchPrepTimer);
      const ta = document.getElementById("sc-chat-textarea");
      if (!document.body.classList.contains("sc-couch-prep")) {
        document.body.classList.add("sc-couch-prep");
        void document.body.offsetWidth;
      }
      if (ta) ta.style.setProperty("font-size", couchFontPx() + "px", "important");
      document.body.classList.add("sc-couch-typing");
      clearTimeout(_couchSettleTimer);
      _couchSettleTimer = setTimeout(() => document.body.classList.add("sc-couch-settled"), 420);
      couchScrollBottom();
    }
    function couchScrollBottom() {
      const buf = document.getElementById("messagebuffer");
      if (!buf) return;
      const toBottom = () => {
        buf.scrollTop = buf.scrollHeight;
      };
      requestAnimationFrame(toBottom);
      [120, 300, 420].forEach((ms) => setTimeout(toBottom, ms));
    }
    function couchTypingOff() {
      clearTimeout(_couchIdleTimer);
      clearTimeout(_couchSettleTimer);
      document.body.classList.remove("sc-couch-settled");
      const wasOpen = document.body.classList.contains("sc-couch-typing") || document.body.classList.contains("sc-couch-prep");
      if (!wasOpen) return;
      document.body.classList.remove("sc-couch-typing");
      applyChatFontSize(getChatFontSize());
      const ta = document.getElementById("sc-chat-textarea");
      if (ta) ta.style.removeProperty("height");
      couchScrollBottom();
      clearTimeout(_couchPrepTimer);
      _couchPrepTimer = setTimeout(() => document.body.classList.remove("sc-couch-prep"), 360);
    }
    function couchIdleKick() {
      clearTimeout(_couchIdleTimer);
      _couchIdleTimer = setTimeout(couchTypingOff, 1e4);
    }
    const LS_NOKEYBOARD = "sc_no_soft_keyboard";
    function softKeyboardDisabled() {
      const v = getKey(LS_NOKEYBOARD);
      if (v === "on") return true;
      if (v === "off") return false;
      try {
        if (window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected()) return true;
      } catch (e) {
      }
      try {
        if (window.CytubeNative && CytubeNative.hasHardwareKeyboard) return !!CytubeNative.hasHardwareKeyboard();
      } catch (e) {
      }
      return false;
    }
    let _lastKbSuppress = null;
    function applySoftKeyboard() {
      const disable = softKeyboardDisabled();
      const mode = disable ? "none" : "text";
      ["chatline", "sc-chat-textarea"].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getAttribute("inputmode") !== mode) el.setAttribute("inputmode", mode);
      });
      document.querySelectorAll(".emotelist-search").forEach((el) => {
        if (el.getAttribute("inputmode") !== mode) el.setAttribute("inputmode", mode);
      });
      if (disable !== _lastKbSuppress) {
        _lastKbSuppress = disable;
        try {
          if (window.CytubeNative && CytubeNative.setSuppressKeyboard) CytubeNative.setSuppressKeyboard(disable);
        } catch (e) {
        }
      }
    }
    function isVerticalMonitor() {
      return window.screen.height > window.screen.width;
    }
    function applyMonitorLayout() {
      const wasVert = document.body.classList.contains("sc-vertical");
      const isVert = isVerticalMonitor();
      document.body.classList.toggle("sc-vertical", isVert);
      document.body.classList.toggle("sc-horizontal", !isVert);
      if (wasVert !== isVert) {
        const buf = document.getElementById("messagebuffer");
        if (buf) setTimeout(() => {
          buf.scrollTop = buf.scrollHeight;
        }, 200);
      }
    }
    function startMonitorWatcher() {
      applyMonitorLayout();
      try {
        window.matchMedia("(orientation: portrait)").addEventListener("change", applyMonitorLayout);
      } catch (e) {
      }
      window.addEventListener("resize", applyMonitorLayout);
    }
    function installChatTextarea() {
      const originalInput = document.getElementById("chatline");
      if (!originalInput) return false;
      if (document.getElementById("sc-chat-textarea")) return true;
      originalInput.style.cssText = `
            position: absolute !important; width: 1px !important; height: 1px !important;
            opacity: 0 !important; pointer-events: none !important; top: -9999px !important;`;
      const textarea = document.createElement("textarea");
      textarea.id = "sc-chat-textarea";
      textarea.placeholder = "Type a message…";
      textarea.spellcheck = true;
      textarea.lang = "en";
      textarea.rows = 2;
      textarea.setAttribute("autocorrect", "on");
      textarea.setAttribute("autocapitalize", "sentences");
      originalInput.parentElement.insertBefore(textarea, originalInput.nextSibling);
      textarea.addEventListener("input", () => {
        clearTabCandidates();
        emoteState.lastChatlineValue = originalInput.value;
        if (couchModeEnabled() && document.body.classList.contains("sc-chat-sidebar")) {
          couchTypingOn();
        } else {
          textarea.style.height = "auto";
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
        }
      });
      textarea.addEventListener("keydown", (e) => {
        handleTabComplete(textarea, e);
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!document.getElementById("sc-modal-overlay")) {
            attemptSend(textarea, originalInput);
          }
          couchTypingOff();
        } else if (e.key === "Escape") {
          if (document.body.classList.contains("sc-couch-typing")) {
            e.preventDefault();
            couchTypingOff();
          }
        }
      });
      originalInput.addEventListener("focus", () => textarea.focus());
      textarea.addEventListener("focus", syncNativeInputFocus);
      textarea.addEventListener("blur", () => {
        setTimeout(syncNativeInputFocus, 0);
        couchTypingOff();
      });
      const chatwrap = document.getElementById("chatwrap");
      if (chatwrap) {
        chatwrap.addEventListener("click", (e) => {
          if (e.target === chatwrap || e.target.id === "messagebuffer") textarea.focus();
        });
      }
      document.addEventListener("pointerdown", (e) => {
        if (!document.body.classList.contains("sc-couch-typing")) return;
        if (e.target.closest && e.target.closest("#chatwrap")) return;
        textarea.blur();
      }, true);
      startEmoteWatcher(originalInput, textarea);
      return true;
    }
    function initChatTimestamps() {
      if (typeof socket === "undefined" || !socket || typeof socket.on !== "function") {
        setTimeout(initChatTimestamps, 600);
        return;
      }
      const fmt = (ms) => {
        try {
          return new Date(ms).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
          });
        } catch (e) {
          return "";
        }
      };
      socket.on("chatMsg", (data) => {
        try {
          if (!data || typeof data.time !== "number") return;
          const buf = document.getElementById("messagebuffer");
          const node = buf && buf.lastElementChild;
          if (!node || node.dataset.scTs) return;
          node.dataset.scTs = String(data.time);
          node.title = "Sent " + fmt(data.time);
        } catch (e) {
        }
      });
      const showTip = (node, x, y) => {
        const ts = node && node.dataset && node.dataset.scTs;
        if (!ts) return;
        let tip = document.getElementById("sc-chat-ts-tip");
        if (!tip) {
          tip = document.createElement("div");
          tip.id = "sc-chat-ts-tip";
          tip.style.cssText = "position:fixed;z-index:2147483646;max-width:80vw;padding:6px 10px;border-radius:8px;background:rgba(8,6,12,0.95);color:#fff;font-size:13px;font-weight:600;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);transform:translateX(-50%);";
          document.body.appendChild(tip);
        }
        tip.textContent = "Sent " + fmt(Number(ts));
        tip.style.display = "block";
        tip.style.top = Math.max(8, y - 44) + "px";
        tip.style.left = Math.min(Math.max(x, 8), window.innerWidth - 8) + "px";
        clearTimeout(tip._hideT);
        tip._hideT = setTimeout(() => {
          tip.style.display = "none";
        }, 2500);
      };
      let pressTimer = null;
      document.addEventListener("touchstart", (e) => {
        const node = e.target.closest && e.target.closest('#messagebuffer [class*="chat-msg-"]');
        if (!node) return;
        const t = e.touches[0];
        const x = t.clientX, y = t.clientY;
        pressTimer = setTimeout(() => showTip(node, x, y), 500);
      }, { passive: true });
      const cancelPress = () => clearTimeout(pressTimer);
      document.addEventListener("touchend", cancelPress, { passive: true });
      document.addEventListener("touchmove", cancelPress, { passive: true });
      document.addEventListener("touchcancel", cancelPress, { passive: true });
    }
    function applyUserColors() {
      document.querySelectorAll('#messagebuffer [class*="chat-msg-"]').forEach((el) => {
        const cls = [...el.classList].find((c) => c.startsWith("chat-msg-"));
        if (!cls) return;
        const u = cls.replace("chat-msg-", "");
        const span = el.querySelector(".username");
        if (span) {
          span.style.color = usernameToColor(u);
          span.style.fontWeight = "700";
          const emoji = getExternalUserEmoji(u);
          if (emoji) span.dataset.emoji = emoji;
        }
        el.classList.toggle("sc-own-msg", !!(window.CLIENT && CLIENT.name && u === CLIENT.name));
      });
    }
    let _colorObserverStarted = false;
    function startUserColorObserver() {
      const buf = document.getElementById("messagebuffer");
      if (!buf) return;
      if (_colorObserverStarted) {
        applyUserColors();
        return;
      }
      _colorObserverStarted = true;
      new MutationObserver(applyUserColors).observe(buf, { childList: true, subtree: true });
      applyUserColors();
    }
    function openSettingsModal() {
      const old = document.getElementById("sc-settings-overlay");
      if (old) old.remove();
      const tmdbVal = getKey(LS_TMDB);
      const firstRun = !localStorage.getItem(LS_ONBOARDED);
      try {
        localStorage.setItem(LS_ONBOARDED, "1");
      } catch (e) {
      }
      let phoneKbStatusTimer = null;
      const overlay = document.createElement("div");
      overlay.id = "sc-settings-overlay";
      overlay.innerHTML = `
            <div id="sc-settings-modal">
                <div id="sc-settings-title">⚙ Grindhouse Settings</div>
                ${firstRun ? '<div class="sc-settings-intro">First-time setup — everything here is optional. Log in to chat, and enable TMDB for richer movie info. Reopen any time with the ⚙ button.</div>' : ""}

                <nav id="sc-settings-tabs">
                    <button type="button" class="sc-settings-tab" data-tab="account">Account</button>
                    <button type="button" class="sc-settings-tab" data-tab="appearance">Appearance</button>
                    <button type="button" class="sc-settings-tab" data-tab="playback">Playback</button>
                    <button type="button" class="sc-settings-tab" data-tab="chat">Chat</button>
                    ${isTv ? '<button type="button" class="sc-settings-tab" data-tab="keyboard">Phone Keyboard</button>' : ""}
                    <button type="button" class="sc-settings-tab" data-tab="updates">Updates</button>
                </nav>

                <div class="sc-settings-pane" data-pane="account">
                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-tmdb-enable" ${tmdbVal ? "checked" : ""} />
                                <span class="sc-toggle-text">Enable TMDB features</span>
                            </span>
                            <span class="sc-settings-note">Movie posters, ratings, runtime, IMDb/Letterboxd links</span>
                        </label>
                        <div id="sc-tmdb-fields" class="${tmdbVal ? "" : "sc-hidden"}">
                            <div class="sc-settings-input-row">
                                <input id="sc-input-tmdb" class="sc-settings-input" type="text"
                                    placeholder="Paste TMDB v3 key…" value="${tmdbVal}" spellcheck="false" />
                                <button id="sc-test-tmdb" class="sc-settings-test" type="button">Test</button>
                            </div>
                            <span id="sc-test-tmdb-status" class="sc-settings-test-status"></span>
                            <a class="sc-settings-link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">
                                Get a free TMDB key ↗
                            </a>

                            <label class="sc-settings-toggle-label sc-settings-divider">
                                <span class="sc-toggle-row">
                                    <input type="checkbox" id="sc-input-lineuptiming" ${lineupTimingEnabled() ? "checked" : ""} />
                                    <span class="sc-toggle-text">Coming Attractions live timing (Experimental)</span>
                                </span>
                                <span class="sc-settings-note">Shows NOW PLAYING and estimated start times in Tonight's Lineup. Needs TMDB above for movie runtimes — without it, estimates can't guess well. Off by default, still being tuned.</span>
                            </label>
                        </div>
                    </div>

                    <div class="sc-settings-group">
                        <label class="sc-settings-label">CyTube Account
                            <span class="sc-settings-note">Opens the CyTube login page — your settings here are saved first</span>
                        </label>
                        <button id="sc-login-btn" class="sc-settings-btn-wide" type="button">Log in / Switch Account</button>
                    </div>

                    <div class="sc-settings-group">
                        <label class="sc-settings-label">Support the Channel
                            <span class="sc-settings-note">Opens the 420Grindhouse Patreon page in your browser</span>
                        </label>
                        <button id="sc-patreon-btn" class="sc-settings-btn-wide" type="button">❤ Patreon</button>
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="appearance">
                    <div class="sc-settings-group">
                        <label class="sc-settings-label">
                            Chat font size
                            <span class="sc-settings-note" id="sc-font-val">${getChatFontSize()}px</span>
                        </label>
                        <input type="range" id="sc-input-fontsize" class="sc-settings-range"
                            min="11" max="28" step="1" value="${getChatFontSize()}" />
                        <div id="sc-font-sample" class="sc-font-sample" style="font-size:${getChatFontSize()}px">
                            Someone: that movie was wild
                        </div>
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="playback">
                    <div class="sc-settings-group">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-castmute" ${castFallbackMuted() ? "checked" : ""} />
                                <span class="sc-toggle-text">Mute fallback audio while casting</span>
                            </span>
                            <span class="sc-settings-note">When a clip can't be cast (e.g. YouTube) it plays on this device instead — turn this on to keep that playback muted by default</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-nokb" ${softKeyboardDisabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Disable on-screen keyboard</span>
                            </span>
                            <span class="sc-settings-note">For physical keyboard users — tapping a text field won't pop up the Android keyboard</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-label">
                            Movie lead time (seconds ahead of sync)
                            <span class="sc-settings-note">Keeps you a few seconds ahead of the group during movies (not YouTube) — cushions against your own buffering. 0 = off.</span>
                        </label>
                        <input id="sc-input-leadsec" class="sc-settings-input" type="number" min="${MOVIE_LEAD_MIN}" max="${MOVIE_LEAD_MAX}" step="1" value="${getMovieLeadSec()}" style="width:5em" />
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-triviapopup" ${triviaPopupEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Pop-up trivia bubbles during movies (Experimental)</span>
                            </span>
                            <span class="sc-settings-note">Shows a small IMDb trivia fact over the video, VH1 Pop-up Video style, then fades out. Off by default. Cycles without repeats and stops once all trivia for the current movie has been shown.</span>
                        </label>
                        <label class="sc-settings-label" style="margin-top:8px">
                            Pop-up frequency
                            <select id="sc-input-triviapopup-freq" class="sc-settings-input">
                                <option value="frequent"   ${triviaPopupFrequency() === "frequent" ? "selected" : ""}>Frequent — about once a minute</option>
                                <option value="occasional" ${triviaPopupFrequency() === "occasional" ? "selected" : ""}>Occasional — every few minutes</option>
                                <option value="rare"       ${triviaPopupFrequency() === "rare" ? "selected" : ""}>Rare — every 8–15 minutes</option>
                            </select>
                        </label>
                    </div>
                </div>

                ${isTv ? `
                <div class="sc-settings-pane" data-pane="keyboard">
                    <div class="sc-settings-group">
                        <label class="sc-settings-label">Phone Keyboard
                            <span class="sc-settings-note">Pair a phone on the same Wi-Fi to type into any field here — chat, login, even this key field</span>
                        </label>
                        <div class="sc-settings-input-row">
                            <button id="sc-pair-phone-btn" class="sc-settings-btn-wide" type="button">Pair a phone</button>
                        </div>
                        <canvas id="sc-phone-qr" class="sc-hidden"></canvas>
                        <div id="sc-phone-qr-status" class="sc-settings-note"></div>
                    </div>
                </div>` : ""}

                <div class="sc-settings-pane" data-pane="chat">
                    <div class="sc-settings-group">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-spellcheck" ${spellCheckEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Grammar &amp; spell check popup</span>
                            </span>
                            <span class="sc-settings-note">When off, messages send immediately without review</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-couch" ${couchModeEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Couch Mode</span>
                            </span>
                            <span class="sc-settings-note">When typing in sidebar chat, the input grows into a big, easy-to-read box over the video</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-watchalong" ${watchAlongEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Watch-Only Mode</span>
                            </span>
                            <span class="sc-settings-note">Hides the chat input and the guest-login box — just read along, no typing</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-autoembed" ${autoEmbedEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Auto-embed image links in chat</span>
                            </span>
                            <span class="sc-settings-note">Shows a thumbnail preview under messages that link directly to an image, marked "🖼 embedded"</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
                        <label class="sc-settings-label">
                            Chat as TV subtitles
                            <span class="sc-settings-note">"Subtitles" is one of the chat layouts now — cycle to it with the header chat button (or press C) to show recent chat as movie-subtitle lines over the video, each with the sender's chat color and emoji. Ported from the idea in <a href="https://github.com/kburna243/mikes-420grindhouse-app" target="_blank" rel="noopener noreferrer">kburna243/mikes-420grindhouse-app</a>'s subtitle-chat overlay. The controls below tune how it looks.</span>
                        </label>
                        <label class="sc-settings-label" style="margin-top:8px">
                            Subtitle opacity
                            <span class="sc-settings-note" id="sc-subtitle-opacity-val">${Math.round(getSubtitleOpacity() * 100)}%</span>
                        </label>
                        <input type="range" id="sc-input-subtitle-opacity" class="sc-settings-range"
                            min="0.2" max="0.9" step="0.05" value="${getSubtitleOpacity()}" />
                        <label class="sc-settings-label" style="margin-top:8px">
                            Subtitle font size
                            <span class="sc-settings-note" id="sc-subtitle-fontsize-val">${getSubtitleFontSize()}px</span>
                        </label>
                        <input type="range" id="sc-input-subtitle-fontsize" class="sc-settings-range"
                            min="12" max="24" step="1" value="${getSubtitleFontSize()}" />
                        <label class="sc-settings-label" style="margin-top:8px">
                            Lines on screen
                            <select id="sc-input-subtitle-lines" class="sc-settings-input">
                                <option value="1" ${getSubtitleLines() === 1 ? "selected" : ""}>1</option>
                                <option value="2" ${getSubtitleLines() === 2 ? "selected" : ""}>2</option>
                                <option value="3" ${getSubtitleLines() === 3 ? "selected" : ""}>3</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="updates">
                    <div class="sc-settings-group" id="sc-update-group">
                        <label class="sc-settings-label">App Updates
                            <span class="sc-settings-note" id="sc-update-current">Installed: v${_appVersion() || "?"}</span>
                        </label>
                        <div id="sc-update-status" class="sc-settings-note">Checking for updates…</div>
                        <div id="sc-update-notes" class="sc-update-notes sc-hidden"></div>
                        <div class="sc-settings-input-row">
                            <button id="sc-update-check" class="sc-settings-test" type="button">Check now</button>
                        </div>
                        <button id="sc-update-github-link" class="sc-update-github-link sc-hidden" type="button">View release on GitHub ↗</button>
                    </div>
                </div>

                <div id="sc-settings-actions">
                    <button id="sc-settings-cancel">${firstRun ? "Skip for now" : "Cancel"}</button>
                    <button id="sc-settings-save">Save</button>
                </div>
                <div id="sc-settings-status"></div>
            </div>`;
      document.body.appendChild(overlay);
      const closeSettings = () => {
        clearInterval(phoneKbStatusTimer);
        overlay.remove();
      };
      const tabs = [...overlay.querySelectorAll(".sc-settings-tab")];
      const panes = [...overlay.querySelectorAll(".sc-settings-pane")];
      const showTab = (name) => {
        tabs.forEach((t) => t.classList.toggle("sc-settings-tab-active", t.dataset.tab === name));
        panes.forEach((p) => p.classList.toggle("sc-settings-pane-active", p.dataset.pane === name));
      };
      tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
      showTab("account");
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeSettings();
      });
      document.getElementById("sc-settings-cancel").addEventListener("click", () => closeSettings());
      const tmdbEnable = document.getElementById("sc-input-tmdb-enable");
      const tmdbFields = document.getElementById("sc-tmdb-fields");
      if (tmdbEnable && tmdbFields) {
        tmdbEnable.addEventListener("change", () => {
          tmdbFields.classList.toggle("sc-hidden", !tmdbEnable.checked);
          if (tmdbEnable.checked) {
            const i = document.getElementById("sc-input-tmdb");
            if (i) {
              if (tvNavState.setFocus) tvNavState.setFocus(i);
              else i.focus();
            }
          }
        });
      }
      const persistSettings = () => {
        const enabled = tmdbEnable && tmdbEnable.checked;
        const input = document.getElementById("sc-input-tmdb");
        setKey(LS_TMDB, enabled && input ? input.value.trim() : "");
        const sc = document.getElementById("sc-input-spellcheck");
        if (sc) setKey(LS_SPELLCHECK, sc.checked ? "on" : "off");
        movieState.movieLinkCache = {};
        movieState.lastMovieTitle = "";
        triggerTitleInject();
      };
      document.getElementById("sc-settings-save").addEventListener("click", () => {
        persistSettings();
        const status = document.getElementById("sc-settings-status");
        status.textContent = "✓ Saved";
        setTimeout(closeSettings, 800);
      });
      document.getElementById("sc-login-btn").addEventListener("click", () => {
        persistSettings();
        window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
      });
      document.getElementById("sc-patreon-btn").addEventListener("click", () => {
        openExternalUrl("https://www.patreon.com/c/420Grindhouse/posts?vanity=420Grindhouse");
      });
      const wireTest = (btnId, inputId, statusId, validator) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        const status = document.getElementById(statusId);
        btn.addEventListener("click", async () => {
          const key = input.value.trim();
          if (!key) {
            status.className = "sc-settings-test-status sc-test-bad";
            status.textContent = "Enter a key first";
            return;
          }
          btn.disabled = true;
          status.className = "sc-settings-test-status sc-test-pending";
          status.textContent = "Checking…";
          const result = await validator(key);
          btn.disabled = false;
          if (result === "valid") {
            status.className = "sc-settings-test-status sc-test-ok";
            status.textContent = "✓ Valid key";
          } else if (result === "invalid") {
            status.className = "sc-settings-test-status sc-test-bad";
            status.textContent = "✗ Invalid key";
          } else {
            status.className = "sc-settings-test-status sc-test-bad";
            status.textContent = "⚠ Couldn’t reach the API";
          }
        });
      };
      wireTest("sc-test-tmdb", "sc-input-tmdb", "sc-test-tmdb-status", validateTmdbKey);
      const fontInput = document.getElementById("sc-input-fontsize");
      const fontVal = document.getElementById("sc-font-val");
      const fontSample = document.getElementById("sc-font-sample");
      fontInput.addEventListener("input", () => {
        const px = parseInt(fontInput.value, 10);
        fontVal.textContent = px + "px";
        fontSample.style.fontSize = px + "px";
        setKey(LS_CHAT_FONT, String(px));
        applyChatFontSize(px);
      });
      const nokb = document.getElementById("sc-input-nokb");
      if (nokb) nokb.addEventListener("change", () => {
        setKey(LS_NOKEYBOARD, nokb.checked ? "on" : "off");
        applySoftKeyboard();
      });
      const pairBtn = document.getElementById("sc-pair-phone-btn");
      if (pairBtn) {
        const qrCanvas = document.getElementById("sc-phone-qr");
        const qrStatus = document.getElementById("sc-phone-qr-status");
        pairBtn.addEventListener("click", () => {
          let url = "";
          try {
            if (window.CytubeNative && CytubeNative.phoneKeyboardUrl) url = CytubeNative.phoneKeyboardUrl();
          } catch (e) {
          }
          if (!url) {
            qrStatus.textContent = "Could not start pairing.";
            return;
          }
          renderQrToCanvas(qrCanvas, url);
          qrCanvas.classList.remove("sc-hidden");
          qrStatus.textContent = "Waiting for phone…";
          clearInterval(phoneKbStatusTimer);
          phoneKbStatusTimer = setInterval(() => {
            let connected = false;
            try {
              connected = !!(window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected());
            } catch (e) {
            }
            qrStatus.textContent = connected ? "Phone connected ✓" : "Waiting for phone…";
          }, 1e3);
        });
      }
      const couch = document.getElementById("sc-input-couch");
      if (couch) couch.addEventListener("change", () => {
        setKey(LS_COUCH, couch.checked ? "on" : "off");
        applyCouchMode();
      });
      const watchalong = document.getElementById("sc-input-watchalong");
      if (watchalong) watchalong.addEventListener("change", () => {
        setKey(LS_WATCHALONG, watchalong.checked ? "on" : "off");
        applyWatchAlong();
      });
      const castmute = document.getElementById("sc-input-castmute");
      if (castmute) castmute.addEventListener("change", () => {
        setKey(LS_CAST_MUTE, castmute.checked ? "on" : "off");
        if (document.body.classList.contains("sc-cast-fallback") && window.__scApplyCastFallbackAudio) {
          window.__scApplyCastFallbackAudio();
        }
      });
      const lineupTiming = document.getElementById("sc-input-lineuptiming");
      if (lineupTiming) lineupTiming.addEventListener("change", () => {
        setKey(LS_LINEUP_TIMING, lineupTiming.checked ? "on" : "off");
      });
      const autoembed = document.getElementById("sc-input-autoembed");
      if (autoembed) autoembed.addEventListener("change", () => {
        setKey(LS_AUTOEMBED, autoembed.checked ? "on" : "off");
        startImageEmbedObserver();
      });
      const subOpacity = document.getElementById("sc-input-subtitle-opacity");
      const subOpacityVal = document.getElementById("sc-subtitle-opacity-val");
      if (subOpacity) subOpacity.addEventListener("input", () => {
        const v = parseFloat(subOpacity.value);
        subOpacityVal.textContent = Math.round(v * 100) + "%";
        setKey(LS_SUBTITLE_OPACITY, String(v));
        applySubtitleOpacity(v);
      });
      const subFontSize = document.getElementById("sc-input-subtitle-fontsize");
      const subFontSizeVal = document.getElementById("sc-subtitle-fontsize-val");
      if (subFontSize) subFontSize.addEventListener("input", () => {
        const px = parseInt(subFontSize.value, 10);
        subFontSizeVal.textContent = px + "px";
        setKey(LS_SUBTITLE_FONTSIZE, String(px));
        applySubtitleFontSize(px);
      });
      const subLines = document.getElementById("sc-input-subtitle-lines");
      if (subLines) subLines.addEventListener("change", () => {
        setKey(LS_SUBTITLE_LINES, subLines.value);
        refreshSubtitles();
      });
      const leadsec = document.getElementById("sc-input-leadsec");
      if (leadsec) leadsec.addEventListener("change", () => {
        leadsec.value = setMovieLeadSec(parseInt(leadsec.value, 10));
      });
      const triviapopup = document.getElementById("sc-input-triviapopup");
      if (triviapopup) triviapopup.addEventListener("change", () => {
        setKey(LS_TRIVIA_POPUP, triviapopup.checked ? "on" : "off");
      });
      const triviapopupFreq = document.getElementById("sc-input-triviapopup-freq");
      if (triviapopupFreq) triviapopupFreq.addEventListener("change", () => {
        setKey(LS_TRIVIA_POPUP_FREQ, triviapopupFreq.value);
      });
      (function wireUpdateSection() {
        const statusEl = document.getElementById("sc-update-status");
        const notesEl = document.getElementById("sc-update-notes");
        const checkBtn = document.getElementById("sc-update-check");
        const ghLink = document.getElementById("sc-update-github-link");
        if (!statusEl || !checkBtn || !ghLink) return;
        const render3 = (info) => {
          statusEl.className = "sc-settings-note";
          notesEl.classList.add("sc-hidden");
          ghLink.classList.add("sc-hidden");
          if (!info) {
            statusEl.textContent = "Checking for updates…";
            return;
          }
          if (info.available) {
            statusEl.classList.add("sc-update-yes");
            statusEl.textContent = "Update available: " + info.latest;
            if (info.notes) {
              notesEl.textContent = info.notes;
              notesEl.classList.remove("sc-hidden");
            }
            ghLink.classList.remove("sc-hidden");
          } else {
            statusEl.classList.add("sc-update-no");
            statusEl.textContent = info.latest ? "✓ You’re on the latest version (" + info.latest + ")" : "✓ You’re on the latest version";
          }
        };
        if (_updateInfo) render3(_updateInfo);
        checkForUpdate(false).then(render3).catch(() => {
          if (!_updateInfo) statusEl.textContent = "Couldn’t reach GitHub to check.";
        });
        ghLink.addEventListener("click", () => {
          const url = _updateInfo && _updateInfo.url || GH_RELEASES_PAGE;
          try {
            if (window.CytubeNative && CytubeNative.openExternal) CytubeNative.openExternal(url);
            else window.open(url, "_blank");
          } catch (e) {
          }
        });
        checkBtn.addEventListener("click", async () => {
          statusEl.className = "sc-settings-note";
          statusEl.textContent = "Checking…";
          checkBtn.disabled = true;
          try {
            render3(await checkForUpdate(true));
          } catch (e) {
            statusEl.textContent = "Couldn’t reach GitHub to check.";
          }
          checkBtn.disabled = false;
        });
      })();
    }
    function addSettingsButton() {
      if (document.getElementById("sc-settings-btn")) return;
      const btn = document.createElement("button");
      btn.id = "sc-settings-btn";
      btn.textContent = "⚙";
      btn.title = "Script Settings (API keys)";
      btn.dataset.tvLabel = "Settings";
      btn.addEventListener("click", openSettingsModal);
      document.body.appendChild(btn);
    }
    function initTopBar() {
      const bar = document.createElement("div");
      bar.id = "sc-top-bar";
      document.body.appendChild(bar);
      let idleTimer = null;
      let playing = false;
      const getDimEls = () => [
        bar,
        document.getElementById("videowrap-header"),
        document.getElementById("sc-poster-toggle"),
        document.getElementById("sc-up-next-btn")
      ].filter(Boolean);
      const dim = () => {
        if (!playing) return;
        getDimEls().forEach((el) => el.classList.add("sc-bar-dim"));
        document.body.classList.add("sc-video-dimmed");
      };
      const wake = () => {
        getDimEls().forEach((el) => el.classList.remove("sc-bar-dim"));
        document.body.classList.remove("sc-video-dimmed");
        clearTimeout(idleTimer);
        if (playing) idleTimer = setTimeout(dim, 3500);
      };
      chromeState.topBarWake = wake;
      const onVideoPlay = () => {
        if (playing) return;
        playing = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(dim, 4e3);
      };
      const bindVideoEvents = () => {
        document.querySelectorAll("video").forEach((v) => {
          if (!v._scPlayBound) {
            v._scPlayBound = true;
            v.addEventListener("play", onVideoPlay);
          }
        });
      };
      bindVideoEvents();
      new MutationObserver(bindVideoEvents).observe(document.body, { childList: true, subtree: true });
      const onIframeAppear = () => {
        if (!playing && document.querySelector("#videowrap iframe")) onVideoPlay();
      };
      const vw = document.getElementById("videowrap");
      if (vw) new MutationObserver(onIframeAppear).observe(vw, { childList: true, subtree: true });
      onIframeAppear();
      document.addEventListener("mousemove", (e) => {
        if (e.clientY < 60 && e.clientX < window.innerWidth * 1) {
          wake();
        }
      });
      const HEADER_SEL = "#videowrap-header, #sc-top-bar, #sc-title-text, #sc-up-next-btn, #sc-poster-toggle";
      document.addEventListener("click", (e) => {
        if (!bar.classList.contains("sc-bar-dim")) return;
        if (!e.target.closest(HEADER_SEL)) return;
        e.preventDefault();
        e.stopPropagation();
        wake();
      }, true);
    }
    function initChatHeader() {
      if (document.getElementById("sc-chat-header")) return;
      const header = document.createElement("div");
      header.id = "sc-chat-header";
      document.body.appendChild(header);
    }
    const waitForBody = () => {
      if (!document.body) {
        requestAnimationFrame(waitForBody);
        return;
      }
      startMonitorWatcher();
      applyInputMode();
      const bootObserver = new MutationObserver(() => {
        applyInputMode();
        installChatTextarea();
        relocateEmoteButton();
        addFloatingButtons();
        addSettingsButton();
        startUserColorObserver();
        startImageEmbedObserver();
        startLinkPipObserver();
        startSubtitlesObserver();
        if (document.getElementById("sc-chat-textarea") && document.getElementById("sc-emote-proxy") && document.getElementById("fs-toggle-btn") && document.getElementById("sc-settings-btn")) {
          bootObserver.disconnect();
        }
      });
      bootObserver.observe(document.body, { childList: true, subtree: true });
    };
    if (window.location.pathname.startsWith("/login")) {
      initPhoneKeyboard(isTv, () => {
        try {
          const connected = window.CytubeNative && CytubeNative.isKeyboardConnected && CytubeNative.isKeyboardConnected();
          if (window.CytubeNative && CytubeNative.setSuppressKeyboard) CytubeNative.setSuppressKeyboard(!!connected);
        } catch (e) {
        }
      });
      initLoginTvNav();
      return;
    }
    initChannelScriptAutoApprove();
    waitForBody();
    function _scBoot() {
      _scStatus("Styling channel…");
      getKillCountDb();
      installChatTextarea();
      relocateEmoteButton();
      addFloatingButtons();
      addSettingsButton();
      addCastButton();
      watchMovieTitle();
      initMediaWatcher();
      initYtScrubber();
      initSeekHud();
      initChatTimestamps();
      initNowPlayingWatcher();
      initTopBar();
      initDesyncButton();
      initMovieLeadOffset();
      initChatHeader();
      initUserCount();
      initPollWatcher();
      initGoogleDrive();
      initUpdateCheck();
      loadLastAiredSheet();
      triviaPopupBoot();
      initSubtitles();
      if (!localStorage.getItem(LS_ONBOARDED)) {
        setTimeout(openSettingsModal, 1200);
      }
      initPosterStrip();
      initUpNextButton();
      const style = document.createElement("style");
      style.textContent = base_default + overlays_default;
      document.head.appendChild(style);
    }
    if (document.readyState === "complete") {
      _scBoot();
    } else {
      window.addEventListener("load", _scBoot);
    }
    (function() {
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "viewport";
        document.head.appendChild(meta);
      }
      meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
      document.body.style.setProperty("padding-top", "0px", "important");
      document.body.style.setProperty("margin-top", "0px", "important");
    })();
    (function() {
      const pc1 = document.createElement("link");
      pc1.rel = "preconnect";
      pc1.href = "https://fonts.googleapis.com";
      const pc2 = document.createElement("link");
      pc2.rel = "preconnect";
      pc2.href = "https://fonts.gstatic.com";
      pc2.crossOrigin = "anonymous";
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(pc1);
      document.head.appendChild(pc2);
      document.head.appendChild(css);
    })();
    try {
      console.log(
        "[Grindhouse] TV mode:",
        isTv,
        "| native bridge:",
        !!(window.CytubeNative && CytubeNative.isTv),
        "| screen:",
        screen.width + "x" + screen.height,
        "| touchPoints:",
        navigator.maxTouchPoints,
        "| ontouchstart:",
        "ontouchstart" in window
      );
    } catch (e) {
    }
    (function() {
      const s = document.createElement("style");
      s.textContent = tv_default;
      document.head.appendChild(s);
    })();
    if (isTv) document.body.classList.add("sc-tv");
    (function() {
      applySoftKeyboard();
      const obs = new MutationObserver(applySoftKeyboard);
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    })();
    function _scAddSendBtn() {
      if (document.getElementById("sc-send-btn")) return;
      const ta = document.getElementById("sc-chat-textarea");
      if (!ta) return;
      const orig = document.getElementById("chatline");
      if (!document.getElementById("sc-mobile-input-row")) {
        const row = document.createElement("div");
        row.id = "sc-mobile-input-row";
        ta.parentNode.insertBefore(row, ta);
        row.appendChild(ta);
      }
      const btn = document.createElement("button");
      btn.id = "sc-send-btn";
      btn.type = "button";
      btn.textContent = "➤";
      document.getElementById("sc-mobile-input-row").appendChild(btn);
      btn.addEventListener("click", () => {
        if (ta && orig) attemptSend(ta, orig);
      });
    }
    (function() {
      if (!window.visualViewport || isTv) return;
      let kbTimer = null;
      const INPUT_H = 56;
      const onOpen = (vv) => {
        const kbH = Math.round(window.innerHeight - vv.height);
        const visH = vv.height;
        const isVert = document.body.classList.contains("sc-vertical");
        let vidH, chatH;
        if (isVert) {
          vidH = Math.round(visH * 0.58);
          chatH = Math.max(visH - vidH - INPUT_H, 60);
        } else {
          vidH = visH;
          chatH = visH - 28;
        }
        const root = document.documentElement.style;
        root.setProperty("--sc-kb-h", kbH + "px");
        root.setProperty("--sc-vid-h", vidH + "px");
        root.setProperty("--sc-chat-h", chatH + "px");
        document.body.classList.add("sc-kb-open");
        const buf = document.getElementById("messagebuffer");
        const wasNearBottom = buf && buf.scrollHeight - buf.scrollTop - buf.clientHeight < 80;
        if (buf && wasNearBottom) setTimeout(() => {
          buf.scrollTop = buf.scrollHeight;
        }, 120);
      };
      const onClose = () => {
        const root = document.documentElement.style;
        root.removeProperty("--sc-kb-h");
        root.removeProperty("--sc-vid-h");
        root.removeProperty("--sc-chat-h");
        document.body.classList.remove("sc-kb-open");
      };
      window.visualViewport.addEventListener("resize", () => {
        const vv = window.visualViewport;
        clearTimeout(kbTimer);
        if (window.innerHeight - vv.height > 120) {
          onOpen(vv);
        } else {
          kbTimer = setTimeout(onClose, 280);
        }
      }, { passive: true });
    })();
    const _scSendObs = new MutationObserver(() => {
      if (document.getElementById("sc-chat-textarea")) {
        _scAddSendBtn();
        if (document.getElementById("sc-send-btn")) _scSendObs.disconnect();
      }
    });
    _scSendObs.observe(document.body, { childList: true, subtree: true });
    function initCinematicChat() {
      [initAmbientGlow, initChromeAutohide, initChatModes, initNewMessagePill, initMentionToast, initChatFont, initLeftZone, initVideoTapReveal, initVertControlBand, initRightZone, applyCouchMode, applyWatchAlong].forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn("[Grindhouse] init failed:", fn.name, e);
        }
      });
    }
    if (document.readyState === "complete") initCinematicChat();
    else window.addEventListener("load", initCinematicChat);
    initTvNav();
    initPhoneKeyboard(isTv, applySoftKeyboard);
    function _scSignalReady() {
      try {
        if (window.CytubeNative && CytubeNative.onReady) CytubeNative.onReady();
      } catch (e) {
      }
    }
    function _scStatus(s) {
      try {
        if (window.CytubeNative && CytubeNative.setLoadingStatus) CytubeNative.setLoadingStatus(s);
      } catch (e) {
      }
    }
    function _mediaIsPlaying() {
      const v = document.querySelector("#videowrap video");
      if (v) return !v.paused && v.currentTime > 0.1;
      const yt = document.getElementById("ytapiplayer");
      if (yt && yt.tagName === "IFRAME") return true;
      return !!document.querySelector("#videowrap iframe");
    }
    function initIntroSequence() {
      const start = Date.now();
      let playingSince = 0, preloadStarted = false, done = false, iv;
      const reveal = () => {
        if (done) return;
        done = true;
        clearInterval(iv);
        npState.introDone = true;
        _scStatus("Ready");
        const data = npState.data || (movieState.lastMovieTitle && movieState.lastMovieTitle.length > 1 ? { cleanTitle: movieState.lastMovieTitle, backdrop: null } : null);
        if (isTv && data) {
          showNowPlayingCard(data, { autoHide: false });
          setTimeout(() => {
            _scSignalReady();
            setTimeout(hideNowPlayingCard, 3e3);
          }, 550);
        } else {
          _scSignalReady();
        }
      };
      let chatMode = "sidebar";
      try {
        chatMode = localStorage.getItem("sc_chat_mode") || "sidebar";
      } catch (e) {
      }
      if (chatMode === "chatonly") return reveal();
      _scStatus("Waiting for stream…");
      iv = setInterval(() => {
        if (done) return;
        if (Date.now() - start >= 45e3) return reveal();
        const playing = _mediaIsPlaying();
        if (!playing) {
          playingSince = 0;
          return;
        }
        if (!playingSince) playingSince = Date.now();
        if (!isTv) return reveal();
        if (npState.data && npState.data.backdrop && !preloadStarted) {
          preloadStarted = true;
          _scStatus("Loading movie info…");
          const img = new Image();
          img.onload = img.onerror = reveal;
          img.src = npState.data.backdrop;
        }
        if (Date.now() - playingSince >= 3500) reveal();
      }, 300);
    }
    if (document.readyState === "complete") initIntroSequence();
    else window.addEventListener("load", initIntroSequence);
    (function() {
      const CAST_CONTROL_IDS = ["sc-poster-toggle", "sc-up-next-btn", "sc-usercount-btn", "sc-poll-btn", "sc-settings-btn"];
      let savedSlots = null;
      function buildBar() {
        let bar = document.getElementById("sc-cast-bar");
        if (bar) return bar;
        bar = document.createElement("div");
        bar.id = "sc-cast-bar";
        const titleSlot = document.createElement("div");
        titleSlot.id = "sc-cast-title-slot";
        const controls = document.createElement("div");
        controls.id = "sc-cast-controls";
        const stop = document.createElement("button");
        stop.id = "sc-cast-stop-btn";
        stop.type = "button";
        stop.textContent = "Stop Casting";
        stop.addEventListener("click", function() {
          try {
            if (window.CytubeNative && CytubeNative.stopCasting) CytubeNative.stopCasting();
          } catch (e) {
          }
        });
        bar.appendChild(titleSlot);
        bar.appendChild(controls);
        bar.appendChild(stop);
        document.body.appendChild(bar);
        return bar;
      }
      function remember(el) {
        return { el, parent: el.parentNode, next: el.nextSibling };
      }
      function enter() {
        buildBar();
        const titleSlot = document.getElementById("sc-cast-title-slot");
        const controls = document.getElementById("sc-cast-controls");
        savedSlots = [];
        const header = document.getElementById("videowrap-header");
        if (header) {
          savedSlots.push(remember(header));
          titleSlot.appendChild(header);
        }
        CAST_CONTROL_IDS.forEach(function(id) {
          const el = document.getElementById(id);
          if (el) {
            savedSlots.push(remember(el));
            controls.appendChild(el);
          }
        });
        document.body.classList.remove("sc-cast-fallback");
        document.body.classList.add("sc-cast");
        scrollChatToBottom();
      }
      function scrollChatToBottom() {
        var pin = function() {
          var mb = document.getElementById("messagebuffer");
          if (mb) mb.scrollTop = mb.scrollHeight;
        };
        requestAnimationFrame(function() {
          requestAnimationFrame(pin);
        });
        setTimeout(pin, 250);
      }
      function exit() {
        document.body.classList.remove("sc-cast");
        document.body.classList.remove("sc-cast-fallback");
        if (savedSlots) {
          savedSlots.forEach(function(s) {
            try {
              if (s.parent) s.parent.insertBefore(s.el, s.next);
            } catch (e) {
            }
          });
          savedSlots = null;
        }
      }
      function setPlayerMuted(muted) {
        try {
          var v = document.querySelector("video");
          if (v) v.muted = muted;
        } catch (e) {
        }
        try {
          var p = window.PLAYER && window.PLAYER.player;
          if (p) {
            if (muted) {
              if (typeof p.mute === "function") p.mute();
              else if (typeof p.muted === "function") p.muted(true);
            } else {
              if (typeof p.unMute === "function") p.unMute();
              else if (typeof p.muted === "function") p.muted(false);
              if (typeof p.setVolume === "function") {
                try {
                  p.setVolume(100);
                } catch (e) {
                }
              }
            }
          }
        } catch (e) {
        }
      }
      window.__scSetPlayerMuted = setPlayerMuted;
      window.__scApplyCastFallbackAudio = function() {
        var muted = false;
        try {
          muted = localStorage.getItem("sc_cast_fallback_mute") === "on";
        } catch (e) {
        }
        setPlayerMuted(muted);
      };
      window.__scEnterCastFallback = function() {
        document.body.classList.add("sc-cast-fallback");
        window.__scApplyCastFallbackAudio();
        setTimeout(window.__scApplyCastFallbackAudio, 600);
        setTimeout(window.__scApplyCastFallbackAudio, 1600);
      };
      window.__scSetCastMode = function(on) {
        try {
          on ? enter() : exit();
        } catch (e) {
        }
      };
    })();
  })();
})();
