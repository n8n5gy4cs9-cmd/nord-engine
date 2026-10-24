#!/usr/bin/env node
// Runs tools/api-check/checks.js (every API the Examples pages use) inside the real runtime in a headless browser. Exit code 1 on any failure.
//   NORD_BROWSER=/path/to/chromium-family-browser node tools/examples-smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './e2e-lib.mjs';
import { launch, sleep } from './cdp-lib.mjs';

const nord = process.env.NORD_BIN ?? ['target/release/nord', 'target/debug/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
if (!nord) throw new Error('build the CLI first: cargo build -p nord-cli');
const server = spawn(nord, ['serve', path.join(ROOT, 'tools/api-check'), '-p', '4170'], { stdio: 'ignore' });
await sleep(1800);
const page = await launch({ port: 9444 });
let failed = 0;
try {
  await page.goto('http://localhost:4170/', 3500);
  const raw = await page.eval(`import('/checks.js').then((m) => m.run(window.__nord)).then((r) => JSON.stringify(r))`);
  const results = JSON.parse(raw);
  for (const r of results) { console.log(`${r.ok ? '✔' : '✖'} ${r.name}${r.ok ? '' : '\n    ' + r.err}`); if (!r.ok) failed++; }
  console.log(`${results.length - failed}/${results.length} passed`);
} finally { page.close(); server.kill(); }
process.exit(failed ? 1 : 0);
