import { E, box3, ground3, env3, camera2d, project, keys, SKY } from '../lib.mjs';

const targets = [[-10, 1, 8], [0, 1, 14], [10, 1, 8], [-14, 1, -4], [14, 1, -4], [-6, 1, -12], [6, 1, -12], [0, 1, -6], [-18, 1, 12], [18, 1, 12]];
export default () => ({
  name: 'FPS Arena',
  project: project('fps-arena', 'FPS Arena', '3d', { input: keys({ sprint: ['ShiftLeft'], crouch: ['KeyC'], fire: ['Mouse0', 'KeyF'], interact: ['KeyE'] }) }),
  scenes: { main: { entities: [
    ...env3('day'), ground3(60, 'assets/textures/concrete.png'),
    box3('WallN', [0, 2, 30], [60, 4, 1], { texture: 'assets/textures/brick.png' }), box3('WallS', [0, 2, -30], [60, 4, 1], { texture: 'assets/textures/brick.png' }),
    box3('WallE', [30, 2, 0], [1, 4, 60], { texture: 'assets/textures/brick.png' }), box3('WallW', [-30, 2, 0], [1, 4, 60], { texture: 'assets/textures/brick.png' }),
    box3('Cover1', [-5, 1, 0], [4, 2, 1], { texture: 'assets/textures/metal.png' }), box3('Cover2', [5, 1, 3], [1, 2, 4], { texture: 'assets/textures/metal.png' }), box3('Cover3', [0, 0.75, 8], [3, 1.5, 3], { texture: 'assets/textures/wood.png' }),
    E('Player', { pos: [0, 1.2, -20], tags: ['player'], s: [['scripts/fps3d.js', { speed: 6, lockPointer: true }], ['scripts/physics-hitscan.js', { damage: 1, rate: 5, range: 80 }], 'scripts/arena.js', 'scripts/util-sfx.js'],
      c: [{ type: 'mesh', shape: 'capsule', size: [0.8, 1.8, 0.8], castShadow: false }, { type: 'material', color: '#88c0d0' }, { type: 'rigidbody', mode: 'dynamic', mass: 1, fixedRotation: true, drag: 0 }, { type: 'collider', shape: 'capsule', size: [0.8, 1.8, 0.8] }],
      kids: [E('Camera', { pos: [0, 0.7, 0], c: [{ type: 'camera', fov: 75 }, { type: 'postProcess', fxaa: true, vignette: 0.2, tonemap: true }] })] }),
    ...targets.map(([x, y, z], i) => box3(`Target${i}`, [x, y, z], [1.2, 2, 0.4], { color: i % 2 ? '#bf616a' : '#ebcb8b', body: 'static', tags: ['target'], s: [['scripts/physics-crate.js', { hp: 3 }]] })),
  ] } },
  lib: ['fps3d', 'physics-hitscan', 'physics-crate', 'util-sfx'],
  assets: [...['concrete', 'brick', 'metal', 'wood'].map((t) => `assets/textures/${t}.png`), ...SKY('day'), 'assets/audio/sfx/shoot.wav'],
  template: { id: 'fps-arena', title: 'FPS arena', description: 'First-person controller (mouse look, sprint, crouch, jump), hit-scan weapon, destructible targets.' },
  readme: '# FPS arena\nClick to lock the mouse. WASD move, Shift sprint, C crouch, Space jump, Left mouse / F fire. Shoot all 10 targets (3 hits each).\nLibrary: `fps3d`, `physics-hitscan`, `physics-crate`. Own script: `arena.js` (HUD + win).\n',
});
