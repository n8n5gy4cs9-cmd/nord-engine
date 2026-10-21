import fs from 'node:fs';
import path from 'node:path';
import { ROOT, project } from '../lib.mjs';
export default () => ({
  name: 'Amiga Arcade — Art in Motion',
  project: { ...project('amiga-showcase', 'Amiga Arcade — Art in Motion', 'html', { w: 640, h: 360, pixelArt: true }), startScene: '' },
  html: { module: 'app.js', files: [
    { from: 'tools/examples/amiga-showcase/app.js', to: 'app.js' },
    ...fs.readdirSync(path.join(ROOT,'assets/packs/nord-amiga')).filter(n=>/\.(png|json)$/.test(n)).map(n=>({from:'assets/packs/nord-amiga/'+n,to:'assets/art/'+n})),
  ] },
  readme: '# Amiga Arcade — Art in Motion\n\nOne automatic offline demo: side-scroller chase, top-down patrol, overhead football and pseudo-3D racing, plus the complete animated asset gallery. Scenes change every 18 seconds. Buttons/1–5 select scenes; A toggles auto tour, Space pauses. Touch buttons work too. No external dependencies.\n\nRun `nord serve examples/amiga-showcase` or open this example from the editor. Authoritative code: tools/examples/amiga-showcase/. Artwork: assets/packs/nord-amiga/. Regenerate with `python3 tools/art/amiga/pack.py` then `node tools/gen_examples.mjs amiga-showcase`.\n\nThis is an attract-mode art demonstration, not four complete playable games. Soccer uses tiny 8x12 overhead players in compatible 21x31 canvases with four directional four-step running cycles; blue-team colours are tinted at draw time. Humans use flat Amiga colour blocks. Racing selects only left/back/right rear poses, plus a separately drawn front view; it never cycles through intermediate steering angles. All sheets appear in the gallery.\n\nCrowelian 2026 + Sonnet. Original art/code MIT.\n',
});
