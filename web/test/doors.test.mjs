import { test } from 'node:test';
import assert from 'node:assert';
import { ZONE, resolveDoor } from '../src/tvnav/doors.js';

test('Top Strip: Down is the only door (to Player, or Chat if Player Bar is empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'down', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'down', true), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'up', false), null);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'left', false), null);
    assert.strictEqual(resolveDoor(ZONE.TOP_STRIP, 'right', false), null);
});

test('Control Drawer: Up goes to Top Strip, Right goes to Player (or Chat if empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'right', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'right', true), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'left', false), null);
    assert.strictEqual(resolveDoor(ZONE.DRAWER, 'down', false), null);
});

test('Player Bar: Up/Left/Right are doors, Down is not', () => {
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'left', false), ZONE.DRAWER);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'right', false), ZONE.CHAT);
    assert.strictEqual(resolveDoor(ZONE.PLAYER, 'down', false), null);
});

test('Chat: Up goes to Top Strip, Left goes to Player (or Drawer if Player Bar is empty)', () => {
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'up', false), ZONE.TOP_STRIP);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'left', false), ZONE.PLAYER);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'left', true), ZONE.DRAWER);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'right', false), null);
    assert.strictEqual(resolveDoor(ZONE.CHAT, 'down', false), null);
});
