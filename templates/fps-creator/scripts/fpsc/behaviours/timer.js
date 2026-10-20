// Timer: emits an event after N seconds (and repeats if asked). Pair with Rules ("When event … → …").
export default {
  id: 'timer', title: 'Timer', cat: 'Logic', desc: 'Emits the entity event "timer" (full name "<name>.timer") after the delay.',
  params: { seconds: { type: 'number', label: 'Seconds', default: 10, min: 0.1, max: 3600 }, repeat: { type: 'bool', label: 'Repeat', default: false } },
  start(c) { c.s.t = c.p.seconds; },
  update(c, dt) { if (c.s.done) return; if ((c.s.t -= dt) <= 0) { c.self.emit('timer'); if (c.p.repeat) c.s.t = c.p.seconds; else c.s.done = true; } },
};
