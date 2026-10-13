/* nord-touch.js — plug-and-play on-screen controls for ANY web export (html, Phaser, Babylon, PlayCanvas, Rust/WASM).
 * It draws a stick/D-pad + buttons and feeds them to the game as ordinary keyboard events (KeyboardEvent with
 * code/key/keyCode), so whatever the game already listens for keeps working — no game changes needed.
 * Shown only on touch devices (or ?touch=1); hidden with ?touch=0; hides itself when a real keyboard key is pressed.
 *
 *   <script src="nord-touch.js"></script>                                  <!-- default: arrows + Space + Enter -->
 *   <script src="nord-touch.js" data-preset="platformer"></script>         <!-- preset -->
 *   <script src="nord-touch.js" data-dpad="stick" data-keys="KeyW,KeyA,KeyS,KeyD"
 *           data-buttons="Space:Jump,KeyE:Use"></script>                    <!-- custom -->
 *   NordTouch.init({ dpad: 'dpad', keys: {…}, buttons: [{ key: 'Space', label: 'A' }] });   // or from JS
 * Nord projects: the exporter adds data-actions (the project's input.actions) → buttons are derived automatically.
 * Crowelian 2026 + Sonnet. Plain script, no dependencies, works from file://.
 */
(function () {
  'use strict';
  if (window.NordTouch) return;

  const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const WASD = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  const PRESETS = {
    arrows: { dpad: 'dpad', keys: ARROWS, buttons: [{ key: 'Space', label: 'A' }] },
    wasd: { dpad: 'stick', keys: WASD, buttons: [{ key: 'Space', label: 'A' }, { key: 'ShiftLeft', label: 'B' }] },
    platformer: { dpad: 'dpad', keys: { ...ARROWS, up: null, down: null }, buttons: [{ key: 'Space', label: 'Jump' }, { key: 'KeyX', label: 'Act' }] },
    topdown: { dpad: 'stick', keys: ARROWS, buttons: [{ key: 'Space', label: 'A' }, { key: 'KeyZ', label: 'B' }, { key: 'KeyX', label: 'C' }] },
    shooter: { dpad: 'stick', keys: WASD, buttons: [{ key: 'Space', label: 'Fire' }, { key: 'KeyR', label: 'Alt' }] },
    tap: { dpad: 'none', keys: {}, buttons: [{ key: 'Space', label: 'Tap', wide: true }] },
  };
  PRESETS.default = PRESETS.arrows;

  // ---- key synthesis ------------------------------------------------------------------------------------------
  const SPECIAL = {
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8],
    ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], ControlRight: ['Control', 17],
    AltLeft: ['Alt', 18], AltRight: ['Alt', 18],
  };
  function keyInfo(code) {
    if (SPECIAL[code]) return SPECIAL[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return [m[1].toLowerCase(), m[1].charCodeAt(0)];
    m = /^Digit(\d)$/.exec(code); if (m) return [m[1], 48 + +m[1]];
    m = /^F(\d+)$/.exec(code); if (m) return [code, 111 + +m[1]];
    return [code, 0];
  }
  function target() {
    // macroquad/miniquad listens on a focusable <canvas>; others listen on window/document (events bubble there)
    const c = document.querySelector('canvas[tabindex]');
    if (c) { if (document.activeElement !== c) { try { c.focus({ preventScroll: true }); } catch (_) {} } return c; }
    const a = document.activeElement;
    return a && a !== document.documentElement ? a : document.body || document;
  }
  const down = new Map(); // code → number of fingers holding it
  function fire(code, isDown) {
    const [key, keyCode] = keyInfo(code);
    const e = new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true });
    // some engines read the legacy fields, which the init dict does not always populate
    try { Object.defineProperty(e, 'keyCode', { get: () => keyCode }); Object.defineProperty(e, 'which', { get: () => keyCode }); } catch (_) {}
    target().dispatchEvent(e);
  }
  function press(code) { if (!code) return; const n = (down.get(code) || 0) + 1; down.set(code, n); if (n === 1) fire(code, true); }
  function release(code) {
    if (!code) return; const n = (down.get(code) || 0) - 1;
    if (n > 0) down.set(code, n); else if (down.has(code)) { down.delete(code); fire(code, false); }
  }
  function releaseAll() { for (const c of [...down.keys()]) { down.delete(c); fire(c, false); } }

  // ---- config -------------------------------------------------------------------------------------------------
  const isKbd = (c) => /^(Key|Digit|Arrow|Space|Enter|Escape|Shift|Control|Alt|Tab|Backspace|F\d)/.test(c);
  const cap = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  const short = (s) => { const t = cap(s); return t.length > 6 ? t.slice(0, 5) + '…' : t; };

  /** Build a config from a Nord `input.actions` map ({ jump: ['Space','Gamepad0'], left: ['KeyA','ArrowLeft'] }). */
  function fromActions(actions) {
    const keys = {}, buttons = [], seen = new Set();
    for (const [name, codes] of Object.entries(actions || {})) {
      const code = (codes || []).find(isKbd); if (!code) continue;
      const n = name.toLowerCase();
      const dir = /^(move)?(left|a)$/.test(n) ? 'left' : /^(move)?(right|d)$/.test(n) ? 'right' : /^(move)?(up|forward|w)$/.test(n) ? 'up' : /^(move)?(down|back|backward|s)$/.test(n) ? 'down' : null;
      if (dir && !keys[dir]) { keys[dir] = code; continue; }
      if (seen.has(code)) continue; seen.add(code);
      const menu = /pause|menu|escape/.test(n); // goes to the corner button
      buttons.push({ key: code, label: short(name), menu });
    }
    buttons.splice(6); // keep the thumb area usable
    const hasDir = Object.keys(keys).length > 0;
    return { dpad: hasDir ? (keys.up || keys.down ? 'stick' : 'dpad') : 'none', keys, buttons };
  }

  function parseAttrs(s) {
    const d = s ? s.dataset : {}, cfg = {};
    if (d.preset) Object.assign(cfg, PRESETS[d.preset] || {});
    if (d.actions) { try { Object.assign(cfg, fromActions(JSON.parse(d.actions))); } catch (e) { console.warn('nord-touch: bad data-actions', e); } }
    if (d.dpad) cfg.dpad = d.dpad;
    if (d.keys) { const k = d.keys.split(',').map((x) => x.trim()); cfg.keys = { up: k[0], left: k[1], down: k[2], right: k[3] }; } // WASD order: up,left,down,right
    if (d.buttons) cfg.buttons = d.buttons.split(',').map((b) => { const [key, label] = b.split(':'); return { key: key.trim(), label: (label || key).trim() }; });
    for (const k of ['menu', 'opacity', 'size']) if (d[k] !== undefined) cfg[k] = k === 'menu' ? d[k] : +d[k];
    if (d.force !== undefined) cfg.force = d.force !== 'false';
    return cfg;
  }

  // ---- UI -----------------------------------------------------------------------------------------------------
  let root = null, hidden = false, cfgNow = null;
  const CSS = (o, s) => `
.nt-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:${o};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;font:600 ${Math.round(s * .16)}px system-ui,sans-serif;transition:opacity .2s}
.nt-root.nt-off{opacity:0;visibility:hidden}
.nt-root *{box-sizing:border-box;touch-action:none;-webkit-tap-highlight-color:transparent}
.nt-pad{position:absolute;left:calc(env(safe-area-inset-left,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);width:${s}px;height:${s}px;pointer-events:auto}
.nt-stick{border-radius:50%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.35)}
.nt-knob{position:absolute;left:50%;top:50%;width:${s * .45}px;height:${s * .45}px;margin:${-s * .225}px;border-radius:50%;background:rgba(255,255,255,.5);pointer-events:none}
.nt-d{position:absolute;width:${s / 3}px;height:${s / 3}px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.35);color:#fff;display:flex;align-items:center;justify-content:center}
.nt-d.on,.nt-b.on,.nt-m.on{background:rgba(255,255,255,.5)}
.nt-btns{position:absolute;right:calc(env(safe-area-inset-right,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);display:flex;flex-wrap:wrap-reverse;justify-content:flex-end;gap:${s * .1}px;max-width:${s * 1.7}px;pointer-events:none}
.nt-b{pointer-events:auto;min-width:${s * .5}px;height:${s * .5}px;padding:0 ${s * .08}px;border-radius:${s * .25}px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);color:#fff;display:flex;align-items:center;justify-content:center}
.nt-b.wide{min-width:${s * 1.4}px}
.nt-m{position:absolute;pointer-events:auto;top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 10px);width:${s * .36}px;height:${s * .36}px;border-radius:${s * .1}px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);color:#fff;display:flex;align-items:center;justify-content:center}
.nt-m+.nt-m{right:calc(env(safe-area-inset-right,0px) + ${s * .36 + 20}px)}
`;

  function hold(el, onDown, onUp) {
    const ids = new Set();
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (_) {} if (!ids.size) onDown(e); ids.add(e.pointerId); buzz(); });
    const up = (e) => { if (!ids.delete(e.pointerId)) return; if (!ids.size) onUp(e); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  let haptics = true;
  const buzz = () => { if (haptics && navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} };

  function build(c) {
    const s = c.size, st = document.createElement('style'); st.textContent = CSS(c.opacity, s);
    root = document.createElement('div'); root.className = 'nt-root'; root.append(st);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    const K = c.keys || {};
    const dirs = ['up', 'down', 'left', 'right'].filter((d) => K[d]);

    if (c.dpad === 'stick' && dirs.length) {
      const pad = div('nt-pad nt-stick'), knob = div('nt-knob'); pad.append(knob); root.append(pad);
      const act = {}; // dir → bool
      const set = (dir, on) => { if (on === !!act[dir]) return; act[dir] = on; on ? press(K[dir]) : release(K[dir]); };
      const move = (e) => {
        const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
        knob.style.transform = `translate(${x * s * .3}px,${y * s * .3}px)`;
        const T = 0.38; set('left', x < -T); set('right', x > T); set('up', y < -T); set('down', y > T);
        NordTouch.axis = [Math.abs(x) > .15 ? x : 0, Math.abs(y) > .15 ? y : 0];
      };
      let pid = null;
      pad.addEventListener('pointerdown', (e) => { if (pid !== null) return; pid = e.pointerId; e.preventDefault(); e.stopPropagation(); pad.setPointerCapture(pid); move(e); buzz(); });
      pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
      const end = (e) => { if (e.pointerId !== pid) return; pid = null; knob.style.transform = ''; ['up', 'down', 'left', 'right'].forEach((d) => set(d, false)); NordTouch.axis = [0, 0]; };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    } else if (dirs.length) {
      const pad = div('nt-pad'), u = s / 3, pos = { up: [u, 0, '▲'], down: [u, 2 * u, '▼'], left: [0, u, '◀'], right: [2 * u, u, '▶'] };
      for (const d of dirs) {
        const b = div('nt-d'); b.textContent = pos[d][2]; b.style.left = pos[d][0] + 'px'; b.style.top = pos[d][1] + 'px';
        b.style.borderRadius = u * .25 + 'px';
        hold(b, () => { b.classList.add('on'); press(K[d]); }, () => { b.classList.remove('on'); release(K[d]); });
        pad.append(b);
      }
      root.append(pad);
    }

    const btns = (c.buttons || []).filter((b) => b && b.key);
    const row = div('nt-btns');
    for (const b of btns) {
      if (b.menu) continue;
      const el = div('nt-b' + (b.wide ? ' wide' : '')); el.textContent = b.label || b.key;
      hold(el, () => { el.classList.add('on'); press(b.key); }, () => { el.classList.remove('on'); release(b.key); });
      row.append(el);
    }
    if (row.childNodes.length) root.append(row);

    // corner buttons: menu key + (optionally) fullscreen
    const corner = btns.filter((b) => b.menu).map((b) => ({ key: b.key, text: '☰' }));
    if (c.menu && !corner.some((m) => m.key === c.menu)) corner.push({ key: c.menu, text: '☰' });
    for (const m of corner) {
      const el = div('nt-m'); el.textContent = m.text;
      hold(el, () => { el.classList.add('on'); press(m.key); }, () => { el.classList.remove('on'); release(m.key); });
      root.append(el);
    }
    if (c.fullscreen && document.documentElement.requestFullscreen) {
      const el = div('nt-m'); el.textContent = '⛶';
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); });
      root.append(el);
    }
    document.body.append(root);
  }
  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }

  // ---- public API ---------------------------------------------------------------------------------------------
  const urlFlag = () => { try { return new URLSearchParams(location.search).get('touch'); } catch (_) { return null; } };
  const isTouchDevice = () => (window.matchMedia && matchMedia('(pointer:coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  const NordTouch = {
    PRESETS, fromActions, axis: [0, 0],
    /** Show the controls. Returns false if they were not shown (not a touch device and not forced). */
    init(opts = {}) {
      NordTouch.destroy();
      const base = PRESETS[opts.preset] || PRESETS.default;
      const c = Object.assign({ opacity: 0.75, size: 150, menu: null, fullscreen: false, haptics: true, force: false }, base, opts);
      if (opts.keys) c.keys = Object.assign({}, c.keys, opts.keys);
      const flag = urlFlag();
      if (flag === '0' || flag === 'off') return false;
      if (!(c.force || flag === '1' || flag === 'on' || isTouchDevice())) return false;
      c.size = Math.max(90, Math.min(c.size, Math.min(innerWidth, innerHeight) * .45));
      haptics = c.haptics; cfgNow = c;
      const go = () => { build(c); };
      document.body ? go() : addEventListener('DOMContentLoaded', go, { once: true });
      return true;
    },
    show() { hidden = false; root && root.classList.remove('nt-off'); },
    hide() { hidden = true; root && root.classList.add('nt-off'); releaseAll(); },
    destroy() { releaseAll(); root && root.remove(); root = null; },
  };
  window.NordTouch = NordTouch;

  // a real keyboard (trusted keydown) takes over; the next touch brings the controls back
  addEventListener('keydown', (e) => { if (e.isTrusted && root && cfgNow && !cfgNow.force && !hidden && !/^(Meta|Control|Alt|Shift)/.test(e.code)) root.classList.add('nt-off'); }, true);
  addEventListener('touchstart', () => { if (root && !hidden) root.classList.remove('nt-off'); }, { capture: true, passive: true });
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
  // stop the browser pinch-zooming / scrolling / rubber-banding behind the game while the controls are up
  addEventListener('touchmove', (e) => { if (root && !root.classList.contains('nt-off') && e.cancelable && e.touches.length) e.preventDefault(); }, { passive: false });

  // auto-start from the <script> tag unless data-auto="false"
  const me = document.currentScript;
  if (!me || me.dataset.auto !== 'false') {
    const start = () => NordTouch.init(parseAttrs(me));
    document.body ? start() : addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
