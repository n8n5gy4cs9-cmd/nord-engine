// Unity-style coding layer (G10). Behaviour is modelled on Unity's public API names; no Unity code is used.
//   import { MonoBehaviour, Singleton, GameManager, Mathf, Vector3, Time, Input, SceneManager, WaitForSeconds } from 'nord/unity';
// Everything here is plain JS on top of NordScript/Entity/Scene — existing scripts keep working unchanged.
import { NordScript } from './script.js';
import { Game } from './game.js';
import { clamp, lerp } from './util.js';
import { bbox } from './behaviors/util.js';
import { runtimePlatform, RuntimePlatform, isEditor, isDesktopApp, isMobile, operatingSystem } from './platform.js';
export { RuntimePlatform };

const game = () => Game.current;

// ---------- Mathf ----------
const repeat = (t, len) => clamp(t - Math.floor(t / len) * len, 0, len);
export const Mathf = {
  PI: Math.PI, Infinity, Deg2Rad: Math.PI / 180, Rad2Deg: 180 / Math.PI, Epsilon: 1e-6,
  Abs: Math.abs, Min: Math.min, Max: Math.max, Sqrt: Math.sqrt, Pow: Math.pow, Sin: Math.sin, Cos: Math.cos, Tan: Math.tan, Atan2: Math.atan2,
  Floor: Math.floor, Ceil: Math.ceil, Round: Math.round, Sign: (v) => (v < 0 ? -1 : 1),
  FloorToInt: Math.floor, CeilToInt: Math.ceil, RoundToInt: Math.round,
  Clamp: (v, a, b) => Math.min(Math.max(v, a), b),
  Clamp01: (v) => Math.min(Math.max(v, 0), 1),
  Lerp: (a, b, t) => lerp(a, b, clamp(t, 0, 1)),
  LerpUnclamped: (a, b, t) => a + (b - a) * t,
  InverseLerp: (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1)),
  MoveTowards: (cur, target, maxDelta) => (Math.abs(target - cur) <= maxDelta ? target : cur + Math.sign(target - cur) * maxDelta),
  SmoothStep: (a, b, t) => { t = clamp(t, 0, 1); return a + (b - a) * (t * t * (3 - 2 * t)); },
  Repeat: repeat,
  PingPong: (t, len) => { t = repeat(t, len * 2); return len - Math.abs(t - len); },
  Approximately: (a, b) => Math.abs(a - b) < Math.max(1e-6 * Math.max(Math.abs(a), Math.abs(b)), 1e-8),
  DeltaAngle: (a, b) => { const d = repeat(b - a, 360); return d > 180 ? d - 360 : d; },
  LerpAngle: (a, b, t) => { const d = repeat(b - a, 360); return a + (d > 180 ? d - 360 : d) * clamp(t, 0, 1); },
  NegativeInfinity: -Infinity, Atan: Math.atan, Asin: Math.asin, Acos: Math.acos, Log: Math.log, Log10: Math.log10, Exp: Math.exp,
  /** Unity's SmoothDamp has a `ref` velocity; here pass the current velocity and get `{ value, velocity }` back. */
  SmoothDamp(cur, target, vel, smoothTime, maxSpeed = Infinity, dt = game()?.time.delta ?? 0.016) {
    smoothTime = Math.max(1e-4, smoothTime); const w = 2 / smoothTime, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let ch = cur - target; const lim = maxSpeed * smoothTime; ch = clamp(ch, -lim, lim);
    const tg = cur - ch, tmp = (vel + w * ch) * dt; vel = (vel - w * tmp) * e;
    let out = tg + (ch + tmp) * e; if ((target - cur > 0) === (out > target)) { out = target; vel = 0; }
    return { value: out, velocity: vel };
  },
  Random: (a = 0, b = 1) => a + (game()?.rng?.next?.() ?? Math.random()) * (b - a),
};

// ---------- Vector2 / Vector3 ----------
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  static get zero() { return new Vector3(0, 0, 0); }
  static get one() { return new Vector3(1, 1, 1); }
  static get up() { return new Vector3(0, 1, 0); }
  static get down() { return new Vector3(0, -1, 0); }
  static get left() { return new Vector3(-1, 0, 0); }
  static get right() { return new Vector3(1, 0, 0); }
  static get forward() { return new Vector3(0, 0, 1); }
  static get back() { return new Vector3(0, 0, -1); }
  static From(a) { return new Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0); }
  static Distance(a, b) { return a.Sub(b).magnitude; }
  static Dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  static Cross(a, b) { return new Vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  static Lerp(a, b, t) { t = clamp(t, 0, 1); return new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t)); }
  static MoveTowards(a, b, max) { const d = b.Sub(a), m = d.magnitude; return m <= max || m === 0 ? b.Clone() : a.Add(d.Mul(max / m)); }
  get magnitude() { return Math.hypot(this.x, this.y, this.z); }
  get sqrMagnitude() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  get normalized() { const m = this.magnitude; return m > 1e-9 ? this.Mul(1 / m) : new Vector3(); }
  Clone() { return new Vector3(this.x, this.y, this.z); }
  Add(v) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  Sub(v) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
  Mul(k) { return new Vector3(this.x * k, this.y * k, this.z * k); }
  Set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  Equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z; }
  toArray() { return [this.x, this.y, this.z]; }
  Scale(v) { return new Vector3(this.x * v.x, this.y * v.y, this.z * v.z); }
  Div(k) { return this.Mul(1 / k); }
  get negative() { return this.Mul(-1); }
  Normalize() { const n = this.normalized; return this.Set(n.x, n.y, n.z); }
  static Scale(a, b) { return a.Scale(b); }
  static Angle(a, b) { const d = a.magnitude * b.magnitude; return d < 1e-9 ? 0 : Math.acos(clamp(Vector3.Dot(a, b) / d, -1, 1)) * 180 / Math.PI; }
  static ClampMagnitude(v, max) { return v.sqrMagnitude > max * max ? v.normalized.Mul(max) : v.Clone(); }
  static Project(a, n) { const s = n.sqrMagnitude; return s < 1e-9 ? new Vector3() : n.Mul(Vector3.Dot(a, n) / s); }
  static Reflect(d, n) { return d.Sub(n.Mul(2 * Vector3.Dot(d, n))); }
  static Min(a, b) { return new Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)); }
  static Max(a, b) { return new Vector3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)); }
  static LerpUnclamped(a, b, t) { return new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }

  toString() { return `(${this.x}, ${this.y}, ${this.z})`; }
}
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  static get zero() { return new Vector2(0, 0); }
  static get one() { return new Vector2(1, 1); }
  static get up() { return new Vector2(0, 1); }
  static get down() { return new Vector2(0, -1); }
  static get left() { return new Vector2(-1, 0); }
  static get right() { return new Vector2(1, 0); }
  static From(a) { return new Vector2(a[0] ?? 0, a[1] ?? 0); }
  static Distance(a, b) { return a.Sub(b).magnitude; }
  static Dot(a, b) { return a.x * b.x + a.y * b.y; }
  static Lerp(a, b, t) { t = clamp(t, 0, 1); return new Vector2(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); }
  static MoveTowards(a, b, max) { const d = b.Sub(a), m = d.magnitude; return m <= max || m === 0 ? b.Clone() : a.Add(d.Mul(max / m)); }
  get magnitude() { return Math.hypot(this.x, this.y); }
  get sqrMagnitude() { return this.x * this.x + this.y * this.y; }
  get normalized() { const m = this.magnitude; return m > 1e-9 ? this.Mul(1 / m) : new Vector2(); }
  Clone() { return new Vector2(this.x, this.y); }
  Add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
  Sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
  Mul(k) { return new Vector2(this.x * k, this.y * k); }
  Set(x, y) { this.x = x; this.y = y; return this; }
  Equals(v) { return this.x === v.x && this.y === v.y; }
  toArray() { return [this.x, this.y]; }
  Scale(v) { return new Vector2(this.x * v.x, this.y * v.y); }
  Div(k) { return this.Mul(1 / k); }
  get negative() { return this.Mul(-1); }
  Normalize() { const n = this.normalized; return this.Set(n.x, n.y); }
  static Scale(a, b) { return a.Scale(b); }
  static Angle(a, b) { const d = a.magnitude * b.magnitude; return d < 1e-9 ? 0 : Math.acos(clamp(Vector2.Dot(a, b) / d, -1, 1)) * 180 / Math.PI; }
  static SignedAngle(a, b) { return (Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)) * 180 / Math.PI; }
  static ClampMagnitude(v, max) { return v.sqrMagnitude > max * max ? v.normalized.Mul(max) : v.Clone(); }
  static Reflect(d, n) { return d.Sub(n.Mul(2 * Vector2.Dot(d, n))); }
  static Perpendicular(v) { return new Vector2(-v.y, v.x); }
  static Min(a, b) { return new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)); }
  static Max(a, b) { return new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)); }
  static LerpUnclamped(a, b, t) { return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }

  toString() { return `(${this.x}, ${this.y})`; }
}

// ---------- Time, Debug, Input, PlayerPrefs, SceneManager (static facades over Game.current) ----------
let frames = 0;
export const Time = {
  get deltaTime() { return game()?.time.delta ?? 0; },
  get fixedDeltaTime() { return 1 / 60; },
  get time() { return game()?.time.elapsed ?? 0; },
  get timeScale() { return game()?.timeScale ?? 1; },
  set timeScale(v) { const g = game(); if (g) g.timeScale = v; },
  get frameCount() { return frames; },
  get unscaledDeltaTime() { const g = game(); return g ? g.time.delta / (g.timeScale || 1) : 0; },
  get fixedTime() { return game()?.time.elapsed ?? 0; },
  get realtimeSinceStartup() { return (globalThis.performance?.now?.() ?? Date.now()) / 1000; },
};
export const Debug = {
  Log: (...a) => game()?.log(...a) ?? console.log(...a),
  LogWarning: (...a) => console.warn(...a),
  LogError: (...a) => console.error(...a),
  Assert: (c, m = 'Assertion failed') => { if (!c) console.error(m); },
  LogFormat: (f, ...a) => Debug.Log(String(f).replace(/\{(\d+)\}/g, (_, i) => a[+i] ?? '')),
  DrawLine: () => {}, DrawRay: () => {}, Break: () => game()?.pause(),
};
const AXES = { Horizontal: ['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'], Vertical: ['KeyS', 'ArrowDown', 'KeyW', 'ArrowUp'] };
/** Unity's Input class (raw key codes: 'Space', 'KeyA', 'Mouse0'…; GetAxis('Horizontal'|'Vertical') or any pair of project actions). */
export const UnityInput = {
  GetKey: (code) => !!game()?.input.key(code),
  GetKeyDown: (code) => { const i = game()?.input; return !!i?.heldSnap?.has(code) && !i.heldPrev.has(code); },
  GetKeyUp: (code) => { const i = game()?.input; return !!i?.heldSnap && !i.heldSnap.has(code) && i.heldPrev.has(code); },
  GetButton: (action) => !!game()?.input.down(action),
  GetButtonDown: (action) => !!game()?.input.pressed(action),
  GetButtonUp: (action) => !!game()?.input.released(action),
  GetMouseButton: (n = 0) => !!game()?.input.key(`Mouse${n}`),
  GetMouseButtonDown: (n = 0) => UnityInput.GetKeyDown(`Mouse${n}`),
  GetMouseButtonUp: (n = 0) => UnityInput.GetKeyUp(`Mouse${n}`),
  GetAxisRaw: (name) => UnityInput.GetAxis(name),
  get anyKey() { return (game()?.input.held?.size ?? 0) > 0; },
  get anyKeyDown() { const i = game()?.input; return !!i?.heldSnap && [...i.heldSnap].some((k) => !i.heldPrev.has(k)); },
  GetAxis(name) {
    const i = game()?.input;
    if (!i) return 0;
    const a = AXES[name];
    if (a) { const x = (i.key(a[2]) || i.key(a[3]) ? 1 : 0) - (i.key(a[0]) || i.key(a[1]) ? 1 : 0); return name === 'Vertical' ? x : (Math.abs(i.stick[0]) > 0.2 ? i.stick[0] : x); }
    return i.axis(`${name}Negative`, `${name}Positive`);
  },
  get mousePosition() { const p = game()?.input.pointer; return new Vector2(p?.x ?? 0, p?.y ?? 0); },
};

/** Unity's KeyCode: `Input.GetKey(KeyCode.Space)`. Values are the browser key codes the engine already uses. */
export const KeyCode = (() => {
  const k = { Space: 'Space', Return: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', LeftShift: 'ShiftLeft', RightShift: 'ShiftRight',
    LeftControl: 'ControlLeft', RightControl: 'ControlRight', LeftAlt: 'AltLeft', RightAlt: 'AltRight', UpArrow: 'ArrowUp', DownArrow: 'ArrowDown', LeftArrow: 'ArrowLeft', RightArrow: 'ArrowRight',
    Mouse0: 'Mouse0', Mouse1: 'Mouse1', Mouse2: 'Mouse2' };
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') k[c] = `Key${c}`;
  for (let i = 0; i < 10; i++) { k[`Alpha${i}`] = `Digit${i}`; k[`Keypad${i}`] = `Numpad${i}`; }
  for (let i = 1; i <= 12; i++) k[`F${i}`] = `F${i}`;
  return Object.freeze(k);
})();
/** Unity's Random: `Range(0, 10)` with two integers is an int in [0, 10) like C#; use floats (`0.5, 1.5`) for a float in [min, max]. */
export const Random = {
  Range(a, b) { const r = Random.value; return Number.isInteger(a) && Number.isInteger(b) ? a + Math.floor(r * (b - a)) : a + r * (b - a); },
  get value() { return game()?.rng?.next?.() ?? Math.random(); },
  get insideUnitCircle() { const a = Random.value * Math.PI * 2, r = Math.sqrt(Random.value); return new Vector2(Math.cos(a) * r, Math.sin(a) * r); },
  get onUnitSphere() { const z = Random.value * 2 - 1, a = Random.value * Math.PI * 2, r = Math.sqrt(1 - z * z); return new Vector3(r * Math.cos(a), r * Math.sin(a), z); },
  get insideUnitSphere() { return Random.onUnitSphere.Mul(Math.cbrt(Random.value)); },
  Pick: (arr) => arr[Math.floor(Random.value * arr.length)],
  InitState: (seed) => { const g = game(); if (g?.rng) g.rng.s = seed >>> 0; },
};
/** Unity's Color (0..1 floats). `Color.red`, `new Color(1, 0.5, 0)`, `Color.Lerp(a, b, t)`, `c.toHex()` for sprite tints (`'#rrggbb'`). */
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; }
  static get red() { return new Color(1, 0, 0); } static get green() { return new Color(0, 1, 0); } static get blue() { return new Color(0, 0, 1); }
  static get white() { return new Color(1, 1, 1); } static get black() { return new Color(0, 0, 0); } static get yellow() { return new Color(1, 0.92, 0.016); }
  static get cyan() { return new Color(0, 1, 1); } static get magenta() { return new Color(1, 0, 1); } static get gray() { return new Color(0.5, 0.5, 0.5); }
  static get clear() { return new Color(0, 0, 0, 0); }
  static FromHex(h) { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(h); return m ? new Color(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, m[4] ? parseInt(m[4], 16) / 255 : 1) : new Color(); }
  static Lerp(a, b, t) { t = clamp(t, 0, 1); return new Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t), lerp(a.a, b.a, t)); }
  toHex() { const h = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'); return `#${h(this.r)}${h(this.g)}${h(this.b)}`; }
  Clone() { return new Color(this.r, this.g, this.b, this.a); }
}
/** `Screen.width/height` of the game canvas (window size when no canvas is known). */
export const Screen = {
  get width() { return globalThis.innerWidth ?? 0; },
  get height() { return globalThis.innerHeight ?? 0; },
};
/** Unity's Cursor: `Cursor.lockState = CursorLockMode.Locked` (FPS look), `Cursor.visible = false`. In the editor Esc unlocks (Settings). */
export const CursorLockMode = Object.freeze({ None: 'None', Locked: 'Locked', Confined: 'Confined' });
let lockState = 'None', cursorVisible = true;
const cv = () => globalThis.document?.querySelector('canvas');
export const Cursor = {
  get lockState() { return globalThis.document?.pointerLockElement ? 'Locked' : lockState === 'Locked' ? 'None' : lockState; },
  set lockState(v) {
    lockState = v;
    try { if (v === 'Locked') cv()?.requestPointerLock?.(); else globalThis.document?.exitPointerLock?.(); } catch { /* needs a user gesture */ }
  },
  get visible() { return cursorVisible; },
  set visible(v) { cursorVisible = !!v; const c = cv(); if (c) c.style.cursor = v ? '' : 'none'; },
};
/** 2D physics queries on the active physics backend. `Physics2D.OverlapBox(center, size)` → array of entities. */
export const Physics2D = {
  OverlapBox: (c, size) => game()?.physics?.overlapBox?.(c.x, c.y, size.x, size.y) ?? [],
};
export const PlayerPrefs = {
  GetInt: (k, d = 0) => game()?.save.get(k, d) ?? d,
  GetFloat: (k, d = 0) => game()?.save.get(k, d) ?? d,
  GetString: (k, d = '') => game()?.save.get(k, d) ?? d,
  SetInt: (k, v) => game()?.save.set(k, v),
  SetFloat: (k, v) => game()?.save.set(k, v),
  SetString: (k, v) => game()?.save.set(k, v),
  HasKey: (k) => !!game() && k in game().save.all(),
  DeleteAll: () => game()?.save.delete(),
};
export const SceneManager = {
  LoadScene: (path) => game()?.loadScene(path),
  get sceneName() { return game()?.scene?.name ?? ''; },
  ReloadScene: () => game()?.restart(),
};
/** `Application.Quit()` stops the game; `Application.targetFrameRate` is informational in the web runtime. */
export const Application = {
  /** Unity's RuntimePlatform string: 'OSXEditor' | 'WindowsEditor' | 'LinuxEditor' (in the Nord editor), 'OSXPlayer' | 'WindowsPlayer' | 'LinuxPlayer' (desktop app), 'WebGLPlayer' (browser), 'IPhonePlayer' | 'Android'. */
  get platform() { return runtimePlatform(); },
  /** true while playing inside the Nord editor (Unity's `Application.isEditor` / `#if UNITY_EDITOR`). */
  get isEditor() { return isEditor; },
  get isMobilePlatform() { return isMobile; },
  /** true in the exported desktop app (Mac / Windows / Linux shell). */
  get isDesktopApp() { return isDesktopApp; },
  /** true when running in a web page (exported web game or the editor's Game view). */
  get isWebPlayer() { return runtimePlatform() === 'WebGLPlayer' || isEditor; },
  /** The machine's OS regardless of the shell: 'mac' | 'win' | 'linux' | 'ios' | 'android'. */
  get os() { return operatingSystem(); },
  Quit: () => game()?.pause(),
  get isPlaying() { return !!game()?.scene?.running; },
};

// ---------- coroutines ----------
export class WaitForSeconds { constructor(sec) { this.sec = sec; } }
export class WaitForSecondsRealtime extends WaitForSeconds {}
export class WaitUntil { constructor(fn) { this.fn = fn; } }
export class WaitWhile { constructor(fn) { this.fn = () => !fn(); } }
export class WaitForFixedUpdate {}
export class WaitForEndOfFrame {}

class Coroutine {
  constructor(it) { this.stack = [it]; this.wait = null; this.done = false; this.fixedOnly = false; }
  /** Advance by one frame; `dt` is scaled seconds. */
  step(dt) {
    if (this.done) return;
    const w = this.wait;
    if (w instanceof WaitForSeconds) { w.left ??= w.sec; w.left -= dt; if (w.left > 0) return; }
    else if (w instanceof WaitUntil || w instanceof WaitWhile) { if (!w.fn()) return; }
    else if (w instanceof Coroutine) { if (!w.done) return; }
    this.wait = null;
    for (let guard = 0; guard < 1000; guard++) {
      const top = this.stack[this.stack.length - 1];
      const r = top.next();
      if (r.done) { this.stack.pop(); if (!this.stack.length) { this.done = true; return; } continue; }
      const v = r.value;
      if (v && typeof v.next === 'function' && typeof v[Symbol.iterator] === 'function') { this.stack.push(v); continue; } // yield nested IEnumerator
      if (v instanceof WaitForSeconds) { v.left = v.sec; if (v.sec <= 0) continue; }
      this.wait = v ?? null;
      return;
    }
  }
}

// ---------- MonoBehaviour ----------
/** Declare attributes Unity-style: `static attributes = SerializeField({ speed: 5, name: 'Bob', jump: { default: 3, min: 0, max: 10 } })`. */
export function SerializeField(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'default' in v) { out[k] = { type: typeof v.default === 'number' ? 'number' : 'string', ...v }; continue; }
    if (typeof v === 'number') out[k] = { type: 'number', default: v };
    else if (typeof v === 'boolean') out[k] = { type: 'bool', default: v };
    else if (typeof v === 'string') out[k] = { type: /^#[0-9a-f]{3,8}$/i.test(v) ? 'color' : 'string', default: v };
    else if (Array.isArray(v)) out[k] = { type: v.length === 3 ? 'vec3' : 'vec2', default: v };
  }
  return out;
}

/** `[Range(0, 10)]`: `SerializeField({ speed: Range(0, 10, 5) })` → slider. */
export const Range = (min, max, def = min) => ({ default: def, min, max });
/** Dropdown field: `SerializeField({ mode: Enum(['idle', 'chase'], 'idle') })`. */
export const Enum = (options, def = options[0]) => ({ type: 'enum', options, default: def });
/** Field that points at another object by name: `SerializeField({ target: EntityRef() })`, read it with `this.Find(this.target)`. */
export const EntityRef = (def = '') => ({ type: 'entity', default: def });

/**
 * Unity-flavoured script base. Subclass and write Awake/Start/Update/FixedUpdate/LateUpdate/OnEnable/OnDisable/OnDestroy and
 * OnCollisionEnter/Exit, OnTriggerEnter/Exit exactly like a C# MonoBehaviour. Attributes are readable as `this.speed`.
 * (Do not also define the lower-case nord names `init/start/update…` in the same class.)
 */
export class MonoBehaviour extends NordScript {
  constructor(entity, attrs = {}) {
    super(entity, attrs);
    this._co = [];
    this._inv = [];
    for (const k of Object.keys(attrs)) {
      if (!(k in this)) Object.defineProperty(this, k, { get() { return this.attrs[k]; }, set(v) { this.attrs[k] = v; }, enumerable: true, configurable: true });
    }
  }
  get gameObject() { return this.entity; }
  get transform() { return this.entity; }
  get tag() { return this.entity.tags[0] ?? 'Untagged'; }
  set tag(v) { this.entity.tags = [v]; }
  get name() { return this.entity.name; }
  get enabledSelf() { return this.entity.enabled; }
  CompareTag(t) { return this.entity.hasTag(t); }
  get position() { return Vector3.From(this.entity.worldPos); }
  set position(v) { this.entity.pos = v.toArray(); }
  get localPosition() { return Vector3.From(this.entity.pos); }
  set localPosition(v) { this.entity.pos = v.toArray(); }
  Translate(x, y = 0, z = 0) { const p = this.entity.pos; this.entity.pos = [p[0] + x, p[1] + y, p[2] + z]; }
  Rotate(x, y = 0, z = 0) { const r = this.entity.rot; this.entity.rot = [r[0] + x, r[1] + y, r[2] + z]; }


  // transform extras
  get localScale() { return Vector3.From(this.entity.scale); }
  set localScale(v) { this.entity.scale = v.toArray(); }
  get eulerAngles() { return Vector3.From(this.entity.rot); }
  set eulerAngles(v) { this.entity.rot = v.toArray(); }
  get parent() { return this.entity.parent ?? null; }
  get childCount() { return this.entity.children?.length ?? 0; }
  GetChild(i) { return this.entity.children?.[i] ?? null; }
  /** `transform.Find("Child")`: a descendant by name. */
  FindChild(name) { return this.entity.find(name); }
  get isActiveAndEnabled() { return this.entity.enabled; }
  /** `AddComponent<T>()`: pass a script class or a component type name (`'sprite'`). */
  AddComponent(type, data = {}) { return typeof type === 'function' ? this.entity.addScript(type, data) : this.entity.addComponent(type, data); }
  /** Face a point (2D: rotates Z in degrees so +X points at the target). */
  LookAt(target) { const t = target.worldPos ? Vector3.From(target.worldPos) : target, p = this.position; this.entity.rot = [this.entity.rot[0], this.entity.rot[1], Math.atan2(t.y - p.y, t.x - p.x) * 180 / Math.PI]; }
  /** Physics velocity (2D backends): `this.velocity = new Vector2(3, 0)`; reads the engine body when available. */
  get isGrounded() { return !!this.game.physics?.isGrounded?.(this.entity); }
  SetVelocity(x, y) { this.game.physics?.setVelocity?.(this.entity, x, y); }
  get velocity() { return Vector2.From(this.game.physics?.velocity?.(this.entity) ?? [0, 0]); }
  set velocity(v) { this.SetVelocity(v.x, v.y); }
  print(...a) { Debug.Log(...a); }

  // lookup — GetComponent('sprite' | 'Platform' | ScriptClass)
  GetComponent(type, entity = this.entity) {
    if (typeof type === 'function') return entity.getScript(type);
    return entity.getComponent(type) ?? entity.behavior(type) ?? null;
  }
  GetComponentInChildren(type) { for (const e of this.entity.all()) { const c = this.GetComponent(type, e); if (c) return c; } return null; }
  GetComponentInParent(type) { for (let e = this.entity; e; e = e.parent) { const c = this.GetComponent(type, e); if (c) return c; } return null; }
  GetComponents(type) { return [...this.entity.all()].map((e) => this.GetComponent(type, e)).filter(Boolean); }
  TryGetComponent(type) { return this.GetComponent(type); }
  Find(name) { return this.scene.find(name); }
  FindWithTag(tag) { return this.scene.findByTag(tag)[0] ?? null; }
  FindGameObjectsWithTag(tag) { return this.scene.findByTag(tag); }
  FindObjectOfType(Class) { for (const e of this.scene.all()) { const s = e.getScript(Class); if (s) return s; } return null; }
  FindObjectsOfType(Class) { return [...this.scene.all()].map((e) => e.getScript(Class)).filter(Boolean); }
  SetActive(on) { this.entity.enabled = !!on; }

  // spawn / destroy — Instantiate('prefabs/bullet.prefab.json', { pos, parent }) → Promise<Entity>; Instantiate(entity) clones it
  Instantiate(what, opts = {}) {
    if (typeof what === 'string') return this.scene.spawn(what, opts);
    const c = what.clone();
    return Promise.resolve(c).then((e) => { if (opts.pos) e.pos = opts.pos; return e; });
  }
  Destroy(obj = this.entity, delay = 0) {
    const e = obj?.entity ?? obj;
    if (delay > 0) this.scene.scheduler.after(delay, () => e.destroy()); else e.destroy();
  }

  // timing
  Invoke(method, sec) { const c = this.scene.scheduler.after(sec, () => this[method]?.()); this._inv.push({ method, c }); }
  InvokeRepeating(method, first, every) {
    let stop = null;
    const c0 = this.scene.scheduler.after(first, () => { this[method]?.(); stop.c = this.scene.scheduler.every(every, () => this[method]?.()); });
    stop = { method, c: c0, outer: c0 };
    this._inv.push({ method, get c() { return () => { stop.outer(); stop.c?.(); }; } });
  }
  CancelInvoke(method) { this._inv = this._inv.filter((i) => { if (!method || i.method === method) { i.c(); return false; } return true; }); }
  IsInvoking(method) { return this._inv.some((i) => i.method === method); }
  StartCoroutine(it) { if (typeof it === 'function') it = it.call(this); const co = new Coroutine(it); this._co.push(co); co.step(0); return co; }
  StopCoroutine(co) { co.done = true; this._co = this._co.filter((c) => c !== co); }
  StopAllCoroutines() { for (const c of this._co) c.done = true; this._co = []; }
  SendMessage(method, arg) { this.entity.callScripts(method, arg); }

  // lifecycle aliases (the nord names call the Unity names)
  init() { this.Awake?.(); }
  start() { this.Start?.(); }
  update(dt) {
    frames++;
    this._co = this._co.filter((c) => { c.step(dt); return !c.done; });
    this.#mouse();
    this.Update?.(dt);
  }
  /** OnMouseEnter/Exit/Over/Down/Up/Drag/UpAsButton — pointer vs. the object's bounding box (only polled when defined). */
  #mouse() {
    if (!(this.OnMouseEnter || this.OnMouseExit || this.OnMouseOver || this.OnMouseDown || this.OnMouseUp || this.OnMouseDrag || this.OnMouseUpAsButton)) return;
    const p = this.game.input.pointer, b = bbox(this.entity);
    const inside = this.entity.enabled && p.worldX >= b.l && p.worldX <= b.r && p.worldY >= b.t && p.worldY <= b.b;
    const m = (this._m ??= { inside: false, down: false });
    if (inside && !m.inside) this.OnMouseEnter?.();
    if (!inside && m.inside) this.OnMouseExit?.();
    if (inside) this.OnMouseOver?.();
    if (inside && p.down && !m.down) { m.held = true; this.OnMouseDown?.(); }
    if (m.held && p.down) this.OnMouseDrag?.();
    if (m.held && !p.down) { m.held = false; this.OnMouseUp?.(); if (inside) this.OnMouseUpAsButton?.(); }
    m.inside = inside; m.down = p.down;
  }
  fixedUpdate(dt) { this.FixedUpdate?.(dt); }
  lateUpdate(dt) { this.LateUpdate?.(dt); }
  onEnable() { this.OnEnable?.(); }
  onDisable() { this.OnDisable?.(); }
  onDestroy() { this.StopAllCoroutines(); this.CancelInvoke(); this.OnDestroy?.(); }
  onCollisionEnter(o, c) { this.OnCollisionEnter?.(o, c); }
  onCollisionExit(o, c) { this.OnCollisionExit?.(o, c); }
  onTriggerEnter(o, c) { this.OnTriggerEnter?.(o, c); }
  onTriggerExit(o, c) { this.OnTriggerExit?.(o, c); }
}


// ---------- free functions (Unity lets you call these without `this.`) ----------
/** `Instantiate('prefabs/bullet.prefab.json', { pos })` → Promise<Entity>; `Instantiate(entity)` clones. */
export function Instantiate(what, opts = {}) {
  const sc = game()?.scene;
  if (typeof what === 'string') return sc.spawn(what, opts);
  return Promise.resolve(what.clone()).then((e) => { if (opts.pos) e.pos = opts.pos; return e; });
}
/** `Destroy(entityOrScript, delay)` */
export function Destroy(obj, delay = 0) {
  const e = obj?.entity ?? obj, sc = game()?.scene;
  if (delay > 0) sc.scheduler.after(delay, () => e.destroy()); else e.destroy();
}
/** `DontDestroyOnLoad(entity)`: adds the Persist behavior. */
export function DontDestroyOnLoad(obj) { const e = obj?.entity ?? obj; if (!e.behavior('Persist')) e.addBehavior('Persist'); }
export const GameObject = {
  Find: (name) => game()?.scene.find(name) ?? null,
  FindWithTag: (tag) => game()?.scene.findByTag(tag)[0] ?? null,
  FindGameObjectsWithTag: (tag) => game()?.scene.findByTag(tag) ?? [],
};
const UnityObject = {
  FindObjectOfType: (C) => { for (const e of game()?.scene.all() ?? []) { const s = e.getScript(C); if (s) return s; } return null; },
  FindObjectsOfType: (C) => [...(game()?.scene.all() ?? [])].map((e) => e.getScript(C)).filter(Boolean),
  Instantiate, Destroy, DontDestroyOnLoad,
};
/** Unity's `Object`; exported as `UnityObject` because a binding named `Object` would shadow the JS global. */
export { UnityObject };

// ---------- Singleton ----------
/**
 * `class Score extends Singleton {}` → `Score.instance` anywhere. A second instance destroys itself (with a warning).
 * `static persistent = true` keeps the entity across scene loads (adds the Persist behavior).
 */
export class Singleton extends MonoBehaviour {
  static persistent = false;
  static get instance() {
    const i = Object.hasOwn(this, '_instance') ? this._instance : null;
    return i && !i.entity.destroyed ? i : null;
  }
  /** Find the singleton or throw a readable error. */
  static require() {
    const i = this.instance;
    if (!i) throw new Error(`${this.name}.instance is not available — add the ${this.name} script to an entity in the scene`);
    return i;
  }
  init() {
    const C = this.constructor;
    const cur = C.instance;
    if (cur && cur !== this) { this.warn(`second ${C.name} found, destroying the duplicate`); this.entity.destroy(); return; }
    // register on the class and on every base class below Singleton, so a subclass of GameManager is also reachable as GameManager.instance
    for (let k = C; k && k !== Singleton; k = Object.getPrototypeOf(k)) k._instance = this;
    if (C.persistent && !this.entity.behavior('Persist')) this.entity.addBehavior('Persist');
    super.init();
  }
  onDestroy() {
    const C = this.constructor;
    for (let k = C; k && k !== Singleton; k = Object.getPrototypeOf(k)) if (Object.hasOwn(k, '_instance') && k._instance === this) k._instance = null;
    super.onDestroy();
  }
}

// ---------- ready-made services ----------
/**
 * GameManager: score / lives / state store with events, pause and scene loading. Persistent by default.
 *   GameManager.instance.AddScore(10); GameManager.instance.SetState('gameover'); GameManager.instance.LoadScene('scenes/menu.scene.json')
 * Events (game.events): 'score' {score}, 'lives' {lives}, 'state' {state, previous}, 'gameover'.
 */
export class GameManager extends Singleton {
  static persistent = true;
  static attributes = SerializeField({ startLives: 3, startState: 'playing' });
  init() {
    super.init();
    if (this.entity.destroyed) return;
    this.score = 0; this.lives = this.attrs.startLives; this.state = this.attrs.startState;
    this.data = {}; // free-form store
  }
  AddScore(n = 1) { this.score += n; this.game.events.emit('score', { score: this.score }); return this.score; }
  SetLives(n) { this.lives = Math.max(0, n); this.game.events.emit('lives', { lives: this.lives }); if (this.lives === 0) this.GameOver(); }
  LoseLife() { this.SetLives(this.lives - 1); }
  SetState(s) { const previous = this.state; this.state = s; this.game.events.emit('state', { state: s, previous }); }
  GameOver() { this.SetState('gameover'); this.game.events.emit('gameover', { score: this.score }); }
  Get(key, def) { return key in this.data ? this.data[key] : def; }
  Set(key, v) { this.data[key] = v; this.game.events.emit('data', { key, value: v }); }
  Pause() { this.game.pause(); this.SetState('paused'); }
  Resume() { this.game.resume(); this.SetState('playing'); }
  TogglePause() { this.game.paused ? this.Resume() : this.Pause(); }
  LoadScene(path) { return this.game.loadScene(path); }
  Restart() { this.score = 0; this.lives = this.attrs.startLives; this.state = this.attrs.startState; return this.game.restart(); }
  SaveHighScore(key = 'highscore') { if (this.score > this.game.save.get(key, 0)) this.game.save.set(key, this.score); return this.game.save.get(key, 0); }
}

/** AudioManager: `AudioManager.instance.PlaySfx('audio/jump.ogg')`, `PlayMusic(path)`, volume per bus. Persistent. */
export class AudioManager extends Singleton {
  static persistent = true;
  PlaySfx(path, opts = {}) { return this.game.audio?.play(path, { bus: 'sfx', ...opts }); }
  PlayMusic(path, opts = {}) { return this.game.audio?.play(path, { bus: 'music', loop: true, ...opts }); }
  StopMusic(opts) { this.game.audio?.stopMusic(opts); }
  SetVolume(bus, v) { this.game.audio?.volume(bus, v); }
  Mute(bus = 'master', on = true) { this.game.audio?.mute(bus, on); }
}

// ---------- events, data assets, pools ----------
/** C# UnityEvent: AddListener / RemoveListener / Invoke. */
export class UnityEvent {
  #l = new Set();
  AddListener(fn) { this.#l.add(fn); return () => this.#l.delete(fn); }
  RemoveListener(fn) { this.#l.delete(fn); }
  RemoveAllListeners() { this.#l.clear(); }
  Invoke(...a) { for (const f of [...this.#l]) f(...a); }
  get listenerCount() { return this.#l.size; }
}
/** Global pub/sub: EventBus.Subscribe('hit', fn) → unsubscribe; EventBus.Publish('hit', data). Uses game.events. */
export const EventBus = {
  Subscribe: (name, fn) => game()?.events.on(name, fn),
  Publish: (name, data) => game()?.events.emit(name, data),
};
const assetCache = new Map();
/** ScriptableObject-style data assets: JSON files (e.g. `data/sword.asset.json`) loaded once and shared. `await ScriptableObject.Load(path)`. */
export const ScriptableObject = {
  async Load(path) {
    if (!assetCache.has(path)) assetCache.set(path, game().loadJSON(path));
    return assetCache.get(path);
  },
  Clear() { assetCache.clear(); },
};
/** Prefab pool: entities are disabled instead of destroyed. `const pool = new ObjectPool(scene, 'prefabs/bullet.prefab.json'); const b = await pool.Get({ pos }); pool.Release(b);` */
export class ObjectPool {
  #free = [];
  constructor(scene, prefab) { this.scene = scene; this.prefab = prefab; }
  async Warm(n) { for (let i = 0; i < n; i++) { const e = await this.scene.spawn(this.prefab); e.enabled = false; this.#free.push(e); } }
  async Get(opts = {}) {
    let e = this.#free.pop();
    while (e && e.destroyed) e = this.#free.pop();
    if (!e) e = await this.scene.spawn(this.prefab, opts);
    else { if (opts.pos) e.pos = opts.pos; if (opts.rot) e.rot = opts.rot; e.enabled = true; }
    return e;
  }
  Release(e) { if (e.destroyed) return; e.enabled = false; this.#free.push(e); }
  get countInactive() { return this.#free.length; }
}

/** The whole layer as one object (`Unity.Mathf`…), handy for event-sheet expressions and the console. */
export const Unity = { Cursor, CursorLockMode, RuntimePlatform, Mathf, Vector2, Vector3, Color, Random, KeyCode, Screen, Physics2D, GameObject, Time, Debug, Input: UnityInput, PlayerPrefs, SceneManager, Application, EventBus, ScriptableObject };
