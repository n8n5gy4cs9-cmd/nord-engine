#!/usr/bin/env node
// Compile every event sheet (*.events.json) under a project or build folder to JavaScript (runtime/core/eventsheet/compile.js).
//   node tools/compile-sheets.mjs <dir> [--annotate] [--check]
// Writes <sheet>.compiled.js next to each sheet (includes resolved, like the runtime loader). With --annotate the sheet JSON gets
// "compiled": "<path>.compiled.js" so the runtime loads it (`nord build` does this on the staged output, never on your sources).
// --check only reports how many expressions compile. Interpretation stays the fallback for anything that does not.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { compileSheet } = await import(pathToFileURL(path.join(ROOT, 'runtime/core/eventsheet/compile.js')).href);
const dir = path.resolve(process.argv[2] ?? '.');
const annotate = process.argv.includes('--annotate'), check = process.argv.includes('--check');
const SKIP = new Set(['node_modules', 'vendor', 'runtime', 'dist', 'target']);
const sheets = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.events.json')) sheets.push(p);
  }
})(dir);

const rel = (p) => path.relative(dir, p).split(path.sep).join('/');
const read = (r) => JSON.parse(fs.readFileSync(path.join(dir, r), 'utf8'));
/** same flattening as EventSheet.load: includes are replaced by the included sheet's events */
const flat = (list, seen = new Set()) => list.flatMap((e) => {
  if (e.type === 'include') { if (seen.has(e.path)) return []; return flat(read(e.path).events ?? [], new Set([...seen, e.path])); }
  return [{ ...e, ...(e.children ? { children: flat(e.children, seen) } : {}) }];
});
// runtime engine location as seen from the project (build output has runtime/ next to the sheets; sources use the dev server's /runtime mount)
const engineAbs = path.join(dir, 'runtime/core/eventsheet/expr.js');
let total = 0, skipped = 0;
for (const f of sheets) {
  const r = rel(f);
  let data;
  try { data = { ...read(r) }; data.events = flat(data.events ?? [], new Set([r])); } catch (e) { console.error(`skip ${r}: ${e.message}`); continue; }
  const importPath = fs.existsSync(engineAbs) ? path.relative(path.dirname(f), engineAbs).split(path.sep).join('/') : '/runtime/core/eventsheet/expr.js';
  const { code, count, skipped: sk } = compileSheet(data, r, { engineImport: importPath.startsWith('.') || importPath.startsWith('/') ? importPath : `./${importPath}` });
  total += count; skipped += sk.length;
  if (check) { console.log(`${r}: ${count} expressions${sk.length ? ` (+${sk.length} raw/text params)` : ''}`); continue; }
  const out = `${f.replace(/\.json$/, '')}.compiled.js`;
  fs.writeFileSync(out, code);
  if (annotate) { const j = read(r); j.compiled = rel(out); fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n'); }
  console.log(`${r} → ${rel(out)} (${count} expressions${sk.length ? ` (+${sk.length} raw/text params)` : ''})`);
}
if (!sheets.length) console.log('no event sheets found');
else console.log(`${sheets.length} sheet(s), ${total} expressions compiled${skipped ? ` (+${skipped} raw/text params)` : ''}`);
