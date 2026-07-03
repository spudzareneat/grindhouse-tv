// Minimal Chrome DevTools Protocol client (Node 22 built-in WebSocket).
// Usage: node cdp.mjs "<js expression>"   — evaluates in the WebView page, awaits promises.
import http from 'http';

function getJson(path) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222' + path, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

const expr = process.argv[2];
const pages = await getJson('/json/list');
const page = pages.find(p => p.type === 'page');
if (!page) { console.error('no page'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
let id = 0; const pending = {};
function send(method, params = {}) {
  return new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
}
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
};
ws.onopen = async () => {
  await send('Runtime.enable');
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true
  });
  if (r.result && r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails));
  if (r.exceptionDetails) console.log('EXC', JSON.stringify(r.exceptionDetails, null, 2));
  const payload = JSON.stringify(r.result?.result?.value ?? r.result, null, 2);
  ws.close();
  // Flush stdout, THEN exit — without the explicit exit the lingering WebSocket keeps
  // the process alive, and a backgrounded run's output never gets captured.
  process.stdout.write(payload + '\n', () => process.exit(0));
};
ws.onerror = e => { console.error('WS err', e.message); process.exit(1); };
