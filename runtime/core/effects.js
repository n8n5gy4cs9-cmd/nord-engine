// Visual effects (M10-19), Construct-style effect stacks on the whole scene or on single objects.
//   scene.json  "settings": { "effects": [ { "type": "vignette", "strength": 0.6 }, { "type": "crt" } ] }
//   entity JSON "effects":   [ { "type": "glow", "color": "#ffd166", "outerStrength": 6 } ]
//   code: game.effects.add('scene' | entity, 'blur', { x: 4 }) → handle { set(param, value), remove(), enabled }
//   sheets: Effects → Add / Set parameter / Remove / Clear;  object ACEs Add effect, Set effect parameter.
// Backends implement `createEffect(target, type, params)` (Phaser: Phaser 4 filters, see runtime/phaser/effects.js). Scene-level effects that
// CSS can do (blur, colour grading, vignette, CRT) also work on every other tier through the fallback below.
export const EFFECT_TYPES = {
  blur: { x: 2, y: 2, strength: 1 }, glow: { color: '#ffffff', outerStrength: 4, innerStrength: 0 },
  pixelate: { amount: 4 },
  vignette: { x: 0.5, y: 0.5, radius: 0.5, strength: 0.5 }, barrel: { amount: 0.4 },
  brightness: { value: 1.2 }, contrast: { value: 1.2 }, saturate: { value: 1.5 }, hue: { degrees: 90 },
  grayscale: { value: 1 }, sepia: { value: 1 }, negative: { value: 1 }, crt: { intensity: 0.4 },
};
const CSS_FILTER = {
  blur: (p) => `blur(${(p.strength ?? 1) * Math.max(p.x ?? 2, p.y ?? 2) / 2}px)`,
  brightness: (p) => `brightness(${p.value})`, contrast: (p) => `contrast(${p.value})`, saturate: (p) => `saturate(${p.value})`,
  hue: (p) => `hue-rotate(${p.degrees}deg)`, grayscale: (p) => `grayscale(${p.value})`, sepia: (p) => `sepia(${p.value})`, negative: (p) => `invert(${p.value})`,
};
const CUSTOM = new Map(); // addon effects with their own implementation
/** Addons: registerEffect('warm', { defaults: { value: 1 }, css: (p) => `sepia(${p.value})` }) — css works on the scene level on every tier; create(target, params, game) → { set, setEnabled, remove } for anything else. */
export function registerEffect(type, def) { EFFECT_TYPES[type] = { ...def.defaults }; if (def.css) CSS_FILTER[type] = def.css; if (def.create) CUSTOM.set(type, def.create); }
const hexNum = (c) => (typeof c === 'number' ? c : parseInt(String(c).replace('#', '').slice(0, 6), 16) || 0);
export { hexNum };

/** DOM fallback for a scene-level effect. `el` = the canvas, `host` = its position:relative container. */
function cssEffect(type, params, el, host, all) {
  const doc = host.ownerDocument;
  const apply = () => { el.style.filter = all.filter((h) => h.enabled && CSS_FILTER[h.type]).map((h) => CSS_FILTER[h.type](h.params)).join(' '); };
  if (CSS_FILTER[type]) return { set: apply, remove: apply, setEnabled: apply, css: true, applyNow: apply };
  if (type === 'vignette' || type === 'crt') {
    const o = doc.createElement('div');
    o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50';
    host.appendChild(o);
    const paint = (p, on) => {
      o.style.display = on ? '' : 'none';
      o.style.background = type === 'vignette'
        ? `radial-gradient(ellipse at ${(p.x ?? 0.5) * 100}% ${(p.y ?? 0.5) * 100}%, transparent ${Math.max(0, 1 - (p.radius ?? 0.5) * 1.4) * 100}%, rgba(0,0,0,${p.strength ?? 0.5}) 100%)`
        : `repeating-linear-gradient(to bottom, rgba(0,0,0,${p.intensity ?? 0.4}) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,${(p.intensity ?? 0.4) * 1.2}) 100%)`;
    };
    return { set: (k, v, h) => paint(h.params, h.enabled), remove: () => o.remove(), setEnabled: (b, h) => paint(h.params, b), init: (h) => paint(h.params, h.enabled), css: true };
  }
  return null;
}

export class Effects {
  constructor(game) { this.game = game; this.list = []; }
  /** Element/host used by the CSS fallback (boot sets these). */
  attach(canvas, host) { this.canvas = canvas; this.host = host; }
  add(target, type, given = {}) {
    const defaults = EFFECT_TYPES[type];
    if (!defaults) { this.game.warn(`[nord] unknown effect '${type}'`); return null; }
    const h = { type, target, params: { ...defaults, ...given }, enabled: true, impl: null, game: this.game };
    const native = CUSTOM.get(type)?.(target, h.params, this.game) ?? this.game.backend?.createEffect?.(target, type, h.params);
    if (native) h.impl = native;
    else if (target === 'scene' && this.canvas) {
      this.list.push(h); // so the CSS filter stack sees it
      h.impl = cssEffect(type, h.params, this.canvas, this.host ?? this.canvas.parentElement, this.list.filter((x) => x.target === 'scene'));
      this.list.pop();
    }
    if (!h.impl) { this.game.warn(`[nord] effect '${type}' is not available on ${target === 'scene' ? 'this backend' : 'this object'}`); return null; }
    h.set = (k, v) => { h.params[k] = v; h.impl.set?.(k, v, h); h.impl.applyNow?.(); };
    h.setEnabled = (b) => { h.enabled = !!b; h.impl.setEnabled?.(h.enabled, h); h.impl.applyNow?.(); };
    h.remove = () => { const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); h.impl.remove?.(h); h.impl.applyNow?.(); };
    this.list.push(h);
    h.impl.init?.(h); h.impl.applyNow?.();
    return h;
  }
  find(target, type) { return this.list.find((h) => h.target === target && h.type === type) ?? null; }
  of(target) { return this.list.filter((h) => h.target === target); }
  clear(target) { for (const h of this.of(target)) h.remove(); }
  /** Apply a JSON effect list (`settings.effects` / entity `effects`). */
  addAll(target, list) { return (list ?? []).map(({ type, enabled, ...p }) => { const h = this.add(target, type, p); if (h && enabled === false) h.setEnabled(false); return h; }).filter(Boolean); }
  /** Drop handles of destroyed entities (called on scene change). */
  prune() { this.list = this.list.filter((h) => h.target === 'scene' || !h.target.destroyed); }
}
