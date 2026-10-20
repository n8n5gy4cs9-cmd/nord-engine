#!/usr/bin/env node
// FPS Creator maintenance helpers.
//   node tools/fpsc-tools.mjs index      regenerate runtime/fpsc/behaviours/index.js from the script files in that folder (run after adding a built-in script)
//   node tools/fpsc-tools.mjs list       print the bank: textures, pieces, entities (by category), scripts
//   node tools/fpsc-tools.mjs sync       regenerate templates/fps-creator + examples/fps-creator (copies runtime/fpsc into them) — same as `node tools/gen_examples.mjs fps-creator`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'runtime/fpsc/behaviours');
const cmd = process.argv[2];
if (cmd === 'index') {
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js').map((f) => f.slice(0, -3)).sort();
  const id = (n) => `s${n.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')}`;
  const out = `// Built-in scripts (behaviours). One file per script; the editor lists these, the runtime resolves them by id.\n// Your own scripts live in <project>/fpsc/scripts/*.js and are listed in <project>/fpsc/bank.json ("scripts"). Contract: docs/FPS_CREATOR.md §Scripts.\n// GENERATED LIST: add a new file to this folder and re-run \`node tools/fpsc-tools.mjs index\` (or add the import by hand).\n${names.map((n) => `import ${id(n)} from './${n}.js';`).join('\n')}\n\nexport const BUILTIN_SCRIPTS = [\n  ${names.map(id).join(', ')},\n];\n`;
  fs.writeFileSync(path.join(dir, 'index.js'), out); console.log(`behaviours/index.js: ${names.length} scripts`);
} else if (cmd === 'list') {
  const { createBank } = await import(pathToFileURL(path.join(root, 'runtime/fpsc/bank.js')).href); const b = await createBank({});
  console.log(`${b.textures.length} textures: ${b.textures.map((t) => t.id).join(', ')}\n${b.pieces.length} wall pieces: ${b.pieces.map((p) => p.id).join(', ')}`);
  for (const c of b.categories) console.log(`${c}: ${b.entities.filter((e) => e.cat === c).map((e) => e.id).join(', ')}`);
  console.log(`${b.scripts.length} scripts: ${b.scripts.map((s) => s.id).join(', ')}`);
} else if (cmd === 'sync') {
  const r = spawnSync('node', [path.join(root, 'tools/gen_examples.mjs'), 'fps-creator'], { stdio: 'inherit' }); process.exit(r.status ?? 1);
} else console.log('usage: node tools/fpsc-tools.mjs index|list|sync');
