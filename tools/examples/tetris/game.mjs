import { E, camera2d, project, keys } from '../lib.mjs';

export default () => ({
  name: 'Blocks',
  project: project('tetris', 'Blocks', '2d', { bg: '#232831', input: keys({ drop: ['Space'], rotate: ['ArrowUp', 'KeyW', 'KeyX'] }) }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/blocks.js', {}], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] })] } },
  lib: ['ui-gameover', 'util-sfx'], assets: [],
  readme: '# Blocks (Tetris-like)\nLeft/Right move, Up rotates, Down soft-drops, Space hard-drops. 7 tetrominoes, line clears, level speeds up every 10 lines. Rendered on a canvas in the UI layer.\n',
});
