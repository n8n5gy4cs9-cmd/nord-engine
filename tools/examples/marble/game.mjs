import { E, box3, ground3, env3, project, keys, SKY } from '../lib.mjs';

const gem = (i, x, y, z) => E(`Gem${i}`, { pos: [x, y, z], tags: ['gem'], s: [['scripts/pickup.js', { kind: 'score', value: 1, bob: 0, sfx: 'assets/audio/sfx/coin.wav' }], ['scripts/spin.js', { speed: 150, axis: 'y' }]],
  c: [{ type: 'mesh', shape: 'box', size: [0.5, 0.5, 0.5] }, { type: 'material', color: '#88c0d0', metallic: 0.7, roughness: 0.2, emissive: '#204050' }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'sphere', radius: 0.5, trigger: true }] });
export default () => ({
  name: 'Marble Roll',
  project: project('marble', 'Marble Roll', '3d', {}),
  scenes: { main: { entities: [
    ...env3('night'), 
    box3('Start', [0, 0, 0], [8, 1, 8], { texture: 'assets/textures/checker.png' }),
    box3('Bridge', [0, 0, 10], [2.5, 1, 14], { texture: 'assets/textures/wood.png' }),
    ...Array.from({ length: 6 }, (_, i) => box3(`Step${i}`, [0, 0.5 + i * 0.3, 18 + i * 2], [5, 0.5, 2], { texture: 'assets/textures/stone.png' })),
    box3('Mid', [0, 1.9, 32], [10, 1, 10], { texture: 'assets/textures/checker.png' }),
    box3('Zig1', [6, 1.9, 42], [3, 1, 12], { texture: 'assets/textures/wood.png' }), box3('Zig2', [12, 1.9, 52], [12, 1, 3], { texture: 'assets/textures/wood.png' }),
    box3('Goal', [20, 1.9, 52], [6, 1, 6], { color: '#a3be8c', tags: ['goal'] }),
    box3('Bumper1', [0, 2.9, 32], [1, 1, 1], { shape: 'sphere', texture: 'assets/textures/metal.png', bounce: 1.2 }),
    ...[[0, 1.6, 10], [0, 2.4, 23], [-3, 3.2, 32], [3, 3.2, 32], [6, 3.0, 44], [14, 3.0, 52]].map(([x, y, z], i) => gem(i, x, y, z)),
    E('Marble', { pos: [0, 2, 0], tags: ['player'], s: [['scripts/marble3d.js', { force: 22, maxSpeed: 10, jumpImpulse: 6, killY: -15 }], 'scripts/level.js', 'scripts/util-sfx.js'],
      c: [{ type: 'mesh', shape: 'sphere', size: [1, 1, 1] }, { type: 'material', color: '#d8dee9', metallic: 0.9, roughness: 0.15 }, { type: 'rigidbody', mode: 'dynamic', mass: 1, drag: 0.3, angularDrag: 0.2, friction: 0.6 }, { type: 'collider', shape: 'sphere', radius: 0.5 }] }),
    E('Camera', { pos: [0, 8, -8], rot: [35, 0, 0], c: [{ type: 'camera', fov: 60 }, { type: 'postProcess', fxaa: true, bloom: true, bloomWeight: 0.5, tonemap: true }], s: [['scripts/camera-follow3d.js', { target: 'Marble', offset: [0, 7, -8], smoothing: 3 }]] }),
  ] } },
  lib: ['marble3d', 'pickup', 'spin', 'camera-follow3d', 'util-sfx'],
  assets: ['checker', 'wood', 'stone', 'metal'].map((t) => `assets/textures/${t}.png`).concat(SKY('night'), ['assets/audio/sfx/coin.wav']),
  readme: '# Marble roll\nWASD roll the marble, Space hop. Collect the gems and reach the green goal pad; falling off the level respawns you.\nLibrary: `marble3d`, `pickup`, `camera-follow3d`.\n',
});
