// Midnight Sun Tour — Nord Engine host script. Boots the NordScrap-era game (scripts/game/*.js) on a 640x360 virtual canvas via
// scripts/nordscrap/compat.js and forwards update(dt) to the game's MidnightSunTour.onUpdate.
import { NordScript, touchToStart } from 'nord';
import { TourConsole } from './nordscrap/console.js';
import { createCompat, loadModules } from './nordscrap/compat.js';

const MODULES = ['festival_visitors', 'tour_art', 'mg_jobs', 'game_constants', 'band_mood', 'pseudo3d', 'mg_encounters', 'mg_gig', 'mg_soundcheck', 'mg_moosedodge', 'mg_gearpack', 'mg_kickoff',
  'mg_space', 'mg_trail', 'mg_race', 'mg_tent', 'mg_fuel', 'mg_runner', 'mg_night', 'mg_starfox', 'mg_festival', 'mg_tycoon', 'midnight_sun'];

export default class MidnightSunTourScript extends NordScript {
  static attributes = {
    width: { type: 'int', default: 640, min: 160, max: 1920, label: 'Virtual width' },
    height: { type: 'int', default: 360, min: 128, max: 1080, label: 'Virtual height' },
    pixelScale: { type: 'int', default: 3, min: 1, max: 8, label: 'Backing-store scale' },
  };

  async start() {
    this.dead = false; this.pendingRestart = false; this.ready = false;
    const container = document.getElementById('stage') ?? document.body;
    this.compat = createCompat({
      container, width: this.attrs.width, height: this.attrs.height, pixelScale: this.attrs.pixelScale, audio: this.audio, save: this.save,
      onSceneLoad: () => { this.pendingRestart = true; },
    });
    try {
      const font = new FontFace('MS VT323', 'url(assets/fonts/vt323.woff2)');
      document.fonts.add(await font.load());
      const require = await loadModules('scripts/game', MODULES, this.compat.globals);
      const Game = require('midnight_sun');
      if (this.dead) return;
      this.game_ = new Game();
      this.game_.onStart();
      this.console_ = new TourConsole(this);
      this.ready = true;
      window.__nord_msTour = this.game_;
    } catch (e) {
      console.error(e); window.__nord_error = String(e?.stack ?? e);
    }
    this.gate = touchToStart(this.game, { title: 'MIDNIGHT SUN TOUR', label: 'PRESS ANY KEY OR CLICK TO START' });
  }

  update(dt) {
    if (!this.ready || this.dead || this.console_?.open) return;
    if (this.pendingRestart) { this.pendingRestart = false; this.game_.onStart(); }
    this.compat.beginFrame();
    try { this.game_.onUpdate(Math.min(dt, 0.1)); this.failures = 0; } catch (e) {
      // A bug in one minigame must not freeze the tour: log it, and fall back to the title screen if it keeps failing.
      window.__nord_error = String(e?.stack ?? e);
      if (!this.failures++) console.error(e);
      if (this.failures > 30) { this.failures = 0; this.pendingRestart = true; }
    }
    this.compat.endFrame();
  }

  onDestroy() { this.dead = true; this.gate?.destroy(); this.console_?.destroy(); this.compat?.destroy(); }
}
