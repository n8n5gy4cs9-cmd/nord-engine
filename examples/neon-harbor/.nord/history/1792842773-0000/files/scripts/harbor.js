// The director of a run: HUD, timer, minimap, pause, win/lose. Scripts, an event sheet and a graph all take part.
import { MonoBehaviour, GameManager } from 'nord';

export default class Harbor extends MonoBehaviour {
  static attributes = { timeLimit: { type: 'number', default: 100 }, orbsToWin: { type: 'number', default: 14 } };

  async Start() {
    this.left = this.timeLimit;
    this.collected = 0;
    this.over = false;
    this.skiff = this.Find('Skiff');
    this.skiffScript = this.skiff?.scripts.find((s) => s.constructor.name === 'Skiff');
    this.hud = await this.game.ui.load('ui/hud.ui.json');
    this.pause = await this.game.ui.load('ui/pause.ui.json');
    this.end = await this.game.ui.load('ui/gameover.ui.json');
    this.pause.on('resume', () => this.SetPaused(false));
    this.pause.on('menu', () => this.game.loadScene('scenes/menu.scene.json'));
    this.end.on('retry', () => this.game.restart());
    this.end.on('menu', () => this.game.loadScene('scenes/menu.scene.json'));
    this.offs = [
      this.game.events.on('orb', () => this.OnOrb()),
      this.game.events.on('overdrive', () => { this.left += 5; if (this.skiffScript) this.skiffScript.energy = 100; this.game.audio?.play('assets/audio/sfx/heal.wav', { bus: 'sfx' }); }),
    ];
    this.game.audio?.play('assets/audio/music/music_action.mp3', { bus: 'music', loop: true, volume: 0.35 });
    // the game loop stops while paused, so P / Esc is a plain DOM key listener (the loop cannot poll it)
    this.onKey = (e) => { if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) this.SetPaused(!this.paused); };
    addEventListener('keydown', this.onKey);
    this.Refresh();
    this.lowWarned = false;
  }

  OnDestroy() { removeEventListener('keydown', this.onKey); for (const o of this.offs ?? []) o(); for (const s of [this.hud, this.pause, this.end]) s?.destroy(); this.game.audio?.stopMusic?.(); }

  OnOrb() {
    this.collected++;
    if (this.collected >= this.orbsToWin) this.Finish(true);
    this.Refresh();
  }

  SetPaused(on) {
    if (this.over) return;
    this.paused = on;
    on ? this.pause.show() : this.pause.hide();
    on ? this.game.pause() : this.game.resume();
  }

  Finish(won) {
    if (this.over) return;
    this.over = true;
    const gm = GameManager.instance;
    const best = gm?.SaveHighScore('neon-harbor-best') ?? 0;
    const bonus = won ? Math.round(this.left * 5) : 0;
    gm?.AddScore(bonus);
    this.end.set({ result: won ? 'ALL CORES SECURED' : 'NIGHT FALLS', score: gm?.score ?? 0, best: Math.max(best, gm?.score ?? 0), detail: won ? `Time bonus ${bonus}` : `${this.collected} of ${this.orbsToWin} cores` });
    gm?.SaveHighScore('neon-harbor-best');
    if (this.skiffScript) this.skiffScript.frozen = true;
    this.game.audio?.play(won ? 'assets/audio/music/jingle_victory.mp3' : 'assets/audio/music/jingle_game_over.mp3', { bus: 'music' });
    this.end.show();
  }

  Refresh() {
    if (!this.hud) return;
    const gm = GameManager.instance;
    this.hud.set({ score: gm?.score ?? 0, orbs: `${this.collected}/${this.orbsToWin}`, time: Math.ceil(this.left), energy: (this.skiffScript?.energy ?? 100) / 100 });
  }

  Update(dt) {
    if (this.over || !this.hud) return; // Start() is async: the screens may not be loaded yet
    this.left -= dt;
    if (this.left <= 10 && !this.lowWarned) { this.lowWarned = true; this.game.events.emit('low-time'); }
    if (this.left <= 0) { this.left = 0; this.Finish(false); }
    this.tick = (this.tick ?? 0) + dt;
    if (this.tick > 0.08) { this.tick = 0; this.Refresh(); this.DrawMinimap(); }
  }

  DrawMinimap() {
    const cv = this.hud.get('minimap')?.el; const g = cv?.getContext?.('2d'); if (!g) return;
    const S = cv.width, k = S / 150; // 150 world units across (bounds are +-70)
    const px = (x) => S / 2 + x * k, pz = (z) => S / 2 - z * k;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#04122a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#0b3a5a'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((S * i) / 6, 0); g.lineTo((S * i) / 6, S); g.moveTo(0, (S * i) / 6); g.lineTo(S, (S * i) / 6); g.stroke(); }
    g.fillStyle = '#ff3fb8';
    for (const e of this.FindGameObjectsWithTag('solid')) { const p = e.worldPos; g.fillRect(px(p[0]) - 3, pz(p[2]) - 3, 6, 6); }
    g.fillStyle = '#25e8ff';
    for (const e of this.FindGameObjectsWithTag('orb')) { const p = e.worldPos; g.beginPath(); g.arc(px(p[0]), pz(p[2]), 3, 0, 7); g.fill(); }
    if (this.skiff) {
      const p = this.skiff.worldPos, h = (this.skiff.rot[1] * Math.PI) / 180;
      g.save(); g.translate(px(p[0]), pz(p[2])); g.rotate(h);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    }
  }
}
