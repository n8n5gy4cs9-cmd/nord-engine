/*! nord-lite — tiny helpers for the plain `html` tier. One classic <script>, no modules, works from file://. Crowelian 2026 + Sonnet. */
(function (global) {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    linear: (t) => t, quadOut: (t) => 1 - (1 - t) * (1 - t), quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
    cubicOut: (t) => 1 - (1 - t) ** 3, sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2, backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  };

  /** Seedable rng (mulberry32). */
  function Rng(seed) {
    let s = (seed === undefined ? Date.now() : seed) >>> 0;
    const next = () => { let t = (s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { next, range: (a, b) => a + next() * (b - a), int: (a, b) => Math.floor(a + next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
  }

  /** Keyboard + pointer state. keys: Input.down('KeyA'); actions: Input.map({ jump: ['Space'] }) then Input.down('jump'). */
  const Input = (() => {
    const held = new Set(), tapped = new Set(), actions = {}, pointer = { x: 0, y: 0, down: false };
    let prev = new Set(), cur = new Set();
    global.addEventListener('keydown', (e) => { held.add(e.code); tapped.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
    global.addEventListener('keyup', (e) => held.delete(e.code));
    global.addEventListener('blur', () => held.clear());
    // a key pressed *and* released between two frames still counts as down for that frame (`tapped`)
    const isDown = (n) => (actions[n] ? actions[n].some((c) => held.has(c) || tapped.has(c)) : held.has(n) || tapped.has(n));
    return {
      pointer, map(a) { Object.assign(actions, a); },
      down: (n) => cur.has(n), pressed: (n) => cur.has(n) && !prev.has(n), released: (n) => !cur.has(n) && prev.has(n),
      axis: (neg, pos) => (cur.has(pos) ? 1 : 0) - (cur.has(neg) ? 1 : 0),
      _frame() { prev = cur; cur = new Set([...held, ...tapped, ...Object.keys(actions).filter(isDown)]); tapped.clear(); },
      _bind(el) {
        const pos = (e) => { const r = el.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * (el.width || r.width); pointer.y = ((e.clientY - r.top) / r.height) * (el.height || r.height); };
        el.addEventListener('pointermove', pos);
        el.addEventListener('pointerdown', (e) => { pos(e); pointer.down = true; held.add('Mouse' + e.button); tapped.add('Mouse' + e.button); });
        global.addEventListener('pointerup', (e) => { pointer.down = false; held.delete('Mouse' + e.button); });
      },
    };
  })();

  /** Fixed-timestep-free main loop: Nord.loop((dt) => …). Returns stop(). dt is clamped to 0.1s. */
  function loop(fn) {
    let last = performance.now(), id = 0, stopped = false;
    const frame = (t) => { if (stopped) return; const dt = Math.min((t - last) / 1000, 0.1); last = t; Input._frame(); Tweens.update(dt); fn(dt); id = requestAnimationFrame(frame); };
    id = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(id); };
  }

  /** Tweens: Nord.tween(obj, { x: 100 }, { duration: 0.5, ease: 'quadOut', onComplete }) — advanced by Nord.loop. */
  const Tweens = (() => {
    let items = [];
    return {
      add(target, to, o = {}) {
        const it = { target, to, from: {}, t: 0, dur: o.duration ?? 1, ease: ease[o.ease ?? 'quadOut'] ?? ease.quadOut, o, started: false };
        items.push(it); return () => { it.dead = true; };
      },
      update(dt) {
        for (const it of items) {
          if (it.dead) continue;
          if (!it.started) { for (const k in it.to) it.from[k] = it.target[k]; it.started = true; }
          it.t = Math.min(1, it.t + dt / it.dur);
          for (const k in it.to) it.target[k] = lerp(it.from[k], it.to[k], it.ease(it.t));
          if (it.t >= 1) { it.dead = true; it.o.onComplete && it.o.onComplete(it.target); }
        }
        items = items.filter((i) => !i.dead);
      },
    };
  })();

  /** Create a crisp, DPR-aware canvas inside `parent` (default body), logical size w×h, scaled to fit the window. Returns { canvas, ctx, w, h }. */
  function canvas(w, h, parent) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.style.cssText = 'display:block;margin:auto;max-width:100vw;max-height:100vh;image-rendering:pixelated;touch-action:none';
    (parent || document.body).appendChild(c);
    Input._bind(c);
    return { canvas: c, ctx: c.getContext('2d'), w, h };
  }

  /** Load images: Nord.images({ hero: 'hero.png' }).then(imgs => …). */
  function images(map) {
    return Promise.all(Object.entries(map).map(([k, src]) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res([k, i]); i.onerror = () => rej(new Error('failed to load ' + src)); i.src = src; }))).then(Object.fromEntries);
  }

  /** Sound: Nord.sound.play('coin.wav') (unlocks on first gesture). */
  const sound = (() => {
    let ctx = null; const cache = {}; let master = 1;
    const get = () => ctx || (ctx = new (global.AudioContext || global.webkitAudioContext)());
    const unlock = () => { try { get().resume(); } catch (e) { /* no audio */ } };
    ['pointerdown', 'keydown'].forEach((ev) => global.addEventListener(ev, unlock, { once: false }));
    return {
      volume(v) { master = clamp(v, 0, 1); },
      async play(src, o = {}) {
        try {
          const c = get();
          const buf = cache[src] || (cache[src] = fetch(src).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)));
          const s = c.createBufferSource(), g = c.createGain();
          s.buffer = await buf; s.loop = !!o.loop; s.playbackRate.value = o.rate || 1; g.gain.value = (o.volume ?? 1) * master;
          s.connect(g); g.connect(c.destination); s.start(); return s;
        } catch (e) { return null; }
      },
    };
  })();

  /** localStorage with JSON + a per-game prefix: const save = Nord.save('mygame'); save.set('hi', 5); save.get('hi', 0). */
  function save(id) {
    const k = (n) => `nord:${id}:${n}`;
    return {
      get(n, d) { try { const v = localStorage.getItem(k(n)); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(n, v) { try { localStorage.setItem(k(n), JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
      remove(n) { try { localStorage.removeItem(k(n)); } catch (e) { /* ignore */ } },
    };
  }

  /** Tiny DOM helper: Nord.el('button', { text: 'Go', onclick: fn, style: 'color:red' }, parent). */
  function el(tag, props = {}, parent) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); }
    if (parent) parent.appendChild(e);
    return e;
  }

  global.Nord = { version: '0.1.0', clamp, lerp, ease, Rng, Input, loop, tween: Tweens.add, canvas, images, sound, save, el };
})(window);
