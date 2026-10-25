#!/usr/bin/env node
// Review every published page's navigation, beginner help and local illustrations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manual = path.join(root, 'docs/manual');
const pages = JSON.parse(fs.readFileSync(path.join(manual, 'assets/page-inventory.json'), 'utf8'));
const issues = [];
if (pages.filter(p => p.hub).length !== 6) issues.push('Expected exactly six section landing pages');
for (const page of [{ file: 'index.html', title: 'Documentation home' }, ...pages]) {
  const html = fs.readFileSync(path.join(manual, page.file), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  if (new Set(ids).size !== ids.length) issues.push(`${page.file}: duplicate HTML ids make contents links ambiguous`);
  const nav = html.match(/<nav id="sidebar"[\s\S]*?<\/nav>/)?.[0] || '';
  if ((nav.match(/class="old-category"/g) || []).length !== 1) issues.push(`${page.file}: needs exactly one Old sidebar group`);
  if (!html.includes('box dummies')) issues.push(`${page.file}: missing beginner explanation`);
  if (page.old && !html.includes('archive-notice')) issues.push(`${page.file}: missing archive explanation`);
  if (page.hub && (!html.includes('id="topic-directory"') || !html.includes('class="archive-panel"'))) issues.push(`${page.file}: needs current topics and a collapsed Old panel`);
  if (page.hub && /class="archive-panel" open/.test(html)) issues.push(`${page.file}: Old must start collapsed`);
  const areaPages = pages.filter(p => p.section === (page.section || 'Start here'));
  const activeNav = nav.split('<details class="old-category"')[0];
  for (const old of areaPages.filter(p => p.old)) {
    const href = path.posix.relative(path.posix.dirname(page.file), old.file);
    if (activeNav.includes(`href="${href}"`)) issues.push(`${page.file}: old page appears in current navigation: ${old.file}`);
  }
  for (const [, src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(src)) issues.push(`${page.file}: remote illustration ${src}`);
    else if (!fs.existsSync(path.join(manual, path.posix.dirname(page.file), src))) issues.push(`${page.file}: missing illustration ${src}`);
  }
}
const old = pages.filter(p => p.old);
if (process.argv.includes('--write')) {
  const esc = text => String(text).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const report = `# Manual page review — 25 October 2026\n\nThis report inventories every published content page. The pass checks current/Old navigation, a beginner explanation on each page, unique HTML ids for unambiguous contents links, retained local illustrations, archive notices, and topic directories on all six section landing pages. The manual builder separately checks links, anchors and live snippets. The browser pass checks all eleven themes, text contrast, offline search and collapse behavior.\n\nEarlier workflows are retained for existing projects. Old does not mean that a supported native API is broken. Existing complete-workshop code is preserved. T01 corrects Play-edit persistence guidance; the introductory scripting and movement examples are corrected in the final quality pass. The final clarity pass also removes repetitive chapter openings and duplicate indexes, fixes the introductory scripts and runs **node tools/manual/check-beginner-examples.mjs**. Its small physics fixture verifies callback handoff and arithmetic, not backend collision integration. This is a navigation, clarity and structural review; it is not a new human execution of every older workshop.\n\n${pages.length} content pages: ${pages.length - old.length} current, ${old.length} Old.\n\n| Page | Area | Disposition and topic |\n|---|---|---|\n` + pages.map(p => `| [${esc(p.title)}](manual/${p.file}) | ${esc(p.section)} | ${p.old ? '**Old:** ' + esc(p.old.reason) : esc(p.summary || p.group)} |`).join('\n') + '\n';
  fs.writeFileSync(path.join(root, 'docs/MANUAL_REVIEW.md'), report);
}
if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
console.log(`PASS: ${pages.length + 1} pages; six topic hubs; ${old.length} retained Old pages; all local illustrations present`);
