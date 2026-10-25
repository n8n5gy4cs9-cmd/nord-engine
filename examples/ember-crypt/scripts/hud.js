import { NordScript } from 'nord';

const px = { 'image-rendering': 'pixelated' };

export default class Hud extends NordScript {
  start() {
    this.hearts = [];
    this.coin = this.ui.label('', { screen: 'hud', x: 12, y: 34, size: 18, color: '#ffd34d' });
    this.keys = this.ui.label('', { screen: 'hud', x: 12, y: 58, size: 18, color: '#ffffff' });
    this.clock = this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 18, color: '#cfd8ff' });
    this.offs = [
      this.events.on('health', ({ hp, max }) => this.drawHearts(hp, max)),
      this.events.on('state', ({ coins, keys, time }) => {
        this.coin.set(`● ${coins}`);
        this.keys.set(keys ? `🗝 ${keys}` : '');
        this.clock.set(`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`);
      }),
      this.events.on('ended', (r) => this.finish(r)),
    ];
    this.onKey = (e) => { if (e.code === 'Escape' && !this.over) this.togglePause(); };
    window.addEventListener('keydown', this.onKey);
  }

  drawHearts(hp, max) {
    this.hearts.forEach((h) => h.remove());
    this.hearts = Array.from({ length: max }, (_, i) =>
      this.ui.image(`assets/sprites/items/heart_${i < hp ? 'full' : 'empty'}.png`, { screen: 'hud', x: 10 + i * 22, y: 8, w: 20, h: 20, style: px }));
  }

  togglePause() {
    if (this.pauseUi) { this.pauseUi.forEach((p) => p.remove()); this.pauseUi = null; this.game.resume(); return; }
    this.game.pause();
    this.pauseUi = [this.ui.label('Paused', { screen: 'hud', anchor: 'c', size: 44, color: '#ffb86b' }),
      this.ui.label('Esc to continue', { screen: 'hud', anchor: 'c', y: 40, size: 18 })];
  }

  finish({ win, score, best, record, coins, time }) {
    this.over = true;
    const color = win ? '#a3e6a0' : '#ff7b8a';
    this.ui.panel({ screen: 'hud', anchor: 'c', w: 360, h: 190, style: { background: 'rgba(5,6,10,0.82)', borderRadius: '10px' } });
    this.ui.label(win ? 'You escaped the crypt!' : 'The crypt keeps you…', { screen: 'hud', anchor: 'c', y: -62, size: 30, color });
    this.ui.label(`Score ${score}${record ? '  — new best!' : `   Best ${best}`}`, { screen: 'hud', anchor: 'c', y: -22, size: 20, color: '#ffd34d' });
    this.ui.label(`${coins} coins   ${Math.floor(time)} s`, { screen: 'hud', anchor: 'c', y: 8, size: 16 });
    this.ui.button('Play again', () => this.game.restart(), { screen: 'hud', anchor: 'c', x: -70, y: 56 });
    this.ui.button('Title', () => this.game.loadScene('scenes/title.scene.json'), { screen: 'hud', anchor: 'c', x: 70, y: 56 });
  }

  onDestroy() {
    window.removeEventListener('keydown', this.onKey);
    this.hearts.forEach((h) => h.remove());
    [this.coin, this.keys, this.clock].forEach((l) => l?.remove());
    this.pauseUi?.forEach((p) => p.remove());
    this.offs?.forEach((off) => off());
  }
}
