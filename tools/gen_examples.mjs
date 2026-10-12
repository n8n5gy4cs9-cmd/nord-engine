#!/usr/bin/env node
// Regenerates examples/<id>/ (and templates/<id>/) from tools/examples/<id>/game.mjs (+ scripts/*.js, real files that get copied).
// usage: node tools/gen_examples.mjs [id…]      Edit the sources in tools/examples, never the generated folders.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, writeProject } from './examples/lib.mjs';

const src = path.join(ROOT, 'tools/examples');
const want = process.argv.slice(2);
const ids = fs.readdirSync(src).filter((d) => fs.existsSync(path.join(src, d, 'game.mjs')) && (!want.length || want.includes(d)));
const index = [];
for (const id of ids) {
  const mod = await import(pathToFileURL(path.join(src, id, 'game.mjs')).href);
  const spec = mod.default();
  spec.id = id;
  if (spec.example !== false) writeProject(spec, path.join(ROOT, 'examples', id), path.join(src, id));
  if (spec.template) writeProject({ ...spec, readme: spec.template.readme ?? spec.readme }, path.join(ROOT, 'templates', spec.template.id ?? id), path.join(src, id));
  index.push({ id, name: spec.name, kind: spec.project.type, template: spec.template ? { id: spec.template.id ?? id, title: spec.template.title, description: spec.template.description } : null, example: spec.example !== false });
  console.log(`generated ${id}${spec.template ? ' (+template)' : ''}`);
}
if (!want.length) {
  const t = index.filter((i) => i.template).map((i) => ({ id: i.template.id, title: i.template.title, description: i.template.description, type: i.kind }));
  fs.mkdirSync(path.join(ROOT, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'templates/templates.json'), JSON.stringify(t, null, 2) + '\n');
}
