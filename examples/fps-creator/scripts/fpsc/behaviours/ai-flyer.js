// AI: flying drone. Hovers at a set height, circles the player at a distance and fires energy bolts. Ignores floor obstacles but not walls.
import { step, turnTo, yawTo, canSee, followPath } from '../ai.js';
import { SENSE_PARAMS, sense, heard, provoked, onDie, deathAnim } from './_enemy.js';

export default {
  id: 'ai-flyer', title: 'Flying AI', cat: 'AI', desc: 'Hover-and-circle enemy that shoots slow energy bolts. Set the hover height on the entity.',
  params: {
    ...SENSE_PARAMS, sight: { ...SENSE_PARAMS.sight, default: 30 },
    speed: { type: 'number', label: 'Speed', default: 3.8, min: 0.5, max: 14, step: 0.1 },
    circle: { type: 'number', label: 'Circle distance (m)', default: 7, min: 2, max: 30 },
    damage: { type: 'number', label: 'Bolt damage', default: 7, min: 0, max: 100 },
    fireRate: { type: 'number', label: 'Seconds between bolts', default: 1.1, min: 0.2, max: 8, step: 0.1 },
    boltSpeed: { type: 'number', label: 'Bolt speed', default: 17, min: 4, max: 60 },
    color: { type: 'color', label: 'Bolt colour', default: '#6ee7ff' },
  },
  start(c) { c.s.cool = 1 + Math.random(); c.s.ang = Math.random() * 6.28; c.s.dir = Math.random() < 0.5 ? 1 : -1; c.s.base = c.self.baseY ?? c.self.y; c.self.y = c.s.base + (+c.self.props.altitude || 1.7); },
  heard, hurt: (c, a, src) => provoked(c, src),
  die(c, src) { onDie(c, src); c.s.fall = true; },
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, g = c.game, pl = c.player, rot = e.model?.parts.rotor;
    if (rot) rot.rotation.y += dt * (e.alive ? 40 : 8);
    if (!e.alive) { if (s.fall) { e.vy = (e.vy ?? 0) - 20 * dt; e.y += e.vy * dt; const f = g.world.floorAt(e.x, e.z, e.y + 1); if (f && e.y <= f.y) { e.y = f.y; s.fall = false; } } return; }
    const alt = +e.props.altitude || 1.7, f = g.world.floorAt(e.x, e.z, e.y + 3), want = (f ? f.y : s.base) + alt;
    e.y += (want - e.y) * Math.min(1, dt * 2) + Math.sin(g.time * 3 + e.x) * 0.004;
    const { sees, dist } = sense(c, dt);
    s.cool -= dt;
    if (s.mode === 'idle' || s.mode === 'alert') { e.model && (e.model.inner.position.y = Math.sin(g.time * 2 + e.z) * 0.08); return; }
    if (sees) {
      turnTo(e, yawTo(e.x, e.z, pl.x, pl.z), 300, dt);
      s.ang += s.dir * dt * (p.speed / p.circle);
      const tx = pl.x + Math.cos(s.ang) * p.circle, tz = pl.z + Math.sin(s.ang) * p.circle, dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
      const ok = step(g, e, (dx / d) * Math.min(d, p.speed * dt), (dz / d) * Math.min(d, p.speed * dt), dt, { flying: true });
      if (e.blocked || !ok) s.dir *= -1;
      if (s.cool <= 0) { s.cool = p.fireRate * (0.8 + Math.random() * 0.5); const o = e.eye, tg = [pl.x, pl.y + pl.height * 0.5, pl.z], l = Math.hypot(tg[0] - o[0], tg[1] - o[1], tg[2] - o[2]) || 1;
        g.fireProjectile(e, o, [(tg[0] - o[0]) / l, (tg[1] - o[1]) / l, (tg[2] - o[2]) / l], { speed: p.boltSpeed, dmg: p.damage, color: p.color, size: 0.11, light: 4, sfx: 'plasma' }); }
    } else { const t = s.last ?? [pl.x, pl.z]; const dx = t[0] - e.x, dz = t[1] - e.z, d = Math.hypot(dx, dz); if (d > 1) step(g, e, (dx / d) * p.speed * dt, (dz / d) * p.speed * dt, dt, { flying: true }); else s.lost += dt; turnTo(e, yawTo(e.x, e.z, t[0], t[1]), 200, dt); }
  },
};
