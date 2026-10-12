#!/usr/bin/env node
// Runs the Playwright e2e suites in tools/e2e/*.mjs (each registers into `suites`; helpers in e2e-lib.mjs).
//   node tools/e2e.mjs                 # all suites
//   node tools/e2e.mjs conformance-2d  # one
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suites } from './e2e-lib.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) await import(path.join(dir, f));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(suites);
let failed = 0;
for (const n of names) {
  if (!suites[n]) { console.error(`unknown suite ${n}; have: ${Object.keys(suites).join(', ')}`); failed++; continue; }
  try { await suites[n](); console.log(`ok   ${n}`); } catch (e) { failed++; console.error(`FAIL ${n}: ${e.stack ?? e}`); }
}
process.exit(failed ? 1 : 0);
