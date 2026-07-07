import qrcode from 'qrcode-generator';

// qrcode-generator requires a type number (1-40, capacity increases with size) rather than
// auto-sizing; loop upward and let it throw ("code length overflow" et al.) until one fits.
function encode(text) {
    for (let type = 1; type <= 40; type++) {
        try {
            const qr = qrcode(type, 'M');
            qr.addData(text);
            qr.make();
            return qr;
        } catch (e) { /* too small for this type — try the next */ }
    }
    throw new Error('QR encode failed: data too long');
}

export function renderQrToCanvas(canvas, text, moduleSize = 6) {
    const qr = encode(text);
    const count = qr.getModuleCount();
    canvas.width = count * moduleSize;
    canvas.height = count * moduleSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
            }
        }
    }
}
