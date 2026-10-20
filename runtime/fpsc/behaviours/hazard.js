// Hazard: damages the player every second while inside the zone (acid pool, fire, radiation).
import { inZone } from './_util.js';

export default {
  id: 'hazard', title: 'Damage zone', cat: 'Triggers', desc: 'Hurts the player continuously while inside (props: damage per second, sound).',
  params: {},
  update(c, dt) {
    const e = c.self, s = c.s;
    if (!inZone(e, c.player)) { s.acc = 0; return; }
    s.acc = (s.acc ?? 0) + dt * (+e.props.damage || 10); s.t = (s.t ?? 0) - dt;
    if (s.acc >= 1) { c.player.hurt(Math.floor(s.acc), e); s.acc -= Math.floor(s.acc); if (s.t <= 0) { s.t = 0.5; c.sound(e.props.sound || 'hurt', null); } }
  },
};
