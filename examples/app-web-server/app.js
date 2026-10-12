// @nord {"id":"app.web-server","title":"Local web server (desktop)","category":"apps","tier":["html"],"tags":["server","http","static","live-reload","desktop"],"description":"Serve any folder over HTTP from a desktop app: pick a folder, choose a port, toggle CORS / SPA fallback / directory listing / live reload / LAN access, copy or open the URL, watch a live request log with status filters and a requests-per-second graph. Up to 4 servers at once. Uses window.nord.desktop.server (needs desktop.permissions.server) — in a browser it explains that a native shell is required."}
import desktop from './nord-desktop.js';

const D = desktop;
const CSS = `.ws{--bg:#1e222a;--panel:#272c36;--fg:#d8dee9;--mut:#8a93a5;--acc:#88c0d0;--bd:#3a404d;--ok:#a3be8c;--warn:#ebcb8b;--err:#bf616a;font:14px/1.4 system-ui,sans-serif;background:var(--bg);color:var(--fg);height:100%;overflow:auto;padding:16px}
.ws *{box-sizing:border-box}.ws h2{margin:0 0 4px;font-size:20px}.ws .sub{color:var(--mut);margin-bottom:14px}.ws .card{background:var(--panel);border:1px solid var(--bd);border-radius:10px;padding:12px;margin-bottom:12px}
.ws .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.ws .grow{flex:1;min-width:120px}
.ws button{font:inherit;cursor:pointer;color:var(--bg);background:var(--acc);border:0;border-radius:6px;padding:6px 12px;font-weight:600}.ws button.ghost{background:transparent;color:var(--fg);border:1px solid var(--bd);font-weight:400}
.ws button.stop{background:var(--err);color:#fff}.ws button:disabled{opacity:.4;cursor:default}
.ws input[type=text],.ws input[type=number]{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--bd);border-radius:6px;padding:5px 8px}
.ws label.t{display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 8px;border:1px solid var(--bd);border-radius:999px}.ws label.t:has(input:checked){border-color:var(--acc);color:var(--acc)}
.ws .url{font-family:ui-monospace,monospace;color:var(--acc);cursor:pointer;text-decoration:underline}.ws .pill{font-size:11px;padding:1px 8px;border-radius:999px;background:var(--bg);color:var(--mut)}
.ws table{width:100%;border-collapse:collapse;font:12px ui-monospace,monospace}.ws td,.ws th{padding:2px 8px;text-align:left;white-space:nowrap;border-bottom:1px solid #0003}
.ws th{color:var(--mut);position:sticky;top:0;background:var(--panel)}.ws .log{max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:6px}
.ws .s2{color:var(--ok)}.ws .s3{color:var(--acc)}.ws .s4{color:var(--warn)}.ws .s5{color:var(--err)}.ws canvas{width:100%;height:46px;display:block}
.ws .warn{background:#ebcb8b22;border:1px solid var(--warn);border-radius:8px;padding:10px;margin-bottom:12px}`;
const fmt = (n) => (n < 1024 ? `${n} B` : n < 1 << 20 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export async function mount(root) {
  await D.ready;
  const el = (tag, cls, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); if (cls) e.className = cls; e.append(...kids.flat().filter((k) => k != null)); return e; };
  root.replaceChildren(Object.assign(document.createElement('style'), { textContent: CSS }));
  const ws = el('div', 'ws'); root.append(ws);
  ws.append(el('h2', '', { textContent: '🌐 Local Web Server' }), el('div', 'sub', { textContent: 'Serve a folder on your computer. Static files, live reload, request log.' }));
  const web = D.transport === 'web';
  if (web) { ws.append(el('div', 'warn', { textContent: 'This app starts real network servers, which a browser tab cannot do. Open it in the Nord desktop player (nord-player / exported app) — the controls below are disabled here.' })); }

  const cfg = { folder: null, port: 8080, auto: true, cors: false, spa: false, listing: true, liveReload: true, lan: false, cache: false, ...(await D.store.get('cfg', {})) };
  const save = () => D.store.set('cfg', cfg);
  const servers = new Map(); // id -> { info, since, log:[], stats }
  let selected = null, paused = false, filter = '', statusFilter = 'all';

  // ---- start form ----
  const folderLbl = el('span', 'grow', { textContent: cfg.folder ?? 'No folder chosen' });
  const portIn = el('input', '', { type: 'number', min: 1, max: 65535, value: cfg.port, style: 'width:90px', oninput: () => { cfg.port = +portIn.value; save(); } });
  const toggles = [['auto', 'Auto port'], ['liveReload', 'Live reload'], ['listing', 'Directory listing'], ['spa', 'SPA fallback'], ['cors', 'CORS *'], ['cache', 'Caching (ETag/304)'], ['lan', 'Allow LAN']].map(([k, label]) =>
    el('label', 't', { title: k === 'lan' ? 'Reachable from other devices on your network (asks for confirmation)' : '' }, el('input', '', { type: 'checkbox', checked: cfg[k], onchange: (e) => { cfg[k] = e.target.checked; if (k === 'auto') portIn.disabled = cfg.auto; save(); } }), label));
  portIn.disabled = cfg.auto;
  const startBtn = el('button', '', { textContent: '▶ Start', onclick: start, disabled: web });
  const form = el('div', 'card', {}, el('div', 'row', {}, el('button', 'ghost', { textContent: 'Choose folder…', disabled: web, onclick: chooseFolder }), folderLbl),
    el('div', 'row', {}, el('span', '', { textContent: 'Port' }), portIn, ...toggles), el('div', 'row', {}, startBtn, el('span', 'pill', { id: 'recent' })));
  ws.append(form);
  async function chooseFolder() { const d = await D.dialog.folder({ title: 'Folder to serve' }); if (d) { cfg.folder = d; folderLbl.textContent = d; save(); } }

  async function start() {
    if (!cfg.folder) return chooseFolder().then(() => cfg.folder && start());
    try {
      const info = await D.server.start({ root: cfg.folder, port: cfg.auto ? 0 : cfg.port, cors: cfg.cors, spa: cfg.spa, listing: cfg.listing, liveReload: cfg.liveReload, lan: cfg.lan, cache: cfg.cache });
      servers.set(info.id, { info, since: 0, log: [], stats: { n: 0, err: 0, bytes: 0, buckets: new Array(60).fill(0) } });
      selected = info.id; draw();
      D.notify('Server started', info.url).catch(() => { });
    } catch (e) { D.dialog.message(`Could not start: ${e.message}`, { level: 'error' }); }
  }

  // ---- servers list + log ----
  const list = el('div'), logCard = el('div', 'card'), graph = el('canvas', '', { width: 600, height: 46 });
  ws.append(list, logCard);
  function draw() {
    list.replaceChildren(...[...servers.values()].map(({ info, stats }) => el('div', 'card', { style: selected === info.id ? 'border-color:var(--acc)' : '', onclick: () => { selected = info.id; draw(); } },
      el('div', 'row', {}, el('span', 'url', { textContent: info.url, onclick: (e) => { e.stopPropagation(); D.shell.openUrl(info.url).catch(() => { }); } }), el('span', 'pill', { textContent: `:${info.port}` }), el('span', 'pill', { textContent: `${stats.n} req · ${stats.err} err · ${fmt(stats.bytes)}` }), el('span', 'grow'),
        el('button', 'ghost', { textContent: 'Copy URL', onclick: (e) => { e.stopPropagation(); D.clipboard.writeText(info.url).then(() => D.notify('URL copied', info.url).catch(() => { })).catch(() => { }); } }),
        el('button', 'ghost', { textContent: 'Open', onclick: (e) => { e.stopPropagation(); D.shell.openUrl(info.url).catch(() => { }); } }),
        el('button', 'ghost', { textContent: 'Reveal folder', onclick: (e) => { e.stopPropagation(); D.shell.reveal(info.root).catch(() => { }); } }),
        el('button', 'stop', { textContent: '■ Stop', onclick: async (e) => { e.stopPropagation(); await D.server.stop(info.id); servers.delete(info.id); if (selected === info.id) selected = [...servers.keys()][0] ?? null; draw(); } })),
      el('div', 'sub', { textContent: info.root, style: 'margin:0' }))));
    drawLog();
  }
  function drawLog() {
    const s = servers.get(selected);
    if (!s) { logCard.replaceChildren(el('div', 'sub', { textContent: 'Start a server to see requests here.', style: 'margin:0' })); return; }
    const rows = s.log.filter((e) => (statusFilter === 'all' || String(e.status)[0] === statusFilter) && (!filter || e.path.toLowerCase().includes(filter)));
    logCard.replaceChildren(
      el('div', 'row', {}, el('b', '', { textContent: 'Requests' }), el('input', 'grow', { type: 'text', placeholder: 'filter path…', value: filter, oninput: (e) => { filter = e.target.value.toLowerCase(); drawLog(); } }),
        el('select', '', { onchange: (e) => { statusFilter = e.target.value; drawLog(); } }, ...[['all', 'All'], ['2', '2xx'], ['3', '3xx'], ['4', '4xx'], ['5', '5xx']].map(([v, t]) => el('option', '', { value: v, textContent: t, selected: v === statusFilter }))),
        el('button', 'ghost', { textContent: paused ? 'Resume' : 'Pause', onclick: () => { paused = !paused; drawLog(); } }), el('button', 'ghost', { textContent: 'Clear', onclick: () => { s.log = []; drawLog(); } }),
        el('button', 'ghost', { textContent: 'Copy log', onclick: () => D.clipboard.writeText(s.log.map((e) => `${new Date(e.ts).toISOString()} ${e.ip} ${e.method} ${e.path} ${e.status} ${e.bytes}B ${e.ms}ms`).join('\n')).catch(() => { }) })),
      graph,
      el('div', 'log', {}, el('table', '', {}, el('tr', '', {}, ...['Time', 'Method', 'Path', 'Status', 'Size', 'ms', 'Client'].map((h) => el('th', '', { textContent: h }))),
        ...rows.slice(-200).reverse().map((e) => el('tr', '', {}, el('td', '', { textContent: new Date(e.ts).toLocaleTimeString() }), el('td', '', { textContent: e.method }), el('td', '', { textContent: e.path, title: e.path }), el('td', 's' + String(e.status)[0], { textContent: e.status }), el('td', '', { textContent: fmt(e.bytes) }), el('td', '', { textContent: e.ms }), el('td', '', { textContent: e.ip }))))));
    drawGraph(s);
  }
  function drawGraph(s) {
    const g = graph.getContext('2d'), w = graph.width, h = graph.height, max = Math.max(3, ...s.stats.buckets);
    g.clearRect(0, 0, w, h); g.fillStyle = '#88c0d0';
    s.stats.buckets.forEach((v, i) => { const bh = (v / max) * (h - 12); g.fillRect((i * w) / 60 + 1, h - bh, w / 60 - 2, bh); });
    g.fillStyle = '#8a93a5'; g.font = '10px system-ui'; g.fillText(`requests/sec (last 60 s, peak ${max})`, 4, 10);
  }

  // ---- polling ----
  let tick = 0;
  const timer = setInterval(async () => {
    tick++;
    for (const s of servers.values()) {
      try {
        const { entries, next } = await D.server.logs(s.info.id, s.since); s.since = next;
        if (tick % 2 === 0) { s.stats.buckets.shift(); s.stats.buckets.push(0); }
        for (const e of entries) { s.stats.n++; s.stats.bytes += e.bytes; if (e.status >= 400) s.stats.err++; s.stats.buckets[59]++; if (!paused) s.log.push(e); }
        if (s.log.length > 1000) s.log.splice(0, s.log.length - 1000);
      } catch { /* server stopped */ }
    }
    if (servers.size && !paused) { draw(); }
  }, 500);

  // recent folders as quick picks
  D.dialog.recent().then((r) => { const rc = form.querySelector('#recent'); if (r?.length) { rc.textContent = 'Recent: ' + r.slice(0, 3).map((p) => p.split(/[\\/]/).pop()).join(', '); rc.title = r.join('\n'); rc.style.cursor = 'pointer'; rc.onclick = () => { cfg.folder = r[0]; folderLbl.textContent = r[0]; save(); }; } }).catch(() => { });
  draw();
  return { destroy: () => { clearInterval(timer); for (const id of servers.keys()) D.server.stop(id).catch(() => { }); root.replaceChildren(); } };
}
