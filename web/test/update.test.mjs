import { test } from 'node:test';
import assert from 'node:assert';
import { _pickApkAsset, _verNewer } from '../src/update.js';

test('picks the .apk asset out of a release asset list', () => {
    const assets = [
        { name: 'source.zip', browser_download_url: 'https://example.com/source.zip', size: 100 },
        { name: 'grindhouse-v2.6.apk', browser_download_url: 'https://example.com/grindhouse-v2.6.apk', size: 9961472 },
    ];
    assert.deepStrictEqual(_pickApkAsset(assets), {
        url: 'https://example.com/grindhouse-v2.6.apk',
        size: 9961472,
    });
});

test('returns null when there is no .apk asset', () => {
    assert.strictEqual(_pickApkAsset([{ name: 'notes.txt', browser_download_url: 'x', size: 1 }]), null);
});

test('handles missing/malformed assets array', () => {
    assert.strictEqual(_pickApkAsset(undefined), null);
    assert.strictEqual(_pickApkAsset([]), null);
});

test('handles a missing size field gracefully', () => {
    const assets = [{ name: 'grindhouse-v2.6.apk', browser_download_url: 'https://example.com/a.apk' }];
    assert.deepStrictEqual(_pickApkAsset(assets), { url: 'https://example.com/a.apk', size: null });
});

test('detects a newer beta of the same major.minor.patch', () => {
    assert.strictEqual(_verNewer('v3.0-beta17', '3.0-beta12'), true);
    assert.strictEqual(_verNewer('v3.0-beta12', '3.0-beta17'), false);
});

test('treats a final release as newer than any beta of the same version', () => {
    assert.strictEqual(_verNewer('v3.0', '3.0-beta17'), true);
    assert.strictEqual(_verNewer('v3.0-beta1', '3.0'), false);
});

test('identical beta tags are not newer than each other', () => {
    assert.strictEqual(_verNewer('v3.0-beta17', '3.0-beta17'), false);
});

test('still compares plain major.minor.patch versions', () => {
    assert.strictEqual(_verNewer('v2.6', '2.5'), true);
    assert.strictEqual(_verNewer('v2.5', '2.6'), false);
});

test('an rc outranks every beta of the same version', () => {
    assert.strictEqual(_verNewer('v3.0-rc1', '3.0-beta17'), true);
    assert.strictEqual(_verNewer('v3.0-beta17', '3.0-rc1'), false);
});

test('a final release outranks an rc of the same version', () => {
    assert.strictEqual(_verNewer('v3.0', '3.0-rc1'), true);
    assert.strictEqual(_verNewer('v3.0-rc1', '3.0'), false);
});

test('rc numbers compare in order', () => {
    assert.strictEqual(_verNewer('v3.0-rc2', '3.0-rc1'), true);
    assert.strictEqual(_verNewer('v3.0-rc1', '3.0-rc1'), false);
});
