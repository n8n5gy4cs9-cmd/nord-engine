// @nord {"id":"util.tween-anim","title":"Tween animator (scale / move / fade)","category":"utilities","tier":["2d","3d"],"tags":["tween","easing","animate","simple"],"description":"Plays a configured tween on start: bob, pulse, move-by, or spin-in. Shows how to use this.tween() and the ease table (linear, quadOut, cubicInOut, sineInOut, backOut, elasticOut, bounceOut…)."}
import { NordScript } from 'nord';

export default class TweenAnim extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['pulse', 'bob', 'moveBy', 'popIn'], default: 'pulse' }, amount: { type: 'number', default: 0.2 }, duration: { type: 'number', default: 0.8, min: 0.05 }, ease: { type: 'string', default: 'sineInOut' }, loop: { type: 'bool', default: true }, move: { type: 'vec3', default: [0, -20, 0] } };
  start() {
    const a = this.attrs, e = this.entity, o = { v: 0 }, base = { s: [...e.scale], p: [...e.pos] }, opt = { duration: a.duration, ease: a.ease, yoyo: a.kind !== 'popIn', repeat: a.loop && a.kind !== 'popIn' ? -1 : 0 };
    const apply = { pulse: () => { const k = 1 + o.v * a.amount; e.scale = base.s.map((x) => x * k); }, bob: () => { e.pos = [base.p[0], base.p[1] + o.v * a.move[1], base.p[2]]; }, moveBy: () => { e.pos = base.p.map((x, i) => x + o.v * a.move[i]); }, popIn: () => { e.scale = base.s.map((x) => x * o.v); } }[a.kind];
    this.tween(o, { v: 1 }, { ...opt, onUpdate: apply });
  }
}
