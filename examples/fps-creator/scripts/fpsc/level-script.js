// Nord script: runs an FPS Creator level (levels/*.fpsl.json) inside a 3D Nord scene. Put it on one entity ("FPS Level") — that is all a project needs.
// Install/upgrade into a project with `nord fpsc init` (the editor's FPS Level tab does this for you). Docs: docs/FPS_CREATOR.md.
import { NordScript } from 'nord';
import { attachLevel, loadBankFrom, normalize } from './index.js';

export default class FpsLevel extends NordScript {
  static attributes = {
    level: { type: 'string', default: 'levels/level1.fpsl.json', label: 'Level file' },
    autostart: { type: 'bool', default: false, label: 'Skip the "click to play" screen' },
  };

  init() {
    const B = this.game.backend?.B;
    if (B && !this.game.backend.scene.activeCamera) { const c = new B.FreeCamera('fpsc-boot', new B.Vector3(0, 2, 0), this.game.backend.scene); c.setTarget(new B.Vector3(0, 2, 1)); } // so Nord does not add its own while the level loads
  }

  async start() {
    const be = this.game.backend, g = this.game;
    if (!be?.B) throw new Error('FPS levels need a 3D (Babylon) project — create it from the "FPS Creator" template');
    this.bank = await loadBankFrom((p) => g.loader.json(p).catch(() => null), { importer: (p) => import(/* @vite-ignore */ new URL(g.loader.url(p), document.baseURI).href), urlOf: (p) => g.loader.url(p) });
    for (const w of this.bank.warns) g.warn(`[fpsc] ${w}`);
    await this.load(this.attrs.level, this.attrs.autostart);
  }

  /** Load a level file and start it (also used for "Next level"). */
  async load(path, autostart = false) {
    const be = this.game.backend, g = this.game;
    this.run?.stop();
    const level = normalize(await g.loader.json(path));
    const container = be.canvas.parentElement ?? document.body; if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    this.run = await attachLevel({
      B: be.B, scene: be.scene, engine: be.engine, canvas: be.canvas, container, level, bank: this.bank, autostart,
      onLog: (lvl, msg) => (lvl === 'error' ? console.error(`[fpsc] ${msg}`) : console.warn(`[fpsc] ${msg}`)),
      onNext: (next) => { if (next) this.load(next, true).catch((e) => console.error(`[fpsc] next level: ${e.message}`)); },
    });
    window.__fpsc = this.run;
  }

  update(dt) { this.run?.update(dt); }
  onDestroy() { this.run?.stop(); }
}
