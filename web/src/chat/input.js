import { getChatUsernames } from './usernames.js';

/* ==========================================================
   TAB AUTOCOMPLETE
========================================================== */

let tabCandidates = [];
let tabIndex = 0;
let tabStart = 0;

export function clearTabCandidates() { tabCandidates = []; }

export function handleTabComplete(textarea, e) {
    if (e.key !== 'Tab') { tabCandidates = []; return; }
    e.preventDefault();

    const val = textarea.value;
    const cursor = textarea.selectionStart;

    if (tabCandidates.length === 0) {
        let i = cursor - 1;
        while (i >= 0 && /\S/.test(val[i])) i--;
        tabStart = i + 1;
        const prefix = val.slice(tabStart, cursor).replace(/^@/, '');
        tabCandidates = getChatUsernames().filter(n =>
            n.toLowerCase().startsWith(prefix.toLowerCase())
        );
        tabIndex = 0;
    } else {
        tabIndex = (tabIndex + 1) % tabCandidates.length;
    }

    if (tabCandidates.length === 0) return;

    const completion = tabCandidates[tabIndex];
    const atPrefix = tabStart === 0 ? '@' : '';
    const insert = atPrefix + completion + ' ';
    const after = val.slice(cursor);
    textarea.value = val.slice(0, tabStart) + insert + after;
    const newCursor = tabStart + insert.length;
    textarea.selectionStart = textarea.selectionEnd = newCursor;
}

/* ==========================================================
   EMOTE BUTTON RELOCATION
   CyTube's #emotelistbtn lives inside #leftcontrols which we
   hide in horizontal mode. Clone it outside so it's always visible,
   and forward clicks to the original so CyTube's picker still opens.
========================================================== */

// VHS cassette SVG — stripped white background, fill:currentColor so CSS controls colour.
// Source: vecteezy_black-vector-icon-of-vhs-video-cassette-tape-on-isolated-on_5567997.svg
const _VHS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5628 3728" fill="currentColor" aria-hidden="true"><g transform="matrix(1.3333333,0,0,-1.3333333,0,3728)"><g transform="scale(0.1)"><g transform="scale(2.31715)"><path d="m 16300,9657.36 v -335.45 c -157.2,180.66 -390.4,294.66 -648.5,294.66 H 2567.81 c -260.88,0 -494.75,-115.91 -651.51,-298.23 v 339.02 c 0,353.34 291.56,640.74 649.98,640.74 H 15650 c 358.5,0 650,-287.4 650,-640.74"/></g><g transform="scale(1.06574)"><path d="m 11418,14609.4 h 187.4 V 16300 c -2170.61,-146.3 -3886.11,-1953.4 -3886.11,-4161.2 0,-2207.82 1715.5,-4015.03 3886.11,-4161.31 v 1924.59 c -132.5,17.26 -261.1,46.72 -384.9,86.79 -79.8,26.13 -165.5,-18.86 -189.4,-99.46 l -34.2,-114.57 c -29.3,-98.71 -147.7,-138.87 -231.1,-78.26 l -763.8,555.02 c -83.41,60.6 -81.81,185.5 3.1,244.1 l 98.6,68 c 69.3,47.7 85.5,143.1 36.1,211 -260.06,357.1 -413.47,796.9 -413.47,1272.5 v 1.6 c 0,83.3 -68.31,150.7 -151.73,148.6 l -121.51,-3.1 c -103.15,-2.5 -177.72,97.6 -145.84,195.6 l 291.75,898 c 31.81,98.1 151.07,135.2 232.89,72.5 l 95.24,-72.8 c 66.71,-51.1 162.37,-37.3 211.77,30.6 265.9,366 643.9,645.2 1083.3,787.6 79.8,25.9 122.4,112.7 94.5,191.8 l -39.7,112.8 c -34.3,97.1 37.8,199 141,199"/></g><g transform="scale(2.08529)"><path d="m 14313.8,8330.5 v -864 h 95.9 c 52.6,0 89.5,-52.03 71.9,-101.72 l -20.2,-57.59 c -14.3,-40.47 7.4,-84.83 48.2,-98.07 224.6,-72.79 417.8,-215.46 553.8,-402.53 25.2,-34.67 74,-41.72 108.2,-15.63 l 48.6,37.26 c 41.8,31.98 102.8,12.99 119.1,-37.12 l 149.1,-458.88 c 16.3,-50.11 -21.9,-101.33 -74.6,-100.04 l -62.1,1.63 c -42.6,1.01 -77.6,-33.37 -77.5,-76 v -0.82 c 0,-243.04 -78.5,-467.75 -211.3,-650.32 -25.3,-34.67 -17,-83.49 18.4,-107.85 l 50.5,-34.76 c 43.3,-29.88 44.1,-93.76 1.5,-124.74 l -390.4,-283.6 c -42.6,-31.03 -103.1,-10.5 -118.1,39.99 l -17.4,58.51 c -12.3,41.19 -56.1,64.16 -96.9,50.88 -63.2,-20.53 -129,-35.58 -196.7,-44.41 v -983.6 c 1109.4,74.76 1986.2,998.37 1986.2,2126.75 0,1128.34 -876.8,2051.9 -1986.2,2126.66"/></g><g transform="scale(2.31715)"><path d="m 15169.1,3729.71 c 0,-505.24 -409.6,-914.79 -914.8,-914.79 h -1098.8 c -277.4,0 -502.4,224.93 -502.4,502.38 v 4531.45 c 0,277.42 225,502.4 502.4,502.4 h 1098.9 c 487.9,0 886.5,-381.98 913.3,-863.17 0.9,-17.09 1.4,-34.26 1.4,-51.57 z m -3232.9,-341.07 c 0,-340.98 -276.4,-617.4 -617.4,-617.4 H 6900.45 c -340.98,0 -617.4,276.42 -617.4,617.4 v 4388.71 c 0,340.99 276.42,617.41 617.4,617.41 h 4418.35 c 341,0 617.4,-276.42 617.4,-617.41 z M 5566.1,3317.3 c 0,-277.45 -224.93,-502.38 -502.39,-502.38 H 3964.9 c -505.22,0 -914.78,409.55 -914.78,914.79 v 3706.7 c 0,505.18 409.56,914.74 914.73,914.74 h 1098.86 c 264.47,0 481.2,-204.38 500.96,-463.77 0.95,-12.76 1.43,-25.62 1.43,-38.63 z m 10732.5,5385.84 c -24.1,387.6 -346.1,694.52 -739.8,694.52 H 2660.51 c -409.41,0 -741.25,-331.89 -741.25,-741.25 V 2509.63 c 0,-409.38 331.84,-741.21 741.25,-741.21 H 15558.8 c 409.4,0 741.2,331.83 741.2,741.21 v 6146.78 c 0,15.73 -0.5,31.3 -1.4,46.73"/></g></g></g></svg>';

export function relocateEmoteButton() {
    if (document.getElementById('sc-emote-proxy')) return;
    const original = document.getElementById('emotelistbtn');
    if (!original) return;

    const proxy = document.createElement('button');
    proxy.id = 'sc-emote-proxy';
    proxy.innerHTML = _VHS_SVG;
    proxy.title = 'Emotes';
    proxy.dataset.tvLabel = 'Emotes';
    proxy.setAttribute('aria-label', 'Emote Picker');

    proxy.addEventListener('click', e => {
        e.stopPropagation();
        original.click();
    });

    // Must go inside the chat input row. If it isn't ready yet, bail and let
    // the bootObserver retry on the next DOM mutation — don't fall back to body
    // because without position:fixed it would be invisible there.
    const inputRow = document.getElementById('sc-mobile-input-row');
    if (!inputRow) return;
    inputRow.appendChild(proxy);
}

export const applyInputMode = () => {
    const inputs = document.getElementsByClassName('emotelist-search');
    if (!inputs.length) return;
    for (const input of inputs) {
        if (input.getAttribute('inputmode') !== 'none') input.setAttribute('inputmode', 'none');
    }
};
