import { NordScript } from 'nord';
import { rect, circle } from './mk.js';

export default class TD extends NordScript {
  static attributes = { path: { type: 'array', default: [] }, gold: { type: 'int', default: 90 }, lives: { type: 'int', default: 10 }, waves: { type: 'int', default: 10 }, towerCost: { type: 'int', default: 30 }, range: { type: 'number', default: 80 }, fireRate: { type: 'number', default: 2 } };
  start() {
    Object.assign(this, { gold: this.attrs.gold, lives: this.attrs.lives, wave: 0, towers: [], creeps: [], shots: [], queue: 0, spawnT: 0, gap: 3, over: false });
    this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 18 }); this.hud();
  }
  onDestroy() { this.lbl?.remove(); }
  hud() { this.lbl.set(`Gold ${this.gold}   Lives ${this.lives}   Wave ${this.wave}/${this.attrs.waves}   (click to build: ${this.attrs.towerCost})`); }
  onRoad(x, y) { const P = this.attrs.path; return P.slice(0, -1).some((p, i) => { const q = P[i + 1]; return x > Math.min(p[0], q[0]) - 22 && x < Math.max(p[0], q[0]) + 22 && y > Math.min(p[1], q[1]) - 22 && y < Math.max(p[1], q[1]) + 22; }); }
  update(dt) {
    if (this.over) return; const P = this.attrs.path, ptr = this.input.pointer;
    if (ptr.down && !this.was && this.gold >= this.attrs.towerCost && !this.onRoad(ptr.worldX, ptr.worldY) && !this.towers.some((t) => Math.hypot(t.e.pos[0] - ptr.worldX, t.e.pos[1] - ptr.worldY) < 24)) {
      this.gold -= this.attrs.towerCost; this.hud(); this.events.emit('sfx', 'powerup'); rect(this.scene, 'Tower', ptr.worldX, ptr.worldY, 20, 20, '#81a1c1', { z: 3 }).then((e) => this.towers.push({ e, cd: 0 }));
    }
    this.was = ptr.down;
    if (!this.queue && !this.creeps.length && this.wave < this.attrs.waves) { if ((this.gap -= dt) <= 0) { this.wave++; this.queue = 4 + this.wave * 2; this.gap = 4; this.hud(); } }
    if (this.queue && (this.spawnT -= dt) <= 0) { this.spawnT = 0.7; this.queue--; const hp = 3 + this.wave * 2; circle(this.scene, 'Creep', P[0][0], P[0][1], 16, '#bf616a', { z: 4 }).then((e) => this.creeps.push({ e, i: 0, hp, max: hp })); }
    if (!this.queue && !this.creeps.length && this.wave >= this.attrs.waves) { this.over = true; this.events.emit('game:win'); }
    for (const c of this.creeps) {
      const t = P[c.i + 1]; if (!t) { c.e.destroy(); this.lives--; this.hud(); this.events.emit('sfx', 'hit'); if (this.lives <= 0) { this.over = true; this.events.emit('game:over'); } continue; }
      const dx = t[0] - c.e.pos[0], dy = t[1] - c.e.pos[1], d = Math.hypot(dx, dy), s = (40 + this.wave * 2) * dt;
      if (d <= s) { c.e.pos = [t[0], t[1], 4]; c.i++; } else c.e.pos = [c.e.pos[0] + (dx / d) * s, c.e.pos[1] + (dy / d) * s, 4];
    }
    for (const t of this.towers) {
      if ((t.cd -= dt) > 0) continue; const tgt = this.creeps.find((c) => !c.e.destroyed && Math.hypot(c.e.pos[0] - t.e.pos[0], c.e.pos[1] - t.e.pos[1]) < this.attrs.range); if (!tgt) continue;
      t.cd = 1 / this.attrs.fireRate; this.events.emit('sfx', 'laser'); circle(this.scene, 'Shot', t.e.pos[0], t.e.pos[1], 6, '#ebcb8b', { z: 6 }).then((e) => this.shots.push({ e, tgt }));
    }
    for (const s of this.shots) {
      if (s.tgt.e.destroyed) { s.e.destroy(); continue; }
      const dx = s.tgt.e.pos[0] - s.e.pos[0], dy = s.tgt.e.pos[1] - s.e.pos[1], d = Math.hypot(dx, dy), v = 300 * dt;
      if (d <= v + 4) { s.e.destroy(); if (--s.tgt.hp <= 0) { s.tgt.e.destroy(); this.gold += 5; this.hud(); this.events.emit('sfx', 'coin'); } } else s.e.pos = [s.e.pos[0] + (dx / d) * v, s.e.pos[1] + (dy / d) * v, 6];
    }
    this.creeps = this.creeps.filter((c) => !c.e.destroyed); this.shots = this.shots.filter((s) => !s.e.destroyed);
  }
}
