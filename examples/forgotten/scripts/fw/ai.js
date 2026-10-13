// Forgotten Wars — computer player. `aiNext(g)` returns ONE action for the army whose turn it is (so the view can animate each):
//   { unit, path, act: 'attack'|'capture'|'wait', target? }  |  { build: { x, y, type } }  |  { end: true }
// Scoring is deliberately simple: value of damage dealt − value of damage taken (counter + threat), capture bonuses, terrain stars, and a pull toward the
// nearest objective. Tunable weights are at the top.
import { UNITS, TERRAIN } from './data.js';
import { reach, pathTo, targetsFrom, damage, tileAt, unitAt, dist, enemyOf, canBuild, rand } from './rules.js';

export const W = { dmg: 1.0, taken: 0.9, threat: 0.14, stars: 2.5, capture: 60, hqCapture: 400, onProperty: 30, pull: 4, killBonus: 25 };
const PRODUCTION = [['tank', 4], ['artillery', 2], ['mdtank', 2], ['recon', 1.2], ['mech', 1.5], ['copter', 0.8], ['infantry', 1.5]];

const value = (u) => UNITS[u.type].cost / 100 * (u.hp / 100);
const objectives = (g, u) => {
  const foes = enemyOf(u.owner), out = [];
  if (UNITS[u.type].capture) for (let i = 0; i < g.tiles.length; i++) { const t = g.tiles[i]; if (TERRAIN[t.t].property && t.owner !== u.owner) out.push({ x: i % g.w, y: (i / g.w) | 0, w: t.t === 'hq' ? 3 : t.t === 'factory' ? 1.6 : 1 }); }
  if (!out.length || !UNITS[u.type].capture) for (const e of g.units) if (e.owner === foes) out.push({ x: e.x, y: e.y, w: 1 });
  return out;
};
function threat(g, u, x, y) {
  let sum = 0; const me = { ...u, x, y };
  for (const e of g.units) {
    if (e.owner === u.owner || e.hp <= 0) continue; const def = UNITS[e.type], d = Math.abs(e.x - x) + Math.abs(e.y - y);
    if (d > def.move + def.rng[1] || (def.indirect && d > def.rng[1] + 1)) continue;
    sum += damage(g, e, me) / 100 * UNITS[u.type].cost / 100 * (def.indirect ? 0.6 : 1);
  }
  return sum;
}

function planUnit(g, u) {
  const def = UNITS[u.type], r = reach(g, u), objs = objectives(g, u); let best = null;
  const foes = g.units.filter((e) => e.owner !== u.owner);
  for (const n of r.values()) {
    const t = tileAt(g, n.x, n.y); const here = { ...u, x: n.x, y: n.y }; let score = 0, act = 'wait', target = null;
    const moved = n.x !== u.x || n.y !== u.y;
    const near = foes.some((e) => dist(e, n) <= 9);
    if (near && !def.air) score += TERRAIN[t.t].stars * W.stars;
    if (t.t === 'factory' && t.owner === u.owner) score -= 30; // do not block production
    score -= threat(g, u, n.x, n.y) * W.threat * Math.max(0.3, 1 - g.day / 25); // grow bolder as the war drags on
    if (!(def.indirect && moved)) {
      for (const e of targetsFrom(g, u, n.x, n.y)) {
        const dealt = Math.min(damage(g, u, e), e.hp) / 100 * UNITS[e.type].cost / 100;
        let taken = 0; if (!def.indirect && !UNITS[e.type].indirect && damage(g, u, e) < e.hp) { const eh = e.hp - damage(g, u, e); taken = damage(g, e, here, { aHp: eh }) / 100 * def.cost / 100; }
        const s = score + dealt * W.dmg - taken * W.taken + (damage(g, u, e) >= e.hp ? W.killBonus : 0);
        if (!best || s > best.score) best = { score: s, n, act: 'attack', target: e };
      }
    }
    if (def.capture && TERRAIN[t.t].property && t.owner !== u.owner) { const s = score + (t.t === 'hq' ? W.hqCapture : W.capture) + (t.cap < 20 ? 20 : 0); if (!best || s > best.score) best = { score: s, n, act: 'capture' }; }
    // no fight here: drift toward objectives
    let pull = 0;
    if (objs.length) { let m = 1e9; for (const o of objs) m = Math.min(m, dist(n, o) / o.w); pull = -m * W.pull * (1 + g.day / 12); }
    if (def.indirect && foes.length) { const d = Math.min(...foes.map((e) => dist(n, e))); pull = -Math.abs(d - 3) * W.pull; } // keep artillery a few tiles back
    if (TERRAIN[t.t].property && t.owner === u.owner && u.hp < 70) score += W.onProperty * 2;
    const s = score + pull;
    if (!best || s > best.score) best = { score: s, n, act: 'wait' };
  }
  return best;
}

export function aiNext(g) {
  const me = g.current;
  const todo = g.units.filter((u) => u.owner === me && !u.acted);
  if (todo.length) {
    const foes = g.units.filter((e) => e.owner !== me);
    // closest-to-the-front first so the front line clears the way; capturers stay on their property
    const d = (u) => (foes.length ? Math.min(...foes.map((e) => dist(u, e))) : 0);
    todo.sort((a, b) => (UNITS[a.type].indirect - UNITS[b.type].indirect) || d(a) - d(b));
    const u = todo[0], p = planUnit(g, u);
    if (!p) return { unit: u, path: [{ x: u.x, y: u.y }], act: 'wait' };
    // an infantry already capturing keeps capturing
    return { unit: u, path: pathTo(p.n), act: p.act, target: p.target };
  }
  // production: one unit per free factory, spending sensibly
  const mine = g.units.filter((u) => u.owner === me), foes = g.units.filter((u) => u.owner !== me);
  const caps = mine.filter((u) => UNITS[u.type].capture).length;
  const factories = []; for (let i = 0; i < g.tiles.length; i++) { const t = g.tiles[i]; if (t.t === 'factory' && t.owner === me) factories.push({ x: i % g.w, y: (i / g.w) | 0 }); }
  const funds = g.funds[me], copters = foes.filter((e) => e.type === 'copter').length, tanks = foes.filter((e) => ['tank', 'mdtank'].includes(e.type)).length;
  for (const f of factories) {
    if (unitAt(g, f.x, f.y)) continue;
    let want;
    if (caps < 3 && canBuild(g, me, f.x, f.y, 'infantry')) want = 'infantry';
    else if (copters > 1 && canBuild(g, me, f.x, f.y, 'antiair')) want = 'antiair';
    else {
      const mdt = mine.filter((u) => u.type === 'mdtank').length, art = mine.filter((u) => u.type === 'artillery').length;
      const opts = PRODUCTION.filter(([t]) => canBuild(g, me, f.x, f.y, t)).map(([t, w]) => [t, t === 'artillery' && art >= 3 ? 0.1 : t === 'mdtank' ? w * (1 + tanks / 3) : w]);
      const total = opts.reduce((a, [, w]) => a + w, 0); let r = rand(g) * total;
      for (const [t, w] of opts) { r -= w; if (r <= 0) { want = t; break; } }
      if (!want && opts.length) want = opts[0][0];
    }
    if (want && canBuild(g, me, f.x, f.y, want)) return { build: { x: f.x, y: f.y, type: want } };
  }
  return { end: true };
}
