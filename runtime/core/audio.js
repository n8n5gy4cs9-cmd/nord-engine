// Audio manager: WebAudio buses (master → music/sfx/ui), autoplay unlock, music crossfade.
// `ctxFactory` is injectable for tests. Missing/blocked audio never throws into game code.
import { clamp } from './util.js';

export const BUSES = ['master', 'music', 'sfx', 'ui'];

export class Audio {
  constructor(loader, { ctxFactory = () => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(), saveKey = null, storage = null } = {}) {
    this.loader = loader;
    this.ctxFactory = ctxFactory;
    this.ctx = null;
    this.buses = {};
    this.vol = { master: 1, music: 0.7, sfx: 1, ui: 1 };
    this.muted = { master: false, music: false, sfx: false, ui: false };
    this.unlocked = false;
    this.buffers = new Map();
    this._music = null; // { path, src, gain }
    this._queue = [];   // calls made before unlock
    this.storage = storage; this.saveKey = saveKey;
    this.#restore();
  }
  #restore() {
    try {
      const v = JSON.parse(this.storage?.getItem(this.saveKey) ?? 'null');
      if (v) { Object.assign(this.vol, v.vol); Object.assign(this.muted, v.muted); }
    } catch { /* ignore */ }
  }
  #persist() { try { this.storage?.setItem(this.saveKey, JSON.stringify({ vol: this.vol, muted: this.muted })); } catch { /* ignore */ } }

  #ensure() {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = this.ctxFactory();
      this.buses.master = this.ctx.createGain();
      this.buses.master.connect(this.ctx.destination);
      for (const b of BUSES.slice(1)) { this.buses[b] = this.ctx.createGain(); this.buses[b].connect(this.buses.master); }
      for (const b of BUSES) this.#apply(b);
    } catch (e) { console.warn('[nord] audio unavailable:', e.message); this.ctx = null; }
    return this.ctx;
  }
  #apply(b) { if (this.buses[b]) this.buses[b].gain.value = this.muted[b] ? 0 : this.vol[b]; }

  /** Browsers need a user gesture; attach() resumes the context on the first one and replays queued calls. */
  attach(target = globalThis.window) {
    const go = async () => {
      for (const ev of ['pointerdown', 'keydown', 'touchend']) target?.removeEventListener?.(ev, go);
      await this.unlock();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) target?.addEventListener?.(ev, go);
  }
  async unlock() {
    const ctx = this.#ensure();
    if (!ctx) return;
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch { /* ignore */ }
    this.unlocked = true;
    const q = this._queue; this._queue = [];
    for (const fn of q) fn();
  }

  async load(path) {
    if (this.buffers.has(path)) return this.buffers.get(path);
    const ctx = this.#ensure();
    if (!ctx) return null;
    const p = this.loader.binary(path).then((ab) => ctx.decodeAudioData(ab.slice(0)));
    this.buffers.set(path, p);
    try { return await p; } catch (e) { this.buffers.delete(path); console.warn(`[nord] audio decode failed: ${path}: ${e.message ?? e}`); return null; }
  }
  preload(paths) { return Promise.all(paths.map((p) => this.load(p))); }

  /** Play a one-shot (or loop). Returns a handle { stop(), source } or null if audio is unavailable. */
  play(path, { volume = 1, loop = false, rate = 1, bus = 'sfx', pan = 0 } = {}) {
    const handle = { stopped: false, source: null, stop() { this.stopped = true; try { this.source?.stop(); } catch { /* already stopped */ } } };
    const run = async () => {
      const buf = await this.load(path);
      if (!buf || handle.stopped) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = volume;
      src.connect(g);
      let tail = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; }
      tail.connect(this.buses[bus] ?? this.buses.sfx);
      handle.source = src; handle.gain = g;
      src.start();
    };
    if (!this.unlocked) { this.#ensure(); this._queue.push(run); } else run();
    return handle;
  }

  /** Start looping music at offset seconds. Same path is a no-op unless restart is requested. */
  async music(path, { fade = 1, volume = 1, offset = 0, restart = false } = {}) {
    if (this._music?.path === path && !restart) return;
    const old = this._music;
    this._music = { path, src: null, gain: null };
    const mine = this._music;
    const run = async () => {
      const buf = await this.load(path);
      if (!buf || this._music !== mine) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + fade);
      src.connect(g); g.connect(this.buses.music);
      src.start(0, Number.isFinite(offset) && offset >= 0 && offset < buf.duration ? offset : 0);
      mine.src = src; mine.gain = g;
    };
    if (old) this.#fadeOut(old, fade);
    if (!this.unlocked) { this.#ensure(); this._queue.push(run); } else await run();
  }
  #fadeOut(m, fade) {
    if (!m.gain || !this.ctx) return;
    const t = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues?.(t);
    m.gain.gain.setValueAtTime(m.gain.gain.value, t);
    m.gain.gain.linearRampToValueAtTime(0, t + fade);
    try { m.src.stop(t + fade + 0.05); } catch { /* ignore */ }
  }
  stopMusic({ fade = 0.5 } = {}) { if (this._music) this.#fadeOut(this._music, fade); this._music = null; }
  get musicPath() { return this._music?.path ?? null; }

  volume(bus, v) { if (v === undefined) return this.vol[bus]; this.vol[bus] = clamp(v, 0, 1); this.#apply(bus); this.#persist(); }
  mute(bus = 'master', on = true) { this.muted[bus] = on; this.#apply(bus); this.#persist(); }
  isMuted(bus = 'master') { return this.muted[bus]; }
  /** Pause/resume the whole context (used when the game is paused or tab hidden). */
  suspend() { this.ctx?.suspend?.(); }
  resume() { if (this.unlocked) this.ctx?.resume?.(); }
}
