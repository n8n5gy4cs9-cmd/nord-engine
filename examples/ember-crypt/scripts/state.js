import { NordScript } from 'nord';

/** The rules of one run: what the hero carries, the clock, and how it ends. Everything else only sends it events. */
export default class State extends NordScript {
  start() {
    this.coins = 0;
    this.keys = 0;
    this.elapsed = 0;
    this.ended = false;
    this.best = this.save.get('ember.best', 0);
    this.announce = 0;
    this.offs = [
      this.events.on('pickup', ({ kind }) => this.pickup(kind)),
      this.events.on('died', () => this.end(false)),
      this.events.on('exit', () => this.end(true)),
    ];
    this.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.35 });
    this.push();
  }

  pickup(kind) {
    if (kind === 'coin') this.coins++;
    else if (kind === 'chest') this.coins += 5;
    else if (kind === 'key') this.keys++;
    else if (kind === 'potion') this.scene.find('Hero').emit('heal', { amount: 1 });
    this.push();
  }

  /** Doors call this: spends a key if there is one. */
  useKey() {
    if (this.keys <= 0) return false;
    this.keys--;
    this.push();
    return true;
  }

  push() { this.events.emit('state', { coins: this.coins, keys: this.keys, time: this.elapsed }); }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    this.announce -= dt;
    if (this.announce <= 0) { this.announce = 0.25; this.push(); }
  }

  end(win) {
    if (this.ended) return;
    this.ended = true;
    const score = this.coins * 10 + (win ? Math.max(0, 300 - Math.floor(this.elapsed)) * 5 : 0);   // a faster win is worth more
    const record = win && score > this.best;
    if (record) { this.best = score; this.save.set('ember.best', score); }
    this.audio.stopMusic();
    this.audio.play(`assets/audio/music/${win ? 'jingle_victory' : 'jingle_game_over'}.mp3`, { volume: 0.7 });
    this.events.emit('ended', { win, score, best: this.best, record, coins: this.coins, time: this.elapsed });
  }

  onDestroy() { this.offs?.forEach((off) => off()); }
}
