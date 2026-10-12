// RetroPaxDungeons art → tools/examples/retropaxdungeons/assets/**  (run: node tools/pixelart.mjs rpd [--preview])
import * as T from './tiles.mjs';
import * as C from './chars.mjs';
import * as I from './items.mjs';

export const id = 'retropaxdungeons';
export default (px) => {
  const out = [];
  const P = (g, pal, n) => px.grid(g, pal, n, { pad: true });
  // ---- tiles
  const tiles = [['void'], ['floor1', T.floor1], ['floor2', T.floor2], ['floor3', T.floor3], ['wallFace', T.wallFace], ['wallTop', T.wallTop], ['wallMoss', T.wallMoss], ['wallTorch', T.wallTorch],
    ['doorClosed', T.doorClosed], ['doorOpen', T.doorOpen], ['stairsDown', T.stairsDown], ['stairsUp', T.stairsUp], ['water1', T.water1], ['water2', T.water2], ['grass', T.grass], ['floorBones', T.floorBones]];
  out.push({ out: 'assets/tiles/dungeon.png', preview: 5, image: px.sheet(tiles.map(([n, g]) => (g ? px.grid(g, T.PAL, `tile:${n}`) : px.compose(16, 16, [[px.grid(Array(16).fill('K'.repeat(16)), T.PAL), 0, 0]]))), 16),
    meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', tiles: Object.fromEntries(tiles.map(([n], i) => [n, i])) } });

  // ---- hero (puppet: head / torso / legs / sword drawn separately, then assembled into frames)
  const hp = C.HERO_PAL;
  const head = P(C.heroHead, hp, 'hero.head'), torso = P(C.heroTorso, hp, 'hero.torso'), legs = P(C.heroLegs, hp, 'hero.legs'), legsA = P(C.heroLegsA, hp, 'hero.legsA'), legsB = P(C.heroLegsB, hp, 'hero.legsB');
  const sword = P(C.heroSword, hp, 'hero.sword'), thrust = P(C.heroThrust, hp, 'hero.thrust');
  const hero = (dy, lg, sw = sword, extra = []) => px.compose(16, 16, [[torso, 0, 8 + dy], [head, 0, 1 + dy], [lg, 0, 12], [sw, 0, 2 + dy], ...extra]);
  const heroFrames = [hero(0, legs), hero(1, legs), hero(1, legsA), hero(1, legsB), hero(0, legs, px.blank(16, 16), [[thrust, 0, 9 + 0]]), P(C.heroDead, hp, 'hero.dead')];
  out.push({ out: 'assets/sprites/hero.png', image: px.sheet(heroFrames), preview: 8,
    meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', anims: { idle: { frames: [0, 1], fps: 2, loop: true }, walk: { frames: [2, 3], fps: 8, loop: true }, attack: { frames: [4], fps: 1, loop: false }, dead: { frames: [5], fps: 1, loop: false } } } });

  // ---- mobs
  const mob = (name, pal, frames, anims) => out.push({ out: `assets/sprites/${name}.png`, image: px.sheet(frames.map((g, i) => P(g, pal, `${name}:${i}`))), preview: 8,
    meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', anims } });
  const std = { idle: { frames: [0, 1], fps: 2, loop: true }, attack: { frames: [2], fps: 1, loop: false }, dead: { frames: [3], fps: 1, loop: false } };
  mob('rat', C.RAT_PAL, [C.rat1, C.rat2, C.ratAtk, C.ratDead], std);
  mob('albino', { ...C.RAT_PAL, f: '#e8e2d6', g: '#fffaf0', d: '#bdb4a4', D: '#938a7c', e: '#ff3b50', p: '#f4a8a8', q: '#e08a95' }, [C.rat1, C.rat2, C.ratAtk, C.ratDead], std);
  mob('gnoll', C.GNOLL_PAL, [C.gnoll1, C.gnoll2, C.gnollAtk, C.gnollDead], std);
  mob('crab', C.CRAB_PAL, [C.crab1, C.crab2, C.crabAtk, C.crabDead], std);
  out.push({ out: 'assets/sprites/goo.png', preview: 4, image: px.sheet([C.goo1, C.goo2, C.gooPump, C.gooDead].map((g, i) => P(g, C.GOO_PAL, `goo:${i}`))),
    meta: { type: 'spritesheet', frameWidth: 32, frameHeight: 32, filter: 'nearest', anims: { idle: { frames: [0, 1], fps: 2, loop: true }, pump: { frames: [2], fps: 1, loop: false }, attack: { frames: [0], fps: 1, loop: false }, dead: { frames: [3], fps: 1, loop: false } } } });

  // ---- items (frame names → index in meta.items)
  const items = [['wornSword', I.worn, I.PAL], ['sword', I.sword, I.PAL], ['mace', I.mace, I.PAL], ['clothArmor', I.cloth, I.PAL], ['leatherArmor', I.leather, I.PAL],
    ...Object.entries(I.POTIONS).map(([n, pal]) => [`potion_${n}`, I.potion, pal]), ['scroll_rune', I.scroll, I.PAL], ['scroll_blue', I.scroll2, I.PAL], ['ration', I.ration, I.PAL], ['gold', I.gold, I.PAL], ['key', I.key, I.PAL]];
  out.push({ out: 'assets/sprites/items.png', preview: 6, image: px.sheet(items.map(([n, g, pal]) => P(g, pal, `item:${n}`).h === 16 ? P(g, pal, `item:${n}`) : fit16(px, P(g, pal, `item:${n}`))), 8),
    meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', items: Object.fromEntries(items.map(([n], i) => [n, i])) } });
  // ---- effect markers + UI
  const fx = [['excl', I.excl], ['quest', I.quest], ['zzz', I.zzz], ['spark', I.spark], ['slash1', I.slash1], ['slash2', I.slash2]];
  out.push({ out: 'assets/sprites/fx.png', preview: 6, image: px.sheet(fx.map(([n, g]) => fit16(px, P(g, I.FXPAL, `fx:${n}`)))), meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', fx: Object.fromEntries(fx.map(([n], i) => [n, i])) } });
  const ui = [['heart', I.heartUI, I.FXPAL], ['slot', I.slotUI, I.UIPAL], ['slotSel', I.slotSelUI, I.UIPAL]];
  out.push({ out: 'assets/ui/ui.png', preview: 6, image: px.sheet(ui.map(([n, g, pal]) => fit16(px, P(g, pal, `ui:${n}`)))), meta: { type: 'spritesheet', frameWidth: 16, frameHeight: 16, filter: 'nearest', ui: Object.fromEntries(ui.map(([n], i) => [n, i])) } });
  // ---- bitmap font: ASCII 32..95 in a 16-column sheet of 6x8 cells (Phaser RetroFont layout)
  const chars = Array.from({ length: 64 }, (_, i) => String.fromCharCode(32 + i));
  const cells = chars.map((c) => { const g = I.GLYPHS[c] ?? I.GLYPHS[' ']; const im = px.blank(6, 8); g.split('/').forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') im.d.set([255, 255, 255, 255], (y * 6 + x) * 4); })); return im; });
  out.push({ out: 'assets/ui/font.png', preview: 6, image: px.sheet(cells, 16), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: chars.join(''), charsPerRow: 16, note: 'white glyphs, tinted at runtime; upper-case only (lower-case is upper-cased by the game)' } });
  return out;
};
// canvas helper: place a drawn icon (any size ≤ 16) bottom-centred into a 16x16 frame
function fit16(px, im) { return im.w === 16 && im.h === 16 ? im : px.compose(16, 16, [[im, Math.floor((16 - im.w) / 2), 16 - im.h - (im.h <= 12 ? 1 : 0)]]); }
