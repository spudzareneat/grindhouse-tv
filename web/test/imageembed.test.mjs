import { test } from 'node:test';
import assert from 'node:assert';
import { IMAGE_LINK_RE, findImageLinks } from '../src/chat/imageembed.js';

function fakeAnchor(href, { embedded = false, insideEmbed = false } = {}) {
    return {
        href,
        protocol: href.slice(0, href.indexOf(':') + 1),
        dataset: embedded ? { scEmbedded: '1' } : {},
        closest: (sel) => (insideEmbed && sel === '.sc-img-embed' ? {} : null),
    };
}

function fakeMsgEl(anchors) {
    return { querySelectorAll: () => anchors };
}

test('IMAGE_LINK_RE matches common direct image extensions, with or without a query string', () => {
    assert.match('https://i.imgur.com/abc123.png', IMAGE_LINK_RE);
    assert.match('https://example.com/photo.JPG', IMAGE_LINK_RE);
    assert.match('https://example.com/photo.jpeg?w=800&h=600', IMAGE_LINK_RE);
    assert.match('https://cdn.discordapp.com/x.webp', IMAGE_LINK_RE);
    assert.doesNotMatch('https://example.com/video.mp4', IMAGE_LINK_RE);
    assert.doesNotMatch('https://example.com/page.html', IMAGE_LINK_RE);
});

test('findImageLinks: only returns http(s) links to direct image files', () => {
    const a1 = fakeAnchor('https://i.imgur.com/abc.png');
    const a2 = fakeAnchor('https://example.com/not-an-image');
    const a3 = fakeAnchor('ftp://example.com/sneaky.png'); // non-http(s) protocol, defense-in-depth
    const result = findImageLinks(fakeMsgEl([a1, a2, a3]));
    assert.deepStrictEqual(result, [a1]);
});

test('findImageLinks: skips links already embedded or already inside an embed wrapper', () => {
    const already = fakeAnchor('https://i.imgur.com/abc.png', { embedded: true });
    const nested = fakeAnchor('https://i.imgur.com/def.png', { insideEmbed: true });
    const fresh = fakeAnchor('https://i.imgur.com/ghi.png');
    const result = findImageLinks(fakeMsgEl([already, nested, fresh]));
    assert.deepStrictEqual(result, [fresh]);
});
