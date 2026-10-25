#!/usr/bin/env node
// Guards the git history against big files. GitHub rejects any single file over 100 MB and history never shrinks, so:
//   over 100 MB  -> exit 1 (blocks the commit)      over 50 MB -> warning (committed files stay in history forever)
// Checks the files staged for commit (`git diff --cached`), or every tracked file with --all.
// Installed as .git/hooks/pre-commit by `node tools/check-big-files.mjs --install`. Bypass once with `git commit --no-verify`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024, WARN = 50 * MB, BLOCK = 100 * MB;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const root = git('rev-parse', '--show-toplevel').trim();

if (process.argv.includes('--install')) {
  const hook = path.join(root, '.git/hooks/pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\nnode "$(git rev-parse --show-toplevel)/tools/check-big-files.mjs" || exit 1\n', { mode: 0o755 });
  console.log('installed', hook);
  process.exit(0);
}

const names = (process.argv.includes('--all') ? git('ls-files', '-z') : git('diff', '--cached', '--name-only', '--diff-filter=AM', '-z')).split('\0').filter(Boolean);
const big = [];
for (const n of names) {
  let size = 0;
  try { size = fs.statSync(path.join(root, n)).size; } catch { continue; }
  if (size > WARN) big.push([n, size]);
}
big.sort((a, b) => b[1] - a[1]);
let blocked = false;
for (const [n, s] of big) {
  const mb = (s / MB).toFixed(1);
  if (s > BLOCK) { blocked = true; console.error(`BLOCKED  ${mb} MB  ${n}  (GitHub rejects files over 100 MB)`); }
  else console.warn(`WARNING  ${mb} MB  ${n}  (over 50 MB: it stays in the git history forever)`);
}
if (blocked) { console.error('\nUnstage it (git reset HEAD <file>), add it to .gitignore, or host it elsewhere (Git LFS / release asset).'); process.exit(1); }
if (!big.length && process.argv.includes('--all')) console.log('No file over 50 MB.');
