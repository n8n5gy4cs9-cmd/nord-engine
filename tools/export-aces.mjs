#!/usr/bin/env node
// Exports the live event-sheet ACE registries (plugins, generic object ACEs, behaviors) to
// crates/nord-editor/assets/aces.json so the egui event sheet editor (M10-04/05) picks from the same data the runtime uses.
// Usage: node tools/export-aces.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = await import(path.join(root, 'runtime/core/index.js'));
const { plugins, objectAces } = await import(path.join(root, 'runtime/core/eventsheet/aces.js'));

const ace = (id, d) => {
  const o = { id, params: d.params ?? [] };
  if (d.raw?.length) o.raw = d.raw;
  if (d.trigger) o.trigger = true;
  if (d.loop) o.loop = true;
  return o;
};
const group = (name, kind, g, attrs) => ({
  name, kind,
  conditions: Object.entries(g.conditions ?? {}).map(([k, d]) => ace(k, d)),
  actions: Object.entries(g.actions ?? {}).map(([k, d]) => ace(k, d)),
  expressions: Object.keys(g.expressions ?? {}),
  ...(attrs ? { properties: attrs } : {}),
});
const { dataTypes } = await import(path.join(root, 'runtime/core/eventsheet/objects.js'));
const out = { format: 1, groups: [] };
for (const [n, g] of plugins) out.groups.push(group(n, 'plugin', g));
out.groups.push(group('Object', 'object', objectAces));
for (const [n, d] of core.behaviors) {
  out.groups.push(group(n, 'behavior', d, Object.entries(d.Class.attributes ?? {}).map(([k, a]) => ({ name: k, default: a.default ?? null }))));
}
for (const [n, d] of dataTypes) out.groups.push(group(n, 'data', d));
const base = JSON.stringify(out, null, 1) + '\n';
// --project <dir>: load the project's addons (docs/ADDONS.md) and write only the groups they add/change to <dir>/.nord/aces.json
const pi = process.argv.indexOf('--project');
if (pi > 0) {
  const proj = path.resolve(process.argv[pi + 1] ?? '.');
  const project = JSON.parse(fs.readFileSync(path.join(proj, 'nord.project.json'), 'utf8'));
  const before = new Map(out.groups.map((g) => [`${g.kind}:${g.name}`, JSON.stringify(g)]));
  const errors = [];
  const game = { project, addons: [], loadJSON: async (p) => JSON.parse(fs.readFileSync(path.join(proj, p), 'utf8')), importScript: (p) => import(pathToFileURL(path.join(proj, p)).href), reportError: (e, who) => errors.push(`${who?.constructor?.name}: ${e.message}`), warn: (m) => errors.push(m) };
  const { loadAddons } = await import(path.join(root, 'runtime/core/addons.js'));
  await loadAddons(game);
  const groups = [];
  for (const [n, g] of plugins) groups.push(group(n, 'plugin', g));
  groups.push(group('Object', 'object', objectAces));
  for (const [n, d] of core.behaviors) groups.push(group(n, 'behavior', d, Object.entries(d.Class.attributes ?? {}).map(([k, a]) => ({ name: k, default: a.default ?? null }))));
  for (const [n, d] of dataTypes) groups.push(group(n, 'data', d));
  const added = groups.filter((g) => before.get(`${g.kind}:${g.name}`) !== JSON.stringify(g));
  fs.mkdirSync(path.join(proj, '.nord'), { recursive: true });
  fs.writeFileSync(path.join(proj, '.nord/aces.json'), JSON.stringify({ format: 1, groups: added, errors }, null, 1) + '\n');
  console.log(`addons: ${game.addons.length} loaded, ${added.length} group(s) added/changed${errors.length ? `, ${errors.length} problem(s): ${errors.join('; ')}` : ''}`);
  process.exit(errors.length ? 1 : 0);
}
const file = path.join(root, 'crates/nord-editor/assets/aces.json');
const text = base;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('aces.json is stale: run node tools/export-aces.mjs'); process.exit(1); }
  console.log('aces.json up to date');
} else {
  fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(root, file)} (${out.groups.length} groups)`);
}
