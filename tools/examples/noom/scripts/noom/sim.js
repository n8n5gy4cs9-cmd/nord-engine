// Noom game simulation — pure logic, no rendering (headless-testable: node tools/noom-sim.mjs). Runs monsters/projectiles at Doom's 35 Hz tic rate.
// Ported from id Software's DOOM source (linuxdoom-1.10, GPL-2.0): p_enemy.c (A_Look, A_Chase, P_NewChaseDir, P_Move/TryWalk, P_CheckMeleeRange,
// P_CheckMissileRange, A_TroopAttack/A_BruisAttack/A_SargAttack/A_PosAttack damage rolls), p_inter.c (P_DamageMobj: pain chance, armor 1/3 saved,
// threshold), p_map.c (P_RadiusAttack barrel blast), p_pspr.c (shotgun: 7 pellets, 5*(1..3) damage, ±5.6° spread; fist 2*(1..10)), info.c (mobjinfo / states),
// p_sight.c (line of sight), P_NoiseAlert (sound waking monsters). Units: 1 cell = 64 Doom units. Written for Nord by Crowelian 2026 + Sonnet.
import { P_Random, M_Random, resetRandom } from './doomrng.js';
import * as L from './level.js';

export const TICRATE = 35, TIC = 1 / TICRATE, U = 1 / 64;
export const W = L.W, H = L.H;
const MELEE = 64 * U, PLAYER_R = 16 * U;
const D2R = Math.PI / 180;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rnd = (n) => P_Random() % n;

// ---- thing definitions ---------------------------------------------------------------------------------------------------------------------
const cyc = (frames, t) => frames.map((f) => ({ f, t, a: 'chase' }));
const walk4 = (t) => cyc(['walk1', 'walk1', 'stand', 'stand', 'walk2', 'walk2', 'stand', 'stand'], t);
const look = [{ f: 'stand', t: 10, a: 'look' }, { f: 'stand', t: 10, a: 'look' }];
export const MOBS = {
  skeleton: { name: 'Skeleton Archer', sheet: 'skeleton', hp: 20, speed: 8, radius: 20, height: 0.95, painchance: 200, reaction: 8, missile: 'arrow', see: 'rattle',
    states: { stand: look, see: walk4(4), missile: [{ f: 'aim', t: 10, a: 'face' }, { f: 'shoot', t: 8, a: 'posAttack' }, { f: 'aim', t: 8 }], pain: [{ f: 'pain', t: 3 }, { f: 'pain', t: 3, a: 'pain' }],
      death: [{ f: 'die1', t: 5 }, { f: 'die2', t: 5, a: 'scream' }, { f: 'die2', t: 5, a: 'fall' }, { f: 'die3', t: 5 }, { f: 'die3', t: -1 }] } },
  goblin: { name: 'Goblin', sheet: 'goblin', hp: 60, speed: 10, radius: 20, height: 0.72, painchance: 180, reaction: 8, melee: 'bite',
    states: { stand: look, see: cyc(['walk1', 'walk1', 'stand', 'stand', 'walk2', 'walk2', 'stand', 'stand'], 2), melee: [{ f: 'windup', t: 8, a: 'face' }, { f: 'strike', t: 8, a: 'face' }, { f: 'strike', t: 8, a: 'sargAttack' }],
      pain: [{ f: 'pain', t: 2 }, { f: 'pain', t: 2, a: 'pain' }],
      death: [{ f: 'die1', t: 8 }, { f: 'die2', t: 8, a: 'scream' }, { f: 'die3', t: 4 }, { f: 'die3', t: 4, a: 'fall' }, { f: 'die3', t: -1 }] } },
  imp: { name: 'Imp', sheet: 'imp', hp: 60, speed: 8, radius: 20, height: 0.98, painchance: 200, reaction: 8, melee: 'claw', missile: 'impball',
    states: { stand: look, see: walk4(3), melee: [{ f: 'windup', t: 8, a: 'face' }, { f: 'windup', t: 8, a: 'face' }, { f: 'throw', t: 6, a: 'troopAttack' }], missile: null,
      pain: [{ f: 'pain', t: 2 }, { f: 'pain', t: 2, a: 'pain' }],
      death: [{ f: 'die1', t: 8 }, { f: 'die2', t: 8, a: 'scream' }, { f: 'die3', t: 6 }, { f: 'die3', t: 6, a: 'fall' }, { f: 'die3', t: -1 }] } },
  baron: { name: 'Baron of Barony', sheet: 'baron', hp: 700, speed: 8, radius: 24, height: 1.3, painchance: 50, reaction: 8, melee: 'bruise', missile: 'baronball', boss: true,
    states: { stand: look, see: walk4(3), melee: [{ f: 'windup', t: 8, a: 'face' }, { f: 'windup', t: 8, a: 'face' }, { f: 'throw', t: 8, a: 'bruisAttack' }], missile: null,
      pain: [{ f: 'pain', t: 2 }, { f: 'pain', t: 2, a: 'pain' }],
      death: [{ f: 'die1', t: 8 }, { f: 'die2', t: 8, a: 'scream' }, { f: 'die2', t: 8 }, { f: 'die3', t: 8 }, { f: 'die3', t: 8, a: 'fall' }, { f: 'die3', t: -1 }] } },
};
for (const m of Object.values(MOBS)) if (m.missile === null || m.states.missile === null) m.states.missile = m.states.melee; // imp/baron: one attack state does both
export const PROJ = {
  arrow: { speed: 16, radius: 8, damage: 'x3', dmgBase: 5, sprite: 'arrow', hit: 'puff' },       // zombieman-style 3*(1..5)
  impball: { speed: 10, radius: 6, damage: 3, sprite: 'impBall', hit: 'boom' },                  // MT_TROOPSHOT: damage 3 * (1..8)
  baronball: { speed: 15, radius: 6, damage: 8, sprite: 'baronBall', hit: 'boomGreen' },         // MT_BRUISERSHOT: 8 * (1..8)
};
export const PICKUPS = { flask: { sprite: 'flaskSmall', h: 0.28 }, bigflask: { sprite: 'flaskBig', h: 0.36 }, shells: { sprite: 'shells', h: 0.2 }, armor: { sprite: 'armor', h: 0.34 }, key: { sprite: 'key', h: 0.34 }, gun: { sprite: 'gun', h: 0.2 } };
export const DECOR = { torch: { sprite: 'torch', h: 1.0 }, bones: { sprite: 'bones', h: 0.14 } };

// ---- world ---------------------------------------------------------------------------------------------------------------------------------
export class Sim {
  constructor() { this.reset(); }
  reset() {
    resetRandom();
    this.events = []; this.tic = 0; this.time = 0; this.state = 'play'; // play | dead | exit
    const solid = new Uint8Array(W * H).fill(1), tex = new Uint8Array(W * H), floor = new Uint8Array(W * H);
    this.solid = solid; this.tex = tex; this.floor = floor; this.doors = new Map(); this.pillars = new Set();
    const carve = (x, y, f) => { solid[y * W + x] = 0; floor[y * W + x] = f; };
    for (const r of L.ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y, r.floor);
    for (const r of L.ROOMS) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (solid[y * W + x]) tex[y * W + x] = L.WALL_TEX[r.wall];
    for (const [x, y] of L.PILLARS) { solid[y * W + x] = 1; tex[y * W + x] = 0; this.pillars.add(y * W + x); }
    for (const [x, y, t] of L.WALL_OVERRIDES) tex[y * W + x] = t;
    for (const d of L.DOORS) { const i = d.y * W + d.x; floor[i] = 0; solid[i] = d.t === 'X' ? 1 : 0; this.doors.set(i, { ...d, i, open: 0, mode: 'closed', wait: 0, found: false }); if (d.t === 'S') tex[i] = 1; }
    this.mobjs = []; this.projs = []; this.fx = []; this.seen = new Uint8Array(W * H); this.lights = L.TORCHES.filter(([x, y]) => !solid[y * W + x]).map(([x, y]) => [x + 0.5, y + 0.5]);
    this.stats = { kills: 0, killsTotal: 0, items: 0, itemsTotal: 0, secrets: 0, secretsTotal: [...this.doors.values()].filter((d) => d.t === 'S').length };
    this.player = { x: 0, y: 0, a: 0, hp: 100, armor: 0, ammo: 12, keys: { blue: false }, weapons: { mace: true, gun: false }, cur: 'mace', pending: null, wstate: 'ready', wtics: 0, wframe: 'mace_idle', wy: 0, refire: false, bob: 0, dead: false, hurt: 0, flash: 0, grin: 0, noise: 0, tilt: 0, moving: 0 };
    for (const t of L.THINGS) this.spawn(t);
    this.noWake = false;
  }
  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  msg(text) { this.emit({ t: 'msg', text }); }
  sfx(n, x, y) { this.emit({ t: 'sfx', n, x, y }); }

  spawn(t) {
    const x = t.x + 0.5, y = t.y + 0.5;
    if (t.t === 'player') { Object.assign(this.player, { x, y, a: -(t.a ?? 90) * D2R }); return; }
    if (MOBS[t.t]) {
      const d = MOBS[t.t];
      const m = { kind: 'mob', type: t.t, def: d, x, y, px: x, py: y, hp: d.hp, radius: d.radius * U, angle: rnd(8) * Math.PI / 4, movedir: 8, movecount: 0, reaction: d.reaction, target: null, flags: { ambush: !!t.sleep }, threshold: 0, st: null, step: 0, tics: 0, frame: 'stand', dead: false, solid: true, alertAt: 0 };
      this.mobjs.push(m); this.setState(m, 'stand'); this.stats.killsTotal++; return;
    }
    if (t.t === 'barrel') { this.mobjs.push({ kind: 'barrel', type: 'barrel', x, y, px: x, py: y, hp: 20, radius: 10 * U, dead: false, solid: true, frame: 'barrel', tics: 0, st: null, step: 0 }); return; }
    if (PICKUPS[t.t]) { this.mobjs.push({ kind: 'item', type: t.t, x, y, px: x, py: y, radius: 20 * U, dead: false, solid: false, frame: t.t, secret: !!t.secret }); this.stats.itemsTotal++; return; }
    if (DECOR[t.t]) this.mobjs.push({ kind: 'decor', type: t.t, x, y, px: x, py: y, radius: 0, dead: false, solid: false, frame: t.t });
  }

  // ---- state machine (info.c states) -------------------------------------------------------------------------------------------------------
  setState(m, name, step = 0) {
    const st = m.def.states[name], s = st[step];
    m.st = name; m.step = step; m.tics = s.t; m.frame = s.f;
    if (s.a) this.action(m, s.a);
  }
  runStates() {
    for (const m of [...this.mobjs]) {
      if (m.kind !== 'mob' || !m.st) continue;
      if (m.tics === -1) continue;
      if (--m.tics > 0) continue;
      const st = m.def.states[m.st];
      if (m.step + 1 < st.length) this.setState(m, m.st, m.step + 1);
      else if (m.st === 'stand') this.setState(m, 'stand', 0);
      else if (m.st === 'see') this.setState(m, 'see', 0);
      else this.setState(m, 'see', 0); // attacks and pain return to the chase
    }
    // barrels: explode sequence
    for (const m of [...this.mobjs]) {
      if (m.kind === 'barrel' && m.dead) {
        if (--m.btics <= 0) { m.bstep++; if (m.bstep >= 3) { this.mobjs.splice(this.mobjs.indexOf(m), 1); continue; } m.btics = 5; m.frame = `boom${m.bstep + 1}`; if (m.bstep === 1) this.radiusAttack(m, 128, 128, m); }
      }
    }
  }

  // ---- map queries -------------------------------------------------------------------------------------------------------------------------
  cellBlocks(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return true;
    const i = cy * W + cx;
    if (!this.solid[i]) { const d = this.doors.get(i); return !!d && d.open < 0.5; }
    const d = this.doors.get(i); // secret/exit doors are "solid" until opened
    return !(d && d.t === 'S' && d.open >= 0.5);
  }
  sightBlocks(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return true;
    const i = cy * W + cx, d = this.doors.get(i);
    if (d) return d.open < 0.35;
    return !!this.solid[i];
  }
  los(ax, ay, bx, by) {
    const d = dist(ax, ay, bx, by), n = Math.ceil(d / 0.12);
    for (let k = 1; k < n; k++) { const t = k / n; if (this.sightBlocks(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false; }
    return true;
  }
  /** can a circle of radius r stand at (x,y)? (walls, closed doors, solid things except `self`) */
  fits(x, y, r, self) {
    for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      if (!this.cellBlocks(cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1)), ny = Math.max(cy, Math.min(y, cy + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return false;
    }
    for (const o of this.mobjs) if (o !== self && o.solid && !o.dead && dist(x, y, o.x, o.y) < r + o.radius) return false;
    if (self !== this.player && !this.player.dead && dist(x, y, this.player.x, this.player.y) < r + PLAYER_R) return false;
    return true;
  }

  // ---- monster movement (p_enemy.c) --------------------------------------------------------------------------------------------------------
  // Doom directions: 0 E, 1 NE, 2 N, 3 NW, 4 W, 5 SW, 6 S, 7 SE, 8 none. Doom's y points up; ours points down, so dy is negated when moving.
  static XS = [1, 0.7071, 0, -0.7071, -1, -0.7071, 0, 0.7071];
  static YS = [0, 0.7071, 1, 0.7071, 0, -0.7071, -1, -0.7071];
  static OPP = [4, 5, 6, 7, 0, 1, 2, 3, 8];
  static DIAGS = [3, 1, 5, 7];
  move(m) {
    if (m.movedir === 8) return false;
    const sp = m.def.speed * U, nx = m.x + sp * Sim.XS[m.movedir], ny = m.y - sp * Sim.YS[m.movedir];
    if (this.fits(nx, ny, m.radius, m)) { m.x = nx; m.y = ny; return true; }
    // blocked by a closed (non-locked) door: open it like Doom monsters do
    const d = this.doors.get(Math.floor(ny) * W + Math.floor(nx));
    if (d && (d.t === 'D') && d.open < 0.5 && d.mode !== 'opening') { this.openDoor(d); return true; }
    return false;
  }
  tryWalk(m) { if (!this.move(m)) return false; m.movecount = P_Random() & 15; return true; }
  newChaseDir(m) {
    const t = m.target; if (!t) return;
    const olddir = m.movedir, turnaround = Sim.OPP[olddir];
    const dx = (t.x - m.x) * 64, dy = -(t.y - m.y) * 64; // Doom units, y up
    const d = [0, 8, 8];
    d[1] = dx > 10 ? 0 : dx < -10 ? 4 : 8;
    d[2] = dy < -10 ? 6 : dy > 10 ? 2 : 8;
    if (d[1] !== 8 && d[2] !== 8) { m.movedir = Sim.DIAGS[((dy < 0 ? 1 : 0) << 1) + (dx > 0 ? 1 : 0)]; if (m.movedir !== turnaround && this.tryWalk(m)) return; }
    if (P_Random() > 200 || Math.abs(dy) > Math.abs(dx)) { const tmp = d[1]; d[1] = d[2]; d[2] = tmp; }
    if (d[1] === turnaround) d[1] = 8;
    if (d[2] === turnaround) d[2] = 8;
    if (d[1] !== 8) { m.movedir = d[1]; if (this.tryWalk(m)) return; }
    if (d[2] !== 8) { m.movedir = d[2]; if (this.tryWalk(m)) return; }
    if (olddir !== 8) { m.movedir = olddir; if (this.tryWalk(m)) return; }
    if (P_Random() & 1) { for (let td = 0; td <= 7; td++) if (td !== turnaround) { m.movedir = td; if (this.tryWalk(m)) return; } }
    else { for (let td = 7; td >= 0; td--) if (td !== turnaround) { m.movedir = td; if (this.tryWalk(m)) return; } }
    if (turnaround !== 8) { m.movedir = turnaround; if (this.tryWalk(m)) return; }
    m.movedir = 8;
  }
  checkMelee(m) {
    const t = m.target; if (!t) return false;
    const pr = t === this.player ? PLAYER_R : 20 * U;
    if (dist(m.x, m.y, t.x, t.y) >= MELEE - 20 * U + pr) return false;
    return this.los(m.x, m.y, t.x, t.y);
  }
  checkMissile(m) {
    const t = m.target; if (!t || !this.los(m.x, m.y, t.x, t.y)) return false;
    if (m.justHit) { m.justHit = false; return true; }
    if (m.reaction) return false;
    let d = dist(m.x, m.y, t.x, t.y) * 64 - 64;
    if (!m.def.melee) d -= 128;
    if (d > 200) d = 200;
    if (P_Random() < d) return false;
    return true;
  }
  lookForPlayer(m, allAround) {
    const p = this.player; if (p.dead) return false;
    if (!allAround) { // only the 180 degrees in front, unless the player is very close
      const an = Math.atan2(p.y - m.y, p.x - m.x) - m.angle, a = Math.abs(Math.atan2(Math.sin(an), Math.cos(an)));
      if (a > Math.PI / 2 && dist(m.x, m.y, p.x, p.y) > MELEE) return false;
    }
    if (!this.los(m.x, m.y, p.x, p.y)) return false;
    m.target = p; return true;
  }

  // ---- actions -----------------------------------------------------------------------------------------------------------------------------
  action(m, a) { this[`A_${a}`]?.(m); }
  A_look(m) {
    m.threshold = 0;
    if (m.soundTarget && !m.flags.ambush) { m.target = m.soundTarget; this.seeYou(m); return; }
    if (m.soundTarget && m.flags.ambush && this.los(m.x, m.y, this.player.x, this.player.y)) { m.target = this.player; this.seeYou(m); return; }
    if (!this.lookForPlayer(m, false)) return;
    this.seeYou(m);
  }
  seeYou(m) { m.soundTarget = null; m.flags.ambush = false; this.sfx(m.def.see ?? 'growl', m.x, m.y); m.stateWake = true; this.setState(m, 'see'); }
  A_chase(m) {
    if (m.reaction) m.reaction--;
    if (m.threshold) { if (!m.target || m.target.hp <= 0 || m.target.dead) m.threshold = 0; else m.threshold--; }
    if (!m.target || (m.target.dead) || m.target.hp <= 0) { if (this.lookForPlayer(m, true)) return; this.setState(m, 'stand'); return; }
    if (m.justAttacked) { m.justAttacked = false; this.newChaseDir(m); return; }
    if (m.def.melee && this.checkMelee(m)) { this.sfx(m.def.melee === 'bite' ? 'swing' : 'swing', m.x, m.y); this.setState(m, 'melee'); return; }
    if (m.def.missile) {
      if (!m.movecount && this.checkMissile(m)) { this.setState(m, 'missile'); m.justAttacked = true; return; }
    }
    if (--m.movecount < 0 || !this.move(m)) this.newChaseDir(m);
    if (P_Random() < 3) this.sfx('growl', m.x, m.y);
  }
  A_face(m) { const t = m.target; if (!t) return; m.flags.ambush = false; m.angle = Math.atan2(t.y - m.y, t.x - m.x); }
  A_pain(m) { this.sfx('hurt_mob', m.x, m.y); }
  A_scream(m) { this.sfx('death', m.x, m.y); }
  A_fall(m) { m.solid = false; }
  A_posAttack(m) { // skeleton archer: an arrow, damage 3*(1..5) like A_PosAttack
    if (!m.target) return; this.A_face(m);
    const spread = (P_Random() - P_Random()) * 0.022 * D2R * 2; const a = m.angle + spread;
    this.spawnProj('arrow', m, a);
    this.sfx('shoot_mob', m.x, m.y);
  }
  A_troopAttack(m) {
    if (!m.target) return; this.A_face(m);
    if (this.checkMelee(m)) { this.sfx('hit', m.x, m.y); this.damageMobj(m.target, m, ((P_Random() % 8) + 1) * 3); return; }
    this.spawnProj('impball', m, m.angle); this.sfx('fireball', m.x, m.y);
  }
  A_sargAttack(m) { if (!m.target) return; this.A_face(m); if (this.checkMelee(m)) { this.sfx('hit', m.x, m.y); this.damageMobj(m.target, m, ((P_Random() % 10) + 1) * 4); } }
  A_bruisAttack(m) {
    if (!m.target) return;
    if (this.checkMelee(m)) { this.sfx('hit', m.x, m.y); this.damageMobj(m.target, m, ((P_Random() % 8) + 1) * 10); return; }
    this.spawnProj('baronball', m, m.angle); this.sfx('fireball', m.x, m.y);
  }

  // ---- projectiles ---------------------------------------------------------------------------------------------------------------------------
  spawnProj(type, owner, angle) {
    const d = PROJ[type];
    this.projs.push({ type, x: owner.x + Math.cos(angle) * 0.3, y: owner.y + Math.sin(angle) * 0.3, px: owner.x, py: owner.y, dx: Math.cos(angle) * d.speed * U, dy: Math.sin(angle) * d.speed * U, owner, def: d, dead: false, age: 0 });
  }
  runProjs() {
    for (const p of this.projs) {
      p.px = p.x; p.py = p.y; p.age++;
      // two sub-steps keep fast balls from tunnelling through thin things
      for (let k = 0; k < 2 && !p.dead; k++) {
        p.x += p.dx / 2; p.y += p.dy / 2;
        if (this.cellBlocks(Math.floor(p.x), Math.floor(p.y))) { this.explodeProj(p); break; }
        const pl = this.player;
        if (p.owner !== pl && !pl.dead && dist(p.x, p.y, pl.x, pl.y) < p.def.radius * U + PLAYER_R) { this.hitProj(p, pl); break; }
        for (const o of this.mobjs) if (o.kind === 'barrel' && !o.dead && dist(p.x, p.y, o.x, o.y) < p.def.radius * U + o.radius) { this.hitProj(p, o); break; }
      }
    }
    this.projs = this.projs.filter((p) => !p.dead);
  }
  hitProj(p, target) {
    const base = p.def.damage;
    const dmg = typeof base === 'number' ? ((P_Random() % 8) + 1) * base : ((P_Random() % 5) + 1) * 3;
    this.damageMobj(target, p.owner, dmg); this.explodeProj(p);
  }
  explodeProj(p) { p.dead = true; this.fx.push({ kind: p.def.hit, x: p.x, y: p.y, t: 0 }); this.sfx(p.def.hit === 'puff' ? 'step_stone' : 'explosion_small', p.x, p.y); }

  // ---- damage (p_inter.c) ------------------------------------------------------------------------------------------------------------------
  damageMobj(t, src, dmg) {
    const p = this.player;
    if (t === p) {
      if (p.dead) return;
      if (p.armor) { let saved = Math.floor(dmg / 3); if (p.armor <= saved) saved = p.armor; p.armor -= saved; dmg -= saved; }
      p.hp -= dmg; p.hurt = Math.min(1, p.hurt + dmg / 40); p.grin = 0;
      this.emit({ t: 'hurt', dmg }); this.sfx('hurt', p.x, p.y);
      if (p.hp <= 0) { p.hp = 0; p.dead = true; this.state = 'dead'; this.msg('You died. Press R or click to try again.'); this.emit({ t: 'dead' }); }
      return;
    }
    if (t.dead || (t.kind === 'mob' && t.hp <= 0)) return;
    t.hp -= dmg;
    if (t.kind === 'barrel') { if (t.hp <= 0) this.killBarrel(t, src); return; }
    if (t.hp <= 0) { this.killMob(t); return; }
    if (P_Random() < t.def.painchance) { t.justHit = true; this.setState(t, 'pain'); }
    t.reaction = 0;
    if (!t.target || t.threshold === 0 || t.target !== src) {
      if (src === p || src?.kind === 'mob') { t.target = src; t.threshold = 100; if (t.st === 'stand') this.setState(t, 'see'); }
    }
  }
  killMob(m) {
    m.hp = 0; m.dead = true; m.solid = false; this.stats.kills++; m.deadTics = 0;
    this.setState(m, 'death'); m.target = null;
    if (m.type === 'baron') this.emit({ t: 'bossDead' });
    if (m.type === 'skeleton' && !m.noDrop && rnd(2) === 0) this.mobjs.push({ kind: 'item', type: 'shells', x: m.x, y: m.y, px: m.x, py: m.y, radius: 20 * U, dead: false, solid: false, frame: 'shells', dropped: true });
  }
  killBarrel(b, src) {
    if (b.dead) return;
    b.dead = true; b.solid = false; b.btics = 5; b.bstep = 0; b.frame = 'boom1'; this.sfx('explosion', b.x, b.y);
    this.emit({ t: 'boom', x: b.x, y: b.y });
  }
  /** P_RadiusAttack: damage = (damage - distance in units) to everything with line of sight within `dmg` units */
  radiusAttack(src, dmg, radiusUnits, source) {
    const things = [...this.mobjs.filter((o) => (o.kind === 'mob' || o.kind === 'barrel') && !(o.dead && o.kind === 'mob')), this.player];
    for (const o of things) {
      if (o === src || (o.kind === 'barrel' && o.dead)) continue;
      const d = Math.max(0, dist(src.x, src.y, o.x, o.y) * 64 - (o.radius ?? PLAYER_R) * 64);
      if (d >= radiusUnits) continue;
      if (!this.los(src.x, src.y, o.x, o.y)) continue;
      this.damageMobj(o, source, Math.floor(dmg - d));
    }
  }

  // ---- hitscan (P_LineAttack) --------------------------------------------------------------------------------------------------------------
  lineAttack(ang, range, damage) {
    const p = this.player, dx = Math.cos(ang), dy = Math.sin(ang);
    // distance to the first wall / closed door
    let wall = range;
    for (let s = 0.05; s < range; s += 0.05) if (this.cellBlocks(Math.floor(p.x + dx * s), Math.floor(p.y + dy * s))) { wall = s; break; }
    let best = null, bd = wall;
    for (const o of this.mobjs) {
      if ((o.kind !== 'mob' && o.kind !== 'barrel') || o.dead) continue;
      const ox = o.x - p.x, oy = o.y - p.y, along = ox * dx + oy * dy;
      if (along <= 0 || along > bd) continue;
      const perp = Math.abs(ox * dy - oy * dx);
      if (perp < o.radius) { best = o; bd = along; }
    }
    const hx = p.x + dx * bd, hy = p.y + dy * bd;
    if (best) { this.fx.push({ kind: 'blood', x: hx, y: hy, t: 0, small: true }); this.damageMobj(best, p, damage); this.emit({ t: 'hit', mob: true }); }
    else this.fx.push({ kind: 'puff', x: hx - dx * 0.05, y: hy - dy * 0.05, t: 0 });
    return best;
  }
  noiseAlert() { // P_NoiseAlert: everything connected to the player's room by open space (and at most one closed door) wakes up
    const p = this.player, seen = new Map(), q = [[Math.floor(p.x), Math.floor(p.y), 0]];
    seen.set(Math.floor(p.y) * W + Math.floor(p.x), 0);
    for (let h = 0; h < q.length; h++) {
      const [cx, cy, blocks] = q[h];
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = ny * W + nx, d = this.doors.get(i); if (this.solid[i] && !d) continue;
        const nb = blocks + (d && d.open < 0.5 ? 1 : 0); if (nb > 1 || seen.has(i)) continue;
        if (d && d.t === 'X') continue;
        seen.set(i, nb); q.push([nx, ny, nb]);
      }
    }
    for (const m of this.mobjs) if (m.kind === 'mob' && !m.dead && m.st === 'stand' && seen.has(Math.floor(m.y) * W + Math.floor(m.x))) m.soundTarget = p;
  }

  // ---- doors ------------------------------------------------------------------------------------------------------------------------------------
  openDoor(d) { if (d.mode === 'closed' || d.mode === 'closing') { d.mode = 'opening'; this.sfx('open', d.x + 0.5, d.y + 0.5); } d.wait = 0; }
  runDoors() {
    for (const d of this.doors.values()) {
      if (d.t === 'X') continue;
      if (d.mode === 'opening') { d.open = Math.min(1, d.open + (d.t === 'S' ? 1 / 25 : 1 / 40)); if (d.open >= 1) { d.mode = d.t === 'S' ? 'open-forever' : 'open'; d.wait = 150; if (d.t !== 'S') this.solid[d.i] = 0; } }
      else if (d.mode === 'open') { if (--d.wait <= 0 && !this.thingInCell(d.x, d.y)) { d.mode = 'closing'; this.sfx('close', d.x + 0.5, d.y + 0.5); } }
      else if (d.mode === 'closing') {
        if (this.thingInCell(d.x, d.y)) { d.mode = 'opening'; continue; }
        d.open = Math.max(0, d.open - 1 / 40); if (d.open <= 0) d.mode = 'closed';
      }
    }
  }
  thingInCell(cx, cy) {
    const p = this.player; if (!p.dead && p.x > cx - 0.2 && p.x < cx + 1.2 && p.y > cy - 0.2 && p.y < cy + 1.2) return true;
    return this.mobjs.some((o) => o.solid && !o.dead && o.x > cx - o.radius && o.x < cx + 1 + o.radius && o.y > cy - o.radius && o.y < cy + 1 + o.radius);
  }
  use() {
    const p = this.player, dx = Math.cos(p.a), dy = Math.sin(p.a);
    for (let s = 0.2; s <= 1.4; s += 0.1) {
      const cx = Math.floor(p.x + dx * s), cy = Math.floor(p.y + dy * s), i = cy * W + cx, d = this.doors.get(i);
      if (d) {
        if (d.t === 'X') { this.state = 'exit'; this.sfx('win', p.x, p.y); this.emit({ t: 'exit' }); return; }
        if (d.t === 'K' && !p.keys.blue) { this.msg('You need the blue key to open this door.'); this.sfx('error', p.x, p.y); return; }
        if (d.t === 'S') { if (!d.found) { d.found = true; this.stats.secrets++; this.msg('You found a secret!'); } this.openDoor(d); return; }
        if (d.mode === 'closed' || d.mode === 'closing') this.openDoor(d); else if (d.mode === 'open') d.wait = 150;
        return;
      }
      if (this.solid[i]) { return; } // a plain wall: Doom plays "oof" — nothing to use
    }
  }

  // ---- player ------------------------------------------------------------------------------------------------------------------------------------
  /** input: { fwd, strafe (cells/s multipliers -1..1), turn (radians this frame), run, fire, use (edge), weapon (1|2|null) } */
  updatePlayer(dt, inp) {
    const p = this.player; if (p.dead) return;
    p.a += inp.turn ?? 0;
    const sp = (inp.run ? 7.6 : 5.2) * dt, fx = Math.cos(p.a), fy = Math.sin(p.a);
    let vx = (fx * (inp.fwd ?? 0) - fy * (inp.strafe ?? 0)), vy = (fy * (inp.fwd ?? 0) + fx * (inp.strafe ?? 0));
    const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; }
    const nx = p.x + vx * sp, ny = p.y + vy * sp;
    if (this.fits(nx, ny, PLAYER_R, p)) { p.x = nx; p.y = ny; } else if (this.fits(nx, p.y, PLAYER_R, p)) p.x = nx; else if (this.fits(p.x, ny, PLAYER_R, p)) p.y = ny;
    p.moving = Math.hypot(vx, vy) * (inp.run ? 1.4 : 1);
    p.bob += dt * 9 * p.moving; p.tilt = 0;
    if (inp.use) this.use();
    if (inp.weapon) this.selectWeapon(inp.weapon === 1 ? 'mace' : 'gun');
    p.fireHeld = !!inp.fire;
    this.pickups(); this.markSeen();
  }
  markSeen() { const p = this.player, r = 7; for (let y = Math.max(0, Math.floor(p.y) - r); y <= Math.min(H - 1, Math.floor(p.y) + r); y++) for (let x = Math.max(0, Math.floor(p.x) - r); x <= Math.min(W - 1, Math.floor(p.x) + r); x++) if (!this.seen[y * W + x] && this.los(p.x, p.y, x + 0.5, y + 0.5)) this.seen[y * W + x] = 1; }
  selectWeapon(w) {
    const p = this.player;
    if (!p.weapons[w] || p.cur === w) { if (!p.weapons[w]) this.msg('You do not have that weapon yet.'); return; }
    p.pending = w;
  }
  pickups() {
    const p = this.player;
    for (const o of this.mobjs) {
      if (o.kind !== 'item' || o.dead || dist(p.x, p.y, o.x, o.y) > o.radius + PLAYER_R) continue;
      let take = false, text = '';
      switch (o.type) {
        case 'flask': if (p.hp < 100) { p.hp = Math.min(100, p.hp + 10); take = true; text = 'You drink a small healing flask (+10).'; } break;
        case 'bigflask': if (p.hp < 100) { p.hp = Math.min(100, p.hp + 25); take = true; text = 'You drink a large healing flask (+25).'; } break;
        case 'shells': if (p.ammo < 50) { p.ammo = Math.min(50, p.ammo + 8); take = true; text = 'You pick up a box of shells (+8).'; } break;
        case 'armor': if (p.armor < 100) { p.armor = 100; take = true; text = 'You put on the iron cuirass (armor 100).'; } break;
        case 'key': p.keys.blue = true; take = true; text = 'You found the BLUE KEY!'; break;
        case 'gun': p.weapons.gun = true; p.ammo = Math.min(50, p.ammo + 8); p.pending = 'gun'; take = true; text = 'You got the BLUNDERBUSS! (key 2)'; break;
        default: break;
      }
      if (take) { o.dead = true; p.grin = 1.2; if (!o.dropped) this.stats.items++; this.msg(text); this.sfx(o.type === 'gun' || o.type === 'key' ? 'powerup' : 'pickup', o.x, o.y); this.emit({ t: 'pickup', type: o.type }); }
    }
    this.mobjs = this.mobjs.filter((o) => !(o.kind === 'item' && o.dead));
  }
  runWeapon() {
    const p = this.player; if (p.dead) return;
    // switching: lower the current weapon, then raise the new one
    if (p.pending && p.wstate !== 'fire') {
      p.wy += 0.18; p.wframe = p.cur === 'mace' ? 'mace_idle' : 'gun_idle';
      if (p.wy >= 1) { p.cur = p.pending; p.pending = null; p.wstate = 'ready'; }
      return;
    }
    if (p.wy > 0 && !p.pending) p.wy = Math.max(0, p.wy - 0.18);
    const idle = p.cur === 'mace' ? 'mace_idle' : 'gun_idle';
    if (p.wstate === 'ready') {
      p.wframe = idle;
      if (p.fireHeld && p.wy === 0) {
        if (p.cur === 'gun' && p.ammo <= 0) { if (!p.noAmmoMsg) { this.msg('Out of shells!'); p.noAmmoMsg = true; } this.selectWeapon('mace'); p.pending = 'mace'; return; }
        p.noAmmoMsg = false; this.fireWeapon();
      }
    } else if (--p.wtics <= 0) {
      const seq = p.seq; p.seqi++;
      if (p.seqi >= seq.length) { p.wstate = 'ready'; p.wframe = idle; return; }
      p.wframe = seq[p.seqi][0]; p.wtics = seq[p.seqi][1]; seq[p.seqi][2]?.();
    }
  }
  fireWeapon() {
    const p = this.player;
    p.wstate = 'fire'; p.seqi = 0;
    if (p.cur === 'mace') {
      p.seq = [['mace_swing1', 4], ['mace_swing2', 5, () => this.maceHit()], ['mace_idle', 6]];
      this.sfx('swing', p.x, p.y);
    } else {
      p.ammo--; p.flash = 0.12; this.sfx('shoot', p.x, p.y); this.noiseAlert();
      for (let i = 0; i < 7; i++) this.lineAttack(p.a + (P_Random() - P_Random()) * 0.022 * D2R, 20, 5 * (P_Random() % 3 + 1)); // Doom: (P_Random()-P_Random())<<18 BAM = 0.022° per step
      p.seq = [['gun_fire', 4], ['gun_pump1', 8, () => this.sfx('click', p.x, p.y)], ['gun_pump2', 8], ['gun_idle', 6]];
    }
    p.wframe = p.seq[0][0]; p.wtics = p.seq[0][1];
  }
  maceHit() {
    const p = this.player; this.noiseAlert();
    // fist: damage 2*(1..10), range = melee range (here 1.4 cells so a mace can hit things at arm's length)
    const dmg = 2 * (P_Random() % 10 + 1) + 4;
    const hit = this.lineAttackRange(1.45, dmg);
    this.sfx(hit ? 'hit' : 'swing', p.x, p.y);
  }
  lineAttackRange(range, dmg) { return this.lineAttack(this.player.a, range, dmg); }

  // ---- the tic -----------------------------------------------------------------------------------------------------------------------------------
  /** advance one 1/35 s tic */
  ticker() {
    this.tic++; this.time += TIC;
    const p = this.player;
    for (const m of this.mobjs) { m.px = m.x; m.py = m.y; }
    this.runDoors(); this.runStates(); this.runProjs(); this.runWeapon();
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter((f) => f.t < 24);
    p.hurt = Math.max(0, p.hurt - 0.03); p.flash = Math.max(0, p.flash - TIC); p.grin = Math.max(0, p.grin - TIC);
    // dead monsters stay (corpses); remove nothing
  }
}
