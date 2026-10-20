// Trigger: ambush. When the player enters, spawn enemies (or anything) inside the zone / at a named spawn point.
import { inZone } from './_util.js';

export default {
  id: 'trigger-spawn', title: 'Spawn on enter', cat: 'Triggers', desc: 'Spawns "count" × "spawn type" when the player enters. Use a named Spawn point for exact spots.',
  params: {},
  update(c) {
    const e = c.self, s = c.s, g = c.game, p = e.props;
    if (s.done || !inZone(e, c.player)) return;
    if (p.once !== false) s.done = true;
    const spots = p.where ? g.find(p.where) : [];
    for (let i = 0; i < (+p.count || 1); i++) {
      const sp = spots.length ? spots[i % spots.length] : null, z = e.zone, a = Math.random() * 6.283, r = Math.random() * (+p.spread || 4);
      const x = sp ? sp.x : e.x + (Math.random() - 0.5) * z.w * 0.9 + Math.cos(a) * r * 0.3, zz = sp ? sp.z : e.z + (Math.random() - 0.5) * z.d * 0.9 + Math.sin(a) * r * 0.3;
      const n = g.spawn(p.spawn || 'enemy_zombie', x, zz, e.layer, {}); if (n) { n.state.aggro = true; g.fx.burst([x, n.y + 1, zz], { n: 8, color: ['#ff9a3a', '#888'], speed: 1.5, life: 0.5, size: 0.12, gravity: -1 }); n.scripts.forEach((sc) => { sc.s.mode = 'chase'; sc.s.last = [c.player.x, c.player.z, c.player.layer]; }); }
    }
    c.sound('alert'); e.emit('enter');
  },
};
