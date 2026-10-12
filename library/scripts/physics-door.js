// @nord {"id":"physics.hinge-door","title":"Hinge door / slider","category":"physics","tier":["2d","3d"],"tags":["door","interact","tween"],"description":"Opens/closes by tweening rotation (hinge) or position (slide). Toggle via the entity's 'interact' event or the 'open'/'close' entity events."}
import { NordScript } from 'nord';

export default class HingeDoor extends NordScript {
  static attributes = { mode: { type: 'enum', options: ['hinge', 'slide'], default: 'hinge' }, amount: { type: 'vec3', default: [0, 90, 0], label: 'Rotation (deg) or offset' }, time: { type: 'number', default: 0.5, min: 0 }, startOpen: { type: 'bool', default: false } };
  start() {
    const e = this.entity; this.closed = this.attrs.mode === 'hinge' ? [...e.rot] : [...e.pos]; this.isOpen = false;
    e.on('interact', () => this.toggle()); e.on('open', () => this.set(true)); e.on('close', () => this.set(false));
    if (this.attrs.startOpen) this.set(true, 0);
  }
  toggle() { this.set(!this.isOpen); }
  set(open, time = this.attrs.time) {
    if (open === this.isOpen) return; this.isOpen = open;
    const hinge = this.attrs.mode === 'hinge', key = hinge ? 'rot' : 'pos', to = this.closed.map((v, i) => v + (open ? this.attrs.amount[i] : 0));
    const o = [...this.entity[key]], apply = () => { this.entity[key] = [...o]; };
    const proxy = { 0: o[0], 1: o[1], 2: o[2] };
    this.tween(proxy, { 0: to[0], 1: to[1], 2: to[2] }, { duration: time || 0.001, onUpdate: () => { this.entity[key] = [proxy[0], proxy[1], proxy[2]]; } });
    this.events.emit(open ? 'door:open' : 'door:close', this.entity);
  }
}
