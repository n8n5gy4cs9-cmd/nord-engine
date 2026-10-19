// Phaser 4 (WebGL) implementation of core effects — `filters.internal` on the camera (whole scene) or on an entity's display objects.
import { hexNum } from '../core/effects.js';

const COLOR_OPS = { // colour-matrix based
  brightness: (m, p) => m.brightness(p.value, false), contrast: (m, p) => m.contrast(p.value, false), saturate: (m, p) => m.saturate(p.value - 1, false),
  hue: (m, p) => m.hue(p.degrees, false), grayscale: (m, p) => m.grayscale(p.value, false), sepia: (m, p) => m.sepia(false), negative: (m) => m.negative(false),
};

export function createEffect(backend, target, type, params) {
  const P = globalThis.Phaser;
  if (!P) return null;
  const objs = target === 'scene' ? [backend.scene.cameras.main] : target.components.map((c) => c.obj).filter((o) => o?.enableFilters);
  const fxOf = (o) => { if (target !== 'scene') o.enableFilters(); return o.filters?.internal ?? null; };
  const made = [];
  for (const o of objs) {
    const fx = fxOf(o);
    if (!fx) continue;
    let c;
    switch (type) {
      case 'blur': c = fx.addBlur(0, params.x, params.y, params.strength); break;
      case 'glow': c = fx.addGlow(hexNum(params.color), params.outerStrength, params.innerStrength); break;
      case 'pixelate': c = fx.addPixelate(params.amount); break;
      case 'vignette': c = fx.addVignette(params.x, params.y, params.radius, params.strength); break;
      case 'barrel': c = fx.addBarrel(params.amount); break;
      default: if (COLOR_OPS[type]) { c = fx.addColorMatrix(); COLOR_OPS[type](c.colorMatrix, params); } else return null;
    }
    made.push([o, fx, c]);
  }
  if (!made.length) return null;
  const apply = (k, v, h) => {
    for (const [, , c] of made) {
      if (COLOR_OPS[type]) { c.colorMatrix.reset(); COLOR_OPS[type](c.colorMatrix, h.params); continue; }
      c[k] = k === 'color' ? hexNum(v) : v;
    }
  };
  return {
    set: apply,
    setEnabled: (b) => { for (const [, , c] of made) c.active = b; },
    remove: () => { for (const [, fx, c] of made) { try { fx.remove(c); } catch { /* object already destroyed */ } } },
  };
}
