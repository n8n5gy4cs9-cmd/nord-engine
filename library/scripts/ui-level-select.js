// @nord {"id":"ui.level-select","title":"Level select","category":"ui","tier":["2d","3d"],"tags":["levels","menu","progress"],"requires":["ui"],"description":"Grid of level buttons from a list of scene paths; levels unlock in order. Progress is stored via save. Emit 'level:complete' (index) to unlock the next one."}
import { NordScript } from 'nord';

export default class LevelSelect extends NordScript {
  static attributes = { levels: { type: 'array', default: [], label: 'Scene paths in order' }, saveKey: { type: 'string', default: 'unlocked' }, columns: { type: 'int', default: 5 } };
  start() { this.unlocked = this.save.get(this.attrs.saveKey, 1); this.cur = 0; this.off = this.events.on('level:complete', (i) => { this.unlocked = Math.max(this.unlocked, (i ?? this.cur) + 2); this.save.set(this.attrs.saveKey, this.unlocked); }); this.draw(); }
  onDestroy() { this.off?.(); }
  draw() {
    const ui = this.ui, d = ui.doc; ui.clear('levels'); ui.label('Select level', { screen: 'levels', x: 0, y: 30, size: 36, style: { width: '100%', textAlign: 'center' } });
    const g = d.createElement('div'); g.style.cssText = `position:absolute;left:50%;top:100px;transform:translateX(-50%);display:grid;grid-template-columns:repeat(${this.attrs.columns},64px);gap:10px;pointer-events:auto`; ui.screen('levels').append(g);
    this.attrs.levels.forEach((path, i) => { const b = ui.button(i < this.unlocked ? String(i + 1) : '🔒', () => { if (i < this.unlocked) { this.cur = i; ui.hide('levels'); this.game.loadScene(path); } }, { screen: 'levels' }); b.el.classList.remove('nord-el'); b.el.disabled = i >= this.unlocked; g.append(b.el); });
  }
}
