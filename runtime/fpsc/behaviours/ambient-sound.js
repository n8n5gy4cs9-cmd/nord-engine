// Ambient sound: plays a sound at the entity now and then (positional).
export default {
  id: 'ambient-sound', title: 'Ambient sound', cat: 'Props', desc: 'Plays the entity\'s Sound every N seconds with small random jitter. Built-in names: steam, alarm, beep, zombie, growl, robot, door …',
  params: {},
  start(c) { c.s.t = Math.random() * 3; },
  update(c, dt) { const s = c.s, p = c.self.props; if ((s.t -= dt) <= 0) { s.t = (+p.every || 6) * (0.7 + Math.random() * 0.6); c.sound(p.sound || 'steam', { volume: +p.volume || 0.8 }); } },
};
