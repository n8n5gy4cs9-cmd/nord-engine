import { E, box3, ground3, env3, project, keys, SKY } from '../lib.mjs';

// Rectangular circuit: 4 checkpoints in order, walls on the outside and a centre island.
const cp = (i, x, z, w, d) => box3(`CP${i}`, [x, 1, z], [w, 2, d], { body: 'static', trigger: true, tags: ['checkpoint'], color: '#a3be8c', c: [], s: [], body: 'static' });
export default () => ({
  name: 'Racing Time-Trial',
  project: project('racing', 'Racing Time-Trial', '3d', { input: keys({ jump: ['Space'] }) }),
  scenes: { main: { entities: [
    ...env3('day'), ground3(120, 'assets/textures/dirt.png'),
    box3('WallN', [0, 1, 45], [100, 2, 1], { color: '#bf616a' }), box3('WallS', [0, 1, -45], [100, 2, 1], { color: '#bf616a' }), box3('WallE', [50, 1, 0], [1, 2, 90], { color: '#bf616a' }), box3('WallW', [-50, 1, 0], [1, 2, 90], { color: '#bf616a' }),
    box3('Island', [0, 1, 0], [60, 2, 40], { texture: 'assets/textures/grass.png' }),
    ...[['CP0', 0, -32, 2, 22], ['CP1', 38, 0, 22, 2], ['CP2', 0, 32, 2, 22], ['CP3', -38, 0, 22, 2]].map(([n, x, z, w, d], i) => box3(n, [x, 1, z], [w, 2, d], { trigger: true, color: '#a3be8c', tags: ['checkpoint'], body: 'static', rough: 1 })),
    E('Car', { pos: [0, 0.6, -38], rot: [0, 90, 0], tags: ['player'], s: [['scripts/vehicle3d.js', { accel: 22, maxSpeed: 32, steer: 110, grip: 6 }], 'scripts/race.js'],
      c: [{ type: 'mesh', shape: 'box', size: [1.4, 0.7, 2.6] }, { type: 'material', color: '#ebcb8b', metallic: 0.5, roughness: 0.35 }, { type: 'rigidbody', mode: 'dynamic', mass: 2, fixedRotation: true, drag: 0.05 }, { type: 'collider', shape: 'box', size: [1.4, 0.7, 2.6] }] }),
    E('Camera', { pos: [0, 5, -50], c: [{ type: 'camera', fov: 65 }, { type: 'postProcess', fxaa: true, vignette: 0.25, tonemap: true }], s: ['scripts/chase-cam.js'] }),
  ] } },
  lib: ['vehicle3d'],
  assets: ['dirt', 'grass'].map((t) => `assets/textures/${t}.png`).concat(SKY('day')),
  template: { id: 'racing', title: 'Racing (time-trial)', description: 'Arcade car, checkpoints, lap timer, best lap saved, chase camera.' },
  readme: '# Racing time-trial\nW/S throttle/brake, A/D steer, Space handbrake. Drive the circuit, hitting the four green checkpoints in order; 3 laps, best lap is saved.\nLibrary: `vehicle3d`. Own scripts: `race.js`, `chase-cam.js`.\n',
});
