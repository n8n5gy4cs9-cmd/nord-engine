#!/usr/bin/env node
// Import FPS Creator ".fpi" scripts into a Nord FPS project (docs/FPS_CREATOR.md §Importing FPS Creator scripts).
//   node tools/fpsc-import-fpi.mjs <scriptbank-folder> <project> [--only a,b] [--dry]
// Every script the Nord interpreter (runtime/fpsc/fpi.js) fully understands becomes <project>/fpsc/scripts/fpi-<name>.js (a data-only
// module holding the original source) and is listed in <project>/fpsc/bank.json "scripts". Scripts using unsupported commands (mostly
// enemy-AI "people" scripts) are skipped and listed, with the closest built-in Nord AI script suggested. Report: <project>/fpsc/fpi/IMPORT_REPORT.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseFpi, unsupported } = await import(pathToFileURL(path.join(root, 'runtime/fpsc/fpi.js')).href);

/** Closest built-in Nord script for FPS Creator enemy-AI scripts that the interpreter cannot run (matched on the file name). */
export const AI_ALIASES = [
  [/snipe/, 'ai-sniper'], [/shoot|launch|darkai|getinrange|strafe|throw|static/, 'ai-shooter'], [/melee|bite/, 'ai-melee'], [/chase|follow|cautious|restless|home/, 'ai-melee'],
  [/pace|passive|coward|cover|follow/, 'ai-patrol'], [/mover|flak/, 'ai-flyer'],
];
export const suggestAlias = (name) => AI_ALIASES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;

const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), path.join(rel, e.name)) : e.name.toLowerCase().endsWith('.fpi') ? [path.join(rel, e.name)] : []);
const slug = (s) => s.replace(/\.fpi$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Convert a scriptbank folder. Returns { done: [{id,rel,file,source,title,cat,desc}], skipped: [{rel,bad,alias}] }; writes nothing. */
export function convert(dir, only = null) {
  const done = [], skipped = [], seen = new Set();
  for (const rel of walk(dir).sort()) {
    const name = slug(rel); if (only && !only.includes(name) && !only.includes(slug(path.basename(rel)))) continue;
    const source = fs.readFileSync(path.join(dir, rel), 'utf8'), prog = parseFpi(source), bad = unsupported(prog);
    if (!prog.lines.length || bad.length) { skipped.push({ rel, bad: prog.lines.length ? bad : ['(no trigger lines)'], alias: suggestAlias(path.basename(rel, '.fpi')) }); continue; }
    let id = `fpi-${name}`; for (let n = 2; seen.has(id); n++) id = `fpi-${name}-${n}`; seen.add(id);
    const top = rel.includes(path.sep) ? rel.split(path.sep)[0] : '';
    done.push({ id, rel, file: `fpsc/scripts/${id}.js`, source, title: prog.desc || path.basename(rel, '.fpi'), cat: top ? `FPI ${top}` : 'FPI', desc: `Imported FPS Creator script "${rel.replaceAll(path.sep, '/')}"` });
  }
  return { done, skipped };
}

/** Write converted scripts into a project and register them in fpsc/bank.json. */
export function install(project, { done, skipped }) {
  const dirS = path.join(project, 'fpsc/scripts'), dirR = path.join(project, 'fpsc/fpi'); fs.mkdirSync(dirS, { recursive: true }); fs.mkdirSync(dirR, { recursive: true });
  for (const d of done) fs.writeFileSync(path.join(project, d.file), `// Imported FPS Creator script. Interpreted at run time by runtime/fpsc/fpi.js; edit the "fpi" text to change the behaviour.\nexport default ${JSON.stringify({ id: d.id, title: d.title, cat: d.cat, desc: d.desc, fpi: d.source }, null, 2)};\n`);
  const bp = path.join(project, 'fpsc/bank.json'); const bank = fs.existsSync(bp) ? JSON.parse(fs.readFileSync(bp, 'utf8')) : {};
  bank.scripts = [...new Set([...(bank.scripts ?? []), ...done.map((d) => d.file)])];
  fs.writeFileSync(bp, `${JSON.stringify(bank, null, 2)}\n`);
  fs.writeFileSync(path.join(dirR, 'IMPORT_REPORT.md'), report({ done, skipped }));
}

export function report({ done, skipped }) {
  const L = ['# FPS Creator script import', '', `${done.length} imported, ${skipped.length} skipped.`, '', '## Imported', '', '| Script id | From | Description |', '|---|---|---|', ...done.map((d) => `| \`${d.id}\` | ${d.rel.replaceAll(path.sep, '/')} | ${d.title} |`), '', '## Skipped (unsupported commands)', ''];
  L.push('| From | Unsupported | Use instead |', '|---|---|---|', ...skipped.map((s) => `| ${s.rel.replaceAll(path.sep, '/')} | ${s.bad.join(', ')} | ${s.alias ? `\`${s.alias}\`` : '-'} |`), '');
  return L.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), flag = (n) => process.argv.includes(`--${n}`);
  const oi = process.argv.indexOf('--only'), only = oi > 0 ? process.argv[oi + 1].split(',') : null;
  const [dir, project] = args.filter((a) => a !== only?.join(','));
  if (!dir || !project) { console.log('usage: node tools/fpsc-import-fpi.mjs <scriptbank-folder> <project> [--only a,b] [--dry]'); process.exit(2); }
  const res = convert(dir, only);
  console.log(`${res.done.length} scripts convertible, ${res.skipped.length} skipped`);
  if (flag('dry')) console.log(report(res)); else { install(project, res); console.log(`written to ${path.join(project, 'fpsc')} (report: fpsc/fpi/IMPORT_REPORT.md)`); }
}
