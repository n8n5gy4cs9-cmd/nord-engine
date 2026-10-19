import { NordScript } from 'nord';

// A shade lives in the dark: it is invisible except for its eyes, sprints at the hero in darkness and burns up in light. Light must
// reach it (walls and pillars cast real shadows), so hiding it behind a pillar and sweeping the beam is the game. Uses game.light2d.
export default class Shade extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 100, min: 0 },
    sight: { type: 'number', default: 340, min: 0 },
    hp: { type: 'number', default: 1, min: 0.1 },
    burn: { type: 'number', default: 1.1, min: 0, label: 'Damage per second at full light' },
    threshold: { type: 'number', default: 0.35, min: 0, label: 'Light level that hurts it' },
    recoil: { type: 'number', default: 0.65, min: 0, label: 'Light level that makes it flee (weaker light only burns it)' },
    contactDamage: { type: 'number', default: 1 },
  };
  start() {
    this.hp = this.attrs.hp; this.vx = 0; this.vy = 0; this.cd = 0; this.t = Math.random() * 9; this.dead = false;
    this.stuck = 0; this.side = 0; this.last = [...this.entity.pos]; this.lit = 0; this.eyes = this.entity.children[0];
  }
  update(dt) {
    if (this.dead) return;
    const a = this.attrs, e = this.entity, world = this.game.light2d, p = this.scene.findByTag('player')[0];
    this.t += dt; this.cd -= dt;
    const s = world.sample(e.pos[0], e.pos[1]); this.lit = s.level;
    const hurt = s.level > a.threshold;
    let mul = 0, dx = 0, dy = 0;
    if (hurt) { this.hp -= Math.min(1.5, s.level) * a.burn * dt; if (this.hp <= 0) return this.die(); }
    if (s.level > a.recoil) { dx = -s.dx; dy = -s.dy; mul = 0.7; } // strong light (beam, lit brazier): recoil away from it
    else if (p && !p.destroyed) { // otherwise hunt, even through a dim halo
      const px = p.pos[0] - e.pos[0], py = p.pos[1] - e.pos[1], d = Math.hypot(px, py);
      if (d < a.sight) { dx = px / d; dy = py / d; mul = d < 150 ? 1.45 : 1; }
      if (d < 26 && this.cd <= 0) { this.cd = 1; p.emit('damage', { amount: a.contactDamage, from: e }); this.events.emit('sfx', 'hit'); }
    }
    // stuck behind a pillar/wall: slide sideways for a moment
    const moved = Math.hypot(e.pos[0] - this.last[0], e.pos[1] - this.last[1]); this.last = [...e.pos];
    this.stuck = mul && moved < a.speed * dt * 0.25 ? this.stuck + dt : 0;
    if (this.stuck > 0.3) { this.side = (this.side || (Math.random() < 0.5 ? 1 : -1)); this.stuck = 0; this.sideT = 0.8; }
    if ((this.sideT = (this.sideT ?? 0) - dt) > 0) { const ox = dx; dx = dx * 0.35 - dy * this.side * 0.95; dy = dy * 0.35 + ox * this.side * 0.95; } else this.side = 0;
    this.vx = dx * a.speed * mul; this.vy = dy * a.speed * mul;
    const w = 1 + Math.sin(this.t * 7) * 0.07 + (hurt ? Math.sin(this.t * 60) * 0.12 : 0); e.scale = [w, w, 1];
    this.eyes?.set('sprite', 'tint', hurt ? '#ffffff' : '#ff3b30');
  }
  fixedUpdate() { if (!this.dead) this.physics.setVelocity(this.entity, this.vx, this.vy); }
  die() {
    this.dead = true; this.physics.setVelocity(this.entity, 0, 0); this.events.emit('score', 100); this.events.emit('sfx', 'explosion'); this.events.emit('shade:dead', this.entity);
    const k = { v: 1 }; this.tween(k, { v: 0 }, { duration: 0.3, onUpdate: () => { this.entity.scale = [k.v * 1.4, k.v * 1.4, 1]; }, onComplete: () => this.entity.destroy() });
  }
}
