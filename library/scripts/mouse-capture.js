// @nord {"id":"util.mouse-capture","title":"Mouse capture (lock + hide cursor)","category":"utilities","tier":["2d","3d"],"tags":["mouse","pointer-lock","fps","cursor"],"description":"Click the game to capture the mouse (cursor hidden, unlimited movement); Esc releases it. Uses real Pointer Lock where available and a virtual lock (hidden cursor + edge push) where it is not (e.g. WKWebView). Exposes window.nordMouse { locked, consume() -> {dx,dy} } for controllers (fps3d, third-person3d, your own). Add to any entity in scenes that use the mouse as a controller."}
import { NordScript } from 'nord';

export default class MouseCapture extends NordScript {
  static attributes = {
    selector: { type: 'string', default: 'canvas', label: 'Element to capture' },
    hint: { type: 'bool', default: true, label: 'Show "click to capture" hint' },
    edgePush: { type: 'number', default: 18, min: 0, label: 'Virtual lock: px/frame turn when the cursor rests near a window edge' },
  };
  start() {
    const m = (this.m = { locked: false, virtual: false, dx: 0, dy: 0, lock: () => this.#lock(), unlock: () => this.#unlock(), consume: () => this.#consume() });
    window.nordMouse = m;
    this.pos = [innerWidth / 2, innerHeight / 2];
    this.off = [];
    const on = (t, ev, fn) => { t.addEventListener(ev, fn); this.off.push(() => t.removeEventListener(ev, fn)); };
    on(window, 'mousemove', (e) => {
      this.pos = [e.clientX, e.clientY];
      if (m.locked) { m.dx += e.movementX || 0; m.dy += e.movementY || 0; }
    });
    on(window, 'pointerdown', () => { if (!m.locked) this.#lock(); });
    on(document, 'pointerlockchange', () => this.#state(!!document.pointerLockElement));
    on(document, 'pointerlockerror', () => this.#virtual());
    on(window, 'keydown', (e) => { if (e.code === 'Escape' && m.locked) this.#unlock(); });
    on(window, 'blur', () => this.#unlock());
    if (this.attrs.hint) {
      this.hintEl = Object.assign(document.createElement('div'), { textContent: 'Click to capture mouse · Esc to release' });
      Object.assign(this.hintEl.style, { position: 'fixed', left: '50%', bottom: '14px', transform: 'translateX(-50%)', padding: '4px 10px', font: '12px sans-serif', color: '#fff', background: 'rgba(0,0,0,.55)', borderRadius: '6px', pointerEvents: 'none', zIndex: 9999 });
      document.body.append(this.hintEl);
    }
  }
  #el() { return document.querySelector(this.attrs.selector) ?? document.body; }
  #lock() {
    const el = this.#el();
    if (!el.requestPointerLock) return this.#virtual();
    try { el.requestPointerLock()?.catch?.(() => this.#virtual()); } catch { return this.#virtual(); }
    // WKWebView silently ignores the request (no change/error event): fall back after a moment
    setTimeout(() => { if (!document.pointerLockElement && !this.m.locked) this.#virtual(); }, 250);
  }
  #virtual() { this.m.virtual = true; this.#state(true); }
  #unlock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.m.virtual = false; this.#state(false);
  }
  #state(on) {
    this.m.locked = on;
    this.css ??= Object.assign(document.createElement('style'), { textContent: '*{cursor:none !important}' }); // !important: engines reset canvas.style.cursor
    if (on) document.head.append(this.css); else this.css.remove();
    if (this.hintEl) this.hintEl.style.display = on ? 'none' : '';
  }
  #consume() {
    const m = this.m; let { dx, dy } = m; m.dx = m.dy = 0;
    if (m.virtual && m.locked) { // no unlimited movement here: keep turning while the cursor rests near an edge
      const fx = (this.pos[0] - innerWidth / 2) / (innerWidth / 2), fy = (this.pos[1] - innerHeight / 2) / (innerHeight / 2), k = this.attrs.edgePush;
      if (Math.abs(fx) > 0.8) dx += Math.sign(fx) * k;
      if (Math.abs(fy) > 0.8) dy += Math.sign(fy) * k;
    }
    return { dx, dy };
  }
  onDestroy() { this.#unlock(); this.off.forEach((f) => f()); this.hintEl?.remove(); this.css?.remove(); if (window.nordMouse === this.m) delete window.nordMouse; }
}
