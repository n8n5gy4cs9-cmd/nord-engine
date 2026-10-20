// Tiny WebAudio synth: every built-in sound is generated (no files), positional (distance + pan). Project sounds from fpsc/bank.json "sounds" override a name.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Recipes: [{ type:'osc'|'noise', wave, f0, f1, dur, gain, attack, filter:{type,f0,f1,q} }]
const R = {
  pistol: [{ n: 1, dur: 0.16, g: 0.9, filter: ['lowpass', 5000, 400] }, { w: 'square', f0: 320, f1: 70, dur: 0.12, g: 0.35 }],
  rifle: [{ n: 1, dur: 0.11, g: 0.8, filter: ['lowpass', 6000, 600] }, { w: 'sawtooth', f0: 220, f1: 60, dur: 0.09, g: 0.3 }],
  shotgun: [{ n: 1, dur: 0.45, g: 1, filter: ['lowpass', 3500, 200] }, { w: 'square', f0: 140, f1: 40, dur: 0.3, g: 0.5 }],
  rocket: [{ n: 1, dur: 0.5, g: 0.6, filter: ['bandpass', 900, 200] }, { w: 'sawtooth', f0: 120, f1: 380, dur: 0.4, g: 0.25 }],
  explosion: [{ n: 1, dur: 1.1, g: 1.2, filter: ['lowpass', 1400, 60] }, { w: 'sine', f0: 90, f1: 28, dur: 0.9, g: 0.9 }],
  laser: [{ w: 'sawtooth', f0: 1400, f1: 300, dur: 0.22, g: 0.3 }, { w: 'square', f0: 900, f1: 200, dur: 0.18, g: 0.15 }],
  plasma: [{ w: 'sine', f0: 200, f1: 900, dur: 0.25, g: 0.4 }, { n: 1, dur: 0.2, g: 0.2, filter: ['highpass', 2000, 2000] }],
  hit: [{ n: 1, dur: 0.07, g: 0.5, filter: ['bandpass', 1800, 600] }],
  impact: [{ n: 1, dur: 0.09, g: 0.35, filter: ['lowpass', 2500, 800] }],
  hurt: [{ w: 'sawtooth', f0: 180, f1: 90, dur: 0.22, g: 0.45 }, { n: 1, dur: 0.12, g: 0.3, filter: ['lowpass', 1200, 400] }],
  die: [{ w: 'sawtooth', f0: 220, f1: 40, dur: 0.7, g: 0.5 }, { n: 1, dur: 0.5, g: 0.3, filter: ['lowpass', 900, 100] }],
  zombie: [{ w: 'sawtooth', f0: 110, f1: 70, dur: 0.8, g: 0.4, vib: 9 }, { n: 1, dur: 0.6, g: 0.15, filter: ['bandpass', 400, 300] }],
  growl: [{ w: 'sawtooth', f0: 80, f1: 55, dur: 0.6, g: 0.45, vib: 22 }],
  alert: [{ w: 'square', f0: 520, f1: 780, dur: 0.14, g: 0.25 }, { w: 'square', f0: 780, f1: 520, dur: 0.14, g: 0.25, at: 0.14 }],
  robot: [{ w: 'square', f0: 300, f1: 120, dur: 0.3, g: 0.25, vib: 40 }],
  pickup: [{ w: 'sine', f0: 660, f1: 990, dur: 0.14, g: 0.35 }, { w: 'sine', f0: 990, f1: 1320, dur: 0.18, g: 0.3, at: 0.1 }],
  health: [{ w: 'sine', f0: 440, f1: 880, dur: 0.25, g: 0.4 }],
  ammo: [{ w: 'square', f0: 300, f1: 200, dur: 0.06, g: 0.3 }, { w: 'square', f0: 500, f1: 300, dur: 0.06, g: 0.3, at: 0.07 }],
  key: [{ w: 'triangle', f0: 880, f1: 1760, dur: 0.12, g: 0.4 }, { w: 'triangle', f0: 1320, f1: 1980, dur: 0.3, g: 0.35, at: 0.1 }],
  door: [{ n: 1, dur: 0.55, g: 0.3, filter: ['lowpass', 500, 200] }, { w: 'sawtooth', f0: 70, f1: 50, dur: 0.5, g: 0.2 }],
  locked: [{ w: 'square', f0: 140, f1: 120, dur: 0.12, g: 0.3 }, { w: 'square', f0: 120, f1: 100, dur: 0.15, g: 0.3, at: 0.14 }],
  switch: [{ n: 1, dur: 0.05, g: 0.6, filter: ['bandpass', 2400, 800] }, { w: 'square', f0: 220, f1: 180, dur: 0.07, g: 0.2, at: 0.05 }],
  step: [{ n: 1, dur: 0.07, g: 0.14, filter: ['lowpass', 500, 200] }],
  jump: [{ n: 1, dur: 0.1, g: 0.12, filter: ['lowpass', 800, 300] }],
  land: [{ n: 1, dur: 0.14, g: 0.3, filter: ['lowpass', 400, 120] }],
  reload: [{ n: 1, dur: 0.05, g: 0.5, filter: ['bandpass', 1500, 700] }, { n: 1, dur: 0.06, g: 0.5, filter: ['bandpass', 900, 700], at: 0.35 }],
  empty: [{ n: 1, dur: 0.04, g: 0.5, filter: ['bandpass', 3000, 900] }],
  punch: [{ n: 1, dur: 0.1, g: 0.5, filter: ['lowpass', 700, 200] }],
  swing: [{ n: 1, dur: 0.18, g: 0.2, filter: ['bandpass', 600, 1800] }],
  beep: [{ w: 'sine', f0: 1000, f1: 1000, dur: 0.1, g: 0.25 }],
  checkpoint: [{ w: 'sine', f0: 523, f1: 523, dur: 0.12, g: 0.3 }, { w: 'sine', f0: 659, f1: 659, dur: 0.12, g: 0.3, at: 0.12 }, { w: 'sine', f0: 784, f1: 784, dur: 0.2, g: 0.3, at: 0.24 }],
  win: [{ w: 'triangle', f0: 523, f1: 523, dur: 0.18, g: 0.35 }, { w: 'triangle', f0: 659, f1: 659, dur: 0.18, g: 0.35, at: 0.18 }, { w: 'triangle', f0: 784, f1: 784, dur: 0.18, g: 0.35, at: 0.36 }, { w: 'triangle', f0: 1047, f1: 1047, dur: 0.5, g: 0.4, at: 0.54 }],
  lose: [{ w: 'sawtooth', f0: 330, f1: 330, dur: 0.25, g: 0.3 }, { w: 'sawtooth', f0: 262, f1: 262, dur: 0.25, g: 0.3, at: 0.25 }, { w: 'sawtooth', f0: 196, f1: 120, dur: 0.7, g: 0.3, at: 0.5 }],
  teleport: [{ w: 'sine', f0: 200, f1: 1600, dur: 0.4, g: 0.3 }, { n: 1, dur: 0.4, g: 0.12, filter: ['highpass', 3000, 3000] }],
  steam: [{ n: 1, dur: 0.7, g: 0.25, filter: ['highpass', 3500, 3500] }],
  alarm: [{ w: 'sawtooth', f0: 600, f1: 900, dur: 0.5, g: 0.25 }],
};
export const SOUND_NAMES = Object.keys(R);

export class Sfx {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.8; this.listener = { x: 0, y: 0, z: 0, yaw: 0 }; this.custom = new Map(); this.last = new Map(); this.music = null; this.noise = null; }
  /** Create the AudioContext (must follow a user gesture to make sound). */
  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.();
  }
  setVolume(v) { this.volume = clamp(v, 0, 1); if (this.master) this.master.gain.value = this.volume; }
  /** Load project sound overrides: { name: url } — played instead of the synth. */
  async loadCustom(map) {
    if (!this.ctx) return; // loaded lazily on the first play after unlock
    for (const [n, url] of Object.entries(map ?? {})) {
      try { const buf = await (await fetch(url)).arrayBuffer(); this.custom.set(n, await this.ctx.decodeAudioData(buf)); } catch { /* keep the synth */ }
    }
  }
  setCustomSources(map) { this.customSrc = map ?? {}; }

  /** Play a named sound. at = {x,y,z} for positional sound (omit for UI/own sounds). */
  play(name, at = null, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < (o.minGap ?? 0.025)) return; this.last.set(name, now);
    let vol = (o.volume ?? 1), pan = 0;
    if (at) {
      const L = this.listener, dx = at.x - L.x, dz = at.z - L.z, d = Math.hypot(dx, dz, (at.y ?? 0) - (L.y ?? 0)) || 0.01;
      vol *= clamp(1 - d / (o.range ?? 40), 0, 1) ** 1.6; if (vol < 0.01) return;
      const ang = Math.atan2(dx, dz) - L.yaw; pan = clamp(Math.sin(ang), -1, 1) * (d > 1.5 ? 0.85 : 0.3);
    }
    const out = this.ctx.createGain(); out.gain.value = vol;
    let node = out;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(this.master); } else out.connect(this.master);
    if (this.customSrc?.[name] && !this.custom.has(name) && !this.customLoading?.has(name)) { (this.customLoading ??= new Set()).add(name); this.loadCustom({ [name]: this.customSrc[name] }); }
    if (this.custom.has(name)) { const s = this.ctx.createBufferSource(); s.buffer = this.custom.get(name); s.playbackRate.value = o.rate ?? 1; s.connect(node); s.start(); return; }
    const rec = R[name] ?? R.beep;
    for (const r of rec) this.#voice(r, out, now + (r.at ?? 0), o.rate ?? 1);
  }
  #voice(r, out, t, rate) {
    const c = this.ctx, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(r.g, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + r.dur);
    let src;
    if (r.n) { src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = rate; }
    else {
      src = c.createOscillator(); src.type = r.w; src.frequency.setValueAtTime(r.f0 * rate, t); src.frequency.exponentialRampToValueAtTime(Math.max(1, r.f1 * rate), t + r.dur);
      if (r.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = r.vib; lg.gain.value = r.f0 * 0.08; lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + r.dur + 0.05); }
    }
    let chain = src;
    if (r.filter) { const f = c.createBiquadFilter(); f.type = r.filter[0]; f.frequency.setValueAtTime(r.filter[1], t); f.frequency.exponentialRampToValueAtTime(Math.max(20, r.filter[2]), t + r.dur); f.Q.value = 1; chain.connect(f); chain = f; }
    chain.connect(g); g.connect(out);
    src.start(t); src.stop(t + r.dur + 0.05);
  }

  /** Looping background music from a file URL. */
  playMusic(url, volume = 0.4) {
    this.stopMusic(); if (!url) return;
    try { const a = new Audio(url); a.loop = true; a.volume = volume * this.volume; this.music = a; a.play().catch(() => {}); } catch { /* ignore */ }
  }
  stopMusic() { try { this.music?.pause(); } catch { /* ignore */ } this.music = null; }
}
