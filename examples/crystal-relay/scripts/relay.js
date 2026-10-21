import { NordScript } from 'nord';

export default class CrystalRelay extends NordScript {
  static attributes = {
    seconds: { type: 'number', default: 100, min: 10 },
    lives: { type: 'int', default: 3, min: 1 },
    speed: { type: 'number', default: 6, min: 1 },
    sprintSpeed: { type: 'number', default: 10, min: 1 },
  };

  start() {
    this.player = this.entity;
    this.controller = this.player.scripts.find(s => 'jumpSpeed' in s.attrs);
    this.gems = this.scene.findByTag('gem').sort((a, b) => a.name.localeCompare(b.name));
    this.hazard = this.scene.find('Hazard');
    this.spawn = [...this.player.pos];
    this.next = 0;
    this.elapsed = 0;
    this.remaining = this.attrs.seconds;
    this.lives = this.attrs.lives;
    this.energy = 1;
    this.safeTime = 0;
    this.ended = false;
    this.best = this.save.get('crystal-relay.best', null);
    this.notice = 'Follow the large crystal. Hold Shift to sprint.';
    this.hud = this.ui.label('', { screen: 'relay', x: 12, y: 8, size: 16, style: { whiteSpace: 'pre-wrap', maxWidth: '95%' } });
    this.ui.button('Pause', () => this.pause(), { screen: 'relay', x: 12, y: 85 });
    this.ui.show('relay');
    this.draw();
  }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    this.safeTime = Math.max(0, this.safeTime - dt);
    const sprint = this.input.down('sprint') && this.energy > 0;
    this.controller.attrs.speed = sprint ? this.attrs.sprintSpeed : this.attrs.speed;
    this.energy = Math.max(0, Math.min(1, this.energy + (sprint ? -0.45 : 0.25) * dt));
    // Move a red hazard across the middle landing in world units.
    this.hazard.pos = [3 + Math.sin(this.elapsed * 1.5) * 2, 3.3, 18];
    const p = this.player.pos;
    const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    if (p[1] < -5 || (this.safeTime === 0 && distance(p, this.hazard.pos) < 0.9)) {
      this.respawn();
      if (this.ended) return;
    }
    // Only the next crystal can be collected; later crystals remain in the scene.
    const gem = this.gems[this.next];
    if (gem) {
      gem.scale = [1.4, 1.4, 1.4];
      if (distance(this.player.pos, gem.pos) < 1.25) this.collect(gem);
    }
    if (!this.ended && this.remaining === 0) this.finish(false, 'Time ran out');
    this.draw();
  }

  collect(gem) {
    gem.destroy();
    const platform = this.scene.find('Plat' + this.next);
    this.spawn = [platform.pos[0], platform.pos[1] + 1.5, platform.pos[2]];
    this.next++;
    this.remaining += 6;
    this.energy = 1;
    this.notice = 'Checkpoint saved. +6 seconds and full sprint energy!';
    this.audio.play('assets/audio/sfx/coin.wav');
    if (this.next === this.gems.length) this.finish(true, 'Relay complete');
  }

  respawn() {
    this.lives--;
    if (this.lives <= 0) { this.finish(false, 'No lives left'); return; }
    this.physics.teleport(this.player, ...this.spawn);
    this.physics.setVelocity(this.player, 0, 0, 0);
    this.safeTime = 2;
    this.energy = 1;
    this.notice = 'Back at your last crystal. Two seconds of hazard protection.';
  }

  draw() {
    this.hud.set(`Crystal ${this.next}/${this.gems.length} | Time ${Math.ceil(this.remaining)} | ` +
      `Lives ${this.lives} | Sprint ${Math.round(this.energy * 100)}%\n` +
      `Best ${this.best === null ? '—' : this.best.toFixed(1) + 's'} | ${this.notice}`);
  }

  pause() {
    if (this.ended || this.game.paused) return;
    this.ui.show('relay-menu');
    this.game.pause();
    this.ui.menu('relay-menu', [
      { text: 'Resume relay', onClick: () => { this.ui.clear('relay-menu'); this.game.resume(); } },
      { text: 'Restart', onClick: () => this.restart() },
    ], { x: 20, y: 150 });
  }

  finish(won, title) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
      this.save.set('crystal-relay.best', this.best);
      const medal = this.elapsed < 45 ? 'Gold' : this.elapsed < 70 ? 'Silver' : 'Bronze';
      title += ` — ${medal}, ${this.elapsed.toFixed(1)}s`;
    }
    this.draw();
    this.ui.clear('relay-menu');
    this.ui.label(title, { screen: 'relay-menu', x: 20, y: 130, size: 30 });
    this.ui.menu('relay-menu', [{ text: 'Try again', onClick: () => this.restart() }], { x: 20, y: 180 });
    this.ui.show('relay-menu');
    this.game.pause();
  }

  restart() { this.game.resume(); this.game.restart(); }

  onDestroy() {
    this.controller.attrs.speed = this.attrs.speed;
    this.ui.clear('relay');
    this.ui.clear('relay-menu');
    this.game.resume();
  }
}
