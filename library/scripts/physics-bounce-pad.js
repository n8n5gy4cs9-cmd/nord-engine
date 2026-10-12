// @nord {"id":"physics.bounce-pad","title":"Bounce pad","category":"physics","tier":["2d","3d"],"tags":["bounce","spring","trigger"],"requires":["trigger"],"description":"Launches whatever enters the trigger upward with a fixed speed and plays a sound."}
import { NordScript } from 'nord';

export default class BouncePad extends NordScript {
  static attributes = { force: { type: 'number', default: 600, min: 0 }, tag: { type: 'string', default: '', label: 'Only affect this tag (empty = all)' }, sfx: { type: 'asset', assetType: 'audio', default: '' } };
  onTriggerEnter(o) {
    if (this.attrs.tag && !o.hasTag(this.attrs.tag)) return;
    const three = this.game.project.type === '3d';
    if (three) this.physics.setVelocity(o, null, this.attrs.force / 60, null); else this.physics.setVelocity(o, null, -this.attrs.force);
    if (this.attrs.sfx) this.audio.play(this.attrs.sfx);
    this.entity.emit('bounce', o);
  }
}
