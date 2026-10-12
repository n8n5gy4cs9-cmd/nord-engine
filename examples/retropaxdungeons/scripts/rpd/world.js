// Game rules for RetroPaxDungeons — pure logic (no rendering) so it can be simulated headless (see tools/e2e/rpd-sim.mjs).
// Rules, numbers and AI are ported from Shattered Pixel Dungeon (GPL-3.0): Char.hit/attack, Mob AI states (Sleeping/Wandering/Hunting,
// Mob.java), Rat/Gnoll/Crab/Goo stats + Goo's pump-up attack and water healing, Hero levelling and regeneration, item formulas (items.js).
import { Rnd } from './random.js';
import { castShadow } from './fov.js';
import { distanceMap, dist, adjacent, neighbours } from './pathfinder.js';
import { generate, T, passableT, blocksSight } from './levelgen.js';
import * as I from './items.js';

export const VIEW = 8;
export const SLEEPING = 'sleeping', WANDERING = 'wandering', HUNTING = 'hunting';

/** Mob stats straight from SPD (HP, defenseSkill, attackSkill, damageRoll, drRoll, EXP, maxLvl, baseSpeed). */
export const MOBS = {
  rat: { name: 'Marsupial Rat', hp: 8, def: 2, acc: 8, dmg: [1, 4], dr: [0, 1], exp: 1, maxLvl: 5, speed: 1, desc: 'Sewer rats are omnivorous scavengers. Do not let them near your lunch.' },
  albino: { name: 'Albino Rat', hp: 15, def: 2, acc: 8, dmg: [1, 4], dr: [0, 1], exp: 2, maxLvl: 5, speed: 1, desc: 'A rare albino rat, tougher than its pigmented cousins.' },
  gnoll: { name: 'Gnoll Scout', hp: 12, def: 4, acc: 10, dmg: [1, 6], dr: [0, 2], exp: 2, maxLvl: 8, speed: 1, loot: { gold: 0.5 }, desc: 'Gnolls are hyena-like humanoids. They love shiny things.' },
  crab: { name: 'Sewer Crab', hp: 15, def: 5, acc: 12, dmg: [1, 7], dr: [0, 4], exp: 4, maxLvl: 9, speed: 2, desc: 'These huge crabs are quick on their legs and have a tough shell.' },
  goo: { name: 'Goo', hp: 100, def: 8, acc: 10, dmg: [1, 8], dr: [0, 2], exp: 10, maxLvl: 99, speed: 1, boss: true, desc: 'A pulsating mass of sewer slime. It heals while it sits in water — drag the fight out of the puddles!' },
};

let nextId = 1;
export class World {
  constructor({ seed = (Math.random() * 2 ** 32) >>> 0, heroLevel = 6 } = {}) {
    this.seed = seed >>> 0;
    this.rnd = new Rnd(this.seed);
    const lv = generate(this.rnd);
    Object.assign(this, { w: lv.w, h: lv.h, terrain: lv.terrain, deco: lv.deco, roomOf: lv.roomOf, rooms: lv.rooms, upCell: lv.upCell, downCell: lv.downCell });
    this.sight = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.sight.length; i++) this.sight[i] = blocksSight(this.terrain[i]) ? 1 : 0;
    this.visited = new Uint8Array(this.w * this.h);
    this.fov = new Uint8Array(this.w * this.h);
    this.mobs = []; this.items = new Map(); this.events = []; this.log = [];
    this.turn = 0; this.state = 'play'; this.sealed = false; this.kills = 0; this.endCause = '';
    this.known = new Set(); // identified potion/scroll effects
    // random appearance <-> effect mapping (like SPD): potion colours + scroll runes
    const fx = this.rnd.shuffle(Object.keys(I.POTION_EFFECTS)), cols = this.rnd.shuffle([...I.POTION_COLORS]);
    this.potionOf = Object.fromEntries(cols.map((c, i) => [c, fx[i]]));
    const sfx = this.rnd.shuffle(Object.keys(I.SCROLL_EFFECTS)), runes = this.rnd.shuffle([...I.SCROLL_RUNES]);
    this.scrollOf = Object.fromEntries(runes.map((r, i) => [r, sfx[i]]));
    this.hero = new Hero(this, lv.heroStart, heroLevel);
    this.#dmCache = new Map();
    this.#populate(lv);
    this.updateFov();
    this.msg(`You descend into the sewers, depth 5. The air is thick; something big stirs far below.`, 'warn');
  }
  #dmCache;

  // ---- helpers --------------------------------------------------------------------------------------------------------------
  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  msg(text, kind = 'normal') { this.log.push({ text, kind }); if (this.log.length > 80) this.log.shift(); this.emit({ t: 'msg', text, kind }); }
  xy(c) { return [c % this.w, (c / this.w) | 0]; }
  cell(x, y) { return y * this.w + x; }
  /** walkable for path-finding: stairs sit in wall niches and are handled separately by heroMove */
  passable(c) { const t = this.terrain[c]; return passableT(t) && t !== T.UP && t !== T.DOWN; }
  isWater(c) { return this.terrain[c] === T.WATER; }
  mobAt(c) { return this.mobs.find((m) => m.pos === c && m.hp > 0) ?? null; }
  occupied(c) { return this.hero.pos === c || !!this.mobAt(c); }
  /** BFS distance map towards `target` (static level, so cached). */
  distTo(target) {
    let m = this.#dmCache.get(target);
    if (!m) { if (this.#dmCache.size > 60) this.#dmCache.clear(); m = distanceMap(this.w, this.h, target, (i) => this.passable(i)); this.#dmCache.set(target, m); }
    return m;
  }
  randomFloor() { for (;;) { const c = this.rnd.int(this.w * this.h); if (this.terrain[c] === T.FLOOR || this.terrain[c] === T.GRASS) return c; } }
  updateFov() {
    const [x, y] = this.xy(this.hero.pos);
    castShadow(x, y, this.w, this.fov, this.sight, VIEW);
    for (let i = 0; i < this.fov.length; i++) if (this.fov[i]) this.visited[i] = 1;
    this.emit({ t: 'fov' });
  }
  /** Doors open while somebody stands in them. */
  #door(c, open) {
    const t = this.terrain[c];
    if (open && t === T.DOOR) { this.terrain[c] = T.OPEN_DOOR; this.sight[c] = 0; this.emit({ t: 'door', pos: c, open: true }); }
    else if (!open && t === T.OPEN_DOOR && !this.occupied(c)) { this.terrain[c] = T.DOOR; this.sight[c] = 1; this.emit({ t: 'door', pos: c, open: false }); }
  }
  moveActor(a, to) {
    const from = a.pos; a.pos = to;
    this.#door(to, true); this.#door(from, false);
    this.emit({ t: 'move', id: a.id, from, to });
  }

  // ---- population -----------------------------------------------------------------------------------------------------------
  #populate(lv) {
    const rnd = this.rnd, w = this.w;
    const far = distanceMap(w, this.h, lv.heroStart, (i) => this.passable(i));
    const spots = [];
    for (const r of this.rooms) if (r.kind !== 'entrance') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const c = y * w + x; if (this.terrain[c] === T.FLOOR || this.terrain[c] === T.GRASS) spots.push({ c, r }); }
    rnd.shuffle(spots);
    const used = new Set();
    const take = (pred) => { const i = spots.findIndex((s) => !used.has(s.c) && pred(s)); if (i < 0) return -1; used.add(spots[i].c); return spots[i].c; };
    const normal = (s) => s.r.kind !== 'boss';
    // boss in the middle of its arena (water if possible)
    const b = lv.bossRoom; const bc = b.x + (b.w >> 1) + (b.y + (b.h >> 1)) * w;
    this.goo = this.#spawn('goo', bc); this.goo.state = SLEEPING; used.add(bc);
    for (const [type, n] of [['rat', 4], ['albino', 1], ['gnoll', 3], ['crab', 2]]) for (let i = 0; i < n; i++) {
      const c = take((s) => normal(s) && far[s.c] >= 9 && this.terrain[s.c] !== T.WATER && this.rooms[this.roomOf[s.c]].kind !== 'tunnel');
      if (c >= 0) { const m = this.#spawn(type, c); m.state = rnd.float() < 0.7 ? SLEEPING : WANDERING; }
    }
    // items
    const potions = ['healing', 'healing', 'strength', 'haste', 'experience', 'shadows'];
    const colorFor = (eff) => Object.keys(this.potionOf).find((c) => this.potionOf[c] === eff);
    const put = (item, pred = normal) => { const c = take((s) => pred(s) && this.terrain[s.c] !== T.WATER); if (c >= 0) this.items.set(c, item); };
    for (const eff of potions) put({ type: 'potion', key: colorFor(eff), qty: 1 });
    for (const eff of ['mapping', 'teleport']) put({ type: 'scroll', key: Object.keys(this.scrollOf).find((r) => this.scrollOf[r] === eff), qty: 1 });
    put({ type: 'food', key: 'ration', qty: 1 });
    put({ type: 'armor', key: 'leatherArmor', qty: 1 });
    put({ type: 'weapon', key: 'sword', qty: 1 });
    for (let i = 0; i < 7; i++) put({ type: 'gold', key: 'gold', qty: rnd.range(30, 90) });
  }
  #spawn(type, pos) {
    const m = new Mob(this, type, pos); this.mobs.push(m); return m;
  }

  // ---- hero actions ---------------------------------------------------------------------------------------------------------
  /** cmd: {type:'move',dx,dy} | {type:'rest'} | {type:'use',index} | {type:'travel'…handled by the view via move}. Returns true if game time passed. */
  heroAct(cmd) {
    if (this.state !== 'play') return false;
    const h = this.hero; let spent = false;
    if (cmd.type === 'move') spent = this.#heroMove(cmd.dx, cmd.dy);
    else if (cmd.type === 'rest') { h.spend(1); spent = true; }
    else if (cmd.type === 'use') spent = this.#heroUse(cmd.index);
    if (!spent) return false;
    this.#afterHero();
    return true;
  }
  #heroMove(dx, dy) {
    const h = this.hero, [x, y] = this.xy(h.pos), nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return false;
    const to = this.cell(nx, ny);
    const m = this.mobAt(to);
    if (m) { h.attack(m); return true; }
    if (to !== this.downCell && to !== this.upCell && !this.passable(to)) return false;
    if (to === this.downCell) {
      if (this.goo.hp > 0) { this.msg('The way down is flooded with slime — you must defeat the Goo first!', 'warn'); return false; }
      this.state = 'won'; this.endCause = 'You reached the stairs down'; this.msg('You step onto the stairs and descend. Sewers cleared!', 'good'); this.emit({ t: 'end', state: 'won' }); return true;
    }
    if (to === this.upCell) { this.msg('There is no turning back now.', 'warn'); return false; }
    this.moveActor(h, to);
    h.spend(1 / h.speed());
    const item = this.items.get(to);
    if (item) this.#pickup(to, item);
    return true;
  }
  #pickup(c, item) {
    const h = this.hero;
    this.items.delete(c);
    this.emit({ t: 'pickup', pos: c, item });
    if (item.type === 'gold') { h.gold += item.qty; this.msg(`You collect ${item.qty} gold.`, 'good'); return; }
    const stack = ['potion', 'scroll', 'food'].includes(item.type) ? h.inv.find((i) => i.type === item.type && i.key === item.key) : null;
    if (stack) stack.qty += item.qty; else h.inv.push({ ...item });
    this.msg(`You now have ${this.itemName(item)}.`, 'normal');
    h.spend(1); // picking things up takes a turn, like SPD
  }
  itemName(it) {
    if (it.type === 'weapon') return I.WEAPONS[it.key].name;
    if (it.type === 'armor') return I.ARMORS[it.key].name;
    if (it.type === 'food') return 'Food Ration';
    if (it.type === 'gold') return `${it.qty} gold`;
    if (it.type === 'potion') { const e = this.potionOf[it.key]; return this.known.has(e) ? `Potion of ${I.POTION_EFFECTS[e].name}` : `${it.key[0].toUpperCase()}${it.key.slice(1)} Potion`; }
    if (it.type === 'scroll') { const e = this.scrollOf[it.key]; return this.known.has(e) ? `Scroll of ${I.SCROLL_EFFECTS[e].name}` : `Scroll "${it.key.toUpperCase()}"`; }
    return it.key;
  }
  itemDesc(it) {
    if (it.type === 'weapon') { const d = I.WEAPONS[it.key]; return `${d.name}: damage ${d.min}-${d.max}, needs ${d.str} STR. ${d.desc}`; }
    if (it.type === 'armor') { const d = I.ARMORS[it.key]; return `${d.name}: absorbs 0-${I.drMax(d.tier)} damage, needs ${d.str} STR. ${d.desc}`; }
    if (it.type === 'food') return 'Eat to stave off hunger.';
    if (it.type === 'potion') { const e = this.potionOf[it.key]; return this.known.has(e) ? I.POTION_EFFECTS[e].desc : 'Unknown. Drink at your own risk.'; }
    if (it.type === 'scroll') { const e = this.scrollOf[it.key]; return this.known.has(e) ? I.SCROLL_EFFECTS[e].desc : 'Unknown runes. Read it to find out.'; }
    return '';
  }
  #heroUse(index) {
    const h = this.hero, it = h.inv[index];
    if (!it) return false;
    const eat = () => { if (--it.qty <= 0) h.inv.splice(h.inv.indexOf(it), 1); };
    if (it.type === 'weapon' || it.type === 'armor') {
      const slot = it.type === 'weapon' ? 'weapon' : 'armor', old = h[slot];
      h[slot] = it.key; h.inv.splice(index, 1);
      if (old) h.inv.push({ type: it.type, key: old, qty: 1 });
      this.msg(`You equip the ${this.itemName(it)}.`);
      const str = (I.WEAPONS[it.key] ?? I.ARMORS[it.key]).str;
      if (str > h.str) this.msg(`It is too heavy for you (needs ${str} STR): you are ${Math.round((1 - 1 / 1.5 ** (str - h.str)) * 100)}% ${it.type === 'weapon' ? 'less accurate' : 'less evasive'}.`, 'warn');
      h.spend(it.type === 'armor' ? 2 : 1); return true;
    }
    if (it.type === 'food') { eat(); h.hunger = Math.max(0, h.hunger - 300); this.msg('That food tasted delicious!', 'good'); this.emit({ t: 'heal', id: h.id }); h.spend(3); return true; }
    if (it.type === 'potion') {
      const eff = this.potionOf[it.key]; eat(); this.known.add(eff);
      this.msg(`You drink the potion. It is a Potion of ${I.POTION_EFFECTS[eff].name}!`, 'good');
      if (eff === 'healing') { h.heal(Math.floor(0.8 * h.ht + 14)); }
      else if (eff === 'strength') { h.str++; this.msg('Newfound strength surges through your body.', 'good'); }
      else if (eff === 'haste') { h.haste = 30; this.msg('You feel your body speed up.', 'good'); }
      else if (eff === 'experience') { h.earnExp(h.maxExp() - h.exp); }
      else if (eff === 'shadows') { h.shadows = 40; this.msg('The shadows embrace you.', 'good'); }
      h.spend(1); return true;
    }
    if (it.type === 'scroll') {
      const eff = this.scrollOf[it.key]; eat(); this.known.add(eff);
      this.msg(`You read the scroll. It is a Scroll of ${I.SCROLL_EFFECTS[eff].name}!`, 'good');
      if (eff === 'mapping') { for (let i = 0; i < this.visited.length; i++) if (this.terrain[i] !== T.VOID) { this.visited[i] = Math.max(this.visited[i], 1); } this.msg('The layout of the level is revealed.', 'good'); }
      else if (eff === 'teleport') { let c; do { c = this.randomFloor(); } while (dist(this.w, c, h.pos) < 12 || this.occupied(c)); const from = h.pos; h.pos = c; this.emit({ t: 'teleport', id: h.id, from, to: c }); }
      h.spend(1); return true;
    }
    return false;
  }
  #afterHero() {
    const h = this.hero;
    this.updateFov();
    this.#processMobs();
    if (this.state === 'play') this.updateFov();
    this.emit({ t: 'turn' });
    if (h.hp <= 0 && this.state === 'play') { this.state = 'dead'; this.emit({ t: 'end', state: 'dead' }); }
  }
  #processMobs() {
    const h = this.hero;
    for (let guard = 0; guard < 400; guard++) {
      let best = null;
      for (const m of this.mobs) if (m.hp > 0 && m.next < h.next && (!best || m.next < best.next)) best = m;
      if (!best) break;
      best.act();
      if (h.hp <= 0) break;
    }
    this.mobs = this.mobs.filter((m) => m.hp > 0);
  }
  /** Time-driven hero status (called from Hero.spend). */
  tick(dt) {
    const h = this.hero; this.turn += dt;
    h.hunger += dt;
    const was = h.hunger - dt;
    if (was < 300 && h.hunger >= 300) this.msg('You are hungry.', 'warn');
    if (was < 450 && h.hunger >= 450) this.msg('You are starving!', 'bad');
    if (h.hunger >= 450 && Math.floor(h.hunger / 10) !== Math.floor(was / 10)) h.damage(1, 'starvation');
    else if (h.hp < h.ht) { h.regen += dt / 10; while (h.regen >= 1) { h.regen -= 1; h.hp = Math.min(h.ht, h.hp + 1); this.emit({ t: 'hp' }); } }
    if (h.haste > 0) h.haste -= dt;
    if (h.shadows > 0) h.shadows -= dt;
    if (h.ooze > 0) { if (this.isWater(h.pos)) { h.ooze = 0; this.msg('The water washes the ooze off you.', 'good'); } else { h.ooze -= dt; h.damage(1, 'ooze'); } }
  }
}

// =========================================================================================================================
export class Hero {
  constructor(world, pos, lvl) {
    this.w = world; this.id = 'hero'; this.isHero = true; this.pos = pos;
    this.lvl = lvl; this.exp = 0; this.str = 12; // depth 5: a seasoned warrior (SPD heroes have found ~2 strength potions by now)
    this.ht = 20 + 5 * (lvl - 1); this.hp = this.ht;
    this.attackSkill = 10 + (lvl - 1); this.defenseSkill = 5 + (lvl - 1); // +1 each level (Hero.earnExp)
    this.weapon = 'wornSword'; this.armor = 'clothArmor';
    this.inv = [{ type: 'food', key: 'ration', qty: 1 }];
    this.gold = 0; this.hunger = 0; this.regen = 0; this.haste = 0; this.shadows = 0; this.ooze = 0;
    this.next = 0;
  }
  speed() { return this.haste > 0 ? 2 : 1; }
  stealth() { return this.shadows > 0 ? 6 : 1; }
  spend(dt) { this.next += dt; this.w.tick(dt); }
  maxExp() { return 5 + this.lvl * 5; }
  wd() { return I.WEAPONS[this.weapon]; }
  ad() { return I.ARMORS[this.armor]; }
  /** weapon accuracy factor, attack delay (STR penalties from Weapon.java) */
  accFactor() { const e = this.wd().str - this.str; return e > 0 ? 1 / 1.5 ** e : 1; }
  attackDelay() { const e = this.wd().str - this.str; return e > 0 ? 1.2 ** e : 1; }
  attackSkillFor() { return Math.floor(this.attackSkill * this.accFactor()); }
  defenseSkillFor() { const e = this.ad().str - this.str; return Math.floor(e > 0 ? this.defenseSkill / 1.5 ** e : this.defenseSkill); }
  damageRoll() {
    const d = this.wd(), r = this.w.rnd; let dmg = r.normalIntRange(d.min, d.max);
    const ex = this.str - d.str; if (ex > 0) dmg += r.normalIntRange(0, ex);
    return dmg;
  }
  drRoll() { return this.w.rnd.normalIntRange(0, I.drMax(this.ad().tier)); }
  heal(n) { const was = this.hp; this.hp = Math.min(this.ht, this.hp + n); this.w.emit({ t: 'heal', id: this.id, amount: this.hp - was }); this.w.msg(`You feel better (+${this.hp - was} HP).`, 'good'); }
  damage(n, src) {
    if (this.hp <= 0 || n <= 0) return;
    this.hp -= n; this.w.emit({ t: 'damage', id: this.id, amount: n, hp: this.hp });
    if (this.hp <= 0) { this.hp = 0; this.w.endCause = typeof src === 'string' ? `Killed by ${src}` : `Killed by ${MOBS[src.type].name}`; this.w.msg(`You died... ${this.w.endCause}.`, 'bad'); }
  }
  attack(m) {
    const w = this.w, r = w.rnd;
    const surprise = !m.enemySeen; // sleeping / unaware mobs are always hit (Mob.surprisedBy)
    const hit = surprise || r.float(this.attackSkillFor()) >= r.float(m.defenseSkill());
    w.emit({ t: 'attack', id: this.id, target: m.id, hit });
    if (hit) {
      const dmg = Math.max(0, this.damageRoll() - m.drRoll());
      w.msg(`You ${surprise ? 'sneak attack' : 'hit'} the ${m.def.name} for ${dmg}.`, 'normal');
      m.damage(dmg, this);
    } else w.msg(`You miss the ${m.def.name}.`);
    this.spend(this.attackDelay() / (this.haste > 0 ? 2 : 1));
  }
  earnExp(n) {
    this.exp += n;
    while (this.exp >= this.maxExp()) {
      this.exp -= this.maxExp(); this.lvl++; this.ht += 5; this.hp = Math.min(this.ht, this.hp + 5); this.attackSkill++; this.defenseSkill++;
      this.w.msg(`Welcome to level ${this.lvl}!`, 'good'); this.w.emit({ t: 'levelup', lvl: this.lvl });
    }
  }
}

// =========================================================================================================================
export class Mob {
  constructor(world, type, pos) {
    this.w = world; this.type = type; this.def = MOBS[type]; this.id = `m${nextId++}`; this.pos = pos;
    this.hp = this.ht = this.def.hp; this.next = world.rnd.float(); // staggered start times
    this.state = SLEEPING; this.target = -1; this.enemySeen = false; this.alerted = false;
    this.pumped = 0; this.fov = new Uint8Array(world.w * world.h);
  }
  get isGoo() { return this.type === 'goo'; }
  speed() { return this.def.speed; }
  enraged() { return this.isGoo && this.hp * 2 <= this.ht; }
  attackSkill() { let a = this.def.acc; if (this.isGoo) { if (this.enraged()) a = 15; if (this.pumped > 0) a *= 2; } return a; }
  defenseSkill() { return Math.floor(this.def.def * (this.enraged() ? 1.5 : 1)); }
  drRoll() { return this.w.rnd.normalIntRange(...this.def.dr); }
  damageRoll() {
    const r = this.w.rnd;
    if (this.isGoo) {
      const min = 1, max = this.enraged() ? 12 : 8;
      if (this.pumped > 0) { this.pumped = 0; return r.normalIntRange(min * 3, max * 3); }
      return r.normalIntRange(min, max);
    }
    return r.normalIntRange(...this.def.dmg);
  }
  spend(dt) { this.next += dt; }
  damage(n, src) {
    if (this.hp <= 0) return;
    const wasEnraged = this.enraged();
    this.hp -= n; this.w.emit({ t: 'damage', id: this.id, amount: n, hp: this.hp });
    if (this.hp <= 0) return this.die();
    if (this.state === SLEEPING) this.state = WANDERING;
    if (src === this.w.hero) { this.state = HUNTING; this.target = this.w.hero.pos; this.enemySeen = true; if (this.isGoo) this.#notice(); }
    if (this.isGoo && this.enraged() && !wasEnraged) { this.w.msg('Goo is enraged!', 'warn'); this.w.emit({ t: 'enrage', id: this.id }); }
  }
  die() {
    const w = this.w; this.hp = 0;
    w.emit({ t: 'die', id: this.id, pos: this.pos }); w.kills++;
    w.msg(`The ${this.def.name} dies.`, 'good');
    if (this.def.loot?.gold && w.rnd.float() < this.def.loot.gold && !w.items.has(this.pos)) { const it = { type: 'gold', key: 'gold', qty: w.rnd.range(15, 45) }; w.items.set(this.pos, it); w.emit({ t: 'drop', pos: this.pos, item: it }); }
    if (w.hero.lvl <= this.def.maxLvl) w.hero.earnExp(this.def.exp);
    if (this.isGoo) { w.sealed = false; w.msg('Goo is defeated! The way down is open.', 'good'); w.emit({ t: 'unseal' }); }
  }
  #notice() {
    const w = this.w;
    w.emit({ t: 'alert', id: this.id });
    if (this.isGoo && !w.sealed && this.hp > 0) { w.sealed = true; w.msg('GLUUURP! The Goo has noticed you!', 'bad'); w.emit({ t: 'seal' }); }
  }
  canAttack() {
    const w = this.w, h = w.hero;
    if (this.pumped > 0) return dist(w.w, this.pos, h.pos) <= 2 && !!this.fov[h.pos];
    return adjacent(w.w, this.pos, h.pos);
  }
  /** One action (Mob.act): update sight, run the AI state, spend time. */
  act() {
    const w = this.w, h = w.hero, rnd = w.rnd;
    if (this.isGoo) { // heals in water; pumped-up state breaks when it stops hunting (Goo.act)
      if (this.state !== HUNTING && this.pumped > 0) this.pumped = 0;
      if (w.isWater(this.pos) && this.hp < this.ht) { this.hp++; w.emit({ t: 'heal', id: this.id, amount: 1 }); }
    }
    const near = dist(w.w, this.pos, h.pos) <= VIEW + 1;
    if (near) { const [x, y] = w.xy(this.pos); castShadow(x, y, w.w, this.fov, w.sight, VIEW); }
    const inFov = near && !!this.fov[h.pos] && h.hp > 0;
    const justAlerted = this.alerted; this.alerted = false;
    for (let pass = 0; pass < 2; pass++) {
      const before = this.next;
      if (this.state === SLEEPING) this.#sleeping(inFov);
      else if (this.state === WANDERING) this.#wandering(inFov, justAlerted);
      else this.#hunting(inFov);
      if (this.next > before) break; // spent time → done (a pure state change gets another pass, like SPD's `return true` without spend)
    }
  }
  #detect(factor) { const w = this.w; return 1 / (dist(w.w, this.pos, w.hero.pos) / factor + w.hero.stealth()); }
  #sleeping(inFov) {
    if (inFov && this.w.rnd.float() < this.#detect(1)) { this.enemySeen = true; this.#notice(); this.state = HUNTING; this.target = this.w.hero.pos; this.spend(1); return; }
    this.enemySeen = false; this.spend(1);
  }
  #wandering(inFov, justAlerted) {
    const w = this.w;
    if (inFov && (justAlerted || w.rnd.float() < this.#detect(2))) { this.enemySeen = true; this.#notice(); this.alerted = true; this.state = HUNTING; this.target = w.hero.pos; return; }
    this.enemySeen = false;
    if (this.target >= 0 && this.target !== this.pos && this.getCloser(this.target)) { this.spend(1 / this.speed()); return; }
    this.target = w.randomFloor(); this.spend(1);
  }
  #hunting(inFov) {
    const w = this.w, h = w.hero;
    this.enemySeen = inFov;
    if (inFov && this.canAttack()) return this.#doAttack();
    if (inFov) this.target = h.pos;
    if (this.target >= 0 && this.target !== this.pos && this.getCloser(this.target)) { this.spend(1 / this.speed()); return; }
    // lost the hero (or cannot reach it): go back to wandering
    if (!inFov) { this.state = WANDERING; this.target = w.randomFloor(); w.emit({ t: 'lost', id: this.id }); }
    this.spend(1);
  }
  #doAttack() {
    const w = this.w, h = w.hero, r = w.rnd;
    if (this.isGoo) { // pump-up logic from Goo.doAttack
      if (this.pumped === 1) { this.pumped++; w.emit({ t: 'pump', id: this.id, level: 2 }); this.spend(1); return; }
      if (this.pumped >= 2 || r.int(this.enraged() ? 2 : 5) > 0) { /* fall through to a normal / pumped attack */ }
      else { this.pumped++; w.emit({ t: 'pump', id: this.id, level: 1 }); w.msg('Goo is pumping itself up!', 'warn'); this.spend(1); return; }
    }
    const pumped = this.pumped > 0;
    const hit = r.float(this.attackSkill()) >= r.float(h.defenseSkillFor());
    w.emit({ t: 'attack', id: this.id, target: h.id, hit, pumped });
    if (hit) {
      const dmg = Math.max(0, this.damageRoll() - h.drRoll());
      w.msg(`The ${this.def.name} hits you for ${dmg}.`, 'bad');
      h.damage(dmg, this);
      if (this.isGoo && r.int(3) === 0 && !w.isWater(h.pos)) { h.ooze = 20; w.msg('You are covered in caustic ooze! Wash it off in water.', 'bad'); }
    } else { w.msg(`You dodge the ${this.def.name}'s attack.`); if (this.isGoo) this.pumped = 0; }
    if (this.isGoo) this.pumped = 0;
    this.spend(1);
  }
  /** One step towards `target` along the BFS map (Mob.getCloser); false when blocked. */
  getCloser(target) {
    const w = this.w; if (this.isGoo) this.pumped = 0;
    const dm = w.distTo(target), here = dm[this.pos];
    if (here === 0x7fff) return false;
    let best = -1, bd = here;
    const opts = neighbours(w.w, w.h, this.pos);
    rndShuffle(w.rnd, opts);
    for (const n of opts) {
      if (!w.passable(n) || w.occupied(n) || n === w.upCell || n === w.downCell) continue;
      if (dm[n] < bd) { bd = dm[n]; best = n; }
    }
    if (best < 0) return false;
    w.moveActor(this, best);
    return true;
  }
}
const rndShuffle = (r, a) => r.shuffle(a);
