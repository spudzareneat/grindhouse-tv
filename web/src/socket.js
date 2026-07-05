export function whenSocket(cb, tries = 120) {
    const s = (typeof window !== 'undefined') && window.socket;
    if (s && typeof s.on === 'function') { cb(s); return; }
    if (tries <= 0) return;
    setTimeout(() => whenSocket(cb, tries - 1), 500);
}
export function onSocket(event, handler) { whenSocket(s => s.on(event, handler)); }
