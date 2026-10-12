import { E, camera2d, project } from '../lib.mjs';

export default () => ({
  name: '2048',
  project: project('2048', '2048', '2d', { bg: '#232831' }),
  scenes: { main: { entities: [camera2d(320, 180), E('Game', { s: [['scripts/game2048.js', {}]] })] } },
  lib: [], assets: [],
  readme: '# 2048\nArrow keys / WASD slide the tiles. Built with the DOM UI layer only (`this.ui`), so no sprites needed. Best score is saved.\n',
});
