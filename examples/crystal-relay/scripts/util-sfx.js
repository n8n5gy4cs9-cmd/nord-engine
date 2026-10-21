// @nord {"id":"util.sfx-synth","title":"Procedural sfx (jsfxr-style)","category":"utilities","tier":["any"],"tags":["audio","sfx","synth","retro"],"description":"Generates retro sound effects with WebAudio, no files needed: sfx(game,'coin'|'jump'|'hit'|'laser'|'explosion'|'powerup'). Listens to global events 'sfx' (name). import { sfx } from './util-sfx.js' for direct use."}
import { NordScript } from 'nord';

const P = { coin: { w: 'square', f: [880, 1760], d: 0.18, v: 0.25 }, jump: { w: 'square', f: [260, 620], d: 0.2, v: 0.25 }, hit: { w: 'sawtooth', f: [220, 60], d: 0.18, v: 0.3 }, laser: { w: 'sawtooth', f: [1400, 200], d: 0.25, v: 0.2 }, powerup: { w: 'triangle', f: [300, 1200], d: 0.4, v: 0.3 }, explosion: { w: 'noise', f: [800, 40], d: 0.6, v: 0.4 } };
let ctx;
export function sfx(name, vol = 1) {
  const p = P[name]; if (!p) return; ctx ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(p.v * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + p.d); g.connect(ctx.destination);
  let src;
  if (p.w === 'noise') { const b = ctx.createBuffer(1, ctx.sampleRate * p.d, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); src = ctx.createBufferSource(); src.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(p.f[0], t); f.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(f); f.connect(g); }
  else { src = ctx.createOscillator(); src.type = p.w; src.frequency.setValueAtTime(p.f[0], t); src.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(g); }
  src.start(t); src.stop(t + p.d);
}

export default class SfxSynth extends NordScript {
  static attributes = { volume: { type: 'number', default: 1, min: 0, max: 1 }, map: { type: 'string', default: '{"pickup":"coin","jump":"jump","hit":"hit","explosion":"explosion","enemy:shoot":"laser"}', label: 'JSON global-event → sfx name' } };
  start() { this.offs = [this.events.on('sfx', (n) => sfx(n, this.attrs.volume)), ...Object.entries(JSON.parse(this.attrs.map)).map(([ev, n]) => this.events.on(ev, () => sfx(n, this.attrs.volume)))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
}
