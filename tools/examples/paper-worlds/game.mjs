import { project } from '../lib.mjs';
import { deskFiles } from '../desk-common/files.mjs';
export default () => ({
  name: 'Paper Worlds — a playful 2D/3D drawing desk',
  project: { ...project('paper-worlds', 'Paper Worlds', 'html'), startScene: '' },
  html: {
    module: 'app.js',
    files: deskFiles(
      'paper-worlds',
      ['app.js', 'model.js', 'flat.js', 'world.js', 'portfolio.html', 'style.css'],
      { phaser: true, ui: 'desk' },
    ),
  },
  readme:
    '# Paper Worlds\nT42 full source workshop. Ten editable boards: Phaser pen, rectangles, circles, text/stickies, workspace pan/zoom, local Nord Save, PNG/JSON backups and a downloadable 3D desk page. Babylon live paper textures, Havok sticky flick/shake, drawn doors, Arcade bouncing circles, drawn-rectangle maze and graph camera ride. All libraries and original generated sprites included offline. Nord HTML tier hosts both adapters explicitly; there is no imaginary hybrid setting. No Node server. Crowelian 2026 + Sonnet.\n',
});
