/* ==========================================================
   IN-APP CYTUBE LOGIN — thin promise wrapper over the native
   CytubeAuth bridge. Native does the form login and installs the
   session cookie; saved passwords never come back into JS.
========================================================== */
const _scAuthCbs = {};
if (typeof window !== 'undefined') {
    window.__scAuthResolve = function (id, res) {
        const cb = _scAuthCbs[id];
        if (cb) { delete _scAuthCbs[id]; cb(res); }
    };
}

export function authAvailable() {
    return !!(window.CytubeNative && typeof CytubeNative.authLogin === 'function');
}

function call(method, ...args) {
    return new Promise((resolve) => {
        if (!authAvailable()) { resolve({ ok: false, error: 'Update the app to log in here' }); return; }
        const id = 'a' + Math.random().toString(36).slice(2);
        _scAuthCbs[id] = (res) => resolve(res || { ok: false, error: 'No response' });
        try { CytubeNative[method](id, ...args); }
        catch (e) { delete _scAuthCbs[id]; resolve({ ok: false, error: String(e && e.message || e) }); }
        // Login is two round trips to cytu.be (CSRF fetch + POST).
        setTimeout(() => {
            if (_scAuthCbs[id]) { delete _scAuthCbs[id]; resolve({ ok: false, error: 'Timed out — try again' }); }
        }, 20000);
    });
}

export const authLogin  = (name, password, remember) => call('authLogin', name, password, !!remember);
export const authSwitch = (name) => call('authSwitch', name);
export const authLogout = () => call('authLogout');

export function authList() {
    try { return JSON.parse(CytubeNative.authList()); }
    catch (e) { return { active: '', accounts: [] }; }
}

export function authRemove(name) {
    try { CytubeNative.authRemove(name); } catch (e) {}
}

// The name CyTube's socket actually authenticated as (rank ≥ 1 = registered account;
// guests have a name but rank 0). '' when not logged in to an account.
export function currentCyName() {
    try {
        if (window.CLIENT && CLIENT.name && CLIENT.rank >= 1) return String(CLIENT.name);
    } catch (e) {}
    return '';
}
