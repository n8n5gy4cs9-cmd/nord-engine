import { MonoBehaviour, GameManager } from 'nord';
export default class Goal extends MonoBehaviour {
  OnTriggerEnter(other) {
    if (!other.hasTag('player')) return;
    const gm = GameManager.instance;
    if (gm.state !== 'playing') return;
    gm.AddScore(5);                       // bonus
    gm.SetState('won');                   // the HUD listens to 'state'
    gm.SaveHighScore();
  }
}
