// @nord {"id":"controller3d.rts-cam","title":"RTS camera","category":"controllers","tier":["3d"],"tags":["camera","rts","pan","edge-scroll"],"description":"Top-down strategy camera rig: pan with WASD or screen edges, rotate with 'rotateLeft'/'rotateRight' actions. Put on a pivot entity that has the camera as a child (angled down)."}
import { NordScript } from 'nord';

export default class RtsCam extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 14, min: 0 },
    edge: { type: 'number', default: 0, min: 0, label: 'Edge scroll margin (px, 0 = off)' },
    rotateSpeed: { type: 'number', default: 90 },
    bounds: { type: 'vec2', default: [60, 60], label: 'Max |x|,|z|' },
    screen: { type: 'vec2', default: [1280, 720], label: 'Canvas size for edge scroll' },
  };
  update(dt) {
    const a = this.attrs;
    let [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    const p = this.input.pointer;
    if (a.edge) { if (p.x < a.edge) mx = -1; else if (p.x > a.screen[0] - a.edge) mx = 1; if (p.y < a.edge) mz = 1; else if (p.y > a.screen[1] - a.edge) mz = -1; }
    const rot = [...this.entity.rot]; rot[1] += this.input.axis('rotateLeft', 'rotateRight') * a.rotateSpeed * dt; this.entity.rot = rot;
    const r = (rot[1] * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r), s = a.speed * dt, q = this.entity.pos;
    this.entity.pos = [Math.max(-a.bounds[0], Math.min(a.bounds[0], q[0] + (sn * mz + cs * mx) * s)), q[1], Math.max(-a.bounds[1], Math.min(a.bounds[1], q[2] + (cs * mz - sn * mx) * s))];
  }
}
