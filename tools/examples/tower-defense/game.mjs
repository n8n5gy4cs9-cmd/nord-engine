import { E, rect, text, camera2d, project, SQUARE } from '../lib.mjs';

const PATH = [[0, 90], [160, 90], [160, 270], [340, 270], [340, 90], [520, 90], [520, 220], [640, 220]];
export default () => ({
  name: 'Tower Defense',
  project: project('tower-defense', 'Tower Defense', '2d', { bg: '#3b4a38' }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    ...PATH.slice(0, -1).map((p, i) => { const q = PATH[i + 1], w = Math.abs(q[0] - p[0]) + 34, h = Math.abs(q[1] - p[1]) + 34; return rect(`Road${i}`, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, w, h, '#a3825c', { z: -2 }); }),
    E('Game', { s: [['scripts/td.js', { path: PATH }], 'scripts/ui-gameover.js', 'scripts/util-sfx.js'] }),
  ] } },
  lib: ['ui-gameover', 'util-sfx'], assets: SQUARE,
  template: { id: 'tower-defense', title: 'Tower defense', description: 'Path, waves of creeps, click-to-build towers with range and fire rate, gold and lives.' },
  readme: '# Tower defense\nClick empty ground to build a tower (30 gold). Towers shoot the first creep in range. 10 waves; lose when 10 creeps get through. Path is an attribute (`path`) on the Game entity.\n',
});
