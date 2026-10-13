// Base research (pure data + logic, node-testable). Modelled on OpenXcom's research tree, trimmed to 7 techs that change both halves of the game.
// Effects: soldier mods go to tactical.js newMission({ mods }), RTS mods to rts.js newRts({ mods }).
export const TECHS = [
  { id: 'alloys', name: 'ALIEN ALLOYS', days: 6, cost: 800, req: [], info: 'RTS: UNITS +25% HP', fx: { hp: 1.25 } },
  { id: 'armor', name: 'PERSONAL ARMOR', days: 8, cost: 1200, req: ['alloys'], info: 'SOLDIERS: +8 ARMOR', fx: { armor: 8 } },
  { id: 'stims', name: 'COMBAT STIMS', days: 5, cost: 700, req: [], info: 'SOLDIERS: +6 TU', fx: { tu: 6 } },
  { id: 'logistics', name: 'FIELD LOGISTICS', days: 7, cost: 900, req: [], info: 'RTS: +1500 START CASH', fx: { credits: 1500 } },
  { id: 'laser', name: 'LASER WEAPONS', days: 10, cost: 1800, req: ['alloys'], info: 'SOLDIERS: LASER RIFLE', fx: { weapon: 'laser' } },
  { id: 'elerium', name: 'ELERIUM POWER', days: 14, cost: 2800, req: ['laser'], info: 'SOLDIERS: PLASMA RIFLE', fx: { weapon: 'plasma' } },
  { id: 'turrets', name: 'PLASMA TURRETS', days: 9, cost: 2200, req: ['elerium'], info: 'RTS: YOUR DAMAGE +25%', fx: { dmg: 1.25 } },
];
export const newResearch = () => ({ done: [], active: null, progress: 0 });
export const tech = (id) => TECHS.find((t) => t.id === id);
export const status = (R, t) => (R.done.includes(t.id) ? 'DONE' : R.active === t.id ? 'ACTIVE' : t.req.every((r) => R.done.includes(r)) ? 'READY' : 'LOCKED');
/** start a project; returns an error string or null. `funds` is an object { v } so the caller sees the change. */
export function start(R, funds, id) {
  const t = tech(id); if (!t) return 'UNKNOWN'; const s = status(R, t);
  if (s === 'DONE') return 'ALREADY RESEARCHED'; if (s === 'LOCKED') return 'REQUIRES ' + t.req.filter((r) => !R.done.includes(r)).map((r) => tech(r).name).join(', ');
  if (R.active) return 'LAB BUSY'; if (funds.v < t.cost) return 'NOT ENOUGH FUNDS';
  funds.v -= t.cost; R.active = id; R.progress = 0; return null;
}
/** advance by `days` (scientists work 1 day per day); returns the tech that finished, or null */
export function advance(R, days) {
  if (!R.active) return null; R.progress += days; const t = tech(R.active);
  if (R.progress >= t.days) { R.done.push(t.id); R.active = null; R.progress = 0; return t; } return null;
}
/** merge the effects of finished techs: { hp, dmg, credits, armor, tu, weapon } */
export function mods(R) {
  const m = { hp: 1, dmg: 1, credits: 0, armor: 0, tu: 0, weapon: null };
  for (const id of R.done) { const f = tech(id).fx; if (f.hp) m.hp *= f.hp; if (f.dmg) m.dmg *= f.dmg; m.credits += f.credits ?? 0; m.armor += f.armor ?? 0; m.tu += f.tu ?? 0; if (f.weapon) m.weapon = f.weapon; }
  return m;
}
