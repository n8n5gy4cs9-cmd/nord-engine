// Action-based input. Pure state machine; DOM wiring in `attachDom`. Actions map to codes like
// 'KeyA', 'Space', 'Mouse0', 'Gamepad0' (button 0), 'GamepadLeft'/'GamepadRight'/'GamepadUp'/'GamepadDown' (left stick).
export class Input {
  constructor(actions = {}) {
    this.actions = actions;
    this.held = new Set();      // raw codes currently down
    this.virtual = new Set();   // actions forced on (virtual joystick / touch buttons)
    this.prev = new Set();      // actions down last frame
    this.cur = new Set();
    this.pointer = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
    this.stick = [0, 0];
    this.wheel = [0, 0];        // wheel movement of the last frame (Unity: Input.mouseScrollDelta); fed by attachDom
    this._wheel = [0, 0];
    this.touches = new Map();   // touches by pointer id: { id, x, y, dx, dy, phase, pressure, radius, tapCount } (Unity: Input.touches); fed by attachDom
    this.mouseDelta = [0, 0];   // pointer movement of the last frame in canvas px (Unity: Input.GetAxis("Mouse X"/"Mouse Y")); fed by attachDom
    this._mdelta = [0, 0];
    this.typed = '';            // characters typed in the last frame (Unity: Input.inputString)
    this._typed = '';
    this.pad = { buttons: [], axes: [] }; // raw state of the first gamepad (pressure 0..1, axes -1..1); fed by pollGamepad
    this.sensors = { accel: null, gyroRate: null, attitude: null, userAccel: null, heading: null, compassAccuracy: -1, enabled: false }; // device sensors; fed by attachDom
    this._ended = [];           // touches that ended this frame: reported once with phase 'Ended', then dropped
  }
  /** Clear held keys, edge states, virtual controls and pointer press on scene restart. */
  reset() {
    this.held.clear(); this.virtual.clear(); this.prev.clear(); this.cur.clear();
    this.stick = [0, 0]; this.pointer.down = false;
    this.wheel = [0, 0]; this._wheel = [0, 0]; this.touches.clear(); this._ended = [];
    this.mouseDelta = [0, 0]; this._mdelta = [0, 0]; this.typed = ''; this._typed = '';
  }
  setKey(code, down) { down ? this.held.add(code) : this.held.delete(code); }
  setVirtual(action, on) { on ? this.virtual.add(action) : this.virtual.delete(action); }
  /** Call once per frame before scripts update: snapshots action state so pressed/released work. */
  beginFrame() {
    this.heldPrev = this.heldSnap ?? new Set(); this.heldSnap = new Set(this.held); // raw-key edges for Unity-style GetKeyDown/Up
    this.wheel = this._wheel; this._wheel = [0, 0];
    this.mouseDelta = this._mdelta; this._mdelta = [0, 0];
    this.typed = this._typed; this._typed = '';
    // touches: last frame's Ended ones go away; ones that did not move since last frame are Stationary; a finger lifted this frame stays one frame as Ended
    for (const t of this._ended) this.touches.delete(t.id);
    this._ended = [];
    for (const t of this.touches.values()) {
      if (t.phase === 'Ended' || t.phase === 'Canceled') { this._ended.push(t); continue; }
      if (t.fresh) { t.fresh = false; continue; }
      if (!t.movedThisFrame) { t.phase = 'Stationary'; t.dx = 0; t.dy = 0; }
      else t.consumed = true; // the next move starts a fresh delta
      t.movedThisFrame = false;
    }
    this.prev = this.cur;
    this.cur = new Set(this.virtual);
    for (const [a, codes] of Object.entries(this.actions)) if (codes.some((c) => this.held.has(c))) this.cur.add(a);
    for (const f of this.frameHooks ?? []) f(this); // e.g. the New Input System state machine (unity-input.js)
  }
  down(a) { return this.cur.has(a); }
  pressed(a) { return this.cur.has(a) && !this.prev.has(a); }
  released(a) { return !this.cur.has(a) && this.prev.has(a); }
  key(code) { return this.held.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  /** Normalised 2D vector from four actions (analog stick wins when deflected). */
  vec(l, r, u, d) {
    let x = this.axis(l, r), y = this.axis(u, d);
    if (Math.hypot(...this.stick) > 0.2) [x, y] = this.stick;
    const len = Math.hypot(x, y);
    return len > 1 ? [x / len, y / len] : [x, y];
  }
  /** Feed gamepad state (navigator.getGamepads()[i]-shaped). Buttons map to 'Gamepad<n>', left stick to Gamepad{Left,Right,Up,Down}. */
  pollGamepad(pad) {
    for (const c of [...this.held]) if (c.startsWith('Gamepad')) this.held.delete(c);
    this.stick = [0, 0];
    this.pad = { buttons: pad ? pad.buttons.map((b) => (typeof b === 'object' ? (b.value ?? (b.pressed ? 1 : 0)) : +b)) : [], axes: pad ? [...pad.axes] : [] };
    if (!pad) return;
    pad.buttons.forEach((b, i) => b.pressed && this.held.add(`Gamepad${i}`));
    const [x = 0, y = 0] = pad.axes;
    this.stick = [Math.abs(x) > 0.2 ? x : 0, Math.abs(y) > 0.2 ? y : 0];
    if (x < -0.5) this.held.add('GamepadLeft');
    if (x > 0.5) this.held.add('GamepadRight');
    if (y < -0.5) this.held.add('GamepadUp');
    if (y > 0.5) this.held.add('GamepadDown');
  }
}

/** Browser wiring: keyboard, mouse, touch → Input. `toWorld(x,y)` converts canvas coords (backend supplies). Returns detach(). */
export function attachDom(input, el, win = window, toWorld = (x, y) => [x, y]) {
  const kd = (e) => {
    input.setKey(e.code, true);
    if (e.key?.length === 1 && !e.ctrlKey && !e.metaKey) input._typed += e.key; else if (e.key === 'Backspace') input._typed += '\b'; else if (e.key === 'Enter') input._typed += '\n';
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  };
  const ku = (e) => input.setKey(e.code, false);
  const pos = (e) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * (el.width || r.width), y = ((e.clientY - r.top) / r.height) * (el.height || r.height);
    const lx = input.pointer.x, ly = input.pointer.y;
    Object.assign(input.pointer, { x, y }); [input.pointer.worldX, input.pointer.worldY] = toWorld(x, y);
    // pointer lock reports movementX/Y; otherwise the difference of positions (screen y points down, Unity's "Mouse Y" up: the facade flips it)
    if (e.type === 'pointermove' || e.type === 'mousemove') { input._mdelta[0] += e.movementX ?? (x - lx); input._mdelta[1] += e.movementY ?? (y - ly); }
  };
  const lastTap = { t: 0, x: 0, y: 0, n: 0 };
  const canvasXY = (e) => { const r = el.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * (el.width || r.width), ((e.clientY - r.top) / r.height) * (el.height || r.height)]; };
  const touch = (e, phase) => {
    if (e.pointerType !== 'touch') return;
    const [x, y] = canvasXY(e), old = input.touches.get(e.pointerId);
    const detail = { pressure: e.pressure ?? 0, radius: Math.max(e.width ?? 1, e.height ?? 1) / 2, altitude: e.altitudeAngle ?? 0, azimuth: e.azimuthAngle ?? 0 };
    if (phase === 'Ended' || phase === 'Canceled') {
      if (!old) return;
      Object.assign(old, { x, y, phase, ...detail, pressure: 0 }); // stays one frame with this phase (beginFrame drops it)
      const now = performance.now();
      if (phase === 'Ended') { lastTap.n = now - lastTap.t < 350 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40 ? lastTap.n + 1 : 1; Object.assign(lastTap, { t: now, x, y }); old.tapCount = lastTap.n; }
      return;
    }
    if (!old) { input.touches.set(e.pointerId, { id: e.pointerId, x, y, dx: 0, dy: 0, phase: 'Began', fresh: true, tapCount: 1, ...detail }); return; }
    if (phase === 'Began') return;
    Object.assign(old, { dx: (old.consumed ? 0 : old.dx) + (x - old.x), dy: (old.consumed ? 0 : old.dy) + (y - old.y), x, y, phase: 'Moved', movedThisFrame: true, consumed: false, ...detail });
  };
  const pd = (e) => { pos(e); touch(e, 'Began'); input.pointer.down = true; input.setKey(`Mouse${e.button ?? 0}`, true); };
  const pu = (e) => { pos(e); touch(e, e.type === 'pointercancel' ? 'Canceled' : 'Ended'); input.pointer.down = false; input.setKey(`Mouse${e.button ?? 0}`, false); };
  const pm = (e) => { pos(e); touch(e, 'Moved'); };
  const wheel = (e) => { input._wheel[0] += (e.deltaX ?? 0) / 100; input._wheel[1] += (e.deltaY ?? 0) / 100; };
  const blur = () => input.held.clear();
  // device sensors (Input.acceleration / gyro / compass): listeners are added by input.enableSensors() on first use
  let sensorOff = null;
  input.enableSensors = async () => {
    if (input.sensors.enabled || !win.addEventListener) return;
    input.sensors.enabled = true;
    const ask = async () => { // iOS 13+ asks for permission, and only from a user gesture
      for (const C of [win.DeviceMotionEvent, win.DeviceOrientationEvent]) { try { if (typeof C?.requestPermission === 'function') await C.requestPermission(); } catch { /* denied */ } }
    };
    if (typeof win.DeviceMotionEvent?.requestPermission === 'function') el.addEventListener('pointerup', ask, { once: true });
    const motion = (e) => {
      const a = e.accelerationIncludingGravity, u = e.acceleration, r = e.rotationRate, G = 9.80665;
      if (a && a.x != null) input.sensors.accel = [-a.x / G, -a.y / G, -a.z / G]; // Unity: device at rest face up = (0, 0, -1) in g
      if (u && u.x != null) input.sensors.userAccel = [-u.x / G, -u.y / G, -u.z / G];
      if (r && r.alpha != null) input.sensors.gyroRate = [-r.beta * Math.PI / 180, -r.gamma * Math.PI / 180, -r.alpha * Math.PI / 180];
    };
    const orient = (e) => {
      if (e.alpha == null) return;
      const d = Math.PI / 180, x = (e.beta ?? 0) * d / 2, y = (e.gamma ?? 0) * d / 2, z = e.alpha * d / 2;
      const cX = Math.cos(x), sX = Math.sin(x), cY = Math.cos(y), sY = Math.sin(y), cZ = Math.cos(z), sZ = Math.sin(z);
      // W3C Z-X'-Y'' intrinsic rotation → quaternion, then to Unity's left-handed frame
      const q = [sX * cY * cZ - cX * sY * sZ, cX * sY * cZ + sX * cY * sZ, cX * cY * sZ + sX * sY * cZ, cX * cY * cZ - sX * sY * sZ];
      input.sensors.attitude = [q[0], q[1], -q[2], -q[3]];
      const heading = e.webkitCompassHeading ?? (e.absolute ? (360 - e.alpha) % 360 : null);
      if (heading != null) { input.sensors.heading = heading; input.sensors.compassAccuracy = e.webkitCompassAccuracy ?? 15; }
    };
    win.addEventListener('devicemotion', motion); win.addEventListener('deviceorientation', orient); win.addEventListener('deviceorientationabsolute', orient);
    sensorOff = () => { win.removeEventListener('devicemotion', motion); win.removeEventListener('deviceorientation', orient); win.removeEventListener('deviceorientationabsolute', orient); };
  };
  win.addEventListener('keydown', kd); win.addEventListener('keyup', ku); win.addEventListener('blur', blur);
  el.addEventListener('pointerdown', pd); win.addEventListener('pointerup', pu); win.addEventListener('pointercancel', pu); el.addEventListener('pointermove', pm);
  el.addEventListener('wheel', wheel, { passive: true });
  return () => {
    sensorOff?.();
    win.removeEventListener('keydown', kd); win.removeEventListener('keyup', ku); win.removeEventListener('blur', blur);
    el.removeEventListener('pointerdown', pd); win.removeEventListener('pointerup', pu); win.removeEventListener('pointercancel', pu); el.removeEventListener('pointermove', pm);
    el.removeEventListener('wheel', wheel);
  };
}

/** On-screen joystick (touch/mouse). Drives the four direction actions + `input.stick`. */
export function virtualJoystick(input, parent, { left = 'left', right = 'right', up = 'up', down = 'down', size = 120 } = {}) {
  const doc = parent.ownerDocument;
  const base = doc.createElement('div');
  base.style.cssText = `position:absolute;left:24px;bottom:24px;width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,.12);touch-action:none;user-select:none`;
  const knob = doc.createElement('div');
  knob.style.cssText = `position:absolute;left:50%;top:50%;width:${size / 2}px;height:${size / 2}px;margin:-${size / 4}px;border-radius:50%;background:rgba(255,255,255,.35)`;
  base.append(knob); parent.append(base);
  const set = (x, y) => {
    input.stick = [x, y];
    input.setVirtual(left, x < -0.4); input.setVirtual(right, x > 0.4); input.setVirtual(up, y < -0.4); input.setVirtual(down, y > 0.4);
    knob.style.transform = `translate(${x * size / 3}px,${y * size / 3}px)`;
  };
  const move = (e) => {
    const r = base.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    set(x, y);
  };
  base.addEventListener('pointerdown', (e) => { base.setPointerCapture(e.pointerId); move(e); });
  base.addEventListener('pointermove', (e) => { if (base.hasPointerCapture(e.pointerId)) move(e); });
  const end = () => set(0, 0);
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  return { el: base, destroy: () => base.remove() };
}
