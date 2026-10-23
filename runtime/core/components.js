// Backend-independent components: DOM ui* widgets, spawner, path. Registered by every backend's boot via registerCoreComponents().
import { registerComponent } from './entity.js';
import { attachGraph } from './graph/runner.js';
import { AnimatorController, validateController } from './animator.js';

export function registerCoreComponents(game) {
  const ui = () => game.ui;
  const pos = (d) => ({ x: d.x ?? 0, y: d.y ?? 0, anchor: d.anchor ?? 'tl', w: d.w, h: d.h, screen: d.screen ?? 'hud' });
  const wrap = (make) => ({
    create(e, d, comp) { comp.h = make(d); comp.h.el.hidden = !e.enabled; },
    update(comp) { comp.h.el.hidden = !comp.entity.enabled; },
    destroy(comp) { comp.h?.remove(); },
    set(comp, k, v) { comp.data[k] = v; comp.h.set?.(v); },
  });
  registerComponent('uiPanel', { ...wrap((d) => ui().panel(pos(d))) });
  registerComponent('uiLabel', { ...wrap((d) => ui().label(d.text ?? '', { ...pos(d), size: d.size, color: d.color })) });
  registerComponent('uiImage', { ...wrap((d) => ui().image(d.src, pos(d))) });
  registerComponent('uiBar', { ...wrap((d) => ui().bar(d.value ?? 1, { ...pos(d), color: d.color })) });
  registerComponent('uiButton', {
    create(e, d, comp) { comp.h = ui().button(d.text ?? 'Button', () => { e.emit('click'); e.callScripts('onClick'); if (d.event) game.events.emit(d.event, e); }, pos(d)); },
    destroy(comp) { comp.h?.remove(); },
    update(comp) { comp.h.el.hidden = !comp.entity.enabled; },
    set(comp, k, v) { comp.data[k] = v; if (k === 'text') comp.h.set?.(v); },
  });

  registerComponent('audioSource', {
    create(e, d, comp) {
      comp.play = (o = {}) => { comp.handle?.stop(); comp.handle = game.audio.play(d.clip, { volume: d.volume ?? 1, loop: !!d.loop, bus: d.bus ?? 'sfx', ...o }); return comp.handle; };
      comp.stop = () => comp.handle?.stop();
      if (d.autoplay) comp.play();
    },
    destroy(comp) { if (comp.data.loop) comp.stop(); },
  });

  registerComponent('audioListener', {});

  // graph: runs a visual-scripting graph file (graphs/*.graph.json) on this entity. data: { file }
  registerComponent('graph', {
    create(e, d, comp) {
      if (!d.file) return;
      attachGraph(game, e.scene, d.file, e).then((g) => { comp.g = g; if (e.destroyed) g.stop(); }).catch((err) => game.reportError(err, { constructor: { name: `graph ${d.file}` } }, 'load'));
    },
    destroy(comp) { comp.g?.destroy(); },
  });

  // animator: Unity-style state machine (anim/*.animator.json, docs/ANIMATOR.md) that switches the clip of this entity's
  // animatedSprite. data: { controller, params? }. Script API: setBool/setInt/setFloat/setTrigger/resetTrigger/get/play, `state`.
  registerComponent('animator', {
    create(e, d, comp) {
      comp.ctrl = null; comp.pre = { ...(d.params ?? {}) }; comp.fresh = false;
      comp.param = (n, v) => { if (comp.ctrl) comp.ctrl.set(n, v); else comp.pre[n] = v; };
      comp.setBool = comp.setInt = comp.setFloat = comp.param;
      comp.setTrigger = (n) => comp.ctrl ? comp.ctrl.setTrigger(n) : (comp.pre[n] = true);
      comp.resetTrigger = (n) => comp.ctrl ? comp.ctrl.resetTrigger(n) : delete comp.pre[n];
      comp.get = (n) => comp.ctrl?.get(n) ?? comp.pre[n];
      comp.play = (s) => comp.ctrl?.play(s);
      Object.defineProperty(comp, 'state', { get: () => comp.ctrl?.state ?? null });
      if (!d.controller) return;
      game.loadJSON(d.controller).then((def) => {
        if (e.destroyed) return;
        const bad = validateController(def);
        if (bad.length) game.warn(`[nord] animator ${d.controller}: ${bad.join('; ')}`);
        comp.ctrl = new AnimatorController(def, (name, anim, st) => {
          const sprite = e.getComponent('animatedSprite');
          if (!sprite) return;
          if (st.speed != null) e.set('animatedSprite', 'speed', st.speed);
          e.set('animatedSprite', 'anim', anim);
        });
        for (const [n, v] of Object.entries(comp.pre)) { if (comp.ctrl.types[n] === 'trigger') { if (v) comp.ctrl.setTrigger(n); } else comp.ctrl.set(n, v); }
      }).catch((err) => game.reportError(err, { constructor: { name: `animator ${d.controller}` } }, 'load'));
    },
    update(comp, dt) {
      const c = comp.ctrl; if (!c || !comp.entity.enabled) return;
      const clip = comp.entity.getComponent('animatedSprite')?.obj?.anims?.currentAnim; // Phaser: clip length for exit times
      c.lengthHint = clip?.duration ? clip.duration / 1000 : 0;
      c.update(dt);
    },
    set(comp, k, v) { comp.data[k] = v; if (k !== 'controller') comp.param(k, v); },
  });

  // spawner: periodically spawns a prefab at the entity's position. data: { prefab, interval, max, offset:[x,y,z], autostart, jitter }
  registerComponent('spawner', {
    create(e, d, comp) {
      comp.live = new Set(); comp.t = d.interval ?? 1; comp.on = d.autostart !== false;
      comp.spawn = async () => {
        const w = e.worldPos, o = d.offset ?? [0, 0, 0], j = d.jitter ?? [0, 0, 0];
        const r = () => (game.rng.next() - 0.5) * 2;
        const ent = await e.scene.spawn(d.prefab, { pos: [w[0] + o[0] + r() * j[0], w[1] + o[1] + r() * j[1], w[2] + o[2] + r() * j[2]] });
        comp.live.add(ent); return ent;
      };
    },
    update(comp, dt) {
      const d = comp.data;
      for (const x of comp.live) if (x.destroyed) comp.live.delete(x);
      if (!comp.on || !comp.entity.enabled) return;
      comp.t -= dt;
      if (comp.t <= 0) { comp.t += d.interval ?? 1; if (!d.max || comp.live.size < d.max) comp.spawn(); }
    },
  });

  // path: waypoint list with sampling. data: { points:[[x,y,z]...], loop }
  registerComponent('path', {
    create(e, d, comp) {
      const pts = d.points ?? [];
      const segs = []; let total = 0;
      for (let i = 0; i < pts.length - (d.loop ? 0 : 1); i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const l = Math.hypot(...a.map((v, k) => b[k] - v)); segs.push([a, b, l]); total += l;
      }
      comp.length = total;
      /** Point at distance `s` along the path (wraps if loop, clamps otherwise). */
      comp.at = (s) => {
        if (!segs.length) return pts[0] ? [...pts[0]] : [0, 0, 0];
        s = d.loop ? ((s % total) + total) % total : Math.min(Math.max(s, 0), total);
        for (const [a, b, l] of segs) { if (s <= l || (a === segs.at(-1)[0])) { const t = l ? Math.min(s / l, 1) : 0; return a.map((v, k) => v + (b[k] - v) * t); } s -= l; }
        return [...segs.at(-1)[1]];
      };
      comp.points = pts;
    },
  });
}
