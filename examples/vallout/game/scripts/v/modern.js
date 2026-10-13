// MODERN mode: real-time WASD + mouse aim & shoot. Same stats/damage as classic (rules.js) but the aim decides hits:
// projectiles with spread (skill + movement + aiming), dodge roll, sprint stamina, quick weapon slots, quick-heal, interact prompt.
import { Area } from './play.js';
import { ITEMS, ENEMIES } from './data.js';
import * as R from './rules.js';
import { COL } from './ui.js';
import { BAR_Y } from './hud.js';

const SPEED = 3.3, SPRINT = 5.2, R_BODY = 0.28;
Object.assign(Area.prototype, {
  initModern() {
    this.stamina = 10; this.dodgeT = 0; this.invuln = 0; this.recoil = 0; this.cool = 0; this.walkT = 0; this.hitMark = 0; this.dashDir = null;
    this.cross = this.cross ?? this.add(this.ps.add.graphics().setDepth(9500).setScrollFactor(0));
    this.prompt = this.prompt ?? (this.promptT = this.ctx.makeText(320, 352, '', COL.amber, 9500, [0.5, 0], true));
    this.onWheel = (p, o, dx, dy) => { if (this.ctx.mode === 'modern' && !this.ctx.modal) this.cycleWeapon(dy > 0 ? 1 : -1); };
    this.ps.input.on('wheel', this.onWheel);
  },
  quickWeapons() { return this.G.inv.filter((i) => ITEMS[i.id]?.type === 'weapon').map((i) => i.id); },
  cycleWeapon(dir) { const l = this.quickWeapons(); if (l.length < 2) return; const i = l.indexOf(this.G.char.weapon); this.ctx.equip(l[(i + dir + l.length) % l.length]); },
  onModeChange(mode) {
    for (const e of this.ents) this.ps.tweens.killTweensOf(e);
    this.projectiles.forEach((p) => p.sprite?.destroy()); this.projectiles = []; this.moveToken++; this.busy = false;
    if (mode === 'modern') { this.finishCombat?.(); this.initModern(); this.hover?.clear(); this.pathG?.clear(); this.say('MODERN controls: WASD move, mouse aim, LMB shoot, RMB aim, SPACE dodge, SHIFT sprint, E use, Q heal, 1-4 weapons.', COL.dim); }
    else { this.cross?.clear(); this.promptT?.setText(''); this.ps.input.off('wheel', this.onWheel); for (const e of this.ents) { e.x = Math.round(e.x); e.y = Math.round(e.y); e.pose = 'stand'; } this.say('CLASSIC controls: click to move, right-click cursor, SPACE end turn.', COL.dim); this.checkAggro?.(); }
    this.hudRefresh();
  },
  blockedAt(e, x, y) {
    for (const [ox, oy] of [[-R_BODY, -R_BODY], [R_BODY, -R_BODY], [-R_BODY, R_BODY], [R_BODY, R_BODY]]) if (this.blockedTile(Math.round(x + ox), Math.round(y + oy))) return true;
    for (const o of this.ents) if (o !== e && !o.dead && Math.hypot(o.x - x, o.y - y) < 0.55) return true; return false;
  },
  tryMove(e, dx, dy) { if (!this.blockedAt(e, e.x + dx, e.y)) e.x += dx; if (!this.blockedAt(e, e.x, e.y + dy)) e.y += dy; },
  aimVec() { const p = this.ps.input.activePointer, t = this.toTile(p.worldX, p.worldY + 14), dx = t.x - this.player.x, dy = t.y - this.player.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l, dist: l, t }; },
  spread(P) { const c = this.G.char, w = R.heldWeapon(c); const base = (1 - Math.min(150, R.skillValue(c, w.skill ?? 'guns')) / 190) * 0.2; return base * (this.aimHeld ? 0.45 : 1) * (w.id === 'shotgun' || c.weapon === 'shotgun' ? 2.4 : 1) + (this.moving ? 0.05 : 0) + (c.drunk > 0 ? 0.12 : 0); },
  fire(P) {
    const G = this.G, c = G.char, w = R.heldWeapon(c), mode = R.modeOf(w, this.aimHeld ? 1 : 0), ctx = this.ctx, a = this.aimVec(); this.faceTo(P, { x: P.x + a.x, y: P.y + a.y });
    this.cool = Math.max(0.28, mode.ap * 0.085); this.recoil = 0.16;
    if (mode.kind === 'ranged') {
      if (mode.ammo && ctx.count(w.ammo) < mode.ammo) { this.cool = 0.5; ctx.sfx('error', 0.4); this.float(P, 'NO AMMO', COL.red); return; }
      if (mode.ammo) ctx.take(w.ammo, mode.ammo);
      const shotgun = c.weapon === 'shotgun', n = shotgun ? 5 : 1, bolt = c.weapon === 'raygun';
      ctx.sfx({ pistol: 'shoot_pistol', shotgun: 'shoot_shotgun', rifle: 'shoot_rifle', raygun: 'ray' }[c.weapon] ?? 'shoot_pistol', 0.7); this.fx(bolt ? 'muzzle_b' : 'muzzle_a', P.x, P.y, { dur: 100 });
      for (let i = 0; i < n; i++) { const ang = Math.atan2(a.y, a.x) + (Math.random() - 0.5) * 2 * this.spread(P); this.spawnShot(P, ang, { owner: 'player', w, mode, bolt, mul: shotgun ? 0.45 : 1, range: Math.min(w.range, 30) }); }
      this.ctx.hud.refresh();
    } else {
      ctx.sfx(c.weapon === 'fists' ? (mode.n === 'KICK' ? 'kick' : 'punch') : 'swing', 0.6); P.pose = 'kick'; let hit = false;
      for (const e of this.foes()) { const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy); if (d > 1.5 || (d > 0.4 && (dx * a.x + dy * a.y) / d < 0.35)) continue; hit = true; this.landHit(P, e, w, mode, true); }
      if (!hit) this.float(P, '...', COL.dim);
    }
  },
  spawnShot(src, ang, o) {
    const sp = this.ps.add.image(0, 0, this.ctx.K.fx, this.ctx.fr.fx[o.bolt || o.enemyBolt ? 'bolt' : 'bullet']).setDepth(9000); const sw = Math.atan2(Math.sin(ang) + Math.cos(ang), Math.cos(ang) - Math.sin(ang));
    this.projectiles.push({ x: src.x, y: src.y, vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14, life: (o.range ?? 12) / 14, sprite: sp, ang: sw, ...o });
  },
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const steps = 3; for (let i = 0; i < steps && !p.dead; i++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; p.life -= dt / steps;
        if (this.blockedTile(Math.round(p.x), Math.round(p.y)) || p.life <= 0) { p.dead = true; if (p.life > 0) this.fx('spark', p.x, p.y, { dur: 140 }); break; }
        const targets = p.owner === 'player' ? this.foes() : [this.player];
        for (const e of targets) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > (p.owner === 'player' ? 0.55 : 0.42)) continue; p.dead = true; if (p.owner === 'player') this.landHit(this.player, e, p.w, p.mode, true, p.mul); else this.enemyHitPlayer(p.src, p.mul); break; }
      }
      if (p.sprite) p.sprite.setPosition(this.sx(p.x, p.y), this.sy(p.x, p.y) - 14).setRotation(Math.atan2((p.vx + p.vy) * 8, (p.vx - p.vy) * 16));
    }
    this.projectiles = this.projectiles.filter((p) => { if (p.dead) p.sprite?.destroy(); return !p.dead; });
  },
  landHit(P, e, w, mode, sure, mul = 1) {
    const res = R.attack(this.G.char, { def: e.def }, w, mode, this.dist(P, e), { sure }); e.awake = true;
    if (!res.hit) { this.float(e, 'MISS', COL.dim); return; }
    const dmg = Math.max(1, Math.round(res.dmg * mul)); if (res.crit) this.float(e, 'CRITICAL!', COL.amber, 8); this.hitMark = 0.2; this.hurt(e, dmg, 'player');
  },
  enemyHitPlayer(src, mul = 1) {
    const P = this.player; if (this.invuln > 0 || P.dead) return;
    const atk = src.def.atk, res = R.attack({ def: src.def }, this.G.char, null, { kind: atk.kind, n: 'A', ap: atk.ap }, 4, { sure: true });
    if (!res.hit) { this.float(P, 'EVADED', COL.cyan); return; } this.say(`The ${src.name} hits you for ${Math.max(1, Math.round(res.dmg * mul))} hit points.`, COL.red); this.hurt(P, Math.max(1, Math.round(res.dmg * mul)), 'enemy');
  },
  interactTarget(P) {
    let best = null, bd = 1.9;
    const consider = (o, d, label) => { if (d < bd) { bd = d; best = { ...o, label }; } };
    for (const e of this.ents) if (e.kind === 'npc' && !e.dead) consider({ t: 'npc', e }, Math.hypot(e.x - P.x, e.y - P.y), `TALK TO ${e.name}`);
    for (const p of this.map.props) if (p.loot || p.rane || p.p === 'sign' || p.p === 'loot') consider({ t: 'prop', p }, Math.hypot(p.x - P.x, p.y - P.y), (p.name ?? p.p).toUpperCase());
    for (const o of this.map.objects) if (o.kind === 'kickwall') consider({ t: 'wall' }, Math.hypot(o.x - P.x, o.y - P.y), 'KICK THE WALL');
    return best;
  },
  useNearby(P) { const t = this.interactTarget(P); if (!t) return; if (t.t === 'npc') this.ctx.openDialog(t.e.npc); else if (t.t === 'wall') this.ctx.openDialog('saku'); else this.openProp(t.p); },
  updateModern(dt) {
    const P = this.player, ctx = this.ctx, ps = this.ps, ptr = ps.input.activePointer, K = ctx.keys; if (ctx.modal || P.dead) { this.cross.clear(); return; }
    const down = (...c) => c.some((k) => K[k]); this.aimHeld = ptr.rightButtonDown() && ptr.y < BAR_Y;
    let ax = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), ay = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
    this.moving = !!(ax || ay); const sprint = down('ShiftLeft', 'ShiftRight') && this.stamina > 0.5 && this.moving && !this.aimHeld;
    let tx = ax + ay, ty = ay - ax; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    this.stamina = Math.min(10, Math.max(0, this.stamina + (sprint ? -2.6 : 1.9) * dt)); this.invuln = Math.max(0, this.invuln - dt); this.cool -= dt; this.recoil -= dt; this.hitMark -= dt;
    if (this.dodgeT > 0) { this.dodgeT -= dt; const d = this.dashDir; this.tryMove(P, d.x * 11 * dt, d.y * 11 * dt); P.pose = 'walkA'; }
    else if (this.moving) { const sp = (sprint ? SPRINT : this.aimHeld ? SPEED * 0.55 : SPEED) * dt; this.tryMove(P, tx * sp, ty * sp); this.walkT += dt * (sprint ? 1.5 : 1); if (this.recoil <= 0) P.pose = Math.floor(this.walkT / 0.16) % 2 ? 'walkA' : 'walkB'; if (!this.recoil || this.recoil < 0) { if (Math.floor(this.walkT / 0.16) !== this.lastStep) { this.lastStep = Math.floor(this.walkT / 0.16); ctx.sfx('step', 0.18, 0.9 + Math.random() * 0.3); } } }
    else if (this.recoil <= 0) P.pose = 'stand';
    const a = this.aimVec(); if (this.dodgeT <= 0) this.face(P, a.x, a.y); if (this.recoil > 0 && this.cool > 0) P.pose = ctx.G.char.weapon && R.modeOf(R.heldWeapon(this.G.char), 0).kind === 'ranged' ? 'shoot' : 'kick';
    if (ptr.leftButtonDown() && ptr.y < BAR_Y && this.cool <= 0 && this.dodgeT <= 0) this.fire(P);
    // quick keys handled in onKeyModern; interaction prompt
    const it = this.interactTarget(P); this.promptT.setText(it ? `[E] ${it.label}` : '', COL.amber);
    this.updateProjectiles(dt); this.enemiesRT(dt); this.checkExit();
    // crosshair
    const g = this.cross, rad = Math.max(3, Math.tan(this.spread(P)) * a.dist * 11), col = this.hitMark > 0 ? 0xff4a3a : 0xffffff; g.clear();
    if (ptr.y < BAR_Y) { g.lineStyle(1, col, 0.9).strokeCircle(ptr.x, ptr.y, rad); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.lineBetween(ptr.x + dx * (rad + 2), ptr.y + dy * (rad + 2), ptr.x + dx * (rad + 6), ptr.y + dy * (rad + 6)); ctx.setCursor(-1); } else ctx.setCursor(0);
    const hov = this.pick(ptr.worldX, ptr.worldY); ctx.setHint(hov.kind === 'enemy' && !hov.dead ? `${hov.name.toUpperCase()} ${Math.max(0, hov.hp)}/${hov.maxhp}` : '', COL.amber);
    if (Math.round(this.stamina) !== this.lastSt || this.lastHp !== P.hp) { this.lastSt = Math.round(this.stamina); this.lastHp = P.hp; ctx.hud.refresh(this.stamina, 10); }
  },
  onKeyModern(e, k) {
    const P = this.player; if (P.dead) return;
    if (e.code === 'Space') { if (this.stamina >= 3 && this.dodgeT <= 0) { const K = this.ctx.keys; const ax = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0), ay = (K.KeyS ? 1 : 0) - (K.KeyW ? 1 : 0); let tx = ax + ay, ty = ay - ax; const l = Math.hypot(tx, ty); if (!l) { const a = this.aimVec(); tx = -a.x; ty = -a.y; } else { tx /= l; ty /= l; } this.dashDir = { x: tx, y: ty }; this.dodgeT = 0.22; this.invuln = 0.35; this.stamina -= 3; this.ctx.sfx('whoosh', 0.5); } }
    else if (k === 'e') this.useNearby(P);
    else if (k === 'q') this.ctx.quickHeal();
    else if (/^[1-4]$/.test(k)) { const l = this.quickWeapons(); if (l[+k - 1]) this.ctx.equip(l[+k - 1]); }
  },
  enemiesRT(dt) {
    const P = this.player, G = this.G;
    for (const e of this.foes()) {
      const atk = e.def.atk, dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy); e.cd -= dt; e.anim += dt; e.pathT = (e.pathT ?? 0) - dt;
      if (!e.awake) { if (d <= Math.min(e.def.sight, R.derived(G.char.S).sight) && this.los(e, P).clear) { e.awake = true; this.float(e, '!', COL.red); } else continue; }
      const los = this.los(e, P).clear, want = atk.kind === 'ranged' ? Math.min(atk.range * 0.55, 7) : 0.95;
      this.face(e, dx, dy);
      if (d > want || (atk.kind === 'ranged' && !los)) {
        if (e.pathT <= 0 || !e.wp) { e.pathT = 0.45; const path = this.path(e, P, true, 60); e.wp = path?.[0] ?? null; }
        if (e.wp) { const wx = e.wp.x - e.x, wy = e.wp.y - e.y, wl = Math.hypot(wx, wy); if (wl < 0.1) e.wp = null; else this.tryMove(e, (wx / wl) * e.speed * dt, (wy / wl) * e.speed * dt); }
        e.pose = Math.floor(e.anim / 0.18) % 2 ? 'walkA' : 'walkB';
      } else e.pose = e.cd > 0.3 ? (atk.kind === 'ranged' ? 'shoot' : 'kick') : 'stand';
      if (e.cd <= 0 && d <= atk.range && (atk.kind === 'melee' ? d < 1.2 : los) && !P.dead) {
        e.cd = atk.ap * 0.3 + Math.random() * 0.4;
        if (atk.kind === 'ranged') { const n = e.type === 'boss' ? 3 : 1, sp = (1 - e.def.skill / 130) * 0.3; this.ctx.sfx('ray', 0.5); this.fx('muzzle_b', e.x, e.y, { dur: 100 }); for (let i = 0; i < n; i++) this.spawnShot(e, Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * sp + (n > 1 ? (i - 1) * 0.16 : 0), { owner: 'enemy', src: e, enemyBolt: true, range: atk.range + 2 }); }
        else { this.ctx.sfx(e.type === 'blob' ? 'blob' : e.type === 'gull' ? 'gull' : 'punch', 0.5); e.pose = 'kick'; this.enemyHitPlayer(e); }
      }
    }
  },
});
