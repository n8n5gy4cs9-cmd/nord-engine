// @nord {"id":"controller3d.interact-ray","title":"Interaction ray","category":"controllers","tier":["3d"],"tags":["interact","raycast","fps"],"requires":["physics"],"description":"Casts a ray forward from the entity; when you press 'interact' the hit entity gets its 'interact' event (and onInteract() on its scripts). Emits 'focus' with the hovered entity."}
import { NordScript } from 'nord';

export default class InteractRay extends NordScript {
  static attributes = { range: { type: 'number', default: 3, min: 0 }, tag: { type: 'string', default: 'interactable' }, origin: { type: 'vec3', default: [0, 0.7, 0] } };
  update() {
    const e = this.entity, yaw = (e.worldRot?.[1] ?? e.rot[1]) * Math.PI / 180, pitch = ((e.find('Camera')?.rot[0]) ?? 0) * Math.PI / 180;
    const p = e.worldPos, o = this.attrs.origin, from = [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    const d = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], r = this.attrs.range;
    const hit = this.physics.raycast?.(from, [from[0] + d[0] * r, from[1] + d[1] * r, from[2] + d[2] * r], { ignore: e });
    const target = hit?.entity?.hasTag(this.attrs.tag) ? hit.entity : null;
    if (target !== this.focus) { this.focus = target; this.events.emit('focus', target); }
    if (target && this.input.pressed('interact')) { target.emit('interact', e); target.callScripts('onInteract', e); }
  }
}
