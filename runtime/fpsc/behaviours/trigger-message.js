// Trigger: show a message when the player enters the zone.
import { inZone } from './_util.js';

export default {
  id: 'trigger-message', title: 'Message on enter', cat: 'Triggers', desc: 'Shows the entity\'s "Message" text for "Seconds" when the player walks in.',
  params: {},
  update(c) {
    const e = c.self, s = c.s, inside = inZone(e, c.player);
    if (inside && !s.in && !s.done) { s.in = true; c.say(e.props.text || '', +e.props.seconds || 4); e.emit('enter'); if (e.props.once !== false) s.done = true; }
    else if (!inside && s.in) { s.in = false; e.emit('exit'); }
  },
};
