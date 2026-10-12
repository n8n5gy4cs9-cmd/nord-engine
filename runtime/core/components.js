// Backend-independent components: DOM ui* widgets, spawner, path. Registered by every backend's boot via registerCoreComponents().
import { registerComponent } from './entity.js';

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
