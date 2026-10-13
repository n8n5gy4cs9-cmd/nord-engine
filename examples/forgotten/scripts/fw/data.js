// Forgotten Wars — game data. Edit this file to rebalance or add units/terrain; nothing else needs to change.
// Rules follow the publicly documented Advance Wars 2 model (terrain stars, move types, HP-scaled damage, counter-attacks, capturing).
// The numbers below are a hand-typed PoC subset; the aw2bhr decompilation (asm only) contains no readable tables — see GUIDE.md.

export const ARMIES = {
  ember: { name: 'EMBER LEGION', co: 'MARSHAL RUDD', color: '#ff7a3c' },
  cobalt: { name: 'COBALT PACT', co: 'GENERAL VESK', color: '#5f9af0' },
};
export const ORDER = ['ember', 'cobalt'];

// Move types: movement cost per terrain id; missing = impassable.
export const MOVE = {
  foot:  { plain: 1, forest: 1, mountain: 2, road: 1, river: 2, shoal: 1, bridge: 1, city: 1, factory: 1, hq: 1 },
  mech:  { plain: 1, forest: 1, mountain: 1, road: 1, river: 1, shoal: 1, bridge: 1, city: 1, factory: 1, hq: 1 },
  tread: { plain: 1, forest: 2, road: 1, shoal: 1, bridge: 1, city: 1, factory: 1, hq: 1 },
  tires: { plain: 2, forest: 3, road: 1, shoal: 1, bridge: 1, city: 1, factory: 1, hq: 1 },
  air:   { plain: 1, forest: 1, mountain: 1, road: 1, river: 1, sea: 1, shoal: 1, bridge: 1, city: 1, factory: 1, hq: 1 },
};

// Terrain: stars (defence), name. Roads/rivers are autotiled by the view.
export const TERRAIN = {
  plain: { name: 'PLAIN', stars: 1 }, forest: { name: 'WOODS', stars: 2 }, mountain: { name: 'MOUNTAIN', stars: 4 },
  road: { name: 'ROAD', stars: 0 }, river: { name: 'RIVER', stars: 0 }, sea: { name: 'SEA', stars: 0 }, shoal: { name: 'SHOAL', stars: 0 }, bridge: { name: 'BRIDGE', stars: 0 },
  city: { name: 'CITY', stars: 3, property: true }, factory: { name: 'FACTORY', stars: 3, property: true }, hq: { name: 'HQ', stars: 4, property: true },
};
// Map file characters. Upper/lower letters are owned properties (see assets.md).
export const LEGEND = {
  '.': ['plain'], f: ['forest'], m: ['mountain'], '=': ['road'], r: ['river'], '~': ['sea'], s: ['shoal'], b: ['bridge'],
  c: ['city', null], k: ['factory', null], A: ['hq', 'ember'], a: ['factory', 'ember'], e: ['city', 'ember'], Z: ['hq', 'cobalt'], z: ['factory', 'cobalt'], x: ['city', 'cobalt'],
};

// name, cost, move, move type, [minRange, maxRange], indirect (cannot move and fire), captures, air
export const UNITS = {
  infantry:  { name: 'INFANTRY',  cost: 1000,  move: 3, mt: 'foot',  rng: [1, 1], capture: true },
  mech:      { name: 'MECH',      cost: 3000,  move: 2, mt: 'mech',  rng: [1, 1], capture: true },
  recon:     { name: 'RECON',     cost: 4000,  move: 8, mt: 'tires', rng: [1, 1] },
  tank:      { name: 'TANK',      cost: 7000,  move: 6, mt: 'tread', rng: [1, 1] },
  mdtank:    { name: 'MD.TANK',   cost: 16000, move: 5, mt: 'tread', rng: [1, 1] },
  artillery: { name: 'ARTILLERY', cost: 6000,  move: 5, mt: 'tread', rng: [2, 3], indirect: true },
  antiair:   { name: 'ANTI-AIR',  cost: 8000,  move: 6, mt: 'tread', rng: [1, 1] },
  copter:    { name: 'B-COPTER',  cost: 9000,  move: 6, mt: 'air',   rng: [1, 1], air: true },
};
export const BUILD_LIST = ['infantry', 'mech', 'recon', 'tank', 'mdtank', 'artillery', 'antiair', 'copter'];

// Base damage % (attacker row → defender column). null = cannot attack that target. Order of columns = BUILD_LIST.
const COLS = BUILD_LIST;
const ROWS = {
  infantry:  [55, 45, 12, 5, 1, 15, 5, 7],
  mech:      [65, 55, 85, 55, 15, 70, 65, 9],
  recon:     [70, 65, 35, 6, 1, 45, 4, 12],
  tank:      [75, 70, 85, 55, 15, 70, 65, 10],
  mdtank:    [105, 95, 105, 85, 55, 105, 105, 12],
  artillery: [90, 85, 80, 70, 45, 75, 75, null],
  antiair:   [105, 105, 60, 25, 10, 50, 45, 120],
  copter:    [75, 75, 55, 55, 25, 65, 25, 65],
};
export const BASE = Object.fromEntries(Object.entries(ROWS).map(([a, r]) => [a, Object.fromEntries(COLS.map((d, i) => [d, r[i]]))]));

export const START_FUNDS = 5000, INCOME = 1000, REPAIR = 20, CAPTURE_POINTS = 20;
