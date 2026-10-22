#!/usr/bin/env node
// Regenerate the node list in docs/GRAPH.md from runtime/core/graph/nodes.js (run, then python3 tools/sync-ui-docs.py).
import fs from 'node:fs';
import { NODES, CATS } from '../runtime/core/graph/nodes.js';
const clean = (x) => String(x).replace(/https?:\/\//g, '…://');
const pin = ([n, t, d]) => clean(`${n}:${t}${d !== undefined ? '=' + JSON.stringify(d) : ''}`);
let md = '';
for (const cat of CATS) {
  const list = Object.values(NODES).filter((s) => s.cat === cat);
  if (!list.length) continue;
  md += `\n### ${cat}\n\n| Node | Type id | Inputs | Outputs | Settings |\n|---|---|---|---|---|\n`;
  for (const s of list) {
    const ins = s.in.filter((p) => p[1] !== 'exec').map(pin).join(', '), outs = s.out.filter((p) => p[1] !== 'exec').map((p) => `${p[0]}:${p[1]}`).join(', ');
    const execIn = s.in.some((p) => p[1] === 'exec'), execOut = s.out.filter((p) => p[1] === 'exec').map((p) => p[0]).join(' / ');
    const kind = s.event ? 'event' : s.pure ? 'pure' : 'flow';
    const props = Object.entries(s.props).map(([k, v]) => `${k}${Array.isArray(v) ? ' (' + v.join('|') + ')' : '=' + JSON.stringify(v)}`).join(', ');
    md += `| **${s.title}** *(${kind}${execOut ? ` → ${execOut}` : ''}${execIn ? '' : ''})* | \`${s.type}\` | ${ins || '—'} | ${outs || '—'} | ${props || '—'} |\n`;
  }
}
const f = new URL('../docs/GRAPH.md', import.meta.url);
let s = fs.readFileSync(f, 'utf8');
s = s.replace(/<!-- GENERATED NODES -->[\s\S]*<!-- END GENERATED NODES -->/, `<!-- GENERATED NODES -->\n${md}\n<!-- END GENERATED NODES -->`);
fs.writeFileSync(f, s);
console.log(`${Object.keys(NODES).length} nodes documented`);
