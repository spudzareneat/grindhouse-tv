import { test } from 'node:test';
import assert from 'node:assert';
import { _pickApkAsset } from '../src/update.js';

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
