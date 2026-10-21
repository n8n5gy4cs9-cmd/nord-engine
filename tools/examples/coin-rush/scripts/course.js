import { NordScript } from 'nord';

export default class CoinRush extends NordScript {
  static attributes = {
    seconds: { type: 'number', default: 150, min: 10 },
    lives: { type: 'int', default: 3, min: 1 },
    requiredCoins: { type: 'int', default: 8, min: 1 },
    comboWindow: { type: 'number', default: 2, min: 0.1 },
  };

  start() {
    this.remaining = this.attrs.seconds;
    this.lives = this.attrs.lives;
    this.coins = 0;
    this.score = 0;
    this.combo = 0;
    this.comboLeft = 0;
    this.bossCleared = false;
    this.ended = false;
    this.best = this.save.get('coin-rush.best', 0);
    this.notice = `Collect ${this.attrs.requiredCoins} coins, then defeat the boss. Shift/K dashes.`;
    this.hud = this.ui.label('', { screen: 'course', x: 12, y: 55, size: 14, style: { whiteSpace: 'pre-wrap', maxWidth: '95%' } });
    this.pauseButton = this.ui.button('Pause', () => this.pause(), {
      screen: 'course', x: 12, y: 105,
    });
    this.offs = [
      this.events.on('score', n => this.addScore(n)),
      this.events.on('pickup', p => this.pickup(p)),
      this.events.on('died', () => this.loseLife()),
      this.events.on('checkpoint', () => { this.notice = 'Checkpoint activated!'; }),
      this.events.on('game:win', () => { this.bossCleared = true; this.checkWin(); }),
    ];
    this.ui.show('course');
    this.draw();
  }

  addScore(n) {
    if (this.ended || typeof n !== 'number' || n <= 0) return;
    this.combo = this.comboLeft > 0 ? Math.min(5, this.combo + 1) : 1;
    this.comboLeft = this.attrs.comboWindow;
    this.score += n * this.combo;
  }

  pickup(p) {
    if (this.ended || p.kind !== 'score') return;
    this.coins++;
    this.remaining += 2;
    this.notice = '+2 seconds! Keep the combo alive.';
    this.checkWin();
  }

  loseLife() {
    if (this.ended) return;
    this.lives--;
    this.comboLeft = 0;
    this.combo = 0;
    this.notice = 'Life lost. Returning to your last flag.';
    if (this.lives <= 0) this.finish(false, 'No lives left');
    // Existing checkpoint scripts heal and return the hero after a short delay.
  }

  checkWin() {
    if (!this.bossCleared) return;
    if (this.coins < this.attrs.requiredCoins) {
      this.notice = `Boss defeated! Find ${this.attrs.requiredCoins - this.coins} more coins.`;
      return;
    }
    this.finish(true, 'Canyon cleared!');
  }

  update(dt) {
    if (this.ended) return;
    this.remaining = Math.max(0, this.remaining - dt);
    this.comboLeft = Math.max(0, this.comboLeft - dt);
    if (this.comboLeft === 0) this.combo = 0;
    if (this.remaining === 0) this.finish(false, 'Time ran out');
    this.draw();
  }

  draw() {
    this.hud.set(`Time ${Math.ceil(this.remaining)} | Lives ${this.lives} | ` +
      `Coins ${this.coins}/${this.attrs.requiredCoins} | Score ${this.score} | ` +
      `Combo x${Math.max(1, this.combo)} | Best ${this.best}\n${this.notice}`);
  }

  pause() {
    if (this.ended || this.game.paused) return;
    this.ui.show('course-menu');
    this.game.pause();
    this.ui.label('Paused', { screen: 'course-menu', x: 20, y: 150, size: 32 });
    this.ui.menu('course-menu', [
      { text: 'Resume', onClick: () => { this.ui.clear('course-menu'); this.game.resume(); } },
      { text: 'Restart run', onClick: () => this.restart() },
    ], { x: 20, y: 195 });
  }

  finish(won, title) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.score += Math.ceil(this.remaining) * 5 + this.lives * 100;
      this.best = Math.max(this.best, this.score);
      this.save.set('coin-rush.best', this.best);
    }
    this.draw();
    this.ui.clear('course-menu');
    this.ui.label(`${title} — score ${this.score}`, {
      screen: 'course-menu', x: 20, y: 150, size: 28,
    });
    this.ui.menu('course-menu', [
      { text: 'Try again', onClick: () => this.restart() },
    ], { x: 20, y: 195 });
    this.ui.show('course-menu');
    this.game.pause();
  }

  restart() {
    this.game.resume();
    this.game.restart();
  }

  onDestroy() {
    this.offs.forEach(off => off());
    this.ui.clear('course');
    this.ui.clear('course-menu');
    this.game.resume();
  }
}
