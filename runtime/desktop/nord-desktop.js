// Nord desktop API (M9, ADR-020): window.nord.desktop.* — files, dialogs, notifications, clipboard, storage, windows, menus, tray.
// One API, three transports, picked automatically:
//   ipc  — inside the native player (wry): window.ipc.postMessage ⇄ Rust `nord-desktop` bridge, capability-checked
//   http — `nord serve` / editor Play: POST /__desktop/call (same Rust bridge, same permissions)
//   web  — plain browser export: graceful fallbacks (localStorage store + virtual appData files, Notification API, navigator.clipboard,
//          <input type=file> / download for dialogs); everything else rejects with code "unsupported".
// Every method returns a Promise; failures reject with NordDesktopError { code: denied|unsupported|not_found|invalid|io|cancelled }.
export class NordDesktopError extends Error {
  constructor(code, message) { super(message); this.name = 'NordDesktopError'; this.code = code; }
}
const unsupported = (m) => Promise.reject(new NordDesktopError('unsupported', `${m} is not available in this environment`));
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytes = (d) => (typeof d === 'string' ? new TextEncoder().encode(d) : d instanceof ArrayBuffer ? new Uint8Array(d) : d);

// ---- transports: (method, params) -> Promise<result> ------------------------------------------------------------------------------
function ipcTransport() {
  let next = 1; const pending = new Map();
  window.__nordDesktop = {
    reply(id, json) { const p = pending.get(id); if (!p) return; pending.delete(id); const r = typeof json === 'string' ? JSON.parse(json) : json; r.error ? p[1](new NordDesktopError(r.error.code, r.error.message)) : p[0](r.ok); },
    emit(name, payload) { emit(name, payload); },
  };
  return (method, params) => new Promise((ok, no) => { const id = next++; pending.set(id, [ok, no]); window.ipc.postMessage(JSON.stringify({ id, method, params: params ?? {} })); });
}
function httpTransport() {
  return async (method, params) => {
    const r = await fetch('/__desktop/call', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nord': '1' }, body: JSON.stringify({ method, params: params ?? {} }) });
    const j = await r.json();
    if (j.error) throw new NordDesktopError(j.error.code, j.error.message);
    return j.ok;
  };
}

// ---- web fallbacks ---------------------------------------------------------------------------------------------------------------
function webTransport(appId) {
  const ls = (() => { try { return window.localStorage; } catch { return null; } })();
  const mem = new Map();
  const kv = { get: (k) => (ls ? ls.getItem(k) : mem.get(k) ?? null), set: (k, v) => (ls ? ls.setItem(k, v) : mem.set(k, v)), del: (k) => (ls ? ls.removeItem(k) : mem.delete(k)), keys: () => (ls ? Object.keys(ls) : [...mem.keys()]) };
  const S = `nord.${appId}.store.`, F = `nord.${appId}.fs.`;
  const norm = (p) => { p = String(p).replace(/^appData:/, ''); if (/^[a-z]+:/i.test(p) || p.startsWith('/') || p.split('/').includes('..') || p.includes('\\')) throw new NordDesktopError('denied', 'only app-data paths exist in the browser'); return p.split('/').filter((x) => x && x !== '.').join('/'); };
  // files are stored as base64 so binary survives; helpers convert from/to text
  const fsRaw = (p) => { const v = kv.get(F + norm(p)); if (v === null) throw new NordDesktopError('not_found', p); return v; };
  const fsRead = (p) => new TextDecoder().decode(unb64(fsRaw(p)));
  const fsPut = (p, u8) => kv.set(F + norm(p), b64(u8));
  const enc = (t) => new TextEncoder().encode(t);
  const fsPaths = () => kv.keys().filter((k) => k.startsWith(F)).map((k) => k.slice(F.length));
  const fileDialog = (accept, multiple) => new Promise((ok) => { const i = Object.assign(document.createElement('input'), { type: 'file', multiple, accept }); i.onchange = () => ok([...i.files]); i.oncancel = () => ok(null); i.click(); });
  let wid = 0; const watchers = new Map();
  const snap = (p) => new Map(fsPaths().filter((x) => !p || x === p || x.startsWith(p + '/')).map((x) => [x, kv.get(F + x)]));
  const m = {
    'app.info': () => ({ name: document.title, version: '', id: appId, os: 'web', arch: '', shell: 'web' }),
    'app.paths': () => ({ appData: 'appData:' }), 'app.permissions': () => ({ summary: ['browser sandbox'], granted: {} }), 'app.launch': () => ({ files: [], urls: [] }),
    'app.quit': () => window.close(), 'app.quitGuard': () => { },
    'store.get': ({ key }) => { const v = kv.get(S + key); return v === null ? null : JSON.parse(v); },
    'store.set': ({ key, value }) => kv.set(S + key, JSON.stringify(value)), 'store.remove': ({ key }) => kv.del(S + key),
    'store.keys': () => kv.keys().filter((k) => k.startsWith(S)).map((k) => k.slice(S.length)).sort(),
    'store.clear': () => kv.keys().filter((k) => k.startsWith(S)).forEach((k) => kv.del(k)),
    'secret.get': ({ key }) => kv.get(`nord.${appId}.secret.${key}`), 'secret.set': ({ key, value }) => kv.set(`nord.${appId}.secret.${key}`, value), 'secret.delete': ({ key }) => kv.del(`nord.${appId}.secret.${key}`),
    'fs.readText': ({ path }) => fsRead(path), 'fs.writeText': ({ path, text }) => fsPut(path, enc(text)), 'fs.append': ({ path, text }) => fsPut(path, enc((kv.get(F + norm(path)) === null ? '' : fsRead(path)) + text)),
    'fs.read': ({ path }) => fsRaw(path), 'fs.write': ({ path, data }) => kv.set(F + norm(path), data),
    'fs.exists': ({ path }) => { const p = norm(path); return p === '' || kv.get(F + p) !== null || fsPaths().some((x) => x.startsWith(p + '/')); },
    'fs.stat': ({ path }) => { const p = norm(path), v = kv.get(F + p); if (v !== null) return { name: p.split('/').pop(), isDir: false, size: unb64(v).length, modified: 0 }; if (p === '' || fsPaths().some((x) => x.startsWith(p + '/'))) return { name: p.split('/').pop(), isDir: true, size: 0, modified: 0 }; throw new NordDesktopError('not_found', path); },
    'fs.list': ({ path }) => { const p = norm(path), pre = p ? p + '/' : '', seen = new Map(); for (const x of fsPaths().filter((x) => x.startsWith(pre))) { const rest = x.slice(pre.length), n = rest.split('/')[0], dir = rest.includes('/'); seen.set(n, { name: n, isDir: dir, size: dir ? 0 : unb64(kv.get(F + x)).length, modified: 0 }); } return [...seen.values()].sort((a, b) => b.isDir - a.isDir || a.name.localeCompare(b.name)); },
    'fs.mkdir': () => { },
    'fs.watch': ({ path }) => { const p = norm(path), id = ++wid; watchers.set(id, { p, snap: snap(p) }); return id; },
    'fs.poll': ({ id }) => { const w = watchers.get(id); if (!w) throw new NordDesktopError('not_found', 'no such watcher'); const now = snap(w.p), ev = []; for (const [k, v] of now) { if (!w.snap.has(k)) ev.push({ kind: 'created', path: k }); else if (w.snap.get(k) !== v) ev.push({ kind: 'modified', path: k }); } for (const k of w.snap.keys()) if (!now.has(k)) ev.push({ kind: 'removed', path: k }); w.snap = now; return ev; },
    'fs.unwatch': ({ id }) => { watchers.delete(id); },
    'fs.remove': ({ path, recursive }) => { const p = norm(path); if (kv.get(F + p) !== null) return kv.del(F + p); const ch = fsPaths().filter((x) => x.startsWith(p + '/')); if (ch.length && !recursive) throw new NordDesktopError('io', 'directory not empty'); ch.forEach((x) => kv.del(F + x)); },
    'fs.rename': ({ from, to }) => { const v = fsRaw(from); kv.set(F + norm(to), v); kv.del(F + norm(from)); }, 'fs.copy': ({ from, to }) => kv.set(F + norm(to), fsRaw(from)),
    'dialog.message': ({ text }) => alert(text), 'dialog.confirm': ({ text }) => confirm(text), 'dialog.recent': () => [],
    'dialog.open': async ({ filters, multiple }) => { const f = await fileDialog((filters ?? []).flatMap((x) => x.extensions.map((e) => '.' + e)).join(','), !!multiple); if (!f) return null; for (const x of f) fsPut('picked/' + x.name, new Uint8Array(await x.arrayBuffer())); return f.map((x) => 'appData:picked/' + x.name); },
    'dialog.save': ({ fileName }) => 'appData:saved/' + (fileName ?? 'untitled.txt'),
    'notify.show': async ({ title, body }) => { if (!('Notification' in window)) throw new NordDesktopError('unsupported', 'Notification API'); if (Notification.permission === 'default') await Notification.requestPermission(); if (Notification.permission !== 'granted') throw new NordDesktopError('denied', 'notifications blocked'); new Notification(title, { body }); },
    'notify.badge': ({ text }) => { if (navigator.setAppBadge) return text ? navigator.setAppBadge(parseInt(text, 10) || undefined) : navigator.clearAppBadge(); }, 'notify.progress': () => { },
    'clipboard.readText': () => navigator.clipboard.readText(), 'clipboard.writeText': ({ text }) => navigator.clipboard.writeText(text),
    'shell.openUrl': ({ url }) => { if (!/^(https?:|mailto:)/i.test(url)) throw new NordDesktopError('denied', 'only http(s)/mailto'); window.open(url, '_blank', 'noopener'); },
  };
  return async (method, params) => {
    const f = m[method];
    if (!f) throw new NordDesktopError('unsupported', `${method} is not available in the browser`);
    try { return await f(params ?? {}); } catch (e) { throw e instanceof NordDesktopError ? e : new NordDesktopError('io', String(e?.message ?? e)); }
  };
}

// ---- events ----------------------------------------------------------------------------------------------------------------------
const handlers = new Map();
function emit(name, payload) { for (const f of handlers.get(name) ?? []) { try { f(payload); } catch (e) { console.error(e); } } }
let poller = null;
function startPolling() {
  if (poller) return;
  poller = setInterval(async () => { try { for (const e of await (await fetch('/__desktop/events')).json()) emit(e.name, e.payload); } catch { /* server gone */ } }, 400);
}

// ---- API -------------------------------------------------------------------------------------------------------------------------
export function create(appId = 'web-app', force) {
  const mode = force ?? (window.ipc?.postMessage && location.protocol !== 'http:' && location.protocol !== 'https:' ? 'ipc' : null);
  let call = mode === 'ipc' ? ipcTransport() : null, transport = mode;
  const ready = (async () => {
    if (call) return;
    try { const r = await fetch('/__desktop/events', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) { call = httpTransport(); transport = 'http'; startPolling(); return; } } catch { /* no server bridge */ }
    call = webTransport(appId); transport = 'web';
  })();
  const c = async (method, params) => { await ready; return call(method, params); };
  const sub = (ns, names) => Object.fromEntries(names.map((n) => [n, (p) => c(`${ns}.${n}`, p)]));
  const d = {
    get transport() { return transport; },
    ready,
    app: {
      ...sub('app', ['info', 'paths', 'permissions', 'launch', 'audit', 'quit']),
      setQuitGuard: (enable = true) => c('app.quitGuard', { enable }), setAutostart: (enable = true) => c('app.autostart', { enable }),
    },
    fs: {
      readText: (path) => c('fs.readText', { path }), writeText: (path, text) => c('fs.writeText', { path, text }), append: (path, text) => c('fs.append', { path, text }),
      read: async (path) => unb64(await c('fs.read', { path })), write: (path, data) => c('fs.write', { path, data: b64(bytes(data)) }),
      list: (path = '') => c('fs.list', { path }), stat: (path) => c('fs.stat', { path }), exists: (path) => c('fs.exists', { path }), mkdir: (path) => c('fs.mkdir', { path }),
      remove: (path, { recursive = false } = {}) => c('fs.remove', { path, recursive }), rename: (from, to) => c('fs.rename', { from, to }), copy: (from, to) => c('fs.copy', { from, to }),
      readJson: async (path) => JSON.parse(await c('fs.readText', { path })), writeJson: (path, v) => c('fs.writeText', { path, text: JSON.stringify(v, null, 2) }),
      /** Calls cb({kind: created|modified|removed, path}) on changes (polled every `interval` ms). Returns an unwatch function. */
      async watch(path, cb, { recursive = false, interval = 700 } = {}) {
        const id = await c('fs.watch', { path, recursive });
        const t = setInterval(async () => { try { for (const e of await c('fs.poll', { id })) cb(e); } catch { clearInterval(t); } }, interval);
        return () => { clearInterval(t); c('fs.unwatch', { id }).catch(() => { }); };
      },
    },
    dialog: {
      open: (o = {}) => c('dialog.open', o), save: (o = {}) => c('dialog.save', o), folder: (o = {}) => c('dialog.folder', o), recent: () => c('dialog.recent'),
      message: (text, o = {}) => c('dialog.message', { text, ...o }), confirm: (text, o = {}) => c('dialog.confirm', { text, ...o }),
    },
    notify: Object.assign((title, body = '') => c('notify.show', { title, body }), { setBadge: (text) => c('notify.badge', { text: text == null ? null : String(text) }), setProgress: (value) => c('notify.progress', { value }) }),
    clipboard: { readText: () => c('clipboard.readText'), writeText: (text) => c('clipboard.writeText', { text }), readImage: () => c('clipboard.readImage'), writeImage: (png) => c('clipboard.writeImage', { png: b64(bytes(png)) }) },
    store: { ...sub('store', ['get', 'remove', 'keys', 'clear']), set: (key, value) => c('store.set', { key, value }), get: (key, fallback = null) => c('store.get', { key }).then((v) => v ?? fallback) },
    secret: { get: (key) => c('secret.get', { key }), set: (key, value) => c('secret.set', { key, value }), delete: (key) => c('secret.delete', { key }) },
    shell: { openUrl: (url) => c('shell.openUrl', { url }), openPath: (path) => c('shell.openPath', { path }), reveal: (path) => c('shell.reveal', { path }) },
    process: { run: (program, args = [], opts = {}) => c('process.run', { program, args, ...opts }) },
    http: { fetch: (url, o = {}) => c('http.fetch', { url, ...o }) },
    window: { open: (o) => c('window.open', o), close: (id) => c('window.close', { id }), setTitle: (title) => c('window.setTitle', { title }), setFullscreen: (on = true) => c('window.setFullscreen', { on }), setAlwaysOnTop: (on = true) => c('window.setAlwaysOnTop', { on }) },
    menu: { set: (items) => c('menu.set', { items }), context: (items, pos = {}) => c('menu.context', { items, ...pos }) },
    tray: { set: (o) => c('tray.set', o), remove: () => c('tray.remove') },
    shortcut: { register: async (id, accelerator, cb) => { if (cb) d.on('shortcut:' + id, cb); return c('shortcut.register', { id, accelerator }); }, unregister: (id) => c('shortcut.unregister', { id }) },
    /** Events from the shell: `menu` {id}, `tray` {id}, `shortcut:<id>`, `drop` {files}, `open` {files, urls}, `quit-requested`. Returns an off function. */
    on(name, fn) { (handlers.get(name) ?? handlers.set(name, new Set()).get(name)).add(fn); return () => handlers.get(name)?.delete(fn); },
    off(name, fn) { handlers.get(name)?.delete(fn); },
  };
  // drag & drop of files from the OS onto the page (browser + webview): reported as `drop` with File objects (web) — the native shell adds absolute paths
  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); emit('drop', { files: [...e.dataTransfer.files] }); } });
  }
  return d;
}

/** The shared instance: `import desktop from './nord-desktop.js'` (also exposed as window.nord.desktop). */
const desktop = create(globalThis.NORD_APP_ID ?? document.querySelector('meta[name=nord-app-id]')?.content ?? location.host ?? 'web-app');
(globalThis.nord ??= {}).desktop = desktop;
export default desktop;
