// @nord {"id":"fx.light2d-occluder","title":"2D shadow caster (wall / pillar / crate)","category":"fx","tier":["2d"],"tags":["shadow","light","wall","occluder","game-ready"],"requires":["fx.light2d"],"description":"Makes this entity block 2D light (box or circle). Size comes from the script, else the sprite/collider size × scale. Moves, rotates and enable/disable are picked up automatically (set static = true for walls to skip the per-frame check). The body itself is lit when a light sees it (lit = true)."}
import { NordScript } from 'nord';
import { light2d } from './light2d.js';

export default class Occluder2D extends NordScript {
  static attributes = {
    shape: { type: 'enum', options: ['box', 'circle'], default: 'box' },
    size: { type: 'vec2', default: [0, 0], label: 'Box size (0,0 = from sprite/collider)' },
    radius: { type: 'number', default: 0, min: 0, label: 'Circle radius (0 = from size)' },
    lit: { type: 'bool', default: true, label: 'Light the body itself (tops of walls)' },
    static: { type: 'bool', default: true, label: 'Never moves (skip the per-frame check)' },
  };
  init() { this.world = light2d(this.game); this.sig = null; this.rebuild(); this.world.occluders.add(this); this.world.version++; }
  onDestroy() { this.world?.occluders.delete(this); this.world && this.world.version++; }
  update() { if (!this.attrs.static) this.rebuild(); }

  rebuild() {
    const e = this.entity, a = this.attrs, w = e.worldPos, rot = e.rot[2], sc = e.scale;
    const sig = `${w[0]},${w[1]},${rot},${sc[0]},${sc[1]}`;
    if (sig === this.sig) return; this.sig = sig;
    const src = e.getComponent('sprite')?.data.size ?? e.getComponent('collider')?.data.size ?? [32, 32];
    const sz = a.size[0] > 0 ? a.size : src, cx = w[0], cy = w[1], pts = [];
    if (a.shape === 'circle') {
      const r = (a.radius > 0 ? a.radius : sz[0] / 2) * Math.abs(sc[0]);
      for (let i = 0; i < 12; i++) pts.push(cx + Math.cos((i / 12) * Math.PI * 2) * r, cy + Math.sin((i / 12) * Math.PI * 2) * r);
    } else {
      const hw = (sz[0] * Math.abs(sc[0])) / 2, hh = (sz[1] * Math.abs(sc[1])) / 2, c = Math.cos((rot * Math.PI) / 180), s = Math.sin((rot * Math.PI) / 180);
      for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) pts.push(cx + x * c - y * s, cy + x * s + y * c);
    }
    const segs = []; for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; segs.push(pts[i], pts[i + 1], pts[j], pts[j + 1]); }
    const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
    Object.assign(this, { pts, segs, cx, cy, lit: a.lit, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    if (this.world.occluders.has(this)) this.world.version++;
  }
}
