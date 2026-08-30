import { test } from 'node:test';
import assert from 'node:assert';

function makeFakeElement(id, { hidden = false } = {}) {
    const hiddenSet = new Set(hidden ? ['sc-hidden'] : []);
    const props = {};
    return {
        id,
        classList: { contains: (c) => hiddenSet.has(c) },
        style: { setProperty: (k, v) => { props[k] = v; } },
        _props: props,
    };
}

function setupDom(elements) {
    const byId = new Map(elements.map((el) => [el.id, el]));
    const bodyProps = {};
    globalThis.document = {
        getElementById: (id) => byId.get(id) || null,
        body: { style: { setProperty: (k, v) => { bodyProps[k] = v; } } },
    };
    return bodyProps;
}

test('layoutDock: assigns increasing slots in DOCK_ORDER to only the present, non-hidden buttons', async () => {
    const els = [
        makeFakeElement('sc-chatmode-btn'),
        makeFakeElement('sc-settings-btn'),
        makeFakeElement('sc-subtitles-btn', { hidden: true }), // present but hidden -- skipped
        makeFakeElement('sc-desync-btn'),
        // sc-cast-btn absent entirely (e.g. TV) -- skipped
    ];
    const bodyProps = setupDom(els);
    const { layoutDock } = await import('../src/chrome/dock.js?t=' + Date.now());
    layoutDock();

    assert.strictEqual(els[0]._props['--sc-dock-slot'], '0'); // chatmode
    assert.strictEqual(els[1]._props['--sc-dock-slot'], '1'); // settings
    assert.strictEqual(els[2]._props['--sc-dock-slot'], undefined); // subtitles: hidden, untouched
    assert.strictEqual(els[3]._props['--sc-dock-slot'], '2'); // desync
    assert.strictEqual(bodyProps['--sc-dock-count'], '3');
});

test('layoutDock: all five present and visible get sequential slots 0-4', async () => {
    const ids = ['sc-chatmode-btn', 'sc-settings-btn', 'sc-subtitles-btn', 'sc-desync-btn', 'sc-cast-btn'];
    const els = ids.map((id) => makeFakeElement(id));
    const bodyProps = setupDom(els);
    const { layoutDock } = await import('../src/chrome/dock.js?t=' + Date.now());
    layoutDock();

    els.forEach((el, i) => assert.strictEqual(el._props['--sc-dock-slot'], String(i)));
    assert.strictEqual(bodyProps['--sc-dock-count'], '5');
});

test('layoutDock: none present -- count is 0', async () => {
    const bodyProps = setupDom([]);
    const { layoutDock } = await import('../src/chrome/dock.js?t=' + Date.now());
    layoutDock();
    assert.strictEqual(bodyProps['--sc-dock-count'], '0');
});
