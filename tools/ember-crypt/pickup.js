import { NordScript } from 'nord';
import { floatText, burst } from './fx.js';

const TEXT = { coin: ['+1', '#ffd34d'], key: ['Key', '#ffffff'], potion: ['+1 ♥', '#ff7b8a'], chest: ['+5', '#ffd34d'] };
const SOUND = { coin: 'coin', key: 'pickup', potion: 'heal', chest: 'chest' };

export default class Pickup extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['coin', 'key', 'potion', 'chest'], default: 'coin' } };

  start() {
    this.y0 = this.entity.pos[1];
    this.t = this.rng.range(0, 6);
    this.taken = false;
  }

  update(dt) {
    this.t += dt;
    const p = this.entity.pos;
    this.entity.pos = [p[0], this.y0 + Math.sin(this.t * 4) * 1.5, p[2]];
  }

  onTriggerEnter(other) {
    if (this.taken || !other.hasTag('hero')) return;
    this.taken = true;
    const { kind } = this.attrs, [x, y] = this.entity.pos;
    const [text, color] = TEXT[kind];
    floatText(this.scene, x, y, text, color);
    this.audio.play(`assets/audio/sfx/${SOUND[kind]}.wav`, { volume: 0.7 });
    if (kind === 'chest') burst(this.scene, x, y, { count: 18 });
    this.events.emit('pickup', { kind });
    this.entity.destroy();
  }
}
