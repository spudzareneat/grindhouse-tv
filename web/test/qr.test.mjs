import { test } from 'node:test';
import assert from 'node:assert';
import { renderQrToCanvas } from '../src/vendor/qr.js';

function stubCanvas() {
    const calls = [];
    const ctx = {
        fillStyle: null,
        fillRect: (x, y, w, h) => calls.push({ fillStyle: ctx.fillStyle, x, y, w, h }),
    };
    return { width: 0, height: 0, getContext: () => ctx, _calls: calls };
}

test('renders a non-trivial QR pattern', () => {
    const canvas = stubCanvas();
    renderQrToCanvas(canvas, 'http://192.168.1.50:12345/type?t=abcdef0123456789');
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
    const darkCells = canvas._calls.filter(c => c.fillStyle === '#000');
    assert.ok(darkCells.length > 10, 'expected multiple dark QR modules to be drawn');
});

test('throws for input too long to encode', () => {
    const canvas = stubCanvas();
    assert.throws(() => renderQrToCanvas(canvas, 'x'.repeat(5000)));
});
