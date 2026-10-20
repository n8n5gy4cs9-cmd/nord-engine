// Particle emitter: fire, smoke, steam, sparks, dust at the entity's position. Pooled particles, only active near the player.
const PRESETS = {
  fire: { n: 2, rate: 14, color: ['#ffb02e', '#ff6a1a', '#ffe27a'], speed: 0.9, life: 0.75, size: 0.28, gravity: -1.6, up: 1.3, spread: 0.5 },
  smoke: { n: 1, rate: 4, color: ['#555555', '#777777'], speed: 0.45, life: 2.4, size: 0.55, gravity: -0.5, up: 0.7, spread: 0.4 },
  steam: { n: 3, rate: 7, color: ['#d8e4ea', '#ffffff'], speed: 1.3, life: 1.1, size: 0.32, gravity: -0.9, up: 1.6, spread: 0.3 },
  sparks: { n: 7, rate: 0.9, color: ['#ffd27a', '#fff2c0', '#ff9a3a'], speed: 3.2, life: 0.55, size: 0.05, gravity: 10, up: 1.2, spread: 1 },
  dust: { n: 1, rate: 3, color: ['#a89a82', '#c9bda6'], speed: 0.25, life: 3, size: 0.3, gravity: -0.1, up: 0.2, spread: 1 },
};
export default {
  id: 'emitter', title: 'Particle emitter', cat: 'Props', desc: 'Emits particles (fire, smoke, steam, sparks, dust) at the entity. Switch it on/off with rules (enable / disable).',
  params: {
    preset: { type: 'enum', label: 'Effect', default: 'fire', options: Object.keys(PRESETS) },
    rate: { type: 'number', label: 'Emits per second (0 = preset)', default: 0, min: 0, max: 60, step: 0.5 },
    height: { type: 'number', label: 'Height above floor (m)', default: 0.3, min: 0, max: 10, step: 0.1 },
    range: { type: 'number', label: 'Only within (m) of the player', default: 40, min: 5, max: 200 },
    sound: { type: 'sound', label: 'Looping sound name (optional)', default: '' },
  },
  start(c) { c.s.acc = Math.random(); c.s.snd = 0; },
  update(c, dt) {
    const e = c.self, p = c.p, g = c.game, pl = c.player, P = PRESETS[p.preset] ?? PRESETS.fire;
    if (Math.hypot(pl.x - e.x, pl.z - e.z) > p.range) return;
    c.s.acc += dt * (p.rate || P.rate);
    while (c.s.acc >= 1) { c.s.acc -= 1; g.fx.burst([e.x, e.y + p.height, e.z], { n: P.n, color: P.color, speed: P.speed, life: P.life, size: P.size, gravity: P.gravity, up: P.up, spread: P.spread }); }
    if (p.sound) { c.s.snd -= dt; if (c.s.snd <= 0) { c.s.snd = 3; c.sound(p.sound, { volume: 0.5 }); } }
  },
};
