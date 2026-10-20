// Nord web editor service worker.
//  1. Offline shell: network-first for the editor's own files, cache fallback (same origin only).
//  2. Play routes (M11-07): the game and the edit viewport run in <iframe>s whose URLs live under `<scope>play/`. This worker answers
//     them like the native dev server (nord-serve) does: the engine runtime from `<scope>engine/`, the project's own files from the
//     editor page (asked over a MessageChannel; the project lives in the wasm editor's virtual file system).
const CACHE = 'nord-editor-shell-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'pkg/nord_editor_web.js', 'pkg/nord_editor_web_bg.wasm'];
const SCOPE = self.registration.scope; // e.g. https://host/ or https://host/nord/
const PLAY = SCOPE + 'play/';
const PLAY_PATH = new URL(PLAY).pathname;

const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json',
  css: 'text/css; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', glb: 'model/gltf-binary', gltf: 'model/gltf+json',
  wasm: 'application/wasm', txt: 'text/plain; charset=utf-8', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2', mp4: 'video/mp4',
  webm: 'video/webm', glsl: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
};
const mimeOf = (p) => MIME[(p.split('?')[0].split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

// forwards the game's console and errors to the editor's Console panel (the native server injects the HTTP equivalent)
const INJECT = "<script>(()=>{const s=(l,a)=>{try{parent.postMessage({nord:'log',level:l,text:a.map(x=>x instanceof Error?x.stack||x.message:typeof x==='object'?JSON.stringify(x):String(x)).join(' ')},'*')}catch{}};for(const l of ['log','info','warn','error']){const o=console[l].bind(console);console[l]=(...a)=>{o(...a);s(l,a)}}addEventListener('error',e=>s('error',[e.message+(e.filename?' ('+e.filename+':'+e.lineno+')':'')]));addEventListener('unhandledrejection',e=>s('error',[e.reason||'unhandled rejection']))})();</script>";

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

/** The editor page (any window that is not a play iframe) owns the project files. */
async function readProject(path) {
  const cs = await self.clients.matchAll({ type: 'window' });
  const editor = cs.find((c) => !c.url.startsWith(PLAY));
  if (!editor) return null;
  return new Promise((res) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => res(null), 8000);
    ch.port1.onmessage = (ev) => { clearTimeout(t); res(ev.data); };
    editor.postMessage({ t: 'read', path }, [ch.port2]);
  });
}

async function serveProject(rel) {
  rel = decodeURIComponent(rel);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.split('/').some((p) => p === '..')) return new Response('bad path', { status: 400 });
  const bytes = await readProject(rel);
  if (!bytes) return new Response('not found: ' + rel, { status: 404 });
  const type = mimeOf(rel);
  let body = bytes;
  if (type.startsWith('text/html')) {
    let s = new TextDecoder().decode(bytes);
    s = /<head[^>]*>/i.test(s) ? s.replace(/<head[^>]*>/i, (m) => m + INJECT) : INJECT + s;
    body = s;
  }
  return new Response(body, { headers: { 'content-type': type, 'cache-control': 'no-store' } });
}

// Re-wrap the response: a fetched Response carries its own URL (`…/engine/…`), which the browser would then use to resolve the
// relative imports inside the file — they must resolve against the URL the page asked for instead.
async function engine(path) {
  const r = (await fetch(SCOPE + 'engine' + path).catch(() => null)) || (await caches.match(SCOPE + 'engine' + path));
  if (!r || !r.ok) return null;
  return new Response(r.body, { status: 200, headers: { 'content-type': r.headers.get('content-type') || mimeOf(path) } });
}
const idle = () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/event-stream' } });

async function handleAbs(req, url) {
  const p = url.pathname;
  if (p.startsWith('/vendor/') || p.startsWith('/runtime/') || p.startsWith('/editor/')) return (await engine(p)) || new Response('missing engine file', { status: 404 });
  if (p === '/__edit') return (await engine('/editor/viewport/edit.html')) || new Response('missing', { status: 404 });
  if (p === '/__edit/events' || p === '/__reload') return idle();
  if (p === '/api/ipc' || p === '/api/log') return new Response(null, { status: 204 });
  if (p === '/api/project') return serveProject('nord.project.json');
  if (p.startsWith('/api/') || p.startsWith('/__')) return new Response('not available in the web editor', { status: 404 });
  return serveProject(p.slice(1));
}

async function handlePlay(url) {
  const rel = url.pathname.slice(PLAY_PATH.length);
  if (rel === '__edit') return (await engine('/editor/viewport/edit.html')) || new Response('missing', { status: 404 });
  return serveProject(rel);
}

async function shell(req) {
  try {
    const r = await fetch(req);
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
    return r;
  } catch {
    return (await caches.match(req)) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.href.startsWith(PLAY)) { e.respondWith(handlePlay(url)); return; }
  if (e.clientId) {
    e.respondWith((async () => {
      const c = await self.clients.get(e.clientId);
      if (c && c.url.startsWith(PLAY)) return handleAbs(req, url);
      return req.method === 'GET' ? shell(req) : fetch(req);
    })());
    return;
  }
  if (req.method === 'GET') e.respondWith(shell(req));
});
