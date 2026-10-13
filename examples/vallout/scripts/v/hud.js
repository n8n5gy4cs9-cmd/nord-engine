// Fallout-2-style interface bar: message log, buttons, weapon slot with AP LEDs, HP/AC readout, level/kill counters.
import { Layer, COL, wrap, GLASS, HI, LO } from './ui.js';
import { ITEMS } from './data.js';
import { derived, heldWeapon, modeOf, xpForLevel, armorClass } from './rules.js';

export const BAR_Y = 380;
export class Hud {
  get G() { return this.ctx.G; }
  constructor(ctx) {
    this.ctx = ctx; const { ps, font } = ctx; this.L = new Layer(ps, font, 12000); this.L.ctx = ctx;
    const L = this.L;
    const bg = ps.add.tileSprite(0, BAR_Y, 640, 100, ctx.K.ui, 7).setOrigin(0).setScrollFactor(0).setDepth(12000); L.objs.push(bg);
    L.rect(0, BAR_Y, 640, 2, HI, 1, 1); L.rect(0, BAR_Y + 2, 640, 1, LO, 1, 1);
    L.bevel(7, BAR_Y + 7, 238, 90, { face: GLASS, inset: true });                       // message log
    this.logT = Array.from({ length: 9 }, (_, i) => L.text(12, BAR_Y + 11 + i * 9, '', COL.green));
    L.btn(252, BAR_Y + 8, 44, 24, 'INV', () => ctx.openInventory());
    L.btn(252, BAR_Y + 36, 44, 24, 'OPT', () => ctx.openOptions());
    L.btn(252, BAR_Y + 64, 44, 24, 'SKILL', () => ctx.openChar());
    L.bevel(302, BAR_Y + 8, 114, 54, { face: GLASS, inset: true });                     // weapon slot
    this.wIcon = L.img(ctx.K.items, 0, 330, BAR_Y + 14, 3); this.wName = L.text(359, BAR_Y + 12, '', COL.text, [0.5, 0]); this.wMode = L.text(359, BAR_Y + 49, '', COL.orange, [0.5, 0]);
    L.zone(302, BAR_Y + 8, 114, 54, { down: () => ctx.area?.cycleMode?.() });
    this.leds = Array.from({ length: 10 }, (_, i) => L.img(ctx.K.ui, 12, 305 + i * 11, BAR_Y + 68));
    this.state = L.text(359, BAR_Y + 84, '', COL.dim, [0.5, 0]);
    L.bevel(422, BAR_Y + 8, 98, 54, { face: GLASS, inset: true });
    L.text(428, BAR_Y + 14, 'HP', COL.dim); this.hp = L.text(514, BAR_Y + 13, '', COL.orange, [1, 0], 5, 2);
    L.text(428, BAR_Y + 38, 'AC', COL.dim); this.ac = L.text(514, BAR_Y + 37, '', COL.orange, [1, 0], 5, 2);
    this.lv = L.text(422, BAR_Y + 68, '', COL.amber); this.kills = L.text(422, BAR_Y + 80, '', COL.cyan);
    L.btn(526, BAR_Y + 8, 54, 24, 'TURN', () => ctx.area?.endTurn?.());
    L.btn(526, BAR_Y + 36, 54, 24, 'COMBAT', () => ctx.area?.endCombat?.());
    L.btn(584, BAR_Y + 8, 50, 24, 'MAP', () => ctx.openWorld());
    L.btn(584, BAR_Y + 36, 50, 24, 'NOKIA', () => ctx.openNokia());
    this.modeT = L.text(580, BAR_Y + 70, '', COL.dim, [0.5, 0]); this.cbt = L.text(580, BAR_Y + 82, '', COL.red, [0.5, 0]);
    this.refresh();
  }
  log() {
    const lines = []; for (const m of this.ctx.G.log.slice(-14)) for (const l of wrap(m.t, 38)) lines.push([l, m.c]);
    const show = lines.slice(-9); this.logT.forEach((t, i) => t.setText(show[i]?.[0] ?? '', show[i]?.[1] ?? COL.green));
  }
  refresh(ap = null, maxAp = null) {
    const { G, ctx } = this, c = G.char, d = derived(c.S), w = heldWeapon(c), mode = modeOf(w, G.modeIdx);
    this.hp.setText(`${Math.max(0, c.hp)}`, c.hp <= c.maxHp * 0.3 ? COL.red : COL.orange); this.ac.setText(`${armorClass(c)}`);
    this.wIcon.setFrame(Math.max(0, ctx.itemFrame(w.icon))); this.wName.setText(w.name.toUpperCase().slice(0, 18), COL.text);
    this.wMode.setText(ctx.mode === 'classic' ? `${mode.n} ${mode.ap}AP` : `${mode.n}`);
    this.lv.setText(`LV ${c.lvl}  XP ${c.xp}/${xpForLevel(c.lvl)}`); this.kills.setText(`ALIENS ${G.kills}`);
    this.modeT.setText(ctx.mode === 'classic' ? 'CLASSIC' : 'MODERN WASD'); this.cbt.setText(ctx.area?.combat ? '-- COMBAT --' : (c.skillPts > 0 ? 'LEVEL UP! (SKILL)' : ''), c.skillPts > 0 && !ctx.area?.combat ? COL.amber : COL.red);
    if (ap !== null) { this.setLeds(ap, maxAp); this.state.setText(ctx.mode === 'classic' ? (ap > 0 || this.ctx.area?.combat ? `AP ${ap}/${maxAp}` : 'FREE ROAM') : 'STAMINA'); }
  }
  setLeds(n, max) { this.leds.forEach((l, i) => l.setFrame(i < Math.round(n) ? 11 : 12).setVisible(i < Math.max(max, 1) && i < 10)); }
  destroy() { this.L.destroy(); }
}
