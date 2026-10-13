// Screens & panels: title, intro, character creation, world map, inventory, character sheet, Nokia (quests), options, dialogue,
// wall-kicking minigame, endings. Everything is built from ui.js Layers (F2-style bevelled panels, bitmap font).
import { Layer, COL, wrap, ascii } from './ui.js';
import { Hud } from './hud.js';
import { Area } from './play.js';
import { encounterLoc } from './mapgen.js';
import { ITEMS, LOCS, LOC_ORDER, QUESTS, NPCS, DIALOG, SPECIAL, SPECIAL_NAMES, SPECIAL_DESC, SKILLS, SKILL_NAMES, SKILL_DESC, PRESETS, INTRO, ENDINGS, TITLE_QUIPS, QUOTA } from './data.js';
import * as R from './rules.js';

const D_SCREEN = 2000, D_OVER = 15000;
const rows = ['tero', 'pena', 'kalle', 'saku', 'mottonen', 'rane', 'soldier', 'ranger', 'harmaa', 'komentaja', 'blob', 'gull'];
const clock = (m) => `DAY ${1 + Math.floor(m / 1440)}  ${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

export class Screens {
  constructor(ctx) { this.ctx = ctx; this.base = []; this.stack = []; this.typing = null; }
  layer(depth = D_SCREEN) { const L = new Layer(this.ctx.ps, this.ctx.font, depth); L.ctx = this.ctx; return L; }
  clear() { // full screen change: drop area, hud, base layers and overlays
    const ctx = this.ctx; while (this.stack.length) this.stack.pop().destroy(); ctx.modal = 0;
    if (ctx.area) { ctx.area.unbindInput?.(); ctx.area.destroy(); ctx.area = null; } ctx.hud?.destroy(); ctx.hud = null; this.base.forEach((l) => l.destroy()); this.base = []; this.screenKey = null; this.tick = null; ctx.setHint(''); ctx.setCursor(0);
    ctx.ps.cameras.main.setScroll(0, 0); ctx.ps.tweens.killAll(); ctx.ps.time.removeAllEvents();
  }
  overlay(name, w, h, title) {
    const ctx = this.ctx, L = this.layer(D_OVER + this.stack.length * 100); ctx.modal++;
    const x = Math.floor((640 - w) / 2), y = Math.floor((380 - h) / 2) + 2;
    L.rect(0, 0, 640, 480, 0x000000, 0.45); L.zone(0, 0, 640, 480, { down: () => {} }); L.panel(x, y, w, h, title);
    const o = { name, L, x, y, w, h, destroy: () => L.destroy(), close: () => { const i = this.stack.indexOf(o); if (i >= 0) { this.stack.splice(i, 1); L.destroy(); ctx.modal = Math.max(0, ctx.modal - 1); ctx.area?.pointerMove?.(ctx.ps.input.activePointer); ctx.hud?.refresh(); ctx.setHint(''); } } };
    L.btn(x + w - 52, y + h - 24, 46, 18, 'CLOSE', () => o.close()); this.stack.push(o); return o;
  }
  key(e) {
    const ctx = this.ctx, k = e.key.toLowerCase(), top = this.stack.at(-1);
    if (this.screenKey?.(e, k)) return;
    if (top) { if (e.code === 'Escape' || (k === 'i' && top.name === 'inv') || (k === 'c' && top.name === 'char') || (k === 'p' && top.name === 'nokia') || (top.name === 'options' && k === 'o')) top.close(); return; }
    if (!ctx.area) return; const a = ctx.area;
    if (k === 'i') this.inventory(); else if (k === 'c') this.character(); else if (k === 'p') this.nokia(); else if (e.code === 'Tab') ctx.openWorld(); else if (e.code === 'Escape' || k === 'o') this.options();
    else if (e.code === 'F10') { ctx.setMode(ctx.mode === 'classic' ? 'modern' : 'classic'); }
    else if (e.code === 'F5') ctx.save(); else if (e.code === 'F9') ctx.load(); else a.onKey(e);
  }
  // ===================================================================== title / intro / create
  title() {
    this.clear(); const ctx = this.ctx, { K } = ctx, L = this.layer(); this.base.push(L); ctx.music('title');
    L.img(K.title, null, 0, 0, 1, [0, 0], 0);
    L.text(28, 34, 'VALLOUT 2', COL.text, [0, 0], 9, 4);
    L.text(30, 76, 'NEW KERAVA', COL.amber, [0, 0], 9, 2);
    L.text(30, 103, 'QUARANTINE SECTOR / UUSIMAA', COL.dim, [0, 0], 9);
    L.hazard(30, 122, 214, 8);
    L.panel(24, 154, 230, 212);
    L.text(139, 166, 'CIVIL DEFENSE TERMINAL', COL.dim, [0.5, 0], 9);
    const bx = 38;
    L.btn(bx, 188, 202, 30, 'NEW GAME', () => this.intro(), { d: 12 });
    const cont = L.btn(bx, 224, 202, 30, 'CONTINUE', () => ctx.load(), { d: 12 });
    if (!ctx.hasSave()) { cont.t.setText('CONTINUE (NO SAVE)', COL.dim); cont.z.disableInteractive(); }
    const modeBtn = L.btn(bx, 260, 202, 30, `CONTROLS: ${ctx.mode.toUpperCase()}`, () => { ctx.setMode(ctx.mode === 'classic' ? 'modern' : 'classic'); modeBtn.t.setText(`CONTROLS: ${ctx.mode.toUpperCase()}`, COL.orange); }, { d: 12 });
    L.btn(bx, 296, 202, 30, 'CREDITS / TRANSMISSION', () => {
      const o = this.overlay('credits', 430, 190, 'TRANSMISSION: KERAVA'), C = o.L;
      ['CROWELIAN 2026 + SONNET', 'NORD ENGINE / VALLOUT 2', 'KERAVA STATION. THE LAST TRAIN NEVER LEFT.', 'F10 SWITCHES CLASSIC / MODERN CONTROLS.', TITLE_QUIPS[Math.floor(Math.random() * TITLE_QUIPS.length)]].forEach((t, i) => wrap(t, 62).forEach((line, j) => C.text(o.x + 22, o.y + 30 + i * 24 + j * 10, line, i ? COL.green : COL.amber)));
    }, { d: 12 });
    L.text(139, 344, 'CONNECTION LOST - CORDON ACTIVE', COL.green, [0.5, 0], 9);
    L.rect(0, 452, 640, 28, 0x080d0b, 0.85, 8);
    L.text(320, 462, 'CROWELIAN 2026 + SONNET  /  NORD ENGINE  /  F10 CONTROLS', COL.dim, [0.5, 0], 9);
  }
  intro() {
    this.clear(); const ctx = this.ctx, L = this.layer(); this.base.push(L); L.metal(0, 0, 640, 480); L.panel(16, 16, 608, 448, 'EMERGENCY BROADCAST / KERAVA'); L.bevel(28, 38, 584, 380, { inset: true, face: 0x09140c }); let i = 0, cur = null, ch = 0, ty = 62, current = [];
    const paint = () => { const text = wrap(ascii(cur.slice(0, ch)), 46); current.forEach((t, j) => t.setText(text[j] ?? '')); };
    const next = () => {
      if (cur && ch < cur.length) { ch = cur.length; paint(); return; }
      if (i >= INTRO.length) return this.create(); cur = INTRO[i++]; ch = 0;
      current = wrap(cur, 46).map(() => { const t = L.text(320, ty, '', i === 1 ? COL.amber : COL.green, [0.5, 0], 5, 2); ty += 20; return t; }); ty += 16;
    };
    this.tick = (dt) => { if (cur && ch < cur.length) { this.tk = (this.tk ?? 0) + dt; if (this.tk > 0.03) { this.tk = 0; ch++; paint(); if (ch % 3 === 0) ctx.sfx('click', 0.12, 1.6); } } };
    this.screenKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { next(); return true; } if (e.code === 'Escape') { this.create(); return true; } return false; };
    L.zone(0, 0, 640, 480, { down: next }); L.text(320, 450, 'CLICK / SPACE TO CONTINUE   -   ESC TO SKIP', COL.dim, [0.5, 0]); next();
  }
  create() {
    this.clear(); const ctx = this.ctx, st = this.cs ?? (this.cs = { S: { ...PRESETS.Tero }, tags: [...PRESETS.Tero.tags] }); this.cs = st; this.drawCreate();
  }
  drawCreate() {
    const ctx = this.ctx, st = this.cs; this.base.forEach((l) => l.destroy()); this.base = []; const L = this.layer(); this.base.push(L);
    L.metal(0, 0, 640, 480); L.panel(10, 10, 620, 460, 'CIVIL DEFENSE / SURVIVOR RECORD: TERO'); const left = 40 - SPECIAL.reduce((s, k) => s + st.S[k], 0);
    L.bevel(24, 34, 238, 254, { inset: true, face: 0x101a10 });
    L.bevel(284, 34, 174, 126, { inset: true, face: 0x101a10 });
    L.bevel(464, 34, 160, 254, { inset: true, face: 0x101a10 });
    L.bevel(290, 176, 132, 132, { inset: true, face: 0x0a140c });
    L.img(ctx.K.portraits, 0, 292, 178, 2);
    L.text(290, 320, 'ID: KRV-019 / TERO', COL.green);
    L.text(30, 40, 'S.P.E.C.I.A.L.', COL.orange); let hover = '';
    SPECIAL.forEach((k, i) => { const y = 62 + i * 30; L.text(30, y + 3, SPECIAL_NAMES[k].toUpperCase(), COL.text); L.text(190, y + 2, String(st.S[k]), COL.amber, [0.5, 0], 5, 2);
      L.btn(214, y, 18, 18, '-', () => { if (st.S[k] > 1) { st.S[k]--; this.drawCreate(); } }); L.btn(236, y, 18, 18, '+', () => { if (left > 0 && st.S[k] < 10) { st.S[k]++; this.drawCreate(); } });
      L.zone(30, y, 180, 24, { over: () => this.descT?.setText(SPECIAL_DESC[k]) }); });
    L.text(30, 280, `POINTS LEFT: ${left}`, left === 0 ? COL.green : COL.red); L.text(30, 300, 'PRESETS', COL.dim);
    Object.keys(PRESETS).forEach((n, i) => L.btn(30 + i * 82, 316, 78, 20, n.toUpperCase(), () => { st.S = { ...PRESETS[n] }; delete st.S.tags; st.tags = [...PRESETS[n].tags]; this.drawCreate(); }));
    const d = R.derived(st.S); L.text(290, 40, 'DERIVED', COL.orange);
    [['HIT POINTS', d.maxHp], ['ACTION POINTS', d.ap], ['ARMOR CLASS', d.ac], ['CARRY WEIGHT', d.carry], ['SEQUENCE', d.seq], ['CRITICAL %', d.crit], ['HEAL RATE', d.heal]].forEach(([n, v], i) => { L.text(290, 62 + i * 14, n, COL.dim); L.text(450, 62 + i * 14, String(v), COL.text, [1, 0]); });
    L.text(470, 40, 'TAG 2 SKILLS (+20)', COL.orange); const c = { S: st.S, tags: st.tags, sk: {} };
    SKILLS.forEach((s, i) => { const y = 62 + i * 30, on = st.tags.includes(s); L.btn(470, y, 150, 22, `${on ? '* ' : ''}${SKILL_NAMES[s].toUpperCase()}  ${R.skillValue(c, s)}%`, () => { if (on) st.tags = st.tags.filter((t) => t !== s); else if (st.tags.length < 2) st.tags.push(s); else { st.tags.shift(); st.tags.push(s); } this.drawCreate(); }, { color: on ? COL.green : COL.orange });
      L.zone(470, y, 150, 22, { over: () => this.descT?.setText(SKILL_DESC[s]) }); });
    L.bevel(30, 350, 580, 40, { inset: true, face: 0x08100a }); this.descT = L.paragraph(38, 358, 564, 30, 'HOVER A STAT. PICK 2 TAG SKILLS. SPEND ALL POINTS.', COL.green);
    L.text(30, 404, 'TERO. 19. SURVIVOR OF A FRIDAY NIGHT. NO LAST NAME. CARRIES A NOKIA 3310.', COL.dim);
    const ok = left === 0 && st.tags.length === 2; const b = L.btn(470, 430, 150, 28, ok ? 'BEGIN' : 'FINISH SETUP', () => { if (ok) this.start(); }, { color: ok ? COL.green : COL.dim });
    L.btn(30, 430, 100, 28, 'BACK', () => this.title());
  }
  start() {
    const ctx = this.ctx, st = this.cs, G = ctx.G = ctx.newGame(); G.char = R.newCharacter({ ...st.S, tags: st.tags }); ctx.here = 'asema'; G.log.push({ t: 'Tero wakes up on a station bench.', c: COL.amber });
    this.startArea('asema');
  }
  // ===================================================================== areas & world map
  async startArea(locId, { encounter } = {}) {
    const ctx = this.ctx, G = ctx.G; this.clear(); const loc = encounter ? encounter.loc : LOCS[locId];
    if (!encounter) { ctx.here = locId; if (!G.visited.includes(locId)) G.visited.push(locId); }
    ctx.hud = new Hud(ctx); const a = new Area(ctx, locId, loc, { encounter }); ctx.bindArea(a); await a.build(); a.bindInput(); if (ctx.mode === 'modern') a.initModern();
    ctx.music('explore'); ctx.hud.refresh(); ctx.hud.log(); ctx.save();
  }
  leaveArea() { const ctx = this.ctx, t = ctx.travel; if (t) { ctx.travel = null; return this.arrive(t.dest); } this.world(); }
  arrive(dest) { const ctx = this.ctx; ctx.G.time += 60; ctx.here = dest; this.startArea(dest); }
  world() {
    const ctx = this.ctx, G = ctx.G; if (ctx.area?.combat) return ctx.area.say('You cannot leave during combat!', COL.red);
    this.clear(); const L = this.layer(); this.base.push(L);
    L.metal(0, 0, 640, 480); L.panel(6, 6, 628, 468, 'CIVIL DEFENSE / KERAVA QUARANTINE REGION'); L.bevel(14, 24, 612, 346, { face: 0x1c2a16, inset: true });
    L.img(ctx.K.world, null, 14, 24, 1, [0, 0], 0.5);
    const g = ctx.ps.add.graphics().setScrollFactor(0).setDepth(D_SCREEN + 1); L.objs.push(g);
    g.lineStyle(2, 0xa0b887, 0.8); for (const a of LOC_ORDER) for (const b of LOCS[a].links) if (a < b) g.lineBetween(...LOCS[a].map, ...LOCS[b].map);
    L.text(40, 336, 'SURVEY: KRV / CORDON ACTIVE', COL.text); L.text(560, 274, 'KERAVANJOKI', COL.cyan, [0.5, 0]); L.text(320, 30, 'KEHA III CORDON (QUARANTINE)', COL.red, [0.5, 0]);
    const info = L.bevel(14, 376, 612, 56, { inset: true, face: 0x08100a }); const nameT = L.text(22, 382, '', COL.amber), descT = L.text(22, 396, '', COL.text), subT = L.text(22, 412, '', COL.dim);
    L.text(22, 440, clock(G.time) + `     ALIENS KILLED: ${G.kills}/${QUOTA}`, COL.green);
    const here = ctx.here;
    for (const id of LOC_ORDER) {
      const l = LOCS[id], [x, y] = l.map, locked = id === 'klaukkala' && !G.flags.hive_cleared, visited = G.visited.includes(id), linked = LOCS[here].links.includes(id), cur = id === here;
      g.fillStyle(cur ? 0xffd25c : locked ? 0x444444 : linked ? 0x7bff7b : 0xaaaaaa, 1).fillCircle(x, y, cur ? 8 : 6); g.lineStyle(2, 0x000000, 1).strokeCircle(x, y, cur ? 8 : 6);
      L.text(x, y + 12, locked ? '???' : l.name.toUpperCase(), cur ? COL.amber : linked ? COL.green : COL.dim, [0.5, 0]);
      const act = () => { if (cur) return this.enterHere(); if (!linked) return subT.setText('NO DIRECT ROUTE. TRAVEL VIA THE CONNECTED TOWNS.', COL.red); if (locked) return subT.setText('KLAUKKALA IS UNREACHABLE: THE HIVE BLOCKS THE RIVER BRIDGE.', COL.red); this.travel(id, g, L); };
      L.zone(x - 14, y - 14, 28, 28, { over: () => { nameT.setText(`${l.name.toUpperCase()} (${l.fi.toUpperCase()})`, COL.amber); descT.setText(locked ? 'BLOCKED.' : l.desc.slice(0, 98), COL.text); subT.setText(cur ? 'YOU ARE HERE. CLICK TO ENTER.' : linked ? 'CLICK TO TRAVEL.' : 'NOT CONNECTED.', COL.dim); }, down: act });
    }
    const [px, py] = LOCS[here].map; this.pin = L.img(ctx.K.actors, 0, px, py - 8, 1, [0.5, 1], 20);
    L.btn(500, 440, 120, 26, ctx.area || G.char ? 'ENTER AREA' : '', () => this.enterHere()); L.btn(374, 440, 120, 26, 'SAVE', () => { if (ctx.save()) subT.setText('GAME SAVED.', COL.green); }); L.btn(248, 440, 120, 26, 'MENU', () => this.title());
    ctx.music('explore');
  }
  enterHere() { this.startArea(this.ctx.here); }
  async travel(dest, g, L) {
    const ctx = this.ctx, from = LOCS[ctx.here].map, to = LOCS[dest].map, ps = ctx.ps, pin = this.pin; this.screenKey = () => true; ctx.sfx('whoosh', 0.4);
    await new Promise((r) => ps.tweens.add({ targets: pin, x: to[0], y: to[1] - 8, duration: 1300, onUpdate: () => { }, onComplete: r }));
    ctx.G.time += 40; const danger = { kuopat: { blob: 2, harmaa: 1 }, keskusta: { blob: 2, gull: 1 }, asema: { blob: 2, gull: 1 }, sampola: { blob: 2, harmaa: 2 }, joki: { harmaa: 3, blob: 2 }, klaukkala: { harmaa: 1, gull: 2 } }[dest];
    if (Math.random() < 0.4) { const e = {}; for (const [k, n] of Object.entries(danger)) e[k] = Math.max(1, n + Math.floor(Math.random() * 2) - 1); const seed = 1000 + Math.floor(Math.random() * 9000); ctx.travel = { dest }; ctx.here = dest; await this.startArea(`waste${seed}`, { encounter: { loc: encounterLoc(seed, e), dest } }); ctx.area.say('Random encounter on the road!', COL.red); return; }
    this.arrive(dest);
  }
  resume(G) { const ctx = this.ctx; ctx.G = G; ctx.here = G.loc ?? 'asema'; G.log ??= []; this.startArea(ctx.here); }
  // ===================================================================== overlays
  inventory() {
    const ctx = this.ctx, G = ctx.G, st = (this.invSt ??= { sel: null, page: 0 }); this.stack.find((o) => o.name === 'inv')?.close();
    const o = this.overlay('inv', 560, 330, 'INVENTORY'), L = o.L, { x, y } = o, c = G.char, d = R.derived(c.S), redo = () => this.inventory();
    L.bevel(x + 314, y + 22, 236, 270, { inset: true, face: 0x101a10 });
    const list = G.inv.filter((i) => ITEMS[i.id]), per = 11, pages = Math.max(1, Math.ceil(list.length / per)); st.page = Math.min(st.page, pages - 1);
    L.bevel(x + 8, y + 22, 300, 270, { inset: true, face: 0x0c0a08 });
    list.slice(st.page * per, st.page * per + per).forEach((it, i) => { const def = ITEMS[it.id], ry = y + 26 + i * 24, on = st.sel === it.id; if (on) L.rect(x + 10, ry - 1, 296, 22, 0x4a3a1a);
      L.img(ctx.K.items, ctx.itemFrame(def.icon), x + 14, ry + 2, 1.2); L.text(x + 40, ry + 4, def.name.toUpperCase() + (it.n > 1 ? ` x${it.n}` : ''), it.id === c.weapon || it.id === c.armor ? COL.green : COL.text); L.text(x + 300, ry + 4, (def.w * it.n).toFixed(1), COL.dim, [1, 0]);
      L.zone(x + 10, ry - 1, 296, 22, { down: () => { st.sel = it.id; redo(); } }); });
    L.btn(x + 10, y + 296, 40, 18, 'PREV', () => { st.page = Math.max(0, st.page - 1); redo(); }); L.btn(x + 54, y + 296, 40, 18, 'NEXT', () => { st.page = Math.min(pages - 1, st.page + 1); redo(); }); L.text(x + 100, y + 301, `PAGE ${st.page + 1}/${pages}`, COL.dim);
    L.text(x + 320, y + 26, 'EQUIPPED', COL.orange); L.text(x + 320, y + 40, `WEAPON: ${R.heldWeapon(c).name.toUpperCase()}`, COL.green); L.text(x + 320, y + 52, `ARMOR:  ${(ITEMS[c.armor]?.name ?? 'NONE').toUpperCase()}`, COL.green);
    L.text(x + 320, y + 70, `WEIGHT ${ctx.weight().toFixed(0)}/${d.carry}`, ctx.weight() > d.carry ? COL.red : COL.text); L.text(x + 320, y + 82, `MARKKA ${ctx.count('cash')}`, COL.amber);
    if (st.sel && ITEMS[st.sel] && ctx.count(st.sel)) { const it = ITEMS[st.sel], ty = y + 200; L.img(ctx.K.items, ctx.itemFrame(it.icon), x + 320, y + 104, 2); L.text(x + 360, y + 108, it.name.toUpperCase(), COL.amber);
      wrap(it.desc, 34).forEach((l, i) => L.text(x + 320, y + 138 + i * 10, l, COL.text));
      if (it.type === 'weapon') { L.text(x + 320, ty, `DMG ${it.dmg[0]}-${it.dmg[1]}  RNG ${it.range}`, COL.dim); L.text(x + 320, ty + 10, `MODES: ${it.modes.map((m) => m.n).join('/')}`, COL.dim); L.btn(x + 320, ty + 28, 100, 20, c.weapon === st.sel ? 'EQUIPPED' : 'EQUIP (2AP)', () => { ctx.equip(st.sel); redo(); }); }
      if (it.type === 'armor') { L.text(x + 320, ty, `AC +${it.ac}  DT ${it.dt}  DR ${it.dr}%`, COL.dim); L.btn(x + 320, ty + 28, 100, 20, c.armor === st.sel ? 'WORN' : 'WEAR (2AP)', () => { ctx.equip(st.sel); redo(); }); }
      if (it.type === 'aid') { L.text(x + 320, ty, `HEALS ${it.heal[0]}-${it.heal[1]} HP`, COL.dim); L.btn(x + 320, ty + 28, 100, 20, 'USE (2AP)', () => { ctx.useItem(st.sel); redo(); }); }
      if (it.type !== 'quest' && st.sel !== c.weapon && st.sel !== c.armor) L.btn(x + 430, ty + 28, 60, 20, 'DROP', () => { ctx.take(st.sel, 1); ctx.area?.say(`You drop the ${it.name}.`, COL.dim); redo(); });
    }
  }
  character() {
    const ctx = this.ctx, G = ctx.G, c = G.char; this.stack.find((o) => o.name === 'char')?.close();
    const o = this.overlay('char', 580, 340, `CHARACTER - TERO - LEVEL ${c.lvl}`), L = o.L, { x, y } = o, d = R.derived(c.S);
    L.bevel(x + 8, y + 22, 164, 264, { inset: true, face: 0x101a10 });
    L.bevel(x + 188, y + 22, 190, 190, { inset: true, face: 0x101a10 });
    L.bevel(x + 390, y + 22, 180, 190, { inset: true, face: 0x101a10 });
    L.img(ctx.K.portraits, 0, x + 400, y + 122, 1.25);
    L.text(x + 492, y + 134, 'KRV-019', COL.green);
    L.text(x + 492, y + 152, 'TERO', COL.amber);
    L.text(x + 492, y + 172, 'SURVIVOR', COL.dim);
    L.text(x + 14, y + 26, 'SPECIAL', COL.orange); SPECIAL.forEach((k, i) => { L.text(x + 14, y + 42 + i * 14, SPECIAL_NAMES[k].toUpperCase(), COL.text); L.text(x + 150, y + 42 + i * 14, String(c.S[k]), COL.amber, [1, 0]); L.zone(x + 14, y + 42 + i * 14, 140, 12, { over: () => descT.setText(SPECIAL_DESC[k]) }); });
    L.text(x + 14, y + 150, 'DERIVED', COL.orange); [['HIT POINTS', `${c.hp}/${c.maxHp}`], ['ACTION POINTS', d.ap], ['ARMOR CLASS', R.armorClass(c)], ['SEQUENCE', d.seq], ['CRITICAL', d.crit + '%'], ['MELEE BONUS', '+' + d.mdb], ['CARRY', d.carry]].forEach(([n, v], i) => { L.text(x + 14, y + 166 + i * 13, n, COL.dim); L.text(x + 150, y + 166 + i * 13, String(v), COL.text, [1, 0]); });
    L.text(x + 200, y + 26, `SKILLS  (POINTS: ${c.skillPts})`, c.skillPts ? COL.amber : COL.orange);
    SKILLS.forEach((s, i) => { const ry = y + 44 + i * 26, tag = c.tags.includes(s); L.text(x + 200, ry + 4, `${tag ? '* ' : ''}${SKILL_NAMES[s].toUpperCase()}`, tag ? COL.green : COL.text); L.text(x + 340, ry + 4, `${R.skillValue(c, s)}%`, COL.amber, [1, 0]);
      if (c.skillPts > 0) L.btn(x + 350, ry, 18, 18, '+', () => { c.skillPts--; c.sk[s] += 2; ctx.sfx('confirm', 0.4); this.character(); }); L.zone(x + 200, ry, 150, 20, { over: () => descT.setText(SKILL_DESC[s]) }); });
    L.text(x + 400, y + 26, 'PROGRESS', COL.orange); [['LEVEL', c.lvl], ['EXPERIENCE', c.xp], ['NEXT LEVEL', R.xpForLevel(c.lvl)], ['ALIENS KILLED', `${G.kills}/${QUOTA}`], ['TIME', clock(G.time)]].forEach(([n, v], i) => { L.text(x + 400, y + 42 + i * 14, n, COL.dim); L.text(x + 566, y + 42 + i * 14, String(v), COL.text, [1, 0]); });
    L.bevel(x + 200, y + 220, 366, 64, { inset: true, face: 0x08100a }); const descT = L.paragraph(x + 208, y + 226, 350, 52, c.skillPts ? 'LEVEL UP! SPEND SKILL POINTS WITH [+].' : 'HOVER A STAT FOR DETAILS.', COL.green);
  }
  nokia() {
    const ctx = this.ctx, G = ctx.G; this.stack.find((o) => o.name === 'nokia')?.close(); const o = this.overlay('nokia', 480, 330, 'NOKIA 3310 - QUEST LOG'), L = o.L, { x, y } = o; let ry = y + 28;
    L.bevel(x + 8, y + 22, 464, 276, { inset: true, face: 0x142210 });
    L.text(x + 14, ry, `${clock(G.time)}    SIGNAL: NONE    BATTERY: 3 DAYS`, COL.green); ry += 18;
    for (const [id, Q] of Object.entries(QUESTS)) { const n = G.quests[id] ?? 0; if (!n) continue; const last = Math.max(...Object.keys(Q.steps).map(Number)); const done = n >= last && id !== 'kill';
      L.text(x + 14, ry, `${done ? '[X]' : '[ ]'} ${Q.title.toUpperCase()}`, done ? COL.dim : COL.amber); ry += 11; const txt = id === 'kill' ? `ALIENS KILLED: ${G.kills}/${QUOTA}. THE HIVE FALLS WHEN YOU KILL ENOUGH.` : Q.steps[n]; wrap(txt, 66).forEach((l) => { L.text(x + 30, ry, l, done ? COL.dim : COL.text); ry += 10; }); ry += 6; }
    L.text(x + 14, y + 304, 'SNAKE II HI-SCORE: 1337 (PENA CHEATED)', COL.dim);
  }
  options() {
    const ctx = this.ctx; this.stack.find((o) => o.name === 'options')?.close(); const o = this.overlay('options', 330, 300, 'OPTIONS'), L = o.L, { x, y } = o, au = ctx.game.audio;
    const mb = L.btn(x + 20, y + 28, 290, 24, `CONTROLS: ${ctx.mode.toUpperCase()}  (F10)`, () => { ctx.setMode(ctx.mode === 'classic' ? 'modern' : 'classic'); o.close(); this.options(); });
    wrap(ctx.mode === 'classic' ? 'CLICK MOVE - RMB CURSOR - SPACE END TURN - ENTER END COMBAT - B WEAPON MODE' : 'WASD MOVE - MOUSE AIM - LMB SHOOT - RMB AIM - SPACE DODGE - SHIFT SPRINT - E USE - Q HEAL - 1-4 WEAPONS', 48).forEach((line, i) => L.text(x + 20, y + 60 + i * 10, line, COL.dim)); void mb;
    L.btn(x + 20, y + 100, 140, 22, 'SAVE (F5)', () => { ctx.save(); o.close(); }); L.btn(x + 170, y + 100, 140, 22, 'LOAD (F9)', () => { o.close(); ctx.load(); });
    const vol = (bus, lbl, yy) => { L.text(x + 20, y + yy + 5, `${lbl} ${Math.round(au.volume(bus) * 100)}%`, COL.text); L.btn(x + 200, y + yy, 50, 18, '-', () => { au.volume(bus, au.volume(bus) - 0.1); o.close(); this.options(); }); L.btn(x + 260, y + yy, 50, 18, '+', () => { au.volume(bus, au.volume(bus) + 0.1); o.close(); this.options(); }); };
    vol('sfx', 'SOUND FX', 140); vol('music', 'MUSIC', 166);
    L.btn(x + 20, y + 196, 290, 22, 'KEYS: I INV  C CHAR  P NOKIA  TAB MAP', () => {}); L.btn(x + 20, y + 224, 290, 22, 'QUIT TO TITLE', () => { o.close(); this.title(); }, { color: COL.red }); L.btn(x + 20, y + 252, 290, 22, 'RESUME', () => o.close(), { color: COL.green });
  }
  // ===================================================================== dialogue
  dialog(npcId) {
    const ctx = this.ctx, G = ctx.G, F = G.flags, N = NPCS[npcId]; if (!N || ctx.area?.combat) return;
    // delivery logic for quest NPCs
    if (npcId === 'rane') { if (ctx.count('dice') && !F.dice_given) { ctx.take('dice', 1); F.dice_given = 1; ctx.setQuest('dice', 3); } if (ctx.count('plug') && !F.plug_given) { ctx.take('plug', 1); F.plug_given = 1; ctx.setQuest('plug', 3); } if (F.dice_given && F.plug_given && !F.moped_ready) { F.moped_ready = 1; ctx.setQuest('main', 3); } }
    if (npcId === 'seppo' && ctx.count('key') && F.plug_active && !F.plug_has) { this.runNode('seppo', 'seppo_key_ok'); return; }
    let node = N.start.find(([f]) => f === null || ctx.cond(f))[1]; this.runNode(npcId, node);
  }
  runNode(npcId, id) {
    const ctx = this.ctx, G = ctx.G, N = NPCS[npcId], nd = DIALOG[id]; this.stack.find((o) => o.name === 'dialog')?.destroy(); const prev = this.stack.findIndex((o) => o.name === 'dialog'); if (prev >= 0) { this.stack.splice(prev, 1); ctx.modal--; }
    const o = this.overlay('dialog', 600, 300, N.name.toUpperCase()), L = o.L, { x, y } = o; (nd.act ?? []).forEach((a) => this.act(a, npcId));
    L.bevel(x + 10, y + 24, 74, 90, { inset: true, face: 0x0a1410 }); L.img(ctx.K.portraits, Math.max(0, rows.indexOf(N.row)), x + 15, y + 29, 1);
    L.text(x + 47, y + 99, 'SIGNAL: LOCAL', COL.green, [0.5, 0]);
    L.bevel(x + 88, y + 24, 502, 90, { inset: true, face: 0x101a10 });
    L.bevel(x + 10, y + 120, 580, 150, { inset: true, face: 0x0a140c });
    let ty = y + 28; for (const para of nd.say) { for (const l of wrap(para.replace(/"/g, ''), 76)) { L.text(x + 92, ty, l, para.startsWith('"') ? COL.text : COL.green); ty += 10; } ty += 5; }
    let oy = Math.max(ty + 6, y + 126); const after = [];
    for (const op of nd.opts) {
      if ((op.if && !op.if.every((f) => ctx.cond(f))) || (op.not && op.not.some((f) => ctx.cond(f)))) continue;
      const lines = wrap(`> ${op.t}`, 84), yy = oy; const t = lines.map((l, i) => L.text(x + 14, yy + i * 10, l, COL.orange)); const h = lines.length * 10 + 3; oy += h + 3;
      L.zone(x + 10, yy - 1, 580, h, { over: () => t.forEach((q, i) => q.setText(lines[i], COL.white)), out: () => t.forEach((q, i) => q.setText(lines[i], COL.orange)), down: () => {
        ctx.sfx('click', 0.4); let go = op.go; (op.act ?? []).forEach((a) => { if (a.startsWith('minigame') || a.startsWith('ending') || a === 'hostile') after.push(a); else this.act(a, npcId); });
        if (op.skill) { const ok = R.canSkill(G.char, op.skill[0], op.skill[1]); ctx.area?.say(`[${op.skill[0].toUpperCase()} check ${ok ? 'passed' : 'FAILED'}]`, ok ? COL.green : COL.red); go = ok ? op.go : op.fail; }
        o.close(); if (go) this.runNode(npcId, go); for (const a of after) this.act(a, npcId); } });
    }
  }
  act(str, npcId) {
    const ctx = this.ctx, G = ctx.G, [cmd, a, b] = str.split(' ');
    if (cmd === 'flag') G.flags[a] = 1; else if (cmd === 'give') { ctx.give(a, Number(b ?? 1)); ctx.area?.say(`You receive ${b > 1 ? b + ' ' : ''}${ITEMS[a].name}.`, COL.amber); ctx.sfx('pickup', 0.5); } else if (cmd === 'take') ctx.take(a, Number(b ?? 1));
    else if (cmd === 'xp') { const up = R.addXp(G.char, Number(a)); ctx.area?.say(`You gain ${a} experience points.`, COL.amber); if (up) ctx.area?.say(`You have reached level ${G.char.lvl}!`, COL.amber); } else if (cmd === 'quest') ctx.setQuest(a, Number(b));
    else if (cmd === 'hostile') ctx.area?.makeHostile?.(npcId); else if (cmd === 'minigame') this.wallGame(); else if (cmd === 'ending') ctx.endGame(a);
  }
  // ===================================================================== wall-kicking minigame
  wallGame() {
    const ctx = this.ctx, G = ctx.G; this.stack.find((o) => o.name === 'wall')?.close(); const o = this.overlay('wall', 420, 270, 'SEINANPOTKIMISEN MM (WALL KICKING WORLD CHAMPIONSHIP)'), L = o.L, { x, y } = o;
    L.bevel(x + 20, y + 116, 380, 104, { inset: true, face: 0x282f23 }); for (let i = 0; i < 12; i++) L.img(ctx.K.walls, ctx.fr.walls.conc12, x + 36 + i * 31, y + 214, 1, [0.5, 1]); const hero = L.img(ctx.K.actors, 4, x + 70, y + 214, 3, [0.5, 1]);
    L.text(x + 210, y + 28, 'PRESS [SPACE] WHEN THE MARKER IS IN THE GREEN ZONE', COL.amber, [0.5, 0]); L.text(x + 210, y + 42, '3 GOOD KICKS WITHIN 6 TRIES BEATS THE RECORD', COL.dim, [0.5, 0]);
    L.rect(x + 20, y + 62, 380, 20, 0x08100a); const zw = 60, zx = x + 20 + 160, zone = L.rect(zx, y + 62, zw, 20, 0x2a9a44), mark = L.rect(x + 20, y + 58, 4, 28, 0xffffff), res = L.text(x + 210, y + 92, 'KICKS 0/3   TRIES 0/6', COL.green, [0.5, 0]);
    let m = 0, dir = 1, kicks = 0, tries = 0, over = false; void zone;
    const kick = () => { if (over) return; tries++; const mx = x + 20 + m * 376, ok = mx >= zx - 4 && mx <= zx + zw; hero.setFrame(4); ctx.sfx('wallkick', 0.7, ok ? 1 : 0.8); if (ok) { kicks++; this.shake(L); } res.setText(`KICKS ${kicks}/3   TRIES ${tries}/6   ${ok ? 'ASIAA!' : 'OUCH.'}`, ok ? COL.green : COL.red);
      if (kicks >= 3) { over = true; this.screenKey = null; res.setText('RECORD BROKEN! ASIAA! HEI TERO!', COL.amber); G.flags.wall_done = 1; ctx.give('tracksuit', 1); G.char.sk.unarmed += 5; ctx.area?.say('Mottonen gives you his tracksuit. +5 Unarmed.', COL.amber); ctx.setQuest('wall', 2); ctx.sfx('win', 0.7); }
      else if (tries >= 6) { over = true; res.setText('YOU MISSED THE RECORD. SAKU LAUGHS.', COL.red); G.flags.wall_active = 1; } };
    L.btn(x + 160, y + 236, 100, 22, 'KICK!', kick, { color: COL.green }); this.screenKey = (e) => { if (e.code === 'Space') { kick(); return true; } return false; };
    this.tick = (dt) => { if (over) return; m += dir * dt * (0.8 + kicks * 0.25 + tries * 0.05); if (m > 1) { m = 1; dir = -1; } if (m < 0) { m = 0; dir = 1; } mark.setPosition(x + 20 + m * 376, y + 58); };
    const oc = o.close; o.close = () => { this.screenKey = null; this.tick = null; oc(); };
  }
  shake(L) { this.ctx.ps.cameras.main.shake(120, 0.004); }
  // ===================================================================== ending
  ending(kind) {
    const ctx = this.ctx, G = ctx.G; const stats = `LEVEL ${G.char.lvl}   ALIENS KILLED ${G.kills}   ${clock(G.time)}`; this.clear(); const L = this.layer(); this.base.push(L); ctx.sfx(kind === 'death' ? 'lose' : 'win', 0.7); ctx.music('title');
    L.img(ctx.K.title, null, 0, 0, 1, [0, 0], 0); L.rect(0, 0, 640, 480, kind === 'death' ? 0x1a0606 : 0x06100a, 0.88); L.panel(18, 34, 604, 348, kind === 'death' ? 'SURVIVOR RECORD / SIGNAL LOST' : 'KERAVA / FINAL TRANSMISSION'); L.bevel(28, 56, 584, 312, { inset: true, face: 0x0a140c }); let i = 0, ch = 0; const lines = [...ENDINGS[kind]]; if (kind === 'escape' && !G.flags.moped_ready) lines[0] = 'You walk into Klaukkala, sausage in hand, aliens at your back.';
    const out = []; this.tick = (dt) => { if (i >= lines.length) return; this.tk = (this.tk ?? 0) + dt; if (this.tk > 0.025) { this.tk = 0; ch++; if (!out[i]) out[i] = L.text(320, 80 + i * 46, '', i === lines.length - 1 ? COL.amber : COL.green, [0.5, 0], 5, i === lines.length - 1 ? 2 : 1); out[i].setText(ascii(lines[i].slice(0, ch))); if (ch >= lines[i].length) { i++; ch = 0; this.tk = -0.5; } } };
    L.text(320, 400, stats, COL.dim, [0.5, 0]); L.btn(220, 424, 200, 26, 'BACK TO TITLE', () => this.title()); if (kind !== 'death') L.btn(220, 454, 200, 20, 'KEEP PLAYING (RETURN TO MAP)', () => { G.flags.quota_hit = 1; this.world(); }, { color: COL.dim });
    if (kind === 'death') { L.btn(220, 454, 200, 20, 'LOAD LAST SAVE', () => ctx.load(), { color: COL.dim }); }
  }
}
