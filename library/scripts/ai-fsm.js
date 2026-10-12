// @nord {"id":"ai.fsm","title":"State machine (FSM)","category":"ai","tier":["2d","3d"],"tags":["fsm","state","utility"],"description":"Tiny finite-state-machine helper: new FSM({idle:{enter,update,exit,next}}, 'idle'). Import it from this file in your own scripts: `import { FSM } from './ai-fsm.js'`. The default-exported script demonstrates it by cycling idle→walk with a timer."}
import { NordScript } from 'nord';

/** states: { name: { enter(ctx), update(ctx, dt) → nextStateName|void, exit(ctx) } } */
export class FSM {
  constructor(states, initial, ctx = {}) { this.states = states; this.ctx = ctx; this.name = null; this.time = 0; this.go(initial); }
  go(name) { if (name === this.name || !this.states[name]) return; this.states[this.name]?.exit?.(this.ctx); this.name = name; this.time = 0; this.states[name].enter?.(this.ctx); }
  update(dt) { this.time += dt; const next = this.states[this.name]?.update?.(this.ctx, dt); if (next) this.go(next); }
}

export default class FsmDemo extends NordScript {
  static attributes = { idleTime: { type: 'number', default: 1.5 }, walkTime: { type: 'number', default: 2 }, speed: { type: 'number', default: 40 } };
  start() {
    const a = this.attrs, e = this.entity;
    this.fsm = new FSM({
      idle: { enter: () => this.physics?.setVelocity(e, 0, null), update: (c) => (this.fsm.time > a.idleTime ? 'walk' : null) },
      walk: { enter: () => { this.dir = this.rng.pick([-1, 1]); }, update: () => { this.physics?.setVelocity(e, this.dir * a.speed, null); return this.fsm.time > a.walkTime ? 'idle' : null; } },
    }, 'idle');
  }
  update(dt) { this.fsm.update(dt); }
}
