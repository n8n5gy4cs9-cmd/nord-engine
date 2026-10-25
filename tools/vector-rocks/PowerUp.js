import { MonoBehaviour, SerializeField, Destroy, Time, Mathf, Vector2, Random } from 'nord';
import Playfield from './Playfield.js';

/** A drifting icon. The ship picks it up (see Ship.OnTriggerEnter); if nobody does, it fades away.
 *  There is one prefab per kind (`pu-shield`, `pu-rapid`, …): same script, different icon and `type`. */
export default class PowerUp extends MonoBehaviour {
  static attributes = SerializeField({ type: 'shield', lifetime: 9 });

  Awake() { this.age = 0; }

  Start() { this.velocity = new Vector2(Random.Range(-18.5, 18.5), Random.Range(-18.5, 18.5)); }

  Update() {
    this.age += Time.deltaTime;
    const pulse = 1 + Math.sin(this.age * 6) * 0.12;                // a gentle throb says "pick me up"
    this.entity.scale = [pulse, pulse, 1];
    this.entity.native?.setAlpha(Mathf.Clamp01((this.lifetime - this.age) / 2));   // fade during the last two seconds
    if (this.age >= this.lifetime) Destroy(this.entity);
    Playfield.Wrap(this.entity, 16);
  }
}
