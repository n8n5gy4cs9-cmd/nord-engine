import { MonoBehaviour, SerializeField, GameManager, Time } from 'nord';
import Hero from './hero.js';

/** Grace time and blinking around the GameManager's lives. Enemies call TakeDamage(); nothing else knows about hearts. */
export default class Health extends MonoBehaviour {
  static attributes = SerializeField({ grace: 1 });

  Awake() { this.protectedFor = 0; }

  TakeDamage(from) {
    if (this.protectedFor > 0 || GameManager.instance.state === 'gameover') return;   // still protected, or already dead
    this.protectedFor = this.grace;
    GameManager.instance.LoseLife();                                 // emits 'lives', and 'gameover' at 0
    this.GetComponent(Hero).Knockback(from);                         // GetComponent<Hero>().Knockback(from)
  }

  Update() {
    this.protectedFor = Math.max(0, this.protectedFor - Time.deltaTime);
    const blink = this.protectedFor > 0 && Math.floor(this.protectedFor * 10) % 2 === 0;
    this.entity.set('sprite', 'alpha', blink ? 0.35 : 1);            // a field of the sprite component
  }
}
