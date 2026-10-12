import { E, camera2d, project } from '../lib.mjs';

export default () => ({
  name: 'Idle Clicker',
  project: project('idle-clicker', 'Idle Clicker', '2d', { bg: '#232831' }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/idle.js', {}], 'scripts/util-sfx.js'] })] } },
  lib: ['util-sfx'], assets: [],
  template: { id: 'idle-clicker', title: 'Idle / clicker', description: 'Currency, upgrades with cost scaling, per-second income, offline progress, autosave.' },
  readme: '# Idle clicker\nClick the big button, buy generators. Income keeps ticking, progress autosaves and offline earnings are credited on load (capped at 8 h).\n',
});
