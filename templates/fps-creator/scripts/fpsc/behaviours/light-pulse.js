// Light: pulsing alarm. Starts on when the entity's "On at start" is set, or on events "alarm" / "alarm.off".
export default {
  id: 'light-pulse', title: 'Pulse (alarm)', cat: 'Lights', desc: 'Pulses between dim and bright; optional siren sound. Listens to events "alarm" and "alarm.off".', dynamicLight: true,
  params: { speed: { type: 'number', label: 'Pulses per second', default: 1.4, min: 0.2, max: 8, step: 0.1 }, siren: { type: 'bool', label: 'Siren sound', default: true } },
  start(c) { c.s.base = c.self.light?.base ?? 1; c.s.t = 0; c.s.on = c.self.light?.on ?? false; c.on('alarm', () => { c.s.on = true; if (c.self.light) c.self.light.on = true; }); c.on('alarm.off', () => { c.s.on = false; }); },
  update(c, dt) {
    const L = c.self.light, s = c.s; if (!L) return;
    if (!s.on) { L.on = false; return; } L.on = true; s.t += dt * c.p.speed * 6.283; L.intensity = s.base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.t)));
    if (c.p.siren) { s.sir = (s.sir ?? 0) - dt; if (s.sir <= 0) { s.sir = 1 / c.p.speed; c.sound('alarm', { volume: 0.5 }); } }
  },
};
