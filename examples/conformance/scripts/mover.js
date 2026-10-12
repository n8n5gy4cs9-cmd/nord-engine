import { NordScript } from 'nord';
// Moves along the `Path` entity at `speed` units/s. 2D runtimes draw units as pixels * scale2d around the screen centre (y down),
// 3D runtimes use metres (y up) directly — same data, same logic.
export default class Mover extends NordScript {
  static attributes = { speed: { type: 'number', default: 1 }, scale2d: { type: 'number', default: 60 } };
  start() { this.path = this.scene.find('Path').getComponent('path'); this.s = 0; this.is2d = !!window.Phaser && !window.BABYLON; }
  update(dt) {
    this.s += this.attrs.speed * dt;
    const p = this.path.at(this.s);
    const k = this.is2d ? this.attrs.scale2d : 1;
    this.entity.pos = this.is2d ? [320 + p[0] * k, 180 - p[1] * k, 0] : [p[0], p[1], p[2]];
    this.lastPath = p;
  }
}
