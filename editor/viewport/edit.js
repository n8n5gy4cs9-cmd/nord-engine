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

// Play mode: the running game streams transforms; show them here. ~1 s after the stream stops (Stop pressed) the saved scene comes back.
let liveBackup = null;
let liveTimer = 0;
function applyLive(items) {
  if (!state.scene) return;
  const byId = new Map(flatten(state.scene.entities).map(({ e }) => [e.id, e]));
  liveBackup ??= new Map();
  for (const it of items) {
    const e = byId.get(it.id);
    if (!e) continue;
    if (!liveBackup.has(it.id)) liveBackup.set(it.id, e.transform ? structuredClone(e.transform) : null);
    e.transform = { ...(e.transform ?? {}), pos: it.pos, rot: it.rot, scale: it.scale };
  }
  backend?.setLive?.(items);
  clearTimeout(liveTimer);
  liveTimer = setTimeout(endLive, 1000);
}
function endLive() {
  if (!liveBackup || !state.scene) return;
  const byId = new Map(flatten(state.scene.entities).map(({ e }) => [e.id, e]));
  for (const [id, t] of liveBackup) { const e = byId.get(id); if (e) e.transform = t; }
  liveBackup = null;
  backend?.setScene?.();
}

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
    case 'alignReq': { const pose = backend?.viewPose?.(); if (pose) send({ t: 'viewPose', ...pose }); break; }
    case 'focus': backend?.focus?.(!!m.all); break;
    case 'view': backend?.setView?.(m); break;
    case 'live': applyLive(m.items ?? []); break;
    case 'thumbs': backend?.thumbs?.(m.items ?? []); break;
    case 'scriptCall': runScriptCall(m); break;
    default: break;
  }
}

// ---- Inspector script buttons (Button('Label', 'method')) ----
// The editor sends {t:'scriptCall', id, script, method}. We import the script module, call its STATIC method with an editor context that
// edits a copy of the entity as scene JSON, and send the finished entity back ({t:'entityEdited'}); the editor applies it as one undo step.
const newId = () => Math.random().toString(36).slice(2, 10);
function makeCtx(entity, attrs) {
  const all = () => flatten(entity.children, entity).map((x) => x.e);
  const parentOf = (child, from = entity) => { for (const c of from.children ?? []) { if (c === child) return from; const p = parentOf(child, c); if (p) return p; } return null; };
  return {
    entity, attrs,
    /** Add a child entity (scene JSON shape; `pos`, `rot`, `scale` may be given directly). Returns it. */
    CreateChild(data, parent = entity) {
      const { pos, rot, scale, ...rest } = data;
      const child = { id: newId(), enabled: true, tags: [], layer: 0, components: [], scripts: [], children: [], prefab: null, ...rest,
        transform: { pos: pos ?? [0, 0, 0], rot: rot ?? [0, 0, 0], scale: scale ?? [1, 1, 1], ...(rest.transform ?? {}) } };
      (parent.children ??= []).push(child);
      return child;
    },
    /** Remove a descendant. */
    Destroy(child) { const p = parentOf(child); if (p) p.children = p.children.filter((c) => c !== child); },
    Find(name) { return all().find((e) => e.name === name) ?? null; },
    FindAll(test) { return all().filter(test); },
    log(text) { send({ t: 'log', text: String(text) }); },
  };
}
async function runScriptCall(m) {
  const hit = flatten(state.scene?.entities).find(({ e }) => e.id === m.id);
  try {
    if (!hit) throw new Error(`entity ${m.id} is not in the scene`);
    const mod = await import(`/${m.script}?v=${Date.now()}`);
    const Class = mod.default, fn = Class?.[m.method];
    if (typeof fn !== 'function') throw new Error(`${m.script} has no static method ${m.method}(ctx)`);
    const { resolveAttributes } = await import('/runtime/core/script.js');
    const entity = structuredClone(hit.e);
    const given = entity.scripts?.find((s) => s.path === m.script)?.attributes ?? {};
    await fn.call(Class, makeCtx(entity, resolveAttributes(Class, given, () => {})));
    send({ t: 'entityEdited', id: m.id, method: m.method, entity });
  } catch (err) {
    send({ t: 'scriptError', text: `${m.script} ${m.method}: ${err?.message ?? err}` });
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

// Forward editor shortcuts: the page owns keyboard focus when it is a native webview child. Every key is sent; the editor's
// (rebindable) keymap decides what it means. Defaults and Cmd/Ctrl combos also stop the browser's own handling.
const SWALLOW = ['q', 'w', 'e', 'r', 't', 'f', 'delete', 'backspace', 'f5', 'f6'];
addEventListener('keydown', (e) => {
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  if (state.flying) return; // RMB fly mode: WASDQE move the camera, they are not tool shortcuts
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || e.repeat) return;
  const k = e.key.toLowerCase();
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd || SWALLOW.includes(k)) e.preventDefault();
  send({ t: 'key', key: k, cmd, shift: e.shiftKey, alt: e.altKey });
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
