import { MonoBehaviour, GameManager } from 'nord';

// Listens to the GameManager's events and keeps the on-screen labels up to date.
export default class Hud extends MonoBehaviour {
  Start() {
    const gm = GameManager.instance;
    this.score = this.ui.label(`Score ${gm.score}`, { x: 16, y: 10, size: 26 });
    this.lives = this.ui.label(this.Hearts(gm.lives), { anchor: 'tr', x: 16, y: 10, size: 26, color: '#ff8a8a' });
    this.off = [
      this.game.events.on('score', ({ score }) => this.score.set(`Score ${score}`)),
      this.game.events.on('lives', ({ lives }) => this.lives.set(this.Hearts(lives))),
      this.game.events.on('gameover', ({ score }) => this.ShowGameOver(score)),
    ];
  }

  Hearts(n) { return '♥'.repeat(Math.max(0, n)) || '—'; }

  ShowGameOver(score) {
    this.ui.label('GAME OVER', { screen: 'over', anchor: 'c', y: -60, size: 56 });
    this.ui.label(`Score ${score}   Best ${GameManager.instance.SaveHighScore()}`, { screen: 'over', anchor: 'c', y: 0, size: 26 });
    this.ui.button('Play again (R)', () => GameManager.instance.Restart(), { screen: 'over', anchor: 'c', y: 70 });
    this.ui.show('over');
  }

  Update() { if (GameManager.instance.state === 'gameover' && this.game.input.pressed('restart')) GameManager.instance.Restart(); }

  OnDestroy() { // clean up what we created: the UI lives outside the scene
    this.off?.forEach((f) => f());
    this.score?.remove(); this.lives?.remove();
    this.ui.clear('over'); this.ui.hide('over');
  }
}
