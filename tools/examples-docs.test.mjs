// node --test tools/examples-docs.test.mjs — every complete script in the Examples pages and in examples/coin-dash must at least parse as an ES module.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'docs/manual-src');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exdocs-'));
const check = (code, name) => { const f = path.join(tmp, name.replace(/[^\w.-]+/g, '_') + '.mjs'); fs.writeFileSync(f, code); const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); return r.status === 0 ? null : r.stderr.split('\n').slice(0, 6).join('\n'); };

test('complete scripts in the Examples pages parse', () => {
  let n = 0; const bad = [];
  for (const f of fs.readdirSync(src).filter((x) => /^(ex-|examples\.md|unity-scripting|38-dev-console|37-unity)/.test(x) || x.startsWith('37-') || x.startsWith('38-'))) {
    const text = fs.readFileSync(path.join(src, f), 'utf8');
    [...text.matchAll(/```js\n([\s\S]*?)```/g)].forEach((m, i) => {
      const code = m[1];
      if (!/^\s*(import |export )/m.test(code) || /\/\/ …|\.\.\./.test(code) && !/^export default class/m.test(code)) return; // fragments are not checked
      n++; const err = check(code, `${f}-${i}`); if (err) bad.push(`${f} block ${i}:\n${err}`);
    });
  }
  assert.ok(n >= 30, `only ${n} complete scripts found`);
  assert.deepEqual(bad, [], bad.join('\n---\n'));
});

test('examples/coin-dash scripts parse and the project is consistent', () => {
  const dir = path.join(root, 'examples/coin-dash/scripts');
  for (const f of fs.readdirSync(dir)) assert.equal(check(fs.readFileSync(path.join(dir, f), 'utf8'), 'cd-' + f), null, f);
  const scene = JSON.parse(fs.readFileSync(path.join(root, 'examples/coin-dash/scenes/main.scene.json'), 'utf8'));
  for (const e of scene.entities) for (const s of e.scripts) assert.ok(fs.existsSync(path.join(root, 'examples/coin-dash', s.path)), s.path);
});
