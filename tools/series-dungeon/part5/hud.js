import { NordScript } from 'nord';

export default class Hud extends NordScript {
  start() {
    this.count = 0;
    this.total = 0;
    this.over = false;
    this.score = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22, color: '#ebcb8b' });
    this.hearts = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 26, color: '#bf616a' });
    this.offs = [
      this.events.on('level', ({ coins }) => { this.total = coins; this.refresh(); }),
      this.events.on('coin', () => { this.count++; this.refresh(); }),
      this.events.on('health', ({ hp, max }) => this.hearts.set('♥'.repeat(hp) + '♡'.repeat(max - hp))),
      this.events.on('died', () => this.finish('Game over', '#bf616a')),
    ];
    this.refresh();
  }

  refresh() {
    this.score.set(`● ${this.count} / ${this.total}`);
    if (this.total > 0 && this.count === this.total) this.finish('You found all the coins!', '#a3be8c');
  }

  finish(text, color) {
    if (this.over) return;
    this.over = true;
    this.ui.label(text, { screen: 'hud', anchor: 'c', size: 34, color });
    this.ui.label('Press E to play again', { screen: 'hud', anchor: 'c', y: 44, size: 20 });
  }

  update() {
    if (this.over && this.input.pressed('interact')) this.game.restart();
  }

  onDestroy() { this.score?.remove(); this.hearts?.remove(); this.offs?.forEach((off) => off()); }
}
