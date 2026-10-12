import { E, camera2d, project } from '../lib.mjs';

export default () => ({
  name: 'Memory',
  project: project('memory', 'Memory', '2d', { bg: '#232831' }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/memory.js', {}], 'scripts/util-sfx.js'] })] } },
  lib: ['util-sfx'], assets: [],
  template: { id: 'card-game', title: 'Card game (Memory)', description: 'Card grid with flip animation, matching logic, move counter and win state — DOM UI based.' },
  readme: '# Memory\nClick cards to find pairs. Cards are DOM buttons built from `this.ui`; flip uses CSS transitions; fewest moves is saved.\n',
});
