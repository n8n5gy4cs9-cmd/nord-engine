// Noom level 1 — "Crypt of the Baron". Hand-designed: rooms are rectangles carved into solid brick, then doors, props, pickups and
// monsters are placed by hand (cell coordinates, 1 cell = 64 Doom units). Wall textures: 0 brick, 1 moss, 2 crypt frieze, 3 hell.
export const W = 40, H = 36;
export const WALL_TEX = { brick: 0, moss: 1, crypt: 2, hell: 3 };

// rooms: x,y,w,h (interior cells); wall = texture for the walls around the room; floor: 0 flags, 1 blood-stained, 2 hell flags
export const ROOMS = [
  { id: 'start', x: 3, y: 27, w: 9, h: 7, wall: 'crypt', floor: 1 },
  { id: 'hall', x: 13, y: 23, w: 15, h: 11, wall: 'brick', floor: 0 },
  { id: 'stairs', x: 20, y: 18, w: 1, h: 5, wall: 'brick', floor: 0 },
  { id: 'weapon', x: 15, y: 11, w: 11, h: 7, wall: 'crypt', floor: 0 },
  { id: 'east', x: 26, y: 13, w: 5, h: 1, wall: 'brick', floor: 0 },
  { id: 'keydoor', x: 30, y: 11, w: 1, h: 2, wall: 'brick', floor: 0 }, // x30, y11..12 (the K door sits at 30,11 → boss room at y<=10)
  { id: 'boss', x: 28, y: 2, w: 11, h: 9, wall: 'hell', floor: 2 },
  { id: 'keyroom', x: 29, y: 24, w: 9, h: 8, wall: 'moss', floor: 1 },
  { id: 'north', x: 7, y: 18, w: 1, h: 9, wall: 'brick', floor: 0 },
  { id: 'ossuary', x: 2, y: 8, w: 11, h: 10, wall: 'moss', floor: 0 },
  { id: 'link', x: 13, y: 14, w: 2, h: 1, wall: 'brick', floor: 0 },
  { id: 'alcove', x: 3, y: 23, w: 3, h: 3, wall: 'crypt', floor: 0 },
];
// doors: D wooden, K blue-key door, S secret (looks like moss brick, slides up when used), X exit gate
export const DOORS = [
  { x: 12, y: 30, t: 'D' }, { x: 20, y: 22, t: 'D' }, { x: 28, y: 28, t: 'D' }, { x: 7, y: 26, t: 'D' }, { x: 13, y: 14, t: 'D' },
  { x: 30, y: 11, t: 'K' }, { x: 4, y: 26, t: 'S' }, { x: 33, y: 1, t: 'X' },
];
// solid pillars carved back into the rooms
export const PILLARS = [[16, 26], [16, 30], [20, 26], [20, 30], [24, 26], [24, 30], [18, 13], [18, 15], [22, 13], [22, 15], [30, 4], [30, 8], [36, 4], [36, 8], [33, 6], [8, 12], [8, 14], [5, 12], [5, 15]];
// special wall cells that get another texture (frieze etc.)
export const WALL_OVERRIDES = [[5, 26, 2], [9, 26, 2], [20, 10, 2], [16, 10, 2], [24, 10, 2], [33, 11, 3]];
/** Standing torches / sconces (decor, give light): [x, y] */
export const TORCHES = [[4, 28], [10, 28], [4, 32], [10, 32], [14, 24], [26, 24], [14, 32], [26, 32], [18, 28], [22, 28], [16, 12], [24, 12], [16, 16], [24, 16], [7, 20], [3, 9], [11, 9], [3, 16], [11, 16], [30, 25], [37, 25], [30, 30], [37, 30], [29, 3], [37, 3], [29, 9], [37, 9], [33, 4], [33, 8], [4, 24], [20, 19]];
// things: t = type (see sim.js THINGS), x/y in cell units (cell centre = +0.5). facing in degrees (0 = east, 90 = south... 'angle' like Doom screen: 0 east, 90 north)
export const THINGS = [
  { t: 'player', x: 7, y: 31, a: 90 },
  // hall of columns
  { t: 'skeleton', x: 22, y: 25 }, { t: 'skeleton', x: 18, y: 32 }, { t: 'goblin', x: 25, y: 31 }, { t: 'goblin', x: 15, y: 28, sleep: true },
  { t: 'barrel', x: 24, y: 28 }, { t: 'barrel', x: 25, y: 28 }, { t: 'barrel', x: 24, y: 29 },
  { t: 'shells', x: 26, y: 24 }, { t: 'flask', x: 14, y: 33 }, { t: 'bones', x: 19, y: 29 }, { t: 'bones', x: 6, y: 29 },
  // start crypt: a little something to find
  { t: 'flask', x: 4, y: 33 }, { t: 'bones', x: 9, y: 32 },
  // weapon room
  { t: 'gun', x: 20, y: 14 }, { t: 'imp', x: 17, y: 12 }, { t: 'imp', x: 23, y: 16 }, { t: 'skeleton', x: 24, y: 12 }, { t: 'flask', x: 16, y: 16 }, { t: 'shells', x: 21, y: 14 }, { t: 'shells', x: 19, y: 14 },
  // ossuary (side loot, skeleton pack)
  { t: 'skeleton', x: 4, y: 10 }, { t: 'skeleton', x: 10, y: 10 }, { t: 'skeleton', x: 7, y: 15 }, { t: 'goblin', x: 4, y: 15 }, { t: 'shells', x: 3, y: 9 }, { t: 'shells', x: 11, y: 17 }, { t: 'bigflask', x: 12, y: 9 }, { t: 'bones', x: 6, y: 9 }, { t: 'bones', x: 9, y: 16 }, { t: 'flask', x: 3, y: 16 },
  // secret alcove behind the north wall of the start crypt
  { t: 'armor', x: 4, y: 24 }, { t: 'bigflask', x: 3, y: 23 }, { t: 'shells', x: 5, y: 25 },
  // key chamber
  { t: 'imp', x: 33, y: 26 }, { t: 'imp', x: 35, y: 29 }, { t: 'goblin', x: 31, y: 30 }, { t: 'goblin', x: 36, y: 25 }, { t: 'barrel', x: 32, y: 28 }, { t: 'barrel', x: 34, y: 27 }, { t: 'key', x: 37, y: 31 }, { t: 'bigflask', x: 30, y: 31, secret: true }, { t: 'shells', x: 37, y: 24 }, { t: 'bones', x: 34, y: 31 },
  // boss crypt
  { t: 'baron', x: 33, y: 5 }, { t: 'skeleton', x: 29, y: 9 }, { t: 'skeleton', x: 37, y: 9 }, { t: 'shells', x: 29, y: 3 }, { t: 'shells', x: 37, y: 3 }, { t: 'bigflask', x: 37, y: 10 }, { t: 'flask', x: 29, y: 10 }, { t: 'flask', x: 31, y: 9 },
  { t: 'flask', x: 28, y: 13 },
];
