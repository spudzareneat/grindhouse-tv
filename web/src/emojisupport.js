/* ==========================================================
   EMOJI FALLBACK FOR OLD SYSTEM FONTS
   The app installs down to Android 9 (Fire OS 7), whose emoji font stops
   at Emoji 11 -- newer emoji (e.g. the 🟡/🟢 severity dots, Emoji 12)
   render as tofu boxes there. Everything here is gated on a runtime probe
   of the device's own font, so devices that already render them (onn /
   Google TV) take the exact same code path as before.
   Testing on a modern device: localStorage.scForceEmojiFallback = '1'.
========================================================== */

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';

// Twemoji file name: lowercase hex codepoints joined by '-', with FE0F
// dropped unless the sequence has a ZWJ (their naming rule).
export function twemojiUrl(str) {
    let cps = [...str].map(c => c.codePointAt(0));
    if (!cps.includes(0x200d)) cps = cps.filter(cp => cp !== 0xfe0f);
    return TWEMOJI_BASE + cps.map(cp => cp.toString(16)).join('-') + '.svg';
}

const _renders = new Map();
let _canvas = null;

// Draw in solid black and look for any coloured pixel: a colour emoji has
// some, a tofu box (drawn in the fill colour) doesn't.
export function emojiRenders(str) {
    if (_renders.has(str)) return _renders.get(str);
    let ok = true; // if the probe itself fails, assume fine (never degrade)
    try {
        if (!_canvas) { _canvas = document.createElement('canvas'); _canvas.width = _canvas.height = 40; }
        const ctx = _canvas.getContext('2d');
        ctx.clearRect(0, 0, 40, 40);
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'top';
        ctx.font = '32px sans-serif';
        ctx.fillText(str, 2, 2);
        const d = ctx.getImageData(0, 0, 40, 40).data;
        ok = false;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] && (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2])) { ok = true; break; }
        }
    } catch (e) { ok = true; }
    _renders.set(str, ok);
    return ok;
}

let _needs = null;
export function needsEmojiFallback() {
    if (_needs === null) {
        let forced = false;
        try { forced = localStorage.getItem('scForceEmojiFallback') === '1'; } catch (e) { /* storage blocked */ }
        _needs = forced || !emojiRenders('🟢');
    }
    return _needs;
}

// Should this specific emoji be swapped for a Twemoji image?
export function shouldSwapEmoji(str) {
    if (!str || !needsEmojiFallback()) return false;
    let forced = false;
    try { forced = localStorage.getItem('scForceEmojiFallback') === '1'; } catch (e) { /* storage blocked */ }
    return forced || !emojiRenders(str);
}

function _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Markup for an emoji slot. `textHtml` is what the caller rendered before
// (kept verbatim so the non-fallback path is byte-for-byte unchanged).
export function emojiSlotHtml(str, cls, textHtml) {
    if (!shouldSwapEmoji(str)) return `<span class="${cls}">${textHtml}</span>`;
    return `<span class="${cls}"><img class="sc-emoji-img" alt="${_esc(str)}" src="${twemojiUrl(str)}"` +
        ` onerror="this.replaceWith(this.alt)"></span>`;
}
