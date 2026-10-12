// Noom art → tools/examples/noom/assets/**  (run: node tools/pixelart.mjs noom [--preview])
import * as W from './walls.mjs';
import * as SK from './skeleton.mjs';
import * as GB from './goblin.mjs';
import * as IM from './imp.mjs';
import * as BA from './baron.mjs';
import * as PR from './props.mjs';
import * as WP from './weapons.mjs';
import * as HD from './hud.mjs';
import { GLYPHS } from '../rpd/items.mjs'; // the hand-drawn 5x7 font is shared with RetroPaxDungeons

export const id = 'noom';
export default (px) => {
  const out = [];
  const G = (g, pal, n) => px.grid(g, pal, n, { pad: true });
  const wallFrom = (pal, units, layout) => {
    const t = px.blank(64, 64);
    layout.forEach((row, ci) => row.forEach((code, bi) => {
      const [, u, tn] = /^([abc])(-?\d)$/.exec(code); const img = G(W.tone(units[u], +tn), pal, `brick:${code}`);
      const x = bi * 16 + (ci % 2 ? 8 : 0);
      px.blit(t, img, x, ci * 8); if (x + 16 > 64) px.blit(t, img, x - 64, ci * 8);
    }));
    return t;
  };
  const units = { a: W.brickA, b: W.brickB, c: W.brickC };
  const brick = wallFrom(W.STONE, units, W.LAYOUT);
  const put = (t, g, pal, x, y, n) => px.blit(t, G(g, pal, n), x, y);
  // 1 brick (+cracks), 2 mossy brick
  const brickCracked = px.blit(px.blit(px.compose(64, 64, [[brick, 0, 0]]), G(W.crack1, W.STONE, 'crack1'), 40, 12), G(W.crack2, W.STONE, 'crack2'), 10, 38);
  const moss = px.compose(64, 64, [[brick, 0, 0]]);
  put(moss, W.mossDrip, W.MOSS, 6, 0, 'moss1'); put(moss, W.mossDrip, W.MOSS, 36, 0, 'moss2'); put(moss, W.mossLow, W.MOSS, 4, 58, 'moss3'); put(moss, W.mossLow, W.MOSS, 34, 56, 'moss4');
  // 3 crypt: bricks with a frieze of skulls
  const crypt = px.compose(64, 64, [[brick, 0, 0]]);
  for (let y = 24; y < 40; y++) for (let x = 0; x < 64; x++) crypt.d.set([21, 18, 31, 255], (y * 64 + x) * 4);
  for (const x of [1, 17, 33, 49]) put(crypt, W.skull, W.SKULL_PAL, x + 1, 25, 'skull');
  const hellUnits = px.compose(64, 64, [[wallFrom(W.FLESH, units, W.LAYOUT), 0, 0]]);
  put(hellUnits, W.veins, W.FLESH, 8, 12, 'veins1'); put(hellUnits, W.veins, W.FLESH, 40, 40, 'veins2'); put(hellUnits, W.rune, W.FLESH, 26, 26, 'rune');
  // torch wall = brick (sconce is drawn by the game as a prop sprite on top)
  out.push({ out: 'assets/textures/walls.png', preview: 3, image: px.sheet([brickCracked, moss, crypt, hellUnits], 4), meta: { type: 'texture-atlas', tile: 64, order: ['brick', 'moss', 'crypt', 'hell'] } });

  // ---- floor / ceiling / doors / exit gate: 64x64 surface atlas
  const floorFrom = (pal, tones) => { const t = px.blank(64, 64); tones.forEach((row, ry) => row.forEach((code, rx) => px.blit(t, G(W.tone(code[0] === 'a' ? W.flagA : W.flagB, +code.slice(1)), pal, `flag:${code}`), rx * 16, ry * 16))); return t; };
  const FL = [['a0', 'b-1', 'a1', 'b0'], ['b0', 'a0', 'b-1', 'a-1'], ['a-1', 'b1', 'a0', 'b0'], ['b0', 'a-1', 'b0', 'a1']];
  const floor = floorFrom(W.FLAG, FL);
  const floorBlood = px.compose(64, 64, [[floor, 0, 0]]); put(floorBlood, W.splat, W.BLOOD, 8, 10, 'splat'); put(floorBlood, W.splat, W.BLOOD, 40, 36, 'splat2'); put(floorBlood, W.splat, W.BLOOD, 22, 46, 'splat3');
  const floorHell = floorFrom(W.HELLFLAG, FL);
  const ceiling = floorFrom(W.CEIL, [['b0', 'a0', 'b0', 'a0'], ['a0', 'b0', 'a0', 'b0'], ['b0', 'a0', 'b0', 'a0'], ['a0', 'b0', 'a0', 'b0']]);
  const planks = (a, b) => { const t = px.blank(64, 64); for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) px.blit(t, G((i + j) % 2 ? a : b, W.WOOD, `plank${i}${j}`), i * 8, j * 16); return t; };
  const door = planks(W.plankA, W.plankB);
  px.blit(door, G(W.band, W.WOOD, 'band'), 0, 8); px.blit(door, G(W.band, W.WOOD, 'band'), 0, 50);
  for (let y = 0; y < 64; y++) { door.d.set([12, 10, 8, 255], (y * 64) * 4); door.d.set([12, 10, 8, 255], (y * 64 + 63) * 4); }
  const keyDoor = px.compose(64, 64, [[planks(W.plankA, W.plankB), 0, 0]]);
  px.blit(keyDoor, G(W.keyBand, W.WOOD, 'keyband'), 0, 8); px.blit(keyDoor, G(W.keyBand, W.WOOD, 'keyband'), 0, 50);
  px.blit(keyDoor, G(W.lock, W.WOOD, 'lock'), 24, 24); px.blit(keyDoor, G(W.keyhole, W.WOOD, 'keyhole'), 28, 40);
  for (let y = 0; y < 64; y++) { keyDoor.d.set([12, 10, 8, 255], (y * 64) * 4); keyDoor.d.set([12, 10, 8, 255], (y * 64 + 63) * 4); }
  const gh = G(W.gateHalf, W.GATE, 'gate'); const gate = px.compose(64, 64, [[gh, 0, 0], [gh, 32, 0, 'flip']]);
  const track = px.compose(64, 64, [[wallFrom(W.STONE, units, W.LAYOUT.map((r) => r.map((c) => c[0] + '-2'))), 0, 0]]);
  out.push({ out: 'assets/textures/surfaces.png', preview: 3, image: px.sheet([floor, floorBlood, floorHell, ceiling, door, keyDoor, gate, track], 4), meta: { type: 'texture-atlas', tile: 64, order: ['floor', 'floorBlood', 'floorHell', 'ceiling', 'door', 'keyDoor', 'exit', 'doorTrack'] } });

  // ---- skeleton archer: 32x48 frames
  const sk = (name) => G(SK[name], SK.PAL, `skeleton:${name}`);
  const fl = (g) => px.flipH(g);
  const SKW = 32, SKH = 48;
  const pose = ({ head = 'skull', hy = 1, ty = 13, legs = 'stand', arms = 'idle', bobY = 0 }) => {
    const L = [];
    const leg = sk('leg'), lift = sk('legLift');
    if (legs === 'stand') L.push([leg, 9, 30], [fl(leg), 17, 30]);
    else if (legs === 'stepL') L.push([lift, 8, 29], [fl(leg), 18, 30]);
    else if (legs === 'stepR') L.push([sk('legLift'), 18, 29, 'flip'], [leg, 8, 30]);
    L.push([sk('pelvis'), 10, 23 + bobY], [sk('torso'), 8, 12 + bobY + (ty - 13)]);
    if (arms === 'idle') L.push([sk('armDown'), 5, 13 + bobY], [sk('armDown'), 23, 13 + bobY, 'flip'], [sk('bow'), 0, 14 + bobY]);
    if (arms === 'draw') L.push([sk('armBack'), 23, 14 + bobY, 'flip'], [sk('armDown'), 5, 12 + bobY], [sk('bowDrawn'), 0, 10 + bobY], [sk('arrowNocked'), 6, 20 + bobY]);
    if (arms === 'loose') L.push([sk('armDown'), 23, 14 + bobY, 'flip'], [sk('armDown'), 5, 12 + bobY], [sk('bow'), 0, 10 + bobY]);
    L.push([sk(head), 10, hy + bobY]);
    return px.compose(SKW, SKH, L);
  };
  const skeleton = [
    pose({}), pose({ legs: 'stepL', bobY: -1 }), pose({ legs: 'stepR', bobY: -1 }), pose({ arms: 'draw' }), pose({ arms: 'loose', bobY: 1 }),
    pose({ head: 'skullHurt', arms: 'idle', bobY: 1 }),
    px.compose(SKW, SKH, [[G(SK.dead1, SK.PAL, 'dead1'), 0, 33]]), px.compose(SKW, SKH, [[G(SK.dead2, SK.PAL, 'dead2'), 0, 29]]), px.compose(SKW, SKH, [[G(SK.dead3, SK.PAL, 'dead3'), 0, 26]]),
  ];
  out.push({ out: 'assets/sprites/skeleton.png', preview: 4, image: px.sheet(skeleton, 9), meta: { type: 'spritesheet', frameWidth: SKW, frameHeight: SKH, filter: 'nearest', frames: ['stand', 'walk1', 'walk2', 'aim', 'shoot', 'pain', 'die1', 'die2', 'die3'], height: 1.8 } });

  // ---- goblin: 32x40 frames
  const gb = (n) => G(GB[n], GB.PAL, `goblin:${n}`);
  const GW = 32, GH = 40;
  const gpose = ({ head = 'head', legs = 'stand', arms = 'down', bob = 0, tilt = 0 }) => {
    const L = [];
    if (legs === 'stand') L.push([gb('legA'), 9, 31], [px.flipH(gb('legA')), 15, 31]);
    else if (legs === 'step1') L.push([gb('legStep'), 7, 31], [px.flipH(gb('legA')), 16, 29]);
    else L.push([px.flipH(gb('legStep')), 18, 31], [gb('legA'), 8, 29]);
    L.push([gb('torso'), 8 + tilt, 17 + bob], [gb(head), 8 + tilt, 5 + bob]);
    if (arms === 'down') L.push([gb('armFree'), 5 + tilt, 19 + bob], [gb('armHold'), 23 + tilt, 19 + bob], [gb('cleaverLow'), 22 + tilt, 24 + bob]);
    if (arms === 'raise') L.push([gb('armFree'), 5 + tilt, 19 + bob], [gb('armHold'), 23 + tilt, 14 + bob], [gb('cleaverUp'), 22 + tilt, 0 + bob]);
    if (arms === 'strike') L.push([gb('armFree'), 5 + tilt, 19 + bob], [gb('armHold'), 22 + tilt, 21 + bob], [gb('cleaverStrike'), 19 + tilt, 22 + bob]);
    return px.compose(GW, GH, L);
  };
  const gob = [
    gpose({}), gpose({ legs: 'step1', bob: -1 }), gpose({ legs: 'step2', bob: -1 }), gpose({ arms: 'raise', bob: -1 }), gpose({ arms: 'strike', bob: 2, tilt: -1 }), gpose({ head: 'headHurt', bob: 1, tilt: 1 }),
    px.compose(GW, GH, [[gb('dead1'), 0, 8]]), px.compose(GW, GH, [[gb('dead2'), 0, 8]]), px.compose(GW, GH, [[gb('dead3'), 0, 8]]),
  ];
  out.push({ out: 'assets/sprites/goblin.png', preview: 4, image: px.sheet(gob, 9), meta: { type: 'spritesheet', frameWidth: GW, frameHeight: GH, filter: 'nearest', frames: ['stand', 'walk1', 'walk2', 'windup', 'strike', 'pain', 'die1', 'die2', 'die3'], height: 1.35 } });

  // ---- imp: 40x52 frames
  const im = (n) => G(IM[n], IM.PAL, `imp:${n}`);
  const IW = 40, IH = 52;
  const ipose = ({ head = 'headHalf', legs = 'stand', arms = 'down', bob = 0 }) => {
    const L = [], leg = im('leg'), back = im('legBack');
    if (legs === 'stand') L.push([leg, 10, 38], [px.flipH(leg), 21, 38]);
    else if (legs === 'step1') L.push([leg, 8, 38], [px.flipH(back), 22, 36]);
    else L.push([px.flipH(leg), 23, 38], [back, 9, 36]);
    L.push([px.mirror(im('torsoHalf')), 10, 24 + bob], [px.mirror(im(head)), 12, 11 + bob]);
    if (arms === 'down') L.push([im('arm'), 4, 25 + bob], [px.flipH(im('arm')), 30, 25 + bob]);
    if (arms === 'cast') L.push([im('arm'), 4, 25 + bob], [im('armUp'), 30, 11 + bob], [im('fire'), 27, 1 + bob]);
    if (arms === 'throw') L.push([im('arm'), 4, 25 + bob], [px.flipH(im('arm')), 30, 27 + bob]);
    return px.compose(IW, IH, L);
  };
  const imp = [ipose({}), ipose({ legs: 'step1', bob: -1 }), ipose({ legs: 'step2', bob: -1 }), ipose({ arms: 'cast', bob: -1 }), ipose({ arms: 'throw', bob: 1 }), ipose({ head: 'headHurtHalf', bob: 1 }),
    px.compose(IW, IH, [[G(IM.dead1, IM.PAL, 'idead1'), 4, 30]]), px.compose(IW, IH, [[G(IM.dead2, IM.PAL, 'idead2'), 4, 31]]), px.compose(IW, IH, [[G(IM.dead3, IM.PAL, 'idead3'), 4, 32]])];
  out.push({ out: 'assets/sprites/imp.png', preview: 4, image: px.sheet(imp, 9), meta: { type: 'spritesheet', frameWidth: IW, frameHeight: IH, filter: 'nearest', frames: ['stand', 'walk1', 'walk2', 'windup', 'throw', 'pain', 'die1', 'die2', 'die3'], height: 1.8 } });

  // ---- baron (boss): 64x72 frames
  const ba = (n) => G(BA[n], BA.PAL, `baron:${n}`);
  const BW = 64, BH = 72;
  const bpose = ({ head = 'headHalf', legs = 'stand', arms = 'down', bob = 0 }) => {
    const L = [], leg = ba('leg'), back = ba('legBack');
    if (legs === 'stand') L.push([leg, 15, 52], [px.flipH(leg), 35, 52]);
    else if (legs === 'step1') L.push([leg, 13, 52], [px.flipH(back), 36, 50]);
    else L.push([px.flipH(leg), 37, 52], [back, 14, 50]);
    L.push([px.mirror(ba('torsoHalf')), 16, 34 + bob], [px.mirror(ba(head)), 20, 17 + bob]);
    if (arms === 'down') L.push([ba('arm'), 8, 35 + bob], [px.flipH(ba('arm')), 46, 35 + bob]);
    if (arms === 'cast') L.push([ba('arm'), 8, 35 + bob], [ba('armRaised'), 46, 20 + bob], [ba('fire'), 42, 5 + bob]);
    if (arms === 'throw') L.push([ba('arm'), 8, 35 + bob], [px.flipH(ba('arm')), 46, 38 + bob]);
    return px.compose(BW, BH, L);
  };
  const baron = [bpose({}), bpose({ legs: 'step1', bob: -1 }), bpose({ legs: 'step2', bob: -1 }), bpose({ arms: 'cast', bob: -1 }), bpose({ arms: 'throw', bob: 1 }), bpose({ head: 'headHurtHalf', bob: 1 }),
    px.compose(BW, BH, [[G(BA.dead1, BA.PAL, 'bdead1'), 8, 48]]), px.compose(BW, BH, [[G(BA.dead2, BA.PAL, 'bdead2'), 8, 45]]), px.compose(BW, BH, [[G(BA.dead3, BA.PAL, 'bdead3'), 8, 43]])];
  out.push({ out: 'assets/sprites/baron.png', preview: 3, image: px.sheet(baron, 9), meta: { type: 'spritesheet', frameWidth: BW, frameHeight: BH, filter: 'nearest', frames: ['stand', 'walk1', 'walk2', 'windup', 'throw', 'pain', 'die1', 'die2', 'die3'], height: 2.7 } });

  // ---- first-person weapons: whole pictures drawn at 40x40, shown doubled -> 80x80 frames on a 320x180 virtual screen
  const wp = (n) => G(WP[n], WP.PAL, `weapon:${n}`);
  const W2 = 80;
  const x2 = (img) => px.scaleUp(img, 2);
  const gunBody = () => px.compose(40, 40, [[px.mirror(wp('gunHalf')), 0, 0]]);
  const gun = ({ dy = 0, pump = 0, flash = false }) => {
    const body = gunBody();
    const f = px.compose(40, 40, [[body, 0, 4 + dy], [wp('gunStock'), 12, 33 + dy], [wp('gunHandR'), 22, 30 + dy], [wp('gunHandL'), 4, 25 + dy + pump]]);
    const o = px.compose(80, 80, [[x2(f), 0, 0]]);
    if (flash) px.blit(o, x2(wp('gunFlash')), 12, -14);
    return o;
  };
  const mace = (n, swish) => { const o = px.compose(80, 80, [[x2(wp(n)), 0, 0]]); if (swish) px.blit(o, x2(wp('maceSwish')), 8, 6); return o; };
  const weapons = [mace('mace0'), mace('mace1', true), mace('mace2'), gun({}), gun({ dy: 3, flash: true }), gun({ dy: 2, pump: 6 }), gun({ dy: 1, pump: 3 })];
  out.push({ out: 'assets/sprites/weapons.png', preview: 3, image: px.sheet(weapons, 7), meta: { type: 'spritesheet', frameWidth: W2, frameHeight: W2, filter: 'nearest', frames: ['mace_idle', 'mace_swing1', 'mace_swing2', 'gun_idle', 'gun_fire', 'gun_pump1', 'gun_pump2'] } });

  // ---- atlas packer: shelf-packs hand-drawn images, meta.rects = name -> [x, y, w, h]
  const pack = (items, width = 256) => {
    let x = 0, y = 0, rowH = 0; const place = [];
    for (const [n, im] of items) { if (x + im.w > width) { x = 0; y += rowH + 1; rowH = 0; } place.push([n, im, x, y]); x += im.w + 1; rowH = Math.max(rowH, im.h); }
    const o = px.blank(width, y + rowH); const rects = {};
    for (const [n, im, px_, py] of place) { px.blit(o, im, px_, py); rects[n] = [px_, py, im.w, im.h]; }
    return { image: o, rects };
  };
  const P = (n, pal = PR.PAL) => G(PR[n], pal, `prop:${n}`);
  const props = pack([['torch1', P('torch1')], ['torch2', P('torch2')], ['barrel', P('barrel')], ['bones', P('bones')], ['flaskSmall', P('flaskSmall')], ['flaskBig', P('flaskBig')], ['shells', P('shells')], ['armor', P('armor')],
    ['key', P('key')], ['gun', P('gunPickup')], ['impBall', P('impBall')], ['impBall2', P('impBall2')], ['baronBall', P('baronBall')], ['baronBall2', P('baronBall2')], ['arrow', P('arrow')], ['puff1', P('puff1')], ['puff2', P('puff2')],
    ['boom1', P('boom1')], ['boom2', P('boom2')], ['boom3', P('boom3')], ['blood1', P('blood1')], ['blood2', P('blood2')], ['blood3', P('blood3')]]);
  out.push({ out: 'assets/sprites/props.png', preview: 3, image: props.image, meta: { type: 'atlas', rects: props.rects } });

  // ---- HUD atlas: status plate, boxes, face frame, faces, big digits, crosshair
  const HP = (n, pal = HD.PAL) => G(HD[n], pal, `hud:${n}`);
  const face = (base, ...ov) => px.compose(24, 26, [[G(HD[base], HD.FACE, base), 0, 4], ...ov.map(([n, x, y]) => [G(HD[n], HD.FACE, n), x, y])]);
  const faces = [face('faceOk'), face('faceOk', ['bloodA', 4, 8]), face('faceOk', ['bloodA', 4, 8], ['bloodB', 11, 12]), face('faceHurt', ['bloodB', 3, 7], ['bloodC', 11, 11]), face('faceHurt', ['bloodC', 2, 6], ['bloodC', 11, 10], ['bloodA', 8, 18]), face('faceDead'), face('faceHurt')];
  const digits = Object.entries(HD.DIGITS).map(([k, g]) => [`d${k === '%' ? 'pct' : k}`, G(g.split('/').join('\n'), HD.PAL, `digit:${k}`)]);
  const hud = pack([['plate', HP('plate')], ['box', HP('box')], ['faceFrame', HP('faceFrame')], ['crosshair', HP('crosshair')], ...faces.map((f, i) => [`face${i}`, f]), ...digits], 320);
  out.push({ out: 'assets/ui/hud.png', preview: 3, image: hud.image, meta: { type: 'atlas', rects: hud.rects, faces: ['100-80', '80-60', '60-40', '40-20', '<20', 'dead', 'ouch'] } });
  const chars = Array.from({ length: 64 }, (_, i) => String.fromCharCode(32 + i));
  const cells = chars.map((c) => { const g = GLYPHS[c] ?? GLYPHS[' ']; const im = px.blank(6, 8); g.split('/').forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') im.d.set([255, 255, 255, 255], (y * 6 + x) * 4); })); return im; });
  out.push({ out: 'assets/ui/font.png', preview: 4, image: px.sheet(cells, 16), meta: { type: 'bitmapfont', cellWidth: 6, cellHeight: 8, chars: chars.join(''), charsPerRow: 16 } });
  return out;
};
