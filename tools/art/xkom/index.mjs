// X-KOM 2026 art pack → tools/examples/xkom/assets/…   (run: node tools/pixelart.mjs xkom --preview)
import * as T from './tactical.mjs';
import * as R from './rts.mjs';
import { font } from '../noom/font.mjs';
import * as GEO from './geo.mjs';
import * as AIR from './air.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const id = 'xkom';
export default (px) => {
  const m = (w, h, extra) => ({ type: 'spritesheet', frameWidth: w, frameHeight: h, filter: 'nearest', ...extra });
  const g = (rows, pal, name) => px.grid(rows, pal, name);
  // --- tactical ground: 32x16 diamonds ---
  const gnames = ['grass', 'dirt', 'metal', 'field', 'road'];
  const ground = px.sheet(gnames.map((n) => g(T.GROUND[n], T.PAL, `ground:${n}`)), 5);
  // --- blocks (32x32): top diamond + left face + mirrored right face, painted per material ---
  const blockNames = Object.keys(T.MATERIALS);
  const blocks = blockNames.map((n) => {
    const M = T.MATERIALS[n], pal = { ...T.PAL, T: M.T, t: M.t };
    const top = g(T.BLOCK_TOP, pal, `${n}:top`);
    const left = px.blank(16, 32), lrows = ['................'.repeat(1)];
    const leftImg = g([...Array(9).fill('................'), ...T.BLOCK_LEFT], { ...T.PAL, L: M.L, k: M.k }, `${n}:left`);
    const rightImg = px.flipH(g([...Array(9).fill('................'), ...T.BLOCK_LEFT], { ...T.PAL, L: M.RL, k: M.Rk }, `${n}:right`));
    void left; void lrows;
    return px.compose(32, 32, [[leftImg, 0, 0], [rightImg, 16, 0], [top, 0, 0]]);
  });
  const tree = g(T.TREE, T.PAL, 'tree');
  const treeFrame = px.compose(32, 32, [[tree, 6, 6]]);
  const objects = px.sheet([...blocks, treeFrame], 5);
  // --- units: 16x24, per race [idle, walk, aim, shoot, dead] ---
  const races = { soldier: [T.SOLDIER_FRAMES, T.SOLDIER_DEAD], sectoid: [T.SECTOID_FRAMES, T.SECTOID_DEAD], muton: [T.MUTON_FRAMES, T.MUTON_DEAD] };
  const P = (r) => (r === 'sectoid' ? { ...T.PAL, s: '#9fb0b8', S: '#74868f' } : T.PAL); // sectoids are grey
  const uf = [];
  for (const [r, [fr, dead]] of Object.entries(races)) { for (const f of fr) uf.push(g(f, P(r), `unit:${r}`)); uf.push(g(dead, P(r), `dead:${r}`)); }
  const units = px.sheet(uf, 5);
  const ui = px.sheet([g(T.CURSOR, T.UI_PAL, 'cursor'), g(T.MOVE_TILE, T.UI_PAL, 'move'), g(T.HIT_TILE, T.UI_PAL, 'hit')], 3);
  const fx = px.sheet(T.FX_NAMES.map((n) => g(T.FX[n], T.UI_PAL, `fx:${n}`)), 8);
  // --- geoscape: world.png composed from 8x8 tiles following assets/geo/world.map; icons sheet ---
  const mapTxt = fs.readFileSync(path.join(px.ROOT ?? process.cwd(), 'tools/examples/xkom/assets/geo/world.map'), 'utf8').split('---\n')[1].trim().split('\n');
  const gt = Object.fromEntries(Object.entries(GEO.TILES).map(([k, r]) => [k, g(r, GEO.PAL, `geo:${k}`)]));
  const world = px.compose(mapTxt[0].length * 8, mapTxt.length * 8, mapTxt.flatMap((row, y) => [...row].map((ch, x) => [gt[ch], x * 8, y * 8])));
  const icons = px.sheet(GEO.ICON_NAMES.map((n) => g(GEO.ICONS[n], GEO.PAL, `icon:${n}`)), 4);
  const am = (w, h, extra) => ({ type: 'spritesheet', frameWidth: w, frameHeight: h, filter: 'nearest', ...extra });
  const air = [
    { out: 'assets/air/jet.png', image: px.sheet(AIR.JET_FRAMES.map((f) => g(f, AIR.PAL, 'jet')), 2), meta: am(24, 24, { note: '2 frames: exhaust long, exhaust short' }), preview: 4 },
    { out: 'assets/air/saucer.png', image: px.sheet(AIR.SAUCER_FRAMES.map((f) => g(f, AIR.PAL, 'saucer')), 2), meta: am(24, 16, { note: '2 frames: lights yellow / red' }), preview: 4 },
    { out: 'assets/air/drone.png', image: px.sheet(AIR.DRONE_FRAMES.map((f) => g(f, AIR.PAL, 'drone')), 2), meta: am(12, 12, { note: '2 frames: wings' }), preview: 4 },
    { out: 'assets/air/shots.png', image: px.sheet(AIR.SHOTS.map((f) => g(f, AIR.PAL, 'shot')), 4), meta: am(8, 8, { frames: { laser: 0, plasmaA: 1, plasmaB: 2, spark: 3 } }), preview: 6 },
    { out: 'assets/air/dart.png', image: px.sheet(AIR.DART_FRAMES.map((f) => g(f, AIR.PAL, 'dart')), 2), meta: am(14, 14, { note: '2 frames: wing flicker. Fast diving enemy fighter (faces down)' }), preview: 4 },
    { out: 'assets/air/turret.png', image: px.sheet(AIR.TURRET_FRAMES.map((f) => g(f, AIR.PAL, 'turret')), 2), meta: am(16, 16, { note: '2 frames: idle, firing (yellow core). Ground emplacement, scrolls with the sea' }), preview: 4 },
    { out: 'assets/air/pickups.png', image: px.sheet(AIR.PICKUP_FRAMES.map((f) => g(f, AIR.PAL, 'pickup')), 3), meta: am(12, 12, { frames: { power: 0, missiles: 1, shield: 2 } }), preview: 6 },
    { out: 'assets/air/island.png', image: px.compose(48, 32, [[g(AIR.ISLAND.concat(Array(32 - AIR.ISLAND.length).fill('.'.repeat(48))), AIR.PAL, 'island'), 0, 0]]), meta: { type: 'image', filter: 'nearest', note: 'ground scenery that scrolls with the sea; turrets sit on it' }, preview: 4 },
    { out: 'assets/air/cloud.png', image: g(AIR.CLOUD, AIR.PAL, 'cloud'), meta: { type: 'image', filter: 'nearest' }, preview: 4 },
    { out: 'assets/air/sea.png', image: g(AIR.SEA, AIR.PAL, 'sea'), meta: { type: 'image', filter: 'nearest', note: 'tiled + scrolled as the background' }, preview: 4 },
  ];
  const rts = R.build(px, ['xcom']);
  return [
    { out: 'assets/tactical/ground.png', image: ground, meta: m(32, 16, { frames: Object.fromEntries(gnames.map((n, i) => [n, i])) }), preview: 4 },
    { out: 'assets/tactical/objects.png', image: objects, meta: m(32, 32, { frames: Object.fromEntries([...blockNames, 'tree'].map((n, i) => [n, i])), note: 'blocks: diamond top at rows 0..15, faces below; their ground diamond is rows 16..31' }), preview: 4 },
    { out: 'assets/tactical/units.png', image: units, meta: m(16, 24, { framesPerRace: 5, races: Object.keys(races), note: 'per race: idle, walk, aim, shoot, dead. Walk = idle with legs swapped; shoot = aim + muzzle flash', }), preview: 4 },
    { out: 'assets/tactical/ui.png', image: ui, meta: m(32, 16, { frames: { cursor: 0, move: 1, hit: 2 } }), preview: 4 },
    { out: 'assets/tactical/fx.png', image: fx, meta: m(16, 16, { frames: Object.fromEntries(T.FX_NAMES.map((n, i) => [n, i])) }), preview: 4 },
    { out: 'assets/ui/font.png', image: font(px), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_', charsPerRow: 16, note: 'white glyphs, tinted at runtime; upper-case only' }, preview: 4 },
    { out: 'assets/geo/world.png', image: world, meta: { type: 'image', filter: 'nearest', note: 'one 8x8 tile per character of world.map' }, preview: 2 },
    { out: 'assets/geo/icons.png', image: icons, meta: m(16, 16, { frames: Object.fromEntries(GEO.ICON_NAMES.map((n, i) => [n, i])) }), preview: 4 },
    ...air,
    ...rts,
  ];
};
