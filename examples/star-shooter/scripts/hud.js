import { MonoBehaviour, GameManager } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    const gm = GameManager.instance, player = this.FindWithTag('player');
    this.score = this.ui.label('Score 0', { x: 16, y: 10, size: 26 });
    this.wave  = this.ui.label('', { anchor: 'tr', x: 16, y: 10, size: 22, color: '#9fd3ff' });
    this.bar   = this.ui.bar(1, { x: 16, y: 46, w: 180, color: '#7ee787' });
    this.off = [
      this.game.events.on('score', ({ score }) => this.score.set(`Score ${score}`)),
      this.game.events.on('data', ({ key, value }) => { if (key === 'wave') this.wave.set(`Wave ${value}`); }),
      player.on('health', ({ hp, max }) => this.bar.set(hp / max)),                // an event of the player object
      this.game.events.on('gameover', ({ score }) => this.GameOver(score)),
    ];
  }
  GameOver(score) {
    this.ui.label('SHIP DESTROYED', { screen: 'over', anchor: 'c', y: -60, size: 52 });
    this.ui.label(`Score ${score}   Best ${GameManager.instance.SaveHighScore()}`, { screen: 'over', anchor: 'c', y: 0, size: 26 });
    this.ui.button('Play again (R)', () => GameManager.instance.Restart(), { screen: 'over', anchor: 'c', y: 70 });
    this.ui.show('over');
  }
  Update() { if (GameManager.instance.state === 'gameover' && this.game.input.pressed('restart')) GameManager.instance.Restart(); }
  OnDestroy() { this.off?.forEach((f) => f()); [this.score, this.wave, this.bar].forEach((h) => h?.remove()); this.ui.clear('over'); this.ui.hide('over'); }
}
