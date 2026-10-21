import fs from 'node:fs';
import base from '../platformer3d/game.mjs';
import { E } from '../lib.mjs';
export default () => {
  const s = base();
  s.name = s.project.name = 'Crystal Relay — code workshop';
  s.project.id = 'com.crowelian.crystalrelay';
  s.project.input.actions.sprint = ['ShiftLeft', 'ShiftRight'];
  delete s.template;
  s.files = { LICENSE: fs.readFileSync(new URL('../../../LICENSE', import.meta.url), 'utf8') };
  const entities = s.scenes.main.entities;
  const player = entities.find(e => e.name === 'Player');
  player.scripts = player.scripts.filter(x => x.path !== 'scripts/collect.js');
  player.scripts.push({ path: 'scripts/relay.js', attributes: {} });
  for (const gem of entities.filter(e => e.tags.includes('gem')))
    gem.scripts = gem.scripts.filter(x => x.path !== 'scripts/pickup.js');
  const ground = entities.find(e => e.name === 'Ground');
  ground.components = ground.components.filter(c => !['rigidbody', 'collider'].includes(c.type));
  entities.push(E('Hazard', { pos: [3, 3.3, 18], c: [
    { type: 'mesh', shape: 'sphere', size: [0.8, 0.8, 0.8] },
    { type: 'material', color: '#ff4433', emissive: '#aa1100' },
  ] }));
  s.readme = '# Crystal Relay\nFull coding workshop T34. WASD/arrows move, Space double-jumps, Shift sprints. Collect seven crystals in order, avoid the moving red hazard, use crystal checkpoints and beat your saved best time. Sand is visual: falling through it costs a life.\n';
  return s;
};
