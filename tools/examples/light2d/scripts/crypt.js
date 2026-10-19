import { NordScript } from 'nord';

// Game director for Crypt of Embers: HUD, shade spawning, brazier/gate/win logic and the Light Lab keys (L shadows, B darkness, [ ] force, ; ' strength, , . softness, H panel).
// Spawns shades by cloning the disabled 'ShadeTemplate' entity at dark 'spawn' markers the hero cannot see.
const DARK = [['Pitch black', '#05060c'], ['Crypt', '#14172b'], ['Dim', '#2b2f52']];
export default class Crypt extends NordScript {
  static attributes = {
    player: { type: 'string', default: 'Hero' },
    maxShades: { type: 'int', default: 3, min: 0, label: 'Shades alive at once (+1 per lit brazier)' },
    interval: { type: 'number', default: 9, min: 1, label: 'Seconds between spawns (shorter as braziers burn)' },
    minDistance: { type: 'number', default: 260, min: 0 },
  };
  start() {
    const ui = this.ui, S = { screen: 'hud' };
    this.world = this.game.light2d; this.system = [...this.scene.all()].flatMap((e) => e.scripts).find((s) => s.toggleShadows);
    this.hero = this.scene.find(this.attrs.player); this.tpl = this.scene.find('ShadeTemplate'); this.gate = this.scene.find('Gate'); this.exit = this.scene.find('Exit');
    this.total = this.scene.findByTag('brazier').length; this.lit = 0; this.dark = 1; this.open = false; this.won = false; this.t = 0; this.timer = 4; this.hints = new Map();
    this.oilLabel = ui.label('OIL', { ...S, x: 12, y: 76, size: 13, color: '#ffb347' }); this.oilBar = ui.bar(1, { ...S, x: 12, y: 96, color: '#ffb347' });
    this.count = ui.label('', { ...S, anchor: 'tr', x: 12, y: 8, size: 22, color: '#ffb25a' });
    this.hintLabel = ui.label('', { ...S, anchor: 'bl', x: 0, y: 26, size: 18, color: '#f2f2f2', style: { left: '50%', transform: 'translateX(-50%)', textAlign: 'center' } });
    this.lab = ui.label('', { ...S, anchor: 'bl', x: 12, y: 12, size: 12, color: '#bcd0ff', style: { whiteSpace: 'pre', fontFamily: 'monospace' } });
    this.labOn = false; this.#sync();
    this.offs = [
      this.events.on('oil', (o) => this.oilBar.set(o.oil / o.max)),
      this.events.on('hint', (h) => { h.text ? this.hints.set(h.id, h.text) : this.hints.delete(h.id); this.hintLabel.set([...this.hints.values()].pop() ?? ''); }),
      this.events.on('brazier:lit', () => this.#lit()),
      this.events.on('died', () => this.hintLabel.set('')),
    ];
    this.after(0.1, () => { const h = this.hero?.scripts.find((s) => 'inv' in s); if (h) this.hero.emit('health', { hp: h.hp, max: h.attrs.max }); }); // HUD hearts at the start
    this.after(0.6, () => this.events.emit('toast', { text: `Light all ${this.total} braziers. Hold click / Space for your beam.`, time: 6 }));
  }
  onDestroy() { this.offs?.forEach((o) => o()); [this.oilLabel, this.oilBar, this.count, this.hintLabel, this.lab].forEach((h) => h?.remove()); }

  #lit() {
    this.lit++; this.#sync(); this.events.emit('score', 250);
    if (this.lit < this.total) return this.events.emit('toast', { text: `Brazier lit (${this.lit}/${this.total})`, color: '#ffb25a' });
    this.open = true; this.gate?.destroy(); this.events.emit('sfx', 'explosion'); this.game.camera.shake(400, 0.008);
    const l = this.exit?.scripts.find((s) => s.isLight2D); if (l) l.on = true;
    this.events.emit('toast', { text: 'The gate grinds open. Reach the glowing exit!', color: '#9cf', time: 6 });
  }
  #sync() { this.count.set(`${this.lit}/${this.total} braziers`); }

  update(dt) {
    const w = this.world, hero = this.hero;
    if (this.input.pressed('shadows')) { const on = this.system.toggleShadows(); this.events.emit('toast', { text: 'Shadows ' + (on ? 'on' : 'off') }); }
    if (this.input.pressed('ambient')) { this.dark = (this.dark + 1) % DARK.length; this.system.setAmbient(DARK[this.dark][1]); this.events.emit('toast', { text: 'Darkness: ' + DARK[this.dark][0] }); }
    // live look tuning (hold): [ ] light force, ; ' shadow strength, , . shadow softness; all via system.setLook()
    const k = (a, b) => (this.input.down(b) ? 1 : 0) - (this.input.down(a) ? 1 : 0);
    const df = k('forceDown', 'forceUp'), ds = k('shadowDown', 'shadowUp'), dh = k('softDown', 'softUp');
    if (df || ds || dh) this.system.setLook({ force: w.force + df * dt * 1.2, shadowStrength: w.shadowStrength + ds * dt * 0.8, softness: w.softness + dh * dt * 2 });
    if (this.input.pressed('lab')) { this.labOn = !this.labOn; if (!this.labOn) this.lab.set(''); }
    if (this.labOn) {
      const s = w.stats;
      this.lab.set(`LIGHT LAB  (H hides)\nlights ${s.drawn}/${s.lights}   occluders ${s.occluders}\nsegments ${s.segments}   rays ${s.rays}\nlightmap ${s.ms.toFixed(2)} ms\n[L] shadows ${w.shadows ? 'ON' : 'OFF'}   [B] darkness: ${DARK[this.dark][0]}\n[ ] light force ${w.force.toFixed(2)}   ; ' shadow strength ${w.shadowStrength.toFixed(2)}   , . softness ${w.softness.toFixed(2)}\n[1-5] beam colour`);
    }
    if (!hero || hero.destroyed || this.won) return;
    if (this.open && this.exit && Math.hypot(hero.pos[0] - this.exit.pos[0], hero.pos[1] - this.exit.pos[1]) < 44) { this.won = true; this.events.emit('score', 1000); this.events.emit('game:win'); return; }
    this.t += dt; this.timer -= dt;
    const alive = this.scene.findByTag('enemy').filter((e) => e.enabled && !e.destroyed).length;
    if (this.timer <= 0 && alive < this.attrs.maxShades + this.lit) { this.timer = Math.max(3.5, this.attrs.interval - this.lit * 1.6); this.#spawn(); }
  }
  #spawn() {
    const hero = this.hero, pts = this.scene.findByTag('spawn').sort(() => Math.random() - 0.5);
    const p = pts.find((s) => Math.hypot(s.pos[0] - hero.pos[0], s.pos[1] - hero.pos[1]) > this.attrs.minDistance && this.world.lightAt(s.pos[0], s.pos[1]) < 0.12);
    if (!p || !this.tpl) return;
    const d = this.tpl.toJSON(true); d.enabled = true; d.transform.pos = [p.pos[0], p.pos[1], 3]; this.scene.spawnData(d);
  }
}
