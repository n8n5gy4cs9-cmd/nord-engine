import { MonoBehaviour, SerializeField, GameManager, Time } from 'nord';
import Hero from './Hero.js';

/** Grace time, blinking, shake and sound around the GameManager's lives. Enemies call TakeDamage(); nothing else knows about hearts. */
export default class Health extends MonoBehaviour {
  static attributes = SerializeField({ grace: 1 });

  Awake() { this.protectedFor = 0; }

  TakeDamage(from) {
    if (this.protectedFor > 0 || GameManager.instance.state === 'gameover') return;
    this.protectedFor = this.grace;
    this.audio.play('assets/audio/sfx/hurt.wav');
    this.game.camera.shake(160, 0.01);
    GameManager.instance.LoseLife();
    this.GetComponent(Hero).Knockback(from);
  }

  Update() {
    this.protectedFor = Math.max(0, this.protectedFor - Time.deltaTime);
    const blink = this.protectedFor > 0 && Math.floor(this.protectedFor * 12) % 2 === 0;
    this.entity.native?.setAlpha(blink ? 0.3 : 1);                   // the engine's own game object: an escape hatch
  }
}
