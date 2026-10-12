// @nord {"id":"camera.follow","title":"Camera follow (lerp + deadzone + look-ahead)","category":"camera","tier":["2d"],"tags":["camera","follow","deadzone"],"description":"Put on the camera entity (its position is the view centre; remove the camera's own 'follow'): smoothly follows a target (by name or tag) with a deadzone and optional look-ahead in the movement direction, clamped to world bounds."}
import { NordScript } from 'nord';

export default class CameraFollow extends NordScript {
  static attributes = {
    target: { type: 'string', default: 'Player', label: 'Target entity name (or tag if no name matches)' },
    smoothing: { type: 'number', default: 6, min: 0, label: 'Follow speed (0 = snap)' },
    deadzone: { type: 'vec2', default: [24, 16] },
    lookAhead: { type: 'number', default: 0, min: 0, label: 'Look-ahead distance (px)' },
    bounds: { type: 'array', default: [], label: 'World bounds [minX,minY,maxX,maxY] (empty = none)' },
    viewport: { type: 'vec2', default: [640, 360] },
  };
  start() {
    const t = this.scene.find(this.attrs.target) ?? this.scene.findByTag(this.attrs.target)[0];
    this.t = t; this.pos = t ? [t.pos[0], t.pos[1]] : [0, 0]; this.last = t ? [...t.pos] : [0, 0, 0]; this.ahead = 0;
    this.entity.pos = [...this.pos, this.entity.pos[2]];
  }
  lateUpdate(dt) {
    const t = this.t; if (!t || t.destroyed) return;
    const a = this.attrs, dx = t.pos[0] - this.last[0];
    this.last = [...t.pos];
    this.ahead += ((Math.sign(dx) * a.lookAhead || (dx === 0 ? this.ahead : 0)) - this.ahead) * Math.min(1, 4 * dt);
    const gx = t.pos[0] + this.ahead, gy = t.pos[1];
    let tx = this.pos[0], ty = this.pos[1];
    if (Math.abs(gx - tx) > a.deadzone[0]) tx = gx - Math.sign(gx - tx) * a.deadzone[0];
    if (Math.abs(gy - ty) > a.deadzone[1]) ty = gy - Math.sign(gy - ty) * a.deadzone[1];
    const k = a.smoothing ? Math.min(1, a.smoothing * dt) : 1;
    this.pos[0] += (tx - this.pos[0]) * k; this.pos[1] += (ty - this.pos[1]) * k;
    let [x, y] = this.pos;
    if (a.bounds.length === 4) {
      const hw = a.viewport[0] / 2, hh = a.viewport[1] / 2;
      x = Math.max(a.bounds[0] + hw, Math.min(a.bounds[2] - hw, x)); y = Math.max(a.bounds[1] + hh, Math.min(a.bounds[3] - hh, y));
    }
    this.entity.pos = [x, y, this.entity.pos[2]];
  }
}
