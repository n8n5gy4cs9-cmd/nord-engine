// Unity classes for the line / shape renderers: LineRenderer, TrailRenderer, SpriteMask, SpriteShapeController (+ SpriteShapeRenderer), and the curve types they use:
// AnimationCurve, Keyframe, Gradient, GradientColorKey, GradientAlphaKey.
//   const line = go.AddComponent(LineRenderer); line.positionCount = 3; line.SetPosition(0, Vector3.zero); line.startWidth = 0.5; line.startColor = Color.yellow;
import { Vector2, Vector3, Color } from './unity.js';
import { ComponentBase, registerUnityComponent } from './unity-extra.js';
import { simplify } from './strip.js';

// ---------------------------------------------------------------- AnimationCurve / Gradient
/** Unity's Keyframe: `time`, `value`, in/out tangents (used for smooth curves). */
export class Keyframe { constructor(time = 0, value = 0, inTangent = 0, outTangent = 0) { Object.assign(this, { time, value, inTangent, outTangent }); } }
export const WrapMode = Object.freeze({ Clamp: 'Clamp', Loop: 'Loop', PingPong: 'PingPong', Once: 'Once', ClampForever: 'ClampForever', Default: 'Default' });
/** Unity's AnimationCurve: `new AnimationCurve(new Keyframe(0, 0), new Keyframe(1, 1))`, `Evaluate(t)`, `AddKey`, `keys`, presets `Linear`, `EaseInOut`, `Constant`. */
export class AnimationCurve {
  constructor(...keys) { this.keys = keys.flat().filter(Boolean).sort((a, b) => a.time - b.time); this.preWrapMode = 'Clamp'; this.postWrapMode = 'Clamp'; }
  static Linear(t0, v0, t1, v1) { const s = t1 === t0 ? 0 : (v1 - v0) / (t1 - t0); return new AnimationCurve(new Keyframe(t0, v0, s, s), new Keyframe(t1, v1, s, s)); }
  static EaseInOut(t0, v0, t1, v1) { return new AnimationCurve(new Keyframe(t0, v0, 0, 0), new Keyframe(t1, v1, 0, 0)); }
  static Constant(t0, t1, v) { return new AnimationCurve(new Keyframe(t0, v), new Keyframe(t1, v)); }
  get length() { return this.keys.length; }
  AddKey(a, b) { const k = a instanceof Keyframe ? a : new Keyframe(a, b); this.keys.push(k); this.keys.sort((x, y) => x.time - y.time); return this.keys.indexOf(k); }
  RemoveKey(i) { this.keys.splice(i, 1); }
  MoveKey(i, k) { this.keys[i] = k; this.keys.sort((x, y) => x.time - y.time); return this.keys.indexOf(k); }
  Evaluate(t) {
    const k = this.keys; if (!k.length) return 0;
    const t0 = k[0].time, t1 = k.at(-1).time;
    if (t <= t0 || t >= t1) {
      const wrap = t <= t0 ? this.preWrapMode : this.postWrapMode;
      if (wrap === 'Loop' && t1 > t0) t = t0 + (((t - t0) % (t1 - t0)) + (t1 - t0)) % (t1 - t0);
      else if (wrap === 'PingPong' && t1 > t0) { const L = t1 - t0, m = ((t - t0) % (2 * L) + 2 * L) % (2 * L); t = t0 + (m > L ? 2 * L - m : m); }
      else return t <= t0 ? k[0].value : k.at(-1).value;
    }
    let i = 0; while (i + 1 < k.length && t > k[i + 1].time) i++;
    const a = k[i], b = k[i + 1], dt = b.time - a.time, u = dt === 0 ? 0 : (t - a.time) / dt, u2 = u * u, u3 = u2 * u;
    if (!Number.isFinite(a.outTangent) || !Number.isFinite(b.inTangent)) return a.value; // infinite tangent = stepped
    return (2 * u3 - 3 * u2 + 1) * a.value + (u3 - 2 * u2 + u) * dt * a.outTangent + (-2 * u3 + 3 * u2) * b.value + (u3 - u2) * dt * b.inTangent; // cubic Hermite
  }
  /** `[[t, value]…]` for the component data (sampled when the curve has tangents). */
  toPoints(samples = 16) { const k = this.keys; if (!k.length) return [[0, 1], [1, 1]]; const t0 = k[0].time, t1 = k.at(-1).time; return Array.from({ length: samples + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / samples; return [(t - t0) / ((t1 - t0) || 1), this.Evaluate(t)]; }); }
}
export class GradientColorKey { constructor(color = Color.white, time = 0) { this.color = color; this.time = time; } }
export class GradientAlphaKey { constructor(alpha = 1, time = 0) { this.alpha = alpha; this.time = time; } }
export const GradientMode = Object.freeze({ Blend: 'Blend', Fixed: 'Fixed' });
/** Unity's Gradient: `SetKeys(colorKeys, alphaKeys)`, `Evaluate(t)` → Color. */
export class Gradient {
  constructor() { this.colorKeys = [new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1)]; this.alphaKeys = [new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 1)]; this.mode = 'Blend'; }
  SetKeys(colorKeys, alphaKeys) { this.colorKeys = [...colorKeys].sort((a, b) => a.time - b.time); this.alphaKeys = [...alphaKeys].sort((a, b) => a.time - b.time); }
  Evaluate(t) {
    const pick = (keys, f) => {
      if (!keys.length) return null;
      if (t <= keys[0].time) return f(keys[0], keys[0], 0);
      if (t >= keys.at(-1).time) return f(keys.at(-1), keys.at(-1), 0);
      for (let i = 0; i + 1 < keys.length; i++) if (t <= keys[i + 1].time) { const a = keys[i], b = keys[i + 1]; return f(a, b, this.mode === 'Fixed' ? 0 : (t - a.time) / ((b.time - a.time) || 1)); }
      return f(keys.at(-1), keys.at(-1), 0);
    };
    const c = pick(this.colorKeys, (a, b, k) => new Color(a.color.r + (b.color.r - a.color.r) * k, a.color.g + (b.color.g - a.color.g) * k, a.color.b + (b.color.b - a.color.b) * k, 1)) ?? Color.white;
    c.a = pick(this.alphaKeys, (a, b, k) => a.alpha + (b.alpha - a.alpha) * k) ?? 1;
    return c;
  }
  /** `[[t, '#rrggbb', alpha]…]` for the component data. */
  toStops() { const ts = [...new Set([...this.colorKeys.map((k) => k.time), ...this.alphaKeys.map((k) => k.time)])].sort((a, b) => a - b); return ts.map((t) => { const c = this.Evaluate(t); return [t, c.toHex(), c.a]; }); }
}

// ---------------------------------------------------------------- shared helpers
const v3 = (p) => new Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
const colorOf = (hex) => Color.FromHex(hex ?? '#ffffff');
class RendererBase extends ComponentBase {
  get enabled() { return this.comp?.data.componentEnabled !== false && this.entity.enabled; }
  set enabled(on) { this.entity.enabled = !!on; }
  get sortingOrder() { return this.entity.layer; }
  set sortingOrder(v) { this.entity.layer = v; this.entity.touch(); }
  get startWidth() { return this.data.startWidth ?? this.data.width ?? 1; }
  set startWidth(v) { this.set_('startWidth', v); }
  get endWidth() { return this.data.endWidth ?? this.startWidth; }
  set endWidth(v) { this.set_('endWidth', v); }
  get widthMultiplier() { return this.data.widthMultiplier ?? 1; }
  set widthMultiplier(v) { this.set_('widthMultiplier', v); }
  get widthCurve() { const p = this.data.widthCurve; return p ? new AnimationCurve(...p.map(([t, v]) => new Keyframe(t, v))) : AnimationCurve.Constant(0, 1, 1); }
  set widthCurve(c) { this.set_('widthCurve', c.toPoints()); }
  get startColor() { return colorOf(this.data.startColor); }
  set startColor(c) { this.set_('startColor', c.toHex()); this.set_('alpha', c.a); if (this.data.colors) this.set_('colors', null); }
  get endColor() { return colorOf(this.data.endColor ?? this.data.startColor); }
  set endColor(c) { this.set_('endColor', c.toHex()); if (this.data.colors) this.set_('colors', null); }
  get colorGradient() { const g = new Gradient(); const s = this.data.colors; if (s) g.SetKeys(s.map(([t, c]) => new GradientColorKey(colorOf(c), t)), s.map(([t, , a]) => new GradientAlphaKey(a ?? 1, t))); else g.SetKeys([new GradientColorKey(this.startColor, 0), new GradientColorKey(this.endColor, 1)], [new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 1)]); return g; }
  set colorGradient(g) { this.set_('colors', g.toStops()); }
  get numCornerVertices() { return this.data.cornerVertices ?? 0; }
  set numCornerVertices(v) { this.set_('cornerVertices', v); }
  get numCapVertices() { return this.data.capVertices ?? 0; }
  set numCapVertices(v) { this.set_('capVertices', v); }
  get alignment() { return this.data.alignment ?? 'View'; }
  set alignment(v) { this.set_('alignment', v); }
}

// ---------------------------------------------------------------- LineRenderer
export class LineRenderer extends RendererBase {
  static nord = 'lineRenderer';
  static Of(e) { return e.getComponent('lineRenderer') ? new this(e) : null; }
  get positionCount() { return (this.data.points ?? []).length; }
  set positionCount(n) { const p = [...(this.data.points ?? [])]; while (p.length < n) p.push([...(p.at(-1) ?? [0, 0, 0])]); p.length = n; this.set_('points', p); }
  SetPosition(i, v) { const p = [...(this.data.points ?? [])]; if (i >= p.length) { this.positionCount = i + 1; return this.SetPosition(i, v); } p[i] = [v.x, v.y, v.z ?? 0]; this.set_('points', p); }
  GetPosition(i) { return v3(this.data.points?.[i] ?? [0, 0, 0]); }
  SetPositions(arr) { this.set_('points', [...arr].map((v) => [v.x, v.y, v.z ?? 0])); }
  GetPositions(into = []) { const p = (this.data.points ?? []).map(v3); into.length = 0; into.push(...p); return p.length; }
  get loop() { return !!this.data.loop; }
  set loop(v) { this.set_('loop', !!v); }
  get useWorldSpace() { return !!this.data.useWorldSpace; }
  set useWorldSpace(v) { this.set_('useWorldSpace', !!v); }
  /** Remove points that do not change the shape by more than `tolerance`. */
  Simplify(tolerance) { this.set_('points', simplify((this.data.points ?? []).map((p) => [p[0], p[1], p[2] ?? 0]), tolerance)); }
  get textureMode() { return this.data.textureMode ?? 'Stretch'; }
  set textureMode(v) { this.set_('textureMode', v); }
}

// ---------------------------------------------------------------- TrailRenderer
export class TrailRenderer extends RendererBase {
  static nord = 'trailRenderer';
  static Of(e) { return e.getComponent('trailRenderer') ? new this(e) : null; }
  get time() { return this.data.time ?? 1; }
  set time(v) { this.set_('time', v); }
  get minVertexDistance() { return this.data.minVertexDistance ?? 4; }
  set minVertexDistance(v) { this.set_('minVertexDistance', v); }
  get emitting() { return this.comp?.emitting ?? this.data.emitting !== false; }
  set emitting(v) { this.set_('emitting', !!v); }
  get autodestruct() { return !!this.data.autodestruct; }
  set autodestruct(v) { this.set_('autodestruct', !!v); }
  get positionCount() { return this.comp?.pts?.length ?? 0; }
  /** Forget the trail so far. */
  Clear() { this.comp?.clear?.(); }
  AddPosition(v) { this.comp?.add?.(v.x, v.y, v.z ?? 0); }
  GetPosition(i) { const p = this.comp?.pts?.[i]; return p ? (p.p ? v3(p.p) : new Vector3(p.x, p.y, 0)) : Vector3.zero; }
}

// ---------------------------------------------------------------- SpriteMask
/** SpriteMask: `shape` ('rect' | 'circle' | 'texture'), `size`, `radius`. Sprites opt in with `spriteRenderer.maskInteraction = SpriteMaskInteraction.VisibleInsideMask`. */
export const SpriteMaskInteraction = Object.freeze({ None: 'none', VisibleInsideMask: 'visibleInsideMask', VisibleOutsideMask: 'visibleOutsideMask' });
export class SpriteMask extends ComponentBase {
  static nord = 'spriteMask';
  static Of(e) { return e.getComponent('spriteMask') ? new this(e) : null; }
  get enabled() { return this.entity.enabled; }
  set enabled(on) { this.entity.enabled = !!on; }
  get shape() { return this.data.shape ?? 'rect'; }
  set shape(v) { this.set_('shape', v); }
  get size() { return new Vector2(...(this.data.size ?? [64, 64])); }
  set size(v) { this.set_('size', [v.x, v.y]); }
  get radius() { return this.data.radius ?? 32; }
  set radius(v) { this.set_('radius', v); }
  /** The mask picture (path of a texture); the opaque part masks. */
  get sprite() { return this.data.texture ?? null; }
  set sprite(p) { this.set_('texture', p); this.set_('shape', 'texture'); }
  get alphaCutoff() { return this.data.alphaCutoff ?? 0.2; }
  set alphaCutoff(v) { this.set_('alphaCutoff', v); }
}

// ---------------------------------------------------------------- SpriteShape
/** The control points of a SpriteShape: Unity's `spline`. Smoothing replaces tangents: `SetTangentMode(i, ShapeTangentMode.Continuous)` smooths the whole outline. */
class Spline {
  constructor(ctl) { this.c = ctl; }
  get pts() { return this.c.data.points ?? []; }
  GetPointCount() { return this.pts.length; }
  GetPosition(i) { const p = this.pts[i] ?? [0, 0]; return new Vector3(p[0], p[1], 0); }
  SetPosition(i, v) { const p = [...this.pts]; p[i] = [v.x, v.y]; this.c.set_('points', p); }
  InsertPointAt(i, v) { const p = [...this.pts]; p.splice(i, 0, [v.x, v.y]); this.c.set_('points', p); }
  RemovePointAt(i) { const p = [...this.pts]; p.splice(i, 1); this.c.set_('points', p); }
  Clear() { this.c.set_('points', []); }
  SetTangentMode(_i, mode) { this.c.set_('smooth', mode !== 'Linear' && mode !== 0); }
  get isOpenEnded() { return this.c.data.closed === false; }
  set isOpenEnded(v) { this.c.set_('closed', !v); }
}
export const ShapeTangentMode = Object.freeze({ Linear: 'Linear', Continuous: 'Continuous', Broken: 'Broken' });
export class SpriteShapeController extends ComponentBase {
  static nord = 'spriteShape';
  static Of(e) { return e.getComponent('spriteShape') ? new this(e) : null; }
  get spline() { return (this._spline ??= new Spline(this)); }
  get splineDetail() { return this.data.splineDetail ?? 8; }
  set splineDetail(v) { this.set_('splineDetail', v); }
  get autoUpdateCollider() { return !!this.data.generateCollider; }
  set autoUpdateCollider(v) { this.set_('generateCollider', !!v); }
  get fillColor() { return colorOf(this.data.fillColor ?? '#3a5f2c'); }
  set fillColor(c) { this.set_('fillColor', c.toHex()); }
  get edgeColor() { return colorOf(this.data.edgeColor ?? '#7bc043'); }
  set edgeColor(c) { this.set_('edgeColor', c.toHex()); }
  get edgeWidth() { return this.data.edgeWidth ?? 0; }
  set edgeWidth(v) { this.set_('edgeWidth', v); }
  /** Redraw after changing the spline (the component also does it by itself on the next frame). */
  RefreshSpriteShape() { this.set_('points', [...(this.data.points ?? [])]); }
  BakeMesh() { this.RefreshSpriteShape(); }
}
export { SpriteShapeController as SpriteShapeRenderer };

registerUnityComponent('LineRenderer', LineRenderer, 'lineRenderer');
registerUnityComponent('TrailRenderer', TrailRenderer, 'trailRenderer');
registerUnityComponent('SpriteMask', SpriteMask, 'spriteMask');
registerUnityComponent('SpriteShapeController', SpriteShapeController, 'spriteShape');
registerUnityComponent('SpriteShapeRenderer', SpriteShapeController, 'spriteShape');
