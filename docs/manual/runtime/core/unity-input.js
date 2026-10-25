// Unity input, part 2: mouse / scroll axes, project-defined axes with smoothing, touches in full, device sensors (accelerometer, gyroscope, compass, location),
// and the New Input System (InputAction, InputActionMap, InputActionAsset incl. Unity's .inputactions JSON, PlayerInput, Keyboard / Mouse / Gamepad / Touchscreen .current).
// Behaviour is modelled on Unity's public API names; the device layer is the engine's own Input (keys, pointer, touches, gamepad, sensors).
//
//   import { Input, InputAction, InputActionAsset, PlayerInput, Keyboard, Mouse, Gamepad } from 'nord';
//   const move = new InputAction('Move', 'Value'); move.AddCompositeBinding('2DVector').With('Up', '<Keyboard>/w')…; move.Enable(); move.ReadValue();
import { Game } from './game.js';
import { clamp } from './util.js';
import { Vector2, Vector3, UnityInput } from './unity.js';
import { Quaternion } from './unity-extra.js';
import { UnityEvent } from './unity.js';

const game = () => Game.current;
const inp = () => game()?.input;
const warned = new Set();
const warnOnce = (m) => { if (!warned.has(m)) { warned.add(m); console.warn(`[nord] ${m}`); } };

// ---------------------------------------------------------------- Input: axes
/** Unity's TouchPhase. */
export const TouchPhase = Object.freeze({ Began: 'Began', Moved: 'Moved', Stationary: 'Stationary', Ended: 'Ended', Canceled: 'Canceled' });
export const TouchType = Object.freeze({ Direct: 'Direct', Indirect: 'Indirect', Stylus: 'Stylus' });
export const DeviceOrientation = Object.freeze({ Unknown: 'Unknown', Portrait: 'Portrait', PortraitUpsideDown: 'PortraitUpsideDown', LandscapeLeft: 'LandscapeLeft', LandscapeRight: 'LandscapeRight', FaceUp: 'FaceUp', FaceDown: 'FaceDown' });
export const LocationServiceStatus = Object.freeze({ Stopped: 'Stopped', Initializing: 'Initializing', Running: 'Running', Failed: 'Failed' });

const axisState = new Map(); // name → { value, frame } for smoothed axes
const baseGetAxis = UnityInput.GetAxis;
/** Axes: "Mouse X", "Mouse Y", "Mouse ScrollWheel", project `input.axes` (Unity InputManager style) and Horizontal / Vertical / any pair of actions. */
function rawAxis(name) {
  const i = inp(); if (!i) return 0;
  switch (name) {
    case 'Mouse X': return i.mouseDelta[0] * 0.1;
    case 'Mouse Y': return -i.mouseDelta[1] * 0.1;
    case 'Mouse ScrollWheel': return -i.wheel[1] * 0.1;
    default: break;
  }
  const def = game()?.project?.input?.axes?.[name];
  if (def) {
    const keys = (k) => [].concat(k ?? []).some((c) => i.key(c));
    let v = (keys(def.positive) || keys(def.altPositive) ? 1 : 0) - (keys(def.negative) || keys(def.altNegative) ? 1 : 0);
    if (def.joyAxis != null && Math.abs(i.pad.axes[def.joyAxis] ?? 0) > (def.dead ?? 0.19)) v = i.pad.axes[def.joyAxis];
    return def.invert ? -v : v;
  }
  return baseGetAxis(name);
}
const SMOOTH = new Set(['Horizontal', 'Vertical']);
UnityInput.GetAxisRaw = (name) => rawAxis(name);
UnityInput.GetAxis = (name) => {
  const g = game(), def = g?.project?.input?.axes?.[name], i = g?.input;
  const smooth = (def ? def.smooth !== false : SMOOTH.has(name)) && (UnityInput.smoothAxes ?? g?.project?.input?.smoothAxes ?? false);
  const raw = rawAxis(name);
  if (!smooth || !i) return raw;
  const st = axisState.get(name) ?? { value: 0, t: g.time.elapsed - (g.time.delta || 1 / 60) }, now = g.time.elapsed;
  if (now !== st.t) { // advance once per frame (or by the whole time since the last read), whatever the number of GetAxis calls
    const dt = Math.max(0, now - st.t), sens = def?.sensitivity ?? 3, grav = def?.gravity ?? 3, snap = def?.snap ?? true;
    if (raw !== 0) {
      if (snap && st.value !== 0 && Math.sign(raw) !== Math.sign(st.value)) st.value = 0;
      st.value = clamp(st.value + Math.sign(raw) * sens * dt, -Math.abs(raw), Math.abs(raw));
    } else {
      const d = grav * dt;
      st.value = Math.abs(st.value) <= d ? 0 : st.value - Math.sign(st.value) * d;
    }
    st.t = now;
  }
  axisState.set(name, st);
  const dead = def?.dead ?? 0.001;
  return Math.abs(st.value) < dead ? 0 : st.value;
};

// ---------------------------------------------------------------- Input: touches, text, misc
const touchOf = (t) => ({
  fingerId: t.id, position: new Vector2(t.x, t.y), rawPosition: new Vector2(t.x, t.y), deltaPosition: new Vector2(t.dx ?? 0, t.dy ?? 0),
  deltaTime: game()?.time.delta ?? 0, tapCount: t.tapCount ?? 1, phase: t.phase ?? 'Moved', pressure: t.pressure || (t.phase === 'Ended' ? 0 : 1),
  maximumPossiblePressure: 1, type: 'Direct', altitudeAngle: t.altitude ?? 0, azimuthAngle: t.azimuth ?? 0, radius: t.radius ?? 0, radiusVariance: 0,
});
UnityInput.GetTouch = (i) => UnityInput.touches[i] ?? null;
const fakeEvents = [];
Object.defineProperties(UnityInput, {
  touches: { configurable: true, get() { return [...(inp()?.touches?.values() ?? [])].map(touchOf); } },
  touchCount: { configurable: true, get() { return inp()?.touches?.size ?? 0; } },
  inputString: { configurable: true, get() { return inp()?.typed ?? ''; } },
  touchPressureSupported: { configurable: true, get() { return true; } },
  stylusTouchSupported: { configurable: true, get() { return false; } },
  multiTouchEnabled: { configurable: true, get() { return true; }, set() {} },
  simulateMouseWithTouches: { configurable: true, get() { return true; }, set() {} },
  backButtonLeavesApp: { configurable: true, get() { return false; }, set() {} },
  imeIsSelected: { configurable: true, get() { return false; } },
  compositionString: { configurable: true, get() { return ''; } },
  imeCompositionMode: { configurable: true, get() { return 'Auto'; }, set() {} },
  compositionCursorPos: { configurable: true, get() { return Vector2.zero; }, set() {} },
  mouseScrollDelta: { configurable: true, get() { const w = inp()?.wheel ?? [0, 0]; return new Vector2(w[0], -w[1]); } },
  mousePosition: { configurable: true, get() { const p = inp()?.pointer; return new Vector2(p?.x ?? 0, p?.y ?? 0); } },
  deviceOrientation: { configurable: true, get() { const o = globalThis.screen?.orientation?.type ?? ''; return o.startsWith('portrait') ? (o.includes('secondary') ? 'PortraitUpsideDown' : 'Portrait') : o.includes('secondary') ? 'LandscapeRight' : o ? 'LandscapeLeft' : 'Unknown'; } },
  /** Accelerometer in g, Unity axes: a device lying face up reads (0, 0, -1). Starts listening (and asks iOS for permission on the next tap) on first use. */
  acceleration: { configurable: true, get() { const i = inp(); i?.enableSensors?.(); const a = i?.sensors?.accel; return a ? new Vector3(a[0], a[1], a[2]) : Vector3.zero; } },
  accelerationEventCount: { configurable: true, get() { return UnityInput.accelerationEvents.length; } },
  accelerationEvents: { configurable: true, get() { const a = UnityInput.acceleration; fakeEvents.length = 0; fakeEvents.push({ acceleration: a, deltaTime: game()?.time.delta ?? 0 }); return fakeEvents; } },
  gyro: { configurable: true, get() { return gyro; } },
  compass: { configurable: true, get() { return compass; } },
  location: { configurable: true, get() { return location; } },
});
UnityInput.GetAccelerationEvent = (i) => UnityInput.accelerationEvents[i];
UnityInput.GetJoystickNames = () => [...(globalThis.navigator?.getGamepads?.() ?? [])].filter(Boolean).map((p) => p.id);
UnityInput.IsJoystickPreconfigured = () => true;
UnityInput.ResetInputAxes = () => { axisState.clear(); const i = inp(); if (i) { i.held.clear(); i.mouseDelta = [0, 0]; i._mdelta = [0, 0]; } };
UnityInput.GetMouseButton = (n = 0) => !!inp()?.key(`Mouse${n}`);
UnityInput.smoothAxes ??= undefined;

const on = (name) => { inp()?.enableSensors?.(); return name; };
/** Input.gyro: set `enabled = true` first (like Unity). `attitude` is Unity's left-handed device rotation; `rotationRate` in rad/s. */
const gyro = {
  enabled: false, updateInterval: 0.0167,
  get attitude() { if (this.enabled) on(); const a = inp()?.sensors?.attitude; return a ? new Quaternion(a[0], a[1], a[2], a[3]) : Quaternion.identity; },
  get rotationRate() { if (this.enabled) on(); const r = inp()?.sensors?.gyroRate; return r ? new Vector3(r[0], r[1], r[2]) : Vector3.zero; },
  get rotationRateUnbiased() { return this.rotationRate; },
  get userAcceleration() { if (this.enabled) on(); const a = inp()?.sensors?.userAccel; return a ? new Vector3(a[0], a[1], a[2]) : Vector3.zero; },
  get gravity() { const a = inp()?.sensors?.accel, u = inp()?.sensors?.userAccel; return a ? new Vector3(a[0] - (u?.[0] ?? 0), a[1] - (u?.[1] ?? 0), a[2] - (u?.[2] ?? 0)) : Vector3.zero; },
};
/** Input.compass: `enabled = true`, then `magneticHeading` / `trueHeading` in degrees from north (needs a device with a magnetometer). */
const compass = {
  enabled: false,
  get magneticHeading() { if (this.enabled) on(); return inp()?.sensors?.heading ?? 0; },
  get trueHeading() { return this.magneticHeading; },
  get headingAccuracy() { return inp()?.sensors?.compassAccuracy ?? -1; },
  get rawVector() { return Vector3.zero; },
  get timestamp() { return (game()?.time.elapsed ?? 0); },
};
let watchId = null;
const loc = { status: 'Stopped', data: { latitude: 0, longitude: 0, altitude: 0, horizontalAccuracy: 0, verticalAccuracy: 0, timestamp: 0 } };
/** Input.location: `Start()` then read `lastData.latitude` etc. when `status` is Running (browser geolocation; the user is asked for permission). */
const location = {
  get isEnabledByUser() { return !!globalThis.navigator?.geolocation; },
  get status() { return loc.status; },
  get lastData() { return loc.data; },
  Start() {
    const g = globalThis.navigator?.geolocation;
    if (!g) { loc.status = 'Failed'; return; }
    loc.status = 'Initializing';
    watchId = g.watchPosition((p) => { loc.status = 'Running'; loc.data = { latitude: p.coords.latitude, longitude: p.coords.longitude, altitude: p.coords.altitude ?? 0, horizontalAccuracy: p.coords.accuracy ?? 0, verticalAccuracy: p.coords.altitudeAccuracy ?? 0, timestamp: p.timestamp / 1000 }; }, () => { loc.status = 'Failed'; });
  },
  Stop() { if (watchId != null) globalThis.navigator?.geolocation?.clearWatch(watchId); watchId = null; loc.status = 'Stopped'; },
};

// ---------------------------------------------------------------- New Input System: control paths
const KEYS = {
  space: 'Space', enter: 'Enter', escape: 'Escape', tab: 'Tab', backspace: 'Backspace', delete: 'Delete', insert: 'Insert', home: 'Home', end: 'End', pageUp: 'PageUp', pageDown: 'PageDown',
  leftShift: 'ShiftLeft', rightShift: 'ShiftRight', shift: ['ShiftLeft', 'ShiftRight'], leftCtrl: 'ControlLeft', rightCtrl: 'ControlRight', ctrl: ['ControlLeft', 'ControlRight'],
  leftAlt: 'AltLeft', rightAlt: 'AltRight', alt: ['AltLeft', 'AltRight'], leftMeta: 'MetaLeft', rightMeta: 'MetaRight', leftCommand: 'MetaLeft', rightCommand: 'MetaRight',
  upArrow: 'ArrowUp', downArrow: 'ArrowDown', leftArrow: 'ArrowLeft', rightArrow: 'ArrowRight', capsLock: 'CapsLock', numLock: 'NumLock', contextMenu: 'ContextMenu',
  minus: 'Minus', equals: 'Equal', comma: 'Comma', period: 'Period', slash: 'Slash', backslash: 'Backslash', semicolon: 'Semicolon', quote: 'Quote', backquote: 'Backquote',
  leftBracket: 'BracketLeft', rightBracket: 'BracketRight', numpadEnter: 'NumpadEnter', numpadPlus: 'NumpadAdd', numpadMinus: 'NumpadSubtract', numpadMultiply: 'NumpadMultiply', numpadDivide: 'NumpadDivide',
};
/** Raw key code(s) for a Keyboard control name (`space`, `w`, `leftShift`, `1`, `f5`, `numpad3`, `upArrow`). */
function keyCodes(name) {
  const n = name.replace(/Key$/, '');
  if (KEYS[n]) return [].concat(KEYS[n]);
  if (/^[a-z]$/i.test(n)) return [`Key${n.toUpperCase()}`];
  const d = /^(?:digit)?(\d)$/i.exec(n); if (d) return [`Digit${d[1]}`];
  const f = /^f(\d{1,2})$/i.exec(n); if (f) return [`F${f[1]}`];
  const np = /^numpad(\d)$/i.exec(n); if (np) return [`Numpad${np[1]}`];
  return [n.charAt(0).toUpperCase() + n.slice(1)];
}
const PAD_BUTTONS = { buttonSouth: 0, buttonEast: 1, buttonWest: 2, buttonNorth: 3, leftShoulder: 4, rightShoulder: 5, leftTrigger: 6, rightTrigger: 7, select: 8, start: 9, leftStickPress: 10, rightStickPress: 11, dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15, 'dpad/up': 12, 'dpad/down': 13, 'dpad/left': 14, 'dpad/right': 15, a: 0, b: 1, x: 2, y: 3, cross: 0, circle: 1, square: 2, triangle: 3, buttonNorth_: 3 };
const padBtn = (i) => { const b = inp()?.pad.buttons[i]; return b == null ? 0 : b; };
const padAxis = (i) => inp()?.pad.axes[i] ?? 0;
const edgeOf = (codes, down) => { const i = inp(); return !!i?.heldSnap && codes.some((c) => (down ? i.heldSnap.has(c) && !i.heldPrev.has(c) : !i.heldSnap.has(c) && i.heldPrev.has(c))); };

/** A readable control: `{ read() → number | Vector2 }`; button-like ones also give raw codes for press edges. */
function resolveControl(path) {
  const m = /^<([^>]+)>(?:\{[^}]*\})?\/(.+)$/.exec(path.trim());
  if (!m) { warnOnce(`input binding '${path}' is not a control path like "<Keyboard>/space"`); return { read: () => 0 }; }
  const [, dev, ctl] = m, d = dev.toLowerCase();
  if (d === 'keyboard') {
    if (ctl === 'anyKey') return { read: () => ((inp()?.held.size ?? 0) > 0 ? 1 : 0), codes: [] };
    const codes = keyCodes(ctl);
    return { read: () => (codes.some((c) => inp()?.key(c)) ? 1 : 0), codes };
  }
  if (d === 'mouse' || d === 'pointer' || d === 'touchscreen') {
    const c = ctl.replace(/^primaryTouch\//, '');
    const btn = { leftButton: 'Mouse0', rightButton: 'Mouse1', middleButton: 'Mouse2', forwardButton: 'Mouse4', backButton: 'Mouse3' }[c];
    if (btn) return { read: () => (inp()?.key(btn) ? 1 : 0), codes: [btn] };
    if (c === 'press' || c === 'clickCount') return { read: () => (inp()?.pointer.down || (inp()?.touches.size ?? 0) > 0 ? 1 : 0), codes: ['Mouse0'] };
    if (c === 'position') return { read: () => new Vector2(inp()?.pointer.x ?? 0, inp()?.pointer.y ?? 0) };
    if (c === 'delta') return { read: () => new Vector2(inp()?.mouseDelta[0] ?? 0, -(inp()?.mouseDelta[1] ?? 0)) };
    if (c === 'scroll') return { read: () => new Vector2((inp()?.wheel[0] ?? 0) * 120, -(inp()?.wheel[1] ?? 0) * 120) };
    if (c === 'scroll/y') return { read: () => -(inp()?.wheel[1] ?? 0) * 120 };
    if (c === 'scroll/x') return { read: () => (inp()?.wheel[0] ?? 0) * 120 };
  }
  if (d === 'gamepad' || d === 'joystick' || d === 'xinputcontroller' || d === 'dualshockgamepad') {
    if (ctl in PAD_BUTTONS) { const n = PAD_BUTTONS[ctl]; return { read: () => padBtn(n), codes: [`Gamepad${n}`] }; }
    const stick = (a, b) => ({ read: () => new Vector2(padAxis(a), -padAxis(b)) });
    if (ctl === 'leftStick') return stick(0, 1);
    if (ctl === 'rightStick') return stick(2, 3);
    if (ctl === 'leftStick/x') return { read: () => padAxis(0) }; if (ctl === 'leftStick/y') return { read: () => -padAxis(1) };
    if (ctl === 'rightStick/x') return { read: () => padAxis(2) }; if (ctl === 'rightStick/y') return { read: () => -padAxis(3) };
    if (ctl === 'leftStick/up') return { read: () => Math.max(0, -padAxis(1)) }; if (ctl === 'leftStick/down') return { read: () => Math.max(0, padAxis(1)) };
    if (ctl === 'leftStick/left') return { read: () => Math.max(0, -padAxis(0)) }; if (ctl === 'leftStick/right') return { read: () => Math.max(0, padAxis(0)) };
    if (ctl === 'dpad') return { read: () => new Vector2(padBtn(15) - padBtn(14), padBtn(12) - padBtn(13)) };
  }
  warnOnce(`input control '${path}' is not supported`);
  return { read: () => 0 };
}

// ---------------------------------------------------------------- processors
const num = (s, d) => (s == null || s === '' ? d : Number(s));
function parseCall(spec) {
  const m = /^\s*([A-Za-z0-9_]+)\s*(?:\(([^)]*)\))?\s*$/.exec(spec ?? '');
  const args = {};
  if (m?.[2]) for (const part of m[2].split(',')) { const [k, v] = part.split('='); if (k) args[k.trim()] = (v ?? 'true').trim(); }
  return { name: (m?.[1] ?? '').toLowerCase(), args };
}
const mag = (v) => (typeof v === 'number' ? Math.abs(v) : Math.hypot(v.x, v.y));
function applyProcessor(spec, v) {
  const { name, args } = parseCall(spec);
  const isV = typeof v !== 'number';
  switch (name) {
    case 'invert': return isV ? v : -v;
    case 'invertvector2': return isV ? new Vector2(args.invertX === 'false' ? v.x : -v.x, args.invertY === 'false' ? v.y : -v.y) : v;
    case 'scale': return isV ? v.Mul(num(args.factor, 1)) : v * num(args.factor, 1);
    case 'scalevector2': return isV ? new Vector2(v.x * num(args.x, 1), v.y * num(args.y, 1)) : v;
    case 'clamp': return isV ? v : clamp(v, num(args.min, 0), num(args.max, 0));
    case 'normalize': { const lo = num(args.min, 0), hi = num(args.max, 1), z = num(args.zero, 0); return isV ? v : (v - z) / (hi - lo || 1); }
    case 'normalizevector2': return isV ? v.normalized : v;
    case 'axisdeadzone': { const lo = num(args.min, 0.125), hi = num(args.max, 0.925); if (isV) return v; const a = Math.abs(v); return a < lo ? 0 : Math.sign(v) * Math.min(1, (a - lo) / (hi - lo)); }
    case 'stickdeadzone': { const lo = num(args.min, 0.125), hi = num(args.max, 0.925); if (!isV) return v; const m = mag(v); return m < lo ? Vector2.zero : v.normalized.Mul(Math.min(1, (m - lo) / (hi - lo))); }
    case '': return v;
    default: warnOnce(`input processor '${spec}' is not supported`); return v;
  }
}

// ---------------------------------------------------------------- InputAction
export const InputActionPhase = Object.freeze({ Disabled: 'Disabled', Waiting: 'Waiting', Started: 'Started', Performed: 'Performed', Canceled: 'Canceled' });
export const InputActionType = Object.freeze({ Value: 'Value', Button: 'Button', PassThrough: 'PassThrough' });
const COMPOSITE_PARTS = { '2dvector': ['Up', 'Down', 'Left', 'Right'], '1daxis': ['Negative', 'Positive'], 'buttonwithonemodifier': ['Modifier', 'Button'], 'buttonwithtwomodifiers': ['Modifier1', 'Modifier2', 'Button'], 'vector2': ['Up', 'Down', 'Left', 'Right'], '3dvector': ['Up', 'Down', 'Left', 'Right', 'Forward', 'Backward'], 'axis': ['Negative', 'Positive'] };

class Binding {
  constructor(o) { Object.assign(this, { path: '', name: '', action: '', isComposite: false, isPartOfComposite: false, interactions: '', processors: '', groups: '', parts: {} }, o); }
  get effectivePath() { return this.path; }
  WithProcessors(p) { this.processors = p; return this; }
  WithInteractions(i) { this.interactions = i; return this; }
}
/** Composite builder returned by `AddCompositeBinding("2DVector")`: `.With("Up", "<Keyboard>/w")`. */
class CompositeSyntax {
  constructor(b) { this.b = b; }
  With(part, path) { this.b.parts[String(part).toLowerCase()] = path; return this; }
  WithInteraction(i) { this.b.interactions = i; return this; }
  WithProcessor(p) { this.b.processors = p; return this; }
  WithName(n) { this.b.name = n; return this; }
}
class CallbackContext {
  constructor(action, phase, value, time) { this.action = action; this.phase = phase; this._v = value; this.time = time; this.startTime = action._startTime; this.duration = time - action._startTime; this.control = { path: action._lastPath ?? '' }; this.valueType = typeof value === 'number' ? 'Single' : 'Vector2'; }
  ReadValue() { return this._v; }
  ReadValueAsButton() { return mag(this._v) >= this.action.pressPoint; }
  get started() { return this.phase === 'Started'; } get performed() { return this.phase === 'Performed'; } get canceled() { return this.phase === 'Canceled'; }
}

/** A single action: `new InputAction("Jump", "Button", "<Keyboard>/space")`, `.AddBinding(path)`, `.Enable()`, then `ReadValue()` / `WasPressedThisFrame()` / events. */
export class InputAction {
  constructor(name = '', type = 'Value', binding = null, interactions = '', processors = '', expectedControlType = '') {
    this.name = name; this.type = type; this.expectedControlType = expectedControlType; this.bindings = []; this.pressPoint = 0.5;
    this.started = new UnityEvent(); this.performed = new UnityEvent(); this.canceled = new UnityEvent();
    this.enabled = false; this.phase = 'Disabled'; this.map = null; this._value = 0; this._pressed = false; this._wasPressed = false; this._wasReleased = false; this._startTime = 0; this._lastPath = '';
    if (binding) this.AddBinding(binding, interactions, processors);
  }
  get id() { return this._id ?? this.name; }
  AddBinding(path, interactions = '', processors = '', groups = '') {
    const b = new Binding({ path: path?.path ?? path, interactions, processors, groups, action: this.name });
    this.bindings.push(b); b._controls = null; return b;
  }
  AddCompositeBinding(composite, interactions = '', processors = '') {
    const b = new Binding({ path: composite, isComposite: true, interactions, processors, action: this.name }); this.bindings.push(b);
    return new CompositeSyntax(b);
  }
  RemoveAllBindings() { this.bindings.length = 0; }
  Enable() { if (!this.enabled) { this.enabled = true; this.phase = 'Waiting'; registerAction(this); } }
  Disable() { if (this.enabled) { this.enabled = false; this.phase = 'Disabled'; this._value = typeof this._value === 'number' ? 0 : Vector2.zero; this._pressed = false; } }
  /** Current value: a number for buttons / axes, a Vector2 for sticks and 2DVector composites. Works in the frame after `Enable()`; enabling also samples at once. */
  ReadValue() { if (this.enabled && !this._sampled) this.Sample(); return this._value; }
  ReadValueAsButton() { return mag(this._value) >= this.pressPoint; }
  IsPressed() { return this.enabled && this._pressed; }
  WasPressedThisFrame() { return this.enabled && this._wasPressed; }
  WasReleasedThisFrame() { return this.enabled && this._wasReleased; }
  WasPerformedThisFrame() { return this.enabled && this._wasPerformed; }
  get triggered() { return this.WasPerformedThisFrame(); }
  IsInProgress() { return this.phase === 'Started'; }
  /** Read all bindings now; the largest value wins. */
  Sample() {
    this._sampled = true;
    let best = null, bestMag = -1, path = '';
    for (const b of this.bindings) {
      let v;
      if (b.isComposite) v = readComposite(b);
      else { b._c ??= resolveControl(b.path); v = b._c.read(); }
      for (const p of String(b.processors || '').split(';').filter(Boolean)) v = applyProcessor(p, v);
      const m = mag(v);
      if (m > bestMag) { best = v; bestMag = m; path = b.path; }
    }
    const zero = this.expectedControlType === 'Vector2' || (best && typeof best !== 'number') ? Vector2.zero : 0;
    this._value = best ?? zero; this._lastPath = path;
    return this._value;
  }
}
function readComposite(b) {
  const kind = parseCall(b.path).name, part = (n) => { const p = b.parts[n.toLowerCase()]; if (!p) return 0; b._pc ??= {}; const c = (b._pc[n] ??= resolveControl(p)); const v = c.read(); return typeof v === 'number' ? v : mag(v); };
  const raw = parseCall(b.path);
  if (kind === '2dvector' || kind === 'vector2') {
    let x = part('Right') - part('Left'), y = part('Up') - part('Down');
    if (raw.args.mode === '2' || raw.args.mode === 'Digital' || raw.args.mode == null) { const l = Math.hypot(x, y); if (raw.args.mode !== '1' && l > 1) { x /= l; y /= l; } }
    return new Vector2(x, y);
  }
  if (kind === '3dvector') return new Vector3(part('Right') - part('Left'), part('Up') - part('Down'), part('Forward') - part('Backward'));
  if (kind === '1daxis' || kind === 'axis') return part('Positive') - part('Negative');
  if (kind === 'buttonwithonemodifier') return part('Modifier') >= 0.5 ? part('Button') : 0;
  if (kind === 'buttonwithtwomodifiers') return part('Modifier1') >= 0.5 && part('Modifier2') >= 0.5 ? part('Button') : 0;
  warnOnce(`input composite '${b.path}' is not supported`);
  return 0;
}

// --- frame state machine (runs once per frame from Input.beginFrame)
const live = new Set();
const hooked = new WeakSet();
function registerAction(a) {
  live.add(a);
  const i = inp();
  if (i && !hooked.has(i)) { hooked.add(i); (i.frameHooks ??= []).push(tickActions); }
  a.Sample(); // the value is readable at once; the first edge is reported at the next frame
}
const fire = (a, ev, phase, v) => { const t = game()?.time.elapsed ?? 0; if (phase === 'Started') a._startTime = t; ev.Invoke(new CallbackContext(a, phase, v, t)); a.map?.asset?._onTriggered?.(a, phase, v); };
function tickActions() {
  for (const a of [...live]) {
    if (!a.enabled) { live.delete(a); continue; }
    a._wasPressed = a._wasReleased = a._wasPerformed = false;
    const prevV = a._value, prevPressed = a._pressed, v = a.Sample(), m = mag(v);
    const pressed = m >= a.pressPoint;
    a._pressed = pressed;
    if (a.type === 'PassThrough') {
      if (a.phase === 'Disabled') continue;
      const changed = typeof v === 'number' ? v !== prevV : v.x !== prevV?.x || v.y !== prevV?.y;
      if (changed) { a._wasPerformed = true; fire(a, a.performed, 'Performed', v); }
      continue;
    }
    if (a.type === 'Button') {
      if (pressed && !prevPressed) { a._wasPressed = a._wasPerformed = true; a.phase = 'Performed'; fire(a, a.started, 'Started', v); fire(a, a.performed, 'Performed', v); }
      else if (!pressed && prevPressed) { a._wasReleased = true; a.phase = 'Waiting'; fire(a, a.canceled, 'Canceled', v); }
      continue;
    }
    // Value: started when it leaves zero, performed whenever it changes, canceled when it returns to zero
    const actuated = m > 0.0001, was = mag(prevV) > 0.0001;
    if (pressed && !prevPressed) a._wasPressed = true;
    if (!pressed && prevPressed) a._wasReleased = true;
    if (actuated && !was) { a.phase = 'Started'; fire(a, a.started, 'Started', v); }
    if (actuated) {
      const changed = typeof v === 'number' ? v !== prevV : v.x !== prevV?.x || v.y !== prevV?.y;
      if (changed || !was) { a.phase = 'Performed'; a._wasPerformed = true; fire(a, a.performed, 'Performed', v); }
    } else if (was) { a.phase = 'Waiting'; fire(a, a.canceled, 'Canceled', v); }
  }
}

// ---------------------------------------------------------------- maps, assets
export class InputActionMap {
  constructor(name = '') { this.name = name; this.actions = []; this.asset = null; this.enabled = false; }
  AddAction(name, type = 'Value', binding = null, interactions = '', processors = '', expectedControlType = '') {
    const a = new InputAction(name, type, binding, interactions, processors, expectedControlType); a.map = this; this.actions.push(a); return a;
  }
  FindAction(name, throwIfNotFound = false) {
    const a = this.actions.find((x) => x.name === name || x.id === name) ?? null;
    if (!a && throwIfNotFound) throw new Error(`No action '${name}' in map '${this.name}'`);
    return a;
  }
  Enable() { this.enabled = true; for (const a of this.actions) a.Enable(); }
  Disable() { this.enabled = false; for (const a of this.actions) a.Disable(); }
  get bindings() { return this.actions.flatMap((a) => a.bindings); }
  [Symbol.iterator]() { return this.actions[Symbol.iterator](); }
}
/** A set of action maps, usually loaded from a Unity `.inputactions` file with `InputActionAsset.FromJson(text)` or `await InputSystem.LoadActionAsset(path)`. */
export class InputActionAsset {
  constructor(name = '') { this.name = name; this.actionMaps = []; this.controlSchemes = []; this._cb = []; }
  AddActionMap(name) { const m = new InputActionMap(name); m.asset = this; this.actionMaps.push(m); return m; }
  FindActionMap(name, throwIfNotFound = false) {
    const m = this.actionMaps.find((x) => x.name === name) ?? null;
    if (!m && throwIfNotFound) throw new Error(`No action map '${name}'`);
    return m;
  }
  /** `FindAction("Player/Move")` or just `FindAction("Move")`. */
  FindAction(path, throwIfNotFound = false) {
    const [a, b] = String(path).includes('/') ? String(path).split('/') : [null, path];
    const a2 = a ? this.FindActionMap(a)?.FindAction(b) : this.actionMaps.map((m) => m.FindAction(b)).find(Boolean);
    if (!a2 && throwIfNotFound) throw new Error(`No action '${path}'`);
    return a2 ?? null;
  }
  get actions() { return this.actionMaps.flatMap((m) => m.actions); }
  Enable() { for (const m of this.actionMaps) m.Enable(); }
  Disable() { for (const m of this.actionMaps) m.Disable(); }
  get enabled() { return this.actionMaps.some((m) => m.enabled); }
  _onTriggered(a, phase, v) { for (const f of this._cb) f(new CallbackContext(a, phase, v, game()?.time.elapsed ?? 0)); }
  /** `asset.onActionTriggered(ctx => …)`. */
  onActionTriggered(fn) { this._cb.push(fn); return () => { this._cb = this._cb.filter((f) => f !== fn); }; }
  /** Read Unity's `.inputactions` JSON (or the same shape built by hand). */
  static FromJson(json) {
    const o = typeof json === 'string' ? JSON.parse(json) : json, asset = new InputActionAsset(o.name ?? '');
    asset.controlSchemes = o.controlSchemes ?? [];
    for (const m of o.maps ?? []) {
      const map = asset.AddActionMap(m.name), byId = new Map();
      for (const a of m.actions ?? []) { const act = map.AddAction(a.name, a.type ?? 'Value', null, a.interactions ?? '', a.processors ?? '', a.expectedControlType ?? ''); act._id = a.id ?? a.name; byId.set(a.id ?? a.name, act); byId.set(a.name, act); }
      let comp = null;
      for (const b of m.bindings ?? []) {
        const act = byId.get(b.action); if (!act) continue;
        if (b.isComposite) { comp = act.AddCompositeBinding(b.path); comp.b.name = b.name ?? ''; comp.b.processors = b.processors ?? ''; comp.b.interactions = b.interactions ?? ''; }
        else if (b.isPartOfComposite && comp) comp.With(b.name, b.path);
        else { comp = null; const nb = act.AddBinding(b.path, b.interactions ?? '', b.processors ?? '', b.groups ?? ''); nb.name = b.name ?? ''; }
      }
    }
    return asset;
  }
}

// ---------------------------------------------------------------- devices (Keyboard.current …)
class ButtonControl {
  constructor(path) { this.path = path; this.c = resolveControl(path); }
  get isPressed() { return this.ReadValue() >= 0.5; }
  get wasPressedThisFrame() { return edgeOf(this.c.codes ?? [], true); }
  get wasReleasedThisFrame() { return edgeOf(this.c.codes ?? [], false); }
  ReadValue() { const v = this.c.read(); return typeof v === 'number' ? v : mag(v); }
  get value() { return this.ReadValue(); }
}
class VectorControl {
  constructor(path) { this.path = path; this.c = resolveControl(path); }
  ReadValue() { return this.c.read(); }
  get value() { return this.c.read(); }
  get x() { return this.c.read().x; } get y() { return this.c.read().y; }
}
const cache = new Map();
const ctl = (Ctor, path) => { const k = `${Ctor.name}:${path}`; if (!cache.has(k)) cache.set(k, new Ctor(path)); return cache.get(k); };
/** `Keyboard.current.spaceKey.wasPressedThisFrame`, `Keyboard.current["w"]`, `.anyKey`. */
export const Keyboard = { get current() { return keyboardProxy; } };
const keyboardProxy = new Proxy({ isConnected: true, name: 'Keyboard' }, {
  get(t, k) {
    if (typeof k !== 'string') return undefined;
    if (k in t) return t[k];
    return ctl(ButtonControl, `<Keyboard>/${k === 'anyKey' ? 'anyKey' : k.replace(/Key$/, '')}`);
  },
});
const MOUSE = { leftButton: ButtonControl, rightButton: ButtonControl, middleButton: ButtonControl, forwardButton: ButtonControl, backButton: ButtonControl, position: VectorControl, delta: VectorControl, scroll: VectorControl };
/** `Mouse.current.leftButton.wasPressedThisFrame`, `.position.ReadValue()`, `.delta`, `.scroll`. */
export const Mouse = { get current() { return mouseProxy; } };
const mouseProxy = new Proxy({ isConnected: true, name: 'Mouse' }, { get(t, k) { return k in t ? t[k] : MOUSE[k] ? ctl(MOUSE[k], `<Mouse>/${k}`) : undefined; } });
export const Pointer = { get current() { return mouseProxy; } };
/** `Gamepad.current` is null while no pad is connected: `Gamepad.current.leftStick.ReadValue()`, `.buttonSouth.wasPressedThisFrame`, `.leftTrigger.ReadValue()`. */
export const Gamepad = { get current() { return (globalThis.navigator?.getGamepads?.() ?? []).some(Boolean) || (inp()?.pad.buttons.length ?? 0) ? padProxy : null; }, get all() { return Gamepad.current ? [padProxy] : []; } };
const STICKS = new Set(['leftStick', 'rightStick', 'dpad']);
const padProxy = new Proxy({ isConnected: true, name: 'Gamepad' }, {
  get(t, k) { if (typeof k !== 'string') return undefined; if (k in t) return t[k]; if (STICKS.has(k)) return ctl(VectorControl, `<Gamepad>/${k}`); if (k in PAD_BUTTONS) return ctl(ButtonControl, `<Gamepad>/${k}`); return undefined; },
});
/** `Touchscreen.current.touches[i]`, `.primaryTouch.position.ReadValue()`, `.primaryTouch.press.isPressed`. */
export const Touchscreen = { get current() { return touchProxy; } };
const touchProxy = {
  isConnected: true, name: 'Touchscreen',
  get touches() { return [...(inp()?.touches?.values() ?? [])].map((t) => ({ touchId: t.id, position: { ReadValue: () => new Vector2(t.x, t.y) }, isInProgress: t.phase !== 'Ended' && t.phase !== 'Canceled', pressure: { ReadValue: () => t.pressure ?? 1 }, phase: t.phase })); },
  get primaryTouch() { return { position: ctl(VectorControl, '<Pointer>/position'), press: ctl(ButtonControl, '<Pointer>/press'), delta: ctl(VectorControl, '<Pointer>/delta') }; },
};

// ---------------------------------------------------------------- InputSystem, PlayerInput
let projectActions = null;
export const InputSystem = {
  /** The project-wide action asset (`input.inputActions` in nord.project.json, loaded at start), like Unity 6's `InputSystem.actions`. */
  get actions() { return projectActions; },
  set actions(a) { projectActions = a; },
  Keyboard, Mouse, Gamepad, Touchscreen, Pointer,
  get devices() { return [Keyboard.current, Mouse.current, Touchscreen.current, Gamepad.current].filter(Boolean); },
  /** Load a `.inputactions` file from the project (`await InputSystem.LoadActionAsset('input/Controls.inputactions')`). */
  async LoadActionAsset(path) { return InputActionAsset.FromJson(await game().loadJSON(path)); },
  EnableAllActions() { projectActions?.Enable(); },
};
/** Value passed to `OnMove(InputValue v)` style messages from PlayerInput. */
class InputValue {
  constructor(v) { this._v = v; }
  Get() { return this._v; }
  get isPressed() { return mag(this._v) >= 0.5; }
}
/**
 * Unity's PlayerInput: `new PlayerInput(entity, asset, { defaultActionMap: 'Player', notificationBehavior: 'SendMessages' })`.
 * SendMessages calls `OnMove(inputValue)` on the entity's scripts when the action `Move` is performed (and `OnMoveCanceled`… not sent, like Unity);
 * `InvokeCSharpEvents` raises `onActionTriggered`; `InvokeUnityEvents` raises `events[mapName/actionName]`.
 */
export class PlayerInput {
  constructor(entity, actions, { defaultActionMap = null, notificationBehavior = 'SendMessages', playerIndex = 0 } = {}) {
    this.entity = entity?.entity ?? entity; this.actions = actions; this.notificationBehavior = notificationBehavior; this.playerIndex = playerIndex;
    this.onActionTriggered = new UnityEvent(); this.events = {}; this.currentActionMap = null; this.inputIsActive = false;
    this._off = actions.onActionTriggered((ctx) => this.#route(ctx));
    this.ActivateInput();
    if (defaultActionMap) this.SwitchCurrentActionMap(defaultActionMap);
  }
  #route(ctx) {
    if (this.currentActionMap && ctx.action.map !== this.currentActionMap) return;
    if (this.notificationBehavior === 'InvokeCSharpEvents') this.onActionTriggered.Invoke(ctx);
    else if (this.notificationBehavior === 'InvokeUnityEvents') this.events[`${ctx.action.map?.name}/${ctx.action.name}`]?.Invoke(ctx);
    else if (this.notificationBehavior === 'BroadcastMessages') { if (ctx.phase === 'Performed') for (const e of this.entity.all()) e.callScripts(`On${ctx.action.name}`, new InputValue(ctx.ReadValue())); }
    else if (ctx.phase === 'Performed') this.entity.callScripts(`On${ctx.action.name}`, new InputValue(ctx.ReadValue()));
  }
  FindAction(name) { return this.actions.FindAction(name); }
  SwitchCurrentActionMap(name) {
    const m = this.actions.FindActionMap(name, true);
    for (const x of this.actions.actionMaps) if (x !== m) x.Disable();
    this.currentActionMap = m; m.Enable();
  }
  ActivateInput() { this.inputIsActive = true; if (this.currentActionMap) this.currentActionMap.Enable(); else this.actions.Enable(); }
  DeactivateInput() { this.inputIsActive = false; this.actions.Disable(); }
  Dispose() { this._off?.(); this.actions.Disable(); }
}
