// AI: sniper. Holds position; when it sees you a red laser line appears, then one heavy shot after the aim time. Break line of sight to survive.
import { canSee, turnTo, yawTo } from '../ai.js';
import { SENSE_PARAMS, heard, provoked, deathAnim, onDie, animate } from './_enemy.js';

export default {
  id: 'ai-sniper', title: 'Sniper AI', cat: 'AI', desc: 'Stands still, aims with a visible laser for "aimTime" seconds, then fires a heavy shot. Cooldown between shots.',
  params: {
    sight: { ...SENSE_PARAMS.sight, default: 55 },
    aimTime: { type: 'number', label: 'Aim time (s)', default: 1.6, min: 0.3, max: 6, step: 0.1 },
    cooldown: { type: 'number', label: 'Cooldown (s)', default: 2.6, min: 0.3, max: 15, step: 0.1 },
    damage: { type: 'number', label: 'Damage', default: 42, min: 1, max: 300 },
    accuracy: { type: 'number', label: 'Accuracy (0-1)', default: 0.9, min: 0, max: 1, step: 0.05 },
    laser: { type: 'color', label: 'Laser colour', default: '#ff2a2a' },
  },
  start(c) { c.s.aim = 0; c.s.cool = 1; },
  heard: () => {}, hurt: (c, a, src) => provoked(c, src), die: onDie,
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, pl = c.player, g = c.game;
    if (!e.alive) { if (!s.done) s.done = deathAnim(c, dt); return; }
    animate(c, dt, 0, { aim: true });
    if (!pl.alive) return;
    s.cool -= dt;
    const eye = [e.x, e.y + 1.5, e.z], vis = Math.abs(pl.y - e.y) < 8 && canSee(g, { eye, rot: e.rot, x: e.x, z: e.z }, pl, p.sight, 360);
    if (!vis) { s.aim = Math.max(0, s.aim - dt * 2); return; }
    turnTo(e, yawTo(e.x, e.z, pl.x, pl.z), 200, dt);
    if (s.cool > 0) return;
    if (s.aim === 0) { c.sound('alert'); e.emit('alert'); }
    s.aim += dt;
    const tgt = [pl.x, pl.y + pl.height * 0.55, pl.z], f = e.dir, org = [e.x + f[0] * 0.5, e.y + 1.45, e.z + f[1] * 0.5];
    g.fx.tracer(org, tgt, p.laser);
    if (s.aim >= p.aimTime) { s.aim = 0; s.cool = p.cooldown; g.enemyShot(e, { dmg: p.damage, accuracy: p.accuracy, range: p.sight + 10, tracer: '#ffffff', sfx: 'rifle', origin: org }); g.sound('shotgun', e, { volume: 0.7 }); }
  },
};
