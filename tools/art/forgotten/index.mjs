// Forgotten Wars art pack → tools/examples/forgotten/assets/…  (run: node tools/pixelart.mjs forgotten --preview)
import { PAL as TPAL, TEAMS, TILES } from './tiles.mjs';
import { BUILDINGS } from './buildings.mjs';
import { PAL as UPAL, UNITS, UNIT_NAMES } from './units.mjs';
import { PAL as UIPAL, UI, UI_NAMES, ICON_NAMES, ICONS, FX, FX_NAMES } from './ui.mjs';

import { font } from '../noom/font.mjs';

export const id = 'forgotten';
const TEAM_NAMES = ['ember', 'cobalt']; // rows of the unit sheet; 'none' only exists for neutral properties
const maskBits = { N: 1, E: 2, S: 4, W: 8 };

export default (px) => {
  const pal = (team) => ({ ...TPAL, ...TEAMS[team] });
  const tile = (n, team = 'none') => px.grid(TILES[n] ?? BUILDINGS[n], pal(team), `tile:${n}`);
  const frames = [], names = {};
  const add = (n, img) => { names[n] = frames.length; frames.push(img); };
  // terrain
  for (const n of ['plain', 'forest', 'mountain', 'sea1', 'sea2', 'shoal', 'bridgeH', 'bridgeV']) add(n, tile(n));
  // roads and rivers: 16 neighbour masks (N=1 E=2 S=4 W=8) composed from drawn arms over plain grass
  for (const kind of ['road', 'river']) {
    for (let m = 0; m < 16; m++) {
      let vis = m; // dead ends and lone tiles run straight through (like the original tactics games)
      if (m === 0) vis = 10; else if (m === 1 || m === 4) vis = 5; else if (m === 2 || m === 8) vis = 10;
      const layers = [[tile('plain'), 0, 0], [tile(kind + 'Hub'), 0, 0]];
      for (const [d, bit] of Object.entries(maskBits)) if (vis & bit) layers.push([tile(kind + d), 0, 0]);
      add(`${kind}${m}`, px.compose(16, 16, layers));
    }
  }
  // properties: neutral + each team
  for (const b of ['city', 'factory', 'hq']) for (const t of ['none', ...TEAM_NAMES]) if (!(b === 'hq' && t === 'none')) add(`${b}_${t}`, tile(b, t));
  while (frames.length % 16) frames.push(px.blank(16, 16));
  const tiles = px.sheet(frames, 16);

  const unitFrames = [];
  for (const team of TEAM_NAMES) for (const u of UNIT_NAMES) for (const f of UNITS[u]) unitFrames.push(px.grid(f, { ...UPAL, ...TEAMS[team] }, `unit:${team}:${u}`));
  const units = px.sheet(unitFrames, UNIT_NAMES.length * 2);

  const uiImg = px.sheet(UI_NAMES.map((n) => px.grid(UI[n], UIPAL, `ui:${n}`)), 8);
  const fxImg = px.sheet(FX_NAMES.map((n) => px.grid(FX[n], UIPAL, `fx:${n}`)), 8);
  const iconImg = px.sheet(ICON_NAMES.map((n) => px.grid(ICONS[n], UIPAL, `icon:${n}`)), 8);

  const m = (w, h, extra) => ({ type: 'spritesheet', frameWidth: w, frameHeight: h, filter: 'nearest', ...extra });
  return [
    { out: 'assets/tiles/terrain.png', image: tiles, meta: m(16, 16, { tiles: names, note: 'road0..15 / river0..15 = neighbour masks N=1 E=2 S=4 W=8' }), preview: 4 },
    { out: 'assets/sprites/units.png', image: units, meta: m(16, 16, { framesPerRow: UNIT_NAMES.length * 2, note: 'rows: ember, cobalt · per row: for each unit [A,B] idle frames', units: UNIT_NAMES, teams: TEAM_NAMES }), preview: 4 },
    { out: 'assets/ui/ui.png', image: uiImg, meta: m(16, 16, { frames: Object.fromEntries(UI_NAMES.map((n, i) => [n, i])) }), preview: 4 },
    { out: 'assets/sprites/fx.png', image: fxImg, meta: m(16, 16, { frames: Object.fromEntries(FX_NAMES.map((n, i) => [n, i])) }), preview: 4 },
    { out: 'assets/ui/font.png', image: font(px), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_', charsPerRow: 16, note: 'white glyphs, tinted at runtime; upper-case only' }, preview: 4 },
    { out: 'assets/ui/icons.png', image: iconImg, meta: m(16, 16, { frames: Object.fromEntries(ICON_NAMES.map((n, i) => [n, i])) }), preview: 4 },
  ];
};
