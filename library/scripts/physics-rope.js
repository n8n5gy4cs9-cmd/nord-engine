// @nord {"id":"physics.rope","title":"Rope / chain (verlet)","category":"physics","tier":["2d"],"tags":["rope","chain","verlet"],"description":"Verlet rope anchored at this entity, drawn into a DOM-free debug line via the entity's 'points' array (read rope.points from another script, e.g. to move a hanging lamp). Pin the end to another entity by name."}
import { NordScript } from 'nord';

export default class Rope extends NordScript {
  static attributes = { segments: { type: 'int', default: 10, min: 2 }, length: { type: 'number', default: 120 }, gravity: { type: 'number', default: 900 }, damping: { type: 'number', default: 0.99 }, iterations: { type: 'int', default: 8, min: 1 }, endEntity: { type: 'string', default: '', label: 'Entity pinned to the end (optional)' } };
  start() {
    const { segments: n, length } = this.attrs, [x, y] = this.entity.pos; this.seg = length / n;
    this.points = Array.from({ length: n + 1 }, (_, i) => ({ x, y: y + i * this.seg, px: x, py: y + i * this.seg }));
    this.end = this.attrs.endEntity ? this.scene.find(this.attrs.endEntity) : null;
  }
  fixedUpdate(dt) {
    const a = this.attrs, P = this.points;
    for (let i = 1; i < P.length; i++) { const p = P[i], vx = (p.x - p.px) * a.damping, vy = (p.y - p.py) * a.damping; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + a.gravity * dt * dt; }
    for (let k = 0; k < a.iterations; k++) {
      P[0].x = this.entity.pos[0]; P[0].y = this.entity.pos[1];
      if (this.end) { const l = P.at(-1); l.x = this.end.pos[0]; l.y = this.end.pos[1]; }
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i], B = P[i + 1], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6, f = (d - this.seg) / d / 2;
        if (i > 0) { A.x += dx * f; A.y += dy * f; } B.x -= dx * f; B.y -= dy * f;
      }
    }
  }
}
