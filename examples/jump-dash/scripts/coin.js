import { MonoBehaviour, GameManager } from 'nord';
export default class Coin extends MonoBehaviour {
  OnTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    GameManager.instance.AddScore(1);
    this.Destroy();
  }
}
