// @nord {"id":"redfront.game","title":"Red Front 2026 — RTS skirmish","category":"games","tier":["2d"],"tags":["strategy","rts","red-alert","command-and-conquer","procedural"],"description":"Red Alert / C&C-style real-time strategy skirmish on a procedural map: Allies vs Soviets, harvest ore, build an army, destroy the enemy base. Sidebar build, drag-select, A* pathing, computer opponent."}
// Red Front 2026 — skirmish controller. Crowelian 2026 + Sonnet. Rules: xk/rts.js (shared with X-KOM 2026), view: xk/rtsview.js. See GUIDE.md and assets.md.
import { XkBase, VW, VH, COL } from './xk/base.js';
import { RtsView } from './xk/rtsview.js';
import { Help, RED_PAGES } from './xk/help.js';

const PATH = {
  rterrain: 'assets/rts/terrain.png', runits: 'assets/rts/units.png', rui: 'assets/rts/ui.png', rfx: 'assets/rts/fx.png',
  b_fact: 'assets/rts/b_fact.png', b_powr: 'assets/rts/b_powr.png', b_barr: 'assets/rts/b_barr.png', b_weap: 'assets/rts/b_weap.png', b_proc: 'assets/rts/b_proc.png', b_gun: 'assets/rts/b_gun.png', font: 'assets/ui/font.png',
};

export default class RedFront extends XkBase {
  static attributes = {
    seed: { type: 'int', default: 0, label: 'Map seed (0 = random). ?seed=123 in the URL also works.' },
    difficulty: { type: 'number', default: 1, min: 0.5, max: 2.5, label: 'Enemy income multiplier (1 = normal)' },
  };
  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }
  async boot() {
    await this.initBase(PATH); this.rts = new RtsView(this); this.help = new Help(this, RED_PAGES); this.mode = 'title';
    this.q = new URLSearchParams(location.search);
    this.onKey = (e) => this.keyEv(e, true); this.onKeyUp = (e) => this.keyEv(e, false);
    this.onMove = (p) => this.ptrEv(p, 'move'); this.onDown = (p) => this.ptrEv(p, 'down'); this.onUp = (p) => this.ptrEv(p, 'up');
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKeyUp);
    const ps = this.ps; ps.input.on('pointermove', this.onMove); ps.input.on('pointerdown', this.onDown); ps.input.on('pointerup', this.onUp); ps.input.mouse?.disableContextMenu?.();
    window.__rf = this; this.ready = true;
    if (this.q.get('start') === 'rts') this.play(); else this.titleScreen();
  }
  onDestroy() { window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKeyUp); this.ps?.input?.off('pointermove', this.onMove); this.ps?.input?.off('pointerdown', this.onDown); this.ps?.input?.off('pointerup', this.onUp); delete window.__rf; }
  update(dt) { if (this.ready && !this.help.open && this.mode === 'rts') this.rts.update(Math.min(dt > 1 ? dt / 1000 : dt, 0.1)); }
  clearScreen() { for (const o of this.screenObjs ?? []) o.destroy?.(); this.screenObjs = []; this.hud.removeAll(true); }
  keep(o) { this.screenObjs.push(o); return o; }
  titleScreen() {
    this.clearScreen(); this.mode = 'title'; this.camCenter(VW / 2, VH / 2); const h = this;
    h.keep(h.rect(0, 0, VW, VH, 0x180808, 1)); for (let i = 0; i < 9; i++) { h.keep(h.img('runits', i % 2 ? 3 * 3 : 0, 20 + i * 32, 150, 6, [0, 0], true)).setScale(2); }
    const T = (s, y, c, sc = 1) => h.keep(h.text(VW / 2, y, s, c, { origin: [0.5, 0], scale: sc, hud: true, depth: 8 }));
    T('RED FRONT', 24, COL.bad, 5); T('2026', 68, COL.gold, 3); T('ALLIES  VS  SOVIETS', 100, COL.text); T('HARVEST ORE. BUILD AN ARMY. DESTROY THE ENEMY BASE.', 118, COL.dim);
    T('PRESS ENTER OR CLICK TO DEPLOY      F1 = HELP', 134, COL.gold); T('CROWELIAN 2026 + SONNET', 186, COL.dim); this.music('music_rts', 0.25);
  }
  play() {
    this.clearScreen(); this.mode = 'rts'; this.seed = this.attrs.seed || Number(this.q.get('seed')) || ((Math.random() * 1e9) | 0);
    this.rts.start({ mode: 'redfront', seed: this.seed, diff: this.attrs.difficulty, briefing: 'DESTROY ALL SOVIET STRUCTURES', winText: 'SOVIETS DEFEATED', loseText: 'ALLIED BASE DESTROYED', onEnd: () => { this.rts.destroy(); this.titleScreen(); } });
  }
  keyEv(e, down) {
    if (!this.ready || e.ctrlKey || e.metaKey || e.altKey) return;
    if (down && this.help.key(e)) return; if (this.help.open) return;
    if (this.mode === 'rts') { if (this.rts.over && down) this.rts.doneKey?.(e); else this.rts.key(e, down); return; }
    if (down && (e.key === 'Enter' || e.key === ' ')) this.play();
  }
  ptrEv(p, type) { if (!this.ready || this.help.pointer(type)) return; if (this.mode === 'rts') return this.rts.pointer(p, type); if (type === 'down') { this.sfx('confirm', 0.5); this.play(); } }
}
