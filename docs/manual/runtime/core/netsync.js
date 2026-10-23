// netSync component (Godot MultiplayerSynchronizer): the owning peer sends this entity's transform (and chosen instance variables) to
// everyone else, receivers move it smoothly. Owner = `entity.netOwner` (set by `net.spawn`) or the host for placed entities.
//   { "type": "netSync", "rate": 15, "rot": false, "vars": ["hp"], "interpolate": true, "smoothing": 15, "id": "" }
// Only sends while changing (plus a 1 s heartbeat). Needs a connected `game.net`. Script API: comp.isMine, comp.id.
import { registerComponent } from './entity.js';

const EPS = 0.001;
const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);
const same = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < EPS);

export function registerNetSync() {
  registerComponent('netSync', {
    create(e, d, comp) {
      comp.sent = null; comp.t = 0; comp.beat = 0; comp.target = null; comp.regId = null;
      Object.defineProperty(comp, 'id', { get: () => d.id || e.netId || e.id });
      Object.defineProperty(comp, 'isMine', { get: () => e.scene.game.net.isAuthority(e) });
      comp.receive = (m) => {
        comp.target = m;
        if (!comp.seen) { comp.seen = true; if (m.p) e.pos = m.p; if (m.r) e.rot = m.r; if (m.s) e.scale = m.s; }
      };
    },
    update(comp, dt) {
      const e = comp.entity, net = e.scene.game.net, d = comp.data;
      if (!net.room) return;
      const id = comp.id;
      if (comp.regId !== id) { if (comp.regId) net.syncs.delete(comp.regId); net.syncs.set(id, comp); comp.regId = id; }
      if (net.isAuthority(e)) {
        comp.t += dt; comp.beat += dt;
        if (comp.t < 1 / (d.rate ?? 15)) return;
        comp.t = 0;
        const p = r3(e.pos), r = d.rot ? r3(e.rot) : null, s = d.scale ? r3(e.scale) : null;
        const v = d.vars?.length ? Object.fromEntries(d.vars.map((k) => [k, e.vars[k]])) : null;
        const vj = v ? JSON.stringify(v) : null;
        if (same(p, comp.sent?.p) && same(r, comp.sent?.r) && same(s, comp.sent?.s) && vj === comp.sent?.vj && comp.beat < 1) return;
        comp.beat = 0; comp.sent = { p, r, s, vj };
        net.send('__sync', { id, p, r, s, v });
      } else if (comp.target) {
        const m = comp.target, k = d.interpolate === false ? 1 : 1 - Math.exp(-dt * (d.smoothing ?? 15));
        const mix = (cur, goal) => cur.map((c, i) => c + (goal[i] - c) * k);
        if (m.p) e.pos = mix(e.pos, m.p);
        if (m.r) e.rot = mix(e.rot, m.r);
        if (m.s) e.scale = mix(e.scale, m.s);
        if (m.v) for (const [key, val] of Object.entries(m.v)) e.vars[key] = val;
      }
    },
    destroy(comp) { if (comp.regId && comp.entity.scene.game.net.syncs.get(comp.regId) === comp) comp.entity.scene.game.net.syncs.delete(comp.regId); },
  });
}
