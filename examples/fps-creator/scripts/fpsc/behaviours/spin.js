// Spin / bob: rotates and/or bobs the model (decoration, pickups, signs).
export default {
  id: 'spin', title: 'Spin and bob', cat: 'Props', desc: 'Rotates the model around Y and bobs it up and down.',
  params: { turn: { type: 'number', label: 'Turn speed (°/s)', default: 90, min: -720, max: 720 }, bob: { type: 'number', label: 'Bob height (m)', default: 0.1, min: 0, max: 2, step: 0.01 } },
  update(c, dt) { const m = c.self.model; if (!m) return; c.s.t = (c.s.t ?? 0) + dt; m.inner.rotation.y = c.s.t * c.p.turn * Math.PI / 180; m.inner.position.y = Math.sin(c.s.t * 2) * c.p.bob; },
};
