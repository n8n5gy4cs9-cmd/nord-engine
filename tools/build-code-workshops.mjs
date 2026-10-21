#!/usr/bin/env node
// Keep full tutorial listings and downloadable source identical to the runnable samples.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './examples/lib.mjs';
const marker = '<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->';
const workshops = [
  ['coin-rush', 'tut-t33-code-coin-rush.md', 'scripts/course.js'],
  ['crystal-relay', 'tut-t34-code-crystal-relay.md', 'scripts/relay.js'],
  ['prism-relay', 'tut-t35-advanced-prism-shaders.md', 'scripts/prism.js'],
  ['circuit-vault', 'tut-t36-advanced-node-vault.md', 'app.js'],
  ['rust-salvage', 'tut-t37-advanced-rust-wasm.md', 'src/main.rs'],
];
execFileSync(process.execPath, ['tools/gen_examples.mjs', ...workshops.filter(w => fs.existsSync(path.join(ROOT, 'tools/examples', w[0], 'game.mjs'))).map(w => w[0])], { cwd: ROOT, stdio: 'inherit' });
const downloads = path.join(ROOT, 'docs/tutorial-downloads');
fs.mkdirSync(downloads, { recursive: true });
for (const [id, guide, main] of workshops) {
  const project = path.join(ROOT, 'examples', id);
  const walk = dir => fs.readdirSync(path.join(project, dir), { withFileTypes: true })
    .filter(e => !['dist', 'target', '.nord-cache', '.nord-lock', '.DS_Store'].includes(e.name))
    .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const files = walk('').filter(f => /\.(js|mjs|json|html|css|rs|toml)$/.test(f) || path.basename(f) === 'Cargo.lock').sort();
  const ordered = [main, ...files.filter(f => f !== main)];
  let appendix = '\n\n';
  for (const [index, file] of ordered.entries()) {
    const ext = path.extname(file).slice(1);
    const lang = ({ rs: 'rust', mjs: 'js', lock: 'toml' })[ext] ?? ext;
    const body = fs.readFileSync(path.join(project, file), 'utf8').trimEnd();
    appendix += index === 0 ? `### ${file}\n\n` : `<details>\n<summary>Complete ${file}</summary>\n\n`;
    appendix += '```' + lang + '\n' + body + '\n```\n\n';
    if (index !== 0) appendix += '</details>\n\n';
  }
  const source = path.join(ROOT, 'docs/manual-src', guide);
  const prose = fs.readFileSync(source, 'utf8').split(marker)[0];
  fs.writeFileSync(source, prose + marker + appendix);
  // Fixed timestamps/order make repeated source packaging byte-for-byte reproducible.
  execFileSync('python3', ['-c', `
import pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1]); dest = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for f in sorted(root.rglob('*')):
        if not f.is_file() or any(p in ('dist', 'target', '.nord-cache', '.nord-lock', '.DS_Store') for p in f.relative_to(root).parts): continue
        entry = zipfile.ZipInfo(root.name + '/' + f.relative_to(root).as_posix(), date_time=(2026, 10, 21, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, f.read_bytes())
`, project, path.join(downloads, id + '-source.zip')]);
  console.log(`${id}: ${ordered.length} complete text files + source archive`);
}
