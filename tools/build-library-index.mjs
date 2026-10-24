#!/usr/bin/env node
// Generates library/INDEX.json from `// @nord {json}` header lines in library/**/*.{js,rs} plus library/extra.json (non-commentable files).
// Header: first line matching `@nord {...}` (single-line JSON: id, title, category, tier[], tags[], description, requires[], demo?). `attributes` are
// parsed from `static attributes = {…}`. Usage: node tools/build-library-index.mjs [--check]   (--check fails if INDEX.json is stale / has dup ids / missing files)
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'library');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/** Top-level keys of `static attributes = { … }` (brace-depth scan, ignores nested). */
export function attributeNames(src) {
  const m = /static attributes\s*=\s*\{/.exec(src);
  if (!m) return [];
  let i = m.index + m[0].length, depth = 1, key = '', keys = [], top = true, str = null;
  const start = i;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (str) { if (c === str && src[i - 1] !== '\\') str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 1) { const k = src.slice(start, i).match(/([A-Za-z_$][\w$]*)\s*$/); if (k) keys.push(k[1]); }
    else if (c === ',' && depth === 1) { /* next key */ }
  }
  return [...new Set(keys)];
}

export function build() {
  const items = [], errors = [];
  for (const f of walk(lib).sort()) {
    if (!/\.(js|rs)$/.test(f) || /\/_[^/]*$/.test(f) || f.includes('/addons/')) continue;
    const src = readFileSync(f, 'utf8');
    const m = /@nord\s+(\{.*\})/.exec(src);
    if (!m) { errors.push(`${relative(root, f)}: missing @nord header`); continue; }
    let h;
    try { h = JSON.parse(m[1]); } catch (e) { errors.push(`${relative(root, f)}: bad header JSON (${e.message})`); continue; }
    for (const k of ['id', 'title', 'category', 'tier', 'description']) if (!h[k]) errors.push(`${relative(root, f)}: header missing '${k}'`);
    const kind = f.includes('/snippets/') ? 'snippet' : f.includes('/apps/') ? 'app-kit' : f.endsWith('.rs') ? 'rust' : 'script';
    items.push({ id: h.id, title: h.title, kind, category: h.category, tags: h.tags ?? [], tier: h.tier, file: relative(root, f),
      description: h.description, attributes: attributeNames(src), requires: h.requires ?? [], demo: h.demo ?? '', source: h.source ?? 'original' });
  }
  const extra = join(lib, 'extra.json');
  if (existsSync(extra)) for (const e of JSON.parse(readFileSync(extra, 'utf8'))) items.push(e);
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.id)) errors.push(`duplicate id ${it.id}`);
    seen.add(it.id);
    if (!existsSync(join(root, it.file))) errors.push(`${it.id}: file ${it.file} missing`);
  }
  items.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  return { items, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { items, errors } = build();
  const out = '[\n' + items.map((i) => '  ' + JSON.stringify(i)).join(',\n') + '\n]\n';
  const target = join(lib, 'INDEX.json');
  if (process.argv.includes('--check')) {
    if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
    if (!existsSync(target) || readFileSync(target, 'utf8') !== out) { console.error('library/INDEX.json is stale — run node tools/build-library-index.mjs'); process.exit(1); }
    console.log(`library index ok (${items.length} items)`);
  } else {
    if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
    writeFileSync(target, out);
    console.log(`wrote library/INDEX.json (${items.length} items)`);
  }
}
