import { NordScript } from 'nord';

export default class Hud extends NordScript {
  start() {
    this.count = 0;
    this.total = 0;
    this.score = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22, color: '#ebcb8b' });
    this.offs = [
      this.events.on('level', ({ coins }) => { this.total = coins; this.refresh(); }),
      this.events.on('coin', () => { this.count++; this.refresh(); }),
    ];
    this.refresh();
  }

  refresh() {
    this.score.set(`● ${this.count} / ${this.total}`);
    if (this.total > 0 && this.count === this.total) this.win();
  }

  win() {
    this.ui.label('You found all the coins!', { screen: 'hud', anchor: 'c', size: 34, color: '#a3be8c' });
    this.ui.label('Press E to play again', { screen: 'hud', anchor: 'c', y: 44, size: 20 });
    this.won = true;
  }

  update() {
    if (this.won && this.input.pressed('interact')) this.game.restart();
  }

  onDestroy() { this.score?.remove(); this.offs?.forEach((off) => off()); }
}
