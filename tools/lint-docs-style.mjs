#!/usr/bin/env node
// Mechanical checks of docs/DOC_STYLE.md on docs/manual-src/*.md.
//   1. every ```js / ```json / ```bash / ```glsl fence has a label on the line(s) directly above: **File: `path`** …, **Terminal**,
//      **Example**, **Console output**, **In the file** (or an inline-code file path as in older pages: `scripts/x.js` …)
//   2. a ```json fence must have editor steps (@ui[…]) earlier in the same section, unless the page is a reference page
// Pages with `style: reference` in the front matter are skipped. usage: node tools/lint-docs-style.mjs [--summary] [files…]
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../docs/manual-src');
const args = process.argv.slice(2);
const summary = args.includes('--summary');
const files = (args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)));
const LABEL = /^\s*(\*\*(File|In the file|Terminal|Example|Excerpt|Console output|Output|Result)\b|In a terminal|.*`[\w./@-]+\.(js|json|md|glsl|py|html|mjs|css|rs|toml)`|#+ .*[\w/-]+\.(js|json|md|glsl|py|html|mjs|css|rs|toml)\b|.*<span class="f">)/i;
let total = 0, pagesBad = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  if (/^style:\s*reference/m.test(text.split('\n---')[0])) continue;
  const lines = text.split('\n');
  let inFence = false, fenceLang = '', problems = [], sectionStart = 0, sectionHasUi = false;
  lines.forEach((l, i) => {
    if (/^## /.test(l)) { sectionStart = i; sectionHasUi = false; }
    if (/@ui\[/.test(l)) sectionHasUi = true;
    const m = /^```(\w*)/.exec(l);
    if (!m) return;
    if (!inFence) {
      inFence = true; fenceLang = m[1];
      if (!['js', 'json', 'bash', 'glsl', 'javascript', 'cs', 'sh'].includes(fenceLang)) return;
      if (fenceLang === 'cs') return;                                  // Unity C# shown for orientation only
      let j = i - 1; while (j >= 0 && lines[j].trim() === '') j--;
      const above = lines.slice(Math.max(0, j - 1), j + 1).join(' ');
      if (!LABEL.test(lines[j] ?? '') && !LABEL.test(above)) problems.push(`${i + 1}: ${fenceLang} block has no file label above it`);
      // editor-first applies to settings the editor can change: project, scene, prefab, UI, animator files. Plain data files (data/*.json) are text by nature.
      const target = `${lines[j] ?? ''} ${lines[j - 1] ?? ''}`;
      if (fenceLang === 'json' && !sectionHasUi && !/\(step \d+\.\d+|for comparison/.test(lines[j] ?? '') && /nord\.project\.json|\.scene\.json|\.prefab\.json|\.ui\.json|\.animator\.json|\.level2d\.json|\.mat\.json|\*\*In the file\*\*/.test(target)) problems.push(`${i + 1}: json block without editor steps (@ui[…]) in this section`);
    } else inFence = false;
  });
  if (problems.length) { pagesBad++; total += problems.length; if (!summary) { console.log(`${path.basename(f)} (${problems.length})`); problems.slice(0, 40).forEach((p) => console.log('  ' + p)); } else console.log(`${problems.length}\t${path.basename(f)}`); }
}
console.log(`\n${total} problems on ${pagesBad} pages`);
process.exit(total ? 1 : 0);
