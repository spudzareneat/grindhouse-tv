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
      window.__scHttpResolve = function(id, res) {
        const cb = _scHttpCbs[id];
        if (cb) {
          delete _scHttpCbs[id];
          cb(res);
        }
      };
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
    movieLinks: { key: "sc_movie_links", type: "offbool", def: true },
    chatFontSize: { key: "sc_chat_fontsize", type: "string", def: "" },
    couchMode: { key: "sc_couch_mode", type: "onbool", def: false },
    // 'on' enables
    watchAlong: { key: "sc_watch_along", type: "onbool", def: false },
    castMute: { key: "sc_cast_fallback_mute", type: "onbool", def: false },
    chatMode: { key: "sc_chat_mode", type: "string", def: "sidebar" },
    updateCache: { key: "sc_update_cache", type: "json", def: null }
  };
  function getSetting(n) {
    const d = DEFS[n];
    const raw = localStorage.getItem(d.key);
    if (raw === null || raw === "") return d.def;
    if (d.type === "offbool") return raw !== "off";
    if (d.type === "onbool") return raw === "on";
    if (d.type === "flag") return true;
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
  var LS_MOVIE_LINKS = "sc_movie_links";
  var LS_COUCH = "sc_couch_mode";
  var LS_WATCHALONG = "sc_watch_along";
  var LS_CAST_MUTE = "sc_cast_fallback_mute";
  var getKey = (id) => localStorage.getItem(id) || "";
  var setKey = (id, v) => localStorage.setItem(id, v.trim());
  var hasKey = (id) => !!getKey(id);
  var spellCheckEnabled = () => getSetting("spellcheck");
  var movieLinksEnabled = () => getSetting("movieLinks");
  var couchModeEnabled = () => getSetting("couchMode");
  var watchAlongEnabled = () => getSetting("watchAlong");
  var castFallbackMuted = () => getSetting("castMute");

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
      original.click();
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
    topBarIsOpen: false,
    // true while the poster strip (or similar) holds the bar open
    leftZoneReveal: null,
    // expose so video-tap can trigger both chrome systems together
    rightZoneReveal: null,
    // vertical-mode right-edge drawer
    chromeWake: null
    // re-arms the TV chrome auto-hide (remote keys bypass DOM events)
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
    try {
      if (window.CLIENT && CLIENT.name && u === CLIENT.name) return "hsl(197, 90%, 78%)";
    } catch (e) {
    }
    const hue = hashString(u) * 137.508 % 360;
    return `hsl(${hue.toFixed(1)}, 72%, 70%)`;
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

  // src/tvdetect.js
  var isTv = function() {
    try {
      if (window.CytubeNative && typeof CytubeNative.isTv === "function") return !!CytubeNative.isTv();
    } catch (e) {
    }
    return window.screen.width >= 1280 && !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  }();

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
    return s.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  function parseFirstEntry(feedXml) {
    const start = feedXml.indexOf("<entry>");
    if (start === -1) return null;
    const end = feedXml.indexOf("</entry>", start);
    if (end === -1) return null;
    const entry = feedXml.slice(start, end + "</entry>".length);
    const idM = entry.match(/<id>([^<]+)<\/id>/);
    const titleM = entry.match(/<title>([^<]+)<\/title>/);
    const contentM = entry.match(/<content type="html">([\s\S]*?)<\/content>/);
    if (!idM || !titleM || !contentM) return null;
    const pubM = entry.match(/<published>([^<]+)<\/published>/);
    return {
      postId: idM[1],
      title: decodeHtmlEntities(titleM[1]),
      publishedAt: pubM ? pubM[1] : null,
      contentHtml: decodeHtmlEntities(contentM[1])
    };
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
      const withoutAka = display.replace(/\s+aka\s+.+$/i, "");
      const ym = withoutAka.match(/^(.*)\s\((\d{4})\)$/);
      if (ym) items.push({ title: ym[1].trim(), year: ym[2], display });
    }
    return items;
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
        if (DAY_NAMES.includes(text)) {
          currentDay = { day: text, sections: [] };
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
    const entry = parseFirstEntry(res.body);
    if (!entry) throw new Error("no entries found in feed");
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

  // src/metadata/tmdb.js
  var LINK_DEFS = [
    { key: "imdb", label: "IMDb", color: "#f5c518", fg: "#000", char: "i" },
    { key: "letterboxd", label: "Letterboxd", color: "#2c4a2e", fg: "#00e054", char: "L" },
    { key: "wiki", label: "Wikipedia", color: "#444", fg: "#eee", char: "W" }
  ];
  var movieState = {
    lastMovieTitle: "",
    movieLinkCache: {}
    // cache by raw title to avoid repeat lookups
  };
  var killCountDb = null;
  async function getKillCountDb() {
    if (killCountDb !== null) return killCountDb;
    killCountDb = {};
    try {
      const text = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: "https://raw.githubusercontent.com/lklynet/Kill-Count/main/killcounts.jsonl",
          onload: (r) => r.status === 200 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
          onerror: reject
        });
      });
      let loaded = 0;
      for (const line of text.split("\n")) {
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
  async function lookupMovie(title, year) {
    var _a, _b;
    const cacheKey = title + (year || "");
    if (movieState.movieLinkCache[cacheKey] !== void 0) return movieState.movieLinkCache[cacheKey];
    let tmdbResult = null;
    let wikiUrl = null;
    const tmdbPromise = hasKey(LS_TMDB) ? (async () => {
      var _a2, _b2;
      try {
        const params = new URLSearchParams({ api_key: getKey(LS_TMDB), query: title, language: "en-US" });
        if (year) params.set("year", year);
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!((_a2 = data.results) == null ? void 0 : _a2.length)) return;
        let best = data.results[0];
        if (year) {
          const withYear = data.results.find((r) => {
            var _a3;
            return (_a3 = r.release_date) == null ? void 0 : _a3.startsWith(year);
          });
          if (withYear) best = withYear;
        }
        const detailRes = await fetch(
          `https://api.themoviedb.org/3/movie/${best.id}?api_key=${getKey(LS_TMDB)}&append_to_response=external_ids`
        );
        if (!detailRes.ok) return;
        const detail = await detailRes.json();
        tmdbResult = {
          tmdbId: best.id,
          imdbId: detail.imdb_id || ((_b2 = detail.external_ids) == null ? void 0 : _b2.imdb_id) || null,
          title: detail.title,
          year: detail.release_date ? detail.release_date.slice(0, 4) : year,
          poster: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
          backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
          rating: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : null,
          runtime: detail.runtime || null,
          overview: detail.overview || "",
          genres: (detail.genres || []).map((g) => g.name)
        };
      } catch (e) {
      }
    })() : Promise.resolve();
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
    await Promise.all([tmdbPromise, wikiPromise]);
    let killCount = null;
    if (tmdbResult == null ? void 0 : tmdbResult.tmdbId) {
      const db = await getKillCountDb();
      const count = db[String(tmdbResult.tmdbId)];
      if (count !== void 0 && count !== null) killCount = count;
    }
    const parentalGuide = await fetchImdbParentalGuide(tmdbResult == null ? void 0 : tmdbResult.imdbId);
    const result = {
      links: {
        imdb: (tmdbResult == null ? void 0 : tmdbResult.imdbId) ? `https://www.imdb.com/title/${tmdbResult.imdbId}/` : null,
        letterboxd: (tmdbResult == null ? void 0 : tmdbResult.tmdbId) ? `https://letterboxd.com/tmdb/${tmdbResult.tmdbId}` : null,
        wiki: wikiUrl
      },
      killCount,
      parentalGuide,
      imdbId: (tmdbResult == null ? void 0 : tmdbResult.imdbId) || null,
      cleanTitle: (tmdbResult == null ? void 0 : tmdbResult.title) || null,
      cleanYear: (tmdbResult == null ? void 0 : tmdbResult.year) || null,
      poster: (tmdbResult == null ? void 0 : tmdbResult.poster) || null,
      backdrop: (tmdbResult == null ? void 0 : tmdbResult.backdrop) || null,
      rating: (_a = tmdbResult == null ? void 0 : tmdbResult.rating) != null ? _a : null,
      runtime: (_b = tmdbResult == null ? void 0 : tmdbResult.runtime) != null ? _b : null,
      overview: (tmdbResult == null ? void 0 : tmdbResult.overview) || "",
      genres: (tmdbResult == null ? void 0 : tmdbResult.genres) || []
    };
    movieState.movieLinkCache[cacheKey] = result;
    return result;
  }

  // src/mediatime.js
  var mediaState = {
    currentMediaSeconds: 0,
    currentMediaType: "",
    currentPlaybackTime: 0
  };
  function parseTimeToSeconds(t) {
    const parts = String(t).trim().split(":").map(Number);
    if (!parts.length || parts.some(isNaN)) return 0;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  }
  function getCurrentMediaSeconds() {
    if (mediaState.currentMediaSeconds > 0) return mediaState.currentMediaSeconds;
    const el = document.querySelector("#queue .queue_active .qe_time, #queue .queue_entry.active .qe_time");
    return el ? parseTimeToSeconds(el.textContent) : 0;
  }
  function getCurrentPlaybackSeconds() {
    const v = document.querySelector("#videowrap video");
    if (v && isFinite(v.currentTime) && v.currentTime > 0) return v.currentTime;
    return mediaState.currentPlaybackTime;
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
  var CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1e3;
  var FALLBACK_LIST_TITLE = "Coming Attractions";
  var MAX_ESTIMATED_AHEAD = 4;
  var _scheduleCache = null;
  var _fetchFailed = false;
  var _revalidating = false;
  var _observedGapSeconds = [];
  var _lastUnmatchedStart = null;
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
  function allScheduleTitles() {
    if (!_scheduleCache) return [];
    return _scheduleCache.days.flatMap((d) => d.sections.flatMap((s) => s.items));
  }
  onSocket("changeMedia", (d) => {
    const rawTitle = d && d.title;
    const title = rawTitle ? parseMovieFilename(rawTitle).title : null;
    const matchesSchedule = !!(title && _scheduleCache && allScheduleTitles().some((s) => s.title.toLowerCase() === title.toLowerCase()));
    if (rawTitle && !matchesSchedule && _scheduleCache) {
      _lastUnmatchedStart = Date.now();
    } else if (_lastUnmatchedStart) {
      _observedGapSeconds.push((Date.now() - _lastUnmatchedStart) / 1e3);
      _lastUnmatchedStart = null;
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
    } finally {
      _revalidating = false;
    }
  }
  async function ensureSchedule() {
    if (_scheduleCache || _fetchFailed) return;
    const cached = readCache();
    if (cached) {
      _scheduleCache = cached;
      if (Date.now() - (cached.fetchedAt || 0) > CACHE_MAX_AGE_MS) refetchAndCache();
      return;
    }
    try {
      const result = await fetchTonightsSchedule();
      _scheduleCache = result;
      writeCache(result);
    } catch (e) {
      _fetchFailed = true;
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
  function buildDaySections(day, isTodayFlag, infosByKey) {
    var _a;
    const flat = [];
    day.sections.forEach((section, si) => {
      section.items.forEach((item) => flat.push({ section, si, item }));
    });
    const currentTitle = isTodayFlag && movieState.lastMovieTitle ? parseMovieFilename(movieState.lastMovieTitle).title : "";
    const currentFlatIndex = currentTitle ? flat.findIndex((f) => f.item.title.toLowerCase() === currentTitle.toLowerCase()) : -1;
    const anchor = dayAnchorPacific(day.date);
    const isColdStart = currentFlatIndex === -1 && Date.now() < anchor.getTime();
    const learnedGap = (_a = medianGapSeconds(_observedGapSeconds)) != null ? _a : 600;
    let cumulative = currentFlatIndex !== -1 ? Math.max(0, getCurrentMediaSeconds() - getCurrentPlaybackSeconds()) : 0;
    const builtFlat = flat.map((f, idx) => {
      const info = infosByKey.get(f.item.title + "|" + f.item.year) || {};
      const base = buildBase(info, f.item.title, f.item.year);
      if (idx === currentFlatIndex) return { ...base, isNowPlaying: true, etaLabel: "" };
      if (isColdStart && idx === 0) {
        return { ...base, isNowPlaying: false, etaLabel: formatEta(anchor.getHours(), anchor.getMinutes(), "approx") };
      }
      if (currentFlatIndex === -1 || idx < currentFlatIndex) {
        return { ...base, isNowPlaying: false, etaLabel: "" };
      }
      const offset = idx - currentFlatIndex;
      cumulative += learnedGap;
      let etaLabel = "";
      if (offset <= MAX_ESTIMATED_AHEAD) {
        const precision = offset === 1 ? "exact" : "approx";
        const eta = new Date(Date.now() + cumulative * 1e3);
        etaLabel = formatEta(eta.getHours(), eta.getMinutes(), precision);
      }
      cumulative += info.runtime ? info.runtime * 60 : 0;
      return { ...base, isNowPlaying: false, etaLabel };
    });
    return day.sections.map((section, si) => ({
      name: section.name,
      slug: section.slug,
      items: builtFlat.filter((_, idx) => flat[idx].si === si)
    }));
  }
  async function getTonightsLineup() {
    await ensureSchedule();
    if (!_scheduleCache) return fallbackView();
    const allItems = allScheduleTitles();
    const infos = await Promise.all(allItems.map(({ title, year }) => lookupMovie(title, year)));
    const infosByKey = new Map(allItems.map((item, i) => [item.title + "|" + item.year, infos[i]]));
    const todayStr = pacificDateString();
    const days = _scheduleCache.days.map((day) => ({
      day: day.day,
      date: day.date,
      isToday: day.date === todayStr,
      sections: buildDaySections(day, day.date === todayStr, infosByKey)
    }));
    return { listTitle: _scheduleCache.title || FALLBACK_LIST_TITLE, fallback: false, days };
  }

  // src/cards/trivia.js
  function _escHtml(s) {
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
      list.innerHTML = items.map((t) => `<div class="sc-trivia-item">${_escHtml(t)}</div>`).join("");
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
    return isTv;
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
                </div>
            </div>`;
      document.body.appendChild(card);
      card.addEventListener("click", hideNowPlayingCard);
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
    card.querySelector("#sc-np-title").textContent = title + year;
    card.querySelector("#sc-np-overview").textContent = data.overview || "";
    const metaParts = [];
    if (data.rating) metaParts.push(`⭐ ${data.rating}`);
    if (data.runtime) metaParts.push(`${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`);
    if (data.genres && data.genres.length) metaParts.push(data.genres.slice(0, 3).join(" · "));
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
    const revealMs = _autoScrollOverview();
    clearTimeout(_npHideTimer);
    if (opts.autoHide) {
      const v = document.querySelector("#videowrap video");
      const playing = v && !v.paused;
      if (playing || !v) _npHideTimer = setTimeout(hideNowPlayingCard, Math.max(7e3, revealMs + 2500));
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
    const bindTitle = () => {
      const h = document.getElementById("videowrap-header");
      if (!h) return;
      if (npState.data && npState.data.imdbId && !document.getElementById("sc-trivia-btn")) {
        const btn = document.createElement("button");
        btn.id = "sc-trivia-btn";
        btn.type = "button";
        btn.textContent = "Trivia";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          showTriviaCard();
        });
        if (document.body.classList.contains("sc-video-dimmed")) btn.classList.add("sc-bar-dim");
        h.appendChild(btn);
      }
    };
    bindTitle();
    new MutationObserver(bindTitle).observe(document.body, { childList: true, subtree: true });
  }

  // src/lineup/screen.js
  var ASSET_BASE = "file:///android_asset/lineup-sections/";
  var DEFAULT_ART = ASSET_BASE + "_default.jpg";
  var _lastData = null;
  var _activeDay = null;
  var _activeSectionIndex = 0;
  function ensureScreenDom() {
    let screen2 = document.getElementById("sc-lineup-screen");
    if (screen2) return screen2;
    screen2 = document.createElement("div");
    screen2.id = "sc-lineup-screen";
    screen2.innerHTML = `
        <div id="sc-lineup-header"></div>
        <div id="sc-lineup-subtitle">Titles/times may be subject to change.</div>
        <nav id="sc-lineup-daytabs"></nav>
        <div id="sc-lineup-body"></div>`;
    document.body.appendChild(screen2);
    return screen2;
  }
  function renderLoading(screen2) {
    screen2.querySelector("#sc-lineup-daytabs").innerHTML = "";
    screen2.querySelector("#sc-lineup-body").innerHTML = '<div id="sc-lineup-loading">Fetching tonight’s lineup…</div>';
  }
  function itemButton(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sc-lineup-item" + (item.isNowPlaying ? " sc-lineup-item-current" : "") + (item.clickable === false ? " sc-lineup-item-static" : "");
    const titleText = `${item.cleanTitle}${item.cleanYear ? ` (${item.cleanYear})` : ""}`;
    const etaText = item.isNowPlaying ? "NOW PLAYING" : item.etaLabel || "";
    btn.innerHTML = `
        <div class="sc-lineup-poster" style="${item.poster ? `background-image:url(${item.poster})` : ""}">
            ${!item.poster ? `<div class="sc-lineup-poster-fallback">${titleText}</div>` : ""}
            ${etaText ? `<div class="sc-lineup-eta">${etaText}</div>` : ""}
        </div>`;
    if (item.clickable !== false) {
      btn.addEventListener("click", () => showNowPlayingCard(item, { autoHide: false, showProgress: item.isNowPlaying }));
    }
    return btn;
  }
  function sectionEl(section, index, total) {
    const el = document.createElement("div");
    el.className = "sc-lineup-section";
    const art = section.slug ? `${ASSET_BASE}${section.slug}.jpg` : DEFAULT_ART;
    el.style.backgroundImage = `url('${art}')`;
    const probe = new Image();
    probe.onerror = () => {
      el.style.backgroundImage = `url('${DEFAULT_ART}')`;
    };
    probe.src = art;
    if (section.name) {
      const name = document.createElement("div");
      name.className = "sc-lineup-section-name";
      name.innerHTML = `${section.name}${total > 1 ? `<span class="sc-lineup-section-count">${index + 1} / ${total}</span>` : ""}`;
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
      btn.textContent = d.day;
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
    if (_activeSectionIndex >= day.sections.length) _activeSectionIndex = 0;
    body.appendChild(sectionEl(day.sections[_activeSectionIndex], _activeSectionIndex, day.sections.length));
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
    const imgs = getMotdPosterImages();
    if (!imgs.length) return;
    const strip = document.createElement("div");
    strip.id = "sc-poster-strip";
    let zoomEl = document.getElementById("sc-poster-zoom");
    if (!zoomEl) {
      zoomEl = document.createElement("img");
      zoomEl.id = "sc-poster-zoom";
      document.body.appendChild(zoomEl);
    }
    const ZOOM_H = 300;
    const calcZoomTarget = (thumb) => {
      const rect = thumb.getBoundingClientRect();
      const attrW = parseInt(thumb.getAttribute("width") || 125);
      const attrH = parseInt(thumb.getAttribute("height") || 175);
      const zoomW = Math.round(ZOOM_H * (attrW / attrH));
      let left = rect.left + rect.width / 2 - zoomW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - zoomW - 8));
      let top;
      if (rect.top >= ZOOM_H + 8) {
        top = rect.top - ZOOM_H;
      } else {
        top = rect.bottom - ZOOM_H;
        top = Math.max(8, top);
      }
      return { left, top, width: zoomW, height: ZOOM_H };
    };
    const positionZoom = (thumb) => {
      const rect = thumb.getBoundingClientRect();
      const target = calcZoomTarget(thumb);
      zoomEl.classList.remove("sc-zoom-expanded");
      zoomEl.style.transition = "none";
      zoomEl.style.left = rect.left + "px";
      zoomEl.style.top = rect.top + "px";
      zoomEl.style.width = rect.width + "px";
      zoomEl.style.height = rect.height + "px";
      zoomEl.style.display = "block";
      zoomEl.getBoundingClientRect();
      zoomEl._collapsing = false;
      zoomEl.style.transition = "";
      zoomEl.style.left = target.left + "px";
      zoomEl.style.top = target.top + "px";
      zoomEl.style.width = target.width + "px";
      zoomEl.style.height = target.height + "px";
      zoomEl.classList.add("sc-zoom-expanded");
    };
    imgs.forEach((img) => {
      const thumb = document.createElement("img");
      thumb.src = img.src;
      thumb.className = "sc-poster-thumb";
      thumb.title = img.title || img.alt || "";
      thumb.setAttribute("width", img.getAttribute("width") || "125");
      thumb.setAttribute("height", img.getAttribute("height") || "175");
      thumb.addEventListener("mouseenter", () => {
        zoomEl._collapsing = false;
        zoomEl.src = thumb.src;
        zoomEl._activeThumb = thumb;
        positionZoom(thumb);
      });
      thumb.addEventListener("mouseleave", () => {
        zoomEl._collapsing = true;
        const rect = thumb.getBoundingClientRect();
        zoomEl.classList.remove("sc-zoom-expanded");
        zoomEl.style.left = rect.left + "px";
        zoomEl.style.top = rect.top + "px";
        zoomEl.style.width = rect.width + "px";
        zoomEl.style.height = rect.height + "px";
        const onEnd = () => {
          zoomEl.removeEventListener("transitionend", onEnd);
          if (zoomEl._collapsing) {
            zoomEl.style.display = "none";
            zoomEl.src = "";
            zoomEl._collapsing = false;
          }
        };
        zoomEl.addEventListener("transitionend", onEnd);
      });
      const wrap = document.createElement("a");
      wrap.appendChild(thumb);
      strip.appendChild(wrap);
    });
    document.body.appendChild(strip);
    if (!document.body._scPosterDismiss) {
      document.body._scPosterDismiss = true;
      document.addEventListener("click", (e) => {
        if (zoomEl.style.display !== "block" || zoomEl._collapsing) return;
        if (e.target && e.target.classList && e.target.classList.contains("sc-poster-thumb")) return;
        const active = zoomEl._activeThumb;
        if (active) active.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
    }
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "sc-poster-toggle";
    toggleBtn.textContent = "Coming Attractions";
    toggleBtn.title = "Show/hide weekend lineup";
    toggleBtn.dataset.noTvCaption = "1";
    toggleBtn.addEventListener("click", () => {
      if (isTv) {
        showLineupScreen();
        return;
      }
      const visible = strip.classList.toggle("sc-poster-visible");
      toggleBtn.classList.toggle("sc-poster-toggle-active", visible);
      chromeState.topBarIsOpen = visible;
      if (visible && chromeState.topBarWake) {
        chromeState.topBarWake();
      }
    });
    document.body.appendChild(toggleBtn);
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
    const btn = document.createElement("button");
    btn.id = "sc-usercount-btn";
    header.appendChild(btn);
    const panel = document.createElement("div");
    panel.id = "sc-users-panel";
    document.body.appendChild(panel);
    let open = false;
    const getUsers = () => {
      const items = [...document.querySelectorAll("#userlist .userlist_item")];
      return items.map((item) => {
        var _a;
        const spans = item.querySelectorAll("span");
        const nameSpan = spans.length >= 2 ? spans[1] : spans[0];
        return ((_a = nameSpan == null ? void 0 : nameSpan.textContent) == null ? void 0 : _a.trim()) || "";
      }).filter(Boolean).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    };
    const updateCount = (n) => {
      const count = typeof n === "number" ? n : (() => {
        var _a, _b;
        const cytubCount = document.getElementById("usercount");
        const raw = (_b = (_a = cytubCount == null ? void 0 : cytubCount.textContent) == null ? void 0 : _a.match(/\d+/)) == null ? void 0 : _b[0];
        return raw ? parseInt(raw) : getUsers().length;
      })();
      btn.textContent = count + " USERS";
    };
    const renderPanel = () => {
      const users = getUsers();
      panel.innerHTML = `
            <div class="sc-users-panel-header">${users.length} connected</div>
            ${users.map((u) => {
        const color = usernameToColor(u);
        return `<div class="sc-users-panel-name" style="color:${color}">${u}</div>`;
      }).join("")}
        `;
    };
    const closePanel = () => {
      panel.style.display = "none";
      btn.classList.remove("sc-users-active");
      open = false;
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      open = !open;
      if (open) {
        renderPanel();
        panel.style.display = "block";
        btn.classList.add("sc-users-active");
      } else {
        closePanel();
      }
    });
    document.addEventListener("click", (e) => {
      if (open && !panel.contains(e.target) && e.target !== btn) closePanel();
    });
    const ul = document.getElementById("userlist");
    if (ul) {
      new MutationObserver(() => {
        updateCount();
        if (open) renderPanel();
      }).observe(ul, { childList: true, subtree: true });
    }
    onSocket("usercount", (n) => updateCount(n));
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

  // src/player/scrubber.js
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
    try {
      const p = window.PLAYER && window.PLAYER.player;
      if (p && typeof p.userActive === "function") p.userActive(false);
    } catch (e) {
    }
    const el = document.querySelector("#videowrap .video-js");
    if (el) {
      el.classList.add("vjs-user-inactive");
      el.classList.remove("vjs-user-active");
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
  var tvNavState = { setFocus: null };
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
    const OVERLAY_IDS = ["sc-settings-overlay", "sc-modal-overlay", "sc-trivia-card", "sc-users-panel", "sc-poll-panel", "sc-np-card", "sc-lineup-screen"];
    const isOverlayOpen = (id, o) => !!(o && isVisible(o) && (id !== "sc-np-card" || o.classList.contains("sc-np-visible")) && (id !== "sc-trivia-card" || o.classList.contains("sc-show")) && (id !== "sc-lineup-screen" || o.classList.contains("sc-lineup-visible")));
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
      "sc-usercount-btn",
      "sc-poll-btn",
      "sc-poster-toggle",
      "sc-trivia-btn",
      "sc-newmsg-pill",
      "sc-chat-collapse-btn",
      "sc-chat-textarea"
    ];
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
    function seekBy(delta) {
      try {
        const p = window.PLAYER && window.PLAYER.player;
        if (p && typeof p.currentTime === "function") {
          p.currentTime(Math.max(0, (p.currentTime() || 0) + delta));
          wakeVideoControls();
          return;
        }
      } catch (e) {
      }
      const v = document.querySelector("#videowrap video");
      if (v) {
        try {
          v.currentTime = Math.max(0, v.currentTime + delta);
          wakeVideoControls();
        } catch (e) {
        }
      }
    }
    const posterZoom = (a, on) => {
      const img = a && a.querySelector("img");
      if (img) img.dispatchEvent(new MouseEvent(on ? "mouseenter" : "mouseleave", { bubbles: true }));
    };
    function setPosterFocus(a, thumbs) {
      thumbs.forEach((t) => {
        if (t !== a) posterZoom(t, false);
      });
      setFocus(a);
      posterZoom(a, true);
    }
    function move(dir) {
      if (focusEl && focusEl.classList && focusEl.classList.contains("vjs-progress-control") && (dir === "left" || dir === "right")) {
        if (isDesynced()) seekBy(dir === "right" ? 10 : -10);
        return;
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
      const strip = document.getElementById("sc-poster-strip");
      if (strip && strip.classList.contains("sc-poster-visible")) {
        const toggle = document.getElementById("sc-poster-toggle");
        const thumbs = [...strip.querySelectorAll("a")];
        if (thumbs.length) {
          if (focusEl === toggle && dir === "down") {
            setPosterFocus(thumbs[0], thumbs);
            return;
          }
          if (strip.contains(focusEl)) {
            if (dir === "left" || dir === "right") {
              const i = thumbs.indexOf(focusEl);
              const ni = dir === "right" ? Math.min(thumbs.length - 1, i + 1) : Math.max(0, i - 1);
              setPosterFocus(thumbs[ni], thumbs);
              return;
            }
            posterZoom(focusEl, false);
            if (toggle) setFocus(toggle);
            return;
          }
        }
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
          if (dir === "up") {
            const activeTab = document.querySelector(".sc-lineup-daytab-active");
            if (activeTab) {
              setFocus(activeTab);
              return;
            }
          }
        }
        if (dir === "down" && focusEl && focusEl.classList.contains("sc-lineup-daytab")) {
          const body = document.getElementById("sc-lineup-body");
          const firstItem = body && body.querySelector(".sc-lineup-item");
          if (firstItem) {
            setFocus(firstItem);
            return;
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
        const sc = scope.querySelector && scope.querySelector("#sc-trivia-list, #sc-settings-modal, #messagebuffer") || document.getElementById("messagebuffer");
        if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += dir === "down" ? 140 : -140;
      }
    }
    function activate() {
      if (!focusEl) {
        move("right");
        return;
      }
      if (focusEl.classList && focusEl.classList.contains("vjs-progress-control")) return;
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
      const poster = document.getElementById("sc-poster-strip");
      if (poster && poster.classList.contains("sc-poster-visible")) {
        const t = document.getElementById("sc-poster-toggle");
        if (t) t.click();
        else poster.classList.remove("sc-poster-visible");
        clearFocus();
        return true;
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
    window.__scTvKey = function(dir) {
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
        else move(dir);
      } catch (e) {
      }
    };
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
    if (!isTv) return;
    let timer = null;
    const hide = () => document.body.classList.add("sc-chrome-hidden");
    const show = () => {
      document.body.classList.remove("sc-chrome-hidden");
      if (typeof chromeState.topBarWake === "function") chromeState.topBarWake();
      clearTimeout(timer);
      timer = setTimeout(hide, 4e3);
    };
    ["mousemove", "keydown", "click", "touchstart", "wheel"].forEach((ev) => document.addEventListener(ev, show, { passive: true }));
    chromeState.chromeWake = show;
    timer = setTimeout(hide, 4e3);
  }
  var _CHAT_MODES = isTv ? ["sidebar", "overlay", "hidden"] : ["sidebar", "overlay", "hidden", "chatonly"];
  var _CHAT_MODE_ICONS = { sidebar: "▐", overlay: "▣", hidden: "⊠", chatonly: "☰" };
  var _CHAT_MODE_LABELS = { sidebar: "Sidebar", overlay: "Overlay", hidden: "Hidden", chatonly: "Chat Only" };
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
    const btn = document.getElementById("sc-chatmode-btn");
    if (btn) {
      btn.textContent = _CHAT_MODE_ICONS[mode] || "▐";
      const label = _CHAT_MODE_LABELS[mode] || mode;
      btn.title = "Chat: " + label + " (press C)";
      btn.dataset.tvLabel = "Chat: " + label;
    }
    const colBtn = document.getElementById("sc-chat-collapse-btn");
    if (colBtn) colBtn.textContent = mode === "hidden" ? "‹" : "›";
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
  function initVertControlBand() {
    if (document.getElementById("sc-vert-ctrl-band")) return;
    const band = document.createElement("div");
    band.id = "sc-vert-ctrl-band";
    document.body.appendChild(band);
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
  function initDesyncButton() {
    const btn = document.createElement("button");
    btn.id = "sc-desync-btn";
    btn.textContent = "⟳";
    btn.title = "Free watch — click to watch freely, click again to re-sync";
    btn.dataset.tvLabel = "Free Watch";
    document.body.appendChild(btn);
    let desynced = false;
    let savedListeners = null;
    const getMediaUpdateListeners = () => {
      var _a, _b;
      const key = "$mediaUpdate";
      if ((_a = socket._callbacks) == null ? void 0 : _a[key]) return { store: "_callbacks", key };
      if ((_b = socket._events) == null ? void 0 : _b.mediaUpdate) return { store: "_events", key: "mediaUpdate" };
      return null;
    };
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
    btn.addEventListener("click", () => {
      if (typeof socket === "undefined" || !socket) return;
      desynced = !desynced;
      if (desynced) {
        freezeSync();
        btn.classList.add("sc-desync-active");
        btn.title = "Free watch ON — click to re-sync";
      } else {
        thawSync();
        btn.classList.remove("sc-desync-active");
        btn.title = "Free watch — click to watch freely";
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
    const m = String(s || "").match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return m ? [+m[1] || 0, +m[2] || 0, +m[3] || 0] : [0, 0, 0];
  }
  function _verNewer(a, b) {
    const x = _verTuple(a), y = _verTuple(b);
    for (let i = 0; i < 3; i++) {
      if (x[i] !== y[i]) return x[i] > y[i];
    }
    return false;
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
          _updateInfo = { available: _verNewer(c.tag, current), current, latest: c.tag, notes: c.notes || "", url: c.url || GH_RELEASES_PAGE };
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
    try {
      localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify({ ts: Date.now(), tag, notes, url }));
    } catch (e) {
    }
    _updateInfo = { available: _verNewer(tag, current), current, latest: tag, notes, url };
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
  function injectMovieLinks(titleEl) {
    const rawTitle = titleEl.textContent.trim().replace(/^currently\s+playing[:\s]*/i, "").replace(/^now\s+playing[:\s]*/i, "").trim();
    if (!rawTitle || rawTitle === movieState.lastMovieTitle || rawTitle.length < 2) return;
    movieState.lastMovieTitle = rawTitle;
    ["sc-movie-links", "sc-movie-stats", "sc-trivia-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    npState.data = null;
    const isYt = isYouTubeMedia();
    let ytSeconds = 0;
    if (isYt) {
      ytSeconds = getCurrentMediaSeconds();
      if (ytSeconds < 3600) return;
    }
    const { title, year } = isYt ? parseYouTubeTitle(rawTitle) : parseMovieFilename(rawTitle);
    if (!title || title.length < 2) return;
    if (movieLinksEnabled()) {
      const linkRow = document.createElement("span");
      linkRow.id = "sc-movie-links";
      linkRow.innerHTML = '<span class="sc-movie-loading">…</span>';
      titleEl.parentElement.insertBefore(linkRow, titleEl.nextSibling);
    }
    lookupMovie(title, year).then((movieData) => {
      const { links, killCount, parentalGuide, cleanTitle, cleanYear } = movieData;
      if (isYt) {
        if (!cleanTitle) {
          const r = document.getElementById("sc-movie-links");
          if (r) r.remove();
          return;
        }
        if (movieData.runtime && ytSeconds) {
          const diff = Math.abs(movieData.runtime - ytSeconds / 60);
          if (diff > 30) {
            const r = document.getElementById("sc-movie-links");
            if (r) r.remove();
            return;
          }
        }
      }
      npState.data = movieData;
      if (_npCardEnabled() && npState.introDone) showNowPlayingCard(movieData, { autoHide: true });
      if (cleanTitle && titleEl) {
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
      const currentRow = document.getElementById("sc-movie-links");
      if (currentRow) {
        currentRow.innerHTML = "";
        let anyLink = false;
        LINK_DEFS.forEach(({ key, label, color, fg, char }) => {
          const url = links[key];
          if (!url) return;
          anyLink = true;
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.title = `${label}: "${title}"${year ? ` (${year})` : ""}`;
          a.className = "sc-movie-link";
          a.style.background = color;
          a.style.color = fg;
          a.textContent = char;
          currentRow.appendChild(a);
        });
        if (!anyLink) currentRow.remove();
      }
      const statParts = [];
      if (killCount !== null) statParts.push(`💀 ${killCount} on-screen kills`);
      const old = document.getElementById("sc-movie-stats");
      if (old) old.remove();
      if (statParts.length) {
        const statsEl = document.createElement("div");
        statsEl.id = "sc-movie-stats";
        statsEl.textContent = statParts.join("  ·  ");
        document.body.appendChild(statsEl);
        setTimeout(() => {
          if (statsEl.parentNode) statsEl.remove();
        }, 12e3);
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
    const armStaleCheck = () => {
      if (typeof loadMediaPlayer !== "function") {
        location.reload();
        return;
      }
      _resyncArmed = true;
      clearTimeout(_resyncTimer);
      _resyncTimer = setTimeout(() => {
        if (_resyncArmed) {
          _resyncArmed = false;
          maybeRebuildIfStale();
        }
      }, 1e4);
    };
    window.__scStaleResync = armStaleCheck;
    socket.on("changeMedia", (data) => {
      try {
        _lastChangeMediaData = data;
        if (data && typeof data.paused === "boolean") _roomPaused = data.paused;
        if (_resyncArmed) {
          _resyncArmed = false;
          clearTimeout(_resyncTimer);
          setTimeout(maybeRebuildIfStale, 4e3);
        }
        mediaState.currentMediaSeconds = data && typeof data.seconds === "number" ? data.seconds : 0;
        mediaState.currentMediaType = data && data.type ? data.type : "";
        const key = (data && (data.id || "")) + "|" + (data && (data.title || ""));
        if (key === _lastMediaKey) return;
        _lastMediaKey = key;
        movieState.lastMovieTitle = "";
        npState.data = null;
        const _staleTrivia = document.getElementById("sc-trivia-btn");
        if (_staleTrivia) _staleTrivia.remove();
        clearTimeout(drmState.checkTimer);
        hideDrmOverlay();
        if (mediaState.currentMediaType === "yt") drmState.checkTimer = setTimeout(() => checkYtDrm(0), 1500);
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
            body.sc-chat-hidden #sc-video-tap { width: 100vw !important; height: 100vh !important; }
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
                top: 50vh !important; height: 44px !important; bottom: auto !important;
                background: transparent !important;
                z-index: 10001 !important;
                padding: 0 12px !important;
                border: none !important; box-shadow: none !important;
            }
            /* Collapse button not needed in vertical — chatmode btn in band handles it */
            body.sc-vertical #sc-chat-collapse-btn { display: none !important; }
            #sc-usercount-btn, #sc-poll-btn {
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
            body.sc-vertical #sc-usercount-btn,
            body.sc-vertical #sc-poll-btn {
                line-height: 44px !important;
                height: 44px !important;
                padding: 0 8px !important;
                -webkit-appearance: none !important;
                appearance: none !important;
            }
            #sc-usercount-btn:hover, #sc-poll-btn:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-usercount-btn.sc-users-active,
            #sc-poll-btn.sc-poll-btn-active { color: white !important; }

            /* Collapse/cycle button — far right of chat header */
            #sc-chat-collapse-btn {
                background: none !important; border: none !important;
                color: rgba(255,255,255,0.4) !important;
                font-size: 18px !important; font-weight: 300 !important;
                cursor: pointer !important; padding: 0 4px !important;
                line-height: 1 !important; margin-left: auto !important;
                order: 999 !important; flex-shrink: 0 !important;
                transition: color 0.2s !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            #sc-chat-collapse-btn:hover { color: rgba(255,255,255,0.9) !important; }
            body.sc-tv #sc-chat-collapse-btn { font-size: 26px !important; padding: 0 6px !important; }

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
                bottom: calc(50vh - 44px) !important;
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
            #sc-poster-toggle.sc-poster-toggle-active {
                color: rgba(255,255,255,0.9) !important;
            }
            /* Pull the control bar out of embed-responsive's constrained box
               and pin it as a fixed element flush to the bottom of the screen.
               Right edge stops just before the settings button. */
            /* ===== VIDEO.JS CONTROL BAR — pill style matching our UI buttons ===== */
            .video-js .vjs-control-bar {
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
            body.sc-vertical .video-js .vjs-control-bar {
                /* Sit at the bottom of the video (just above the 50vh chat header),
                   not pinned to the screen bottom where it would land over chat. */
                bottom: calc(50vh + 4px) !important;
                right: 4px !important;
                left: 4px !important;
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

            /* ===== POSTER STRIP ===== */
            #sc-poster-strip {
                display: none !important; /* hidden by default */
                position: fixed !important;
                top: 20px !important;   /* drops down from the header bar */
                left: 0 !important;
                z-index: 19500 !important;
                width: 80vw !important;
                background: rgba(0,0,0,0.93) !important;
                padding: 8px 12px !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                white-space: nowrap !important;
                border-bottom: 1px solid rgba(255,255,255,0.12) !important;
                scrollbar-width: thin !important;
                scrollbar-color: rgba(255,255,255,0.2) transparent !important;
            }
            body.sc-vertical #sc-poster-strip {
                width: 100vw !important;
                top: 20px !important;
                bottom: auto !important;
            }
            #sc-poster-strip.sc-poster-visible {
                display: block !important;
            }
            .sc-poster-thumb {
                height: 110px !important;
                width: auto !important;
                border-radius: 4px !important;
                margin-right: 6px !important;
                opacity: 0.82 !important;
                transition: opacity 0.15s !important;
                vertical-align: top !important;
                cursor: pointer !important;
                display: inline-block !important;
                flex-shrink: 0 !important;
            }
            .sc-poster-thumb:hover { opacity: 1 !important; }

            #sc-poster-zoom {
                display: none;
                position: fixed !important;
                z-index: 99990 !important;
                pointer-events: none !important;
                border-radius: 4px !important;
                box-shadow: 0 0 0 rgba(0,0,0,0) !important;
                border: 1px solid rgba(255,255,255,0.0) !important;
                /* transition animates position, size, shadow, border together */
                transition:
                    top 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    width 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    height 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 0.22s ease,
                    border-color 0.22s ease,
                    border-radius 0.22s ease !important;
            }
            #sc-poster-zoom.sc-zoom-expanded {
                box-shadow: 0 12px 48px rgba(0,0,0,0.92) !important;
                border-color: rgba(255,255,255,0.2) !important;
                border-radius: 6px !important;
            }


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
            body.sc-vertical #sc-poster-toggle {
                top: 0 !important;
                right: 0 !important;
                left: auto !important;
                bottom: auto !important;
            }

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

            /* ===== MOVIE LINKS ===== */
            #sc-movie-links {
                display: inline-flex !important;
                gap: 3px !important;
                margin-left: 8px !important;
                vertical-align: middle !important;
            }
            /* Dim: override inline background with transparent, fade text to ghost */
            #sc-movie-links.sc-bar-dim .sc-movie-link {
                background: transparent !important;
                color: rgba(255,255,255,0.3) !important;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15) !important;
            }
            .sc-movie-link {
                display: inline-flex !important;
                align-items: center !important; justify-content: center !important;
                width: 17px !important; height: 17px !important;
                border-radius: 3px !important;
                font-size: 10px !important; font-weight: 900 !important;
                text-decoration: none !important;
                line-height: 1 !important; font-family: Georgia, serif !important;
                flex-shrink: 0 !important; cursor: pointer !important;
                transition: background 2s ease, color 2s ease, box-shadow 2s ease, filter 0.2s ease !important;
            }
            .sc-movie-link:hover { filter: brightness(1.3) !important; }
            .sc-movie-loading { font-size: 11px !important; color: rgba(255,255,255,0.3) !important; margin-left: 6px !important; }
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
            body.sc-horizontal #sc-desync-btn {
                bottom: 6px !important;
                right: calc(20vw + 38px) !important;
            }
            body.sc-vertical #sc-desync-btn {
                bottom: 43vh !important;
                right: 46px !important;
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
               Title strip (36px) → video (ends at 50vh) → control band (44px) → chat */
            body.sc-vertical #videowrap {
                position: fixed !important; top: 36px !important; left: 0 !important;
                width: 100vw !important; height: calc(50vh - 36px) !important;
                z-index: 9999 !important; background: black !important;
                border: none !important; outline: none !important;
                box-shadow: none !important;
            }
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer {
                width: 100vw !important; height: calc(50vh - 36px) !important;
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
                width: 100vw !important; height: calc(50vh - 44px) !important;
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
                font-size: 14px !important; overflow-x: hidden !important; overflow-y: auto !important; padding-bottom: 5px !important;
            }
            /* Long usernames / links must wrap, never widen the panel */
            #messagebuffer, #messagebuffer * {
                overflow-wrap: anywhere !important; word-break: break-word !important;
                max-width: 100% !important;
            }
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

            body.sc-horizontal #sc-settings-btn {
                bottom: 6px !important; right: calc(20vw + 102px) !important;
            }
            body.sc-vertical #sc-settings-btn {
                bottom: 43vh !important; right: 122px !important;
            }

            /* ===== CAST BUTTON (mobile only) — fly-out cluster, one slot past settings ===== */
            #sc-cast-btn {
                position: fixed !important;
                z-index: 20002 !important;
                background: rgba(255,255,255,0.08) !important;
                color: rgba(255,255,255,0.55) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: color 0.3s ease, background 0.3s ease, opacity 0.25s ease, transform 0.25s ease !important;
                line-height: 1 !important;
            }
            #sc-cast-btn:hover { color: white !important; background: rgba(255,255,255,0.22) !important; }
            #sc-cast-btn.sc-cast-active { color: #7dffa0 !important; background: rgba(125,255,160,0.18) !important; }
            /* Horizontal: vertical stack at the left edge, directly under settings (56px pitch) */
            body.sc-horizontal #sc-cast-btn {
                left: 10px !important; right: auto !important; bottom: auto !important;
                top: calc(50% + 112px) !important;
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(-14px) !important;
            }
            body.sc-horizontal.sc-leftzone #sc-cast-btn {
                opacity: 1 !important; pointer-events: auto !important; transform: translateX(0) !important;
            }
            /* Vertical: control-band row, one slot left of settings */
            body.sc-vertical #sc-cast-btn {
                top: calc(50vh + 4px) !important; bottom: auto !important;
                right: 140px !important; left: auto !important;
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(16px) !important;
            }
            body.sc-vertical.sc-rightzone #sc-cast-btn {
                opacity: 1 !important; pointer-events: auto !important; transform: translateX(0) !important;
            }
            /* Hide with the rest of the cluster while the keyboard is up */
            body.sc-kb-open #sc-cast-btn { opacity: 0 !important; pointer-events: none !important; }

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
            /* App-update section + the settings-gear "update available" highlight */
            #sc-update-notes {
                white-space: pre-wrap !important; max-height: 130px !important; overflow-y: auto !important;
                margin: 6px 0 8px !important; padding: 8px 10px !important;
                background: rgba(255,255,255,0.05) !important; border-radius: 6px !important;
                font-size: 12px !important; line-height: 1.45 !important; color: rgba(255,255,255,0.78) !important;
            }
            #sc-update-notes.sc-hidden, #sc-update-download.sc-hidden { display: none !important; }
            #sc-update-status.sc-update-yes { color: #7dffa0 !important; font-weight: 600 !important; }
            #sc-update-status.sc-update-no  { color: rgba(255,255,255,0.5) !important; }
            #sc-update-download { margin-top: 8px !important; background: rgba(125,255,160,0.16) !important;
                color: #7dffa0 !important; border-color: rgba(125,255,160,0.4) !important; }
            #sc-update-download:hover { background: rgba(125,255,160,0.28) !important; }
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
            /* Prevent input zoom on mobile */
            #sc-chat-textarea { font-size: 16px !important; }

            /* ── VERTICAL (portrait phone): YouTube-style stack ─── */
            /* Title strip (36px) → video (50vh total) → ctrl band (44px) → chat */
            body.sc-vertical #videowrap,
            body.sc-vertical #videowrap .embed-responsive,
            body.sc-vertical #ytapiplayer    { height: calc(50vh - 36px) !important; }
            body.sc-vertical #chatwrap       { height: calc(50vh - 44px) !important; }
            body.sc-vertical #sc-users-panel { bottom: calc(50vh - 44px) !important; }
            body.sc-vertical #sc-poll-panel  { bottom: calc(50vh - 44px) !important; }
            /* Three buttons sit inside the control band — evenly spaced from the right */
            body.sc-vertical #sc-chatmode-btn {
                bottom: auto !important; top: calc(50vh + 4px) !important;
                right: 8px !important; left: auto !important; transform: none !important;
                opacity: 1 !important; pointer-events: auto !important;
            }
            body.sc-vertical #sc-desync-btn {
                bottom: auto !important; top: calc(50vh + 4px) !important;
                right: 52px !important; left: auto !important;
                opacity: 1 !important; pointer-events: auto !important;
            }
            body.sc-vertical #sc-settings-btn {
                bottom: auto !important; top: calc(50vh + 4px) !important;
                right: 96px !important; left: auto !important;
                opacity: 1 !important; pointer-events: auto !important;
            }
            body.sc-vertical .video-js .vjs-control-bar { bottom: calc(50vh + 4px) !important; left: 4px !important; right: 4px !important; }

            /* Control band element — dark strip between video and chat */
            #sc-vert-ctrl-band { display: none !important; }
            body.sc-vertical #sc-vert-ctrl-band {
                display: block !important;
                position: fixed !important; left: 0 !important; right: 0 !important;
                top: 50vh !important; height: 44px !important;
                background: rgba(8,6,12,0.95) !important;
                z-index: 10000 !important;
                border-top: 1px solid rgba(255,255,255,0.10) !important;
                border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            }
            /* Right-zone slide drawer — buttons hidden off-screen right, revealed on edge swipe */
            body.sc-vertical #sc-chatmode-btn,
            body.sc-vertical #sc-desync-btn,
            body.sc-vertical #sc-settings-btn {
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(16px) !important;
                transition: opacity 0.25s ease, transform 0.25s ease !important;
            }
            body.sc-vertical.sc-rightzone #sc-chatmode-btn,
            body.sc-vertical.sc-rightzone #sc-desync-btn,
            body.sc-vertical.sc-rightzone #sc-settings-btn {
                opacity: 1 !important; pointer-events: auto !important;
                transform: translateX(0) !important;
            }
            /* Grip — thin pill on the right edge of the control band */
            #sc-vert-ctrl-grip { display: none !important; }
            body.sc-vertical #sc-vert-ctrl-grip {
                display: block !important;
                position: fixed !important; right: 0 !important; top: 50vh !important;
                width: 4px !important; height: 44px !important;
                background: rgba(255,255,255,0.22) !important;
                z-index: 10002 !important; cursor: pointer !important;
                border-radius: 2px 0 0 2px !important;
                transition: width 0.15s ease, background 0.2s ease !important;
            }
            body.sc-vertical #sc-vert-ctrl-grip:active { background: rgba(255,255,255,0.5) !important; width: 6px !important; }
            body.sc-vertical.sc-rightzone #sc-vert-ctrl-grip { opacity: 0 !important; pointer-events: none !important; }

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
            body.sc-kb-open.sc-vertical #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* ── VERTICAL keyboard open ─────────────────────── */
            /* Hide floating buttons while typing */
            body.sc-kb-open.sc-vertical #sc-chatmode-btn,
            body.sc-kb-open.sc-vertical #sc-desync-btn,
            body.sc-kb-open.sc-vertical #sc-settings-btn,
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
            body.sc-kb-open.sc-horizontal #chatwrap {
                height: var(--sc-chat-h) !important;
                bottom: var(--sc-kb-h) !important;
            }
            /* Lift floating buttons above the keyboard */
            body.sc-kb-open.sc-horizontal #sc-desync-btn,
            body.sc-kb-open.sc-horizontal #fs-toggle-btn,
            body.sc-kb-open.sc-horizontal #sc-settings-btn {
                bottom: calc(var(--sc-kb-h) + 6px) !important;
            }

            /* ── HORIZONTAL (landscape phone / tablet / TV) ──── */
            /* Control cluster — vertical stack pinned to the mid-left edge.
               Hidden until the mouse moves to the left side (sc-leftzone),
               then revealed and clickable; fades out again afterwards. */
            body.sc-horizontal #sc-chatmode-btn,
            body.sc-horizontal #sc-desync-btn,
            body.sc-horizontal #sc-settings-btn {
                left: 10px !important; right: auto !important; bottom: auto !important;
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(-14px) !important;
                transition: opacity 0.25s ease, transform 0.25s ease !important;
            }
            /* Slide/fade in when the mouse reaches the left edge (or the grip) */
            body.sc-horizontal.sc-leftzone #sc-chatmode-btn,
            body.sc-horizontal.sc-leftzone #sc-desync-btn,
            body.sc-horizontal.sc-leftzone #sc-settings-btn {
                opacity: 1 !important; pointer-events: auto !important; transform: translateX(0) !important;
            }

            /* Subtle drawer "grip" — the only thing visible until you reach the edge */
            #sc-cluster-grip { display: none !important; }
            body.sc-horizontal #sc-cluster-grip {
                display: block !important;
                position: fixed !important; left: 0 !important; top: 50% !important;
                transform: translateY(-50%) !important;
                width: 5px !important; height: 56px !important;
                border-radius: 0 4px 4px 0 !important;
                background: rgba(255,255,255,0.16) !important;
                z-index: 20049 !important; cursor: pointer !important;
                transition: background 0.2s ease, width 0.15s ease, opacity 0.25s ease !important;
            }
            body.sc-horizontal #sc-cluster-grip:hover { background: rgba(255,255,255,0.5) !important; width: 7px !important; }
            body.sc-tv.sc-horizontal #sc-cluster-grip { height: 72px !important; width: 6px !important; }
            /* Hide the grip once the cluster is open */
            body.sc-leftzone #sc-cluster-grip { opacity: 0 !important; pointer-events: none !important; }
            /* Vertical positions (44px buttons, 56px pitch) */
            body.sc-horizontal #sc-chatmode-btn { top: calc(50% - 56px) !important; }
            body.sc-horizontal #sc-desync-btn   { top: 50% !important; }
            body.sc-horizontal #sc-settings-btn { top: calc(50% + 56px) !important; }
            /* TV — bigger buttons, wider pitch */
            body.sc-tv.sc-horizontal #sc-chatmode-btn { top: calc(50% - 64px) !important; }
            body.sc-tv.sc-horizontal #sc-desync-btn   { top: 50% !important; }
            body.sc-tv.sc-horizontal #sc-settings-btn { top: calc(50% + 64px) !important; }
            /* Seek bar (raw video only) spans the video, stopping at the chat edge */
            body.sc-horizontal .video-js .vjs-control-bar { left: 4px !important; right: calc(19vw + 12px) !important; }

            /* ── TV: larger text, focus ring on interactive items ─ */
            body.sc-tv #messagebuffer { font-size: 18px !important; }
            body.sc-tv #sc-chat-textarea { font-size: 18px !important; }
            body.sc-tv #sc-desync-btn, body.sc-tv #fs-toggle-btn,
            body.sc-tv #sc-settings-btn {
                width: 52px !important; height: 52px !important; font-size: 22px !important;
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
            #sc-np-title {
                font-size: 44px !important; font-weight: 800 !important; line-height: 1.05 !important;
                text-shadow: 0 2px 16px rgba(0,0,0,0.8) !important; margin-bottom: 14px !important;
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

            /* ── TRIVIA LINK (subtle, top-right next to Coming Attractions) + CARD ── */
            #sc-trivia-btn {
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
            #sc-trivia-btn:hover { color: rgba(255,255,255,0.9) !important; }
            #sc-trivia-btn.sc-bar-dim { opacity: 0 !important; }
            /* Trivia button hidden in vertical — title bar is too narrow */
            body.sc-vertical #sc-trivia-btn { display: none !important; }
            body.sc-tv #sc-trivia-btn { font-size: 12px !important; }

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
                overflow: hidden !important; /* one section fills the remaining space -- no scrolling */
            }
            #sc-lineup-screen.sc-lineup-visible { display: flex !important; }
            #sc-lineup-header {
                color: #fff !important; font-size: 14px !important; font-weight: 700 !important;
                line-height: 1.25 !important; margin-bottom: 4px !important;
            }
            #sc-lineup-subtitle {
                color: rgba(255,255,255,0.45) !important; font-size: 11px !important;
                margin-bottom: 12px !important;
            }
            body.sc-tv #sc-lineup-header { font-size: 15px !important; }
            body.sc-tv #sc-lineup-subtitle { font-size: 12px !important; }
            #sc-lineup-body {
                width: 100% !important; display: flex !important; flex-direction: column !important;
                /* Holds exactly one .sc-lineup-section at a time (a Netflix-row-style pager,
                   not a scrollable stack) -- Up/Down PAGES between sections via
                   stepLineupSection() in screen.js rather than scrolling through them. flex:1
                   fills whatever height #sc-lineup-screen has left after the header/tabs. */
                flex: 1 1 auto !important; min-height: 0 !important;
            }

            /* Day tabs — plain button row, same shape as settings.js's tab pattern; the whole-
               page geometric scorer handles Left/Right across tabs and Up/Down into the first
               section on its own (no special-case nav code needed, see tvnav.js). */
            #sc-lineup-daytabs {
                display: flex !important; gap: 10px !important; margin-bottom: 6px !important;
            }
            .sc-lineup-daytab {
                background: rgba(255,255,255,0.08) !important; border: none !important;
                color: rgba(255,255,255,0.65) !important; font-weight: 700 !important;
                font-size: 13px !important; letter-spacing: 0.06em !important;
                padding: 8px 18px !important; border-radius: 999px !important; cursor: pointer !important;
            }
            .sc-lineup-daytab-active { background: var(--np-accent, #ff5b73) !important; color: #fff !important; }
            body.sc-tv .sc-lineup-daytab { font-size: 15px !important; padding: 10px 22px !important; }
            body.sc-tv .sc-lineup-daytab.sc-tv-focus {
                outline: 3px solid #e0701a !important; outline-offset: 2px !important;
            }

            /* The one currently-shown section: fills #sc-lineup-body's full height (not just its
               content's natural size), full-bleed background art (a bundled Android asset, same
               9 names every week) behind its rail of posters, content vertically centered within
               whatever space is available so it reads as "this grouping fits the screen" rather
               than pinned to one edge. */
            .sc-lineup-section {
                position: relative !important; width: 100% !important; height: 100% !important;
                border-radius: 10px !important; overflow: hidden !important;
                background-size: cover !important; background-position: center !important;
                background-color: rgba(255,255,255,0.04) !important;
                display: flex !important; flex-direction: column !important; justify-content: center !important;
                padding: 14px 0 16px !important; box-sizing: border-box !important;
            }
            .sc-lineup-section::before {
                content: '' !important; position: absolute !important; inset: 0 !important;
                background: linear-gradient(180deg, rgba(6,4,9,0.55) 0%, rgba(6,4,9,0.82) 100%) !important;
            }
            .sc-lineup-section-fallback { background: none !important; padding: 0 !important; }
            .sc-lineup-section-fallback::before { content: none !important; }
            .sc-lineup-section-name {
                position: relative !important; color: #fff !important; font-weight: 700 !important;
                font-size: 13px !important; letter-spacing: 0.1em !important; text-transform: uppercase !important;
                padding: 0 24px 10px !important; text-shadow: 0 2px 6px rgba(0,0,0,0.6) !important;
            }
            body.sc-tv .sc-lineup-section-name { font-size: 15px !important; }
            /* Position within the day's groupings (e.g. "2 / 3") -- the only orientation cue
               now that sections page instead of stacking where the next one could peek into view. */
            .sc-lineup-section-count {
                margin-left: 10px !important; font-weight: 600 !important; letter-spacing: 0.04em !important;
                color: rgba(255,255,255,0.55) !important; text-transform: none !important;
            }

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
                flex: 0 0 220px !important; background: transparent !important; border: none !important;
                color: #fff !important; cursor: pointer !important; text-align: left !important;
                padding: 0 !important; display: flex !important; flex-direction: column !important; gap: 10px !important;
                scroll-snap-align: start !important;
            }
            .sc-lineup-poster {
                position: relative !important; /* anchors the eta badge + no-art fallback title below */
                width: 220px !important; height: 308px !important; border-radius: 8px !important;
                background-color: rgba(255,255,255,0.08) !important;
                background-size: contain !important; background-repeat: no-repeat !important;
                background-position: center !important;
                box-shadow: 0 6px 14px rgba(0,0,0,0.45) !important;
                flex-shrink: 0 !important; /* keep the box exact regardless of available space */
            }
            .sc-lineup-item-current .sc-lineup-poster {
                box-shadow: 0 0 0 3px var(--np-accent, #ff5b73), 0 6px 14px rgba(0,0,0,0.45) !important;
            }
            .sc-lineup-title { font-size: 15px !important; font-weight: 600 !important; line-height: 1.3 !important; }
            /* No TMDB match at all -- the poster box shows the movie's own title/year instead of
               sitting empty; the item's external .sc-lineup-title is omitted in this case (see
               screen.js) so the name isn't shown twice. */
            .sc-lineup-poster-fallback {
                position: absolute !important; inset: 0 !important; display: flex !important;
                align-items: center !important; justify-content: center !important; text-align: center !important;
                padding: 14px !important; box-sizing: border-box !important;
                color: rgba(255,255,255,0.85) !important; font-size: 14px !important; font-weight: 600 !important;
                line-height: 1.35 !important;
            }
            /* Start-time estimate, overlaid directly on the poster art (a caption bar pinned to
               its bottom edge) instead of a separate line below -- readable over any art via the
               gradient backing, regardless of NOW PLAYING/estimated/blank state. */
            .sc-lineup-eta {
                position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                padding: 18px 10px 8px !important; box-sizing: border-box !important;
                background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 100%) !important;
                border-radius: 0 0 8px 8px !important;
                font-size: 13px !important; font-weight: 700 !important; color: rgba(255,255,255,0.85) !important;
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
            body.sc-tv .sc-lineup-item { flex-basis: 226px !important; }
            body.sc-tv .sc-lineup-poster { width: 226px !important; height: 339px !important; }
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
            html body.sc-pip #sc-top-bar, html body.sc-pip #videowrap-header, html body.sc-pip #sc-movie-links,
            html body.sc-pip #sc-movie-stats, html body.sc-pip #sc-poster-toggle, html body.sc-pip #sc-poster-strip,
            html body.sc-pip #sc-trivia-btn, html body.sc-pip #sc-chatmode-btn, html body.sc-pip #sc-cluster-grip,
            html body.sc-pip #sc-desync-btn, html body.sc-pip #sc-settings-btn,
            html body.sc-pip #sc-users-panel, html body.sc-pip #sc-poll-panel,
            html body.sc-pip #sc-np-card, html body.sc-pip #sc-trivia-card,
            html body.sc-pip #sc-lineup-screen,
            html body.sc-pip #sc-mobile-input-row, html body.sc-pip .video-js .vjs-control-bar {
                display: none !important;
            }

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
            html body.sc-cast #sc-cast-bar #sc-trivia-btn,
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
            /* Coming Attractions reel: full width, dropping just below the 40px cast bar
               (normally it's 80vw and tucked under a 20px header). */
            html body.sc-cast #sc-poster-strip {
                width: 100vw !important; top: 40px !important; bottom: auto !important;
            }
            /* Hide video-only chrome that isn't relocated into the bar (the pop-up panels
               triggered from the bar — users/poll/trivia/now-playing — stay available). */
            html body.sc-cast #sc-chatmode-btn,
            html body.sc-cast #sc-desync-btn,
            html body.sc-cast #fs-toggle-btn,
            html body.sc-cast #sc-cast-btn,
            html body.sc-cast #sc-top-bar,
            html body.sc-cast #sc-movie-links,
            html body.sc-cast #sc-movie-stats,
            html body.sc-cast #sc-vert-ctrl-band,
            html body.sc-cast #sc-vert-ctrl-grip {
                display: none !important;
            }

            /* ── AUTO-HIDING CHROME (TV) ─────────────────────── */
            body.sc-tv .video-js .vjs-control-bar { transition: opacity 0.6s ease !important; }
            /* The control cluster is governed by the left-edge reveal, not this.
               Here we just fade the seek bar + hide the cursor when idle. */
            body.sc-tv.sc-chrome-hidden .video-js .vjs-control-bar {
                opacity: 0 !important; pointer-events: none !important;
            }
            body.sc-tv.sc-chrome-hidden { cursor: none !important; }

            /* ── CHAT LAYOUT MODES ───────────────────────────── */
            /* Hidden: full-bleed cinema — drop chat AND the title / coming-attractions chrome */
            body.sc-chat-hidden #chatwrap, body.sc-chat-hidden #sc-chat-header,
            body.sc-chat-hidden #sc-users-panel, body.sc-chat-hidden #sc-poll-panel,
            body.sc-chat-hidden #sc-top-bar, body.sc-chat-hidden #videowrap-header,
            body.sc-chat-hidden #sc-poster-toggle, body.sc-chat-hidden #sc-poster-strip,
            body.sc-chat-hidden #sc-movie-links { display: none !important; }
            body.sc-chat-hidden.sc-horizontal #videowrap,
            body.sc-chat-hidden.sc-horizontal #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-horizontal #ytapiplayer { width: 100vw !important; }
            body.sc-chat-hidden.sc-horizontal .video-js .vjs-control-bar { right: 16px !important; }
            body.sc-chat-hidden.sc-vertical #videowrap,
            body.sc-chat-hidden.sc-vertical #videowrap .embed-responsive,
            body.sc-chat-hidden.sc-vertical #ytapiplayer { height: 100vh !important; }
            /* chat-hidden vertical: suppress the ctrl band (no black bar mid-screen); slide buttons from bottom-right */
            body.sc-chat-hidden.sc-vertical #sc-vert-ctrl-band { display: none !important; }
            body.sc-chat-hidden.sc-vertical #sc-vert-ctrl-grip {
                top: auto !important; bottom: 0 !important;
            }
            /* The control row sits just ABOVE the bottom scrubber (≈32px tall at bottom:4px)
               so the two don't overlap; the cast button joins the row (it otherwise floats
               mid-screen at the 50vh control-band position). */
            body.sc-chat-hidden.sc-vertical #sc-chatmode-btn,
            body.sc-chat-hidden.sc-vertical #sc-desync-btn,
            body.sc-chat-hidden.sc-vertical #sc-settings-btn,
            body.sc-chat-hidden.sc-vertical #sc-cast-btn {
                top: auto !important; bottom: 48px !important;
            }
            /* Video-only fills the screen, so the scrubber belongs at the screen bottom —
               not at the 50vh "above the chat header" spot used when chat is present. */
            body.sc-chat-hidden.sc-vertical .video-js .vjs-control-bar {
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
            body.sc-chat-chatonly #sc-top-bar,
            body.sc-chat-chatonly #videowrap-header,
            body.sc-chat-chatonly #sc-movie-links,
            body.sc-chat-chatonly #sc-movie-stats,
            body.sc-chat-chatonly #sc-poster-toggle,
            body.sc-chat-chatonly #sc-poster-strip,
            body.sc-chat-chatonly #sc-trivia-btn,
            body.sc-chat-chatonly #sc-desync-btn,
            body.sc-chat-chatonly #fs-toggle-btn,
            body.sc-chat-chatonly #sc-cast-btn,
            body.sc-chat-chatonly #sc-vert-ctrl-band {
                display: none !important;
            }
            body.sc-chat-chatonly #sc-cluster-grip { display: none !important; }
            /* The top header doubles as a control band (like the vertical band at 50vh, but
               pinned to the top): a right-edge grip slides the chat-mode + settings buttons
               out. Reuses the right-zone drawer (right-edge swipe in portrait, or tap the grip). */
            body.sc-chat-chatonly #sc-vert-ctrl-grip {
                display: block !important;
                position: fixed !important; right: 0 !important; top: 0 !important; bottom: auto !important;
                height: 32px !important; width: 4px !important;
                border-radius: 2px 0 0 2px !important;
                background: rgba(255,255,255,0.3) !important;
                z-index: 10012 !important; cursor: pointer !important;
            }
            body.sc-chat-chatonly.sc-rightzone #sc-vert-ctrl-grip { opacity: 0 !important; pointer-events: none !important; }
            body.sc-chat-chatonly #sc-chatmode-btn,
            body.sc-chat-chatonly #sc-settings-btn {
                display: flex !important;
                position: fixed !important;
                top: -2px !important; bottom: auto !important; left: auto !important;
                opacity: 0 !important; pointer-events: none !important;
                transform: translateX(16px) !important;
                transition: opacity 0.25s ease, transform 0.25s ease !important;
                z-index: 10012 !important;
            }
            body.sc-chat-chatonly #sc-chatmode-btn { right: 8px !important; }
            body.sc-chat-chatonly #sc-settings-btn { right: 50px !important; }
            body.sc-chat-chatonly.sc-rightzone #sc-chatmode-btn,
            body.sc-chat-chatonly.sc-rightzone #sc-settings-btn {
                opacity: 1 !important; pointer-events: auto !important; transform: translateX(0) !important;
            }
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
            body.sc-chat-chatonly #sc-chat-collapse-btn { display: none !important; }
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
               horizontal rule reserves 19vw for the chat column that isn't there here). */
            body.sc-chat-overlay.sc-horizontal .video-js .vjs-control-bar { right: 16px !important; }

            /* Hide every bit of chrome — title bar, coming attractions, user/poll header */
            body.sc-chat-overlay.sc-horizontal #sc-top-bar,
            body.sc-chat-overlay.sc-horizontal #videowrap-header,
            body.sc-chat-overlay.sc-horizontal #sc-movie-links,
            body.sc-chat-overlay.sc-horizontal #sc-movie-stats,
            body.sc-chat-overlay.sc-horizontal #sc-poster-toggle,
            body.sc-chat-overlay.sc-horizontal #sc-poster-strip,
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

            /* Sidebar: header matches the chat panel exactly (same box, same padding) */
            body.sc-horizontal #sc-chat-header {
                right: 0 !important; width: 19vw !important;
                box-sizing: border-box !important; padding: 0 8px !important;
            }

            /* Control cluster — chat-mode icon on top, then emote / free-watch / settings
               in a row beneath it, pinned to the mid-left edge over the video.
               Clear of YouTube's own controls and the chat, so everything clicks. */
            #sc-chatmode-btn {
                position: fixed !important;
                left: 10px !important; top: calc(50% - 60px) !important;
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
            body.sc-tv #sc-chatmode-btn { width: 52px !important; height: 52px !important; font-size: 22px !important; top: calc(50% - 70px) !important; }

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
            body.sc-vertical   #sc-newmsg-pill { left: 50% !important; transform: translateX(-50%) !important; bottom: calc(50vh - 44px + 12px) !important; }
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
        const span = el.querySelector(".username");
        if (span) {
          span.style.color = usernameToColor(cls.replace("chat-msg-", ""));
          span.style.fontWeight = "700";
        }
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
                        </div>
                    </div>

                    <div class="sc-settings-group">
                        <label class="sc-settings-label">CyTube Account
                            <span class="sc-settings-note">Opens the CyTube login page — your settings here are saved first</span>
                        </label>
                        <button id="sc-login-btn" class="sc-settings-btn-wide" type="button">Log in / Switch Account</button>
                    </div>
                </div>

                <div class="sc-settings-pane" data-pane="appearance">
                    <div class="sc-settings-group">
                        <label class="sc-settings-toggle-label">
                            <span class="sc-toggle-row">
                                <input type="checkbox" id="sc-input-movielinks" ${movieLinksEnabled() ? "checked" : ""} />
                                <span class="sc-toggle-text">Show movie links (IMDb / Letterboxd / Wiki)</span>
                            </span>
                            <span class="sc-settings-note">Adds clickable link badges next to the title — usually unneeded on a TV</span>
                        </label>
                    </div>

                    <div class="sc-settings-group sc-settings-divider">
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
                </div>

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
                        <button id="sc-update-download" class="sc-settings-btn-wide sc-hidden" type="button">Get the update on GitHub ↗</button>
                    </div>
                </div>

                <div id="sc-settings-actions">
                    <button id="sc-settings-cancel">${firstRun ? "Skip for now" : "Cancel"}</button>
                    <button id="sc-settings-save">Save</button>
                </div>
                <div id="sc-settings-status"></div>
            </div>`;
      document.body.appendChild(overlay);
      const tabs = [...overlay.querySelectorAll(".sc-settings-tab")];
      const panes = [...overlay.querySelectorAll(".sc-settings-pane")];
      const showTab = (name) => {
        tabs.forEach((t) => t.classList.toggle("sc-settings-tab-active", t.dataset.tab === name));
        panes.forEach((p) => p.classList.toggle("sc-settings-pane-active", p.dataset.pane === name));
      };
      tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
      showTab("account");
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
      document.getElementById("sc-settings-cancel").addEventListener("click", () => overlay.remove());
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
        setTimeout(() => overlay.remove(), 800);
      });
      document.getElementById("sc-login-btn").addEventListener("click", () => {
        persistSettings();
        window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
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
      const mlinks = document.getElementById("sc-input-movielinks");
      if (mlinks) mlinks.addEventListener("change", () => {
        setKey(LS_MOVIE_LINKS, mlinks.checked ? "on" : "off");
        if (!mlinks.checked) {
          const row = document.getElementById("sc-movie-links");
          if (row) row.remove();
        } else {
          movieState.lastMovieTitle = "";
        }
      });
      (function wireUpdateSection() {
        const statusEl = document.getElementById("sc-update-status");
        const notesEl = document.getElementById("sc-update-notes");
        const dlBtn = document.getElementById("sc-update-download");
        const checkBtn = document.getElementById("sc-update-check");
        if (!statusEl || !dlBtn || !checkBtn) return;
        const render = (info) => {
          statusEl.className = "sc-settings-note";
          notesEl.classList.add("sc-hidden");
          dlBtn.classList.add("sc-hidden");
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
            dlBtn.classList.remove("sc-hidden");
          } else {
            statusEl.classList.add("sc-update-no");
            statusEl.textContent = info.latest ? "✓ You’re on the latest version (" + info.latest + ")" : "✓ You’re on the latest version";
          }
        };
        if (_updateInfo) render(_updateInfo);
        checkForUpdate(false).then(render).catch(() => {
          if (!_updateInfo) statusEl.textContent = "Couldn’t reach GitHub to check.";
        });
        dlBtn.addEventListener("click", () => {
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
            render(await checkForUpdate(true));
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
        document.getElementById("sc-trivia-btn"),
        document.getElementById("sc-movie-links")
      ].filter(Boolean);
      const dim = () => {
        if (chromeState.topBarIsOpen || !playing) return;
        getDimEls().forEach((el) => el.classList.add("sc-bar-dim"));
        document.body.classList.add("sc-video-dimmed");
      };
      const wake = () => {
        getDimEls().forEach((el) => el.classList.remove("sc-bar-dim"));
        document.body.classList.remove("sc-video-dimmed");
        clearTimeout(idleTimer);
        if (!chromeState.topBarIsOpen && playing) idleTimer = setTimeout(dim, 3500);
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
      const HEADER_SEL = "#videowrap-header, #sc-top-bar, #sc-title-text, #sc-movie-links, #sc-trivia-btn, #sc-poster-toggle";
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
      const colBtn = document.createElement("button");
      colBtn.id = "sc-chat-collapse-btn";
      colBtn.title = "Cycle chat layout (C)";
      colBtn.dataset.tvLabel = "Toggle Chat";
      colBtn.textContent = "›";
      colBtn.addEventListener("click", () => {
        if (typeof cycleChatMode === "function") cycleChatMode();
      });
      header.appendChild(colBtn);
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
        if (document.getElementById("sc-chat-textarea") && document.getElementById("sc-emote-proxy") && document.getElementById("fs-toggle-btn") && document.getElementById("sc-settings-btn")) {
          bootObserver.disconnect();
        }
      });
      bootObserver.observe(document.body, { childList: true, subtree: true });
    };
    if (window.location.pathname.startsWith("/login")) {
      initLoginTvNav();
      return;
    }
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
      initChatTimestamps();
      initNowPlayingWatcher();
      initTopBar();
      initDesyncButton();
      initChatHeader();
      initUserCount();
      initPollWatcher();
      initGoogleDrive();
      initUpdateCheck();
      if (!localStorage.getItem(LS_ONBOARDED)) {
        setTimeout(openSettingsModal, 1200);
      }
      if (document.querySelector("#motdrow img")) {
        initPosterStrip();
      } else {
        const motdObserver = new MutationObserver(() => {
          if (document.querySelector("#motdrow img")) {
            motdObserver.disconnect();
            initPosterStrip();
          }
        });
        motdObserver.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          if (!document.getElementById("sc-poster-strip")) initPosterStrip();
        }, 2e3);
      }
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
        if (buf) setTimeout(() => {
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
      let playingSince = 0, preloadStarted = false, done = false;
      _scStatus("Waiting for stream…");
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
      const iv = setInterval(() => {
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
      const CAST_CONTROL_IDS = ["sc-poster-toggle", "sc-trivia-btn", "sc-usercount-btn", "sc-poll-btn", "sc-settings-btn"];
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
