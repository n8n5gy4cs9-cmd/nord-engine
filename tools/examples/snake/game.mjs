import { E, rect, text, camera2d, project, SQUARE } from '../lib.mjs';

export default () => ({
  name: 'Snake',
  project: project('snake', 'Snake', '2d', { bg: '#232831' }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/snake.js', {}], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] })] } },
  lib: ['ui-gameover', 'util-sfx'], assets: SQUARE,
  template: { id: 'puzzle-grid', title: 'Grid game (Snake)', description: 'Tile-based game loop: timed steps, grid entities, food, game over.' },
  readme: '# Snake\nArrow keys / WASD. Grid game loop with a fixed step timer (see `scripts/snake.js`), entities spawned per segment, speed ramps with score.\n',
});
