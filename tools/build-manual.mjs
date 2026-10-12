#!/usr/bin/env node
// Builds the offline HTML manual: docs/manual-src/*.md (+ generated reference pages) -> docs/manual/.
//   node tools/build-manual.mjs          build
//   node tools/build-manual.mjs --check  build to a temp dir and fail on broken links
// Sources of truth for generated pages: runtime/*/*.js (JSDoc + comments), crates/nord-editor/src/schema.rs (component fields),
// crates/nord-cli/src/main.rs (CLI), library/INDEX.json, templates/templates.json, examples/*/README.md.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { COMPONENTS, COMPONENT_ORDER } from './manual/components-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const OUT = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'nord-manual-')) : path.join(root, 'docs/manual');
const SRC = path.join(root, 'docs/manual-src');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const require = createRequire(import.meta.url);
const { marked } = require(path.join(root, 'vendor/marked/marked.umd.js'));

// ---------- markdown ------------------------------------------------------------------------------------------------------
// ::: dummies  ... :::   -> hidden-by-default plain-language box (toggle in header)
// ::: tip|warn|todo ... ::: -> callouts.   ```nord-live``` -> editable, runnable snippet.
const LIVE = [];
const BOX_TITLES = { dummies: 'For dummies', tip: 'Tip', warn: 'Careful', todo: 'TODO (planned)' };
function renderMd(md) {
  md = md.replace(/^:::\s*(dummies|tip|warn|todo)\s*\n([\s\S]*?)^:::\s*$/gm, (_, k, body) =>
    `\n<aside class="box ${k}"><div class="box-title">${BOX_TITLES[k]}</div>\n\n${body.trim()}\n\n</aside>\n`);
  const r = new marked.Renderer();
  r.heading = function ({ tokens, depth }) {
    let text = this.parser.parseInline(tokens);
    let explicit = null;
    text = text.replace(/\s*\{#([\w-]+)\}\s*$/, (_, i) => { explicit = i; return ''; });
    const id = explicit ?? slug(text.replace(/<[^>]+>/g, ''));
    return `<h${depth} id="${id}">${text}${depth > 1 ? `<a class="anchor" href="#${id}">#</a>` : ''}</h${depth}>\n`;
  };
  r.code = function ({ text, lang }) {
    if (lang === 'nord-live') { LIVE.push(text); }
    if (lang === 'nord-live') return `<div class="live"><pre class="live-src">${esc(text)}</pre></div>\n`;
    return `<pre class="code" data-lang="${esc(lang || '')}"><code>${esc(text)}</code></pre>\n`;
  };
  return marked.parse(md, { renderer: r, gfm: true });
}
function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (m) for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return [meta, m ? src.slice(m[0].length) : src];
}
const plain = (html) => html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- pages ---------------------------------------------------------------------------------------------------------
const pages = []; // { file, title, section, order, html (body), group }
const add = (p) => pages.push({ order: 50, ...p });

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.md')).sort()) {
  const [meta, body] = frontMatter(fs.readFileSync(path.join(SRC, f), 'utf8'));
  add({ file: f.replace(/^\d+-/, '').replace(/\.md$/, '.html'), title: meta.title ?? f, section: meta.section ?? 'Manual', order: Number(meta.order ?? 50), html: renderMd(body), summary: meta.summary ?? '' });
}

// ---- repo docs rendered as-is (no drift): [source file, output, title, section, order, summary, extra markdown]
const EXTERNAL = [
  ['docs/PROJECT_FORMAT.md', 'project-format.html', 'Project format', 'Reference', 5, 'nord.project.json, scenes, prefabs, components, attribute types.', 'docs/manual-src/_project-format-extra.md'],
  ['docs/DECISIONS.md', 'decisions.html', 'Design decisions', 'Appendix', 20, 'Architecture decision records.'],
  ['docs/KNOWN_ISSUES.md', 'known-issues.html', 'Known issues', 'Appendix', 21, 'Open bugs and unverified risks.'],
  ['docs/CHANGELOG.md', 'changelog.html', 'Changelog', 'Appendix', 22, 'What changed.'],
  ['docs/RUST_TIER.md', 'rust-tier-spec.html', 'Rust tier spec', 'Reference', 40, 'Detailed Rust/WASM reference.'],
  ['docs/EXPORT_TARGETS.md', 'export-targets-spec.html', 'Export targets spec', 'Reference', 41, 'Export targets and layout.'],
  ['docs/HOSTING.md', 'hosting-spec.html', 'Hosting notes', 'Reference', 42, 'Where to host a build.'],
  ['docs/DESKTOP_APPS.md', 'desktop-apps-spec.html', 'Desktop apps spec', 'Reference', 43, 'Desktop backend design, capability model, bridge.'],
  ['docs/PACKAGING.md', 'packaging.html', 'Packaging', 'Reference', 44, 'macOS/Windows/Linux bundles, signing, notarisation, file types.'],
];
for (const [src, file, title, section, order, summary, extra] of EXTERNAL) {
  let md = read(src).replace(/^# .*\n/, '');
  if (extra) md += '\n' + read(extra);
  add({ file, title, section, order, summary, html: renderMd(md) });
}

// ---- generated: component reference (schema.rs + components-data.mjs)
function parseSchema() {
  const rs = read('crates/nord-editor/src/schema.rs');
  const uiPos = rs.match(/const UI_POS: &str = "((?:[^"\\]|\\.)*)";/)[1].replace(/\\"/g, '"');
  const out = {};
  for (const m of rs.matchAll(/^\s+"(\w+)" => (?:"((?:[^"\\]|\\.)*)"|return \[dsl\("((?:[^"\\]|\\.)*)"\), dsl\(UI_POS\)\]|UI_POS)/gm)) {
    let s = m[2] ?? (m[3] != null ? `${m[3]} ${uiPos}` : uiPos);
    out[m[1]] = s.replace(/\\"/g, '"').split(/\s+/).filter(Boolean).map((tok) => {
      const [name, rest] = [tok.slice(0, tok.indexOf(':')), tok.slice(tok.indexOf(':') + 1)];
      const eq = rest.indexOf('=');
      return { name, type: eq < 0 ? rest : rest.slice(0, eq), def: eq < 0 ? '' : rest.slice(eq + 1).replace(/^"|"$/g, '') };
    });
  }
  return out;
}
const schema = parseSchema();
const TIER = { '2d': '2D', '3d': '3D', both: '2D + 3D', ui: 'UI' };
function componentPage(type) {
  const c = COMPONENTS[type];
  const fields = schema[type] ?? [];
  let h = `<p class="lead">${esc(c.summary)}</p>\n<p><span class="badge">${TIER[c.tier]}</span> <code>type: "${type}"</code></p>\n`;
  if (c.dummies) h += `<aside class="box dummies"><div class="box-title">For dummies</div><p>${esc(c.dummies)}</p></aside>\n`;
  h += `<h2 id="fields">Fields</h2>\n`;
  h += fields.length ? `<table><thead><tr><th>Field</th><th>Type</th><th>Default</th></tr></thead><tbody>${fields.map((f) => `<tr><td><code>${f.name}</code></td><td><code>${esc(f.type)}</code></td><td>${f.def ? `<code>${esc(f.def)}</code>` : '—'}</td></tr>`).join('')}</tbody></table>\n` : '<p>No fields.</p>\n';
  h += `<p class="muted">Field list comes from the editor's inspector schema. Types: see <a href="project-format.html#attribute-types">attribute types</a>.</p>\n`;
  if (c.notes?.length) h += `<h2 id="notes">Notes</h2>\n<ul>${c.notes.map((n) => `<li>${renderMd(n).replace(/^<p>|<\/p>\n?$/g, '')}</li>`).join('')}</ul>\n`;
  h += `<h2 id="json">In a scene</h2>\n<pre class="code" data-lang="json"><code>${esc(JSON.stringify(c.example, null, 2))}</code></pre>\n`;
  if (c.handle?.length || c.set?.length || c.js) {
    h += `<h2 id="script">From a script</h2>\n<p>Get the runtime component with <code>this.entity.getComponent('${type}')</code>.</p>\n`;
    if (c.handle?.length) h += `<ul>${c.handle.map((x) => `<li><code>${esc(x.split(' — ')[0])}</code>${x.includes(' — ') ? ` — ${esc(x.split(' — ').slice(1).join(' — '))}` : ''}</li>`).join('')}</ul>\n`;
    if (c.set?.length) h += `<p>Live-settable with <code>entity.set('${type}', key, value)</code>: ${c.set.map((k) => `<code>${esc(k)}</code>`).join(', ')}. Other keys are just stored.</p>\n`;
    if (c.js) h += `<pre class="code" data-lang="js"><code>${esc(c.js)}</code></pre>\n`;
  }
  return h;
}
for (const t of COMPONENT_ORDER) {
  if (!COMPONENTS[t]) throw new Error(`no components-data entry for ${t}`);
  add({ file: `component-${t}.html`, title: t, section: 'Components', order: COMPONENT_ORDER.indexOf(t), html: componentPage(t), summary: COMPONENTS[t].summary });
}
{
  const known = new Set(Object.keys(schema));
  for (const t of known) if (!COMPONENTS[t] && !t.startsWith('_')) console.warn(`[manual] schema.rs has '${t}' but components-data.mjs does not`);
  add({ file: 'components.html', title: 'Component index', section: 'Reference', order: 10, summary: 'All built-in components.',
    html: `<p class="lead">Every built-in component, grouped by where it works. Click one for fields, notes and script access.</p>` +
      ['2d', '3d', 'both', 'ui'].map((tier) => `<h2>${TIER[tier]}</h2><ul class="cards">${COMPONENT_ORDER.filter((t) => COMPONENTS[t].tier === tier).map((t) => `<li><a href="component-${t}.html"><b>${t}</b><span>${esc(COMPONENTS[t].summary)}</span></a></li>`).join('')}</ul>`).join('') });
}

// ---- generated: JS API reference from runtime sources
const API_FILES = [
  ['NordScript', 'runtime/core/script.js', 'Base class of every script.'],
  ['Entity', 'runtime/core/entity.js', 'A node in the scene tree.'],
  ['Scene', 'runtime/core/scene.js', 'The running scene: entities, lifecycle, prefabs.'],
  ['Game', 'runtime/core/game.js', 'Owns the scene and shared services (`this.game`).'],
  ['Input', 'runtime/core/input.js', 'Action-based input (`this.input`).'],
  ['Events', 'runtime/core/events.js', 'Event emitter (`this.events`, `entity.on`).'],
  ['Save', 'runtime/core/save.js', 'Versioned save slots (`this.save`).'],
  ['Audio', 'runtime/core/audio.js', 'Buses, sfx, music (`this.audio`).'],
  ['UI', 'runtime/core/ui.js', 'DOM HUD/menu layer (`this.ui`).'],
  ['Scheduler', 'runtime/core/util.js', 'Timers and tweens (`this.after/every/tween`).'],
  ['Rng', 'runtime/core/util.js', 'Seedable random numbers (`this.rng`).'],
  ['Pool', 'runtime/core/util.js', 'Object pool.'],
  ['ArcadeAdapter', 'runtime/phaser/physics.js', '2D physics (Arcade) — `this.physics` in 2D games.'],
  ['MatterAdapter', 'runtime/phaser/physics.js', '2D physics (Matter) — `this.physics` when `physics.engine` is `matter`.'],
  ['HavokAdapter', 'runtime/babylon/physics.js', '3D physics (Havok) — `this.physics` in 3D games.'],
];
function parseClass(file, name) {
  const lines = read(file).split('\n');
  const start = lines.findIndex((l) => new RegExp(`^export class ${name}\\b`).test(l) || new RegExp(`^class ${name}\\b`).test(l));
  if (start < 0) throw new Error(`class ${name} not found in ${file}`);
  const own = new RegExp(`^(?:export )?class ${name}\\b`).test(lines[start]) ? lines[start] : '';
  const ext = (own.match(/extends (\w+)/) ?? [])[1] ?? null;
  const cmt = (i) => { // comment block directly above line i
    const out = [];
    for (let j = i - 1; j >= 0; j--) {
      const l = lines[j].trim();
      if (l.startsWith('//')) out.unshift(l.replace(/^\/\/\s?/, ''));
      else if (l.endsWith('*/')) { let k = j; while (k >= 0 && !lines[k].includes('/**')) k--; for (let q = k; q <= j; q++) out.push(lines[q].replace(/^\s*\/?\*+\/?\s?|\*\/\s*$/g, '').trim()); out.reverse(); out.reverse(); break; }
      else break;
    }
    return out.filter(Boolean).join(' ').replace(/\s+/g, ' ');
  };
  const classDoc = cmt(start);
  const members = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^}/.test(lines[i])) break;
    const m = lines[i].match(/^  (static )?(async )?(get |set )?(\*?)([A-Za-z_]\w*)\(([^)]*)\)\s*\{/);
    if (!m || m[5] === 'constructor' || /^#/.test(m[5])) continue;
    const kind = m[3] ? m[3].trim() : 'method';
    const docs = cmt(i);
    members.push({ name: m[5], args: m[6].trim(), kind, static: !!m[1], async: !!m[2], gen: !!m[4], doc: docs, inline: (lines[i].match(/\/\/\s*(.+)$/) ?? [])[1] ?? '' });
  }
  const ctor = lines.slice(start, start + 12).find((l) => /^\s+constructor\(/.test(l));
  return { name, ext, classDoc, members, ctor: ctor ? ctor.trim().replace(/\s*\{$/, '') : '' };
}
const apiDocs = [];
for (const [name, file, blurb] of API_FILES) {
  const c = parseClass(file, name);
  // collapse get/set pairs into properties
  const props = new Map(), methods = [];
  for (const m of c.members) {
    if (m.kind === 'get' || m.kind === 'set') { const p = props.get(m.name) ?? { name: m.name, doc: '', rw: '' }; p.rw += m.kind === 'get' ? 'r' : 'w'; p.doc ||= m.doc || m.inline; props.set(m.name, p); }
    else methods.push(m);
  }
  let h = `<p class="lead">${renderMd(blurb).replace(/^<p>|<\/p>\n?$/g, '')}</p>\n<p class="muted">Source: <code>${file}</code>${c.ext ? ` · extends <code>${c.ext}</code>` : ''}</p>\n`;
  if (c.classDoc) h += `<p>${esc(c.classDoc)}</p>\n`;
  if (c.ctor) h += `<pre class="code" data-lang="js"><code>${esc(c.ctor)}</code></pre>\n`;
  if (props.size) h += `<h2 id="properties">Properties</h2>\n<dl class="api">${[...props.values()].map((p) => `<dt id="p-${p.name}"><code>${p.name}</code> <span class="muted">${p.rw === 'r' ? 'read-only' : p.rw === 'w' ? 'write-only' : 'read / write'}</span></dt><dd>${esc(p.doc)}</dd>`).join('')}</dl>\n`;
  if (methods.length) h += `<h2 id="methods">Methods</h2>\n<dl class="api">${methods.map((m) => `<dt id="m-${m.name}"><code>${m.static ? 'static ' : ''}${m.async ? 'async ' : ''}${m.gen ? '*' : ''}${m.name}(${esc(m.args)})</code></dt><dd>${esc(m.doc || m.inline)}</dd>`).join('')}</dl>\n`;
  apiDocs.push({ name, file, h });
  add({ file: `api-${slug(name)}.html`, title: name, section: 'API', order: apiDocs.length, html: h, summary: blurb.replace(/[`]/g, '') });
}
// free functions/objects from util.js + input.js
{
  const util = read('runtime/core/util.js');
  const fns = [...util.matchAll(/^export const (\w+) = (\([^)]*\)) =>/gm)].map((m) => `<dt><code>${m[1]}${m[2]}</code></dt><dd></dd>`).join('');
  const eases = [...(util.match(/export const ease = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s+(\w+)[:,]/gm))].map((m) => `<code>${m[1]}</code>`).join(', ');
  add({ file: 'api-helpers.html', title: 'Math & helpers', section: 'API', order: 20, summary: 'clamp, lerp, remap, vec, ease…',
    html: `<p class="lead">Small engine-agnostic helpers exported from <code>nord</code> (<code>runtime/core/util.js</code>).</p><pre class="code" data-lang="js"><code>import { clamp, lerp, remap, vec, ease } from 'nord';</code></pre><h2>Functions</h2><dl class="api">${fns}</dl><h2 id="vec"><code>vec</code></h2><p>Array-based vectors (2 or 3 components): <code>vec.add, sub, scale, len, dist, norm, lerp</code>.</p><h2 id="ease">Easing</h2><p>Names for <code>tween({ease})</code>: ${eases}. A function <code>t→t</code> also works.</p>` });
}

// ---- generated: game namespaces that are backend-specific (hand-written table kept next to the code it documents)
const NS = read('docs/manual-src/_namespaces.json');
{
  const ns = JSON.parse(NS);
  let h = '<p class="lead">Everything reachable from a script. Nord namespaces are the same for Phaser (2D) and Babylon (3D) unless marked.</p>';
  for (const g of ns) h += `<h2 id="${slug(g.name)}"><code>${esc(g.name)}</code></h2><p>${esc(g.summary)}</p><dl class="api">${g.items.map((i) => `<dt><code>${esc(i[0])}</code>${i[2] ? ` <span class="badge">${esc(i[2])}</span>` : ''}</dt><dd>${esc(i[1])}</dd>`).join('')}</dl>`;
  add({ file: 'api-namespaces.html', title: 'game.* namespaces', section: 'API', order: 0, html: h, summary: 'game.camera, game.physics, game.gui, game.ui, game.audio…' });
}

// ---- generated: CLI from clap doc comments
{
  const rs = read('crates/nord-cli/src/main.rs');
  const enumSrc = rs.slice(rs.indexOf('enum Cmd'), rs.indexOf('\n}\n', rs.indexOf('enum Cmd')));
  const lines = enumSrc.split('\n').slice(1);
  const cmds = []; let doc = [], cur = null, argDoc = [], argAttr = '';
  for (const raw of lines) {
    const l = raw.trim();
    const ind = raw.search(/\S/);
    if (ind === 4 && l.startsWith('///')) { doc.push(l.slice(3).trim()); continue; }
    if (ind === 4 && /^[A-Z]\w*/.test(l)) { cur = { name: l.match(/^(\w+)/)[1], doc: doc.join(' '), args: [] }; cmds.push(cur); doc = []; continue; }
    if (ind === 8 && l.startsWith('///')) { argDoc.push(l.slice(3).trim()); continue; }
    if (ind === 8 && l.startsWith('#[')) { argAttr += l; continue; }
    if (ind === 8 && /^\w+:/.test(l) && cur) {
      const [n, t] = l.replace(/,$/, '').split(/:\s*/);
      const def = (argAttr.match(/default_value(?:_t)? = "?([^"\)]+)"?/) ?? [])[1];
      cur.args.push({ n, t, doc: argDoc.join(' '), short: argAttr.includes('short') ? n[0] : '', long: argAttr.includes('long'), def });
      argDoc = []; argAttr = '';
    }
  }
  const kebab = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  let h = '<p class="lead">The <code>nord</code> command-line tool (<code>crates/nord-cli</code>). Run <code>nord --help</code> or <code>nord &lt;command&gt; --help</code> for the same text.</p>';
  for (const c of cmds) {
    h += `<h2 id="${kebab(c.name)}"><code>nord ${kebab(c.name)}</code></h2><p>${esc(c.doc)}</p>`;
    if (c.args.length) h += `<table><thead><tr><th>Argument</th><th>Type</th><th>Default</th><th></th></tr></thead><tbody>${c.args.map((a) => `<tr><td><code>${a.long ? `${a.short ? `-${a.short}, ` : ''}--${a.n.replace(/_/g, '-')}` : `&lt;${a.n}&gt;`}</code></td><td><code>${esc(a.t)}</code></td><td>${a.def ? `<code>${esc(a.def)}</code>` : '—'}</td><td>${esc(a.doc)}</td></tr>`).join('')}</tbody></table>`;
  }
  add({ file: 'cli.html', title: 'Command line (nord)', section: 'Reference', order: 20, html: h, summary: 'nord new/serve/build/check/bundle-mac…' });
}

// ---- generated: library catalog, examples, templates, shortcuts
{
  const idx = JSON.parse(read('library/INDEX.json'));
  const cats = new Map();
  for (const it of idx) { if (!cats.has(it.category)) cats.set(it.category, []); cats.get(it.category).push(it); }
  let h = `<p class="lead">${idx.length} ready-made scripts, prefabs, shaders and app kits in <code>library/</code>. Insert one from the editor's Library tab, or copy the file into your project.</p>`;
  for (const [cat, items] of [...cats].sort()) {
    h += `<h2 id="${slug(cat)}">${esc(cat)} <span class="muted">(${items.length})</span></h2><table><thead><tr><th>Item</th><th>Kind</th><th>Tier</th><th>What it does</th></tr></thead><tbody>${items.map((it) => `<tr><td><b>${esc(it.title)}</b><br><code>${esc(it.id)}</code></td><td>${esc(it.kind)}</td><td>${esc((it.tier ?? []).join(', '))}</td><td>${esc(it.description)}${it.attributes?.length ? `<br><span class="muted">attributes: ${it.attributes.map((a) => `<code>${esc(a)}</code>`).join(' ')}</span>` : ''}<br><span class="muted"><code>${esc(it.file)}</code></span></td></tr>`).join('')}</tbody></table>`;
  }
  add({ file: 'library-catalog.html', title: 'Library catalog', section: 'Reference', order: 30, html: h, summary: 'Every library script, prefab and kit.' });

  const tpl = JSON.parse(read('templates/templates.json'));
  const exs = fs.readdirSync(path.join(root, 'examples')).filter((d) => fs.existsSync(path.join(root, 'examples', d, 'nord.project.json')) || fs.existsSync(path.join(root, 'examples', d, 'README.md'))).sort();
  let g = `<p class="lead">Start a project from a template with <code>nord new my-game -t &lt;id&gt;</code> (or the project hub). Examples are complete games in <code>examples/</code> — open them in the editor to see how they are built.</p><h2 id="templates">Starter templates</h2><ul class="cards">${tpl.map((t) => `<li><div><b>${esc(t.title)}</b><span><code>${esc(t.id)}</code> · ${esc(t.type)} — ${esc(t.description)}</span></div></li>`).join('')}</ul><h2 id="examples">Examples</h2><ul class="cards">`;
  for (const d of exs) {
    const rp = path.join(root, 'examples', d, 'README.md');
    const first = fs.existsSync(rp) ? fs.readFileSync(rp, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))[0] ?? '' : '';
    g += `<li><div><b>${esc(d)}</b><span>${esc(first.replace(/[`*]/g, '').slice(0, 220))}</span></div></li>`;
  }
  g += '</ul>';
  add({ file: 'templates-examples.html', title: 'Templates & examples', section: 'Reference', order: 31, html: g, summary: 'Starter templates and example games.' });

  const sc = read('crates/nord-editor/src/panels/settings.rs');
  const rows = [...sc.matchAll(/\("([^"]+)", "([^"]+)"\),/g)].map((m) => `<tr><td><kbd>${esc(m[1])}</kbd></td><td>${esc(m[2])}</td></tr>`).join('');
  add({ file: 'shortcuts.html', title: 'Keyboard shortcuts', section: 'Guides', order: 5, summary: 'Editor shortcuts (macOS).',
    html: `<p class="lead">Editor shortcuts on macOS (Ctrl replaces Cmd on other platforms). Also listed in <b>Settings (Cmd+,)</b>.</p><table><thead><tr><th>Keys</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>` });
}

// ---------- layout --------------------------------------------------------------------------------------------------------
const SECTION_ORDER = ['Manual', 'Tutorials', 'Guides', 'API', 'Components', 'Reference', 'Appendix'];
pages.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.order - b.order || a.title.localeCompare(b.title));
const bySection = new Map();
for (const p of pages) { if (!bySection.has(p.section)) bySection.set(p.section, []); bySection.get(p.section).push(p); }
for (const s of bySection.keys()) if (!SECTION_ORDER.includes(s)) throw new Error(`unknown section '${s}'`);

const nav = (cur) => [...bySection].map(([s, ps]) => `<details class="nav-sec"${ps.some((p) => p === cur) || cur.file === 'index.html' ? ' open' : ''}><summary>${s}</summary>${ps.map((p) => `<a href="${p.file}"${p === cur ? ' class="cur"' : ''}>${esc(p.title)}</a>`).join('')}</details>`).join('\n');
const layout = (p, body, i) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} — Nord Engine</title>
<script>try{if(localStorage.getItem('nord.manual.dummies')==='1')document.documentElement.classList.add('dummies-on')}catch(e){}</script>
<link rel="stylesheet" href="assets/manual.css"></head>
<body><header><a class="brand" href="index.html"><img src="assets/logo.png" alt="" width="28" height="28">Nord Engine <span class="muted">Manual</span></a>
<input id="q" type="search" placeholder="Search docs…" autocomplete="off"><div id="results" hidden></div>
<button id="dummies-toggle" title="Show plain-language 'For dummies' boxes" aria-pressed="false">For dummies: <b>off</b></button></header>
<div class="layout"><nav>${nav(p)}</nav><main><div class="crumb">${esc(p.section)}</div><h1>${esc(p.title)}</h1>
${body}
<footer>Crowelian 2026 + Sonnet · <a href="https://github.com/n8n5gy4cs9-cmd/nord-engine">source</a> · generated by <code>tools/build-manual.mjs</code></footer></main></div>
<script type="module" src="assets/manual.js"></script></body></html>`;

// ---------- write ---------------------------------------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const homeCards = SECTION_ORDER.filter((s) => bySection.has(s)).map((s) => `<h2>${s}</h2><ul class="cards">${bySection.get(s).slice(0, s === 'Components' || s === 'API' ? 40 : 40).map((p) => `<li><a href="${p.file}"><b>${esc(p.title)}</b><span>${esc(p.summary ?? '')}</span></a></li>`).join('')}</ul>`).join('');
const home = { file: 'index.html', title: 'Nord Engine Manual', section: 'Manual', order: 0, summary: '' };
const homeBody = `<p class="lead">Nord is a small engine + native editor that exports static HTML games (Phaser 2D, Babylon 3D, Rust/WASM) and a Mac app. This site is the complete, offline manual: guides, tutorials, the full scripting API and every component.</p>
<aside class="box dummies"><div class="box-title">For dummies</div><p>Plain-language boxes like this one are hidden by default. Use the <b>For dummies</b> switch in the top bar to show them everywhere; the choice is remembered.</p></aside>
<p>New here? Start with <a href="welcome.html">Welcome</a>, then <a href="tut-t01-hello-nord.html">T01 Hello Nord</a>. Looking something up? Use the search box.</p>${homeCards}`;
const all = [home, ...pages];
const search = [];
for (const p of all) {
  const body = p === home ? homeBody : p.html;
  fs.writeFileSync(path.join(OUT, p.file), layout(p, body));
  if (p !== home) search.push({ f: p.file, t: p.title, s: p.section, x: plain(body).slice(0, 6000) });
}
fs.writeFileSync(path.join(OUT, 'assets/search-index.js'), `window.NORD_SEARCH=${JSON.stringify(search)};`);
fs.copyFileSync(path.join(SRC, '_manual.css'), path.join(OUT, 'assets/manual.css'));
fs.copyFileSync(path.join(SRC, '_manual.js'), path.join(OUT, 'assets/manual.js'));
fs.copyFileSync(path.join(root, 'assets/brand/logo-256.png'), path.join(OUT, 'assets/logo.png'));
fs.copyFileSync(path.join(root, 'vendor/codemirror/cm.bundle.js'), path.join(OUT, 'assets/cm.bundle.js'));
// the runnable snippets import the real core runtime
fs.cpSync(path.join(root, 'runtime/core'), path.join(OUT, 'runtime/core'), { recursive: true, filter: (s) => !s.endsWith('.test.mjs') });

// ---------- link check ------------------------------------------------------------------------------------------------------
let bad = 0;
const files = new Set(fs.readdirSync(OUT));
for (const p of all) {
  const html = fs.readFileSync(path.join(OUT, p.file), 'utf8');
  const ids = (f) => new Set([...fs.readFileSync(path.join(OUT, f), 'utf8').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="([^"#:]*)(#[^"]*)?"/g)) {
    const [, f, hash] = m;
    if (f && !files.has(f) && !f.startsWith('assets/')) { console.error(`broken link in ${p.file}: ${f}`); bad++; }
    else if (hash && hash.length > 1 && !ids(f || p.file).has(hash.slice(1))) { console.error(`broken anchor in ${p.file}: ${f}${hash}`); bad++; }
  }
  if (/https?:\/\/(?!github\.com\/n8n5gy4cs9-cmd|localhost)/.test(html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, ''))) { console.error(`external URL in ${p.file} (docs must be offline)`); bad++; }
}
if (check) { // run every nord-live snippet against the real core runtime
  const core = await import(path.join(root, 'runtime/core/index.js'));
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  for (const [i, code] of LIVE.entries()) {
    try { await new AsyncFunction('nord', 'log', code)(core, () => {}); } catch (e) { console.error(`nord-live snippet #${i + 1} failed: ${e.message}\n${code}`); bad++; }
  }
  console.log(`live snippets: ${LIVE.length} run`);
}
console.log(`manual: ${all.length} pages, ${search.length} indexed → ${check ? '(temp)' : path.relative(root, OUT)}`);
if (check) fs.rmSync(OUT, { recursive: true, force: true });
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
