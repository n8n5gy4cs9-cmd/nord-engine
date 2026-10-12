// @nord {"id":"ai.shooter","title":"Enemy AI: shooter / turret","category":"ai","tier":["2d"],"tags":["enemy","turret","shoot"],"description":"Aims at the nearest tagged target in range and fires a bullet prefab at a fixed rate with optional spread and burst; leads moving targets if 'lead' is on."}
import { NordScript } from 'nord';

export default class Shooter extends NordScript {
  static attributes = { target: { type: 'string', default: 'player' }, bullet: { type: 'asset', assetType: 'prefab', default: '' }, range: { type: 'number', default: 280 }, rate: { type: 'number', default: 1, min: 0.05 }, speed: { type: 'number', default: 220 }, burst: { type: 'int', default: 1, min: 1 }, spread: { type: 'number', default: 0 }, lead: { type: 'bool', default: false }, rotate: { type: 'bool', default: true } };
  start() { this.cd = this.rng.range(0, 1 / this.attrs.rate); this.prev = null; }
  update(dt) {
    const a = this.attrs, e = this.entity, t = this.scene.findByTag(a.target)[0]; if (!t || t.destroyed || e.stunned) return;
    let tx = t.pos[0], ty = t.pos[1];
    if (a.lead && this.prev) { const f = Math.hypot(tx - e.pos[0], ty - e.pos[1]) / a.speed; tx += (tx - this.prev[0]) / dt * f; ty += (ty - this.prev[1]) / dt * f; }
    this.prev = [t.pos[0], t.pos[1]];
    if (Math.hypot(tx - e.pos[0], ty - e.pos[1]) > a.range) return;
    const ang = Math.atan2(ty - e.pos[1], tx - e.pos[0]); if (a.rotate) e.rot = [0, 0, (ang * 180) / Math.PI];
    if ((this.cd -= dt) > 0 || !a.bullet) return; this.cd = 1 / a.rate;
    for (let i = 0; i < a.burst; i++) {
      const s = a.burst > 1 ? (i / (a.burst - 1) - 0.5) * a.spread : (this.rng.next() - 0.5) * a.spread, r = ang + (s * Math.PI) / 180;
      this.scene.spawn(a.bullet, { pos: [e.pos[0], e.pos[1], e.pos[2]] }).then((b) => { b.rot = [0, 0, (r * 180) / Math.PI]; this.physics.setVelocity(b, Math.cos(r) * a.speed, Math.sin(r) * a.speed); this.after(4, () => b.destroyed || b.destroy()); });
    }
    this.events.emit('enemy:shoot', e);
  }
}
