// @nord {"id":"ai.waypoints","title":"Follow waypoint path","category":"ai","tier":["2d","3d"],"tags":["path","waypoints","moving"],"requires":["path"],"description":"Moves along a 'path' component on this or another entity (by name) at a speed; loops or ping-pongs. Great for tower-defense creeps and patrols."}
import { NordScript } from 'nord';

export default class Waypoints extends NordScript {
  static attributes = { pathEntity: { type: 'string', default: '', label: 'Entity with the path component (empty = self)' }, speed: { type: 'number', default: 80 }, mode: { type: 'enum', options: ['once', 'loop', 'pingpong'], default: 'once' }, faceDirection: { type: 'bool', default: false } };
  start() { const o = this.attrs.pathEntity ? this.scene.find(this.attrs.pathEntity) : this.entity; this.path = o?.getComponent('path'); this.s = 0; this.dir = 1; }
  update(dt) {
    if (!this.path || !this.path.length) return;
    this.s += this.dir * this.attrs.speed * dt; const L = this.path.length, m = this.attrs.mode;
    if (m === 'loop') this.s = ((this.s % L) + L) % L; else if (m === 'pingpong') { if (this.s > L || this.s < 0) { this.dir = -this.dir; this.s = Math.max(0, Math.min(L, this.s)); } } else if (this.s >= L) { this.s = L; this.entity.emit('pathEnd'); this.events.emit('pathEnd', this.entity); this.attrs.speed = 0; }
    const p = this.path.at(this.s); if (this.attrs.faceDirection) { const q = this.path.at(this.s + 1); this.entity.rot = [0, 0, (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI]; }
    this.entity.pos = p;
  }
}
