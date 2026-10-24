#!/usr/bin/env node
// Vendor pinned third-party libs into vendor/ (committed) so built games have NO online dependencies.
// Usage: node tools/vendor.mjs            install/update everything
//        node tools/vendor.mjs --crates   (re)vendor only the Rust-crate assets (macroquad JS loader)
//        node tools/vendor.mjs --only <name>   refresh a single lib (e.g. three)
//        node tools/vendor.mjs --verify   check sha256 of vendor/ files against vendor/VENDOR.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = path.join(root, 'vendor');
const manifestPath = path.join(V, 'VENDOR.json');

// name, npm package@exact version, licence, files: [from (inside package), to (inside vendor/<name>/)]
const LIBS = [
  { name: 'phaser', pkg: 'phaser@4.2.1', license: 'MIT', files: [['dist/phaser.min.js'], ['dist/phaser-arcade-physics.min.js'], ['LICENSE.md']] },
  { name: 'babylonjs', pkg: 'babylonjs@9.30.0', license: 'Apache-2.0', files: [['babylon.js'], ['license.md']] },
  { name: 'babylonjs-loaders', pkg: 'babylonjs-loaders@9.30.0', license: 'Apache-2.0', files: [['babylonjs.loaders.min.js'], ['license.md']] },
  { name: 'babylonjs-gui', pkg: 'babylonjs-gui@9.30.0', license: 'Apache-2.0', files: [['babylon.gui.min.js']] },
  { name: 'babylonjs-materials', pkg: 'babylonjs-materials@9.30.0', license: 'Apache-2.0', files: [['babylonjs.materials.min.js']] },
  { name: 'babylonjs-post-process', pkg: 'babylonjs-post-process@9.30.0', license: 'Apache-2.0', files: [['babylonjs.postProcess.min.js']] },
  { name: 'babylonjs-procedural-textures', pkg: 'babylonjs-procedural-textures@9.30.0', license: 'Apache-2.0', files: [['babylonjs.proceduralTextures.min.js']] },
  { name: 'babylonjs-serializers', pkg: 'babylonjs-serializers@9.30.0', license: 'Apache-2.0', files: [['babylonjs.serializers.min.js']] },
  { name: 'three', pkg: 'three@0.180.0', license: 'MIT', files: [['build/three.module.min.js'], ['build/three.core.min.js'], ['examples/jsm/controls/OrbitControls.js'], ['examples/jsm/controls/TransformControls.js'], ['examples/jsm/exporters/GLTFExporter.js'], ['examples/jsm/loaders/GLTFLoader.js'], ['examples/jsm/utils/BufferGeometryUtils.js'], ['LICENSE']] },
  { name: 'havok', pkg: '@babylonjs/havok@1.3.14', license: 'MIT wrapper (Havok wasm free for use with Babylon.js)', files: [['lib/umd/HavokPhysics_umd.js'], ['lib/umd/HavokPhysics.wasm'], ['LICENSE.md']] },
  { name: 'playcanvas', pkg: 'playcanvas@2.23.2', license: 'MIT', optional: true, files: [['build/playcanvas.min.js'], ['LICENSE']] },
  { name: 'esbuild-wasm', pkg: 'esbuild-wasm@0.25.10', license: 'MIT', files: [['lib/browser.js'], ['esbuild.wasm'], ['LICENSE.md']] },
  { name: 'litegraph', pkg: 'litegraph.js@0.7.18', license: 'MIT', files: [['build/litegraph.core.js'], ['css/litegraph.css'], ['LICENSE']] },
  { name: 'marked', pkg: 'marked@18.1.0', license: 'MIT', files: [['lib/marked.umd.js'], ['LICENSE.md']] },
  { name: 'fonts', pkg: '@fontsource/inter@5.3.0', license: 'OFL-1.1', to: 'fonts/inter', files: [['files/inter-latin-400-normal.woff2'], ['files/inter-latin-500-normal.woff2'], ['files/inter-latin-600-normal.woff2'], ['files/inter-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/jetbrains-mono@5.3.0', license: 'OFL-1.1', to: 'fonts/jetbrains-mono', files: [['files/jetbrains-mono-latin-400-normal.woff2'], ['files/jetbrains-mono-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/plus-jakarta-sans@5.3.0', license: 'OFL-1.1', to: 'fonts/plus-jakarta-sans', files: [['files/plus-jakarta-sans-latin-400-normal.woff2'], ['files/plus-jakarta-sans-latin-500-normal.woff2'], ['files/plus-jakarta-sans-latin-600-normal.woff2'], ['files/plus-jakarta-sans-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/ibm-plex-sans@5.3.0', license: 'OFL-1.1', to: 'fonts/ibm-plex-sans', files: [['files/ibm-plex-sans-latin-400-normal.woff2'], ['files/ibm-plex-sans-latin-500-normal.woff2'], ['files/ibm-plex-sans-latin-600-normal.woff2'], ['files/ibm-plex-sans-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/ibm-plex-mono@5.3.0', license: 'OFL-1.1', to: 'fonts/ibm-plex-mono', files: [['files/ibm-plex-mono-latin-400-normal.woff2'], ['files/ibm-plex-mono-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/pixelify-sans@5.3.0', license: 'OFL-1.1', to: 'fonts/pixelify-sans', files: [['files/pixelify-sans-latin-400-normal.woff2'], ['files/pixelify-sans-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/orbitron@5.3.0', license: 'OFL-1.1', to: 'fonts/orbitron', files: [['files/orbitron-latin-700-normal.woff2'], ['files/orbitron-latin-900-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/vt323@5.3.0', license: 'OFL-1.1', to: 'fonts/vt323', files: [['files/vt323-latin-400-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/fira-code@5.3.0', license: 'OFL-1.1', to: 'fonts/fira-code', files: [['files/fira-code-latin-400-normal.woff2'], ['files/fira-code-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/roboto@5.3.0', license: 'OFL-1.1', to: 'fonts/roboto', files: [['files/roboto-latin-400-normal.woff2'], ['files/roboto-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/source-sans-3@5.3.1', license: 'OFL-1.1', to: 'fonts/source-sans-3', files: [['files/source-sans-3-latin-400-normal.woff2'], ['files/source-sans-3-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/dm-sans@5.3.0', license: 'OFL-1.1', to: 'fonts/dm-sans', files: [['files/dm-sans-latin-400-normal.woff2'], ['files/dm-sans-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/manrope@5.3.0', license: 'OFL-1.1', to: 'fonts/manrope', files: [['files/manrope-latin-400-normal.woff2'], ['files/manrope-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/open-sans@5.3.0', license: 'OFL-1.1', to: 'fonts/open-sans', files: [['files/open-sans-latin-400-normal.woff2'], ['files/open-sans-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/roboto-mono@5.3.0', license: 'OFL-1.1', to: 'fonts/roboto-mono', files: [['files/roboto-mono-latin-400-normal.woff2'], ['files/roboto-mono-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/source-code-pro@5.3.1', license: 'OFL-1.1', to: 'fonts/source-code-pro', files: [['files/source-code-pro-latin-400-normal.woff2'], ['files/source-code-pro-latin-700-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/dm-mono@5.3.0', license: 'OFL-1.1', to: 'fonts/dm-mono', files: [['files/dm-mono-latin-400-normal.woff2'], ['files/dm-mono-latin-500-normal.woff2'], ['LICENSE']] },
  { name: 'fonts', pkg: '@fontsource/red-hat-mono@5.3.0', license: 'OFL-1.1', to: 'fonts/red-hat-mono', files: [['files/red-hat-mono-latin-400-normal.woff2'], ['files/red-hat-mono-latin-700-normal.woff2'], ['LICENSE']] },
];
// Lucide icons: curated subset → assets/icons/lucide (used by the egui editor + manual)
const LUCIDE = { pkg: 'lucide-static@1.55.0', license: 'ISC' };

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

if (process.argv.includes('--verify')) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let bad = 0;
  for (const [file, h] of Object.entries(m.files)) {
    const p = path.join(root, file);
    if (!fs.existsSync(p) || sha(p) !== h) { console.error('MISMATCH', file); bad++; }
  }
  console.log(bad ? `${bad} problem(s)` : `vendor OK (${Object.keys(m.files).length} files)`);
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--docs')) { execFileSync(process.execPath, [path.join(root, 'tools/vendor-docs.mjs')], { stdio: 'inherit' }); process.exit(0); }

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null; // --only <name>: refresh one lib, keep the rest of vendor/

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-vendor-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
function fetchPkg(pkg) {
  const dir = path.join(work, pkg.replace(/[@/]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const tgz = run('npm', ['pack', pkg, '--silent'], dir).split('\n').pop();
  run('tar', ['xzf', tgz], dir);
  return path.join(dir, 'package');
}
// Rust crate assets (downloaded from static.crates.io, pinned): macroquad's JS loader needed by `web-wasm-game` exports.
const CRATES = [
  { name: 'macroquad', crate: 'macroquad', version: '0.4.16', license: 'MIT OR Apache-2.0', files: [['js/mq_js_bundle.js'], ['LICENSE-MIT'], ['LICENSE-APACHE']] },
];
function fetchCrate(c) {
  const dir = path.join(work, `crate_${c.crate}`);
  fs.mkdirSync(dir, { recursive: true });
  run('curl', ['-fsSL', '-o', 'c.crate', `https://static.crates.io/crates/${c.crate}/${c.crate}-${c.version}.crate`], dir);
  run('tar', ['xzf', 'c.crate'], dir);
  return path.join(dir, `${c.crate}-${c.version}`);
}
function vendorCrates() {
  for (const c of CRATES) {
    const dir = fetchCrate(c);
    for (const [from] of c.files) copy(path.join(dir, from), path.join(V, c.name, path.basename(from)), c.name, c.version, c.license);
    console.log('vendored crate', `${c.crate}@${c.version}`);
  }
}
const entries = [];
const copy = (src, dst, lib, version, license) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  entries.push({ lib, version, license, file: path.relative(root, dst) });
};

if (process.argv.includes('--crates')) { // add/refresh only the crate assets, keep everything else (and the manifest) as is
  vendorCrates();
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const e of entries) { m.libs[e.lib] = { version: e.version, license: e.license }; m.files[e.file] = sha(path.join(root, e.file)); }
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
  fs.rmSync(work, { recursive: true, force: true });
  process.exit(0);
}
if (only) { // add/refresh only the named LIBS entries and merge them into the manifest
  for (const L of LIBS.filter((l) => l.name === only)) {
    const pkgDir = fetchPkg(L.pkg);
    const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'))).version;
    for (const [from] of L.files) copy(path.join(pkgDir, from), path.join(V, L.to ?? L.name, path.basename(from)), L.name, version, L.license);
    console.log('vendored', L.pkg);
  }
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const e of entries) { m.libs[e.lib] = { version: e.version, license: e.license }; m.files[e.file] = sha(path.join(root, e.file)); }
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
  fs.rmSync(work, { recursive: true, force: true });
  process.exit(0);
}
// Preserve the owner-supplied documentation archive when re-vendoring all libraries.
const archivePath = path.join(V, 'engine-docs/phaser-snapshot.json.gz');
const savedArchive = fs.existsSync(archivePath) ? fs.readFileSync(archivePath) : null;
fs.rmSync(V, { recursive: true, force: true });
for (const L of LIBS) {
  const pkgDir = fetchPkg(L.pkg);
  const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'))).version;
  const base = path.join(V, L.to ?? L.name);
  for (const [from] of L.files) {
    let src = path.join(pkgDir, from);
    if (!fs.existsSync(src)) { // licence file names vary
      const alt = fs.readdirSync(pkgDir).find((f) => f.toLowerCase().replace(/\.md$/, '') === path.basename(from).toLowerCase().replace(/\.md$/, ''));
      if (alt && /licen/i.test(from)) src = path.join(pkgDir, alt); else { console.warn(`!! ${L.pkg}: missing ${from}`); continue; }
    }
    copy(src, path.join(base, path.basename(src)), L.name, version, L.license);
  }
  if (L.name === 'litegraph') { // Nord patch: let the editor keep text/labels visible when zoomed out
    const f = path.join(base, 'litegraph.core.js'); let t = fs.readFileSync(f, 'utf8');
    t = '/* Nord patch: the two `ds.scale < 0.6/0.5` low-quality thresholds read LiteGraph.low_quality_scale (tools/vendor.mjs). */\n' + t.replace(/this\.ds\.scale < 0\.6/g, 'this.ds.scale < (LiteGraph.low_quality_scale ?? 0.6)').replace(/this\.ds\.scale < 0\.5/g, 'this.ds.scale < (LiteGraph.low_quality_scale ?? 0.5)');
    fs.writeFileSync(f, t); entries.find((e) => e.file.endsWith('litegraph.core.js')).patched = true;
  }
  console.log('vendored', L.pkg);
}

vendorCrates();

// CodeMirror bundle (manual live examples)
const vb = path.join(root, 'tools/vendor');
execFileSync('npm', ['ci', '--silent', '--no-audit', '--no-fund'], { cwd: vb, stdio: 'inherit' });
const out = path.join(V, 'codemirror/cm.bundle.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(path.join(vb, 'node_modules/.bin/esbuild'), ['codemirror.entry.js', '--bundle', '--format=esm', '--minify', `--outfile=${out}`], { cwd: vb, stdio: 'inherit' });
entries.push({ lib: 'codemirror', version: '6 (see tools/vendor/package-lock.json)', license: 'MIT', file: path.relative(root, out) });

// Lucide subset
const names = fs.readFileSync(path.join(root, 'tools/lucide-icons.txt'), 'utf8').split(/\s+/).filter(Boolean);
const lp = fetchPkg(LUCIDE.pkg);
const lver = JSON.parse(fs.readFileSync(path.join(lp, 'package.json'))).version;
const idir = path.join(root, 'assets/icons/lucide');
fs.rmSync(idir, { recursive: true, force: true });
for (const n of names) {
  const s = path.join(lp, 'icons', `${n}.svg`);
  if (!fs.existsSync(s)) { console.warn('!! lucide missing', n); continue; }
  // currentColor → white so egui SVG loader tints cleanly; keep file otherwise untouched
  fs.mkdirSync(idir, { recursive: true });
  fs.writeFileSync(path.join(idir, `${n}.svg`), fs.readFileSync(s, 'utf8').replace(/currentColor/g, '#ffffff'));
}
fs.copyFileSync(path.join(lp, 'LICENSE'), path.join(idir, 'LICENSE'));
entries.push({ lib: 'lucide', version: lver, license: LUCIDE.license, file: 'assets/icons/lucide (subset, see tools/lucide-icons.txt)' });

if (savedArchive) { fs.mkdirSync(path.dirname(archivePath), { recursive: true }); fs.writeFileSync(archivePath, savedArchive); }
execFileSync(process.execPath, [path.join(root, 'tools/vendor-docs.mjs')], { stdio: 'inherit' });
entries.push({ lib: 'engine-docs', version: 'Phaser 4.2.1 / Babylon 9.30.0', license: 'MIT / Apache-2.0', file: 'vendor/engine-docs' });
const files = {};
for (const f of walk(V).filter((f) => f !== manifestPath)) files[path.relative(root, f)] = sha(f);
for (const f of walk(idir)) files[path.relative(root, f)] = sha(f);
fs.writeFileSync(manifestPath, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), libs: entries.filter((e) => !e.file.includes('/') || true).reduce((a, e) => { a[e.lib] ??= { version: e.version, license: e.license }; return a; }, {}), files }, null, 2) + '\n');
fs.rmSync(work, { recursive: true, force: true });
console.log(`done: ${Object.keys(files).length} files, ${(Object.keys(files).reduce((s, f) => s + fs.statSync(path.join(root, f)).size, 0) / 1e6).toFixed(1)} MB`);
