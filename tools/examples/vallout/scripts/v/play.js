// Area view: isometric rendering, entities, camera, effects, loot/use, shared helpers. Control modes are added by classic.js / modern.js.
import { generate } from './mapgen.js';
import { ENEMIES, ITEMS, NPCS, QUOTA } from './data.js';
import { derived, heldWeapon, modeOf, rnd, addXp, rand } from './rules.js';
import { findPath, line } from './path.js';
import { COL } from './ui.js';
import { BAR_Y } from './hud.js';

export const TW = 16, TH = 8;                       // half tile size (tile is 32x16)
const FR = ['stand_f', 'walkA_f', 'walkB_f', 'shoot_f', 'kick_f', 'stand_b', 'walkA_b', 'walkB_b', 'shoot_b', 'kick_b', 'dead'];
const SIGNS = ['KERAVA - POPULATION: UNKNOWN', 'KLAUKKALA 25 KM. SAFE ZONE (maybe)', 'VR: JUNA MYOHASSA. PALJON.', 'AHJO: JAAHALLI AVOINNA. ALIENS ALSO.'];

export class Area {
  constructor(ctx, locId, loc, opts = {}) {
    this.ctx = ctx; this.locId = locId; this.loc = loc; this.opts = opts; this.G = ctx.G; this.ps = ctx.ps;
    this.map = generate(loc, locId, { enemyScale: opts.enemyScale ?? 1 });
    this.ents = []; this.sprites = []; this.fxs = []; this.projectiles = []; this.combat = null; this.busy = false; this.moveToken = 0; this.keys = {}; this.alive = true; this.t = 0;
    this.OX = this.map.h * TW + 16; this.OY = 40; this.cursorMode = 'move';
  }
  // ---- coordinate helpers ----------------------------------------------------------------------------------------------
  sx(x, y) { return (x - y) * TW + this.OX; } sy(x, y) { return (x + y) * TH + this.OY; }
  toTile(wx, wy) { const a = (wx - this.OX) / TW, b = (wy - this.OY) / TH; return { x: (a + b) / 2, y: (b - a) / 2 }; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h; }
  tile(e) { return { x: Math.round(e.x), y: Math.round(e.y) }; }
  blockedTile(x, y) { return !this.inb(x, y) || this.map.blocked(x, y) || this.dynBlock?.has(y * 100 + x); }
  entAt(x, y, skip) { return this.ents.find((e) => !e.dead && e !== skip && Math.round(e.x) === x && Math.round(e.y) === y); }
  isBlocked(x, y, skip) { return this.blockedTile(x, y) || !!this.entAt(x, y, skip); }
  propAt(x, y) { return this.map.props.find((p) => p.x === x && p.y === y); }
  dist(a, b) { return Math.max(Math.abs(Math.round(a.x) - Math.round(b.x)), Math.abs(Math.round(a.y) - Math.round(b.y))); }
  los(a, b) { return line({ x: Math.round(a.x), y: Math.round(a.y) }, { x: Math.round(b.x), y: Math.round(b.y) }, (x, y) => this.map.walls.some((w) => w.x === x && w.y === y && w.s && !w.s.includes('ruin') && w.s !== 'conc12'), (x, y) => { const o = this.entAt(x, y, a); return !!o && o !== b; }); }
  path(a, b, adjacent = false, max = 200) {
    const sa = this.tile(a), sb = { x: Math.round(b.x), y: Math.round(b.y) };
    return findPath(this.map.w, this.map.h, (x, y) => this.blockedTile(x, y) || (!!this.entAt(x, y, a) && !(x === sb.x && y === sb.y)), sa, sb, max, adjacent);
  }

  // ---- build ------------------------------------------------------------------------------------------------------------
  async build() {
    const { ps, ctx } = this, K = ctx.K, m = this.map, GI = ctx.fr.ground, WI = ctx.fr.walls, PI = ctx.fr.props;
    this.cam = ps.cameras.main; this.cam.setViewport(0, 0, 640, 480).setBackgroundColor('#050403');
    const area = (this.G.areas[this.locId] ??= { dead: [], looted: [] });
    m.ground.forEach((row, y) => row.forEach((g, x) => this.add(ps.add.image(this.sx(x, y), this.sy(x, y), K.ground, GI[g]).setDepth(-5000))));
    for (const w of m.walls) if (w.s) this.add(ps.add.image(this.sx(w.x, w.y), this.sy(w.x, w.y) + TH, K.walls, WI[w.s]).setOrigin(0.5, 1).setDepth((w.x + w.y) * 10 + 5));
    for (const p of m.props) {
      const s = ps.add.image(this.sx(p.x, p.y), this.sy(p.x, p.y) + 6, K.props, PI[p.p + (p.flip && (p.p === 'car_se' || p.p === 'car_sw' || p.p === 'car2_se' || p.p === 'car2_sw') ? '' : '')]).setOrigin(0.5, 1).setDepth((p.x + p.y) * 10 + 4);
      if (p.p === 'ufo_big') { s.setY(s.y - 34).setDepth(8000); this.tweenBob(s); }
      if (p.flip && !['car_se', 'car_sw', 'car2_se', 'car2_sw', 'ufo_big'].includes(p.p)) s.setFlipX(true);
      if (p.p === 'barrel_a') this.barrels = [...(this.barrels ?? []), s];
      if (p.id && area.looted.includes(p.id)) s.setTint(0x777777);
      p.sprite = s; this.add(s);
    }
    for (const o of m.objects) if (o.kind === 'exit') { const s = this.add(ps.add.image(this.sx(o.x, o.y), this.sy(o.x, o.y) + 5, K.props, PI.exit).setOrigin(0.5, 1).setDepth(-4000)); this.tweenBob(s, 3); }
    this.hover = this.add(ps.add.graphics().setDepth(-3000)); this.pathG = this.add(ps.add.graphics().setDepth(-2900));
    this.player = this.mkEnt('player', 'tero', { name: 'Tero', x: m.start.x, y: m.start.y, row: 'tero' });
    for (const n of m.npcs) this.mkEnt('npc', n.id, { name: NPCS[n.id].name, x: n.x, y: n.y, row: NPCS[n.id].row, npc: n.id });
    for (const e of m.enemies) { if (area.dead.includes(e.id)) continue; const d = ENEMIES[e.type]; this.mkEnt('enemy', e.type, { name: d.name, x: e.x, y: e.y, row: d.row, def: d, hp: d.hp, maxhp: d.hp, ap: d.ap, id: e.id }); }
    if (this.opts.enemyList) { /* encounters spawn through map.enemies */ }
    this.hudRefresh(); this.centerCam(true);
    // ambient
    this.every(0.4, () => { this.barrels?.forEach((b, i) => b.setFrame(PI[(Math.floor(this.t * 2.5) + i) % 2 ? 'barrel_a' : 'barrel_b'])); });
    this.say(`You arrive at ${this.loc.name}.`, COL.amber);
    if (this.locId === 'asema' && !this.G.flags.intro_tip) { this.G.flags.intro_tip = 1; this.say('Left click: walk. Right click: switch cursor. [I] inventory, [C] character, [P] Nokia, [F10] control mode.', COL.dim); }
  }
  add(o) { this.sprites.push(o); return o; }
  every(sec, fn) { const ev = this.ps.time.addEvent({ delay: sec * 1000, loop: true, callback: fn }); this.sprites.push({ destroy: () => ev.remove() }); }
  tweenBob(s, amp = 4) { this.ps.tweens.add({ targets: s, y: s.y - amp, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); }
  mkEnt(kind, type, o) {
    const big = o.def?.big, ctx = this.ctx;
    const e = { kind, type, id: o.id ?? type, name: o.name, x: o.x, y: o.y, row: o.row, def: o.def, ...(kind === 'player' ? {} : { hp: o.hp ?? 1, ap: o.ap ?? 0 }), maxhp: o.maxhp ?? 1, npc: o.npc, dead: false, awake: false, pose: 'stand', front: true, flip: false, big, speed: o.def?.speed ?? 2.5, cd: 0, anim: 0 };
    const key = big ? ctx.K.boss : ctx.K.actors, fi = this.frameIdx(e);
    e.sprite = this.add(this.ps.add.image(0, 0, key, fi).setOrigin(0.5, big ? 1 : 31 / 32));
    if (e.row === 'gull') e.fly = true;
    if (kind === 'player') { const G = this.G; Object.defineProperty(e, 'ap', { get: () => G.char.ap ?? 0, set: (v) => { G.char.ap = v; } }); Object.defineProperty(e, 'hp', { get: () => G.char.hp, set: (v) => { G.char.hp = v; } }); }
    this.ents.push(e); this.place(e); return e;
  }
  frameIdx(e) { const rows = this.ctx.meta.actors.rows, c = e.dead ? 10 : FR.indexOf(`${e.pose}_${e.front ? 'f' : 'b'}`); return e.big ? c : rows.indexOf(e.row) * 11 + c; }
  place(e) {
    const sx = this.sx(e.x, e.y), sy = this.sy(e.x, e.y) + (e.big ? 12 : 5) - (e.fly && !e.dead ? 12 + Math.sin(this.t * 8 + e.x) * 2 : 0);
    e.sprite.setPosition(sx, sy).setDepth(e.dead ? (e.x + e.y) * 10 + 2 : (e.x + e.y) * 10 + 6).setFlipX(e.flip).setFrame(this.frameIdx(e));
  }
  face(e, dx, dy) { const sxv = dx - dy, syv = dx + dy; if (!sxv && !syv) return; e.front = syv >= 0; if (sxv) e.flip = sxv < 0; }
  faceTo(e, t) { this.face(e, t.x - e.x, t.y - e.y); }

  // ---- camera / frame ---------------------------------------------------------------------------------------------------
  centerCam(snap = false) {
    const p = this.camTarget ?? this.player, tx = this.sx(p.x, p.y) - 320, ty = this.sy(p.x, p.y) - (BAR_Y / 2 + 10), c = this.cam;
    const f = snap ? 1 : 0.18; c.setScroll(Math.round(c.scrollX + (tx - c.scrollX) * f), Math.round(c.scrollY + (ty - c.scrollY) * f));
  }
  update(dt) {
    if (!this.alive) return; this.t += dt;
    for (const e of this.ents) { if (e.kind !== 'player' || this.ctx.mode === 'classic') this.place(e); }
    if (this.ctx.mode === 'modern') this.updateModern(dt); else this.updateClassic(dt);
    for (const e of this.ents) this.place(e);
    this.centerCam(); this.updateCursor?.();
  }
  hudRefresh() { const mx = derived(this.G.char.S).ap; this.ctx.hud?.refresh(this.ctx.mode === 'classic' ? (this.combat ? this.player.ap : mx) : Math.round(this.stamina ?? 10), this.ctx.mode === 'classic' ? mx : 10); this.ctx.hud?.log(); }
  say(t, c = COL.green) { this.G.log.push({ t, c }); if (this.G.log.length > 80) this.G.log.shift(); this.ctx.hud?.log(); }

  // ---- floating text & fx -----------------------------------------------------------------------------------------------
  float(e, str, color = COL.white, dy = 0) {
    const t = this.ctx.makeText(this.sx(e.x, e.y), this.sy(e.x, e.y) - 34 - dy, str, color, 9000); (this.floats ??= new Set()).add(t); this.ps.tweens.add({ targets: t.img, y: t.img.y - 16, alpha: 0, duration: 900, onComplete: () => { this.floats.delete(t); t.destroy(); } });
  }
  fx(name, x, y, { scale = 1, dur = 160, rot = 0 } = {}) {
    const s = this.ps.add.image(this.sx(x, y), this.sy(x, y) - 14, this.ctx.K.fx, this.ctx.fr.fx[name]).setDepth(8999).setScale(scale).setRotation(rot);
    this.ps.tweens.add({ targets: s, alpha: 0, scale: scale * 1.3, duration: dur, onComplete: () => s.destroy() }); return s;
  }
  flash(e) { e.sprite.setTint(0xff6a5a); this.ps.time.delayedCall(110, () => e.sprite.clearTint()); }
  wait(ms) { return new Promise((r) => this.ps.time.delayedCall(Math.max(1, ms), r)); }
  tw(cfg) { return new Promise((r) => this.ps.tweens.add({ ...cfg, onComplete: r })); }

  // ---- damage / death ---------------------------------------------------------------------------------------------------
  hurt(e, dmg, by) {
    const ctx = this.ctx; if (e.dead || dmg <= 0) return;
    e.hp -= dmg; this.flash(e); this.fx(e.kind === 'player' || !e.def?.alien ? 'blood' : 'goo', e.x, e.y); this.float(e, `-${dmg}`, e.kind === 'player' ? COL.red : COL.white);
    if (e.kind === 'player') { this.G.char.hp = Math.max(0, e.hp); ctx.sfx('hurt', 0.6); this.hudRefresh(); if (e.hp <= 0) this.killPlayer(); }
    else { ctx.sfx(e.def?.alien ? 'hit_goo' : 'hit', 0.6); e.awake = true; if (e.hp <= 0) this.killEnemy(e, by); }
  }
  killEnemy(e, by) {
    if (e.dead) return; e.dead = true; e.pose = 'stand'; const d = e.def, G = this.G, c = G.char, ctx = this.ctx;
    ctx.sfx(d.alien ? 'die_alien' : e.row === 'gull' ? 'gull' : 'die_human', 0.7); this.fx(d.gore, e.x, e.y, { scale: 1.6, dur: 400 });
    this.say(`The ${d.name} dies.`, COL.green); G.areas[this.locId].dead.push(e.id);
    if (by === 'player' || by === undefined) { const up = addXp(c, d.xp); this.say(`You gain ${d.xp} experience points.`, COL.amber); if (up) { ctx.sfx('levelup', 0.8); this.say(`You have reached level ${c.lvl}! Open SKILL to spend points.`, COL.amber); this.float(this.player, 'LEVEL UP!', COL.amber, 10); } }
    if (d.alien && this.locId === 'kuopat' && G.quests.ncr === 1) { G.flags.ncr_kills = (G.flags.ncr_kills ?? 0) + 1; if (G.flags.ncr_kills >= 4) { G.flags.ncr_ready = 1; ctx.setQuest('ncr', 2); } }
    if (d.alien) { G.kills++; if (G.kills === 1) this.say('Aliens down. Quest log: Pest Control.', COL.dim); this.ctx.G.quests.kill = 1; }
    // loot
    const items = []; for (const [id, q] of d.loot ?? []) { if (q >= 1) items.push([id, rnd(Math.max(1, q - 1), q + 1)]); else if (rand() < q) items.push([id, 1]); }
    if (items.length) { const o = this.map.props.find((p) => p.x === Math.round(e.x) && p.y === Math.round(e.y)); void o; this.map.props.push({ x: Math.round(e.x), y: Math.round(e.y), p: 'loot', solid: false, loot: items, id: `loot${e.id}`, name: `${d.name} loot`, sprite: this.add(this.ps.add.image(this.sx(e.x, e.y), this.sy(e.x, e.y) + 6, ctx.K.props, ctx.fr.props.loot).setOrigin(0.5, 1).setDepth((e.x + e.y) * 10 + 3)) }); }
    if (e.type === 'boss') { G.flags.hive_cleared = 1; if (G.quests.main < 4) { G.quests.main = 4; } this.say('THE OVERMIND DIES. The road to Klaukkala is open!', COL.amber); ctx.sfx('win', 0.8); addXp(c, QUOTA); }
    if (G.kills >= QUOTA && !G.flags.quota_hit) { G.flags.quota_hit = 1; this.say(`${QUOTA} aliens down! The hive trembles...`, COL.amber); this.ps.time.delayedCall(1800, () => ctx.endGame('victory')); }
    this.hudRefresh();
  }
  killPlayer() { if (this.player.dead) return; this.player.dead = true; this.player.pose = 'stand'; this.say('You are dead.', COL.red); this.ctx.sfx('lose', 0.8); this.combatToken = -1; this.ps.time.delayedCall(1400, () => this.ctx.endGame('death')); }

  // ---- looting / using objects ------------------------------------------------------------------------------------------
  giveItems(list, msgHead = 'You find') {
    const names = []; for (const [id, n] of list) { this.ctx.give(id, n); names.push(`${n > 1 ? n + ' ' : ''}${ITEMS[id].name}`); }
    this.say(`${msgHead}: ${names.join(', ')}.`, COL.amber); this.ctx.sfx('pickup', 0.6);
  }
  openProp(p) {
    const area = this.G.areas[this.locId];
    if (p.p === 'loot') { this.giveItems(p.loot, 'You take'); p.sprite?.destroy(); this.map.props = this.map.props.filter((q) => q !== p); return; }
    if (p.loot) { if (area.looted.includes(p.id)) { this.say('Nothing left here.', COL.dim); return; } area.looted.push(p.id); p.sprite?.setTint(0x777777); this.ctx.sfx('open', 0.6);
      if (p.lootMsg) this.say(p.lootMsg, COL.amber); this.giveItems(p.loot);
      if (p.id === 'volvo') { this.G.flags.dice_has = 1; if ((this.G.quests.dice ?? 0) < 2) this.G.quests.dice = 2; } return; }
    if (p.rane) { this.ctx.openDialog('rane'); return; }
    if (p.p === 'sign') { this.say(`Sign: ${SIGNS[(p.x + p.y) % SIGNS.length]}`, COL.dim); return; }
    this.say(`You see: ${p.name ?? p.p}.`, COL.dim);
  }
  makeHostile(npcId) {
    const e = this.ents.find((x) => x.npc === npcId); if (!e) return; const d = ENEMIES.brawler;
    Object.assign(e, { kind: 'enemy', type: 'brawler', def: d, hp: d.hp, maxhp: d.hp, ap: d.ap, awake: true, id: `b_${npcId}`, name: 'Angry Drunk', speed: d.speed }); this.say('The drunk takes a swing at you!', COL.red); if (this.ctx.mode === 'classic') this.startCombat();
  }
  describe(e) {
    if (!e) return this.say('You see nothing special.', COL.dim);
    if (e.kind === 'enemy') return this.say(`You see ${e.name}. ${e.def.desc} (${e.hp}/${e.maxhp} HP)`, COL.dim);
    if (e.kind === 'npc') return this.say(`You see ${e.name}. ${{ pena: 'Pena. He looks 70% Kossu.', saku: 'Saku. Cheap tracksuit. Heavy attitude.', mottonen: 'Mottonen. He is kicking a wall.', rane: 'Rane. Sunglasses. Leather. Absolute legend.', seppo: 'Seppo. Kiosk guy. Possibly asleep.', kalle: 'Kalle. Drunk. Standing is optional.', sgt: 'Sgt. Hakkarainen. Moustache regulation.', capt: 'Captain Lehtonen, Uusimaa Republic Rangers. Clipboard drawn.', ranger: 'A Uusimaa Republic Ranger. Blue, yellow, bureaucratic.' }[e.npc] ?? ''}`, COL.dim);
    this.say(`You see ${e.name ?? e.p}.`, COL.dim);
  }
  destroy() {
    this.alive = false; this.combatToken = -1; this.floats?.forEach((t) => t.destroy()); this.floats?.clear(); for (const o of this.sprites) o?.destroy?.(); for (const p of this.projectiles) p.sprite?.destroy(); this.sprites = []; this.ps.tweens.killAll(); this.ps.time.removeAllEvents();
    this.ctx.unbindArea?.(this); this.ctx.G.char.hp = Math.max(1, this.G.char.hp);
  }
}
