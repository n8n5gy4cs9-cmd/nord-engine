import { MonoBehaviour, SerializeField, Destroy, Random, Time, Vector3 } from 'nord';
import Run from './Run.js';
import Fx from './Fx.js';

const TEXT = { coin: ['+1', '#ffd34d'], key: ['Key', '#ffffff'], potion: ['+1 ♥', '#ff7b8a'], chest: ['+5', '#ffd34d'] };
const SOUND = { coin: 'coin', key: 'pickup', potion: 'heal', chest: 'chest' };

export default class Pickup extends MonoBehaviour {
  static attributes = SerializeField({ kind: 'coin' });              // coin, key, potion or chest

  Start() { this.y0 = this.position.y; this.t = Random.value * 6; this.taken = false; }

  Update() {
    this.t += Time.deltaTime;
    const p = this.position;
    this.position = new Vector3(p.x, this.y0 + Math.sin(this.t * 4) * 1.5, p.z);
  }

  OnTriggerEnter(other) {
    if (this.taken || !other.hasTag('Hero')) return;
    this.taken = true;
    const p = this.position, [text, color] = TEXT[this.kind], run = Run.instance;
    Fx.FloatText(p.x, p.y, text, color);
    this.audio.play(`assets/audio/sfx/${SOUND[this.kind]}.wav`, { volume: 0.7 });
    if (this.kind === 'coin') run.AddCoin();
    else if (this.kind === 'key') run.AddKey();
    else if (this.kind === 'potion') run.Heal();
    else if (this.kind === 'chest') { run.AddCoin(5); Fx.Burst(p.x, p.y, { burst: 18 }); }
    Destroy(this.entity);
  }
}
