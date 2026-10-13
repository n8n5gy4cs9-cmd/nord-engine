#!/usr/bin/env node
// Pinned official API declarations + documentation sources. Called by tools/vendor.mjs --docs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'vendor/engine-docs');
const supplied = process.argv.indexOf('--from');
const work = supplied < 0 ? fs.mkdtempSync(path.join(os.tmpdir(), 'nord-docs-vendor-')) : process.argv[supplied + 1];
const packages = ['phaser@4.2.1', ...['babylonjs', 'babylonjs-gui', 'babylonjs-loaders', 'babylonjs-materials', 'babylonjs-post-process', 'babylonjs-procedural-textures', 'babylonjs-serializers'].map(p => `${p}@9.30.0`)];
if (supplied < 0) execFileSync('npm', ['install', '--prefix', work, '--ignore-scripts', '--no-audit', '--no-fund', 'typescript@5.9.3', ...packages], { stdio: 'inherit' });
const require = createRequire(path.join(work, 'package.json'));
const ts = require('typescript');
fs.mkdirSync(out, { recursive: true });
const sources = [];
const text = (n, sf) => n?.getText(sf) ?? '';
function docs(n, sf) {
  const comments = n.jsDoc ?? [];
  return comments.map(c => c.getText(sf).replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '')).join('\n').trim();
}
const privateNode = n => n.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword) || n.name && /^[_#]/.test(n.name.getText()) || n.jsDoc?.some(d => d.tags?.some(t => ['internal', 'hidden', 'ignore'].includes(t.tagName.text)));
function declaration(n, sf) {
  let signature = n.getText(sf);
  if (n.members) signature = signature.slice(0, signature.indexOf('{')).trim();
  const params = n.parameters?.map(p => ({ name: text(p.name, sf), type: text(p.type, sf), optional: !!p.questionToken || !!p.initializer, default: text(p.initializer, sf), rest: !!p.dotDotDotToken })) ?? [];
  return { name: text(n.name, sf) || (ts.isConstructorDeclaration(n) ? 'constructor' : ts.isCallSignatureDeclaration(n) ? 'call' : ts.isIndexSignatureDeclaration(n) ? 'index' : 'signature'), kind: ts.SyntaxKind[n.kind], signature, description: docs(n, sf), params, returns: text(n.type, sf), members: n.members?.filter(m => !privateNode(m)).map(m => declaration(m, sf)) ?? [] };
}
function parse(file, engine, pkg) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const records = [];
  function visit(nodes, prefix = '') {
    for (const n of nodes) {
      if (ts.isModuleDeclaration(n)) { const name = text(n.name, sf).replace(/^['"]|['"]$/g, ''); if (n.body?.statements) visit(n.body.statements, prefix ? `${prefix}.${name}` : name); else if (n.body) visit([n.body], prefix ? `${prefix}.${name}` : name); }
      else if (ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isEnumDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isFunctionDeclaration(n)) {
        if (privateNode(n)) continue;
        const d = declaration(n, sf); d.fullname = `${prefix ? prefix + '.' : ''}${d.name}`; d.engine = engine; d.package = pkg; records.push(d);
      } else if (ts.isVariableStatement(n)) for (const v of n.declarationList.declarations) { if (!privateNode(v)) { const d = declaration(v, sf); d.description ||= docs(n, sf); d.fullname = `${prefix ? prefix + '.' : ''}${d.name}`; d.engine = engine; d.package = pkg; records.push(d); } }
    }
  }
  visit(sf.statements);
  return records;
}
let declarations = [];
for (const pin of packages) {
  const [pkg, version] = pin.split('@');
  const dir = path.join(work, 'node_modules', pkg), meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));
  const file = pkg === 'phaser' ? 'types/phaser.d.ts' : pkg === 'babylonjs' ? 'babylon.d.ts' : fs.readdirSync(dir).find(f => f.endsWith('.d.ts') && !f.includes('.module.'));
  if (!file || meta.version !== version) throw new Error(`Missing matching declarations: ${pin}`);
  const src = path.join(dir, file), packed = `${pkg}.d.ts.gz`;
  fs.writeFileSync(path.join(out, packed), gzipSync(fs.readFileSync(src)));
  const license = fs.readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
  if (license) fs.copyFileSync(path.join(dir, license), path.join(out, `${pkg}-LICENSE.txt`));
  sources.push({ package: pkg, version, source: `https://registry.npmjs.org/${pkg}/-/${pkg}-${version}.tgz`, declaration: packed, license: pkg === 'phaser' ? 'MIT' : 'Apache-2.0' });
  declarations.push(...parse(src, pkg === 'phaser' ? 'Phaser' : 'Babylon', pkg));
}
fs.writeFileSync(path.join(out, 'api.json.gz'), gzipSync(JSON.stringify(declarations)));
// Keep the owner's older snapshot separately, with its actual version metadata.
const snapshot = path.join(root, 'TEMP/phaser-docs');
if (fs.existsSync(snapshot)) {
  const index = JSON.parse(fs.readFileSync(path.join(snapshot, 'index.json')));
  const payload = { meta: JSON.parse(fs.readFileSync(path.join(snapshot, 'meta.json'))), symbols: index.map(e => JSON.parse(fs.readFileSync(path.join(snapshot, 'symbols', e.file)))) };
  fs.writeFileSync(path.join(out, 'phaser-snapshot.json.gz'), gzipSync(JSON.stringify(payload)));
}
// Clone official Babylon prose at a fixed commit; web embeds are removed only when rendering.
const commit = '0222ae2cf8d566cc939d70d8fa12aa8d30174a50';
const clone = process.env.NORD_BABYLON_DOCS_SOURCE || path.join(work, 'babylon-docs');
if (!fs.existsSync(path.join(clone, 'content'))) {
  execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', 'https://github.com/BabylonJS/Documentation.git', clone], { stdio: 'inherit' });
  execFileSync('git', ['-C', clone, 'sparse-checkout', 'init', '--no-cone'], { stdio: 'inherit' });
  execFileSync('git', ['-C', clone, 'sparse-checkout', 'set', '/content/', '/license.md'], { stdio: 'inherit' });
  execFileSync('git', ['-C', clone, 'checkout', commit], { stdio: 'inherit' });
}
const actual = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== commit) throw new Error('Babylon documentation commit mismatch');
const guides = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, e.name); if (e.isDirectory()) walk(file); else if (e.name.endsWith('.md')) guides.push({ path: path.relative(path.join(clone, 'content'), file).replaceAll('\\', '/'), markdown: fs.readFileSync(file, 'utf8').replaceAll('\r', '') }); } }
walk(path.join(clone, 'content'));
fs.writeFileSync(path.join(out, 'babylon-guides.json.gz'), gzipSync(JSON.stringify(guides)));
fs.copyFileSync(path.join(clone, 'license.md'), path.join(out, 'babylon-guides-LICENSE.txt'));
sources.push({ package: 'BabylonJS/Documentation', commit, source: 'https://github.com/BabylonJS/Documentation', license: 'Apache-2.0', pages: guides.length, note: 'Prose snapshot may describe newer features; API declarations match Nord 9.30.0. Online playgrounds/videos are not bundled.' });
fs.writeFileSync(path.join(out, 'SOURCES.json'), JSON.stringify({ parser: 'typescript@5.9.3', sources, declarations: declarations.length, phaserSnapshot: fs.existsSync(path.join(out, 'phaser-snapshot.json.gz')) ? 'Owner-supplied 4.1.0 documentation; not current API truth.' : null }, null, 2) + '\n');
const manifest = path.join(root, 'vendor/VENDOR.json'), m = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest)) : { libs: {}, files: {} };
m.libs['engine-docs'] = { version: 'Phaser 4.2.1 / Babylon 9.30.0', license: 'MIT / Apache-2.0' };
for (const f of fs.readdirSync(out)) m.files[`vendor/engine-docs/${f}`] = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex');
fs.writeFileSync(manifest, JSON.stringify(m, null, 2) + '\n');
if (supplied < 0) fs.rmSync(work, { recursive: true, force: true });
console.log(`docs: ${declarations.length} public declarations, ${guides.length} Babylon guides`);
