import { E, camera2d, project, keys } from '../lib.mjs';

const W = 100, H = 23, GROUND = 18;
function level() {
  const g = Array.from({ length: H }, () => Array(W).fill(-1));
  const gaps = [[22, 25], [48, 51], [66, 69]];
  for (let x = 0; x < W; x++) { if (gaps.some(([a, b]) => x >= a && x < b)) continue; g[GROUND][x] = 0; for (let y = GROUND + 1; y < H; y++) g[y][x] = 3; }
  const plat = (x, y, n) => { for (let i = 0; i < n; i++) g[y][x + i] = 0; };
  plat(14, 14, 4); plat(26, 14, 3); plat(30, 11, 3); plat(40, 13, 5); plat(54, 14, 3); plat(58, 11, 4); plat(72, 14, 4); plat(78, 11, 3);
  return { tileset: 'assets/sprites/tileset_platformer.png', tileWidth: 16, tileHeight: 16, collides: [0, 3], layers: [{ name: 'ground', data: g }] };
}
const coin = (x, y) => E('Coin', { pos: [x, y, 1], tags: ['coin'], s: [['scripts/pickup.js', { kind: 'score', value: 10, bob: 0, sfx: 'assets/audio/sfx/coin.wav' }]], c: [{ type: 'animatedSprite', texture: 'assets/sprites/coin.png', anim: 'spin' }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [12, 12], trigger: true }] });
const slime = (x, y, big = false) => E(big ? 'Boss' : 'Slime', { pos: [x, y, 1], tags: ['enemy'], scale: big ? [2, 2, 1] : [1, 1, 1], s: [['scripts/ai-patrol.js', { speed: big ? 40 : 35, distance: big ? 120 : 90 }], [big ? 'scripts/boss.js' : 'scripts/enemy.js', {}]], c: [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_slime.png', anim: 'idle' }, { type: 'rigidbody', mode: 'dynamic', fixedRotation: true }, { type: 'collider', shape: 'box', size: [20, 14], offset: [6, 14] }] });
const flag = (x, y) => E('Checkpoint', { pos: [x, y, 0], s: [['scripts/checkpoint.js', { killY: 400 }]], c: [{ type: 'animatedSprite', texture: 'assets/sprites/flag.png', anim: 'wave' }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [16, 32], trigger: true }] });

export default () => ({
  name: 'Platformer',
  project: project('platformer', 'Platformer', '2d', { pixelArt: true, physics: { engine: 'arcade', gravity: [0, 900, 0] }, input: keys({ dash: ['ShiftLeft', 'KeyK'] }), theme: 'tokyo-night' }),
  scenes: { main: { settings: { ambient: '#ffffff' }, entities: [
    E('Sky', { pos: [0, 0, -100], c: [{ type: 'parallax', texture: 'assets/sprites/bg_sky.png', factor: [0, 0] }] }),
    E('Hills', { pos: [0, 0, -90], c: [{ type: 'parallax', texture: 'assets/sprites/bg_hills_far.png', factor: [0.3, 0] }] }),
    E('Level', { pos: [0, 0, -1], c: [{ type: 'tilemap', map: 'assets/maps/level.tilemap.json', tileset: 'assets/sprites/tileset_platformer.png' }] }),
    E('Hero', { pos: [48, 250, 2], tags: ['player'], s: [['scripts/platformer2d.js', { speed: 130, jumpForce: 340, wallSlide: false, dash: true, dashSpeed: 280 }], ['scripts/health.js', { max: 3, deathEvent: 'died', invulnTime: 1 }], 'scripts/hero-fx.js'],
      c: [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle' }, { type: 'rigidbody', mode: 'dynamic', mass: 1 }, { type: 'collider', shape: 'box', size: [14, 28], offset: [9, 4] }] }),
    ...[[230, 260], [262, 215], [298, 215], [334, 215], [500, 180], [540, 180], [580, 180], [640, 196], [700, 196], [960, 215], [1000, 215], [1040, 180], [1130, 260], [1170, 260], [1250, 196], [1300, 156]].map(([x, y], i) => ({ ...coin(x, y), name: `Coin${i}` })),
    slime(300, 268), slime(520, 268), slime(760, 268), slime(1100, 268), slime(1380, 268, true),
    flag(720, 256), flag(1290, 256),
    camera2d(320, 180, { cam: { bounds: [0, 0, 1600, 368] }, s: [['scripts/camera-follow.js', { target: 'Hero', smoothing: 7, bounds: [0, 0, 1600, 368], lookAhead: 24 }]] }),
    E('Systems', { s: [['scripts/ui-hud.js', { target: 'Hero', style: 'hearts', coins: false }], ['scripts/score.js', { y: 40 }], 'scripts/ui-gameover.js', 'scripts/util-sfx.js', 'scripts/fx-hitstop.js'] }),
  ] } },
  files: { 'assets/maps/level.tilemap.json': level() },
  lib: ['platformer2d', 'health', 'pickup', 'ai-patrol', 'checkpoint', 'camera-follow', 'ui-hud', 'score', 'ui-gameover', 'util-sfx', 'fx-hitstop'],
  assets: ['assets/sprites/tileset_platformer.png', 'assets/sprites/hero.png', 'assets/sprites/coin.png', 'assets/sprites/enemy_slime.png', 'assets/sprites/flag.png', { from: 'assets/sprites/backgrounds/bg_sky.png', to: 'assets/sprites/bg_sky.png' }, { from: 'assets/sprites/backgrounds/bg_hills_far.png', to: 'assets/sprites/bg_hills_far.png' }, 'assets/audio/sfx/coin.wav',
    { from: 'assets/particles/square.png', to: 'assets/sprites/square.png' }],
  template: { id: 'platformer', title: 'Platformer', description: 'Tilemap level, hero with coyote time/variable jump/dash, enemies you can stomp, coins, checkpoints, boss, HUD.' },
  readme: '# Platformer\nA/D or arrows run, Space/W jump (variable height, coyote time), Shift/K dash. Stomp slimes; the big slime at the end is the boss (5 stomps). Flags are checkpoints; falling respawns you.\nBuilt almost entirely from library scripts (`platformer2d`, `health`, `pickup`, `ai-patrol`, `checkpoint`, `camera-follow`, `ui-hud`, `score`) plus two small scripts: `enemy.js`, `boss.js`.\n',
});
