// A data core: collected when the skiff gets close. Tells the game ('orb' event); the event sheet and the graph react.
import { MonoBehaviour, GameManager } from 'nord';

export default class Orb extends MonoBehaviour {
  static attributes = { value: { type: 'number', default: 10 }, radius: { type: 'number', default: 1.8 } };

  Start() { this.skiff = this.FindWithTag('player'); }

  Update() {
    if (!this.skiff || this.skiff.destroyed || this.collected) return;
    const a = this.entity.worldPos, b = this.skiff.worldPos;
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) > this.radius + 0.8) return;
    this.collected = true;
    GameManager.instance?.AddScore(this.value);
    this.game.audio?.play('assets/audio/sfx/coin.wav', { bus: 'sfx', volume: 0.8 });
    this.game.events.emit('orb', { value: this.value, at: a });
    this.Destroy();
  }
}
