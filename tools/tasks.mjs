#!/usr/bin/env node
// Task tracker: PRD.json is the source of truth, task.md is generated.
// Usage: node tools/tasks.mjs status|next [n]|render|check|done ID..|start ID..|block ID..|todo ID..|add M# "title"|feature ID status
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prdPath = path.join(root, 'PRD.json');
const mdPath = path.join(root, 'task.md');
const prd = JSON.parse(fs.readFileSync(prdPath, 'utf8'));
const MARK = { done: 'x', in_progress: '~', blocked: '!', todo: ' ' };

function save() {
  prd.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(prdPath, JSON.stringify(prd, null, 2) + '\n');
  fs.writeFileSync(mdPath, render());
}

function pct(list) {
  const d = list.filter((t) => t.status === 'done').length;
  return { d, n: list.length, p: list.length ? Math.round((d / list.length) * 100) : 0 };
}

function render() {
  const all = pct(prd.tasks);
  let o = `# Nord Engine — Tasks\n\n`;
  o += `> **GENERATED** from \`PRD.json\` — do not hand-edit. Use \`node tools/tasks.mjs done <ID>\`.\n`;
  o += `> Legend: \`[x]\` done · \`[~]\` in progress · \`[!]\` blocked · \`[ ]\` todo. Credit: ${prd.author}.\n\n`;
  o += `**Overall: ${all.d}/${all.n} tasks (${all.p}%)** · updated ${prd.updated}\n\n`;
  o += `| Milestone | Progress |\n|---|---|\n`;
  for (const m of prd.milestones) {
    const p = pct(prd.tasks.filter((t) => t.milestone === m.id));
    o += `| ${m.id} ${m.name} | ${p.d}/${p.n} (${p.p}%) |\n`;
  }
  const open = prd.tasks.filter((t) => t.status !== 'done').slice(0, 5);
  o += `\n## Next up\n` + open.map((t) => `- **${t.id}** ${t.title}`).join('\n') + '\n';
  for (const m of prd.milestones) {
    o += `\n## ${m.id} — ${m.name}\n_${m.goal}_\n\n`;
    for (const t of prd.tasks.filter((t) => t.milestone === m.id)) {
      o += `- [${MARK[t.status] ?? ' '}] **${t.id}** ${t.title}${t.note ? ` — _${t.note}_` : ''}\n`;
    }
  }
  o += `\n## Features (PRD)\n\n| ID | Feature | Milestone | Priority | Status |\n|---|---|---|---|---|\n`;
  for (const f of prd.features) o += `| ${f.id} | ${f.title} | ${f.milestone} | ${f.priority} | ${f.status} |\n`;
  return o + '\n';
}

const [cmd, ...args] = process.argv.slice(2);
const find = (id) => {
  const t = prd.tasks.find((t) => t.id === id);
  if (!t) { console.error(`unknown task ${id}`); process.exit(1); }
  return t;
};
const setStatus = (s) => { args.forEach((id) => (find(id).status = s)); save(); };

switch (cmd) {
  case 'done': setStatus('done'); break;
  case 'start': setStatus('in_progress'); break;
  case 'block': setStatus('blocked'); break;
  case 'todo': setStatus('todo'); break;
  case 'render': save(); break;
  case 'add': {
    const [m, title] = args;
    if (!prd.milestones.some((x) => x.id === m)) { console.error('unknown milestone'); process.exit(1); }
    const n = prd.tasks.filter((t) => t.milestone === m).length + 1;
    const id = `${m}-${String(n).padStart(2, '0')}`;
    const idx = prd.tasks.map((t) => t.milestone).lastIndexOf(m);
    prd.tasks.splice(idx + 1, 0, { id, milestone: m, title, status: 'todo' });
    save(); console.log('added', id); break;
  }
  case 'feature': {
    const f = prd.features.find((f) => f.id === args[0]);
    if (!f) { console.error('unknown feature'); process.exit(1); }
    f.status = args[1]; save(); break;
  }
  case 'status':
    for (const m of prd.milestones) {
      const p = pct(prd.tasks.filter((t) => t.milestone === m.id));
      console.log(`${m.id.padEnd(3)} ${String(p.p).padStart(3)}%  ${p.d}/${p.n}  ${m.name}`);
    }
    break;
  case 'next': {
    const n = Number(args[0] ?? 8);
    prd.tasks.filter((t) => t.status !== 'done').slice(0, n).forEach((t) => console.log(`${t.id} [${t.status}] ${t.title}`));
    break;
  }
  case 'check': {
    const cur = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
    const strip = (s) => s.replace(/updated \d{4}-\d{2}-\d{2}/, '');
    if (strip(cur) !== strip(render())) { console.error('task.md is out of sync — run: node tools/tasks.mjs render'); process.exit(1); }
    console.log('task.md in sync');
    break;
  }
  default:
    console.log('usage: tasks.mjs status|next [n]|render|check|done ID..|start ID..|block ID..|todo ID..|add M# "title"|feature FR-xx status');
}
