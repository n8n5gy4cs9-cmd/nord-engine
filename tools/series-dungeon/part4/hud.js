import { MonoBehaviour, GameManager, EventBus, UnityInput as Input, KeyCode } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    this.total = 0;
    this.score = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22, color: '#ebcb8b' });
    this.offs = [
      EventBus.Subscribe('level', ({ coins }) => { this.total = coins; this.Refresh(); }),
      EventBus.Subscribe('score', () => this.Refresh()),
    ];
    this.Refresh();
  }

  Refresh() {
    const gm = GameManager.instance;
    this.score.set(`● ${gm.score} / ${this.total}`);
    if (this.total > 0 && gm.score === this.total && gm.state === 'playing') this.Win();
  }

  Win() {
    GameManager.instance.SetState('won');
    this.ui.label('You found all the coins!', { screen: 'hud', anchor: 'c', size: 34, color: '#a3be8c' });
    this.ui.label('Press E to play again', { screen: 'hud', anchor: 'c', y: 44, size: 20 });
  }

  Update() {
    if (GameManager.instance.state === 'won' && Input.GetKeyDown(KeyCode.E)) GameManager.instance.Restart();
  }

  OnDestroy() { this.score?.remove(); this.offs?.forEach((off) => off()); }
}
