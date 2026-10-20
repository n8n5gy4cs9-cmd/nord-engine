// NPC: press E to hear the next line (one per line in "Lines"), turning to face the player.
import { turnTo, yawTo } from '../ai.js';

export default {
  id: 'npc-talk', title: 'NPC dialogue', cat: 'Props', desc: 'Cycles through the lines of the entity\'s "Lines" text. Emits "talked".',
  params: { seconds: { type: 'number', label: 'Seconds per line', default: 3.5, min: 1, max: 15, step: 0.5 } },
  start(c) { c.s.i = 0; },
  update(c, dt) { if (c.s.talk > 0) { c.s.talk -= dt; turnTo(c.self, yawTo(c.self.x, c.self.z, c.player.x, c.player.z), 300, dt); } },
  use(c) { const lines = String(c.self.props.lines || '').split('\n').filter(Boolean); if (!lines.length) return; c.say(`${c.self.name || c.self.def.label}: ${lines[c.s.i % lines.length]}`, c.p.seconds); c.s.i++; c.s.talk = 2; c.sound('beep'); c.self.emit('talked'); },
  hurt(c, a, src) { if (src === c.player) c.say('Hey! Watch it!', 1.5); },
};
