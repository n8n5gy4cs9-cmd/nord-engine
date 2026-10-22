// Unity-style coding layer (G10). Behaviour is modelled on Unity's public API names; no Unity code is used.
//   import { MonoBehaviour, Singleton, GameManager, Mathf, Vector3, Time, Input, SceneManager, WaitForSeconds } from 'nord/unity';
// Everything here is plain JS on top of NordScript/Entity/Scene — existing scripts keep working unchanged.
import { NordScript } from './script.js';
import { Game } from './game.js';
import { clamp, lerp } from './util.js';

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
};
export const Debug = {
  Log: (...a) => game()?.log(...a) ?? console.log(...a),
  LogWarning: (...a) => console.warn(...a),
  LogError: (...a) => console.error(...a),
  Assert: (c, m = 'Assertion failed') => { if (!c) console.error(m); },
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
  GetAxis(name) {
    const i = game()?.input;
    if (!i) return 0;
    const a = AXES[name];
    if (a) { const x = (i.key(a[2]) || i.key(a[3]) ? 1 : 0) - (i.key(a[0]) || i.key(a[1]) ? 1 : 0); return name === 'Vertical' ? x : (Math.abs(i.stick[0]) > 0.2 ? i.stick[0] : x); }
    return i.axis(`${name}Negative`, `${name}Positive`);
  },
  get mousePosition() { const p = game()?.input.pointer; return new Vector2(p?.x ?? 0, p?.y ?? 0); },
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
  Quit: () => game()?.pause(),
  get isPlaying() { return !!game()?.scene?.running; },
};

// ---------- coroutines ----------
export class WaitForSeconds { constructor(sec) { this.sec = sec; } }
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
    this.Update?.(dt);
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
    C._instance = this;
    if (C.persistent && !this.entity.behavior('Persist')) this.entity.addBehavior('Persist');
    super.init();
  }
  onDestroy() {
    const C = this.constructor;
    if (Object.hasOwn(C, '_instance') && C._instance === this) C._instance = null;
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
export const Unity = { Mathf, Vector2, Vector3, Time, Debug, Input: UnityInput, PlayerPrefs, SceneManager, Application, EventBus, ScriptableObject };
