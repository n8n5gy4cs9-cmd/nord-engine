import { MonoBehaviour, GameManager } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    const gm = GameManager.instance;
    this.score = this.ui.label(`Coins ${gm.score}`, { x: 16, y: 10, size: 26 });
    this.lives = this.ui.label(this.Hearts(gm.lives), { anchor: 'tr', x: 16, y: 10, size: 26, color: '#ff8a8a' });
    this.help = this.ui.label('A / D or arrows: move   Space: jump (tap = small hop, hold = high)', { anchor: 'bl', x: 16, y: 10, size: 16, color: '#9fb0c8' });
    this.off = [
      this.game.events.on('score', ({ score }) => this.score.set(`Coins ${score}`)),
      this.game.events.on('lives', ({ lives }) => this.lives.set(this.Hearts(lives))),
      this.game.events.on('state', ({ state }) => { if (state === 'won') this.Banner('LEVEL CLEARED', `Coins ${GameManager.instance.score}`); }),
      this.game.events.on('gameover', () => this.Banner('GAME OVER', `Coins ${GameManager.instance.score}`)),
    ];
  }
  Hearts(n) { return '♥'.repeat(Math.max(0, n)) || '—'; }
  Banner(title, line) {
    this.ui.label(title, { screen: 'over', anchor: 'c', y: -60, size: 56 });
    this.ui.label(`${line}   Best ${GameManager.instance.SaveHighScore()}`, { screen: 'over', anchor: 'c', y: 0, size: 26 });
    this.ui.button('Play again (R)', () => GameManager.instance.Restart(), { screen: 'over', anchor: 'c', y: 70 });
    this.ui.show('over');
  }
  Update() { if (GameManager.instance.state !== 'playing' && this.game.input.pressed('restart')) GameManager.instance.Restart(); }
  OnDestroy() { this.off?.forEach((f) => f()); [this.score, this.lives, this.help].forEach((l) => l?.remove()); this.ui.clear('over'); this.ui.hide('over'); }
}
