// FPS Creator starter: one 3D scene whose single entity runs a level (levels/level1.fpsl.json, "Outpost Zero") with the FPS Creator runtime (scripts/fpsc, copied from runtime/fpsc).
// Edit levels with the editor's "FPS Level" tab (or /editor/fpsc/index.html on `nord serve`). Docs: docs/FPS_CREATOR.md.
import { E, project } from '../lib.mjs';
import { cornerDemo } from '../../fpsc-corner-demo.mjs';
import { outpostZero } from '../../gen_fpsc_level.mjs';

const BANK = { textures: [], entities: [], sounds: {}, scripts: [] };
export default () => ({
  name: 'FPS Creator',
  project: { ...project('fps-creator', 'FPS Creator', '3d', { physics: { engine: 'none', gravity: [0, 0, 0] }, input: {} }), plugins: [] },
  scenes: { main: { entities: [E('FPS Level', { s: [['scripts/fpsc/level-script.js', { level: 'levels/level1.fpsl.json' }]] })] } },
  trees: [{ from: 'runtime/fpsc', to: 'scripts/fpsc', skip: (n) => n.endsWith('.test.mjs') }],
  files: {
    'levels/level1.fpsl.json': outpostZero(),
    'levels/corners.fpsl.json': cornerDemo(),
    'fpsc/bank.json': BANK,
    'fpsc/README.md': '# fpsc/ — your FPS Creator content\n\n- `bank.json` registers your own textures, wall pieces, entities, sounds and scripts.\n- `textures/`, `art/` (sprites), `models/` (.glb), `sounds/`, `scripts/` hold the files.\n- Levels live in `../levels/*.fpsl.json`. Edit them with the **FPS Level** tab (or open /editor/fpsc/index.html on `nord serve`).\n- The runtime is `../scripts/fpsc/` — run `nord fpsc init` after updating Nord to upgrade it (your files here are never touched).\n\nFull guide: docs/FPS_CREATOR.md.\n',
  },
  template: { id: 'fps-creator', title: 'FPS Creator (level editor)', description: 'Build first-person shooter levels like FPS Creator: grid editor with walls, doors, windows, stairs, lights, ready-made enemies, pickups and scripts — plus a playable demo level.' },
  readme: `# FPS Creator starter

A complete first-person game made with Nord's **FPS Creator** addon: levels are data (\`levels/*.fpsl.json\`), the runtime is \`scripts/fpsc/\`.

- **Edit**: open this project in the Nord editor → **FPS Level** tab (or \`nord serve .\` and open \`/editor/fpsc/index.html\`).
- **Play**: run the project — the *FPS Level* entity in \`scenes/main.scene.json\` loads \`levels/level1.fpsl.json\`. Click to start. WASD, mouse, E use, F flashlight, 1-6 weapons.
- **Add your own**: textures, sprites, 3D models, sounds and scripts go in \`fpsc/\` (see \`fpsc/README.md\` and docs/FPS_CREATOR.md).
- **Corner workshop**: open \`levels/corners.fpsl.json\` in FPS Level for an octagonal room and a circular room with matching cut floors.
- **Upgrade the runtime** after updating Nord: \`nord fpsc init\`.
`,
});
