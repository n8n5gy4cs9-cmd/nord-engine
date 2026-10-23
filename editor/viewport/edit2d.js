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
  addEventListener('keydown', (e) => { ctrlHeld = e.ctrlKey || e.metaKey; if (e.code === 'Space') { space = true; e.preventDefault(); } });
  addEventListener('keyup', (e) => { ctrlHeld = e.ctrlKey || e.metaKey; if (e.code === 'Space') space = false; });
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
  const walk = (list, parentW, lockedAbove = false) => {
    for (const e of list ?? []) {
      if (e.hidden) continue; // Hierarchy eye toggle: hidden here and below
      const w = localToWorld(parentW, e.transform);
      items.push({ e, w, parentW, locked: lockedAbove || !!e.locked });
      walk(e.children, w, lockedAbove || !!e.locked);
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
    if (items[i].locked) continue; // Hierarchy padlock
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
  if (l && state.settings.icons !== false) {
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
  ctx.lineWidth = 1 / cam.zoom;
  const pa = comp(e, 'particles');
  if (pa && state.settings.icons !== false) { // emitter: faint cloud + label
    ctx.fillStyle = (pa.color1 ?? '#ffb347') + '55'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', 0, 0); drawn = true;
  }
  const pt = comp(e, 'path');
  if (pt?.points?.length > 1) {
    ctx.strokeStyle = '#ffd166'; ctx.beginPath();
    pt.points.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    if (pt.loop) ctx.closePath();
    ctx.stroke(); drawn = true;
  }
  const sp = comp(e, 'spawner');
  if (sp && state.settings.icons !== false) {
    ctx.strokeStyle = '#c792ea'; ctx.setLineDash([3 / cam.zoom, 3 / cam.zoom]); ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#c792ea'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('spawn', 0, 0); drawn = true;
  }
  const px = comp(e, 'parallax');
  if (px?.texture && !drawn) {
    const r = getImage(px.texture);
    if (r.ok) { ctx.globalAlpha *= 0.6; ctx.drawImage(r.img, -r.img.naturalWidth / 2, -r.img.naturalHeight / 2); ctx.globalAlpha = 1; drawn = true; }
  }
  const cm = comp(e, 'camera');
  if (cm && state.settings.icons !== false) {
    const d = state.project?.display ?? { width: 1280, height: 720 };
    ctx.strokeStyle = '#ffd166'; ctx.strokeRect(-d.width / 2, -d.height / 2, d.width, d.height); drawn = true;
  }
  const col = comp(e, 'collider') ?? comp(e, 'trigger');
  if (col && state.settings.colliders !== false) {
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
const selItems = () => state.selection.map((id) => items.find((i) => i.e.id === id)).filter(Boolean);
/** Gizmo position: the primary object (Pivot) or the centre of the selection's bounds (Center), like Unity's Pivot/Center toggle. */
function pivotWorld() {
  const it = selected();
  if (!it) return null;
  const g = selItems();
  if (state.settings.center && g.length > 1) {
    const xs = g.map((i) => i.w.x), ys = g.map((i) => i.w.y);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return [it.w.x, it.w.y];
}
/** Parent-local position of a world point. */
function toLocalPos(p, wx, wy) {
  if (!p) return [wx, wy];
  const a = -p.rot * R, c = Math.cos(a), s = Math.sin(a), dx = wx - p.x, dy = wy - p.y;
  return [(dx * c - dy * s) / (p.sx || 1), (dx * s + dy * c) / (p.sy || 1)];
}

function drawGizmo() {
  const it = selected();
  if (!it) return;
  const [bx, by] = toScreen(it.w.x, it.w.y);
  const [sx, sy] = toScreen(...pivotWorld());
  const { w, h } = sizeOf(it.e);
  ctx.save();
  ctx.translate(bx, by); ctx.rotate(it.w.rot * R); ctx.scale(cam.zoom * it.w.sx, cam.zoom * it.w.sy);
  ctx.strokeStyle = '#4fa3ff'; ctx.lineWidth = 1.5 / (cam.zoom * Math.abs(it.w.sx || 1)); ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  const tool = state.settings.tool;
  ctx.lineWidth = 2;
  if (tool === 'rect') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#4fa3ff'; ctx.lineWidth = 1.5;
    for (const h of rectHandles(it)) { ctx.fillRect(h.sx - 4, h.sy - 4, 8, 8); ctx.strokeRect(h.sx - 4, h.sy - 4, 8, 8); }
  } else if (tool === 'hand') {
    // Q: view tool, no gizmo
  } else if (tool === 'move') {
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
  for (const id of state.selection.slice(1)) {
    const o = items.find((i) => i.e.id === id);
    if (!o) continue;
    const [ox, oy] = toScreen(o.w.x, o.w.y), { w: ow, h: oh } = sizeOf(o.e);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(o.w.rot * R); ctx.scale(cam.zoom * o.w.sx, cam.zoom * o.w.sy);
    ctx.strokeStyle = '#7fc0ff'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5 / (cam.zoom * Math.abs(o.w.sx || 1)); ctx.strokeRect(-ow / 2, -oh / 2, ow, oh);
    ctx.restore();
  }
  drawGuides();
  drawGizmo();
  if (drag?.kind === 'marquee') {
    ctx.fillStyle = 'rgba(79,163,255,.15)'; ctx.strokeStyle = '#4fa3ff'; ctx.lineWidth = 1;
    ctx.fillRect(drag.sx, drag.sy, drag.x - drag.sx, drag.y - drag.sy); ctx.strokeRect(drag.sx + .5, drag.sy + .5, drag.x - drag.sx, drag.y - drag.sy);
  }
  drawGhost();
  drawRulers();
  const hudEl = document.getElementById('hud');
  const [mx, my] = toWorld(mouse.x, mouse.y);
  hudEl.textContent = `2D · ${Math.round(cam.zoom * 100)}% · ${Math.round(mx)}, ${Math.round(my)} · ${state.settings.tool}${state.settings.snap ? ' · snap' : ''}`;
}

// ---------- Rect tool (T): 8 resize handles on the bounding box, like Godot's canvas_item select mode / Unity's Rect tool ----------
const RECT_H = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function rectHandles(it) {
  const { w, h } = sizeOf(it.e), a = it.w.rot * R, c = Math.cos(a), s = Math.sin(a);
  return RECT_H.map(([hx, hy]) => {
    const lx = hx * w / 2 * it.w.sx, ly = hy * h / 2 * it.w.sy;
    const [sx, sy] = toScreen(it.w.x + lx * c - ly * s, it.w.y + lx * s + ly * c);
    return { hx, hy, sx, sy };
  });
}

// ---------- interaction ----------
function handleAt(sx, sy) {
  const it = selected();
  if (!it) return null;
  const [ox, oy] = toScreen(...pivotWorld());
  const tool = state.settings.tool;
  const d = Math.hypot(sx - ox, sy - oy);
  if (tool === 'hand') return null;
  if (tool === 'rect') {
    for (const h of rectHandles(it)) if (Math.abs(sx - h.sx) <= 7 && Math.abs(sy - h.sy) <= 7) return `r${h.hx},${h.hy}`;
    return null;
  }
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

let ctrlHeld = false; // Unity: hold Ctrl/Cmd to toggle snapping while dragging
const snapTo = (v, step) => ((state.settings.snap !== ctrlHeld) && step > 0 ? Math.round(v / step) * step : v);

function startDrag(kind, it, sx, sy) {
  const e = it.e;
  drag = { kind, id: e.id, sx, sy, t0: JSON.parse(JSON.stringify(e.transform)), w0: { ...it.w }, parentW: it.parentW, moved: false, last: 0 };
  const [wx, wy] = toWorld(sx, sy);
  drag.pivot = pivotWorld();
  drag.a0 = Math.atan2(wy - drag.pivot[1], wx - drag.pivot[0]);
  // every selected object moves/rotates/scales together (the Rect tool resizes only the primary)
  const many = selItems();
  if (many.length > 1 && !(kind[0] === 'r' && kind.includes(','))) {
    drag.group = many.map((i) => ({ id: i.e.id, t0: JSON.parse(JSON.stringify(i.e.transform)), w0: { ...i.w }, parentW: i.parentW }));
  }
  if (kind[0] === 'r' && kind.includes(',')) { [drag.hx, drag.hy] = kind.slice(1).split(',').map(Number); drag.size = sizeOf(e); drag.kind = 'rect'; }
}

function onDown(ev) {
  canvas.focus();
  const r = canvas.getBoundingClientRect();
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  mouse = { x: sx, y: sy };
  if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && (space || ev.altKey || state.settings.tool === 'hand'))) {
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
  const add = ev.shiftKey || ev.ctrlKey || ev.metaKey;
  if (!id) { drag = { kind: 'marquee', sx, sy, x: sx, y: sy, add, base: add ? [...state.selection] : [] }; if (!add) { state.selection = []; send({ t: 'select', id: null, ids: [] }); } draw(); return; }
  if (add) {
    const sel = new Set(state.selection);
    sel.has(id) ? sel.delete(id) : sel.add(id);
    state.selection = [...sel];
  } else if (!state.selection.includes(id)) {
    state.selection = [id];
  } else {
    state.selection = [id, ...state.selection.filter((s) => s !== id)]; // keep the group, make the clicked one primary
  }
  send({ t: 'select', id: state.selection[0] ?? null, ids: state.selection });
  draw();
  const picked = selected();
  if (picked && (state.settings.tool === 'move' || state.settings.tool === 'rect')) startDrag('free', picked, sx, sy);
}

function emit(final) {
  if (drag.group) {
    const list = drag.group.map((g) => items.find((i) => i.e.id === g.id)).filter(Boolean).map((i) => ({ id: i.e.id, pos: i.e.transform.pos, rot: i.e.transform.rot, scale: i.e.transform.scale }));
    send({ t: 'transforms', items: list, final });
    return;
  }
  const it = items.find((i) => i.e.id === drag.id);
  if (!it) return;
  const t = it.e.transform;
  send({ t: 'transform', id: drag.id, pos: t.pos, rot: t.rot, scale: t.scale, final });
}

function onMove(ev) {
  const r = canvas.getBoundingClientRect();
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  mouse = { x: sx, y: sy };
  ctrlHeld = ev.ctrlKey || ev.metaKey;
  if (!drag) { draw(); return; }
  if (drag.kind === 'marquee') { drag.x = sx; drag.y = sy; draw(); return; }
  if (drag.kind === 'guide') { const [wx, wy] = toWorld(sx, sy); drag.value = Math.round(drag.axis === 'x' ? wx : wy); drag.overRuler = drag.axis === 'x' ? sx < RULER : sy < RULER; draw(); return; }
  if (drag.kind === 'pan') {
    cam.x = drag.cx - (sx - drag.sx) / cam.zoom; cam.y = drag.cy - (sy - drag.sy) / cam.zoom; draw(); reportCam(); return;
  }
  if (drag.group && drag.kind !== 'rect') { moveGroup(sx, sy); return; }
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
  } else if (drag.kind === 'rect') {
    // resize about the opposite edge/corner (it stays put in the world): scale = old scale x factor, position follows
    drag.moved = true;
    const { w, h } = drag.size, w0 = drag.w0, s0 = drag.t0.scale, r = w0.rot * R, c = Math.cos(r), sn = Math.sin(r);
    const ddx = wx - w0.x, ddy = wy - w0.y;
    const lx = (ddx * c + ddy * sn) / (w0.sx || 1), ly = (-ddx * sn + ddy * c) / (w0.sy || 1);
    let kx = drag.hx ? Math.max(0.01, drag.hx * (lx + drag.hx * w / 2) / w) : 1, ky = drag.hy ? Math.max(0.01, drag.hy * (ly + drag.hy * h / 2) / h) : 1;
    if (ev.shiftKey && (drag.hx || drag.hy)) { const k = drag.hx && drag.hy ? Math.max(kx, ky) : (drag.hx ? kx : ky); kx = ky = k; }
    const nsx = snapTo(s0[0] * kx, state.settings.snapScale), nsy = snapTo(s0[1] * ky, state.settings.snapScale);
    kx = nsx / s0[0]; ky = nsy / s0[1];
    const fx = -drag.hx * w / 2 * (1 - kx) * w0.sx, fy = -drag.hy * h / 2 * (1 - ky) * w0.sy; // world-space shift of the centre, pre-rotation
    let ox = fx * c - fy * sn, oy = fx * sn + fy * c;
    const p = drag.parentW;
    if (p) { const a = -p.rot * R, pc = Math.cos(a), ps = Math.sin(a); [ox, oy] = [(ox * pc - oy * ps) / (p.sx || 1), (ox * ps + oy * pc) / (p.sy || 1)]; }
    e.transform.scale = [nsx, nsy, s0[2]];
    e.transform.pos = [drag.t0.pos[0] + ox, drag.t0.pos[1] + oy, drag.t0.pos[2]];
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

/** Move / rotate / scale every selected object about the gizmo pivot (multi-select drag). */
function moveGroup(sx, sy) {
  const [wx, wy] = toWorld(sx, sy), [wx0, wy0] = toWorld(drag.sx, drag.sy);
  const [px, py] = drag.pivot;
  if (drag.kind === 'free' || drag.kind === 'x' || drag.kind === 'y') {
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 3) return;
    drag.moved = true;
    let dx = wx - wx0, dy = wy - wy0;
    if (drag.kind === 'x') dy = 0;
    if (drag.kind === 'y') dx = 0;
    dx = snapTo(dx, state.settings.snapMove); dy = snapTo(dy, state.settings.snapMove);
    for (const g of drag.group) {
      const it = items.find((i) => i.e.id === g.id);
      if (!it) continue;
      const [lx, ly] = toLocalPos(g.parentW, g.w0.x + dx, g.w0.y + dy);
      it.e.transform.pos = [lx, ly, g.t0.pos[2]];
    }
  } else if (drag.kind === 'rot') {
    drag.moved = true;
    const a = Math.atan2(wy - py, wx - px);
    const da = snapTo((a - drag.a0) / R, state.settings.snapRot), c = Math.cos(da * R), s = Math.sin(da * R);
    for (const g of drag.group) {
      const it = items.find((i) => i.e.id === g.id);
      if (!it) continue;
      const vx = g.w0.x - px, vy = g.w0.y - py;
      const [lx, ly] = toLocalPos(g.parentW, px + vx * c - vy * s, py + vx * s + vy * c);
      it.e.transform.pos = [lx, ly, g.t0.pos[2]];
      it.e.transform.rot = [g.t0.rot[0], g.t0.rot[1], g.t0.rot[2] + da];
    }
  } else {
    drag.moved = true;
    const k = Math.max(0.01, 1 + ((drag.kind === 'sy' ? sy - drag.sy : sx - drag.sx) / GIZMO));
    const kx = drag.kind === 'sy' ? 1 : k, ky = drag.kind === 'sx' ? 1 : k;
    for (const g of drag.group) {
      const it = items.find((i) => i.e.id === g.id);
      if (!it) continue;
      const [lx, ly] = toLocalPos(g.parentW, px + (g.w0.x - px) * kx, py + (g.w0.y - py) * ky);
      it.e.transform.pos = [lx, ly, g.t0.pos[2]];
      const s0 = g.t0.scale;
      it.e.transform.scale = [snapTo(s0[0] * kx, state.settings.snapScale), snapTo(s0[1] * ky, state.settings.snapScale), s0[2]];
    }
  }
  rebuild(); draw();
  const now = performance.now();
  if (now - drag.last > 50) { drag.last = now; emit(false); }
}

function onUp() {
  if (drag?.kind === 'marquee') {
    const m = drag; drag = null;
    if (Math.hypot(m.x - m.sx, m.y - m.sy) > 3) {
      const [ax, ay] = toWorld(Math.min(m.sx, m.x), Math.min(m.sy, m.y)), [bx, by] = toWorld(Math.max(m.sx, m.x), Math.max(m.sy, m.y));
      const hit = items.filter((i) => !i.locked && i.w.x >= ax && i.w.x <= bx && i.w.y >= ay && i.w.y <= by).map((i) => i.e.id);
      state.selection = [...new Set([...m.base, ...hit])];
      send({ t: 'select', id: state.selection[0] ?? null, ids: state.selection });
    }
    draw(); return;
  }
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

// Drag an asset from the Assets panel over the Scene view: ghost preview, then drop = new entity at that spot.
let ghost = null;
const IMG = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
export function dropPreview(m) {
  ghost = m.off ? null : { x: m.x, y: m.y, path: m.path };
  draw();
}
export function dropAsset(m) {
  ghost = null;
  const [wx, wy] = toWorld(m.x, m.y);
  const onto = pickAt(m.x, m.y); // dropped on an object: set its sprite/model/audio/script instead of spawning a new one
  if (onto && !/\.(prefab|scene)\.json$/i.test(m.path)) { send({ t: 'addAsset', path: m.path, onto }); draw(); return; }
  send({ t: 'addAsset', path: m.path, pos: [snapTo(wx, state.settings.snapMove), snapTo(wy, state.settings.snapMove), 0] });
  draw();
}
function drawGhost() {
  if (!ghost) return;
  ctx.save(); ctx.globalAlpha = 0.6;
  if (IMG.test(ghost.path)) {
    const r = getImage(ghost.path);
    if (r.ok) { const w = r.img.naturalWidth * cam.zoom, h = r.img.naturalHeight * cam.zoom; ctx.drawImage(r.img, ghost.x - w / 2, ghost.y - h / 2, w, h); ctx.restore(); return; }
  }
  ctx.strokeStyle = '#4fa3ff'; ctx.setLineDash([4, 3]); ctx.strokeRect(ghost.x - 16, ghost.y - 16, 32, 32);
  ctx.beginPath(); ctx.moveTo(ghost.x - 8, ghost.y); ctx.lineTo(ghost.x + 8, ghost.y); ctx.moveTo(ghost.x, ghost.y - 8); ctx.lineTo(ghost.x, ghost.y + 8); ctx.stroke();
  ctx.restore();
}
export function setSettings() { draw(); }
export function focus(all) {
  if (all || !selected()) {
    if (!items.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of items) { const { w, h } = sizeOf(i.e); const rx = (w * i.w.sx) / 2, ry = (h * i.w.sy) / 2; x0 = Math.min(x0, i.w.x - rx); x1 = Math.max(x1, i.w.x + rx); y0 = Math.min(y0, i.w.y - ry); y1 = Math.max(y1, i.w.y + ry); }
    cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
    cam.zoom = Math.min(8, Math.max(0.05, Math.min(W / Math.max(x1 - x0, 16), H / Math.max(y1 - y0, 16)) * 0.85));
    draw(); reportCam(); return;
  }
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
