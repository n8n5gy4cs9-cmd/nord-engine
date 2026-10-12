import { E, box3, ground3, env3, project, keys, SKY } from '../lib.mjs';

const gem = (i, x, y, z) => E(`Gem${i}`, { pos: [x, y, z], tags: ['gem'], s: [['scripts/pickup.js', { kind: 'score', value: 1, bob: 0, sfx: 'assets/audio/sfx/coin.wav' }], ['scripts/spin.js', { speed: 120, axis: 'y' }]],
  c: [{ type: 'mesh', shape: 'sphere', size: [0.5, 0.5, 0.5] }, { type: 'material', color: '#ebcb8b', metallic: 0.6, roughness: 0.3, emissive: '#6b5a20' }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'sphere', radius: 0.5, trigger: true }] });
const P = [[0, 0.25, 6, 3], [4, 0.9, 10, 3], [8, 1.6, 14, 3], [3, 2.4, 18, 3], [-2, 3.2, 22, 3], [-7, 3.9, 25, 3], [-12, 4.6, 29, 4]];
export default () => ({
  name: '3D Platformer',
  project: project('platformer3d', '3D Platformer', '3d', { input: keys({ jump: ['Space'], camLeft: ['KeyQ'], camRight: ['KeyE'] }) }),
  scenes: { main: { entities: [
    ...env3('sunset'), ground3(120, 'assets/textures/sand.png'),
    box3('Start', [0, 0.25, 0], [6, 0.5, 6], { texture: 'assets/textures/stone.png' }),
    ...P.map(([x, y, z, s], i) => box3(`Plat${i}`, [x, y, z], [s, 0.5, s], { texture: 'assets/textures/checker.png' })),
    box3('Mover', [14, 2.4, 22], [3, 0.5, 3], { color: '#88c0d0', body: 'kinematic', s: [['scripts/physics-moving-platform.js', { offset: [0, 0, 8], period: 5, carryTag: 'player' }]] }),
    ...P.map(([x, y, z], i) => gem(i, x, y + 1.2, z)),
    E('Player', { pos: [0, 1.5, 0], tags: ['player'], s: [['scripts/platformer3d.js', { speed: 6, jumpSpeed: 8.5 }], 'scripts/collect.js', 'scripts/util-sfx.js'],
      c: [{ type: 'mesh', shape: 'capsule', size: [0.8, 1.6, 0.8] }, { type: 'material', color: '#a3be8c' }, { type: 'rigidbody', mode: 'dynamic', mass: 1, fixedRotation: true, drag: 0 }, { type: 'collider', shape: 'capsule', size: [0.8, 1.6, 0.8] }] }),
    E('Camera', { pos: [0, 5, -8], rot: [20, 0, 0], c: [{ type: 'camera', fov: 60 }, { type: 'postProcess', fxaa: true, bloom: true, vignette: 0.3, tonemap: true }], s: [['scripts/camera-follow3d.js', { target: 'Player', offset: [0, 5, -8], smoothing: 4 }]] }),
  ] } },
  lib: ['platformer3d', 'pickup', 'spin', 'physics-moving-platform', 'camera-follow3d', 'util-sfx'],
  assets: ['sand', 'stone', 'checker'].map((t) => `assets/textures/${t}.png`).concat(SKY('sunset'), ['assets/audio/sfx/coin.wav']),
  template: { id: 'platformer-3d', title: '3D platformer', description: 'Third-person-ish 3D platformer: coyote jump, double jump, moving platform, gems, respawn.' },
  readme: '# 3D platformer\nWASD move, Space jump (double jump!), collect all gems. Fall off and you respawn. Library: `platformer3d`, `pickup`, `physics-moving-platform`, `camera-follow3d`.\n',
});
