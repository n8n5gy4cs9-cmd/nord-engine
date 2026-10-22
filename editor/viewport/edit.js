// Nord edit viewport: common protocol + mode switch. Talks to the editor over HTTP/SSE (nord-serve Hub):
//   editor -> page : SSE /__edit/events   {t:'scene'|'select'|'settings'|'focus'|'thumbs'}
//   page -> editor : POST /api/ipc        {t:'ready'|'select'|'transform'|'key'|'thumb'|'log'}
// Messages can also be injected in tests via POST /__edit/cmd, and inspected via GET /api/ipc.
const params = new URLSearchParams(location.search);
export const mode = params.get('mode') === '3d' ? '3d' : '2d';
export const canvas = document.getElementById('c');
export const hud = document.getElementById('hud');
const msgEl = document.getElementById('msg');

export const state = {
  mode,
  project: null,
  scene: null,
  selection: [],
  settings: { tool: 'move', icons: true, colliders: true, snap: false, snapMove: 1, snapRot: 15, snapScale: 0.1, grid: true },
  rev: -1,
};

// Web editor (M11-07): the viewport runs in an <iframe> of the editor page (`?web=1`) and talks over postMessage instead of HTTP/SSE.
const embedded = params.has('web') && window.parent !== window;

export function send(m) {
  if (embedded) { window.parent.postMessage({ nord: 'ipc', msg: m }, '*'); return; }
  try { fetch('/api/ipc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m), keepalive: true }); } catch { /* editor gone */ }
}

export function log(text) { send({ t: 'log', text: String(text) }); }

export function flatten(list, parent = null, out = []) {
  for (const e of list ?? []) { out.push({ e, parent }); flatten(e.children, e, out); }
  return out;
}

let backend = null;
const queue = [];

export function onMessage(m) {
  switch (m.t) {
    case 'scene':
      state.project = m.project; state.scene = m.scene; state.rev = m.rev; state.selection = m.selection ?? state.selection;
      msgEl.style.display = 'none';
      backend?.setScene?.();
      break;
    case 'select': state.selection = m.ids ?? (m.id ? [m.id] : []); backend?.setSelection?.(); break;
    case 'settings': Object.assign(state.settings, m); delete state.settings.t; backend?.setSettings?.(); break;
    case 'dropPreview': backend?.dropPreview?.(m); break;
    case 'dropAsset': backend?.dropAsset?.(m); break;
    case 'focus': backend?.focus?.(!!m.all); break;
    case 'view': backend?.setView?.(m); break;
    case 'thumbs': backend?.thumbs?.(m.items ?? []); break;
    default: break;
  }
}

function connect() {
  if (embedded) {
    addEventListener('message', (ev) => {
      if (ev.source !== window.parent || ev.data?.nord !== 'edit') return;
      let m; try { m = JSON.parse(ev.data.data); } catch { return; }
      if (backend) onMessage(m); else queue.push(m);
    });
    send({ t: 'ready', mode });
    return;
  }
  const es = new EventSource('/__edit/events');
  es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (backend) onMessage(m); else queue.push(m); };
  es.onopen = () => send({ t: 'ready', mode });
}

// Forward editor shortcuts: the page owns keyboard focus when it is a native webview child.
addEventListener('keydown', (e) => {
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  const cmd = e.metaKey || e.ctrlKey;
  const wanted = ['q', 'w', 'e', 'r', 't', 'f', 'delete', 'backspace'].includes(k) && !cmd && !e.altKey || (cmd && ['z', 'd', 's', 'c', 'v', 'p', 'k'].includes(k));
  if (wanted) { e.preventDefault(); send({ t: 'key', key: k, cmd, shift: e.shiftKey }); }
});

(async () => {
  try {
    backend = mode === '3d' ? await import('/editor/viewport/edit3d.js') : await import('/editor/viewport/edit2d.js');
    await backend.init();
    window.__nordEdit = { state, backend, onMessage }; // tests + debugging
    window.__nord_edit_ready = true;
    for (const m of queue.splice(0)) onMessage(m);
    connect();
  } catch (err) {
    console.error(err);
    msgEl.textContent = `Viewport failed: ${err?.message ?? err}`;
    log(`viewport init failed: ${err?.stack ?? err}`);
  }
})();
