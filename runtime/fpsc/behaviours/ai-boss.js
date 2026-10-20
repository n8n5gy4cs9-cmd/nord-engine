// AI: three-phase boss. Phase 1 bolts+strafe, phase 2 rocket volleys, phase 3 enrage and summons minions. Draws a boss health bar.
import { step, turnTo, yawTo, followPath } from '../ai.js';
import { SENSE_PARAMS, sense, heard, provoked, onDie, deathAnim, animate, faceTarget } from './_enemy.js';

export default {
  id: 'ai-boss', title: 'Boss AI', cat: 'AI', desc: 'Boss brain with 3 phases (at 66% and 33% health). Phase 3 summons minions. Emits "<name>.phase2", "phase3" and "died".',
  params: {
    ...SENSE_PARAMS, sight: { ...SENSE_PARAMS.sight, default: 45 }, fov: { ...SENSE_PARAMS.fov, default: 360 },
    speed: { type: 'number', label: 'Speed', default: 2.4, min: 0.5, max: 10, step: 0.1 },
    damage: { type: 'number', label: 'Bolt damage', default: 12, min: 1, max: 200 },
    rocketDamage: { type: 'number', label: 'Rocket damage', default: 45, min: 1, max: 300 },
    minion: { type: 'string', label: 'Minion type (phase 3)', default: 'enemy_runner' },
    minions: { type: 'int', label: 'Minions per summon', default: 2, min: 0, max: 8 },
  },
  start(c) { c.s.cool = 2; c.s.phase = 1; c.s.vol = 0; c.s.sum = 6; c.s.sdir = 1; c.s.st = 0; },
  heard: () => {}, hurt: (c, a, src) => { provoked(c, src); c.s.mode = c.s.mode === 'idle' ? 'chase' : c.s.mode; },
  die(c, src) { onDie(c, src); c.game.hud.boss('', null); c.game.fx.explosion([c.self.x, c.self.y + 2, c.self.z], 6); c.game.bus.emit('boss.died', {}); },
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, g = c.game, pl = c.player;
    if (!e.alive) { if (!s.done) s.done = deathAnim(c, dt); return; }
    const { sees, dist } = sense(c, dt);
    const frac = e.hp / e.maxHp;
    if (s.mode !== 'idle') g.hud.boss(e.props.name_bar || 'BOSS', frac);
    const ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (ph !== s.phase) { s.phase = ph; e.emit(`phase${ph}`); g.say(ph === 2 ? 'The boss is furious!' : 'The boss is enraged!', 2.5); g.fx.shake = 0.8; c.sound('explosion'); }
    if (s.mode === 'idle' || s.mode === 'alert') { animate(c, dt, 0, { aim: true }); return; }
    s.cool -= dt;
    const spd = p.speed * (ph === 3 ? 1.5 : 1);
    if (sees) {
      faceTarget(c, dt, 240);
      s.st -= dt; if (s.st <= 0) { s.st = 1 + Math.random() * 1.5; s.sdir *= Math.random() < 0.5 ? -1 : 1; }
      const fx = Math.sin(e.rot * Math.PI / 180), fz = Math.cos(e.rot * Math.PI / 180), mv = dist > 12 ? 1 : dist < 7 ? -0.6 : 0;
      step(g, e, (fx * mv + fz * s.sdir * 0.7) * spd * dt, (fz * mv - fx * s.sdir * 0.7) * spd * dt, dt);
      animate(c, dt, spd * 0.7, { aim: true });
      if (s.cool <= 0) {
        const o = [e.x, e.y + e.height * 0.62, e.z], tg = [pl.x, pl.y + pl.height * 0.5, pl.z], l = Math.hypot(tg[0] - o[0], tg[1] - o[1], tg[2] - o[2]) || 1, dir = [(tg[0] - o[0]) / l, (tg[1] - o[1]) / l, (tg[2] - o[2]) / l];
        if (ph === 1 || s.vol % 3 === 2 && ph === 3) { for (const a of [-0.12, 0, 0.12]) g.fireProjectile(e, o, [dir[0] + a * dir[2], dir[1], dir[2] - a * dir[0]], { speed: 17, dmg: p.damage, color: '#ff2060', size: 0.14, light: 5, sfx: 'plasma' }); s.cool = 1.1; }
        else { g.fireProjectile(e, o, dir, { speed: 15, dmg: p.rocketDamage, splash: 3.2, color: '#ffb040', size: 0.2, light: 6, trail: '#999', sfx: 'rocket' }); s.cool = ph === 2 ? 0.7 : 1.2; }
        s.vol++;
      }
    } else { const t = s.last ?? [pl.x, pl.z, pl.layer]; followPath(g, e, { x: t[0], z: t[1], layer: t[2] }, spd * 1.4, dt); animate(c, dt, spd, { aim: true }); }
    if (ph === 3 && p.minions > 0) { s.sum -= dt; if (s.sum <= 0) { s.sum = 9; g.say('Reinforcements!', 2); for (let i = 0; i < p.minions; i++) g.spawn(p.minion, e.x + Math.cos(i * 3.1) * 3, e.z + Math.sin(i * 3.1) * 3, e.layer, { optional: true }); } }
  },
};
