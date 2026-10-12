// @nord {"id":"camera.cinematic","title":"Cinematic camera path","category":"camera","tier":["2d","3d"],"tags":["camera","cutscene","path"],"requires":["path"],"description":"Moves this entity along a sibling 'path' component over a duration with easing; emits 'cinematicDone' on the global bus. Trigger by calling play() or setting autoplay."}
import { NordScript } from 'nord';

export default class CameraCinematic extends NordScript {
  static attributes = { duration: { type: 'number', default: 5, min: 0.1 }, ease: { type: 'enum', options: ['linear', 'quadInOut', 'cubicInOut', 'sineInOut'], default: 'sineInOut' }, autoplay: { type: 'bool', default: true }, letterbox: { type: 'bool', default: true } };
  start() { this.path = this.entity.getComponent('path'); if (this.attrs.autoplay) this.play(); }
  play() {
    if (!this.path) return;
    const o = { s: 0 };
    if (this.attrs.letterbox) this.#bars(true);
    this.tween(o, { s: this.path.length }, { duration: this.attrs.duration, ease: this.attrs.ease, onUpdate: () => { this.entity.pos = this.path.at(o.s); },
      onComplete: () => { this.#bars(false); this.events.emit('cinematicDone', this.entity); } });
  }
  #bars(on) {
    this.bars?.forEach((b) => b.remove());
    this.bars = on ? [0, 1].map((i) => this.ui.panel({ screen: 'hud', x: 0, y: 0, anchor: i ? 'bl' : 'tl', style: { width: '100%', height: '12%', borderRadius: '0', background: '#000', border: '0' } })) : null;
  }
}
