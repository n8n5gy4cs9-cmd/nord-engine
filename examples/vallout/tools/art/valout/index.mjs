// Vallout 2: New Kerava — hand-typed pixel art. Build: node tools/pixelart.mjs valout [--preview]
import { groundTiles, wallBlocks, GROUND_NAMES, WALL_DEFS } from './tiles.mjs';
import { actors, FRAMES } from './actors.mjs';
import { props, PROP_NAMES, fx, FX_NAMES, items, ITEM_NAMES, ui, UI_NAMES } from './props.mjs';
const idx = (names) => Object.fromEntries(names.map((n, i) => [n, i]));
const sheet = (w, h, frames, extra = {}) => ({ type: 'spritesheet', frameWidth: w, frameHeight: h, filter: 'nearest', frames: idx(frames), ...extra });
export default async (px) => {
  const a = actors(px);
  return [
    { out: 'assets/tiles/ground.png', image: groundTiles(px), meta: sheet(32, 16, GROUND_NAMES, { framesPerRow: 8 }), preview: 3 },
    { out: 'assets/tiles/walls.png', image: wallBlocks(px), meta: sheet(32, 72, WALL_DEFS.map((d) => d[0]), { framesPerRow: 7 }), preview: 3 },
    { out: 'assets/sprites/props.png', image: props(px), meta: sheet(48, 48, PROP_NAMES, { framesPerRow: 5 }), preview: 3 },
    { out: 'assets/sprites/actors.png', image: a.sheet, meta: sheet(24, 32, FRAMES, { framesPerRow: FRAMES.length, rows: a.names, note: 'row per character; columns = frames' }), preview: 3 },
    { out: 'assets/sprites/boss.png', image: a.boss, meta: sheet(48, 64, FRAMES, { framesPerRow: FRAMES.length }), preview: 2 },
    { out: 'assets/sprites/fx.png', image: fx(px), meta: sheet(16, 16, FX_NAMES, { framesPerRow: 9 }), preview: 4 },
    { out: 'assets/ui/items.png', image: items(px), meta: sheet(16, 12, ITEM_NAMES, { framesPerRow: 10 }), preview: 4 },
    { out: 'assets/ui/ui.png', image: ui(px), meta: sheet(16, 16, UI_NAMES, { framesPerRow: 8 }), preview: 4 },
  ];
};
