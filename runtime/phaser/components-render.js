// Phaser components for Unity's line and shape renderers: lineRenderer, trailRenderer, spriteMask (+ `maskInteraction` on sprites) and spriteShape.
//   { "type": "lineRenderer", "points": [[0,0,0],[100,0,0],[100,60,0]], "startWidth": 8, "endWidth": 2, "startColor": "#ffd166", "endColor": "#ef476f", "cornerVertices": 4, "capVertices": 4 }
//   { "type": "trailRenderer", "time": 0.6, "startWidth": 10, "endWidth": 0, "startColor": "#ffffff", "endColor": "#ffffff00" }
//   { "type": "spriteMask", "shape": "circle", "radius": 40 }        + on a sprite: "maskInteraction": "visibleInsideMask"
//   { "type": "spriteShape", "points": [[-80,0],[0,-60],[80,0],[0,40]], "closed": true, "smooth": true, "fillColor": "#3a5f2c", "edgeColor": "#7bc043", "edgeWidth": 6 }
// Lines / trails are drawn as quad strips (runtime/core/strip.js) with Phaser Graphics. Masks are composited on a canvas (Phaser 4 mask filters cannot use hidden mask objects).
import { registerComponent } from '../core/index.js';
import { strip, widthAt, colorAt, parseColor, toInt, smooth } from '../core/strip.js';
import { triangulate } from '../core/geometry.js';

const D2R = Math.PI / 180;

export function registerRenderComponents(backend, track) {
  const ps = backend.scene;
  const pose = (e) => backend.world(e);
  /** world → the entity container's local space (translation, rotation, scale of the entity). */
  const toLocal = (w, x, y) => { const c = Math.cos(-w.angle * D2R), s = Math.sin(-w.angle * D2R), dx = x - w.x, dy = y - w.y; return [(dx * c - dy * s) / (w.sx || 1), (dx * s + dy * c) / (w.sy || 1)]; };

  /** Draw a strip with a Graphics object: per segment two gradient triangles, optional round joins and caps. */
  function drawStrip(g, pts, d, clear = true) {
    if (clear) g.clear();
    if (pts.length < 2) return;
    const loop = !!d.loop, s = strip(pts, { widthOf: (t) => widthAt(d, t), loop });
    const seg = loop ? pts.length : pts.length - 1;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % pts.length, ca = colorAt(d, s.t[i]), cb = colorAt(d, loop && j === 0 ? 1 : s.t[j]), A = s.left[i], B = s.right[i], C = s.left[j], D = s.right[j];
      const a = (ca[3] + cb[3]) / 2;
      if (a <= 0.003) continue;
      g.fillGradientStyle(toInt(ca), toInt(ca), toInt(cb), toInt(cb), a, a, a, a);
      g.fillTriangle(A[0], A[1], B[0], B[1], C[0], C[1]);
      g.fillGradientStyle(toInt(ca), toInt(cb), toInt(cb), toInt(cb), a, a, a, a);
      g.fillTriangle(B[0], B[1], D[0], D[1], C[0], C[1]);
    }
    const round = (p, t) => { const c = colorAt(d, t), w = widthAt(d, t) / 2; if (c[3] > 0.003 && w > 0.2) { g.fillStyle(toInt(c), c[3]); g.fillCircle(p[0], p[1], w); } };
    if ((d.cornerVertices ?? 0) > 0) for (let i = 1; i < pts.length - 1; i++) round(pts[i], s.t[i]);
    if ((d.capVertices ?? 0) > 0 && !loop) { round(pts[0], 0); round(pts.at(-1), 1); }
  }
  const blendOf = { normal: 0, add: 1, multiply: 2, screen: 3 };

  // ---------------------------------------------------------------- lineRenderer
  registerComponent('lineRenderer', {
    create(e, d, comp) {
      comp.g = ps.add.graphics(); if (d.blend) comp.g.setBlendMode(blendOf[d.blend] ?? 0);
      e.native.add(comp.g); track(comp, comp.g);
      comp.dirty = true; comp.last = '';
    },
    update(comp) {
      const d = comp.data, e = comp.entity;
      const world = d.useWorldSpace !== false && !!d.useWorldSpace; // default: points are in the object's own space (set useWorldSpace: true for Unity's default)
      const w = world ? pose(e) : null, key = world ? `${w.x},${w.y},${w.angle},${w.sx},${w.sy}` : '';
      if (!comp.dirty && key === comp.last) return;
      comp.dirty = false; comp.last = key;
      const pts = (d.points ?? []).map((p) => (world ? [...toLocal(w, p[0], p[1]), 0] : [p[0], p[1], p[2] ?? 0]));
      drawStrip(comp.g, pts, d);
      comp.positionCount = pts.length;
    },
    set(comp, k, v) { comp.data[k] = v; comp.dirty = true; if (k === 'blend') comp.g.setBlendMode(blendOf[v] ?? 0); },
    destroy(comp) { comp.g?.destroy(); },
  });

  // ---------------------------------------------------------------- trailRenderer
  registerComponent('trailRenderer', {
    create(e, d, comp) {
      comp.g = ps.add.graphics(); if (d.blend) comp.g.setBlendMode(blendOf[d.blend] ?? 0);
      e.native.add(comp.g); track(comp, comp.g);
      comp.pts = []; comp.emitting = d.emitting !== false;
      comp.clear = () => { comp.pts.length = 0; comp.g.clear(); };
      comp.add = (x, y) => { comp.pts.push({ x, y, age: 0 }); };
      Object.defineProperty(comp, 'positionCount', { get: () => comp.pts.length });
    },
    update(comp, dt) {
      const d = comp.data, e = comp.entity, life = Math.max(d.time ?? 1, 0.01), minDist = d.minVertexDistance ?? 4;
      for (const p of comp.pts) p.age += dt;
      while (comp.pts.length && comp.pts[0].age > life) comp.pts.shift();
      const w = pose(e);
      if (comp.emitting && e.enabled) {
        const last = comp.pts.at(-1);
        if (!last || Math.hypot(w.x - last.x, w.y - last.y) >= minDist) comp.pts.push({ x: w.x, y: w.y, age: 0 });
        else { last.x = w.x; last.y = w.y; } // the newest point keeps following the object until it has moved far enough
      }
      if (!comp.pts.length) { comp.g.clear(); if (d.autodestruct && !comp.emitting) e.destroy(); return; }
      // newest point first: position 0 is the head (t = 0 → startWidth / startColor), the oldest is the tail (t = 1)
      const pts = [...comp.pts].reverse().map((p) => [...toLocal(w, p.x, p.y), 0]);
      drawStrip(comp.g, pts, { ...d, widthMultiplier: d.widthMultiplier ?? 1 });
      // fade by age too: points fade out at the end of their life
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'emitting') comp.emitting = !!v; },
    destroy(comp) { comp.g?.destroy(); },
  });

  // ---------------------------------------------------------------- spriteMask
  const masks = new Set(), masked = new Map(); // mask components · visual → { comp, view, canvas, tex }
  registerComponent('spriteMask', {
    create(e, d, comp) { masks.add(comp); },
    destroy(comp) { masks.delete(comp); },
    set(comp, k, v) { comp.data[k] = v; },
  });
  /** Called by sprite / animatedSprite when `maskInteraction` is set: the real visual is hidden and its masked copy is drawn instead. */
  backend.maskVisual = (comp, visual) => {
    if (masked.has(visual)) return;
    masked.set(visual, { comp, visual, view: null, key: `nord-mask-${visual.__nordMaskId ??= Math.random().toString(36).slice(2)}`, last: '' });
  };
  const frameOf = (v) => v.frame;
  backend.updateMasks = () => {
    for (const [visual, m] of masked) {
      const comp = m.comp, e = comp.entity;
      if (!visual.scene || e.destroyed) { m.view?.destroy(); if (ps.textures.exists(m.key)) ps.textures.remove(m.key); masked.delete(visual); continue; }
      const mode = comp.data.maskInteraction ?? 'none';
      if (mode === 'none' || !masks.size) { visual.setVisible(true); m.view?.setVisible(false); continue; }
      const f = frameOf(visual), src = f.source.image, bounds = visual.getBounds(), M = visual.getWorldTransformMatrix();
      const bw = Math.max(1, Math.ceil(bounds.width)), bh = Math.max(1, Math.ceil(bounds.height));
      const sig = `${bw}x${bh}|${M.a.toFixed(3)},${M.b.toFixed(3)},${M.c.toFixed(3)},${M.d.toFixed(3)},${M.tx.toFixed(1)},${M.ty.toFixed(1)}|${f.name}|${visual.tintTopLeft}|${visual.alpha}|${[...masks].map((k) => { const p = pose(k.entity); return `${k.entity.enabled}${p.x.toFixed(1)}${p.y.toFixed(1)}${p.angle}${JSON.stringify(k.data)}`; }).join(';')}`;
      if (sig === m.last && m.view) continue;
      m.last = sig;
      if (!m.canvas || m.canvas.width !== bw || m.canvas.height !== bh) { m.canvas = document.createElement('canvas'); m.canvas.width = bw; m.canvas.height = bh; if (ps.textures.exists(m.key)) ps.textures.remove(m.key); m.tex = ps.textures.addCanvas(m.key, m.canvas); m.view?.destroy(); m.view = null; }
      const ctx = m.canvas.getContext('2d'); ctx.clearRect(0, 0, bw, bh); ctx.save();
      ctx.translate(-bounds.x, -bounds.y); ctx.transform(M.a, M.b, M.c, M.d, M.tx, M.ty);
      ctx.globalAlpha = visual.alpha;
      const sx = visual.flipX ? -1 : 1, sy = visual.flipY ? -1 : 1, dw = f.cutWidth, dh = f.cutHeight, ox = visual.displayOriginX ?? dw / 2, oy = visual.displayOriginY ?? dh / 2;
      ctx.scale(sx, sy); ctx.drawImage(src, f.cutX, f.cutY, dw, dh, -ox * sx, -oy * sy, dw, dh);
      ctx.restore();
      // the union of the masks, painted in world space on a second canvas and applied with destination-in / destination-out
      const mc = document.createElement('canvas'); mc.width = bw; mc.height = bh; const mx = mc.getContext('2d');
      mx.translate(-bounds.x, -bounds.y);
      for (const k of masks) {
        if (!k.entity.enabled) continue;
        const p = pose(k.entity), d = k.data, r = (d.rotation ?? 0) * D2R;
        mx.save(); mx.translate(p.x, p.y); mx.rotate(p.angle * D2R + r); mx.scale(p.sx, p.sy); mx.fillStyle = '#fff';
        const shape = d.shape ?? 'rect', [sw, sh] = d.size ?? [64, 64];
        if (shape === 'circle') { mx.beginPath(); mx.arc(d.offset?.[0] ?? 0, d.offset?.[1] ?? 0, d.radius ?? 32, 0, Math.PI * 2); mx.fill(); }
        else if (shape === 'texture' && d.texture && ps.textures.exists(backend.texKey(d.texture))) { const im = ps.textures.get(backend.texKey(d.texture)).getSourceImage(); mx.drawImage(im, -im.width / 2 + (d.offset?.[0] ?? 0), -im.height / 2 + (d.offset?.[1] ?? 0)); }
        else mx.fillRect(-sw / 2 + (d.offset?.[0] ?? 0), -sh / 2 + (d.offset?.[1] ?? 0), sw, sh);
        mx.restore();
      }
      ctx.globalCompositeOperation = mode === 'visibleOutsideMask' ? 'destination-out' : 'destination-in';
      ctx.drawImage(mc, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      m.tex.refresh();
      if (!m.view) { m.view = ps.add.image(0, 0, m.key); backend.visuals.add(m.view); }
      m.view.setPosition(bounds.centerX, bounds.centerY).setDepth(visual.depth).setVisible(true).setScrollFactor(visual.scrollFactorX, visual.scrollFactorY);
      m.view.setLighting?.(false);
      visual.setVisible(false);
    }
  };

  // ---------------------------------------------------------------- spriteShape
  registerComponent('spriteShape', {
    create(e, d, comp) {
      comp.g = ps.add.graphics(); e.native.add(comp.g); track(comp, comp.g);
      comp.dirty = true;
    },
    update(comp) {
      if (!comp.dirty) return;
      comp.dirty = false;
      const d = comp.data, g = comp.g, closed = d.closed !== false;
      let pts = (d.points?.length ? d.points : [[-60, 30], [0, -40], [60, 30]]).map((p) => [p[0], p[1], 0]);
      if (d.smooth) pts = smooth(pts, d.splineDetail ?? 8, closed);
      comp.outline = pts;
      g.clear();
      if (closed && pts.length >= 3 && (d.fillColor || d.fillAlpha != null)) {
        const [r, gg, b, a] = parseColor(d.fillColor ?? '#3a5f2c'); g.fillStyle(toInt([r, gg, b]), a * (d.fillAlpha ?? 1));
        for (const t of triangulate(pts.map((p) => [p[0], p[1]]))) g.fillPoints(t.map((p) => ({ x: p[0], y: p[1] })), true);
      }
      if ((d.edgeWidth ?? 0) > 0) drawStrip(g, closed ? [...pts, pts[0]] : pts, { startWidth: d.edgeWidth, endWidth: d.edgeWidth, startColor: d.edgeColor ?? '#7bc043', endColor: d.edgeColor ?? '#7bc043', cornerVertices: 2, capVertices: closed ? 0 : 2, alpha: 1 }, false);
      if (d.generateCollider && !comp.entity.getComponent('collider')) { // Unity's "update collider": a polygon (closed) or edge (open) collider that follows the outline
        comp.entity.addComponent('collider', { shape: closed ? 'polygon' : 'edge', points: pts.map((p) => [p[0], p[1]]), usedByComposite: false });
        comp.madeCollider = true;
      } else if (comp.madeCollider) comp.entity.set('collider', 'points', pts.map((p) => [p[0], p[1]]));
    },
    set(comp, k, v) { comp.data[k] = v; comp.dirty = true; },
    destroy(comp) { comp.g?.destroy(); },
  });
}
