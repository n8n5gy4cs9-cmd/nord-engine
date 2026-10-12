import { E, camera2d, project } from '../lib.mjs';

export default () => ({
  name: 'Match-3',
  project: project('match3', 'Match-3', '2d', { bg: '#232831' }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/match3.js', {}], 'scripts/util-sfx.js'] })] } },
  lib: ['util-sfx'], assets: [],
  template: { id: 'puzzle-match3', title: 'Puzzle (Match-3)', description: 'Swap-and-match core: board, cascades, refill, score and move limit.' },
  readme: '# Match-3\nClick a gem, then a neighbour to swap. Matches of 3+ clear, gems fall and refill (cascades). 25 moves; best score saved.\nThe board logic (`findMatches`, `collapse`) is pure and easy to reuse.\n',
});
