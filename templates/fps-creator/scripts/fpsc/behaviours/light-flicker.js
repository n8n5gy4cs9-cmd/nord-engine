// Light: flicker. Torches (smooth) or broken lamps (stuttering on/off).
export default {
  id: 'light-flicker', title: 'Flicker', cat: 'Lights', desc: 'Varies the entity\'s light intensity. broken = true makes it cut out.', dynamicLight: true,
  params: { amount: { type: 'number', label: 'Amount (0-1)', default: 0.3, min: 0, max: 1, step: 0.05 }, speed: { type: 'number', label: 'Speed', default: 10, min: 1, max: 40 }, broken: { type: 'bool', label: 'Broken (cuts out)', default: false } },
  start(c) { c.s.t = Math.random() * 100; c.s.base = c.self.light?.base ?? 1; },
  update(c, dt) {
    const L = c.self.light; if (!L) return; const s = c.s, p = c.p; s.t += dt * p.speed;
    const n = (Math.sin(s.t) + Math.sin(s.t * 2.3 + 1.7) * 0.6 + Math.sin(s.t * 5.1) * 0.3) / 1.9;
    if (p.broken) { s.cut = (s.cut ?? 0) - dt; if (s.cut <= 0) { s.cut = 0.05 + Math.random() * (Math.random() < 0.15 ? 1.2 : 0.4); s.off = Math.random() < 0.4; } L.intensity = s.off ? s.base * 0.05 : s.base * (1 - p.amount * 0.2 * Math.abs(n)); }
    else L.intensity = s.base * (1 - p.amount * (0.5 + 0.5 * n));
  },
};
