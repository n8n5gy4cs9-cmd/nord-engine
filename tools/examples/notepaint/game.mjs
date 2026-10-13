import fs from 'node:fs';
import path from 'node:path';
import { project, ROOT } from '../lib.mjs';
const here = path.join(ROOT, 'tools/examples/notepaint');
const files = (dir, to = '') => fs.readdirSync(path.join(here, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`, `${to}${e.name}/`) : [{ from: `tools/examples/notepaint/${dir}/${e.name}`, to: to + e.name }]);
export default () => ({
  name: 'notepaint',
  project: { ...project('notepaint', 'notepaint', 'html', { w: 1280, h: 800 }), startScene: '' },
  html: { module: 'app.js', files: [...files('src'), ...files('assets', 'assets/'), ...files('docs'), { from: 'library/apps/_kit.js', to: '_kit.js' }, { from: 'vendor/fonts/inter/inter-latin-400-normal.woff2', to: 'assets/fonts/inter.woff2' }, { from: 'vendor/fonts/inter/LICENSE', to: 'assets/fonts/LICENSE' }] },
  readme: '# notepaint\nA complete offline notebook: each document has text and a drawing. New/rename/search/duplicate/delete, autosave, pencil/brush/eraser/fill/line/rectangle/ellipse/picker, undo/redo, text/image import, portable document import/export, TXT/PNG downloads.\n\nOpen with `nord serve examples/notepaint`. See GUIDE.md, assets.md and the manual tutorial. Source: `tools/examples/notepaint/`; regenerate with `node tools/gen_examples.mjs notepaint`. No external dependencies. Crowelian 2026 + Sonnet.\n',
});
