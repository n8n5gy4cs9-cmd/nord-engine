import { MonoBehaviour, GameManager, EventBus, UnityInput as Input, KeyCode } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    this.total = 0;
    this.score = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22, color: '#ebcb8b' });
    this.hearts = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 26, color: '#bf616a' });
    this.offs = [
      EventBus.Subscribe('level', ({ coins }) => { this.total = coins; this.Refresh(); }),
      EventBus.Subscribe('score', () => this.Refresh()),
      EventBus.Subscribe('lives', () => this.Refresh()),
      EventBus.Subscribe('gameover', () => this.Finish('Game over', '#bf616a')),
    ];
    this.Refresh();
  }

  Refresh() {
    const gm = GameManager.instance, max = gm.attrs.startLives;
    this.score.set(`● ${gm.score} / ${this.total}`);
    this.hearts.set('♥'.repeat(gm.lives) + '♡'.repeat(max - gm.lives));
    if (this.total > 0 && gm.score === this.total && gm.state === 'playing') this.Finish('You found all the coins!', '#a3be8c', true);
  }

  Finish(text, color, won = false) {
    if (this.over) return;                                           // win and die in the same second: show one ending
    this.over = true;
    if (won) GameManager.instance.SetState('won');
    this.ui.label(text, { screen: 'hud', anchor: 'c', size: 34, color });
    this.ui.label('Press E to play again', { screen: 'hud', anchor: 'c', y: 44, size: 20 });
  }

  Update() {
    if (this.over && Input.GetKeyDown(KeyCode.E)) GameManager.instance.Restart();
  }

  OnDestroy() { this.score?.remove(); this.hearts?.remove(); this.offs?.forEach((off) => off()); }
}
