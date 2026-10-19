// 2D edit view (plain Canvas2D): pan/zoom, grid, picking, move/rotate/scale handles, snap, IPC sync.
// Deliberately not Phaser: editing needs no physics/rendering fidelity, starts instantly and is trivially testable.
import { canvas, state, send, flatten } from './edit.js';

const ctx = canvas.getContext('2d');
const cam = { x: 0, y: 0, zoom: 1 };
const images = new Map(); // path -> {img, ok, meta}
const maps = new Map();   // path -> json
let W = 0, H = 0, dpr = 1;
let items = [];            // flattened [{e, parent, w}] with world transforms
let drag = null;
let mouse = { x: 0, y: 0 };
let space = false;
const R = Math.PI / 180;
const GIZMO = 64;

export async function init() {
  const resize = () => {
    dpr = devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    draw();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('keydown', (e) => { if (e.code === 'Space') { space = true; e.preventDefault(); } });
  addEventListener('keyup', (e) => { if (e.code === 'Space') space = false; });
}

// ---------- transforms ----------
function localToWorld(parentW, t) {
  const s = [t.scale[0], t.scale[1]];
  if (!parentW) return { x: t.pos[0], y: t.pos[1], rot: t.rot[2], sx: s[0], sy: s[1] };
  const a = parentW.rot * R, c = Math.cos(a), si = Math.sin(a);
  const lx = t.pos[0] * parentW.sx, ly = t.pos[1] * parentW.sy;
  return { x: parentW.x + lx * c - ly * si, y: parentW.y + lx * si + ly * c, rot: parentW.rot + t.rot[2], sx: parentW.sx * s[0], sy: parentW.sy * s[1] };
}

function rebuild() {
  items = [];
  const walk = (list, parentW) => {
    for (const e of list ?? []) {
      const w = localToWorld(parentW, e.transform);
      items.push({ e, w, parentW });
      walk(e.children, w);
    }
  };
  walk(state.scene?.entities, null);
  items.sort((a, b) => (a.e.layer ?? 0) - (b.e.layer ?? 0));
}

function getImage(path) {
  let r = images.get(path);
  if (!r) {
    r = { img: new Image(), ok: false, meta: null };
    r.img.onload = () => { r.ok = true; draw(); };
    r.img.src = '/' + path;
    images.set(path, r);
    fetch(`/${path}.meta.json`).then((x) => (x.ok ? x.json() : null)).then((m) => { r.meta = m; draw(); }).catch(() => {});
  }
  return r;
}

function getMap(path) {
  if (!maps.has(path)) {
    maps.set(path, null);
    fetch('/' + path).then((x) => x.json()).then((j) => { maps.set(path, j); draw(); }).catch(() => {});
  }
  return maps.get(path);
}

function comp(e, type) { return e.components?.find((c) => c.type === type); }

/** Local (unscaled) size in world px for picking + outline. */
export function sizeOf(e) {
  const s = comp(e, 'sprite') ?? comp(e, 'animatedSprite');
  if (s?.texture) {
    const r = getImage(s.texture);
    const fw = r.meta?.frameWidth, fh = r.meta?.frameHeight;
    if (fw && fh) return { w: fw, h: fh };
    if (r.ok) return { w: r.img.naturalWidth, h: r.img.naturalHeight };
  }
  const t = comp(e, 'text');
  if (t) { ctx.font = `${t.size ?? 16}px sans-serif`; return { w: Math.max(8, ctx.measureText(t.text ?? '').width), h: (t.size ?? 16) * 1.2 }; }
  const c = comp(e, 'collider') ?? comp(e, 'trigger');
  if (c) return c.shape === 'circle' ? { w: (c.radius ?? 16) * 2, h: (c.radius ?? 16) * 2 } : { w: c.size?.[0] ?? 32, h: c.size?.[1] ?? 32 };
  const l = comp(e, 'light');
  if (l) return { w: (l.radius ?? 100) * 2, h: (l.radius ?? 100) * 2 };
  const u = comp(e, 'uiPanel') ?? comp(e, 'uiLabel') ?? comp(e, 'uiButton') ?? comp(e, 'uiImage') ?? comp(e, 'uiBar');
  if (u) return { w: u.w ?? 100, h: u.h ?? 24 };
  return { w: 20, h: 20 };
}

const toScreen = (x, y) => [(x - cam.x) * cam.zoom + W / 2, (y - cam.y) * cam.zoom + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];

function hitTest(it, wx, wy) {
  const a = -it.w.rot * R, c = Math.cos(a), s = Math.sin(a);
  const dx = wx - it.w.x, dy = wy - it.w.y;
  const lx = (dx * c - dy * s) / (it.w.sx || 1), ly = (dx * s + dy * c) / (it.w.sy || 1);
  const { w, h } = sizeOf(it.e);
  return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}

export function pickAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = items.length - 1; i >= 0; i--) {
    const L = layerOf(items[i].e);
    if (L && (L.locked || L.visible === false)) continue; // locked / hidden layers cannot be picked
    if (items[i].e.enabled !== false && hitTest(items[i], wx, wy)) return items[i].e.id;
  }
  return null;
}

// ---------- drawing ----------
function drawGrid() {
  if (!state.settings.grid) return;
  let step = 16;
  while (step * cam.zoom < 12) step *= 2;
  while (step * cam.zoom > 96) step /= 2;
  const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(W, H);
  ctx.lineWidth = 1;
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
    const [sx] = toScreen(x, 0);
    ctx.strokeStyle = Math.round(x / step) % 5 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.moveTo(Math.round(sx) + .5, 0); ctx.lineTo(Math.round(sx) + .5, H); ctx.stroke();
  }
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
    const [, sy] = toScreen(0, y);
    ctx.strokeStyle = Math.round(y / step) % 5 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.moveTo(0, Math.round(sy) + .5); ctx.lineTo(W, Math.round(sy) + .5); ctx.stroke();
  }
  const [ox, oy] = toScreen(0, 0);
  ctx.strokeStyle = 'rgba(255,90,90,.5)'; ctx.beginPath(); ctx.moveTo(0, oy + .5); ctx.lineTo(W, oy + .5); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,255,120,.5)'; ctx.beginPath(); ctx.moveTo(ox + .5, 0); ctx.lineTo(ox + .5, H); ctx.stroke();
}

const RULER = 16;
const layerOf = (e) => state.scene?.settings?.layers?.[e.layer ?? 0];
const guides = () => ({ x: state.scene?.settings?.guides?.x ?? [], y: state.scene?.settings?.guides?.y ?? [] });
const nearGuide = (axis, v) => { const r = 6 / cam.zoom; let best = null; for (const g of guides()[axis]) if (Math.abs(g - v) <= r && (best === null || Math.abs(g - v) < Math.abs(best - v))) best = g; return best; };

function drawEntity(it) {
  const { e, w } = it;
  const L = layerOf(e);
  if (L && L.visible === false) return; // hidden layer (runtime-visible flag too)
  ctx.globalAlpha = (e.enabled === false ? 0.35 : 1) * (L?.opacity ?? 1);
  const [sx, sy] = toScreen(w.x, w.y);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(w.rot * R);
  ctx.scale(cam.zoom * w.sx, cam.zoom * w.sy);
  let drawn = false;
  const s = comp(e, 'sprite') ?? comp(e, 'animatedSprite');
  if (s?.texture) {
    const r = getImage(s.texture);
    if (r.ok) {
      ctx.save();
      ctx.globalAlpha *= s.alpha ?? 1;
      ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1);
      const fw = r.meta?.frameWidth, fh = r.meta?.frameHeight;
      if (fw && fh) {
        const cols = Math.max(1, Math.floor(r.img.naturalWidth / fw));
        const f = s.frame ?? 0;
        ctx.imageSmoothingEnabled = r.meta?.filter !== 'nearest';
        ctx.drawImage(r.img, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh, -fw / 2, -fh / 2, fw, fh);
      } else {
        ctx.imageSmoothingEnabled = r.meta?.filter !== 'nearest';
        ctx.drawImage(r.img, -r.img.naturalWidth / 2, -r.img.naturalHeight / 2);
      }
      ctx.restore();
      drawn = true;
    }
  }
  const t = comp(e, 'text');
  if (t) {
    ctx.fillStyle = t.color ?? '#fff'; ctx.font = `${t.size ?? 16}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.text ?? '', 0, 0); drawn = true;
  }
  const l = comp(e, 'light');
  if (l) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, l.radius ?? 100);
    g.addColorStop(0, (l.color ?? '#ffe9a8') + '88'); g.addColorStop(1, (l.color ?? '#ffe9a8') + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, l.radius ?? 100, 0, 7); ctx.fill(); drawn = true;
  }
  const u = comp(e, 'uiPanel') ?? comp(e, 'uiLabel') ?? comp(e, 'uiButton') ?? comp(e, 'uiBar') ?? comp(e, 'uiImage');
  if (u) {
    const { w: uw, h: uh } = sizeOf(e);
    ctx.strokeStyle = '#7aa2ff'; ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]); ctx.strokeRect(-uw / 2, -uh / 2, uw, uh); ctx.setLineDash([]);
    ctx.fillStyle = '#7aa2ff'; ctx.font = `${12}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.text ?? u.type ?? 'UI', 0, 0); drawn = true;
  }
  const cm = comp(e, 'camera');
  ctx.lineWidth = 1 / cam.zoom;
  if (cm) {
    const d = state.project?.display ?? { width: 1280, height: 720 };
    ctx.strokeStyle = '#ffd166'; ctx.strokeRect(-d.width / 2, -d.height / 2, d.width, d.height); drawn = true;
  }
  const col = comp(e, 'collider') ?? comp(e, 'trigger');
  if (col) {
    ctx.strokeStyle = col.trigger || comp(e, 'trigger') ? '#c792ea' : '#6bff8a';
    if (col.shape === 'circle') { ctx.beginPath(); ctx.arc(col.offset?.[0] ?? 0, col.offset?.[1] ?? 0, col.radius ?? 16, 0, 7); ctx.stroke(); }
    else { const [cw, ch] = col.size ?? [32, 32]; ctx.strokeRect((col.offset?.[0] ?? 0) - cw / 2, (col.offset?.[1] ?? 0) - ch / 2, cw, ch); }
    drawn = true;
  }
  if (!drawn) {
    ctx.strokeStyle = 'rgba(200,210,230,.8)'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    ctx.strokeRect(-6, -6, 12, 12);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawGuides() {
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,200,255,.75)';
  const g = guides();
  for (const x of g.x) { const [sx] = toScreen(x, 0); ctx.beginPath(); ctx.moveTo(Math.round(sx) + .5, 0); ctx.lineTo(Math.round(sx) + .5, H); ctx.stroke(); }
  for (const y of g.y) { const [, sy] = toScreen(0, y); ctx.beginPath(); ctx.moveTo(0, Math.round(sy) + .5); ctx.lineTo(W, Math.round(sy) + .5); ctx.stroke(); }
  if (drag?.kind === 'guide' && drag.value != null) { // the guide being dragged
    ctx.setLineDash([4, 3]);
    if (drag.axis === 'x') { const [sx] = toScreen(drag.value, 0); ctx.beginPath(); ctx.moveTo(sx + .5, 0); ctx.lineTo(sx + .5, H); ctx.stroke(); }
    else { const [, sy] = toScreen(0, drag.value); ctx.beginPath(); ctx.moveTo(0, sy + .5); ctx.lineTo(W, sy + .5); ctx.stroke(); }
    ctx.setLineDash([]);
  }
}

/** Rulers along the top and left edge with world coordinates; drag out of them to create guides. */
function drawRulers() {
  ctx.fillStyle = 'rgba(24,28,36,.92)'; ctx.fillRect(0, 0, W, RULER); ctx.fillRect(0, 0, RULER, H);
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((s) => s * cam.zoom >= 50) ?? 5000;
  ctx.fillStyle = '#9aa4b5'; ctx.strokeStyle = '#4a5365'; ctx.font = '9px sans-serif'; ctx.lineWidth = 1;
  const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
    const [sx] = toScreen(x, 0); if (sx < RULER) continue;
    ctx.beginPath(); ctx.moveTo(Math.round(sx) + .5, RULER - 6); ctx.lineTo(Math.round(sx) + .5, RULER); ctx.stroke();
    ctx.fillText(String(Math.round(x)), sx + 2, 2);
  }
  ctx.save(); ctx.textBaseline = 'bottom';
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
    const [, sy] = toScreen(0, y); if (sy < RULER) continue;
    ctx.beginPath(); ctx.moveTo(RULER - 6, Math.round(sy) + .5); ctx.lineTo(RULER, Math.round(sy) + .5); ctx.stroke();
    ctx.save(); ctx.translate(2, sy - 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText(String(Math.round(y)), 0, 9); ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#1b1f27'; ctx.fillRect(0, 0, RULER, RULER);
}

function drawTilemaps() {
  for (const it of items) {
    const tm = comp(it.e, 'tilemap');
    if (!tm?.map) continue;
    const m = getMap(tm.map);
    const ts = tm.tileset ? getImage(tm.tileset) : null;
    if (!m || !ts?.ok) continue;
    const tw = m.tileWidth ?? m.tilewidth ?? 16, th = m.tileHeight ?? m.tileheight ?? 16;
    const cols = Math.max(1, Math.floor(ts.img.naturalWidth / tw));
    ctx.imageSmoothingEnabled = false;
    for (const layer of m.layers ?? []) {
      const rows = layer.data;
      if (!Array.isArray(rows?.[0])) continue; // nord format only in the viewport
      rows.forEach((row, y) => row.forEach((v, x) => {
        if (v < 0) return;
        const [sx, sy] = toScreen(x * tw, y * th);
        ctx.drawImage(ts.img, (v % cols) * tw, Math.floor(v / cols) * th, tw, th, sx, sy, tw * cam.zoom + .5, th * cam.zoom + .5);
      }));
    }
  }
}

function selected() { return items.find((i) => i.e.id === state.selection[0]); }

function drawGizmo() {
  const it = selected();
  if (!it) return;
  const [sx, sy] = toScreen(it.w.x, it.w.y);
  const { w, h } = sizeOf(it.e);
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(it.w.rot * R); ctx.scale(cam.zoom * it.w.sx, cam.zoom * it.w.sy);
  ctx.strokeStyle = '#4fa3ff'; ctx.lineWidth = 1.5 / (cam.zoom * Math.abs(it.w.sx || 1)); ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  const tool = state.settings.tool;
  ctx.lineWidth = 2;
  if (tool === 'move') {
    ctx.strokeStyle = '#ff5f5f'; ctx.fillStyle = '#ff5f5f'; line(sx, sy, sx + GIZMO, sy); tri(sx + GIZMO, sy, 0);
    ctx.strokeStyle = '#5fff7f'; ctx.fillStyle = '#5fff7f'; line(sx, sy, sx, sy + GIZMO); tri(sx, sy + GIZMO, 1);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(sx - 6, sy - 6, 12, 12);
  } else if (tool === 'rotate') {
    ctx.strokeStyle = '#ffe066'; ctx.beginPath(); ctx.arc(sx, sy, GIZMO, 0, 7); ctx.stroke();
    const a = it.w.rot * R; ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * GIZMO, sy + Math.sin(a) * GIZMO, 6, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = '#ff5f5f'; ctx.fillStyle = '#ff5f5f'; line(sx, sy, sx + GIZMO, sy); ctx.fillRect(sx + GIZMO - 5, sy - 5, 10, 10);
    ctx.strokeStyle = '#5fff7f'; ctx.fillStyle = '#5fff7f'; line(sx, sy, sx, sy + GIZMO); ctx.fillRect(sx - 5, sy + GIZMO - 5, 10, 10);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(sx - 6, sy - 6, 12, 12);
  }
}
const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
function tri(x, y, dir) {
  ctx.beginPath();
  if (dir === 0) { ctx.moveTo(x + 10, y); ctx.lineTo(x, y - 5); ctx.lineTo(x, y + 5); } else { ctx.moveTo(x, y + 10); ctx.lineTo(x - 5, y); ctx.lineTo(x + 5, y); }
  ctx.fill();
}

export function draw() {
  if (!W) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = state.project?.display?.background ?? '#1b1f27';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b1f27'; ctx.fillRect(0, 0, W, H);
  const d = state.project?.display;
  if (d) {
    const [x0, y0] = toScreen(0, 0);
    ctx.fillStyle = d.background ?? '#101418'; ctx.fillRect(x0, y0, d.width * cam.zoom, d.height * cam.zoom);
  }
  drawGrid();
  if (d) { const [x0, y0] = toScreen(0, 0); ctx.strokeStyle = 'rgba(79,163,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, d.width * cam.zoom, d.height * cam.zoom); }
  drawTilemaps();
  for (const it of items) drawEntity(it);
  drawGuides();
  drawGizmo();
  drawRulers();
  const hudEl = document.getElementById('hud');
  const [mx, my] = toWorld(mouse.x, mouse.y);
  hudEl.textContent = `2D · ${Math.round(cam.zoom * 100)}% · ${Math.round(mx)}, ${Math.round(my)} · ${state.settings.tool}${state.settings.snap ? ' · snap' : ''}`;
}

// ---------- interaction ----------
function handleAt(sx, sy) {
  const it = selected();
  if (!it) return null;
  const [ox, oy] = toScreen(it.w.x, it.w.y);
  const tool = state.settings.tool;
  const d = Math.hypot(sx - ox, sy - oy);
  if (tool === 'move') {
    if (Math.abs(sx - ox) <= 7 && Math.abs(sy - oy) <= 7) return 'free';
    if (sy > oy - 6 && sy < oy + 6 && sx > ox && sx < ox + GIZMO + 12) return 'x';
    if (sx > ox - 6 && sx < ox + 6 && sy > oy && sy < oy + GIZMO + 12) return 'y';
  } else if (tool === 'rotate') {
    if (Math.abs(d - GIZMO) < 8) return 'rot';
  } else {
    if (Math.abs(sx - ox) <= 7 && Math.abs(sy - oy) <= 7) return 'suni';
    if (Math.abs(sx - (ox + GIZMO)) <= 8 && Math.abs(sy - oy) <= 8) return 'sx';
    if (Math.abs(sx - ox) <= 8 && Math.abs(sy - (oy + GIZMO)) <= 8) return 'sy';
  }
  return null;
}

const snapTo = (v, step) => (state.settings.snap && step > 0 ? Math.round(v / step) * step : v);

function startDrag(kind, it, sx, sy) {
  const e = it.e;
  drag = { kind, id: e.id, sx, sy, t0: JSON.parse(JSON.stringify(e.transform)), w0: { ...it.w }, parentW: it.parentW, moved: false, last: 0 };
  const [wx, wy] = toWorld(sx, sy);
  drag.a0 = Math.atan2(wy - it.w.y, wx - it.w.x);
}

function onDown(ev) {
  canvas.focus();
  const r = canvas.getBoundingClientRect();
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  mouse = { x: sx, y: sy };
  if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && space)) {
    drag = { kind: 'pan', sx, sy, cx: cam.x, cy: cam.y };
    canvas.setPointerCapture?.(ev.pointerId);
    return;
  }
  if (ev.button !== 0) return;
  canvas.setPointerCapture?.(ev.pointerId);
  // rulers create guides; an existing guide line can be dragged (drop it on a ruler to delete it)
  if ((sy < RULER) !== (sx < RULER)) { drag = { kind: 'guide', axis: sy < RULER ? 'y' : 'x', value: null, from: null }; return; }
  for (const axis of ['x', 'y']) for (const g of guides()[axis]) {
    const [gx, gy] = toScreen(axis === 'x' ? g : 0, axis === 'y' ? g : 0);
    if (Math.abs(axis === 'x' ? sx - gx : sy - gy) <= 3) { drag = { kind: 'guide', axis, value: g, from: g }; return; }
  }
  const h = handleAt(sx, sy);
  const it = selected();
  if (h && it) { startDrag(h, it, sx, sy); return; }
  const id = pickAt(sx, sy);
  if (ev.shiftKey && id) {
    const sel = new Set(state.selection);
    sel.has(id) ? sel.delete(id) : sel.add(id);
    state.selection = [...sel];
  } else {
    state.selection = id ? [id] : [];
  }
  send({ t: 'select', id: state.selection[0] ?? null });
  draw();
  const picked = selected();
  if (picked && state.settings.tool === 'move') startDrag('free', picked, sx, sy);
}

function emit(final) {
  const it = items.find((i) => i.e.id === drag.id);
  if (!it) return;
  const t = it.e.transform;
  send({ t: 'transform', id: drag.id, pos: t.pos, rot: t.rot, scale: t.scale, final });
}

function onMove(ev) {
  const r = canvas.getBoundingClientRect();
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  mouse = { x: sx, y: sy };
  if (!drag) { draw(); return; }
  if (drag.kind === 'guide') { const [wx, wy] = toWorld(sx, sy); drag.value = Math.round(drag.axis === 'x' ? wx : wy); drag.overRuler = drag.axis === 'x' ? sx < RULER : sy < RULER; draw(); return; }
  if (drag.kind === 'pan') {
    cam.x = drag.cx - (sx - drag.sx) / cam.zoom; cam.y = drag.cy - (sy - drag.sy) / cam.zoom; draw(); reportCam(); return;
  }
  const it = items.find((i) => i.e.id === drag.id);
  if (!it) return;
  const e = it.e;
  const [wx, wy] = toWorld(sx, sy), [wx0, wy0] = toWorld(drag.sx, drag.sy);
  let dx = wx - wx0, dy = wy - wy0;
  if (drag.kind === 'x') dy = 0;
  if (drag.kind === 'y') dx = 0;
  if (drag.kind === 'free' || drag.kind === 'x' || drag.kind === 'y') {
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 3) return;
    drag.moved = true;
    // world delta -> parent-local delta
    const p = drag.parentW;
    let lx = dx, ly = dy;
    if (p) {
      const a = -p.rot * R, c = Math.cos(a), s = Math.sin(a);
      lx = (dx * c - dy * s) / (p.sx || 1); ly = (dx * s + dy * c) / (p.sy || 1);
    }
    let nx = snapTo(drag.t0.pos[0] + lx, state.settings.snapMove), ny = snapTo(drag.t0.pos[1] + ly, state.settings.snapMove);
    if (!p) { const gx = nearGuide('x', nx), gy = nearGuide('y', ny); if (gx !== null) nx = gx; if (gy !== null) ny = gy; } // snap to guides
    e.transform.pos = [nx, ny, drag.t0.pos[2]];
  } else if (drag.kind === 'rot') {
    const a = Math.atan2(wy - drag.w0.y, wx - drag.w0.x);
    let deg = drag.t0.rot[2] + (a - drag.a0) / R;
    deg = snapTo(deg, state.settings.snapRot);
    e.transform.rot = [drag.t0.rot[0], drag.t0.rot[1], deg];
  } else if (drag.kind === 'sx' || drag.kind === 'sy' || drag.kind === 'suni') {
    const k = 1 + ((drag.kind === 'sy' ? sy - drag.sy : sx - drag.sx) / (GIZMO));
    const s0 = drag.t0.scale;
    const f = (v) => snapTo(v * Math.max(0.01, k), state.settings.snapScale);
    e.transform.scale = [drag.kind === 'sy' ? s0[0] : f(s0[0]), drag.kind === 'sx' ? s0[1] : f(s0[1]), s0[2]];
  }
  rebuild();
  draw();
  const now = performance.now();
  if (now - drag.last > 50) { drag.last = now; emit(false); }
}

function onUp() {
  if (drag?.kind === 'guide') {
    const g = drag; drag = null;
    if (g.value != null || g.from != null) send({ t: 'guide', axis: g.axis, from: g.from, to: g.overRuler || g.value == null ? null : g.value });
    draw(); return;
  }
  if (drag && drag.kind !== 'pan' && drag.moved !== false) emit(true);
  drag = null;
}

function onWheel(ev) {
  ev.preventDefault();
  const r = canvas.getBoundingClientRect();
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  const [wx, wy] = toWorld(sx, sy);
  cam.zoom = Math.min(32, Math.max(0.05, cam.zoom * Math.exp(-ev.deltaY * 0.0015)));
  cam.x = wx - (sx - W / 2) / cam.zoom; cam.y = wy - (sy - H / 2) / cam.zoom;
  draw(); reportCam();
}

// camera reports (editor "Views" section) and view commands
let camTimer = null;
function reportCam() { clearTimeout(camTimer); camTimer = setTimeout(() => send({ t: 'cam', x: Math.round(cam.x), y: Math.round(cam.y), zoom: Math.round(cam.zoom * 1000) / 1000 }), 200); }
export function setView(v) { cam.x = v.x ?? cam.x; cam.y = v.y ?? cam.y; cam.zoom = Math.min(32, Math.max(0.05, v.zoom ?? cam.zoom)); draw(); reportCam(); }

// ---------- editor -> viewport ----------
export function setScene() {
  rebuild();
  if (!init.framed && state.project?.display) { cam.x = state.project.display.width / 2; cam.y = state.project.display.height / 2; cam.zoom = Math.min(1, (W || 800) / (state.project.display.width * 1.1)); init.framed = true; }
  draw();
}
export function setSelection() { draw(); }
export function setSettings() { draw(); }
export function focus() {
  const it = selected();
  if (!it) return;
  cam.x = it.w.x; cam.y = it.w.y;
  const { w, h } = sizeOf(it.e);
  cam.zoom = Math.min(8, Math.max(0.1, Math.min(W, H) / (Math.max(w * it.w.sx, h * it.w.sy, 16) * 3)));
  draw();
}
export function thumbs() { /* models are only rendered by the 3D viewport */ }

// ---------- test hooks ----------
export const api = {
  cam, toScreen, toWorld, pickAt, RULER,
  screenOf: (id) => { const it = items.find((i) => i.e.id === id); return it ? toScreen(it.w.x, it.w.y) : null; },
  items: () => items.map((i) => ({ id: i.e.id, x: i.w.x, y: i.w.y })),
};
