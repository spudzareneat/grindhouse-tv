// Fully on-device test: ask the WebView's own getGoogleDriveMetadata (native httpGet, device IP,
// shared cookie store) for the stream links, then play the first one through the proxy.
import http from 'http';
const docid = process.argv[2] || '1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3';

function getJson(path) {
  return new Promise((res, rej) => {
    http.get('http://localhost:9222' + path, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}
const pages = await getJson('/json/list');
const page = pages.find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = {};
function send(method, params = {}) {
  return new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
}
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };

const expr = `new Promise(resolve => {
  const finish = o => resolve(JSON.stringify(o));
  window.getGoogleDriveMetadata(${JSON.stringify(docid)}, function(err, data){
    if (err) return finish({ stage:'meta', err: String(err) });
    const vm = (data && data.videoMap) || {};
    let link = null, q = null;
    ['360','480','720','1080'].forEach(k => { if (!link && vm[k] && vm[k].length) { link = vm[k][0].link; q = k; } });
    if (!link) return finish({ stage:'meta', noLink:true, links:Object.keys(data.links||{}) });
    const v = document.createElement('video');
    v.muted = true; v.style.position='fixed'; v.style.left='-9999px';
    document.body.appendChild(v);
    let done = false;
    const fin = o => { if (done) return; done = true; try { v.remove(); } catch(e){} finish(Object.assign({ q }, o)); };
    v.addEventListener('loadeddata', () => fin({ ok:true, ev:'loadeddata', dur:v.duration }));
    v.addEventListener('canplay',    () => fin({ ok:true, ev:'canplay', dur:v.duration }));
    v.addEventListener('error',      () => fin({ ok:false, code:v.error&&v.error.code, msg:v.error&&v.error.message }));
    v.src = link; v.load();
    setTimeout(() => fin({ ok:false, timeout:true, ns:v.networkState, rs:v.readyState }), 12000);
  });
});`;

ws.onopen = async () => {
  await send('Runtime.enable');
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) console.log('EXC', JSON.stringify(r.exceptionDetails, null, 2));
  console.log('RESULT:', r.result?.result?.value ?? JSON.stringify(r.result));
  ws.close();
};
ws.onerror = e => { console.error('WS err', e.message); process.exit(1); };
