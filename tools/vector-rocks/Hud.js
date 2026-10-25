import { MonoBehaviour, EventBus } from 'nord';
import Game from './Game.js';

const GLOW = '0 0 6px #3dff7a, 0 0 16px #19c452';
const mono = { fontFamily: '"Courier New", Menlo, monospace', fontWeight: '700', textShadow: GLOW, letterSpacing: '2px', pointerEvents: 'none' };

/** Score, lives and the monitor bezel, drawn as UI on top of the game. */
export default class Hud extends MonoBehaviour {
  Start() {
    // The UI layer is measured in screen pixels, the game is scaled to fit the window. One 800 x 600 frame that we scale to match the game
    // canvas keeps every label and the bezel glued to the picture, whatever the window shape (what Unity calls a Canvas Scaler).
    this.frame = this.ui.panel({ screen: 'hud', x: 0, y: 0, w: 800, h: 600, style: { background: 'none', border: 'none', padding: '0', transformOrigin: '0 0', pointerEvents: 'none' } });
    // Phosphor bloom: a layer that blurs and brightens whatever is behind it and adds it back on top (blend mode "screen").
    this.bloom = this.ui.panel({ screen: 'hud', x: 0, y: 0, w: 800, h: 600, style: { background: 'none', border: 'none', padding: '0', pointerEvents: 'none',
      backdropFilter: 'blur(6px) brightness(2.3) saturate(1.5)', mixBlendMode: 'screen' } });
    this.frame.el.append(this.bloom.el);
    const label = (o) => { const l = this.ui.label('', { screen: 'hud', color: '#7dffa3', style: mono, ...o }); this.frame.el.append(l.el); return l; };
    this.score = label({ x: 70, y: 52, size: 34 });
    this.hi = label({ anchor: 'tr', x: 70, y: 52, size: 22 });
    this.lives = label({ x: 70, y: 92, size: 24 });
    this.wave = label({ anchor: 'tr', x: 70, y: 82, size: 16 });
    this.notice = label({ anchor: 'c', y: -10, size: 56 });
    this.sub = label({ anchor: 'c', y: 50, size: 20 });
    this.bezel = this.ui.image('assets/sprites/bezel.png', { screen: 'hud', x: 0, y: 0, w: 800, h: 600, style: { pointerEvents: 'none' } });
    this.frame.el.append(this.bezel.el);
    this.offs = [
      EventBus.Subscribe('hud', () => this.Refresh()),
      EventBus.Subscribe('powerup', ({ type }) => this.Flash(type.toUpperCase())),
      EventBus.Subscribe('gameover', () => { this.notice.set('GAME OVER'); this.sub.set('PRESS ENTER TO PLAY AGAIN'); }),
    ];
    this.Refresh();
  }

  LateUpdate() {
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    this.frame.el.style.transform = `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.width / 800})`;
  }

  Refresh() {
    const g = Game.instance;
    this.score.set(String(g.score).padStart(6, '0'));
    this.hi.set(`HI ${String(g.hiScore).padStart(6, '0')}`);
    this.lives.set('▲ '.repeat(Math.max(0, g.lives)));
    this.wave.set(`WAVE ${g.wave}`);
  }

  Flash(text) {                              // the name of a power-up, big in the middle, for a moment
    this.notice.set(text);
    this.CancelInvoke('ClearNotice');
    this.Invoke('ClearNotice', 1);
  }

  ClearNotice() { if (!Game.instance.over) this.notice.set(''); }

  OnDestroy() {
    for (const w of [this.score, this.hi, this.lives, this.wave, this.notice, this.sub, this.bezel, this.bloom, this.frame]) w?.remove();
    this.offs?.forEach((off) => off?.());
  }
}
