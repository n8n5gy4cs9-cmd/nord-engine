import { project } from '../lib.mjs';
const files = ['app.js', 'rules.js', 'chaos.js', 'server.mjs', 'style.css'].map(
  (name) => ({ from: 'tools/examples/jengatedris/src/' + name, to: name }),
);
files.push(
  { from: 'tools/examples/network-common/server-kit.mjs', to: 'server-kit.mjs' },
  { from: 'vendor/phaser/phaser.min.js', to: 'vendor/phaser/phaser.min.js' },
  { from: 'vendor/phaser/LICENSE.md', to: 'vendor/phaser/LICENSE.md' },
  { from: 'LICENSE', to: 'LICENSE' },
);
export default () => ({
  name: 'JengaTedris — grid, topple and battle',
  project: { ...project('jengatedris', 'JengaTedris', 'html'), startScene: '' },
  html: { module: 'app.js', files },
  readme:
    '# JengaTedris\nT40 complete coding workshop. Grid: seven-bag, ghost, hold, horizontal wall kicks, scoring, speed levels and 20-row goal. Physics tower: real Matter compound tetrominoes, friction, torque and 18-piece survival. Battle: real Node server owns grids, drops, garbage and results. Run `node server.mjs`, open the printed local URL in two browsers, same room, both Ready. For LAN friends set HOST=0.0.0.0 and open the host LAN address. No npm or external assets. All code, Phaser/Matter bundle and licences included. Crowelian 2026 + Sonnet.\n',
});
