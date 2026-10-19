// NordScrap compatibility layer. The original game (made for the earlier NordScrap engine) draws every frame with
// immediate-mode calls: Draw2D.fillRect/drawText/..., Input.getKeyDown, Audio.play, Scene.load, SaveLoad. This module gives
// those globals a canvas + Nord audio/save backing so the game code runs unchanged. Colours are 0..1 floats.

const FONT = '"MS VT323", VT323, ui-monospace, monospace';
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', return: 'Enter', enter: 'Enter', space: 'Space', escape: 'Escape', tab: 'Tab', backquote: 'Backquote' };
const codeOf = (name) => {
  const k = String(name).toLowerCase();
  if (KEYS[k]) return KEYS[k];
  if (/^[a-z]$/.test(k)) return `Key${k.toUpperCase()}`;
  if (/^[0-9]$/.test(k)) return `Digit${k}`;
  return name;
};
const css = (r, g, b, a = 1) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

/** Builds the NordScrap globals. host: { audio, save, container, width, height, onSceneLoad(path) }. */
export function createCompat(host) {
  const W = host.width, H = host.height, K = host.pixelScale ?? 4;
  const canvas = document.createElement('canvas');
  canvas.width = W * K; canvas.height = H * K;
  canvas.style.cssText = 'position:absolute;left:50%;top:50%;background:#000;touch-action:none;outline:none';
  canvas.tabIndex = 0;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top'; ctx.setTransform(K, 0, 0, K, 0, 0);
  host.container.appendChild(canvas);
  const fit = () => {
    const r = host.container.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H) || 1;
    canvas.style.width = `${W * s}px`; canvas.style.height = `${H * s}px`;
    canvas.style.transform = 'translate(-50%,-50%)';
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(host.container); fit();

  // ---- Input -------------------------------------------------------------
  const held = new Set(), down = new Set(), up = new Set();
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!held.has(e.code)) down.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backquote'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => { held.delete(e.code); up.add(e.code); };
  const onBlur = () => { held.clear(); down.clear(); up.clear(); };
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
  const Input = {
    getKey: (n) => held.has(codeOf(n)),
    getKeyDown: (n) => down.has(codeOf(n)),
    getKeyUp: (n) => up.has(codeOf(n)),
  };
  // Virtual key injection (touch buttons): press(code) acts like a key tap.
  const tap = (code) => { down.add(code); up.add(code); };

  // ---- Draw2D ------------------------------------------------------------
  const images = new Map();
  const getImage = (p) => {
    let im = images.get(p);
    if (!im) { im = new Image(); im.src = p; images.set(p, im); }
    return im;
  };
  const tintBuf = document.createElement('canvas'), tctx = tintBuf.getContext('2d');
  const Draw2D = {
    fillRect(x, y, w, h, r, g, b, a = 1) { ctx.fillStyle = css(r, g, b, a); ctx.fillRect(x, y, w, h);
      if(w>100&&h>25&&h<H-20&&w<W-1&&r<0.32&&g<0.22&&b<0.42&&a>=0.85){
        ctx.strokeStyle='#89516f';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
        ctx.fillStyle='#cb9366';ctx.fillRect(x+2,y+2,w-4,1);
      }
    },
    drawRect(x, y, w, h, r, g, b, a = 1, lw = 1) { ctx.strokeStyle = css(r, g, b, a); ctx.lineWidth = lw; ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); },
    // 8th/9th args are NordScrap's (segments,) lineWidth: any of them present means "outline", the last one is the width.
    drawCircle(x, y, rad, r, g, b, a = 1, p8, p9) {
      const lw = p9 ?? p8;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2);
      if (lw != null) { ctx.strokeStyle = css(r, g, b, a); ctx.lineWidth = lw; ctx.stroke(); } else { ctx.fillStyle = css(r, g, b, a); ctx.fill(); }
    },
    drawLine(x1, y1, x2, y2, r, g, b, a = 1, lw = 1) { ctx.strokeStyle = css(r, g, b, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    drawRegion(x,y,w,h,path,sx,sy,sw,sh,a=1) {
      const im=getImage(path); if(!im.complete||!im.naturalWidth)return;
      ctx.imageSmoothingEnabled=false;ctx.globalAlpha=a;
      ctx.drawImage(im,sx*im.naturalWidth,sy*im.naturalHeight,sw*im.naturalWidth,sh*im.naturalHeight,x,y,w,h);ctx.globalAlpha=1;
    },
    drawRegionRotated(x,y,w,h,path,sx,sy,sw,sh,angle) {
      const im=getImage(path);if(!im.complete||!im.naturalWidth)return;
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);
      ctx.drawImage(im,sx*im.naturalWidth,sy*im.naturalHeight,sw*im.naturalWidth,sh*im.naturalHeight,-w/2,-h/2,w,h);ctx.restore();
    },
    drawImage(x, y, w, h, path, r = 1, g = 1, b = 1, a = 1) {
      const im = getImage(path);
      if (!im.complete || !im.naturalWidth) return;
      ctx.imageSmoothingEnabled = false;
      if (r >= 0.99 && g >= 0.99 && b >= 0.99) { ctx.globalAlpha = a; ctx.drawImage(im, x, y, w, h); ctx.globalAlpha = 1; return; }
      tintBuf.width = Math.max(1, Math.ceil(w * K)); tintBuf.height = Math.max(1, Math.ceil(h * K));
      tctx.imageSmoothingEnabled = false; tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, tintBuf.width, tintBuf.height);
      tctx.drawImage(im, 0, 0, tintBuf.width, tintBuf.height);
      tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = css(r, g, b, 1); tctx.fillRect(0, 0, tintBuf.width, tintBuf.height);
      tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(im, 0, 0, tintBuf.width, tintBuf.height);
      ctx.globalAlpha = a; ctx.drawImage(tintBuf, x, y, w, h); ctx.globalAlpha = 1;
    },
    drawText(x, y, text, r, g, b, a = 1, scale = 0.6) {
      ctx.font = `${Math.max(6, Math.round(scale * 22))}px ${FONT}`; ctx.fillStyle = css(r, g, b, a); ctx.textAlign = 'left'; ctx.fillText(String(text), x, y);
    },
    drawTextAligned(x, y, text, align, r, g, b, a = 1, scale = 0.6) {
      ctx.font = `${Math.max(6, Math.round(scale * 22))}px ${FONT}`; ctx.fillStyle = css(r, g, b, a);
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'; ctx.fillText(String(text), x, y); ctx.textAlign = 'left';
    },
    measureText(text, scale = 0.6) { ctx.font = `${Math.max(6, Math.round(scale * 22))}px ${FONT}`; return ctx.measureText(String(text)).width; },
  };

  // ---- Audio -------------------------------------------------------------
  const Audio = {
    play(path, volume = 1) { try { host.audio?.play(path, { volume, bus: 'sfx' }); } catch { /* silent like the original */ } },
    playMusic(path, loop = true, volume = 1) { try { host.audio?.music(path, { fade: 0.6, volume }); } catch { /* ignore */ } },
    stopMusic() { try { host.audio?.stopMusic({ fade: 0.4 }); } catch { /* ignore */ } },
  };

  // ---- Scene / Screen / Time / Camera / Style / SaveLoad ------------------
  let sceneName = 'Title Screen', clear = { r: 0, g: 0, b: 0, a: 1 }, t0 = performance.now();
  const effects = new Set(); let fx = { filmGrainAmount: 0.04, vignetteRadius: 0.75, vignetteSoftness: 0.35 };
  const Scene = {
    getSceneName: () => sceneName,
    load(path) { sceneName = /overworld/.test(path) ? 'Overworld Map' : 'Title Screen'; host.onSceneLoad?.(path); },
  };
  const Screen = { getWidth: () => W, getHeight: () => H, getPlatform: () => 'web' };
  const Time = { getTime: () => (performance.now() - t0) / 1000 };
  const Camera = {
    getPrimary: () => 1, getClearColor: () => ({ ...clear }),
    setClearColor(_id, r, g, b, a = 1) { clear = { r, g, b, a }; },
  };
  const Style = { addEffect: (n) => effects.add(n), configure: (o) => { fx = { ...fx, ...o }; } };
  // The remade games use raster sprites; no flattened 3D primitive renderer is needed.
  const GameObject = { findByTag: () => 1, destroy() {} };
  const SaveLoad = {
    save: (k, v) => host.save?.set(k, v),
    load: (k) => host.save?.get(k, null) ?? null,
    exists: (k) => host.save?.get(k, null) != null,
    delete: (k) => host.save?.set(k, null),
  };

  // Film grain + vignette ("Style" effects) are composited once per frame after the game has drawn.
  const grain = document.createElement('canvas'); grain.width = grain.height = 128;
  const gctx = grain.getContext('2d');
  const regrain = () => { const d = gctx.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } gctx.putImageData(d, 0, 0); };
  regrain();
  let frame = 0;
  return {
    globals: { Draw2D, Input, Audio, Scene, Screen, Time, Camera, Style, GameObject, SaveLoad },
    canvas, tap,
    resetInput() { held.clear(); down.clear(); up.clear(); },
    beginFrame() { ctx.setTransform(K, 0, 0, K, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = css(clear.r, clear.g, clear.b, 1); ctx.fillRect(0, 0, W, H); },
    endFrame() {
      if (effects.has('filmgrain') && fx.filmGrainAmount > 0) {
        if (++frame % 3 === 0) regrain();
        ctx.save(); ctx.globalAlpha = fx.filmGrainAmount; ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      if (effects.has('vignette')) {
        const rad = Math.hypot(W, H) / 2, inner = rad * Math.max(0, fx.vignetteRadius - fx.vignetteSoftness);
        const gr = ctx.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, rad);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
      down.clear(); up.clear();
    },
    destroy() { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); ro?.disconnect(); canvas.remove(); },
  };
}

/** Tiny CommonJS loader: fetches ./name.js sources once, evaluates them sloppy-mode (as NordScrap did) with the globals injected. */
export async function loadModules(base, names, globals) {
  const src = {};
  await Promise.all(names.map(async (n) => {
    const r = await fetch(`${base}/${n}.js`);
    if (!r.ok) throw new Error(`midnight-sun: cannot load ${n}.js (${r.status})`);
    src[n] = await r.text();
  }));
  const cache = {};
  const gnames = Object.keys(globals), gvals = Object.values(globals);
  const require = (p) => {
    const n = String(p).replace(/^\.\//, '').replace(/\.js$/, '');
    if (cache[n]) return cache[n].exports;
    if (src[n] == null) throw new Error(`midnight-sun: unknown module ${p}`);
    const module = { exports: {} }; cache[n] = module;
    // eslint-disable-next-line no-new-func
    const fn = new Function('require', 'module', 'exports', ...gnames, `${src[n]}\n//# sourceURL=midnight-sun/${n}.js\n;return typeof MidnightSunTour!=='undefined'?MidnightSunTour:undefined;`);
    const main = fn(require, module, module.exports, ...gvals);
    if (main) module.exports = main;
    return module.exports;
  };
  return require;
}
