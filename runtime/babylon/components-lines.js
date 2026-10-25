// Babylon (3D) lineRenderer and trailRenderer: a camera-facing ribbon mesh with per-vertex colour and width (same data as the 2D components, see runtime/phaser/components-render.js).
//   { "type": "lineRenderer", "points": [[0,0,0],[2,1,0],[4,0,1]], "startWidth": 0.2, "endWidth": 0.02, "startColor": "#ffd166", "endColor": "#ef476f", "useWorldSpace": false }
//   { "type": "trailRenderer", "time": 0.8, "startWidth": 0.3, "endWidth": 0, "startColor": "#ffffff", "endColor": "#4cc9f000" }
import { registerComponent } from '../core/index.js';
import { strip, widthAt, colorAt } from '../core/strip.js';

export function registerLineComponents(backend) {
  const B = backend.B, scene = backend.scene;
  const camForward = () => { const c = scene.activeCamera; return c ? c.getForwardRay(1).direction.asArray() : [0, 0, 1]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const material = (name) => { const m = new B.StandardMaterial(name, scene); m.disableLighting = true; m.emissiveColor = B.Color3.White(); m.backFaceCulling = false; return m; };

  /** Rebuild the ribbon (positions, colours, indices) from points `pts` and the component data. */
  function build(mesh, pts, d) {
    if (pts.length < 2) { mesh.setEnabled(false); return; }
    mesh.setEnabled(true);
    const fwd = camForward(), s = strip(pts, { widthOf: (t) => widthAt(d, t), loop: !!d.loop, perp: (dir) => { const p = cross(dir, fwd); return Math.hypot(...p) < 1e-5 ? [0, 1, 0] : unit(p); } });
    const positions = [], colors = [], indices = [];
    pts.forEach((_, i) => {
      const c = colorAt(d, s.t[i]);
      positions.push(...s.left[i], ...s.right[i]); colors.push(...c, ...c);
      if (i > 0) { const a = (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    if (d.loop) { const a = (pts.length - 1) * 2; indices.push(a, a + 1, 0, a + 1, 1, 0); }
    const vd = new B.VertexData(); vd.positions = positions; vd.indices = indices; vd.colors = colors;
    const normals = []; B.VertexData.ComputeNormals(positions, indices, normals); vd.normals = normals;
    vd.applyToMesh(mesh, true); mesh.hasVertexAlpha = true;
  }

  registerComponent('lineRenderer', {
    create(e, d, comp) {
      comp.mesh = new B.Mesh(`${e.name}.line`, scene); comp.mesh.material = material(`${e.name}.lineMat`); comp.mesh.isPickable = false;
      comp.world = !!d.useWorldSpace;
      if (!comp.world) comp.mesh.parent = e.native;
      comp.dirty = true;
    },
    update(comp) {
      const d = comp.data; comp.mesh.setEnabled(comp.entity.enabled);
      build(comp.mesh, (d.points ?? []).map((p) => [p[0], p[1], p[2] ?? 0]), d); // rebuilt each frame: the ribbon faces the camera
      comp.positionCount = (d.points ?? []).length; comp.dirty = false;
    },
    set(comp, k, v) { comp.data[k] = v; comp.dirty = true; if (k === 'useWorldSpace') { comp.world = !!v; comp.mesh.parent = v ? null : comp.entity.native; } },
    destroy(comp) { comp.mesh?.material?.dispose(); comp.mesh?.dispose(); },
  });

  registerComponent('trailRenderer', {
    create(e, d, comp) {
      comp.mesh = new B.Mesh(`${e.name}.trail`, scene); comp.mesh.material = material(`${e.name}.trailMat`); comp.mesh.isPickable = false;
      comp.pts = []; comp.emitting = d.emitting !== false;
      comp.clear = () => { comp.pts.length = 0; comp.mesh.setEnabled(false); };
      comp.add = (x, y, z) => comp.pts.push({ p: [x, y, z], age: 0 });
      Object.defineProperty(comp, 'positionCount', { get: () => comp.pts.length });
    },
    update(comp, dt) {
      const d = comp.data, e = comp.entity, life = Math.max(d.time ?? 1, 0.01), minDist = d.minVertexDistance ?? 0.1;
      for (const p of comp.pts) p.age += dt;
      while (comp.pts.length && comp.pts[0].age > life) comp.pts.shift();
      const w = e.native.getAbsolutePosition().asArray();
      if (comp.emitting && e.enabled) {
        const last = comp.pts.at(-1);
        if (!last || Math.hypot(w[0] - last.p[0], w[1] - last.p[1], w[2] - last.p[2]) >= minDist) comp.pts.push({ p: w, age: 0 });
        else last.p = w;
      }
      if (!comp.pts.length) { comp.mesh.setEnabled(false); if (d.autodestruct && !comp.emitting) e.destroy(); return; }
      build(comp.mesh, [...comp.pts].reverse().map((q) => q.p), d);
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'emitting') comp.emitting = !!v; },
    destroy(comp) { comp.mesh?.material?.dispose(); comp.mesh?.dispose(); },
  });

  for (const type of ['spriteMask', 'spriteShape']) {
    registerComponent(type, { create() { backend.game.warn(`[nord] ${type} is a 2D component (Phaser tier); it does nothing in a 3D project`); } });
  }
}
