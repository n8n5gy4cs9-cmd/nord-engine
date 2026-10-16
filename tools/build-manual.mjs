#!/usr/bin/env node
// Builds the offline HTML manual: docs/manual-src/*.md (+ generated reference pages) -> docs/manual/.
//   node tools/build-manual.mjs          build
//   node tools/build-manual.mjs --check  build to a temp dir and fail on broken links
// Sources of truth for generated pages: runtime/*/*.js (JSDoc + comments), crates/nord-editor/src/schema.rs (component fields),
// crates/nord-cli/src/main.rs (CLI), library/INDEX.json, templates/templates.json, examples/*/README.md.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { API_HELP } from './manual/api-help.mjs';
import { engineDocs } from './manual/engine-docs.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { COMPONENTS, COMPONENT_ORDER } from './manual/components-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const OUT = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'nord-manual-')) : path.join(root, 'docs/manual');
const SRC = path.join(root, 'docs/manual-src');
const MANIFEST = '.manual-manifest.json';
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- incremental output -------------------------------------------------------------------------------------------
// The manual is committed and commonly synchronized over FTP. Preserve unchanged files and their mtimes so a one-page
// documentation edit uploads as one page, rather than making every generated file look new.
let changed = 0, unchanged = 0, removed = 0;
const expected = new Set();
const sameBytes = (file, bytes) => fs.existsSync(file) && fs.readFileSync(file).equals(bytes);
function emit(file, contents) {
  const rel = file.split(path.sep).join('/');
  const dest = path.join(OUT, rel);
  const normalized = typeof contents === 'string' && rel.endsWith('.html')
    ? contents.replace(/\r\n/g, '\n').replace(/ +\t/g, '\t').replace(/[ \t]+$/gm, '')
    : contents;
  const bytes = Buffer.isBuffer(normalized) ? normalized : Buffer.from(normalized);
  expected.add(rel);
  if (sameBytes(dest, bytes)) { unchanged++; return; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const temp = `${dest}.tmp-${process.pid}`;
  fs.writeFileSync(temp, bytes);
  fs.renameSync(temp, dest);
  changed++;
}
function copy(source, target) { emit(target, fs.readFileSync(source)); }
function copyTree(source, target, filter = () => true) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name), rel = path.posix.join(target, entry.name);
    if (!filter(src)) continue;
    if (entry.isDirectory()) copyTree(src, rel, filter);
    else if (entry.isFile()) copy(src, rel);
  }
}
function existingFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...existingFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

const require = createRequire(import.meta.url);
const { marked } = require(path.join(root, 'vendor/marked/marked.umd.js'));

// ---------- markdown ------------------------------------------------------------------------------------------------------
// ::: dummies  ... :::   -> hidden-by-default plain-language box (toggle in header)
// ::: tip|warn|todo ... ::: -> callouts.   ```nord-live``` -> editable, runnable snippet.
const LIVE = [];
const BOX_TITLES = { dummies: 'For dummy developers', tip: 'Tip', warn: 'Careful', todo: 'TODO (planned)' };
function renderMd(md, options = {}) {
  // Tutorials embed the exact shipped files so a reader can reconstruct the project.
  md = md.replace(/^::: example-code ((?:examples\/(?:notepaint|star-not|shader-terrain)\/|tools\/gen_star_not_audio\.mjs)[\w./-]*) ([\w-]+)\s*$/gm, (_, file, lang) => {
    if (file.split('/').includes('..')) throw new Error('Unsafe tutorial source path');
    return `<pre class="code" data-lang="${esc(lang)}"><code>${esc(read(file))}</code></pre>`;
  });
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
  if (options.upstream) {
    r.html = ({ text }) => text.startsWith('<!--') ? '' : `<span class="muted">${esc(text.replace(/<Playground[^>]*>/g, 'Online playground (not embedded offline)'))}</span>`;
    r.image = ({ text }) => `<p class="muted">Upstream illustration: ${esc(text || 'image')} (media not bundled).</p>`;
    r.link = function ({ href, tokens }) { const target = options.resolve?.(href); const label = this.parser.parseInline(tokens); return target ? `<a href="${esc(target)}">${label}</a>` : `<span>${label}</span>`; };
  }
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

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.md') && !x.startsWith('_')).sort()) {
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
  ['docs/PACKAGING.md', 'packaging.html', 'Packaging', 'Reference', 44, 'macOS/Windows/Linux bundles, signing, notarisation, file types.', 'docs/BUILD_WINDOWS.md'],
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
  ['Pool', 'runtime/core/util.js', 'Reuse objects instead of allocating a new one each time.'],
  ['Loader', 'runtime/core/loader.js', 'Load project files safely, with caching and progress reporting.'],
  ['MemoryStorage', 'runtime/core/save.js', 'In-memory storage for Save when browser storage is unavailable or for isolated runs.'],
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
    if (!m || m[5] === 'constructor' || /^[_#]/.test(m[5])) continue;
    const kind = m[3] ? m[3].trim() : 'method';
    const docs = cmt(i) || API_HELP[name]?.[m[5]] || '';
    members.push({ name: m[5], args: m[6].trim(), kind, static: !!m[1], async: !!m[2], gen: !!m[4], doc: docs, implementation: lines.slice(i, (() => { let end = i + 1; while (end < lines.length && !/^  (?:(?:static|async|get|set) )*\w+\([^)]*\)\s*\{|^}/.test(lines[end])) end++; return end; })()).join('\n').trim(), inline: (lines[i].match(/\/\/\s*(.+)$/) ?? [])[1] ?? '' });
  }
  const ctor = lines.slice(start, start + 12).find((l) => /^\s+constructor\(/.test(l));
  const ctorStart = lines.findIndex((l, i) => i > start && /^  constructor\(/.test(l));
  let ctorEnd = ctorStart + 1; while (ctorEnd < lines.length && !/^  (?:(?:get|set|async|static) )*\w+\(/.test(lines[ctorEnd]) && !/^}/.test(lines[ctorEnd])) ctorEnd++;
  const fields = ctorStart < 0 ? [] : [...new Set([...lines.slice(ctorStart, ctorEnd).join('\n').matchAll(/this\.([a-zA-Z]\w*)\s*=/g)].map(m => m[1]).filter(n => !n.startsWith('_')))];
  if (ext === 'Base') { const base = parseClass(file, 'Base'); const own = new Set(members.map(m => m.name)); members.push(...base.members.filter(m => !own.has(m.name)).map(m => ({ ...m, inherited: true }))); }
  return { name, ext, classDoc, members, fields, ctor: ctor ? ctor.trim().replace(/\s*\{$/, '') : '' };
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
  if (name === 'NordScript') h += `<aside class="box dummies"><div class="box-title">For dummy developers</div><p>Attach your script to an entity. Use <code>start()</code> for setup and <code>update(dt)</code> for ongoing changes. The engine supplies the shortcuts below.</p></aside><p><a href="developer-basics.html">Read your first script</a> · <a href="scripting.html#lifecycle">All lifecycle hooks and their arguments</a></p>`;
  if (c.classDoc) h += `<p>${esc(c.classDoc)}</p>\n`;
  if (c.ctor) h += `<pre class="code" data-lang="js"><code>${esc(c.ctor)}</code></pre>\n`;
  const fieldHelp = { entity: 'The entity this script belongs to.', attrs: 'Script attributes after resolving defaults and scene overrides.', id: 'The entity’s unique ID.', name: 'The entity or scene name.', tags: 'Text labels used by findByTag().', children: 'Child entities in the scene tree.', parent: 'Parent entity, or null at the root.', native: 'The underlying engine object; see Escape hatch.', components: 'Runtime component handles attached to this entity.', scripts: 'Attached script instances.', scene: 'The containing or current scene.', project: 'Parsed project settings.', backend: 'The current rendering adapter.', events: 'An event bus for messages.', input: 'Input state and named actions.', save: 'Versioned save slots.', rng: 'Seeded random numbers.', time: 'Frame duration and elapsed time in seconds.', timeScale: 'Multiplier for game time; 0.5 is half speed.', paused: 'Whether the game update loop is paused.', errors: 'Errors caught from scripts.', scheduler: 'The scene’s timers and tweens.' };
  if (c.fields.length) h += `<h2 id="instance-fields">Instance fields</h2><table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>${c.fields.filter(f => !props.has(f)).map(f => `<tr><td><code>${f}</code></td><td>${fieldHelp[f] ?? `Created by the constructor in ${file}.`}</td></tr>`).join('')}</tbody></table>`;
  if (props.size) h += `<h2 id="properties">Properties</h2>\n<dl class="api">${[...props.values()].map((p) => `<dt id="p-${p.name}"><code>${p.name}</code> <span class="muted">${p.rw === 'r' ? 'read-only' : p.rw === 'w' ? 'write-only' : 'read / write'}</span></dt><dd>${esc(p.doc)}</dd>`).join('')}</dl>\n`;
  if (methods.length) h += `<h2 id="methods">Methods</h2>\n<dl class="api">${methods.map((m) => `<dt id="m-${m.name}"><a class="member-link" href="#m-${m.name}" aria-label="Link to ${m.name}">#</a><code>${m.static ? 'static ' : ''}${m.async ? 'async ' : ''}${m.gen ? '*' : ''}${m.name}(${esc(m.args)})</code></dt><dd>${m.inherited ? '<p>Inherited from the shared 2D physics adapter.</p>' : ''}${m.doc || m.inline ? esc(m.doc || m.inline) : `<details><summary>How this method works</summary><pre class="code" data-lang="js"><code>${esc(m.implementation)}</code></pre></details>`}</dd>`).join('')}</dl>\n`;
  apiDocs.push({ name, file, h });
  add({ file: `api-${slug(name)}.html`, title: name, section: 'API', order: apiDocs.length, html: h, summary: blurb.replace(/[`]/g, '') });
}
// free functions/objects from util.js + input.js
{
  const util = read('runtime/core/util.js');
  const helperNotes = { clamp: 'Keep v between a and b. Returns the nearest boundary when v is outside the range.', lerp: 'Blend from a toward b: t=0 gives a, t=1 gives b. Values outside 0–1 extrapolate.', remap: 'Convert v from input range a–b to output range c–d. Do not use an input range with equal endpoints.', deg2rad: 'Convert an angle in degrees to radians.', rad2deg: 'Convert an angle in radians to degrees.', angleDiff: 'Return the shortest signed turn from a to b, in degrees.' };
  const fns = [...util.matchAll(/^export const (\w+) = (\([^)]*\)) =>/gm)].map((m) => `<dt><code>${m[1]}${m[2]}</code></dt><dd>${helperNotes[m[1]] ?? ''}</dd>`).join('');
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

// ---- complete public core exports, desktop bridge and Rust contracts
{
  const index = read('runtime/core/index.js');
  const entries = [...index.matchAll(/export \{ ([^}]+) \} from '([^']+)'/g)].flatMap(m => m[1].split(',').map(name => ({ name: name.trim(), file: 'runtime/core/' + m[2].replace('./', '') })));
  const classNames = new Set(API_FILES.map(([name]) => name));
  let h = '<p class="lead">Every named export from <code>nord</code>. Classes link to their member reference; helper contracts and implementations appear below.</p><table><thead><tr><th>Import</th><th>Source</th></tr></thead><tbody>';
  for (const e of entries) h += `<tr><td><a href="${classNames.has(e.name) ? 'api-' + slug(e.name) + '.html' : '#export-' + slug(e.name)}"><code>${esc(e.name)}</code></a></td><td><code>${esc(e.file)}</code></td></tr>`;
  h += '</tbody></table>';
  for (const e of entries.filter(e => !classNames.has(e.name))) {
    const source = read(e.file), lines = source.split('\n'), start = lines.findIndex(l => new RegExp(`^export (?:async )?(?:function|const) ${e.name}\\b`).test(l));
    let snippet = '', comment = '';
    if (start >= 0) {
      let end = start + 1;
      if (!lines[start].endsWith(';') && !lines[start].trimEnd().endsWith('}')) while (end < lines.length && !/^}\s*;?$/.test(lines[end]) && !/^export /.test(lines[end])) end++;
      if (/^}/.test(lines[end] ?? '')) end++;
      snippet = lines.slice(start, end).join('\n');
      let c = start - 1; while (c >= 0 && (/^\s*\*/.test(lines[c]) || /^\s*\/\//.test(lines[c]) || /^\s*\/\*\*/.test(lines[c]))) c--;
      comment = lines.slice(c + 1, start).join('\n').replace(/\/\*\*|\*\//g, '').replace(/^\s*(?:\*|\/\/) ?/gm, '').trim();
    }
    h += `<h2 id="export-${slug(e.name)}"><code>${esc(e.name)}</code></h2>${comment ? renderMd(comment) : ''}<p class="muted">Import from <code>nord</code>. Definition from <code>${esc(e.file)}</code>; names and defaults below are taken directly from the runtime.</p>${snippet ? `<pre class="code" data-lang="js"><code>${esc(snippet)}</code></pre>` : '<p>Exported value; see the source module.</p>'}`;
  }
  add({ file: 'api-exports.html', title: 'All Nord public exports', section: 'API', order: 25, html: h, summary: entries.map(e => e.name).join(', ') });
  const desktop = read('runtime/desktop/nord-desktop.d.ts');
  let dh = '<p class="lead">The complete typed contract of <code>window.nord.desktop</code>: files, dialogs, notifications, storage, windows and more.</p><p>Methods return Promises unless their declaration says otherwise. Permissions and native availability vary by capability and platform. <a href="desktop-apps.html">Start with the desktop guide</a>.</p><aside class="box dummies"><div class="box-title">For dummy developers</div><p>Use <code>await</code> to wait for a file or dialog. A cancelled picker can return <code>null</code>; check it before reading. Desktop permissions belong in your project settings.</p></aside>';
  for (const line of desktop.split('\n').filter(l => l.startsWith('  ') && !l.trim().startsWith('/**') && l.includes(':'))) {
    const name = line.trim().match(/^(?:readonly )?(\w+)/)?.[1];
    if (name) dh += `<h2 id="desktop-${slug(name)}">${esc(name)}</h2><pre class="code" data-lang="ts"><code>${esc(line.trim())}</code></pre>`;
  }
  dh += `<h2 id="complete-types">Complete bridge and supporting types</h2><pre class="code" data-lang="ts"><code>${esc(desktop)}</code></pre>`;
  add({ file: 'api-desktop.html', title: 'Desktop bridge', section: 'API', order: 26, html: dh, summary: 'window.nord.desktop: fs dialog app store secret clipboard notify window menu tray shortcut shell process server http' });
  let rh = '<p class="lead">Public declarations from Nord’s Rust game and app crates. This is a source reference; the JavaScript API does not apply to Rust projects.</p><p><a href="rust-wasm.html">Rust getting started</a> · <a href="rust-tier-spec.html">Supported behavior and export requirements</a></p>';
  for (const crate of ['nord-runtime-wasm', 'nord-app-wasm']) {
    const dir = path.join(root, 'crates', crate, 'src');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.rs')).sort()) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8'), publicLines = source.split('\n').filter(l => /^\s*pub /.test(l));
      rh += `<h2 id="${slug(crate + '-' + file)}">${crate} / ${esc(file)}</h2><pre class="code" data-lang="rust"><code>${esc(publicLines.join('\n'))}</code></pre><details><summary>Full module with comments and implementation</summary><pre class="code" data-lang="rust"><code>${esc(source)}</code></pre></details>`;
    }
  }
  add({ file: 'api-rust.html', title: 'Rust public API', section: 'API', order: 27, html: rh, summary: 'Script Ctx World Registry Input assets physics App desktop Rust declarations' });
}
engineDocs({ root, add, renderMd, esc, slug });

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
const SECTION_ORDER = ['Start here', 'Manual', 'Tutorials', 'Guides', 'API', 'Components', 'Reference', 'Appendix', 'Engine docs'];
const SECTION_DIR = {
  'Start here': 'nord/start', Manual: 'nord/manual', Tutorials: 'nord/tutorials', Guides: 'nord/guides',
  API: 'nord/api', Components: 'nord/components', Reference: 'nord/reference', Appendix: 'nord/appendix',
};
for (const p of pages) {
  p.legacyFile = p.file;
  p.file = p.outputFile ?? path.posix.join(SECTION_DIR[p.section] ?? 'nord/reference', p.file);
}
pages.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.order - b.order || a.title.localeCompare(b.title));
const bySection = new Map();
for (const p of pages) { if (!bySection.has(p.section)) bySection.set(p.section, []); bySection.get(p.section).push(p); }
for (const s of bySection.keys()) if (!SECTION_ORDER.includes(s)) throw new Error(`unknown section '${s}'`);
const area = p => ['API', 'Components', 'Reference', 'Engine docs'].includes(p.section) ? 'API' : p.section === 'Appendix' ? 'Guides' : p.section;
const tabs = [['Start here', 'getting-started.html'], ['Manual', 'welcome.html'], ['Tutorials', 'tutorials.html'], ['Guides', 'cookbook.html'], ['API', 'api.html']];
const nav = cur => {
  const sections = [...bySection].filter(([s]) => area({ section: s }) === area(cur));
  return `<a class="nav-home" href="index.html">Documentation home</a><div class="nav-label">${esc(area(cur))}</div>` + sections.map(([s, ps]) => {
    if (s === 'Engine docs') return '<a href="engine-docs.html">Phaser & Babylon documentation</a>';
    const links = ps.map(p => `<a href="${p.file}"${p === cur ? ' class="cur" aria-current="page"' : ''}>${esc(p.title)}</a>`).join('');
    return sections.length > 1 ? `<details${s === cur.section ? ' open' : ''}><summary>${esc(s)}</summary>${links}</details>` : links;
  }).join('');
};
const layout = (p, body) => {
  const headings = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(m => [m[1], plain(m[2]).replace(/#$/, '')]);
  const siblings = bySection.get(p.section) ?? [], pos = siblings.indexOf(p);
  const pager = p.file === 'index.html' || p.section === 'Engine docs' ? '' : `<div class="pager">${[siblings[pos - 1], siblings[pos + 1]].map((n, i) => n ? `<a href="${n.file}"><small>${i ? 'Next →' : '← Previous'}</small>${esc(n.title)}</a>` : '<span></span>').join('')}</div>`;
  const manualRoot = path.posix.relative(path.posix.dirname(p.file), '.') || '.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${esc(p.title)} — Nord Engine Docs</title>
<script>window.NORD_MANUAL_ROOT=${JSON.stringify(manualRoot + '/')};try{if(localStorage.getItem('nord.manual.dummies')!=='0')document.documentElement.classList.add('dummies-on');document.documentElement.dataset.theme=localStorage.getItem('nord.manual.theme')||'dark'}catch(e){document.documentElement.classList.add('dummies-on')}</script>
<link rel="stylesheet" href="assets/manual.css"></head>
<body><a class="skip" href="#content">Skip to content</a><header><div class="topbar"><a class="brand" href="index.html"><img src="assets/logo.png" alt="">Nord Engine <span>DOCUMENTATION</span></a>
<div class="search-wrap"><input id="q" type="search" aria-label="Search all documentation" placeholder="Search the docs…  /" autocomplete="off"><div id="results" hidden aria-live="polite"></div></div>
<button id="dummies-toggle" aria-pressed="true">For dummies: <b>on</b></button><button id="theme-toggle">Light mode</button><button id="nav-toggle" aria-controls="sidebar" aria-expanded="false">Menu</button></div>
<nav class="section-tabs" aria-label="Documentation sections">${tabs.map(([name, href]) => `<a href="${href}"${area(p) === name ? ' class="active" aria-current="page"' : ''}>${name}</a>`).join('')}</nav></header>
<div class="layout"><nav id="sidebar" class="sidebar" aria-label="Section navigation">${nav(p)}</nav><main id="content"><div class="crumb">${esc(p.section)} / Nord Engine</div><h1>${esc(p.title)}</h1>
${body}${pager}<footer>Crowelian 2026 + Sonnet · Nord Engine documentation · Works offline</footer></main><aside class="on-this-page" aria-label="On this page"><b>On this page</b>${headings.map(([id, title]) => `<a href="#${id}">${esc(title)}</a>`).join('')}</aside></div>
<script src="assets/cm.classic.js"></script><script src="assets/manual.js"></script></body></html>`;
};

const outputByLegacy = new Map([['index.html', 'index.html'], ...pages.map(p => [p.legacyFile, p.file])]);
const outputFiles = new Set(outputByLegacy.values());
function localLinks(html, currentFile) {
  const currentDir = path.posix.dirname(currentFile);
  return html.replace(/\b(href|src)="([^"]+)"/g, (whole, attr, url) => {
    if (!url || url.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(url)) return whole;
    const match = url.match(/^([^?#]+)([?#].*)?$/);
    if (!match) return whole;
    const [, original, suffix = ''] = match;
    const target = outputByLegacy.get(original) ?? (outputFiles.has(original) || /^(?:assets|runtime)\//.test(original) ? original : null);
    if (!target) return whole;
    const relative = path.posix.relative(currentDir, target) || path.posix.basename(target);
    return `${attr}="${relative}${suffix}"`;
  });
}

// ---------- write ---------------------------------------------------------------------------------------------------------
const home = { file: 'index.html', title: 'Make something worth playing.', section: 'Start here', order: 0, summary: '' };
const homeBody = `<div class="hero"><div class="eyebrow">Your idea. Your game. Your engine.</div><h2>A little engine.<br>A lot to explore.</h2><p class="lead">Build 2D games, 3D worlds and desktop apps. Learn one step at a time, then keep the reference nearby.</p><a class="button-link" href="getting-started.html">Start building →</a><a class="button-link secondary" href="api.html">Browse the API</a></div>
<ul class="cards"><li><a href="getting-started.html"><div class="path-step">01 · NEW TO NORD?</div><b>Get your first win</b><span>Open a project, press Play, change something. No programming experience needed.</span></a></li><li><a href="how-nord-works.html"><div class="path-step">02 · UNDERSTAND THE PIECES</div><b>How Nord works</b><span>Entities, scripts, Phaser, Babylon, WebGL and WASM in plain English.</span></a></li><li><a href="tutorials.html"><div class="path-step">03 · LEARN BY DOING</div><b>Build along with a tutorial</b><span>Small lessons with a goal, working code and a next step.</span></a></li><li><a href="api.html"><div class="path-step">04 · FIND AN ANSWER</div><b>Keep the reference handy</b><span>Nord classes and components, desktop APIs and the underlying engines.</span></a></li></ul>
<h2 id="made-with-nord">Made with Nord</h2><p>These are real bundled examples. Open them in the editor to explore their scenes and scripts.</p><div class="shot-grid"><figure class="shot"><img src="assets/screenshots/vallout-03-classic-explore.png" alt="Vallout isometric streets and green game interface" loading="lazy"><figcaption><b>Vallout 2: New Kerava</b> · An isometric RPG. Scenes, dialogue and turn-based rules working together.</figcaption></figure><figure class="shot"><img src="assets/screenshots/automies-2-drive.png" alt="Automies car driving through a 3D city" loading="lazy"><figcaption><b>Automies</b> · A 3D driving game. Babylon renders the world; Nord scripts control the car.</figcaption></figure></div>
<aside class="box tip"><div class="box-title">A little help, whenever you need it</div><p>Beginner explanations are visible by default. The <b>For dummies</b> button hides or shows the purple boxes. Search works offline; press <kbd>/</kbd> to jump to it.</p></aside>`;
const all = [home, ...pages];
if (new Set(all.map(p => p.file)).size !== all.length) throw new Error('Duplicate manual output filenames: ' + [...new Set(all.filter((p,i)=>all.findIndex(q=>q.file===p.file)!==i).map(p=>p.file))].join(', '));
fs.mkdirSync(OUT, { recursive: true });
const oldManifest = path.join(OUT, MANIFEST);
const previous = new Set(fs.existsSync(oldManifest) ? JSON.parse(fs.readFileSync(oldManifest, 'utf8')) : existingFiles(OUT));
for (const file of ['robots.txt', '_headers', '.htaccess', 'HOSTING.txt']) copy(path.join(root, 'tools/manual/hosting', file), file);
const searchGroups = new Map([['nord', []], ['phaser', []], ['phaser-archive', []], ['babylon', []], ['babylon-guides', []]]);
const searchGroup = p => p.file.startsWith('engines/phaser/4.2/') ? 'phaser'
  : p.file.startsWith('engines/phaser/4.1-archive/') ? 'phaser-archive'
    : p.file.startsWith('engines/babylon/9.30/') ? 'babylon'
      : p.file.startsWith('engines/babylon/guides/') ? 'babylon-guides' : 'nord';
let searchCount = 0;
for (const p of all) {
  const body = p === home ? homeBody : p.html;
  emit(p.file, localLinks(layout(p, body), p.file));
  if (p !== home) {
    const search = searchGroups.get(searchGroup(p));
    search.push({ f: p.file, t: p.title, s: p.section, x: plain(body).slice(0, 6000) });
    for (const m of p.searchMembers ?? []) search.push({ f: p.file + '#' + m.id, t: p.title + '.' + m.name, s: p.section, x: m.text.slice(0, 1200) });
    searchCount += 1 + (p.searchMembers?.length ?? 0);
  }
}
const searchFiles = [];
for (const [name, search] of searchGroups) {
  const file = `assets/search/${name}.js`;
  searchFiles.push(file);
  emit(file, `window.NORD_SEARCH_PARTS=window.NORD_SEARCH_PARTS||{};window.NORD_SEARCH_PARTS[${JSON.stringify(name)}]=${JSON.stringify(search)};`);
}
emit('assets/search-manifest.js', `window.NORD_SEARCH_FILES=${JSON.stringify(searchFiles)};`);
copy(path.join(SRC, '_manual.css'), 'assets/manual.css');
copy(path.join(SRC, '_manual.js'), 'assets/manual.js');
copy(path.join(root, 'assets/brand/logo-256.png'), 'assets/logo.png');
copy(path.join(root, 'assets/docs/editor-layout.svg'), 'assets/editor-layout.svg');
copy(path.join(root, 'vendor/codemirror/cm.bundle.js'), 'assets/cm.bundle.js');
for (const [source, name] of [['inter/inter-latin-400-normal.woff2', 'inter.woff2'], ['plus-jakarta-sans/plus-jakarta-sans-latin-700-normal.woff2', 'jakarta.woff2'], ['jetbrains-mono/jetbrains-mono-latin-400-normal.woff2', 'mono.woff2']]) copy(path.join(root, 'vendor/fonts', source), `assets/${name}`);
copyTree(path.join(root, 'vendor/engine-docs'), 'assets/engine-docs');
for (const file of ['vallout-03-classic-explore.png', 'automies-2-drive.png', 'xkom-tactical.png', 'manual-hello-nord.png']) copy(path.join(root, 'docs/screenshots', file), `assets/screenshots/${file}`);
for (const [source, name] of [['notepaint/assets/ui/tools.png', 'notepaint-tools.png'], ['star-not/assets/sprites/space.png', 'star-not-space.png'], ['star-not/assets/ui/portraits.png', 'star-not-ui.png']]) copy(path.join(root, 'examples', source), `assets/tutorials/${name}`);
// The vendored bundle is standalone ESM. Expose its exact exports as a classic-script global
// so syntax highlighting also works when the user double-clicks the offline HTML file.
const cmSource = read('vendor/codemirror/cm.bundle.js');
const cmExports = cmSource.match(/export\{([^}]+)\};?\s*$/);
if (!cmExports) throw new Error('CodeMirror bundle export shape changed');
const cmObject = cmExports[1].split(',').map(s => { const [local, name = local] = s.trim().split(/\s+as\s+/); return `${name}:${local}`; }).join(',');
emit('assets/cm.classic.js', `(()=>{${cmSource.slice(0, cmExports.index)};window.NORD_CM={${cmObject}};})();`);
// the runnable snippets import the real core runtime
copyTree(path.join(root, 'runtime/core'), 'runtime/core', s => !s.endsWith('.test.mjs'));

expected.add(MANIFEST);
emit(MANIFEST, JSON.stringify([...expected].sort(), null, 2) + '\n');
for (const stale of previous) {
  if (expected.has(stale) || stale === '.DS_Store') continue;
  const target = path.join(OUT, stale);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) { fs.unlinkSync(target); removed++; }
}
const removeEmptyDirs = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  if (dir !== OUT && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
};
removeEmptyDirs(OUT);

// ---------- link check ------------------------------------------------------------------------------------------------------
let bad = 0;
const files = new Set(expected);
const idCache = new Map();
const ids = f => { if (!idCache.has(f)) idCache.set(f, new Set([...fs.readFileSync(path.join(OUT, f), 'utf8').matchAll(/ id="([^"]+)"/g)].map(m => m[1]))); return idCache.get(f); };
for (const p of all) {
  const html = fs.readFileSync(path.join(OUT, p.file), 'utf8');
  for (const m of html.matchAll(/href="([^"#:]*)(#[^"]*)?"/g)) {
    const [, f, hash] = m;
    const target = f ? path.posix.normalize(path.posix.join(path.posix.dirname(p.file), f)) : p.file;
    if (f && !files.has(target)) { console.error(`broken link in ${p.file}: ${f}`); bad++; }
    else if (hash && hash.length > 1 && target.endsWith('.html') && !ids(target).has(hash.slice(1))) { console.error(`broken anchor in ${p.file}: ${f}${hash}`); bad++; }
  }
  if (p.section !== 'Engine docs' && /https?:\/\/(?!github\.com\/n8n5gy4cs9-cmd|localhost)/.test(html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, ''))) { console.error(`external URL in ${p.file} (docs must be offline)`); bad++; }
}
if (check) { // run every nord-live snippet against the real core runtime
  const core = await import(path.join(root, 'runtime/core/index.js'));
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  for (const [i, code] of LIVE.entries()) {
    try { await new AsyncFunction('nord', 'log', code)(core, () => {}); } catch (e) { console.error(`nord-live snippet #${i + 1} failed: ${e.message}\n${code}`); bad++; }
  }
  console.log(`live snippets: ${LIVE.length} run`);
}
console.log(`manual: ${all.length} pages, ${searchCount} indexed; ${changed} changed, ${unchanged} unchanged, ${removed} removed → ${check ? '(temp)' : path.relative(root, OUT)}`);
if (check) fs.rmSync(OUT, { recursive: true, force: true });
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
