// @nord {"id":"fx.parallax-layers","title":"Parallax layers (manual)","category":"fx","tier":["2d"],"tags":["parallax","background","scroll"],"description":"Moves this background entity at a fraction of the camera/target movement for depth, with optional auto-scroll (clouds). Use the built-in 'parallax' component for tiled textures; use this for individual sprites."}
import { NordScript } from 'nord';

export default class ParallaxLayer extends NordScript {
  static attributes = { factor: { type: 'vec2', default: [0.5, 0.2] }, follow: { type: 'string', default: 'Player' }, autoScroll: { type: 'vec2', default: [0, 0], label: 'Auto-scroll px/s' }, wrap: { type: 'number', default: 0, label: 'Wrap width (0 = off)' } };
  start() { this.t = this.scene.find(this.attrs.follow); this.o = [...this.entity.pos]; this.t0 = this.t ? [...this.t.pos] : [0, 0]; this.s = [0, 0]; }
  lateUpdate(dt) {
    const a = this.attrs; this.s[0] += a.autoScroll[0] * dt; this.s[1] += a.autoScroll[1] * dt; const c = this.t ? [this.t.pos[0] - this.t0[0], this.t.pos[1] - this.t0[1]] : [0, 0];
    let x = this.o[0] + c[0] * (1 - a.factor[0]) + this.s[0]; if (a.wrap) x = this.o[0] + ((((x - this.o[0]) % a.wrap) + a.wrap) % a.wrap) - a.wrap / 2;
    this.entity.pos = [x, this.o[1] + c[1] * (1 - a.factor[1]) + this.s[1], this.o[2]];
  }
}
