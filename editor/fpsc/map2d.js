// Top-down 2D map: draws the level (floors with their real textures, walls/doors/windows by kind, entities, zones, paths) and answers pick queries.
import { CELL, STORY, unkey, ekey } from '/runtime/fpsc/level.js';
import { paintTexture } from '/runtime/fpsc/bank/textures.js';

const cache = { cv: new Map(), avg: new Map() };
export function texCanvas(bank, id, size = 64) {
  const k = `${id}@${size}`; let c = cache.cv.get(k);
  if (!c) {
    const def = bank.texture(id);
    if (!def) { c = Object.assign(document.createElement('canvas'), { width: size, height: size }); const g = c.getContext('2d'); g.fillStyle = '#f0f'; g.fillRect(0, 0, size, size); }
    else if (def.url) { c = Object.assign(document.createElement('canvas'), { width: size, height: size }); const im = new Image(); im.onload = () => { c.getContext('2d').drawImage(im, 0, 0, size, size); cache.avg.delete(id); cache.redraw?.(); }; im.src = def.url; }
    else c = paintTexture(def, size);
    cache.cv.set(k, c);
  }
  return c;
}
export const onTexReady = (fn) => { cache.redraw = fn; };
export function texAvg(bank, id) {
  let a = cache.avg.get(id); if (a) return a;
  const c = texCanvas(bank, id, 16), d = c.getContext('2d').getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  a = n ? [r / n | 0, g / n | 0, b / n | 0] : [128, 128, 128]; cache.avg.set(id, a); return a;
}
const rgb = (a, k = 1, al = 1) => `rgba(${Math.min(255, a[0] * k | 0)},${Math.min(255, a[1] * k | 0)},${Math.min(255, a[2] * k | 0)},${al})`;
export const KEYCOL = { red: '#ff4040', blue: '#4aa0ff', yellow: '#ffe040', green: '#50ff70' };

/** What an edge piece looks like from above: wall | window | door | gap | low | fence | glass. */
export function classify(def) {
  if (!def) return 'wall';
  if (def.door) return 'door';
  const solidFull = def.parts.some((p) => p.solid !== false && p.u[0] <= 0.05 && p.u[1] >= 0.95 && (p.y[1] === 'H' || p.y[1] >= 2.5));
  if (def.parts.some((p) => p.mat === 'mesh')) return 'fence';
  if (def.parts.some((p) => p.mat === 'glass' && p.u[1] - p.u[0] > 0.9 && p.y[1] > 3)) return 'glass';
  if (def.parts.some((p) => p.mat === 'glass')) return 'window';
  if (!solidFull && def.parts.every((p) => (p.y[1] === 'H' ? 3.2 : p.y[1]) <= 1.5)) return 'low';
  if (!def.parts.some((p) => p.solid !== false && p.u[0] < 0.3 && p.u[1] > 0.7 && (p.y[0] < 1))) return 'gap';
  return 'wall';
}

export class Map2D {
  constructor(canvas, ed) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ed = ed; this.zoom = 9; this.cx = 20 * CELL / 2; this.cz = 20 * CELL / 2; this.w = 100; this.h = 100; this.pats = new Map();
    onTexReady(() => { this.pats.clear(); this.draw(); });
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement); this.resize();
  }
  resize() { const r = this.cv.parentElement.getBoundingClientRect(), d = window.devicePixelRatio || 1; this.w = Math.max(10, r.width); this.h = Math.max(10, r.height); this.cv.width = this.w * d; this.cv.height = this.h * d; this.dpr = d; this.draw(); }
  toScreen(x, z) { return [(x - this.cx) * this.zoom + this.w / 2, this.h / 2 - (z - this.cz) * this.zoom]; }
  toWorld(px, py) { return [(px - this.w / 2) / this.zoom + this.cx, (this.h / 2 - py) / this.zoom + this.cz]; }
  pan(dx, dy) { this.cx -= dx / this.zoom; this.cz += dy / this.zoom; }
  zoomAt(px, py, f) { const [wx, wz] = this.toWorld(px, py); this.zoom = Math.max(2, Math.min(60, this.zoom * f)); const [nx, nz] = this.toWorld(px, py); this.cx += wx - nx; this.cz += wz - nz; }
  fit(lv) { const b = this.ed.contentBounds(); if (!b) { this.cx = lv.w * CELL / 2; this.cz = lv.d * CELL / 2; this.zoom = Math.min(this.w / (lv.w * CELL), this.h / (lv.d * CELL)) * 0.9; return; } const w = (b[2] - b[0] + 3) * CELL, d = (b[3] - b[1] + 3) * CELL; this.cx = (b[0] + b[2] + 1) * CELL / 2; this.cz = (b[1] + b[3] + 1) * CELL / 2; this.zoom = Math.max(3, Math.min(30, Math.min(this.w / w, this.h / d))); }

  // ---- picking -------------------------------------------------------------------------------------------------------------
  /** nearest cell edge to world point within tol cells; returns { x, z, o, key } */
  pickEdge(wx, wz, tol = 0.28) {
    const u = wx / CELL, v = wz / CELL, ru = Math.round(u), rv = Math.round(v), du = Math.abs(u - ru), dv = Math.abs(v - rv);
    if (Math.min(du, dv) > tol) return null;
    if (du <= dv) { const z = Math.floor(v); return { x: ru, z, o: 'V', key: ekey(ru, z, 'V') }; }
    const x = Math.floor(u); return { x, z: rv, o: 'H', key: ekey(x, rv, 'H') };
  }
  pickEntity(wx, wz, layer = null) {
    const lv = this.ed.level; let best = null, bd = 1e9;
    for (const e of lv.entities) {
      if (layer !== null && e.layer !== layer) continue;
      const def = this.ed.bank.entity(e.type), z = this.zoneOf(e, def);
      let d;
      if (z) { const inside = Math.abs(wx - e.x) <= z.w / 2 && Math.abs(wz - e.z) <= z.d / 2; d = inside ? 0.6 + Math.hypot(wx - e.x, wz - e.z) * 0.01 : 1e9; }
      else d = Math.hypot(wx - e.x, wz - e.z);
      const r = Math.max(0.55, 9 / this.zoom);
      if (d <= r && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  zoneOf(e, def) { if (!def?.zone) return null; return { w: +e.props?.w || def.props?.w?.default || 4, d: +e.props?.d || def.props?.d?.default || 4 }; }

  // ---- drawing -------------------------------------------------------------------------------------------------------------
  pattern(id) {
    const k = `${id}@${this.zoom.toFixed(2)}`; let p = this.pats.get(k); if (p) return p;
    const c = texCanvas(this.ed.bank, id, 64), size = this.ed.bank.texture(id)?.size ?? 2;
    p = this.ctx.createPattern(c, 'repeat'); const s = size * this.zoom * this.dpr / 64; p.setTransform?.(new DOMMatrix().scale(s)); this.pats.set(k, p); return p;
  }
  draw() {
    const ed = this.ed, lv = ed.level, c = this.ctx, d = this.dpr, Z = this.zoom;
    if (!lv) return;
    c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#141414'; c.fillRect(0, 0, this.w, this.h);
    const [ox, oy] = this.toScreen(0, 0), [ex, ey] = this.toScreen(lv.w * CELL, lv.d * CELL);
    c.fillStyle = '#1b1d22'; c.fillRect(ox, ey, ex - ox, oy - ey);
    // grid
    c.lineWidth = 1; const step = CELL * Z;
    if (Z >= 3) { c.strokeStyle = '#262a32'; c.beginPath(); for (let x = 0; x <= lv.w; x++) { const sx = ox + x * step; c.moveTo(sx, ey); c.lineTo(sx, oy); } for (let z = 0; z <= lv.d; z++) { const sy = oy - z * step; c.moveTo(ox, sy); c.lineTo(ex, sy); } c.stroke(); }
    c.strokeStyle = '#3b4252'; c.strokeRect(ox, ey, ex - ox, oy - ey);
    // layers: other layers faded under/over the active one
    const L = ed.layer; const order = lv.layers.map((_, i) => i).filter((i) => i !== L); if (!ed.ghost) order.length = 0;
    for (const i of order) this.drawLayer(i, 0.22);
    this.drawLayer(L, 1);
    for (const i of order) this.drawEntities(i, 0.25);
    this.drawEntities(L, 1);
    this.drawOverlay();
  }
  drawLayer(L, alpha) {
    const ed = this.ed, lv = ed.level, c = this.ctx, Z = this.zoom, ly = lv.layers[L]; if (!ly) return;
    c.save(); c.globalAlpha = alpha;
    for (const [k, cell] of Object.entries(ly.cells)) {
      const [cx, cz] = unkey(k), [sx, sy] = this.toScreen(cx * CELL, (cz + 1) * CELL), s = CELL * Z;
      if (cell.f) { c.fillStyle = this.pattern(cell.f); c.save(); c.translate(0, 0); c.fillRect(sx, sy, s, s); c.restore(); } else { c.fillStyle = '#0c0c0c'; c.fillRect(sx, sy, s, s); c.strokeStyle = '#a33'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + s, sy + s); c.moveTo(sx + s, sy); c.lineTo(sx, sy + s); c.stroke(); }
      if (cell.h) { c.fillStyle = cell.h > 0 ? `rgba(255,255,255,${Math.min(0.35, cell.h * 0.2)})` : `rgba(0,0,0,${Math.min(0.55, -cell.h * 0.3)})`; c.fillRect(sx, sy, s, s); if (Z > 6) { c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.fillText(`${cell.h > 0 ? '+' : ''}${cell.h}`, sx + 3, sy + 11); } }
      if (cell.s) { const dir = cell.s.d || 'N', ang = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[dir]; c.save(); c.translate(sx + s / 2, sy + s / 2); c.rotate(ang); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-s * 0.4, i * s * 0.12); c.lineTo(s * 0.4, i * s * 0.12); c.stroke(); } c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(0, -s * 0.42); c.lineTo(-s * 0.18, -s * 0.14); c.lineTo(s * 0.18, -s * 0.14); c.fill(); c.restore(); }
      if (cell.p) { c.fillStyle = rgb(texAvg(ed.bank, cell.pt || 'concrete')); c.fillRect(sx + s * 0.3, sy + s * 0.3, s * 0.4, s * 0.4); c.strokeStyle = '#000'; c.strokeRect(sx + s * 0.3, sy + s * 0.3, s * 0.4, s * 0.4); }
      if (cell.c === undefined && cell.f && alpha === 1 && Z > 5) { c.fillStyle = 'rgba(80,160,255,.35)'; c.fillRect(sx + 2, sy + 2, 4, 4); } // no ceiling marker
    }
    for (const [k, piece] of Object.entries(ly.edges)) this.drawEdge(k, piece, alpha);
    c.restore();
  }
  edgeEnds(x, z, o) { const a = this.toScreen(x * CELL, z * CELL), b = o === 'H' ? this.toScreen((x + 1) * CELL, z * CELL) : this.toScreen(x * CELL, (z + 1) * CELL); return [a, b]; }
  drawEdge(k, piece, alpha, color = null, hl = false) {
    const ed = this.ed, c = this.ctx, Z = this.zoom, [x, z, o] = unkey(k), def = ed.bank.piece(piece.k), kind = classify(def), [a, b] = this.edgeEnds(x, z, o);
    const col = texAvg(ed.bank, piece.t || 'concrete'), th = Math.max(3, 0.34 * Z);
    const lerp = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], seg = (t0, t1, style, w) => { const p = lerp(t0), q = lerp(t1); c.strokeStyle = style; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
    c.lineCap = 'butt';
    if (hl) seg(0, 1, '#ffd23a', th + 4);
    const base = color ?? rgb(col, 1.05);
    if (kind === 'wall') seg(0, 1, base, th);
    else if (kind === 'window') { seg(0, 1, base, th); seg(0.22, 0.78, '#7fd3ff', th * 0.45); }
    else if (kind === 'glass') { seg(0, 1, 'rgba(130,210,255,.9)', th * 0.5); }
    else if (kind === 'door') { seg(0, 0.18, base, th); seg(0.82, 1, base, th); const dc = texAvg(ed.bank, piece.td || 'door_metal'); seg(0.18, 0.82, rgb(dc, 1.1), th * 0.75); seg(0.18, 0.82, '#e0c060', 1); if (piece.lock) { const m = lerp(0.5); c.fillStyle = KEYCOL[piece.lock] ?? '#fff'; c.beginPath(); c.arc(m[0], m[1], Math.max(3, Z * 0.3), 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); } if (def?.door?.secret) seg(0.18, 0.82, 'rgba(255,255,255,.35)', 1); }
    else if (kind === 'gap') { seg(0, 0.18, base, th); seg(0.82, 1, base, th); seg(0.18, 0.82, 'rgba(255,255,255,.18)', 1); }
    else if (kind === 'fence') { c.setLineDash([3, 3]); seg(0, 1, '#9aa0a6', Math.max(2, th * 0.5)); c.setLineDash([]); }
    else if (kind === 'low') { c.setLineDash([6, 3]); seg(0, 1, base, th * 0.7); c.setLineDash([]); }
    if (def?.door && piece.name && Z > 6) { const m = lerp(0.5); c.fillStyle = '#ffd23a'; c.font = '10px sans-serif'; c.fillText(piece.name, m[0] + 4, m[1] - 6); }
  }
  drawEntities(L, alpha) {
    const ed = this.ed, lv = ed.level, c = this.ctx, Z = this.zoom;
    c.save(); c.globalAlpha = alpha;
    for (const e of lv.entities) {
      if (e.layer !== L) continue;
      const def = ed.bank.entity(e.type), [sx, sy] = this.toScreen(e.x, e.z), col = def?.color ?? '#f0f', sel = ed.isSelEnt(e.id);
      const zone = this.zoneOf(e, def);
      if (zone) { const [x0, y0] = this.toScreen(e.x - zone.w / 2, e.z + zone.d / 2), w = zone.w * Z, h = zone.d * Z; c.fillStyle = `${col}33`; c.fillRect(x0, y0, w, h); c.strokeStyle = sel ? '#ffd23a' : col; c.setLineDash([5, 3]); c.lineWidth = sel ? 2 : 1; c.strokeRect(x0, y0, w, h); c.setLineDash([]); }
      if (def?.light && (ed.showLights || sel)) { const r = (+e.props?.range || def.light.range) * Z; c.strokeStyle = `${def.light.color}66`; c.fillStyle = `${def.light.color}14`; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); c.stroke(); }
      if (e.path?.length) { c.strokeStyle = `${col}aa`; c.setLineDash([4, 3]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, sy); for (const p of e.path) { const q = this.toScreen(p[0], p[1]); c.lineTo(q[0], q[1]); } c.stroke(); c.setLineDash([]); e.path.forEach((p, i) => { const q = this.toScreen(p[0], p[1]); c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], 4, 0, 7); c.fill(); c.fillStyle = '#000'; c.font = '9px sans-serif'; c.fillText(i + 1, q[0] - 2.5, q[1] + 3); }); }
      const r = Math.max(7, (def?.radius ?? 0.4) * Z * 1.1);
      c.fillStyle = col; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); c.lineWidth = sel ? 3 : 1.2; c.strokeStyle = sel ? '#ffd23a' : '#000'; c.stroke();
      if (def && (def.enemy || e.type === 'player_start' || def.cat === 'Allies' || e.type === 'enemy_turret')) { const a = (e.rot || 0) * Math.PI / 180; c.fillStyle = '#111'; c.beginPath(); c.moveTo(sx + Math.sin(a) * (r + 5), sy - Math.cos(a) * (r + 5)); c.lineTo(sx + Math.sin(a + 2.5) * r * 0.8, sy - Math.cos(a + 2.5) * r * 0.8); c.lineTo(sx + Math.sin(a - 2.5) * r * 0.8, sy - Math.cos(a - 2.5) * r * 0.8); c.fill(); }
      c.fillStyle = '#111'; c.font = `bold ${Math.max(9, r * 1.1)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(def?.glyph ?? '?', sx, sy + 0.5); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      if ((e.name || (e.scripts?.length) || e.rules?.length) && Z > 5) { c.fillStyle = '#e8eefc'; c.font = '10px sans-serif'; const tag = `${e.name || ''}${e.rules?.length ? ' ⚡' : ''}${e.scripts?.length ? ' ƒ' : ''}`; c.fillText(tag, sx + r + 3, sy + 3); }
    }
    c.restore();
  }
  drawOverlay() {
    const ed = this.ed, c = this.ctx, Z = this.zoom, pv = ed.preview;
    // selection of cells / edges
    for (const k of ed.sel.edges) { const piece = ed.level.layers[ed.layer]?.edges[k]; if (piece) this.drawEdge(k, piece, 1, null, true); }
    for (const k of ed.sel.cells) { const [cx, cz] = unkey(k), [sx, sy] = this.toScreen(cx * CELL, (cz + 1) * CELL), s = CELL * Z; c.strokeStyle = '#ffd23a'; c.lineWidth = 2; c.setLineDash([5, 3]); c.strokeRect(sx + 1, sy + 1, s - 2, s - 2); c.setLineDash([]); }
    if (!pv) return;
    c.save(); c.globalAlpha = 0.85;
    for (const k of pv.edges ?? []) { const piece = pv.piece ?? { k: 'wall', t: 'concrete' }; this.drawEdge(k, pv.erase ? { k: 'wall', t: 'concrete' } : piece, 1, pv.erase ? 'rgba(255,70,70,.9)' : null); }
    if (pv.cells) for (const [cx, cz] of pv.cells) { const [sx, sy] = this.toScreen(cx * CELL, (cz + 1) * CELL), s = CELL * Z; c.fillStyle = pv.erase ? 'rgba(255,70,70,.3)' : 'rgba(76,141,255,.3)'; c.fillRect(sx, sy, s, s); }
    if (pv.rect) { const [x0, z0, x1, z1] = pv.rect, [sx, sy] = this.toScreen(x0 * CELL, (z1 + 1) * CELL), w = (x1 - x0 + 1) * CELL * Z, h = (z1 - z0 + 1) * CELL * Z; c.fillStyle = pv.erase ? 'rgba(255,70,70,.18)' : 'rgba(76,141,255,.18)'; c.fillRect(sx, sy, w, h); c.strokeStyle = pv.erase ? '#ff5a5a' : '#4c8dff'; c.lineWidth = 2; c.strokeRect(sx, sy, w, h); }
    if (pv.box) { const [x0, z0, x1, z1] = pv.box, [a, b] = [this.toScreen(Math.min(x0, x1), Math.max(z0, z1)), this.toScreen(Math.max(x0, x1), Math.min(z0, z1))]; c.fillStyle = 'rgba(255,210,58,.12)'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.strokeStyle = '#ffd23a'; c.setLineDash([4, 3]); c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.setLineDash([]); }
    if (pv.ent) { const [sx, sy] = this.toScreen(pv.ent.x, pv.ent.z), def = ed.bank.entity(pv.ent.type), r = Math.max(7, (def?.radius ?? 0.4) * Z * 1.1); c.fillStyle = def?.color ?? '#fff'; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = `bold ${Math.max(9, r)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(def?.glyph ?? '?', sx, sy); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; }
    if (pv.line) { const [a, b] = [this.toScreen(...pv.line[0]), this.toScreen(...pv.line[1])]; c.strokeStyle = '#fff'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); }
    c.restore();
  }
}
export { STORY };
