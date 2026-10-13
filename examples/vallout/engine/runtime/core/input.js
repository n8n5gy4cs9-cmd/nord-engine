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
  }
  setKey(code, down) { down ? this.held.add(code) : this.held.delete(code); }
  setVirtual(action, on) { on ? this.virtual.add(action) : this.virtual.delete(action); }
  /** Call once per frame before scripts update: snapshots action state so pressed/released work. */
  beginFrame() {
    this.prev = this.cur;
    this.cur = new Set(this.virtual);
    for (const [a, codes] of Object.entries(this.actions)) if (codes.some((c) => this.held.has(c))) this.cur.add(a);
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
  const kd = (e) => { input.setKey(e.code, true); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => input.setKey(e.code, false);
  const pos = (e) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * (el.width || r.width), y = ((e.clientY - r.top) / r.height) * (el.height || r.height);
    Object.assign(input.pointer, { x, y }); [input.pointer.worldX, input.pointer.worldY] = toWorld(x, y);
  };
  const pd = (e) => { pos(e); input.pointer.down = true; input.setKey(`Mouse${e.button ?? 0}`, true); };
  const pu = (e) => { pos(e); input.pointer.down = false; input.setKey(`Mouse${e.button ?? 0}`, false); };
  const blur = () => input.held.clear();
  win.addEventListener('keydown', kd); win.addEventListener('keyup', ku); win.addEventListener('blur', blur);
  el.addEventListener('pointerdown', pd); win.addEventListener('pointerup', pu); el.addEventListener('pointermove', pos);
  return () => {
    win.removeEventListener('keydown', kd); win.removeEventListener('keyup', ku); win.removeEventListener('blur', blur);
    el.removeEventListener('pointerdown', pd); win.removeEventListener('pointerup', pu); el.removeEventListener('pointermove', pos);
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
