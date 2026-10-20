// Spawner: keeps spawning an entity type near this entity until "max" are alive. Great for endless waves.
export default {
  id: 'spawner', title: 'Spawner', cat: 'Logic', desc: 'Every N seconds spawns "type" (up to "max" alive) around this entity. Disable it with a rule when done.',
  params: { type: { type: 'string', label: 'Entity type', default: 'enemy_zombie' }, every: { type: 'number', label: 'Every (s)', default: 6, min: 0.5, max: 120 }, max: { type: 'int', label: 'Max alive', default: 4, min: 1, max: 50 }, radius: { type: 'number', label: 'Spread (m)', default: 2, min: 0, max: 20 }, aggressive: { type: 'bool', label: 'Born alerted', default: true } },
  start(c) { c.s.t = c.p.every; c.s.kids = []; },
  update(c, dt) {
    const s = c.s, p = c.p; s.kids = s.kids.filter((k) => k.alive && !k.destroyed);
    if ((s.t -= dt) > 0 || s.kids.length >= p.max) return; s.t = p.every;
    const e = c.self, a = Math.random() * 6.283, r = Math.random() * p.radius, k = c.game.spawn(p.type, e.x + Math.cos(a) * r, e.z + Math.sin(a) * r, e.layer, {});
    if (k) { s.kids.push(k); if (p.aggressive) k.scripts.forEach((sc) => { sc.s.mode = 'chase'; sc.s.last = [c.player.x, c.player.z, c.player.layer]; }); }
  },
};
