// CLASSIC mode: Fallout-2 controls — click to walk, right-click cycles cursor (move / command / look), turn-based combat with
// Action Points, sequence order, hit chances shown on hover, aimed shots, AC bonus from unspent AP, enemy turns with AI.
import { Area } from './play.js';
import { ITEMS, ENEMIES, BARKS } from './data.js';
import * as R from './rules.js';
import { COL } from './ui.js';
import { BAR_Y } from './hud.js';

const CUR = { move: 0, cmd: 1, look: 2, attack: 3, wait: 4 };
Object.assign(Area.prototype, {
  bindInput() {
    const ps = this.ps; this.onMove = (p) => this.pointerMove(p); this.onDown = (p) => this.pointerDown(p);
    ps.input.on('pointermove', this.onMove); ps.input.on('pointerdown', this.onDown); ps.input.mouse?.disableContextMenu?.();
  },
  unbindInput() { this.ps.input.off('pointermove', this.onMove); this.ps.input.off('pointerdown', this.onDown); },
  wpn() { const c = this.G.char, w = R.heldWeapon(c); return { w, mode: R.modeOf(w, this.G.modeIdx) }; },
  cycleMode() { const w = R.heldWeapon(this.G.char); this.G.modeIdx = ((this.G.modeIdx ?? 0) + 1) % w.modes.length; this.ctx.sfx('click', 0.4); this.ctx.hud.refresh(); this.pointerMove(this.ps.input.activePointer); },
  pointerWorld(p) { return { wx: p.worldX, wy: p.worldY }; },
  /** entity or prop under the pointer (sprite-box test, front-most first), else null */
  pick(wx, wy) {
    const list = this.ents.filter((e) => e.kind !== 'player' || false).sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const e of list) { const sx = this.sx(e.x, e.y), sy = this.sy(e.x, e.y) + 5, w = e.big ? 24 : 9, h = e.big ? 60 : 28; if (e.dead) { if (Math.abs(wx - sx) < 10 && wy > sy - 8 && wy < sy + 3) return e; continue; } if (Math.abs(wx - sx) <= w && wy >= sy - h && wy <= sy + 3) return e; }
    const t = this.toTile(wx, wy), tx = Math.round(t.x), ty = Math.round(t.y);
    const prop = this.map.props.filter((p) => p.name || p.p === 'sign' || p.p === 'moped' || p.p === 'kiosk').find((p) => Math.abs(p.x - t.x) < 0.9 && Math.abs(p.y - t.y) < 0.9);
    if (prop) return { kind: 'prop', p: prop, x: prop.x, y: prop.y };
    const lootProp = this.map.props.find((p) => p.p === 'loot' && p.x === tx && p.y === ty); if (lootProp) return { kind: 'prop', p: lootProp, x: tx, y: ty };
    const kw = this.map.objects.find((o) => o.kind === 'kickwall' && Math.abs(o.x - t.x) < 1.3 && Math.abs(o.y - t.y) < 0.9); if (kw) return { kind: 'kickwall', x: kw.x, y: kw.y };
    return { kind: 'tile', x: tx, y: ty };
  },
  pointerMove(p) {
    if (this.ctx.mode !== 'classic' || !this.alive) return;
    const ctx = this.ctx; if (ctx.modal || p.y >= BAR_Y) { this.hover.clear(); this.pathG.clear(); ctx.setHint(''); return; }
    const t = this.pick(p.worldX, p.worldY); this.hoverT = t; this.hover.clear(); this.pathG.clear(); ctx.setHint('');
    const col = t.kind === 'enemy' ? 0xff4a3a : t.kind === 'npc' ? 0x4ad8ff : 0x7bff7b;
    const tile = this.toTile(p.worldX, p.worldY), tx = Math.round(tile.x), ty = Math.round(tile.y);
    if (!this.inb(tx, ty)) return;
    this.diamond(this.hover, t.kind === 'enemy' || t.kind === 'npc' ? Math.round(t.x) : tx, t.kind === 'enemy' || t.kind === 'npc' ? Math.round(t.y) : ty, col);
    const { w, mode } = this.wpn();
    if (t.kind === 'enemy' && !t.dead) {
      const d = this.dist(this.player, t), rng = mode.kind === 'ranged' ? w.range : 1;
      const chance = R.toHit(this.G.char, { def: t.def }, w, mode, d, { lof: this.los(this.player, t).crowd });
      ctx.setHint(`${t.name.toUpperCase()}  ${d > rng ? 'RANGE' : chance + '%'}`, d > rng ? COL.dim : COL.amber);
    } else if (t.kind === 'npc') ctx.setHint(t.name.toUpperCase(), COL.cyan);
    else if (t.kind === 'prop') ctx.setHint((t.p.name ?? t.p.p).toUpperCase(), COL.cyan);
    else if (t.kind === 'kickwall') ctx.setHint('WALL (KICK IT)', COL.cyan);
    else if (this.cursorMode === 'move' && !this.busy && (!this.combat || this.playerTurnOn)) {
      const path = this.path(this.player, { x: tx, y: ty });
      if (path && path.length) { this.pathG.fillStyle(0x7bff7b, 0.7); for (const s of path) this.pathG.fillRect(this.sx(s.x, s.y) - 1, this.sy(s.x, s.y) - 1, 3, 2); if (this.combat) ctx.setHint(`${path.length} AP`, path.length > this.player.ap ? COL.red : COL.green); }
    }
  },
  diamond(g, x, y, color) { const sx = this.sx(x, y), sy = this.sy(x, y); g.lineStyle(1, color, 1).strokePoints([{ x: sx, y: sy - 8 }, { x: sx + 16, y: sy }, { x: sx, y: sy + 8 }, { x: sx - 16, y: sy }], true); },
  updateCursor() {
    const ctx = this.ctx, p = this.ps.input.activePointer; let f = CUR[this.cursorMode];
    if (ctx.modal || p.y >= BAR_Y) f = CUR.move; else if (this.hoverT?.kind === 'enemy' && !this.hoverT.dead && this.cursorMode !== 'look') f = CUR.attack; else if (this.busy || (this.combat && !this.playerTurnOn)) f = CUR.wait;
    ctx.setCursor(f);
  },
  pointerDown(p) {
    const ctx = this.ctx; if (ctx.mode !== 'classic' || !this.alive || ctx.modal || p.y >= BAR_Y) return;
    if (p.rightButtonDown()) { this.cursorMode = { move: 'cmd', cmd: 'look', look: 'move' }[this.cursorMode]; ctx.sfx('click', 0.3); this.pointerMove(p); return; }
    const t = this.pick(p.worldX, p.worldY);
    if (this.cursorMode === 'look') { this.describe(t.kind === 'tile' ? null : t.kind === 'prop' ? t.p : t); this.cursorMode = 'move'; return; }
    if (this.busy || (this.combat && !this.playerTurnOn)) return;
    this.activate(t);
  },
  async activate(t) {
    const P = this.player;
    if (t.kind === 'enemy' && !t.dead) return this.playerAttack(t);
    if (t.kind === 'npc') { if (this.combat) return this.say('Not now!', COL.red); if (this.dist(P, t) > 2) { const path = this.path(P, t, true); if (!path) return this.say('You cannot get there.', COL.dim); await this.walk(P, path); if (this.dist(P, t) > 2) return; } this.faceTo(P, t); return this.ctx.openDialog(t.npc); }
    if (t.kind === 'prop' || t.kind === 'kickwall') {
      if (this.combat) return this.say('Not during combat.', COL.dim);
      const need = t.kind === 'kickwall' ? 1 : (t.p.p === 'moped' ? 2 : 1);
      if (this.dist(P, t) > need) { const path = this.path(P, t, true); if (!path) return this.say('You cannot get there.', COL.dim); await this.walk(P, path); if (this.dist(P, t) > need) return; }
      this.faceTo(P, t); if (t.kind === 'kickwall') return this.ctx.openDialog(this.G.flags.wall_done ? 'saku' : 'saku'); return this.openProp(t.p);
    }
    if (t.kind === 'enemy') return this.describe(t);              // corpse
    if (this.cursorMode === 'cmd') return;
    const goal = { x: t.x, y: t.y }; if (this.blockedTile(goal.x, goal.y)) return this.say('You cannot get there.', COL.dim);
    const path = this.path(P, goal); if (!path) return this.say('You cannot get there.', COL.dim);
    if (!path.length) return;
    this.walkTo(path);
  },
  async walkTo(path) {
    const P = this.player; let cut = path;
    if (this.combat) { if (path.length > P.ap) { cut = path.slice(0, P.ap); this.say(`Not enough action points (${path.length} AP needed).`, COL.dim); } if (!cut.length) return; }
    const tok = ++this.moveToken; await this.walk(P, cut, { tok });
  },
  /** Walk an entity along a path. In combat each step costs 1 AP. Cancelled by a newer move command. */
  async walk(e, path, { tok = null } = {}) {
    const isP = e.kind === 'player'; if (isP) this.busy = !!this.combat; if (isP && tok === null) tok = ++this.moveToken;
    for (const s of path) {
      if (!this.alive || (isP && tok !== this.moveToken) || e.dead) break;
      if (this.isBlocked(s.x, s.y, e)) break;
      if (this.combat && e.ap < 1) break;
      await this.stepTo(e, s, isP ? (this.combat ? 150 : 120) : 130); if (this.combat) e.ap -= 1;
      if (isP) { this.hudRefresh(); this.checkAggro(); if (this.checkExit()) return; if (this.combat && !this.playerTurnOn) break; }
    }
    e.pose = 'stand'; if (isP) this.busy = false;
  },
  async stepTo(e, s, ms = 140) {
    this.face(e, s.x - Math.round(e.x), s.y - Math.round(e.y)); e.pose = e.pose === 'walkA' ? 'walkB' : 'walkA';
    if (e.kind === 'player' || this.dist(this.player, e) < 14) this.ctx.sfx('step', 0.25, 0.9 + Math.random() * 0.3);
    await this.tw({ targets: e, x: s.x, y: s.y, duration: ms, ease: 'Linear' });
  },
  checkExit() {
    if (this.combat) return false; const t = this.tile(this.player);
    if (this.map.exits.some((e) => e.x === t.x && e.y === t.y)) { this.moveToken++; this.busy = false; this.ctx.leaveArea(); return true; }
    return false;
  },
  // ---- awareness & combat -------------------------------------------------------------------------------------------------
  foes() { return this.ents.filter((e) => e.kind === 'enemy' && !e.dead); },
  checkAggro() {
    if (this.combat || this.ctx.mode !== 'classic' || this.player.dead) return;
    for (const e of this.foes()) { if (e.awake) return this.startCombat(); const d = this.dist(this.player, e); if (d <= Math.min(e.def.sight, R.derived(this.G.char.S).sight) && this.los(e, this.player).clear) { e.awake = true; this.float(e, '!', COL.red); return this.startCombat(); } }
  },
  async startCombat() {
    if (this.combat || this.ctx.mode !== 'classic') return;
    const P = this.player; this.moveToken++; for (const e of this.foes()) if (this.dist(P, e) <= 16) e.awake = true;
    this.combat = { round: 1 }; const tok = (this.combatToken = (this.combatToken ?? 0) + 1 + 1000); this.combatToken = tok;
    this.say('--- COMBAT BEGINS ---', COL.red); this.ctx.sfx('combat', 0.6); this.ctx.music('combat'); this.ctx.hud.refresh();
    while (this.combat && this.combatToken === tok && !P.dead && this.alive) {
      const order = [P, ...this.foes().filter((e) => e.awake)].sort((a, b) => (b.kind === 'player' ? R.derived(this.G.char.S).seq : b.def.ap + 1) - (a.kind === 'player' ? R.derived(this.G.char.S).seq : a.def.ap + 1));
      for (const e of order) {
        if (!this.combat || this.combatToken !== tok || e.dead || P.dead || !this.alive) break;
        if (e === P) await this.playerTurn(); else { this.camTarget = e; await this.enemyTurn(e); this.camTarget = null; }
        if (this.checkCombatEnd()) return;
      }
      if (this.combat) this.combat.round++;
    }
  },
  playerTurn() {
    const P = this.player, c = this.G.char; P.ap = R.derived(c.S).ap; if (c.drunk > 0) c.drunk--; this.playerTurnOn = true; this.busy = false; this.say(`Your turn. (${P.ap} AP)`, COL.amber); this.hudRefresh();
    return new Promise((res) => { this.endTurnRes = res; });
  },
  endTurn() { if (this.combat && this.playerTurnOn && this.endTurnRes) { this.playerTurnOn = false; const r = this.endTurnRes; this.endTurnRes = null; this.say(`You end your turn with ${this.player.ap} AP (+${this.player.ap} AC).`, COL.dim); r(); } },
  endCombat() {
    if (!this.combat) return; const bad = this.foes().some((e) => e.awake && this.dist(e, this.player) <= 12 && this.los(e, this.player).clear);
    if (bad) return this.say('You cannot end combat while enemies are watching.', COL.red); this.finishCombat(true);
  },
  checkCombatEnd() { if (this.player.dead) return true; if (!this.foes().some((e) => e.awake)) { this.finishCombat(false); return true; } return false; },
  finishCombat() {
    if (!this.combat) return; this.combat = null; this.combatToken = -2; this.playerTurnOn = false; this.camTarget = null; this.say('--- COMBAT ENDS ---', COL.amber); this.ctx.music('explore');
    if (this.endTurnRes) { this.endTurnRes(); this.endTurnRes = null; } this.hudRefresh();
  },
  // ---- player attack ----------------------------------------------------------------------------------------------------
  async playerAttack(t) {
    const P = this.player, { w, mode } = this.wpn(), G = this.G;
    if (!this.combat) { t.awake = true; await this.startCombat(); await this.wait(30); if (!this.playerTurnOn) return; }
    if (!this.playerTurnOn || this.busy) return;
    const rng = mode.kind === 'ranged' ? w.range : 1;
    if (mode.ammo && this.ctx.count(w.ammo) < mode.ammo) return this.say(`Out of ammo for ${w.name}!`, COL.red);
    if (this.dist(P, t) > rng || (mode.kind === 'ranged' && !this.los(P, t).clear)) {
      const path = this.path(P, t, true); if (!path) return this.say('You cannot reach it.', COL.dim);
      let steps = 0; for (const s of path) { if (this.dist(s, t) <= rng && (mode.kind !== 'ranged' || this.los(s, t).clear)) break; steps++; }
      if (steps + mode.ap > P.ap) return this.say(`Not enough action points (${steps + mode.ap} AP needed).`, COL.dim);
      this.busy = true; await this.walk(P, path.slice(0, steps), { tok: ++this.moveToken }); this.busy = false;
      if (this.dist(P, t) > rng) return;
    }
    if (P.ap < mode.ap) return this.say(`Not enough action points (${mode.ap} AP needed).`, COL.dim);
    this.busy = true; P.ap -= mode.ap; this.hudRefresh(); await this.attackSeq(P, t, w, mode); this.busy = false; this.hudRefresh(); this.checkAggro();
    this.checkCombatEnd();
  },
  muzzle(e) { return { x: this.sx(e.x, e.y), y: this.sy(e.x, e.y) - 16 }; },
  async attackSeq(att, def, w, mode) {
    const ctx = this.ctx, G = this.G, isP = att.kind === 'player';
    const a = isP ? G.char : { def: att.def }, d = def.kind === 'player' ? G.char : { def: def.def }, distance = this.dist(att, def);
    this.faceTo(att, def); const kind = mode.kind;
    if (isP && mode.ammo) ctx.take(w.ammo, mode.ammo);
    const res = R.attack(a, d, w, mode, distance, { lof: this.los(att, def).crowd, defAP: def.kind === 'player' });
    att.pose = kind === 'ranged' ? 'shoot' : 'kick'; const wid = isP ? G.char.weapon : null;
    ctx.sfx(isP ? ({ pistol: 'shoot_pistol', shotgun: 'shoot_shotgun', rifle: 'shoot_rifle', raygun: 'ray', nokia: 'swing', puukko: 'swing', pipe: 'swing', fists: mode.n === 'KICK' ? 'kick' : 'punch' }[wid] ?? 'swing') : ({ blob: 'blob', gull: 'gull' }[att.type] ?? 'ray'), 0.7);
    if (kind === 'ranged') {
      const m0 = this.muzzle(att), m1 = this.muzzle(def), bolt = isP ? wid === 'raygun' : att.def.atk.bolt; this.fx(bolt ? 'muzzle_b' : 'muzzle_a', att.x, att.y, { dur: 120 });
      const s = this.ps.add.image(m0.x, m0.y, ctx.K.fx, ctx.fr.fx[bolt ? 'bolt' : 'bullet']).setDepth(9000).setRotation(Math.atan2(m1.y - m0.y, m1.x - m0.x)); await this.tw({ targets: s, x: m1.x, y: m1.y, duration: 90 + distance * 12 }); s.destroy();
    } else await this.wait(180);
    const who = isP ? 'You' : `The ${att.name}`, tgt = def.kind === 'player' ? 'you' : `the ${def.name}`;
    if (res.hit) {
      this.say(`${who} ${res.crit ? 'critically ' : ''}${isP ? 'hit' : 'hits'} ${tgt} for ${res.dmg} hit points.`, isP ? COL.green : COL.red);
      if (res.crit) this.float(def, 'CRITICAL!', COL.amber, 8);
      this.hurt(def, res.dmg, isP ? 'player' : 'enemy');
    } else {
      this.say(`${who} ${isP ? 'missed' : 'misses'} ${tgt}.`, COL.dim); this.float(def, 'MISS', COL.dim); ctx.sfx('miss', 0.3);
      if (res.fumble) { this.say(`${who} ${isP ? 'fumble' : 'fumbles'}! Turn lost.`, COL.amber); att.ap = 0; this.float(att, 'FUMBLE', COL.amber); }
    }
    await this.wait(160); att.pose = 'stand';
  },
  // ---- enemy turn ----------------------------------------------------------------------------------------------------------
  async enemyTurn(e) {
    const P = this.player, atk = e.def.atk; e.ap = e.def.ap; let acted = false;
    for (let guard = 0; guard < 24 && e.ap > 0 && !P.dead && !e.dead && this.alive; guard++) {
      const d = this.dist(e, P), inRange = d <= atk.range && (atk.kind === 'melee' || this.los(e, P).clear);
      if (inRange) { if (e.ap < atk.ap) break; e.ap -= atk.ap; acted = true; await this.attackSeq(e, P, null, { kind: atk.kind, n: 'ATTACK', ap: atk.ap }); this.hudRefresh(); continue; }
      const path = this.path(e, P, true, 60); if (!path || !path.length) break;
      let n = 0; for (const s of path) { if (this.dist(s, P) <= atk.range && (atk.kind === 'melee' || this.los(s, P).clear)) { n++; break; } n++; }
      const s = path[0]; if (this.isBlocked(s.x, s.y, e)) break; await this.stepTo(e, s, 120); e.pose = 'stand'; e.ap -= 1; acted = true;
    }
    e.pose = 'stand'; e.idle = acted ? 0 : (e.idle ?? 0) + 1; if (e.idle >= 3) { e.awake = false; e.idle = 0; } await this.wait(80);
  },
  // ---- per-frame (classic) ------------------------------------------------------------------------------------------------
  updateClassic(dt) {
    this.camTargetUpdate?.();
    this.aggroT = (this.aggroT ?? 0) - dt; if (this.aggroT <= 0) { this.aggroT = 0.3; if (!this.combat && !this.player.dead) this.checkAggro(); }
    this.barkT = (this.barkT ?? 3) - dt;
    if (this.barkT <= 0 && !this.combat) { this.barkT = 4 + Math.random() * 5; const n = this.ents.filter((e) => e.kind === 'npc' && this.dist(e, this.player) < 9); const e = n[Math.floor(Math.random() * n.length)]; if (e) this.float(e, e.npc === 'saku' || e.npc === 'mottonen' ? ['Asiaa!', 'Hei Rane!', 'Ouch.', 'Kick!'][Math.floor(Math.random() * 4)] : e.npc === 'rane' ? 'Moi.' : e.npc === 'ranger' || e.npc === 'capt' ? ['For Uusimaa!', 'Paperwork!', 'Halt!'][Math.floor(Math.random() * 3)] : BARKS[Math.floor(Math.random() * BARKS.length)], COL.cyan); }
  },
  onKey(e) {
    const k = e.key.toLowerCase();
    if (this.ctx.mode === 'modern') return this.onKeyModern?.(e, k);
    if (k === ' ') this.endTurn(); else if (k === 'enter') this.endCombat(); else if (k === 'b') this.cycleMode(); else if (k === 'a') this.cursorMode = 'cmd'; else if (k === 'm') this.cursorMode = 'move'; else if (k === 'l') this.cursorMode = 'look';
  },
});
