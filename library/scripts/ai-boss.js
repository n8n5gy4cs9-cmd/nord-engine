// @nord {"id":"ai.boss-phases","title":"Boss with phases","category":"ai","tier":["2d"],"tags":["boss","phases","fsm"],"requires":["gameplay.health"],"description":"Boss pattern controller: phases switch at health thresholds (phases: [{at:0.66, move:'strafe', fire:{rate,burst,spread}}]). Reads the sibling Health script, strafes/charges and fires bullet prefabs. Emits 'boss:phase' and 'boss:dead'."}
import { NordScript } from 'nord';

export default class Boss extends NordScript {
  static attributes = { bullet: { type: 'asset', assetType: 'prefab', default: '' }, phases: { type: 'array', default: [{ at: 1, move: 'strafe', rate: 1, burst: 3, spread: 40 }, { at: 0.5, move: 'charge', rate: 2, burst: 5, spread: 80 }, { at: 0.2, move: 'strafe', rate: 4, burst: 8, spread: 360 }] }, speed: { type: 'number', default: 90 }, bulletSpeed: { type: 'number', default: 200 }, target: { type: 'string', default: 'player' } };
  start() { this.phase = -1; this.cd = 1; this.t = 0; this.home = [...this.entity.pos]; this.health = this.entity.scripts.find((s) => 'hp' in s && s.damage); this.entity.on('death', () => { this.events.emit('boss:dead', this.entity); }); }
  update(dt) {
    const a = this.attrs, e = this.entity, h = this.health ? this.health.hp / this.health.attrs.max : 1;
    let p = 0; a.phases.forEach((ph, i) => { if (h <= ph.at) p = i; });
    if (p !== this.phase) { this.phase = p; this.events.emit('boss:phase', p); this.game.camera?.shake?.(300, 0.01); }
    const ph = a.phases[p], t = this.scene.findByTag(a.target)[0]; this.t += dt;
    if (ph.move === 'strafe') e.pos = [this.home[0] + Math.sin(this.t * 1.2) * 120, this.home[1] + Math.sin(this.t * 2.4) * 20, e.pos[2]];
    else if (t) { const dx = t.pos[0] - e.pos[0], dy = t.pos[1] - e.pos[1], d = Math.hypot(dx, dy) || 1; e.pos = [e.pos[0] + (dx / d) * a.speed * 1.8 * dt, e.pos[1] + (dy / d) * a.speed * 1.8 * dt, e.pos[2]]; }
    if (!t || !a.bullet || (this.cd -= dt) > 0) return; this.cd = 1 / ph.rate;
    const base = Math.atan2(t.pos[1] - e.pos[1], t.pos[0] - e.pos[0]);
    for (let i = 0; i < ph.burst; i++) {
      const r = base + (ph.burst > 1 ? (i / (ph.burst - 1) - 0.5) * ph.spread : 0) * Math.PI / 180;
      this.scene.spawn(a.bullet, { pos: [...e.pos] }).then((b) => { b.rot = [0, 0, (r * 180) / Math.PI]; this.physics.setVelocity(b, Math.cos(r) * a.bulletSpeed, Math.sin(r) * a.bulletSpeed); this.after(5, () => b.destroyed || b.destroy()); });
    }
  }
}
