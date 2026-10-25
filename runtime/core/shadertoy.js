// Shadertoy host: runs shaders written for https://www.shadertoy.com/ (GLSL ES 3.00 `mainImage`) on a WebGL2 canvas that the backends show in the game.
//
//   const st = new Shadertoy({ code: 'void mainImage(out vec4 c, in vec2 p){ c = vec4(p/iResolution.xy, .5+.5*sin(iTime), 1.); }', width: 640, height: 360 });
//   await st.ready; st.render(dt);       // st.canvas is a normal <canvas>: draw it, use it as a texture, put it in the page
//
// Supported like on Shadertoy: iResolution, iTime, iTimeDelta, iFrame, iFrameRate, iMouse, iDate, iSampleRate, iChannel0..3 with iChannelResolution / iChannelTime, the `Common` tab,
// Buffer A–D (ping-pong, float when the GPU allows it) and the Image pass, texture / keyboard / audio / cubemap / buffer inputs, and `mainImage` with the usual out vec4 colour.
// Nord additions: input `screen` (the running game picture, for post effects), custom uniforms (`setUniform`), `transparent` (use the shader's alpha), `scale` (render at a fraction of the size).
// Not supported: sound shaders (mainSound), video / webcam / microphone inputs, VR (mainVR).
import { registerEffect } from './effects.js';

const PREFIX_HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
out vec4 nordFragColor;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform float iChannelTime[4];
uniform vec3 iChannelResolution[4];
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
#define HW_PERFORMANCE 1
#define texture2D texture
#define textureCube texture
#define texture2DLodEXT textureLod
#define textureCubeLodEXT textureLod
`;
const VERT = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const PASSES = ['A', 'B', 'C', 'D', 'image'];
const KEYS_TEX = 256;

const wrapOf = (gl, w) => (w === 'clamp' ? gl.CLAMP_TO_EDGE : w === 'mirror' ? gl.MIRRORED_REPEAT : gl.REPEAT);

export class Shadertoy {
  /**
   * @param {object} o { code, common, buffers: { A: { code, channels }, … }, channels: [4 inputs of the Image pass], width, height, scale, transparent, loadImage(path) → HTMLImageElement|ImageBitmap,
   *                     audio (analyser provider: () => AnalyserNode|null), screen (canvas to sample for `screen` inputs) }
   * Channel inputs: { type: 'texture', src, filter: 'linear'|'nearest'|'mipmap', wrap: 'repeat'|'clamp'|'mirror', vflip }, { type: 'buffer', id: 'A' }, { type: 'keyboard' }, { type: 'audio' },
   *                 { type: 'cubemap', src: [6 paths] }, { type: 'screen' }, or null.
   */
  constructor(o = {}) {
    this.o = o; this.scale = o.scale ?? 1; this.transparent = !!o.transparent;
    this.canvas = o.canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    this.width = Math.max(1, Math.round((o.width ?? 640) * this.scale)); this.height = Math.max(1, Math.round((o.height ?? 360) * this.scale));
    this.canvas.width = this.width; this.canvas.height = this.height;
    const gl = this.gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('[nord] Shadertoy needs WebGL2');
    this.time = 0; this.frame = 0; this.dt = 1 / 60; this.mouse = [0, 0, 0, 0]; this.uniforms = new Map(); this.error = null; this.programs = new Map(); this.buffers = new Map();
    this.float = !!gl.getExtension('EXT_color_buffer_float'); this.half = !this.float && !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    this.keys = new Uint8Array(KEYS_TEX * 3); this.keyDown = new Set(); this.keyToggle = new Set(); this.keyPressed = new Set();
    this.vao = gl.createVertexArray();
    this.black = this.#tex2D(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.passes = [];
    const passDefs = { image: { code: o.code, channels: o.channels ?? [] }, ...(o.buffers ?? {}) };
    for (const name of PASSES) {
      const def = passDefs[name]; if (!def?.code) continue;
      this.passes.push({ name, def, channels: [null, null, null, null] });
    }
    this.ready = this.#init();
    if (typeof window !== 'undefined') {
      this._kd = (e) => { this.keyDown.add(e.keyCode); this.keyPressed.add(e.keyCode); if (this.keyToggle.has(e.keyCode)) this.keyToggle.delete(e.keyCode); else this.keyToggle.add(e.keyCode); };
      this._ku = (e) => { this.keyDown.delete(e.keyCode); };
      window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    }
  }
  async #init() {
    try {
      // buffers first: their textures must exist before any pass binds them
      for (const p of this.passes) if (p.name !== 'image') this.buffers.set(p.name, this.#makeBuffer());
      for (const p of this.passes) {
        for (let i = 0; i < 4; i++) p.channels[i] = await this.#makeChannel(p.def.channels?.[i] ?? null);
        p.program = this.#compile(p);
      }
    } catch (e) { this.error = e; throw e; }
  }
  // ---------------------------------------------------------------- compiling
  #compile(pass) {
    const gl = this.gl, decl = pass.channels.map((c, i) => `uniform ${c?.kind === 'cube' ? 'samplerCube' : 'sampler2D'} iChannel${i};`).join('\n');
    const user = (this.o.common ? `${this.o.common}\n` : '') + pass.def.code;
    const body = `${PREFIX_HEAD}${decl}\n#line 1\n${user}\nvoid main(){ vec4 c = vec4(0., 0., 0., 1.); mainImage(c, gl_FragCoord.xy); nordFragColor = ${this.transparent && pass.name === 'image' ? 'vec4(c.rgb, clamp(c.a, 0., 1.))' : pass.name === 'image' ? 'vec4(c.rgb, 1.)' : 'c'}; }`;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s) ?? ''; gl.deleteShader(s); throw new Error(`Shadertoy ${pass.name === 'image' ? 'Image' : `Buffer ${pass.name}`}: ${log.trim()}`); }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, body), prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Shadertoy link: ${gl.getProgramInfoLog(prog)}`);
    const names = ['iResolution', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iMouse', 'iDate', 'iSampleRate', 'iChannelTime[0]', 'iChannelResolution[0]', 'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3'];
    const loc = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
    return { prog, loc };
  }
  // ---------------------------------------------------------------- inputs
  #tex2D(data, w, h, { internal, format, type, filter = 'linear', wrap = 'clamp', mip = false } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal ?? gl.RGBA8, w, h, 0, format ?? gl.RGBA, type ?? gl.UNSIGNED_BYTE, data);
    this.#params(gl.TEXTURE_2D, filter, wrap, mip);
    return t;
  }
  #params(target, filter, wrap, mip) {
    const gl = this.gl;
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filter === 'nearest' ? gl.NEAREST : mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filter === 'nearest' ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapOf(gl, wrap)); gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapOf(gl, wrap));
  }
  #makeBuffer() {
    const gl = this.gl, internal = this.float ? gl.RGBA32F : this.half ? gl.RGBA16F : gl.RGBA8, type = this.float ? gl.FLOAT : this.half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const mk = () => { const t = this.#tex2D(null, this.width, this.height, { internal, type, filter: 'linear', wrap: 'clamp' }), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, fb }; };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { sides: [mk(), mk()], cur: 0 };
  }
  async #makeChannel(spec) {
    const gl = this.gl; if (!spec) return null;
    switch (spec.type) {
      case 'buffer': return { kind: '2d', buffer: spec.id, w: this.width, h: this.height };
      case 'screen': { const t = this.#tex2D(null, 1, 1, { filter: spec.filter ?? 'linear' }); return { kind: '2d', screen: true, t, w: 1, h: 1, spec }; }
      case 'keyboard': { const t = this.#tex2D(this.keys, KEYS_TEX, 3, { internal: gl.R8, format: gl.RED, filter: 'nearest' }); return { kind: '2d', keyboard: true, t, w: KEYS_TEX, h: 3 }; }
      case 'audio': { const t = this.#tex2D(new Uint8Array(512 * 2), 512, 2, { internal: gl.R8, format: gl.RED, filter: 'linear' }); return { kind: '2d', audio: true, t, w: 512, h: 2 }; }
      case 'cubemap': {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
        const imgs = await Promise.all((spec.src ?? []).slice(0, 6).map((p) => this.#image(p)));
        imgs.forEach((im, i) => gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im));
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return { kind: 'cube', t, w: imgs[0]?.width ?? 1, h: imgs[0]?.height ?? 1 };
      }
      default: { // texture
        const im = await this.#image(spec.src);
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, spec.vflip !== false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        const mip = (spec.filter ?? 'mipmap') === 'mipmap'; if (mip) gl.generateMipmap(gl.TEXTURE_2D);
        this.#params(gl.TEXTURE_2D, spec.filter ?? 'mipmap', spec.wrap ?? 'repeat', mip);
        return { kind: '2d', t, w: im.width, h: im.height };
      }
    }
  }
  async #image(path) {
    if (this.o.loadImage) return this.o.loadImage(path);
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error(`[nord] Shadertoy: cannot load ${path}`)); im.src = path; });
  }
  // ---------------------------------------------------------------- public state
  /** Set a custom uniform the shader declares itself (`uniform float uSpeed;`): number, [x, y], [x, y, z] or [x, y, z, w]. */
  setUniform(name, value) { this.uniforms.set(name, value); }
  /** Mouse in shader pixels (origin bottom-left, like Shadertoy): call each frame with the pointer position and whether the button is down. */
  setMouse(x, y, down) {
    const m = this.mouse;
    if (down) { if (!this._down) { m[2] = x; m[3] = y; } m[0] = x; m[1] = y; this._down = true; }
    else { if (this._down) { m[2] = -Math.abs(m[2]); m[3] = -Math.abs(m[3]); } this._down = false; }
  }
  /** Resize the render target (and the buffers). */
  resize(w, h) {
    w = Math.max(1, Math.round(w * this.scale)); h = Math.max(1, Math.round(h * this.scale));
    if (w === this.width && h === this.height) return;
    this.width = this.canvas.width = w; this.height = this.canvas.height = h;
    for (const [n] of this.buffers) { for (const s of this.buffers.get(n).sides) { this.gl.deleteTexture(s.t); this.gl.deleteFramebuffer(s.fb); } this.buffers.set(n, this.#makeBuffer()); }
    this.frame = 0;
  }
  /** Draw one frame (call every frame; `dt` in seconds). Returns the canvas. */
  render(dt = 1 / 60) {
    if (!this.passes.length || !this.passes.every((p) => p.program)) return this.canvas;
    this.dt = dt; this.time += dt;
    this.#uploadDynamic();
    const d = new Date();
    for (const p of this.passes) this.#run(p, d);
    this.frame++;
    this.keyPressed.clear();
    return this.canvas;
  }
  #uploadDynamic() {
    const gl = this.gl, k = this.keys; k.fill(0);
    for (const c of this.keyDown) if (c < KEYS_TEX) k[c] = 255;
    for (const c of this.keyPressed) if (c < KEYS_TEX) k[KEYS_TEX + c] = 255;
    for (const c of this.keyToggle) if (c < KEYS_TEX) k[2 * KEYS_TEX + c] = 255;
    const analyser = this.o.audio?.();
    for (const p of this.passes) for (const ch of p.channels) {
      if (!ch) continue;
      if (ch.keyboard) { gl.bindTexture(gl.TEXTURE_2D, ch.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, KEYS_TEX, 3, 0, gl.RED, gl.UNSIGNED_BYTE, k); }
      else if (ch.audio) {
        const data = new Uint8Array(512 * 2);
        if (analyser) { const f = new Uint8Array(analyser.frequencyBinCount), w = new Uint8Array(analyser.fftSize); analyser.getByteFrequencyData(f); analyser.getByteTimeDomainData(w); for (let i = 0; i < 512; i++) { data[i] = f[Math.floor(i * f.length / 512)] ?? 0; data[512 + i] = w[Math.floor(i * w.length / 512)] ?? 128; } }
        gl.bindTexture(gl.TEXTURE_2D, ch.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 512, 2, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      } else if (ch.screen && this.o.screen) {
        const src = typeof this.o.screen === 'function' ? this.o.screen() : this.o.screen; if (!src) continue;
        gl.bindTexture(gl.TEXTURE_2D, ch.t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); ch.w = src.width; ch.h = src.height; } catch { /* canvas not readable this frame */ }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
    }
  }
  #run(pass, d) {
    const gl = this.gl, { prog, loc } = pass.program, buf = pass.name === 'image' ? null : this.buffers.get(pass.name);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buf ? buf.sides[1 - buf.cur].fb : null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(prog); gl.bindVertexArray(this.vao);
    gl.uniform3f(loc.iResolution, this.width, this.height, 1); gl.uniform1f(loc.iTime, this.time); gl.uniform1f(loc.iTimeDelta, this.dt); gl.uniform1f(loc.iFrameRate, 1 / Math.max(this.dt, 1e-6));
    gl.uniform1i(loc.iFrame, this.frame); gl.uniform4f(loc.iMouse, ...this.mouse); gl.uniform4f(loc.iDate, d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000);
    gl.uniform1f(loc.iSampleRate, 44100);
    const res = new Float32Array(12), times = new Float32Array(4);
    pass.channels.forEach((ch, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      let tex = this.black, w = 1, h = 1, target = gl.TEXTURE_2D;
      if (ch?.kind === 'cube') { target = gl.TEXTURE_CUBE_MAP; tex = ch.t; w = ch.w; h = ch.h; }
      else if (ch?.buffer) { const b = this.buffers.get(ch.buffer); if (b) { tex = b.sides[b.cur].t; w = this.width; h = this.height; } }
      else if (ch) { tex = ch.t; w = ch.w; h = ch.h; }
      gl.bindTexture(target, tex); gl.uniform1i(loc[`iChannel${i}`], i);
      res[i * 3] = w; res[i * 3 + 1] = h; res[i * 3 + 2] = 1; times[i] = this.time;
    });
    gl.uniform3fv(loc['iChannelResolution[0]'], res); gl.uniform1fv(loc['iChannelTime[0]'], times);
    for (const [name, v] of this.uniforms) {
      const l = gl.getUniformLocation(prog, name); if (!l) continue;
      if (typeof v === 'number') gl.uniform1f(l, v); else if (Array.isArray(v)) [null, gl.uniform1f, gl.uniform2f, gl.uniform3f, gl.uniform4f][v.length]?.call(gl, l, ...v);
    }
    if (pass.name === 'image' && this.transparent) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (buf) buf.cur = 1 - buf.cur;
  }
  /** Restart: time, frame counter and every buffer back to the start (Shadertoy's rewind). */
  restart() { this.time = 0; this.frame = 0; const gl = this.gl; for (const b of this.buffers.values()) for (const s of b.sides) { gl.bindFramebuffer(gl.FRAMEBUFFER, s.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  destroy() {
    if (typeof window !== 'undefined') { window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); }
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ }
  }
}

/** Accept pasted Shadertoy code as it comes from the site: `mainImage` only, optional `Common` / Buffer tabs by comment marker. */
export function splitTabs(source) {
  const out = { common: '', buffers: {}, code: '' };
  const re = /^\/\/\s*=+\s*(Common|Buffer\s*([A-D])|Image)\s*=+\s*$/gim;
  const marks = [...source.matchAll(re)];
  if (!marks.length) { out.code = source; return out; }
  marks.forEach((m, i) => {
    const body = source.slice(m.index + m[0].length, marks[i + 1]?.index ?? source.length).trim();
    if (/^common/i.test(m[1])) out.common = body; else if (/^image/i.test(m[1])) out.code = body; else out.buffers[m[2].toUpperCase()] = { code: body };
  });
  return out;
}

/**
 * Build a Shadertoy from component / effect data: `code` or `file` (a .glsl asset, tabs split by `// ===== Buffer A =====` style markers), `buffers: { A: { code | file, channels } }`,
 * `channels: [...]`, `size`, `resolutionScale`, `transparent`, `uniforms`. Resolves once textures are loaded and every pass compiled; a compile error rejects with the GLSL message.
 */
export async function createShadertoy(game, d, extra = {}) {
  const text = async (v, f) => (f ? game.loader.text(f) : v ?? '');
  const main = splitTabs(await text(d.code, d.file));
  const buffers = {};
  for (const [name, b] of Object.entries(d.buffers ?? {})) buffers[name] = { code: await text(b.code, b.file), channels: b.channels ?? [] };
  for (const [name, b] of Object.entries(main.buffers)) buffers[name] = { channels: [], ...b, ...(buffers[name] ?? {}) };
  const loadImage = (path) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(`[nord] Shadertoy: cannot load ${path}`)); im.src = game.loader.url(path); });
  const st = new Shadertoy({
    code: main.code, common: d.common ?? main.common, buffers, channels: d.channels ?? [], width: extra.width, height: extra.height, scale: d.resolutionScale ?? 1,
    transparent: !!d.transparent, canvas: extra.canvas, loadImage, audio: () => game.audio?.analyser?.(), screen: extra.screen,
  });
  for (const [k, v] of Object.entries(d.uniforms ?? {})) st.setUniform(k, v);
  await st.ready;
  return st;
}

// ---------------------------------------------------------------- scene post effect:  game.effects.add('scene', 'shadertoy', { file: 'assets/shaders/crt.glsl', channels: [{ type: 'screen' }] })
// A canvas laid over the game canvas shows the shader after every frame; with a `screen` input the shader sees (and can change) the picture below it. `mix` = overlay opacity 0..1.
registerEffect('shadertoy', {
  defaults: { file: '', code: '', channels: [{ type: 'screen' }], buffers: {}, mix: 1, resolutionScale: 1, transparent: false, uniforms: {} },
  create(target, params, game) {
    if (target !== 'scene' || !game.effects.canvas || !game.backend?.onAfterRender) return null;
    const host = game.effects.host ?? game.effects.canvas.parentElement, game2d = game.effects.canvas;
    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:45;image-rendering:auto';
    host.appendChild(overlay);
    const h = { st: null, off: null, on: true };
    const place = () => { const r = game2d.getBoundingClientRect(), hr = host.getBoundingClientRect(); Object.assign(overlay.style, { left: `${r.left - hr.left}px`, top: `${r.top - hr.top}px`, width: `${r.width}px`, height: `${r.height}px`, opacity: String(params.mix ?? 1), display: h.on ? '' : 'none' }); };
    createShadertoy(game, params, { canvas: overlay, width: game2d.width, height: game2d.height, screen: () => game2d }).then((st) => {
      h.st = st;
      h.off = game.backend.onAfterRender(() => { if (!h.on) return; st.resize(game2d.width, game2d.height); place(); st.render(game.time.delta || 1 / 60); });
    }).catch((err) => game.reportError(err, { constructor: { name: 'shadertoy effect' } }, 'compile'));
    return {
      set: (k, v) => { if (k === 'mix') place(); else if (k === 'uniforms') for (const [n, x] of Object.entries(v)) h.st?.setUniform(n, x); },
      setEnabled: (b) => { h.on = b; place(); },
      remove: () => { h.off?.(); h.st?.destroy(); overlay.remove(); },
    };
  },
});
