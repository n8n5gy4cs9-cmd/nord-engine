// @nord {"id":"physics.hitscan","title":"Hit-scan weapon (3D)","category":"physics","tier":["3d"],"tags":["weapon","raycast","fps"],"requires":["physics"],"description":"Fires an instant ray forward from the entity on 'fire' (rate-limited). The hit entity receives a 'damage' event {amount, from, point} and gets knocked back if it has a rigidbody."}
import { NordScript } from 'nord';

export default class Hitscan extends NordScript {
  static attributes = { damage: { type: 'number', default: 10 }, range: { type: 'number', default: 60 }, rate: { type: 'number', default: 6, min: 0.1 }, knockback: { type: 'number', default: 2 }, origin: { type: 'vec3', default: [0, 0.7, 0] }, sfx: { type: 'asset', assetType: 'audio', default: '' } };
  start() { this.cd = 0; }
  update(dt) {
    this.cd -= dt;
    if (!this.input.down('fire') || this.cd > 0) return;
    this.cd = 1 / this.attrs.rate;
    const e = this.entity, yaw = (e.rot[1] * Math.PI) / 180, pitch = ((e.find('Camera')?.rot[0] ?? 0) * Math.PI) / 180;
    const p = e.worldPos, o = this.attrs.origin, from = [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    const d = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], r = this.attrs.range;
    if (this.attrs.sfx) this.audio.play(this.attrs.sfx);
    const hit = this.physics.raycast(from, [from[0] + d[0] * r, from[1] + d[1] * r, from[2] + d[2] * r], { ignore: e });
    this.events.emit('shot', hit);
    if (!hit?.entity) return;
    hit.entity.emit('damage', { amount: this.attrs.damage, from: e, point: hit.point });
    if (hit.entity.getComponent('rigidbody')) this.physics.applyImpulse(hit.entity, d[0] * this.attrs.knockback, d[1] * this.attrs.knockback, d[2] * this.attrs.knockback);
  }
}
