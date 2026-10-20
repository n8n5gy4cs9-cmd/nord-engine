// Trigger zone: emits "enter" / "exit" while the player walks in/out of the box (set width/depth/height on the entity). Rules and other scripts react to those events.
import { inZone } from './_util.js';

export default {
  id: 'trigger-zone', title: 'Trigger zone', cat: 'Triggers', desc: 'Detects the player inside a box. Events: enter, exit. Use Rules ("When player enters → …").',
  params: { once: { type: 'bool', label: 'Only once', default: false } },
  update(c, dt) {
    const e = c.self, s = c.s, inside = inZone(e, c.player);
    if (s.done) return;
    if (inside && !s.in) { s.in = true; e.emit('enter'); if (c.p.once || e.props.once) s.done = true; }
    else if (!inside && s.in) { s.in = false; e.emit('exit'); }
  },
};
