// Trigger: teleporter. Stepping in moves the player to the entity named in "Target".
import { inZone } from './_util.js';

export default {
  id: 'trigger-teleport', title: 'Teleport to target', cat: 'Triggers', desc: 'Moves the player to the target entity (set the Target field). A short cooldown stops ping-pong between two pads.',
  params: {},
  update(c, dt) {
    const e = c.self, g = c.game, s = c.s; s.t = (s.t ?? 0) + dt; if (e.model) e.model.inner.rotation.y = s.t * 1.5;
    if (!inZone(e, c.player) || g.time < (g.tpCool ?? 0)) return;
    const dest = c.targets()[0]; if (!dest) { if (g.time - (s.warn ?? -9) > 4) { s.warn = g.time; g.warn(`teleporter "${e.name || e.id}" has no valid target`); } return; }
    g.tpCool = g.time + 1.2; c.player.teleport(dest.x, dest.z, dest.layer, dest.rot); g.sound('teleport'); g.fx.burst([dest.x, dest.y + 1, dest.z], { n: 14, color: ['#9b6bff', '#c8b0ff'], speed: 2, life: 0.6, size: 0.1, gravity: -1 }); e.emit('enter');
  },
};
