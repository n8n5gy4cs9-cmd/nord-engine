import { MonoBehaviour, GameManager } from 'nord';

export default class Coin extends MonoBehaviour {
  OnTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    GameManager.instance.AddScore(1);
    this.Destroy();            // destroys this coin (this.entity)
  }
  Start() { this.Invoke('Vanish', 8); } // coins disappear after 8 seconds
  Vanish() { this.Destroy(); }
}
