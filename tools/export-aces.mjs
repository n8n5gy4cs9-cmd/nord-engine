#!/usr/bin/env node
// Exports the live event-sheet ACE registries (plugins, generic object ACEs, behaviors) to
// crates/nord-editor/assets/aces.json so the egui event sheet editor (M10-04/05) picks from the same data the runtime uses.
// Usage: node tools/export-aces.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const out = { format: 1, groups: [] };
for (const [n, g] of plugins) out.groups.push(group(n, 'plugin', g));
out.groups.push(group('Object', 'object', objectAces));
for (const [n, d] of core.behaviors) {
  out.groups.push(group(n, 'behavior', d, Object.entries(d.Class.attributes ?? {}).map(([k, a]) => ({ name: k, default: a.default ?? null }))));
}
const file = path.join(root, 'crates/nord-editor/assets/aces.json');
const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('aces.json is stale: run node tools/export-aces.mjs'); process.exit(1); }
  console.log('aces.json up to date');
} else {
  fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(root, file)} (${out.groups.length} groups)`);
}
