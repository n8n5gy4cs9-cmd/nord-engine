// AI: stationary turret. Tracks the player inside its line of sight and fires bursts. Immovable; set "range" and "damage".
import { turnTo, yawTo, canSee } from '../ai.js';
import { onDie } from './_enemy.js';

export default {
  id: 'ai-turret', title: 'Turret AI', cat: 'AI', desc: 'Fixed gun: rotates toward the player when it can see them and fires bursts.',
  params: {
    sight: { type: 'number', label: 'Range (m)', default: 30, min: 3, max: 100 },
    turnSpeed: { type: 'number', label: 'Turn speed (°/s)', default: 130, min: 10, max: 720 },
    damage: { type: 'number', label: 'Damage per shot', default: 5, min: 0, max: 100 },
    accuracy: { type: 'number', label: 'Accuracy (0-1)', default: 0.55, min: 0, max: 1, step: 0.05 },
    fireRate: { type: 'number', label: 'Seconds between shots', default: 0.14, min: 0.03, max: 3, step: 0.01 },
    burst: { type: 'int', label: 'Shots per burst', default: 6, min: 1, max: 50 },
    burstPause: { type: 'number', label: 'Pause (s)', default: 1.5, min: 0, max: 10, step: 0.1 },
    sfx: { type: 'sound', label: 'Shot sound', default: 'rifle' },
    tracer: { type: 'color', label: 'Tracer colour', default: '#ff7a3a' },
  },
  start(c) { c.s.cool = 1; c.s.left = 0; c.s.aware = false; },
  die: (c, src) => { onDie(c, src); c.self.model?.parts.head && (c.self.model.parts.head.rotation.x = 0.5); },
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, pl = c.player, head = e.model?.parts.head;
    if (!e.alive || !pl.alive) return;
    const vis = Math.abs(pl.y - e.y) < 5 && canSee(c.game, { eye: [e.x, e.y + 0.8, e.z], rot: e.rot, x: e.x, z: e.z }, pl, p.sight, 360);
    if (vis && !s.aware) { s.aware = true; c.sound('alert'); e.emit('alert'); } if (!vis) s.aware = false;
    s.cool -= dt;
    if (!vis) { turnTo(e, e.rot + 40, 40, dt); return; }
    const off = turnTo(e, yawTo(e.x, e.z, pl.x, pl.z), p.turnSpeed, dt);
    if (head) head.rotation.x = Math.max(-0.5, Math.min(0.5, Math.atan2(e.y + 0.8 - (pl.y + pl.height * 0.5), Math.hypot(pl.x - e.x, pl.z - e.z)) * 0.8));
    if (s.cool <= 0 && off < 12) {
      if (s.left <= 0) s.left = p.burst; s.left--; s.cool = s.left > 0 ? p.fireRate : p.burstPause;
      const f = e.dir; c.game.enemyShot(e, { dmg: p.damage, accuracy: p.accuracy, tracer: p.tracer, sfx: p.sfx, range: p.sight + 5, origin: [e.x + f[0] * 0.9, e.y + 0.85, e.z + f[1] * 0.9] });
    }
  },
};
