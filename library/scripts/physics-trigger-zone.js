// @nord {"id":"physics.trigger-zone","title":"Trigger zone → event","category":"physics","tier":["2d","3d"],"tags":["trigger","event","zone"],"requires":["trigger"],"description":"Emits global events when tagged entities enter/leave this zone, optionally once. Great glue for checkpoints, cutscenes, doors."}
import { NordScript } from 'nord';

export default class TriggerZone extends NordScript {
  static attributes = { tag: { type: 'string', default: 'player' }, onEnter: { type: 'string', default: 'zone:enter' }, onExit: { type: 'string', default: '' }, once: { type: 'bool', default: false } };
  start() { this.fired = false; }
  onTriggerEnter(o) { if (!o.hasTag(this.attrs.tag) || (this.attrs.once && this.fired)) return; this.fired = true; if (this.attrs.onEnter) this.events.emit(this.attrs.onEnter, { zone: this.entity, who: o }); }
  onTriggerExit(o) { if (o.hasTag(this.attrs.tag) && this.attrs.onExit) this.events.emit(this.attrs.onExit, { zone: this.entity, who: o }); }
}
