// NordScript base class + attribute handling. See docs/SCRIPTING_API.md.
export class NordScript {
  constructor(entity, attrs = {}) {
    this.entity = entity;
    this.attrs = attrs;
  }
  get scene() { return this.entity.scene; }
  get game() { return this.entity.scene.game; }
  get input() { return this.game.input; }
  get audio() { return this.game.audio; }
  get time() { return this.game.time; }
  get events() { return this.game.events; }
  get ui() { return this.game.ui; }
  get physics() { return this.game.physics; }
  get save() { return this.game.save; }
  get rng() { return this.game.rng; }
  tween(target, to, opts) { return this.scene.scheduler.tween(target, to, opts); }
  after(sec, fn) { return this.scene.scheduler.after(sec, fn); }
  every(sec, fn) { return this.scene.scheduler.every(sec, fn); }
}

const coerce = {
  number: (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d),
  int: (v, d) => (Number.isInteger(v) ? v : d),
  bool: (v, d) => (typeof v === 'boolean' ? v : d),
  string: (v, d) => (typeof v === 'string' ? v : d),
  color: (v, d) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d),
  vec2: (v, d) => (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? v : d),
  vec3: (v, d) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : d),
  entity: (v, d) => (typeof v === 'string' ? v : d),
  asset: (v, d) => (typeof v === 'string' ? v : d),
};

/** Merge scene-provided attribute values over the class's `static attributes` defaults, validating types, clamping min/max. */
export function resolveAttributes(Class, given = {}, warn = console.warn) {
  const out = {};
  const defs = Class?.attributes ?? {};
  for (const [k, def] of Object.entries(defs)) {
    const d = structuredClone(def.default);
    let v = k in given ? given[k] : d;
    if (def.type === 'enum') v = def.options?.includes(v) ? v : (def.options?.includes(d) ? d : def.options?.[0]);
    else if (def.type === 'array') v = Array.isArray(v) ? v : d ?? [];
    else if (def.type === 'curve') v = v ?? d;
    else if (coerce[def.type]) {
      const c = coerce[def.type](v, d);
      if (c !== v && k in given) warn(`[nord] attribute '${k}' expected ${def.type}, got ${JSON.stringify(v)}; using default`);
      v = c;
    }
    if (typeof v === 'number') {
      if (def.min != null) v = Math.max(def.min, v);
      if (def.max != null) v = Math.min(def.max, v);
    }
    out[k] = v;
  }
  for (const k of Object.keys(given)) if (!(k in defs)) warn(`[nord] unknown attribute '${k}' on ${Class?.name ?? 'script'}`);
  return out;
}
