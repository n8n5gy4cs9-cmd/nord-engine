// AI: ranged infantry. Patrols (entity path), notices you by sight/sound, closes to its preferred distance, strafes and fires bursts (hitscan or projectile).
import { followPath, patrol, moveToward, turnTo, yawTo, step } from '../ai.js';
import { SENSE_PARAMS, sense, heard, provoked, animate, deathAnim, onDie, faceTarget } from './_enemy.js';

export default {
  id: 'ai-shooter', title: 'Shooter AI', cat: 'AI', desc: 'Ranged enemy brain: patrol → notice → chase → strafe and shoot bursts. Tune accuracy, damage, burst and distance; set projectile to "rocket" or "plasma" for splash shots.',
  params: {
    ...SENSE_PARAMS,
    speed: { type: 'number', label: 'Walk speed', default: 2.8, min: 0.2, max: 12, step: 0.1 },
    runSpeed: { type: 'number', label: 'Run speed', default: 4.2, min: 0.2, max: 14, step: 0.1 },
    damage: { type: 'number', label: 'Damage per shot', default: 8, min: 0, max: 200 },
    accuracy: { type: 'number', label: 'Accuracy (0-1)', default: 0.6, min: 0, max: 1, step: 0.05 },
    fireRate: { type: 'number', label: 'Seconds between shots', default: 0.5, min: 0.05, max: 5, step: 0.05 },
    burst: { type: 'int', label: 'Shots per burst', default: 3, min: 1, max: 40 },
    burstPause: { type: 'number', label: 'Pause between bursts (s)', default: 1.2, min: 0, max: 10, step: 0.1 },
    preferred: { type: 'number', label: 'Preferred distance (m)', default: 10, min: 2, max: 40 },
    range: { type: 'number', label: 'Max shooting range (m)', default: 45, min: 5, max: 120 },
    strafe: { type: 'bool', label: 'Strafe while shooting', default: true },
    sfx: { type: 'sound', label: 'Shot sound', default: 'rifle' },
    tracer: { type: 'color', label: 'Tracer colour', default: '#ffb36b' },
    projectile: { type: 'enum', label: 'Projectile', default: '', options: ['', 'rocket', 'plasma'] },
    splash: { type: 'number', label: 'Projectile splash radius', default: 0, min: 0, max: 10 },
    painChance: { type: 'number', label: 'Flinch chance', default: 0.3, min: 0, max: 1, step: 0.05 },
  },
  start(c) { c.s.cool = 0.5 + Math.random(); c.s.burstLeft = 0; c.s.home = [c.self.x, c.self.z]; c.s.sdir = Math.random() < 0.5 ? 1 : -1; c.s.st = 0; },
  heard,
  hurt(c, amount, src) { provoked(c, src); if (Math.random() < c.p.painChance && c.self.alive) c.s.stun = 0.3; },
  die: onDie,
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, g = c.game;
    if (!e.alive) { if (!s.done) s.done = deathAnim(c, dt); return; }
    if (s.stun > 0) { s.stun -= dt; animate(c, dt, 0); return; }
    const { sees, dist } = sense(c, dt);
    s.cool -= dt;
    if (s.mode === 'idle') {
      const route = e.data.path;
      if (s.return) { const left = followPath(g, e, { x: s.home[0], z: s.home[1], layer: e.layer }, p.speed, dt); animate(c, dt, p.speed, { aim: false }); if (left < 0.8) s.return = false; return; }
      if (route?.length) { patrol(g, e, route, p.patrolSpeed, dt); animate(c, dt, p.patrolSpeed); } else animate(c, dt, 0);
      return;
    }
    if (s.mode === 'alert') { animate(c, dt, 0, { aim: true }); return; }
    // chase / attack
    const pl = c.player;
    if (sees && dist < p.range) {
      const turned = faceTarget(c, dt, 480);
      let move = 0, side = 0;
      if (dist > p.preferred + 2) move = 1; else if (dist < p.preferred * 0.5) move = -0.7;
      if (p.strafe && s.burstLeft <= 0) { s.st -= dt; if (s.st <= 0) { s.st = 0.8 + Math.random() * 1.4; s.sdir *= Math.random() < 0.5 ? -1 : 1; } side = s.sdir * 0.6; }
      const spd = move > 0 ? p.runSpeed : p.speed * 0.8, fx = Math.sin(e.rot * Math.PI / 180), fz = Math.cos(e.rot * Math.PI / 180);
      if (move || side) step(g, e, (fx * move + fz * side) * spd * dt, (fz * move - fx * side) * spd * dt, dt);
      animate(c, dt, move || side ? spd : 0, { aim: true });
      if (s.cool <= 0 && turned < 25) {
        if (s.burstLeft <= 0) s.burstLeft = p.burst;
        this.fire(c); s.burstLeft--; s.cool = s.burstLeft > 0 ? p.fireRate : p.burstPause * (0.7 + Math.random() * 0.6);
        e.model?.parts.armR && (e.model.parts.armR.rotation.x -= 0.2);
      }
    } else {
      s.burstLeft = 0;
      const t = s.last ?? [pl.x, pl.z, pl.layer];
      const left = followPath(g, e, { x: t[0], z: t[1], layer: t[2] ?? e.layer }, p.runSpeed, dt);
      animate(c, dt, p.runSpeed, { aim: true });
      if (left < 1.2 && !sees) { s.lost += dt * 2; }
    }
  },
  fire(c) {
    const e = c.self, p = c.p, g = c.game, pl = c.player;
    if (p.projectile) {
      const o = e.eye, f = e.dir, org = [o[0] + f[0] * 0.5, o[1] - 0.1, o[2] + f[1] * 0.5], tg = [pl.x, pl.y + pl.height * 0.5, pl.z];
      const d = Math.hypot(tg[0] - org[0], tg[1] - org[1], tg[2] - org[2]) || 1, err = (1 - p.accuracy) * 0.5;
      const dir = [(tg[0] - org[0]) / d + (Math.random() - 0.5) * err, (tg[1] - org[1]) / d + (Math.random() - 0.5) * err * 0.5, (tg[2] - org[2]) / d + (Math.random() - 0.5) * err];
      const pj = p.projectile === 'rocket' ? { speed: 16, color: '#ffb040', size: 0.2, light: 6, trail: '#9a9a9a', splash: p.splash || 3 } : { speed: 20, color: '#6ee7ff', size: 0.12, light: 4, splash: p.splash || 0 };
      g.fireProjectile(e, org, dir, { ...pj, dmg: p.damage, sfx: p.sfx });
    } else g.enemyShot(e, { dmg: p.damage, accuracy: p.accuracy, range: p.range, tracer: p.tracer, sfx: p.sfx });
  },
};
