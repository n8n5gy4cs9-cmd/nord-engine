// WebAudio manager: buses (master/music/sfx/ui), autoplay-unlock, sfx one-shots, music crossfade.
// `ctxFactory` is injectable so tests run without a browser.
export const BUSES = ['master', 'music', 'sfx', 'ui'];

export class Audio {
  constructor(game, { ctxFactory = () => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(), fetchBuffer } = {}) {
    this.game = game;
    this._factory = ctxFactory;
    this._fetch = fetchBuffer ?? (async (p) => (await fetch(p)).arrayBuffer());
    this.ctx = null; this.buses = {}; this._buffers = new Map(); this._music = null; this._muted = {}; this._vol = {};
    this.unlocked = false;
    for (const b of BUSES) { this._vol[b] = 1; this._muted[b] = false; }
  }
  /** Lazily create the context; call from a user gesture (attachUnlock does this). */
  unlock() {
    if (!this.ctx) {
      try { this.ctx = this._factory(); } catch (e) { this.game.warn?.(`audio unavailable: ${e.message}`); return false; }
      const master = this.ctx.createGain(); master.connect(this.ctx.destination); this.buses.master = master;
      for (const b of BUSES.slice(1)) { const g = this.ctx.createGain(); g.connect(master); this.buses[b] = g; }
      for (const b of BUSES) this._apply(b);
    }
    this.ctx.resume?.();
    this.unlocked = true;
    return true;
  }
  attachUnlock(target = globalThis) {
    const once = () => { this.unlock(); for (const e of ['pointerdown', 'keydown', 'touchend']) target.removeEventListener?.(e, once); };
    for (const e of ['pointerdown', 'keydown', 'touchend']) target.addEventListener?.(e, once);
  }
  _apply(bus) { const g = this.buses[bus]; if (g) g.gain.value = this._muted[bus] ? 0 : this._vol[bus]; }
  volume(bus, v) { if (v === undefined) return this._vol[bus]; this._vol[bus] = Math.max(0, v); this._apply(bus); }
  mute(bus = 'master', on = true) { this._muted[bus] = !!on; this._apply(bus); }
  isMuted(bus = 'master') { return this._muted[bus]; }
  async buffer(path) {
    if (!this._buffers.has(path)) this._buffers.set(path, this._fetch(path).then((ab) => this.ctx.decodeAudioData(ab)));
    return this._buffers.get(path);
  }
  /** Preload without needing to play (needs unlock first; no-op before). */
  preload(paths) { return this.ctx ? Promise.all(paths.map((p) => this.buffer(p))) : Promise.resolve([]); }
  _source(buf, { bus, volume = 1, loop = false, rate = 1 }) {
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = volume; src.connect(g); g.connect(this.buses[bus]);
    return { src, gain: g };
  }
  /** Play a one-shot. Returns a handle {stop()} or null if audio is still locked. */
  async play(path, { volume = 1, loop = false, rate = 1, bus = 'sfx' } = {}) {
    if (!this.ctx) return null;
    try {
      const { src } = this._source(await this.buffer(path), { bus, volume, loop, rate });
      src.start();
      return { stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
    } catch (e) { this.game.warn?.(`audio.play(${path}): ${e.message}`); return null; }
  }
  /** Start looping music, crossfading from the current track over `fade` seconds. */
  async music(path, { fade = 1, volume = 1, loop = true } = {}) {
    if (!this.ctx || this._music?.path === path) return;
    try {
      const buf = await this.buffer(path);
      const t = this.ctx.currentTime;
      this._fadeOut(fade);
      const { src, gain } = this._source(buf, { bus: 'music', volume: 0, loop });
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + fade);
      src.start();
      this._music = { path, src, gain };
    } catch (e) { this.game.warn?.(`audio.music(${path}): ${e.message}`); }
  }
  _fadeOut(fade) {
    const m = this._music; if (!m) return;
    const t = this.ctx.currentTime;
    m.gain.gain.setValueAtTime(m.gain.gain.value, t); m.gain.gain.linearRampToValueAtTime(0, t + fade);
    try { m.src.stop(t + fade + 0.05); } catch { /* ignore */ }
    this._music = null;
  }
  stopMusic({ fade = 0.5 } = {}) { if (this.ctx) this._fadeOut(fade); }
  get currentMusic() { return this._music?.path ?? null; }
}
