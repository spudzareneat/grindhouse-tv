import { test } from 'node:test';
import assert from 'node:assert';

// Minimal fake DOM node -- just enough surface (classList, cloneNode, querySelectorAll,
// remove, innerHTML) for extractSubtitleLine() (web/src/cards/subtitles.js) to run against,
// mirroring the same "hand-roll a tiny fake instead of pulling in jsdom" approach
// web/test/buttons.test.mjs already uses for this codebase's other DOM-touching modules.
function makeNode(classes, opts = {}) {
    const node = {
        classList: classes,
        children: [],
        parent: null,
        text: opts.text || '',
        appendChild(child) { child.parent = node; node.children.push(child); return child; },
        cloneNode(deep) {
            const clone = makeNode([...classes], { text: node.text });
            if (deep) node.children.forEach(c => clone.appendChild(c.cloneNode(true)));
            return clone;
        },
        querySelectorAll(selector) {
            const wanted = selector.split(',').map(s => s.trim().replace(/^\./, ''));
            const out = [];
            (function walk(n) {
                n.children.forEach(c => {
                    if (c.classList.some(cls => wanted.includes(cls))) out.push(c);
                    walk(c);
                });
            })(node);
            return out;
        },
        remove() {
            if (node.parent) {
                node.parent.children = node.parent.children.filter(c => c !== node);
                node.parent = null;
            }
        },
        get innerHTML() {
            const serialize = (n) => {
                if (!n.children.length) return n.text;
                return `<span class="${n.classList.join(' ')}">${n.children.map(serialize).join('')}</span>`;
            };
            return node.children.map(serialize).join('').trim();
        },
    };
    return node;
}

function stubLocalStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    return store;
}

test('extractSubtitleLine: strips timestamp/username/large image embeds, keeps the rest', async () => {
    stubLocalStorage();
    globalThis.window = {};
    const { extractSubtitleLine } = await import('../src/cards/subtitles.js?t=' + Date.now());

    const msg = makeNode(['chat-msg-Bob', 'someOtherClass']);
    msg.appendChild(makeNode(['timestamp'], { text: '[12:34:56]' }));
    msg.appendChild(makeNode(['username'], { text: 'Bob:' }));
    msg.appendChild(makeNode([], { text: 'that movie was ' }));
    msg.appendChild(makeNode(['channel-emote'], { text: '[emote]' })); // kept -- small inline emote
    msg.appendChild(makeNode(['sc-img-embed'], { text: '[huge thumbnail]' })); // stripped -- too big for a pill

    const line = extractSubtitleLine(msg);
    assert.ok(line);
    assert.strictEqual(line.username, 'Bob');
    assert.ok(line.html.includes('that movie was'));
    assert.ok(line.html.includes('[emote]'));
    assert.ok(!line.html.includes('12:34:56'));
    assert.ok(!line.html.includes('huge thumbnail'));
});

test('extractSubtitleLine: returns null for a message with no chat-msg-<user> class (system/announcement)', async () => {
    stubLocalStorage();
    globalThis.window = {};
    const { extractSubtitleLine } = await import('../src/cards/subtitles.js?t=' + Date.now());

    const msg = makeNode(['server-msg']);
    msg.appendChild(makeNode([], { text: 'Bob has connected.' }));
    assert.strictEqual(extractSubtitleLine(msg), null);
});

test('extractSubtitleLine: returns null once metadata-stripping leaves nothing to show', async () => {
    stubLocalStorage();
    globalThis.window = {};
    const { extractSubtitleLine } = await import('../src/cards/subtitles.js?t=' + Date.now());

    const msg = makeNode(['chat-msg-Bob']);
    msg.appendChild(makeNode(['timestamp'], { text: '[12:34:56]' }));
    msg.appendChild(makeNode(['username'], { text: 'Bob:' }));
    assert.strictEqual(extractSubtitleLine(msg), null);
});

test('extractSubtitleLine: same username always gets the same color, different usernames differ', async () => {
    stubLocalStorage();
    globalThis.window = {};
    const { extractSubtitleLine } = await import('../src/cards/subtitles.js?t=' + Date.now());
    const { usernameToColor } = await import('../src/usercolors.js?t=' + Date.now());

    const makeMsg = (user) => {
        const m = makeNode(['chat-msg-' + user]);
        m.appendChild(makeNode([], { text: 'hi' }));
        return m;
    };
    const bob = extractSubtitleLine(makeMsg('Bob'));
    const alsoBob = extractSubtitleLine(makeMsg('Bob'));
    const alice = extractSubtitleLine(makeMsg('Alice'));
    assert.strictEqual(bob.color, alsoBob.color);
    assert.strictEqual(bob.color, usernameToColor('Bob'));
    assert.notStrictEqual(bob.color, alice.color);
});

test('clampLines: clamps to 1-3 and falls back to 3 when unparseable', async () => {
    stubLocalStorage();
    globalThis.window = {};
    const { clampLines } = await import('../src/cards/subtitles.js?t=' + Date.now());
    assert.strictEqual(clampLines(1), 1);
    assert.strictEqual(clampLines(2), 2);
    assert.strictEqual(clampLines(3), 3);
    assert.strictEqual(clampLines(0), 1);
    assert.strictEqual(clampLines(99), 3);
    assert.strictEqual(clampLines('not-a-number'), 3);
});

test('getSubtitleOpacity/getSubtitleFontSize/getSubtitleLines: defaults and clamping', async () => {
    const store = stubLocalStorage();
    globalThis.window = {};
    const { getSubtitleOpacity, getSubtitleFontSize, getSubtitleLines } = await import('../src/cards/subtitles.js?t=' + Date.now());

    assert.strictEqual(getSubtitleOpacity(), 0.6);
    assert.strictEqual(getSubtitleFontSize(), 15);
    assert.strictEqual(getSubtitleLines(), 3);

    store.set('sc_subtitle_opacity', '5'); // out of range -- clamp to max
    assert.strictEqual(getSubtitleOpacity(), 0.9);
    store.set('sc_subtitle_fontsize', '2'); // out of range -- clamp to min
    assert.strictEqual(getSubtitleFontSize(), 12);
    store.set('sc_subtitle_lines', '2');
    assert.strictEqual(getSubtitleLines(), 2);
});
