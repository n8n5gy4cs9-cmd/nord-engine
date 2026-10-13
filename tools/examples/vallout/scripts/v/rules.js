// Fallout-2 rules port (pure). Formulas follow fallout2-ce (src/combat.cc attackDetermineToHit, stat.cc, skill.cc) with sfall-era fixes:
//  · Perception distance bonus uses (PE-2)*2 for the player (sfall "Sharpshooter" fix baseline) and is capped at -2*PE.
//  · AC never negative; to-hit clamped to [5,95] (sfall to-hit cap); unspent AP add to AC during the enemy turn (F2 behaviour).
import { ITEMS, SKILLS } from './data.js';

export const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const rand = Math.random;
export const rnd = (a, b, r = rand) => a + Math.floor(r() * (b - a + 1));
export const roll100 = (r = rand) => 1 + Math.floor(r() * 100);

/** Derived stats from SPECIAL (stat.cc). */
export function derived(S) {
  return { maxHp: 15 + S.ST + 2 * S.EN, ap: 5 + Math.floor(S.AG / 2), ac: S.AG, carry: 25 + 25 * S.ST, seq: 2 * S.PE, heal: Math.max(1, Math.floor(S.EN / 3)), crit: S.LK, mdb: Math.max(0, S.ST - 5), sight: 6 + S.PE };
}
/** Base skill values (skill.cc) + tag bonus + points spent. */
export function skillValue(c, id) {
  const S = c.S;
  const base = { guns: 5 + 4 * S.AG, unarmed: 30 + 2 * (S.AG + S.ST), melee: 20 + 2 * (S.ST + S.AG), speech: 5 * S.CH, repair: 3 * S.IN, doctor: 5 + S.PE + S.IN }[id];
  return Math.min(200, base + (c.tags?.includes(id) ? 20 : 0) + (c.sk?.[id] ?? 0));
}
export const xpForLevel = (lvl) => 100 * lvl * (lvl + 1) / 2;       // level 2 at 200 xp, 3 at 500, 4 at 900 …
export const skillPointsPerLevel = (S) => 5 + 2 * S.IN;
export const hpPerLevel = (S) => 2 + Math.floor(S.EN / 2);

export const heldWeapon = (c) => ITEMS[c.weapon] ?? ITEMS.fists;
export const modeOf = (w, i) => w.modes[Math.min(i ?? 0, w.modes.length - 1)];
export const armorOf = (c) => ITEMS[c.armor] ?? { ac: 0, dt: 0, dr: 0 };
export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Effective armor class of a defender (AC + armor + leftover AP during enemy turn). */
export function armorClass(d, apBonus = false) {
  let ac = (d.def?.ac ?? (d.S ? derived(d.S).ac : 0)) + (d.armor ? armorOf(d).ac : 0);
  if (apBonus && d.ap > 0) ac += d.ap;
  return Math.max(0, ac);
}

/** Hit chance (%) of attacker with weapon/mode vs defender. `a` is an actor: player {S,tags,sk,weapon,…} or enemy {def}. */
export function toHit(a, d, w, mode, distance, { lof = 0, defAP = false } = {}) {
  const isPlayer = !!a.S;
  let hit, ranged = mode.kind === 'ranged';
  if (!isPlayer) hit = a.def.skill;
  else hit = skillValue(a, mode.kind === 'unarmed' ? 'unarmed' : w.skill);
  if (ranged) {
    const PE = isPlayer ? a.S.PE : 5;
    let dm = distance - (isPlayer ? 2 * (PE - 2) : 2 * PE);   // F2: perceptionBonusMult * (PE-2) for the dude
    if (dm < -2 * PE) dm = -2 * PE;
    hit += dm * -4;
    hit -= 10 * lof;                                            // other critters in the line of fire
  }
  if (isPlayer && w.minST && a.S.ST < w.minST) hit -= 20 * (w.minST - a.S.ST);
  hit -= armorClass(d, defAP);
  if (mode.aimed) hit -= 20;
  if (a.drunk > 0) hit -= 15;
  return Math.max(5, Math.min(95, Math.round(hit)));
}

/** Resolve one attack → {hit, crit, fumble, dmg}. */
export function attack(a, d, w, mode, distance, opts = {}, r = rand) {
  const chance = opts.sure ? 100 : toHit(a, d, w, mode, distance, opts), roll = roll100(r), out = { chance, roll, hit: roll <= chance, crit: false, fumble: false, dmg: 0 };
  if (opts.sure) out.hit = r() * 100 >= Math.min(40, armorClass(d) * 0.5);        // real-time mode: the aim already decided; AC gives a dodge chance
  if (!out.hit) { out.fumble = roll >= 96 && r() < 0.5; return out; }
  const isPlayer = !!a.S;
  const critCh = (isPlayer ? derived(a.S).crit : 5) + (mode.aimed ? 25 : 0);
  out.crit = roll100(r) <= critCh;
  const [lo, hi] = isPlayer ? (mode.dmg ?? w.dmg) : a.def.atk.dmg;
  let dmg = rnd(lo, hi, r);
  if (isPlayer && mode.kind !== 'ranged') dmg += derived(a.S).mdb + (a.drunk > 0 && mode.kind === 'unarmed' ? 2 : 0);
  if (mode.aimed) dmg += 2;
  const dt = d.armor ? armorOf(d).dt : d.def?.dt ?? 0, dr = d.armor ? armorOf(d).dr : d.def?.dr ?? 0;
  if (out.crit) dmg *= 2; else { dmg = Math.max(0, dmg - dt); dmg = Math.floor(dmg * (1 - dr / 100)); }
  out.dmg = Math.max(out.crit ? 1 : 0, dmg);
  return out;
}

export function healAmount(c, item) { const [lo, hi] = item.heal; return rnd(lo, hi) + (item.icon === 'salmiakki' ? Math.floor(skillValue(c, 'doctor') / 20) : 0); }

/** Carry weight of an inventory [{id,n}]. */
export const weightOf = (inv) => inv.reduce((s, it) => s + (ITEMS[it.id]?.w ?? 0) * it.n, 0);
export const canSkill = (c, name, target, r = rand) => roll100(r) <= Math.max(5, Math.min(95, skillValue(c, name) - target + 50 + (c.S.LK - 5) * 2)); // soft check: base ≈ 50% at skill==target
export function newCharacter(preset) {
  const c = { name: 'Tero', S: { ...preset }, tags: [...(preset.tags ?? [])], sk: Object.fromEntries(SKILLS.map((s) => [s, 0])), lvl: 1, xp: 0, kills: 0, skillPts: 0, weapon: 'nokia', armor: 'denim', drunk: 0 };
  delete c.S.tags; const d = derived(c.S); c.maxHp = d.maxHp; c.hp = d.maxHp; return c;
}
export function addXp(c, n) { c.xp += n; let up = 0; while (c.xp >= xpForLevel(c.lvl)) { c.lvl++; up++; c.maxHp += hpPerLevel(c.S); c.hp = Math.min(c.maxHp, c.hp + hpPerLevel(c.S)); c.skillPts += skillPointsPerLevel(c.S); } return up; }
