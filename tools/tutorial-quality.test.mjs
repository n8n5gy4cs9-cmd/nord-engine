import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBoards, portfolioHTML } from './examples/paper-worlds/src/model.js';
import { loadScript } from './examples/desk-common/desk.js';

test('portfolio export round-trips HTML-like text and replacement tokens as inert JSON', () => {
  const boards = newBoards();
  boards[0].shapes.push({
    kind: 'text',
    x: 1,
    y: 2,
    text: '<script>alert("hello")</script> costs $& $$ $` $\' — café',
  });
  const template =
    '<script id="desk-data" type="application/json">/*BOARD_DATA*/</script>';
  const html = portfolioHTML(template, boards);
  assert.equal(html.match(/<script/g).length, 1);
  assert.equal(html.match(/<\/script>/g).length, 1);
  const embedded = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
  assert.deepEqual(JSON.parse(embedded), boards);
});

test('concurrent local script loads share readiness and a failed load can retry', async () => {
  const scripts = [];
  globalThis.document = {
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { append: (script) => scripts.push(script) },
  };
  try {
    const first = loadScript('quality-one.js');
    const second = loadScript('quality-one.js');
    assert.equal(first, second);
    assert.equal(scripts.length, 1);
    let ready = false;
    second.then(() => {
      ready = true;
    });
    await Promise.resolve();
    assert.equal(ready, false);
    scripts[0].onload();
    await first;
    assert.equal(ready, true);
    const failed = loadScript('quality-retry.js');
    scripts[1].onerror();
    await assert.rejects(failed, /Cannot load/);
    const retried = loadScript('quality-retry.js');
    assert.equal(scripts.length, 3);
    scripts[2].onload();
    await retried;
  } finally {
    delete globalThis.document;
  }
});

test('authored tutorial code remains readable instead of collapsing into long lines', () => {
  const folders = [
    'coastline-sprint',
    'vector-patrol',
    'jengatedris',
    'nord-office',
    'paper-worlds',
    'rss-river',
    'retro-common',
    'network-common',
    'desk-common',
  ];
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const name = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(name) : [name];
    });
  for (const folder of folders)
    for (const file of walk('tools/examples/' + folder)) {
      if (!/\.(js|css|html)$/.test(file)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) =>
        assert(line.length <= 180, `${file}:${index + 1} is ${line.length} characters`),
      );
    }
});
