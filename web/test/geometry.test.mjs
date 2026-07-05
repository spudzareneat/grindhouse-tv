import { test } from 'node:test';
import assert from 'node:assert';
import { pickDirectional } from '../src/tvnav/geometry.js';

test('no candidate in the pressed direction returns -1', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const behind = { left: 0, top: 100, width: 40, height: 40 }; // to the left
    assert.strictEqual(pickDirectional('right', cur, [behind]), -1);
});

test('nearest candidate wins when there is no cone conflict', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const near = { left: 160, top: 100, width: 40, height: 40 };
    const far = { left: 260, top: 100, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', cur, [near, far]), 0);
});

test('null entries (the focused element itself) are skipped', () => {
    const cur = { left: 100, top: 100, width: 40, height: 40 };
    const near = { left: 160, top: 100, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', cur, [null, near]), 1);
});

test('an on-axis candidate beats a closer off-cone one (the mute-vs-CC-button case)', () => {
    // cur = mute button. gear = closer overall but mostly above (off-cone).
    // cc = further away but directly to the right (on-cone). This is the exact
    // shape of the bug that motivated zone-scoping: geometry alone can prefer a
    // nearby button in an unrelated cluster over the correct one dead ahead.
    const mute = { left: 100, top: 500, width: 40, height: 40 };
    const gear = { left: 108, top: 490, width: 40, height: 40 };
    const cc   = { left: 160, top: 505, width: 40, height: 40 };
    assert.strictEqual(pickDirectional('right', mute, [gear, cc]), 1); // cc, not gear
});
