// Shared enemy plumbing for the AI scripts: senses, alert/lose-interest, humanoid walk/attack animation, death. Not a script itself (leading underscore).
import { canSee, yawTo, turnTo, dist2d } from '../ai.js';

export const SENSE_PARAMS = {
  sight: { type: 'number', label: 'Sight range (m)', default: 28, min: 2, max: 120 },
  fov: { type: 'number', label: 'Field of view (°)', default: 140, min: 20, max: 360 },
  hearing: { type: 'number', label: 'Hearing range (m)', default: 22, min: 0, max: 100 },
  reaction: { type: 'number', label: 'Reaction time (s)', default: 0.45, min: 0, max: 3, step: 0.05 },
  forget: { type: 'number', label: 'Gives up after (s)', default: 7, min: 1, max: 60 },
  patrolSpeed: { type: 'number', label: 'Patrol speed', default: 1.5, min: 0.2, max: 6, step: 0.1 },
};

/** Per-frame sensing. Returns { sees, dist }. Updates c.s.mode ('idle'|'alert'|'chase'), last known position and the lose-interest timer. */
export function sense(c, dt) {
  const e = c.self, s = c.s, p = c.player, g = c.game;
  s.mode ??= 'idle'; s.lost ??= 0; s.react ??= 0;
  if (!p.alive || p.noclip && false) return { sees: false, dist: 99 };
  const dist = Math.hypot(p.x - e.x, p.z - e.z);
  const awake = s.mode !== 'idle';
  const sees = Math.abs(p.y - e.y) < 6 && canSee(g, e, p, c.p.sight * (p.crouching ? 0.8 : 1), awake ? 360 : c.p.fov);
  if (sees) {
    s.last = [p.x, p.z, p.layer]; s.lost = 0;
    if (s.mode === 'idle') { s.mode = 'alert'; s.react = c.p.reaction; c.sound('alert'); e.emit('alert'); }
  } else if (s.mode === 'chase') { s.lost += dt; if (s.lost > c.p.forget) { s.mode = 'idle'; s.lost = 0; s.return = true; } }
  if (s.mode === 'alert') { s.react -= dt; turnTo(e, yawTo(e.x, e.z, p.x, p.z), 540, dt); if (s.react <= 0) s.mode = 'chase'; }
  return { sees, dist };
}

/** `heard` hook: wake up toward a noise. */
export function heard(c, pos, src, dist) {
  const s = c.s; if (!c.self.alive) return;
  if (dist > c.p.hearing * (s.mode === 'idle' ? 1 : 1.5)) return;
  if (!c.game.world.los([c.self.x, c.self.y + 1.2, c.self.z], [pos[0], pos[1], pos[2]]) && dist > c.p.hearing * 0.5) return;
  if (s.mode === 'idle') { s.mode = 'alert'; s.react = c.p.reaction + 0.2; s.last = [pos[0], pos[2], c.player.layer]; c.sound('alert'); c.self.emit('alert'); }
  else s.last = [pos[0], pos[2], c.player.layer];
}

/** Provoked by damage: turn on the attacker. */
export function provoked(c, src) {
  const s = c.s, p = c.player; if (!c.self.alive) return;
  if (s.mode === 'idle') { s.mode = 'chase'; s.last = [p.x, p.z, p.layer]; s.lost = 0; c.sound('alert'); c.self.emit('alert'); }
}

/** Swing legs/arms of a humanoid model by walk speed; `aim` raises the right arm (gun), `swing` (0..1) swings both arms (melee). */
export function animate(c, dt, speed, { aim = false, swing = 0, forward = false } = {}) {
  const m = c.self.model, P = m?.parts; if (!P?.legL) return;
  const s = c.s; s.walk = (s.walk ?? 0) + dt * speed * 3.2; const a = Math.sin(s.walk) * Math.min(1, speed / 3) * 0.9;
  P.legL.rotation.x = a; P.legR.rotation.x = -a;
  if (aim) { P.armR.rotation.x = -1.35; P.armL.rotation.x = -0.4 - a * 0.1; }
  else if (forward) { P.armL.rotation.x = -1.45 + swing * 1.1 + a * 0.08; P.armR.rotation.x = -1.45 + swing * 1.1 - a * 0.08; }
  else { P.armL.rotation.x = -a * 0.7; P.armR.rotation.x = a * 0.7; }
  if (swing && !forward) { P.armR.rotation.x = -1.8 + swing * 2.4; }
  if (P.head) P.head.rotation.x = 0;
}

/** Death: fall over backwards, then lie still. Call every frame while dead. Returns true when the animation is finished. */
export function deathAnim(c, dt) {
  const m = c.self.model; if (!m) return true;
  const s = c.s; s.dead = (s.dead ?? 0) + dt;
  const k = Math.min(1, s.dead / 0.45); const root = m.root;
  root.rotation.x = -Math.PI / 2 * k * (1 - 0.1 * Math.sin(k * Math.PI));
  m.inner.position.y = 0.12 * k;
  if (m.parts.legL) { m.parts.legL.rotation.x = 0.3 * k; m.parts.legR.rotation.x = -0.2 * k; m.parts.armL.rotation.x = -0.6 * k; m.parts.armR.rotation.x = 0.4 * k; }
  return k >= 1;
}

export function onDie(c, src) {
  const e = c.self, g = c.game; e.hit = false; c.s.mode = 'dead';
  c.sound(e.def.blood === null ? 'explosion' : 'die', { volume: 0.7 });
  if (e.def.blood === null) { g.fx.explosion([e.x, e.y + e.height * 0.5, e.z], 1.6); g.fx.smoke([e.x, e.y + 0.4, e.z], 6); } else g.fx.blood([e.x, e.y + 1.2, e.z]);
  g.noise([e.x, e.y, e.z], 8, null);
  const i = g.solids.indexOf(e); if (i >= 0) g.solids.splice(i, 1); // corpses do not block
}

export const faceTarget = (c, dt, spd = 540) => { const p = c.player, e = c.self; return turnTo(e, yawTo(e.x, e.z, p.x, p.z), spd, dt); };
export { dist2d };
