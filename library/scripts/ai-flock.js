// @nord {"id":"ai.flock","title":"Flocking (boids)","category":"ai","tier":["2d"],"tags":["boids","flock","swarm"],"description":"Boids steering: separation, alignment, cohesion with all entities that share a tag, optional attraction to a target. Add to each member; all members use the shared tag."}
import { NordScript } from 'nord';

export default class Flock extends NordScript {
  static attributes = { tag: { type: 'string', default: 'boid' }, speed: { type: 'number', default: 90 }, radius: { type: 'number', default: 70 }, separation: { type: 'number', default: 1.5 }, alignment: { type: 'number', default: 1 }, cohesion: { type: 'number', default: 0.8 }, attract: { type: 'string', default: '', label: 'Target name to steer toward' }, turn: { type: 'number', default: 4 } };
  start() { const a = this.rng.range(0, 6.28); this.v = [Math.cos(a) * this.attrs.speed, Math.sin(a) * this.attrs.speed]; if (!this.entity.tags.includes(this.attrs.tag)) this.entity.tags.push(this.attrs.tag); }
  update(dt) {
    const a = this.attrs, e = this.entity, [x, y] = e.pos; let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
    for (const o of this.scene.findByTag(a.tag)) {
      if (o === e) continue; const dx = o.pos[0] - x, dy = o.pos[1] - y, d = Math.hypot(dx, dy); if (d > a.radius || d === 0) continue;
      n++; cx += dx; cy += dy; const ov = o.scripts.find((s) => s.v)?.v; if (ov) { ax += ov[0]; ay += ov[1]; } sx -= (dx / d) * (1 - d / a.radius); sy -= (dy / d) * (1 - d / a.radius);
    }
    let fx = sx * a.separation, fy = sy * a.separation;
    if (n) { fx += (ax / n / a.speed) * a.alignment + (cx / n / a.radius) * a.cohesion; fy += (ay / n / a.speed) * a.alignment + (cy / n / a.radius) * a.cohesion; }
    const t = a.attract && this.scene.find(a.attract); if (t) { const dx = t.pos[0] - x, dy = t.pos[1] - y, d = Math.hypot(dx, dy) || 1; fx += dx / d * 0.6; fy += dy / d * 0.6; }
    this.v[0] += fx * a.speed * a.turn * dt; this.v[1] += fy * a.speed * a.turn * dt;
    const m = Math.hypot(...this.v) || 1; this.v = [(this.v[0] / m) * a.speed, (this.v[1] / m) * a.speed];
    e.pos = [x + this.v[0] * dt, y + this.v[1] * dt, e.pos[2]]; e.rot = [0, 0, (Math.atan2(this.v[1], this.v[0]) * 180) / Math.PI];
  }
}
