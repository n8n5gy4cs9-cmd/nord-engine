// @nord {"id":"ui.hud","title":"HUD: hearts, bars, score","category":"ui","tier":["2d","3d"],"tags":["hud","hearts","health-bar","game-ready"],"requires":["ui","gameplay.health"],"description":"Heads-up display bound to events: hearts or a health bar from the target's 'health' entity event, optional mana bar from the global 'mana' event, and a coin counter from 'pickup'. Put anywhere in the scene."}
import { NordScript } from 'nord';

export default class Hud extends NordScript {
  static attributes = { target: { type: 'string', default: 'Player' }, style: { type: 'enum', options: ['hearts', 'bar'], default: 'hearts' }, coins: { type: 'bool', default: true } };
  start() {
    const t = this.scene.find(this.attrs.target); this.hearts = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 26, color: '#bf616a' }); this.bar = this.ui.bar(1, { screen: 'hud', x: 12, y: 12, color: '#bf616a' });
    this.bar.el.hidden = this.attrs.style !== 'bar'; this.hearts.el.hidden = this.attrs.style !== 'hearts';
    t?.on('health', ({ hp, max }) => { this.hearts.set('♥'.repeat(Math.ceil(hp)) + '♡'.repeat(Math.max(0, Math.ceil(max - hp)))); this.bar.set(hp / max); });
    this.n = 0; if (this.attrs.coins) { this.coin = this.ui.label('● 0', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 22, color: '#ebcb8b' }); this.off = this.events.on('pickup', (p) => { if (p.kind === 'score') this.coin.set(`● ${++this.n}`); }); }
  }
  onDestroy() { this.hearts?.remove(); this.bar?.remove(); this.coin?.remove(); this.off?.(); }
}
