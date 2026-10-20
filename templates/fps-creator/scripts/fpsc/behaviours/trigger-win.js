// Trigger: level exit. Completing the level; optional "needs event" gate (e.g. "boss.died") and next level.
import { inZone } from './_util.js';

export default {
  id: 'trigger-win', title: 'Level exit', cat: 'Triggers', desc: 'Entering the zone completes the level. Props: next (file), need (event name that must have happened first).',
  params: {},
  start(c) { const need = c.self.props.need; c.s.ok = !need; if (need) c.on(need, () => { c.s.ok = true; c.say('The way is open!', 2.5); }); },
  update(c, dt) {
    const e = c.self, s = c.s; s.t = (s.t ?? 0) + dt; if (e.model) e.model.inner.rotation.y = s.t;
    if (!inZone(e, c.player)) return;
    if (!s.ok) { if (c.game.time - (s.warn ?? -9) > 3) { s.warn = c.game.time; c.say('Finish your objective first.', 2); } return; }
    e.emit('enter'); c.game.win(e.props.next);
  },
};
