// @nord {"id":"ai.behaviour-tree","title":"Behaviour tree (lite)","category":"ai","tier":["2d","3d"],"tags":["behaviour-tree","bt","ai"],"description":"Minimal behaviour tree: sequence/selector/inverter/action/condition nodes returning 'success'|'failure'|'running'. Import { sequence, selector, action, cond, run } from './ai-behaviour-tree.js'. The default script runs a sample tree: flee when the player is near, else wander."}
import { NordScript } from 'nord';

export const S = 'success', F = 'failure', R = 'running';
export const sequence = (...c) => (ctx) => { for (const n of c) { const r = n(ctx); if (r !== S) return r; } return S; };
export const selector = (...c) => (ctx) => { for (const n of c) { const r = n(ctx); if (r !== F) return r; } return F; };
export const inverter = (n) => (ctx) => ({ [S]: F, [F]: S, [R]: R })[n(ctx)];
export const action = (fn) => (ctx) => fn(ctx) ?? S;
export const cond = (fn) => (ctx) => (fn(ctx) ? S : F);
export const run = (tree, ctx) => tree(ctx);

export default class BtDemo extends NordScript {
  static attributes = { speed: { type: 'number', default: 70 }, fearRadius: { type: 'number', default: 120 }, target: { type: 'string', default: 'player' } };
  start() {
    const a = this.attrs, e = this.entity, p = () => this.scene.findByTag(a.target)[0];
    this.dir = 1; this.t = 0;
    this.tree = selector(
      sequence(cond(() => p() && Math.hypot(p().pos[0] - e.pos[0], p().pos[1] - e.pos[1]) < a.fearRadius), action(() => { this.physics.setVelocity(e, Math.sign(e.pos[0] - p().pos[0]) * a.speed * 1.5, null); })),
      action(() => { if ((this.t -= 1 / 60) <= 0) { this.t = this.rng.range(1, 3); this.dir = this.rng.pick([-1, 0, 1]); } this.physics.setVelocity(e, this.dir * a.speed * 0.5, null); }),
    );
  }
  fixedUpdate() { run(this.tree, this); }
}
