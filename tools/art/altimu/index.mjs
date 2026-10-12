// Altimu 5.7 art pack → tools/examples/altimu/assets/…  (run: node tools/pixelart.mjs altimu --preview)
import { TILES, TILE_NAMES, PAL } from './tiles.mjs';
import { PEOPLE_NAMES, FRAMES_PER_PERSON, person, monsters, corpses } from './chars.mjs';
import { fx, FX_NAMES, ui, UI_NAMES } from './fx.mjs';
import { font } from '../noom/font.mjs';

export const id = 'altimu';
export default (px) => {
  const tileFrames = TILE_NAMES.map((n) => px.grid(TILES[n], PAL, `tile:${n}`));
  while (tileFrames.length % 16) tileFrames.push(px.blank(16, 16));
  const tiles = px.sheet(tileFrames, 16);
  const tilesMeta = { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', tiles: Object.fromEntries(TILE_NAMES.map((n, i) => [n, i])) };

  const folk = px.sheet(PEOPLE_NAMES.flatMap((k) => person(px, k)), FRAMES_PER_PERSON);
  const folkMeta = { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', framesPerRow: FRAMES_PER_PERSON, note: 'one row per person: front A,B · back A,B · side A,B (side faces right; the game mirrors it for left)', rows: Object.fromEntries(PEOPLE_NAMES.map((k, i) => [k, i])) };

  const m = monsters(px), c = corpses(px);
  const beasts = px.sheet([...m.wolf, ...m.spider, c.corpse_smith, c.corpse_gargoyle]);
  const beastsMeta = { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', frames: { wolf1: 0, wolf2: 1, spider1: 2, spider2: 3, corpse_smith: 4, corpse_gargoyle: 5 } };

  return [
    { out: 'assets/tiles/tiles.png', image: tiles, meta: tilesMeta, preview: 4 },
    { out: 'assets/sprites/folk.png', image: folk, meta: folkMeta, preview: 5 },
    { out: 'assets/sprites/beasts.png', image: beasts, meta: beastsMeta, preview: 6 },
    { out: 'assets/sprites/fx.png', image: fx(px), meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', frames: Object.fromEntries(FX_NAMES.map((n, i) => [n, i])) }, preview: 6 },
    { out: 'assets/ui/frame.png', image: ui(px), meta: { type: 'spritesheet', frameWidth: 8, frameHeight: 8, filter: 'nearest', frames: Object.fromEntries(UI_NAMES.map((n, i) => [n, i])) }, preview: 6 },
    { out: 'assets/ui/font.png', image: font(px), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_', charsPerRow: 16, note: 'white glyphs, tinted at runtime; upper-case only' }, preview: 4 },
  ];
};
