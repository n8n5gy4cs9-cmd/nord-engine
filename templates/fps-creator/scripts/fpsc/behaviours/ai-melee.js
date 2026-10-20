// AI: melee rusher (zombies, runners). Shambles when idle, charges along A* paths, swings when in reach.
import { followPath, moveToward, turnTo, yawTo } from '../ai.js';
import { SENSE_PARAMS, sense, heard, provoked, animate, deathAnim, onDie, faceTarget } from './_enemy.js';

export default {
  id: 'ai-melee', title: 'Melee AI', cat: 'AI', desc: 'Rushes the player and hits when in reach. Use speed to make shamblers (1.7) or sprinters (5+).',
  params: {
    ...SENSE_PARAMS, sight: { ...SENSE_PARAMS.sight, default: 22 }, fov: { ...SENSE_PARAMS.fov, default: 160 }, hearing: { ...SENSE_PARAMS.hearing, default: 26 },
    speed: { type: 'number', label: 'Chase speed', default: 1.9, min: 0.2, max: 12, step: 0.1 },
    damage: { type: 'number', label: 'Damage per hit', default: 12, min: 0, max: 200 },
    reach: { type: 'number', label: 'Reach (m)', default: 1.35, min: 0.5, max: 4, step: 0.05 },
    attackRate: { type: 'number', label: 'Seconds between hits', default: 0.9, min: 0.1, max: 5, step: 0.05 },
    windup: { type: 'number', label: 'Wind-up (s)', default: 0.35, min: 0, max: 2, step: 0.05 },
    growl: { type: 'sound', label: 'Idle sound', default: 'zombie' },
    growlEvery: { type: 'number', label: 'Sound every (s, 0 = off)', default: 7, min: 0, max: 60 },
    wander: { type: 'bool', label: 'Shamble about when idle', default: true },
  },
  start(c) { c.s.cool = 0; c.s.gt = 2 + Math.random() * 6; c.s.home = [c.self.x, c.self.z]; c.s.wt = 0; },
  heard,
  hurt(c, amount, src) { provoked(c, src); if (c.self.alive && Math.random() < 0.4) c.s.stun = 0.25; },
  die: onDie,
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, g = c.game, pl = c.player;
    if (!e.alive) { if (!s.done) s.done = deathAnim(c, dt); return; }
    if (s.stun > 0) { s.stun -= dt; return; }
    const { sees, dist } = sense(c, dt);
    s.cool -= dt;
    if (p.growlEvery > 0) { s.gt -= dt; if (s.gt <= 0) { s.gt = p.growlEvery * (0.6 + Math.random() * 0.8); c.sound(p.growl, { volume: 0.7 }); } }
    if (s.mode === 'idle') {
      if (s.return) { const l = followPath(g, e, { x: s.home[0], z: s.home[1], layer: e.layer }, p.speed, dt); animate(c, dt, p.speed, { forward: true }); if (l < 0.8) s.return = false; return; }
      if (p.wander) {
        s.wt -= dt;
        if (s.wt <= 0) { s.wt = 2 + Math.random() * 3; s.wdir = Math.random() < 0.4 ? null : Math.random() * 360; }
        if (s.wdir != null) { turnTo(e, s.wdir, 90, dt); const fx = Math.sin(e.rot * Math.PI / 180), fz = Math.cos(e.rot * Math.PI / 180); moveToward(g, e, e.x + fx, e.z + fz, p.speed * 0.35, dt, { turn: 0 }); animate(c, dt, p.speed * 0.4, { forward: true }); }
        else animate(c, dt, 0, { forward: true });
      } else animate(c, dt, 0, { forward: true });
      return;
    }
    if (s.mode === 'alert') { animate(c, dt, 0, { forward: true }); return; }
    // attack?
    const reach = p.reach + pl.radius + e.radius * 0.5;
    if (dist < reach && Math.abs(pl.y - e.y) < 1.8 && sees) {
      faceTarget(c, dt, 720);
      if (s.windT == null && s.cool <= 0) { s.windT = p.windup; c.sound('swing', { volume: 0.6 }); }
      if (s.windT != null) { s.windT -= dt; animate(c, dt, 0, { forward: true, swing: 1 - Math.max(0, s.windT) / Math.max(0.01, p.windup) }); if (s.windT <= 0) { s.windT = null; s.cool = p.attackRate; if (Math.hypot(pl.x - e.x, pl.z - e.z) < reach + 0.5) { pl.hurt(p.damage, e); c.sound('punch'); } } }
      else animate(c, dt, 0, { forward: true });
      return;
    }
    s.windT = null;
    const t = sees ? [pl.x, pl.z, pl.layer] : (s.last ?? [pl.x, pl.z, pl.layer]);
    followPath(g, e, { x: t[0], z: t[1], layer: t[2] ?? e.layer, y: pl.y }, p.speed, dt);
    animate(c, dt, p.speed, { forward: true });
  },
};
