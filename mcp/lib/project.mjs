// Nord project tools: guidance, files, scenes, checks, builds, dev server. All paths are jailed to the open project folder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const VEC3 = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };
const DENY = /(^|\/)(\.git|target|node_modules|\.nord-cache)(\/|$)/;

export const GUIDE_TOPICS = {
  start: ['mcp/GUIDE.md'],
  scripting: ['docs/SCRIPTING_API.md'],
  'project-format': ['docs/PROJECT_FORMAT.md'],
  modeler: ['docs/MODELER.md', 'docs/manual-src/32-modeler.md'],
  export: ['docs/EXPORT_TARGETS.md', 'docs/HOSTING.md'],
  'event-sheets': ['docs/EVENT_SHEETS.md'],
  behaviors: ['docs/BEHAVIORS.md'],
  animator: ['docs/ANIMATOR.md'],
  animation: ['docs/ANIMATION_EDITOR.md'],
  ui: ['docs/UI_SCENES.md'],
  multiplayer: ['docs/MULTIPLAYER.md'],
  'fps-creator': ['docs/FPS_CREATOR.md'],
  'level-2d': ['docs/LEVEL_CREATOR_2D.md'],
  tilemap: ['docs/TILEMAP_EDITOR.md'],
  particles: ['docs/PARTICLES.md'],
  effects: ['docs/EFFECTS.md'],
  timeline: ['docs/TIMELINE.md'],
  debugger: ['docs/DEBUGGER.md'],
  profiler: ['docs/PROFILER.md'],
  addons: ['docs/ADDONS.md'],
  localisation: ['docs/LOCALISATION.md'],
  'unity-conversion': ['docs/manual-src/ex-unity-conversion.md', 'docs/manual-src/ex-migration.md'],
  cookbook: ['docs/manual-src/cookbook.md'],
  api: ['docs/manual-src/api.md'],
  'how-nord-works': ['docs/manual-src/how-nord-works.md'],
};

export function projectTools(ctx) {
  const T = [];
  const tool = (name, description, inputSchema, handler) => T.push({ name, description, inputSchema, handler, group: 'project' });
  const engine = ctx.engineRoot;
  const rel = (p) => path.relative(ctx.projectRoot(), p).split(path.sep).join('/');
  const jail = (p, { write = false } = {}) => {
    const root = ctx.projectRoot(), abs = path.resolve(root, p);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`"${p}" is outside the project`);
    if (DENY.test(rel(abs))) throw new Error(`"${p}" is a protected folder (.git, target, node_modules, .nord-cache)`);
    if (write && /(^|\/)nord\.project\.json$/.test(rel(abs)) === false && /\.(exe|dll|dylib|so|app)$/i.test(abs)) throw new Error('Refusing to write executables');
    let real = abs; while (!fs.existsSync(real) && real !== root) real = path.dirname(real);
    if (!fs.realpathSync(real).startsWith(fs.realpathSync(root))) throw new Error(`"${p}" resolves outside the project (symlink)`);
    return abs;
  };
  const nordBin = () => {
    const c = [process.env.NORD_BIN, path.join(engine, 'target/release/nord'), path.join(engine, 'target/debug/nord')].filter(Boolean).find((f) => fs.existsSync(f));
    if (c) return c; const w = spawnSync('nord', ['--version']); if (w.status === 0) return 'nord';
    throw new Error('The `nord` CLI was not found. Build it: `cargo build -p nord-cli` in the engine folder (or set NORD_BIN).');
  };
  const run = (args, timeout = 600000) => { const r = spawnSync(nordBin(), args, { encoding: 'utf8', timeout, cwd: ctx.projectRoot() }); return `${r.stdout || ''}${r.stderr || ''}`.trim() + (r.status ? `\n(exit code ${r.status})` : ''); };
  const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
  const proj = () => { const f = path.join(ctx.projectRoot(), 'nord.project.json'); if (!fs.existsSync(f)) throw new Error(`No nord.project.json in ${ctx.projectRoot()}. Use project_new, or project_open to point at an existing project.`); return readJson(f); };
  const scenePath = (s) => jail(s || proj().startScene || 'scenes/main.scene.json');
  const walkEntities = (list, fn, parent = null) => { for (const e of list) { const r = fn(e, parent, list); if (r) return r; const c = walkEntities(e.children || [], fn, e); if (c) return c; } return null; };
  const schema = () => {
    const src = fs.readFileSync(path.join(engine, 'crates/nord-editor/src/schema.rs'), 'utf8'), i = src.indexOf('pub fn component_fields'), body = src.slice(i), out = {};
    for (const m of body.matchAll(/"(\w+)"\s*=>\s*"((?:[^"\\]|\\.)*)"/g)) out[m[1]] = m[2].replace(/\\"/g, '"');
    const types = (src.match(/COMPONENT_TYPES: \[&str; \d+\] = \[([^\]]*)\]/)?.[1] || '').match(/"(\w+)"/g)?.map((s) => s.slice(1, -1)) || [];
    return { out, types, ui: src.match(/const UI_POS: &str = "((?:[^"\\]|\\.)*)"/)?.[1].replace(/\\"/g, '"') || '' };
  };
  const newId = (taken) => { let id; do id = crypto.randomBytes(4).toString('hex'); while (taken.has(id)); taken.add(id); return id; };
  const ids = (sc) => { const s = new Set(); walkEntities(sc.entities, (e) => { s.add(e.id); }); return s; };

  tool('nord_guide', 'READ THIS FIRST. Guidance for making games with Nord Engine. No topic: the workflow guide and the topic list. With a topic: the matching engine documentation (always the current text from the engine\'s docs/). Also accepts "docs/<file>.md" or "tut-t05-physics" style names.', obj({ topic: { type: 'string', description: 'start | scripting | project-format | modeler | export | event-sheets | behaviors | animator | ui | multiplayer | cookbook | api … or a docs file' }, offset: { type: 'integer', description: 'Character offset for long documents (default 0)' } }), ({ topic = 'start', offset = 0 }) => {
    let files = GUIDE_TOPICS[topic];
    if (!files) { const c = [`docs/${topic}`, `docs/${topic}.md`, `docs/manual-src/${topic}.md`, `docs/manual-src/tut-${topic}.md`].find((f) => fs.existsSync(path.join(engine, f))); if (c) files = [c]; else { const t = fs.readdirSync(path.join(engine, 'docs/manual-src')).filter((f) => f.startsWith('tut-') && f.includes(topic.toLowerCase())); if (t.length === 1) files = ['docs/manual-src/' + t[0]]; } }
    if (!files) return `Unknown topic "${topic}". Topics: ${Object.keys(GUIDE_TOPICS).join(', ')}. Tutorials: names in docs/manual-src/tut-*.md (e.g. "t04-platformer").`;
    const text = files.map((f) => `<!-- ${f} -->\n` + fs.readFileSync(path.join(engine, f), 'utf8')).join('\n\n'), page = 24000, chunk = text.slice(offset, offset + page);
    return chunk + (text.length > offset + page ? `\n\n[… truncated: call nord_guide with offset ${offset + page} for the rest (${text.length} characters total)]` : '');
  });
  tool('project_open', 'Point the tools at a Nord project folder (it must contain nord.project.json). Returns project_info.', obj({ path: { type: 'string', description: 'Absolute path of the project folder' } }, ['path']), ({ path: p }) => { const abs = path.resolve(p); if (!fs.existsSync(path.join(abs, 'nord.project.json'))) throw new Error(`${abs} has no nord.project.json`); ctx.setProject(abs); return ctx.call('project_info', {}); });
  tool('project_new', 'Create a new project with the nord CLI from a template (html, 2d, 3d, or a starter id like platformer, endless-runner, fps-arena, card-game — see templates/) and open it.', obj({ dir: { type: 'string', description: 'Absolute folder to create' }, template: { type: 'string', description: 'Default "2d"' } }, ['dir']), ({ dir, template = '2d' }) => {
    const abs = path.resolve(dir); if (fs.existsSync(abs) && fs.readdirSync(abs).length) throw new Error(`${abs} exists and is not empty`);
    const r = spawnSync(nordBin(), ['new', abs, '-t', template], { encoding: 'utf8' }); if (r.status) throw new Error((r.stderr || r.stdout).trim()); ctx.setProject(abs); return `${r.stdout.trim()}\nOpened ${abs}.\n${ctx.call('project_info', {})}`;
  });
  tool('project_templates', 'List the starter templates available for project_new.', obj(), () => fs.readdirSync(path.join(engine, 'templates')).filter((d) => fs.existsSync(path.join(engine, 'templates', d, 'nord.project.json'))).map((d) => { const p = readJson(path.join(engine, 'templates', d, 'nord.project.json')); return `${d} (${p.type})`; }).join(', '));
  tool('project_info', 'Summary of the open project: manifest, scenes, scripts, prefabs, models, asset counts.', obj(), () => {
    const root = ctx.projectRoot(), p = proj(), list = (d, ext) => { const full = path.join(root, d); if (!fs.existsSync(full)) return []; const out = []; const w = (x) => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { if (DENY.test(e.name)) continue; const f = path.join(x, e.name); if (e.isDirectory()) w(f); else if (!ext || ext.test(e.name)) out.push(rel(f)); } }; w(full); return out; };
    const assets = list('assets'), by = {}; assets.forEach((f) => { const k = path.extname(f).slice(1) || 'none'; by[k] = (by[k] || 0) + 1; });
    return `Project "${p.name}" (${p.type}) at ${root}\nstartScene: ${p.startScene}\ndisplay: ${JSON.stringify(p.display)}\nphysics: ${JSON.stringify(p.physics)}\nscenes: ${list('scenes', /\.scene\.json$/).join(', ') || '-'}\nscripts: ${list('scripts', /\.(js|ts)$/).join(', ') || '-'}\nprefabs: ${list('prefabs', /\.prefab\.json$/).join(', ') || '-'}\nmodels: ${list('models').join(', ') || '-'}\nassets: ${assets.length} files ${JSON.stringify(by)}\nnext: nord_guide, component_schema, scene_get, scene_add_entity`;
  });
  tool('library_list', 'Search the engine\'s ready-made library (scripts, prefabs, shaders, snippets): AI, camera, UI, inventory, dialogue, a Dev Console prefab and more. Returns id, kind, title, description. Prefer these over writing the same thing again.', obj({ query: { type: 'string', description: 'Words to search (id, title, tags, description). Empty = categories.' }, limit: { type: 'integer' } }), ({ query = '', limit = 25 }) => {
    const idx = JSON.parse(fs.readFileSync(path.join(engine, 'library/INDEX.json'), 'utf8')), q = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!q.length) { const c = {}; idx.forEach((i) => { c[i.category] = (c[i.category] || 0) + 1; }); return 'Categories: ' + Object.entries(c).map(([k, v]) => `${k} (${v})`).join(', ') + '\nSearch with a query, then library_add {id}.'; }
    const hit = idx.filter((i) => q.every((w) => `${i.id} ${i.title} ${i.category} ${(i.tags || []).join(' ')} ${i.description}`.toLowerCase().includes(w))).slice(0, limit);
    return hit.map((i) => `${i.id} [${i.kind}, ${(i.tier || []).join('/')}] ${i.title}: ${i.description.slice(0, 160)}${i.attributes?.length ? ' (attributes: ' + i.attributes.join(', ') + ')' : ''}`).join('\n') || 'No match.';
  });
  tool('library_add', 'Copy a library item into the open project: scripts go to scripts/, prefabs to prefabs/ (with the scripts they need). Then attach the script with scene_add_entity / scene_update_entity (scripts), or instance the prefab with scene_add_entity {prefab:{path}}. Example: id "prefab.dev-console" adds an in-game command console.', obj({ id: { type: 'string' } }, ['id']), ({ id }) => {
    const idx = JSON.parse(fs.readFileSync(path.join(engine, 'library/INDEX.json'), 'utf8')), it = idx.find((i) => i.id === id); if (!it) throw new Error('Unknown library id ' + id + ' (library_list to search)');
    const out = [];
    for (const f of [it.file, ...(it.files || [])]) {
      if (/\.rs$/.test(f)) { out.push(`${f} is Rust: copy it by hand into src/`); continue; }
      const rel2 = f.replace(/^library\//, ''), dest = jail(rel2.startsWith('snippets/') || rel2.startsWith('apps/') || rel2.startsWith('addons/') ? 'library/' + rel2 : rel2, { write: true });
      if (fs.existsSync(dest)) { out.push(`${rel(dest)} (already there, kept)`); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(engine, f), dest); out.push(rel(dest));
    }
    return `Added: ${out.join(', ')}\n${it.kind === 'prefab' ? `Instance it: scene_add_entity {name:"${it.title}", prefab:{path:"prefabs/${path.basename(it.file)}"}}` : `Attach: scene_add_entity/scene_update_entity scripts:[{path:"scripts/${path.basename(it.file)}"}]`}`;
  });
  tool('list_files', 'List files in a project folder (recursive, max 300).', obj({ dir: { type: 'string', description: 'Default "."' }, pattern: { type: 'string', description: 'Optional substring filter' } }), ({ dir = '.', pattern }) => {
    const out = []; const w = (x) => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const f = path.join(x, e.name); if (DENY.test(rel(f))) continue; if (e.isDirectory()) w(f); else if (!pattern || rel(f).includes(pattern)) out.push(rel(f)); if (out.length >= 300) return; } }; w(jail(dir)); return out.join('\n') || '(none)';
  });
  tool('read_file', 'Read a text file of the project (max 200 KB; use offset for more).', obj({ path: { type: 'string' }, offset: { type: 'integer' } }, ['path']), ({ path: p, offset = 0 }) => { const t = fs.readFileSync(jail(p), 'utf8'); return t.slice(offset, offset + 200000) + (t.length > offset + 200000 ? `\n[… truncated at ${offset + 200000} of ${t.length}]` : ''); });
  tool('write_file', 'Create/overwrite a project file (scripts, scenes, prefabs, json, css…). Parent folders are created. Use encoding "base64" for images/audio. Scripts: see nord_guide scripting. After writing scenes/prefabs run check_project.', obj({ path: { type: 'string' }, content: { type: 'string' }, encoding: { type: 'string', enum: ['utf8', 'base64'] } }, ['path', 'content']), ({ path: p, content, encoding = 'utf8' }) => {
    const abs = jail(p, { write: true }), data = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8'); if (data.length > 8e6) throw new Error('File too large (8 MB max)');
    if (/\.json$/i.test(abs) && encoding === 'utf8') JSON.parse(content); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, data); return `Wrote ${rel(abs)} (${data.length} bytes).`;
  });
  tool('component_schema', 'Fields of the scene component types (sprite, model, camera, light, rigidbody, collider, audioSource, uiButton, spawner, netSync, …) taken from the editor\'s schema. Format: name:type=default. Without kind: all kinds.', obj({ kind: { type: 'string' } }), ({ kind }) => {
    const s = schema(), kinds = s.types.length ? s.types : Object.keys(s.out); if (kind) { if (!kinds.includes(kind)) throw new Error(`Unknown component "${kind}". Kinds: ${kinds.join(', ')}`); return `${kind}: ${s.out[kind] ?? '(see UI_POS)'}${kind.startsWith('ui') ? `\nUI position fields: ${s.ui}` : ''}`; }
    return kinds.map((k) => `${k}: ${s.out[k] ?? (k.startsWith('ui') ? s.ui : '')}`).join('\n') + `\n\nUI position fields (uiPanel/uiLabel/…): ${s.ui}\nEvery component may also have componentEnabled:false.`;
  });
  tool('scene_create', 'Create an empty scene file (format 1). Use scene_add_entity to fill it; set it as start scene with project_set_start_scene.', obj({ path: { type: 'string', description: 'e.g. "scenes/level2.scene.json"' } }, ['path']), ({ path: p }) => { const abs = jail(p, { write: true }); if (fs.existsSync(abs)) throw new Error(p + ' already exists'); fs.mkdirSync(path.dirname(abs), { recursive: true }); writeJson(abs, { format: 1, name: path.basename(p).replace(/\.scene\.json$/, ''), settings: {}, entities: [] }); return 'Created ' + p; });
  tool('project_set_start_scene', 'Set the scene the game starts with.', obj({ scene: { type: 'string' } }, ['scene']), ({ scene }) => { jail(scene); const f = path.join(ctx.projectRoot(), 'nord.project.json'), p = readJson(f); p.startScene = scene; writeJson(f, p); return 'startScene = ' + scene; });
  tool('scene_get', 'Show a scene as a compact outline (entity id, name, components, scripts, children) or one entity as full JSON (id given). scene defaults to the start scene.', obj({ scene: { type: 'string' }, id: { type: 'string' } }), ({ scene, id }) => {
    const sc = readJson(scenePath(scene)); if (id) { const e = walkEntities(sc.entities, (x) => (x.id === id ? x : null)); if (!e) throw new Error('No entity ' + id); return JSON.stringify(e, null, 2); }
    const lines = []; const w = (list, d) => list.forEach((e) => { lines.push(`${'  '.repeat(d)}${e.id} ${e.name}${e.enabled === false ? ' (off)' : ''} pos ${JSON.stringify(e.transform?.pos)} [${(e.components || []).map((c) => c.type).join(', ')}]${e.scripts?.length ? ' scripts: ' + e.scripts.map((s) => s.path).join(', ') : ''}${e.prefab ? ' prefab ' + e.prefab.path : ''}`); w(e.children || [], d + 1); }); w(sc.entities, 0);
    return `Scene "${sc.name}" settings ${JSON.stringify(sc.settings)}\n${lines.join('\n') || '(no entities)'}`;
  });
  tool('scene_add_entity', 'Add an entity to a scene. components: [{"type":"sprite","texture":"assets/x.png",…}] (see component_schema). scripts: [{"path":"scripts/player.js","attributes":{…}}]. transform: pos/rot/scale. parent: id of the parent entity. prefab: {"path":"prefabs/x.prefab.json"} to instance a prefab. 2D positions are pixels (y down); 3D positions are world units (y up). Returns the new id.', obj({ scene: { type: 'string' }, name: { type: 'string' }, pos: VEC3, rot: VEC3, scale: VEC3, components: { type: 'array', items: { type: 'object' } }, scripts: { type: 'array', items: { type: 'object' } }, tags: { type: 'array', items: { type: 'string' } }, layer: { type: 'integer' }, parent: { type: 'string' }, prefab: { type: 'object' } }, ['name']), ({ scene, name, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], components = [], scripts = [], tags = [], layer = 0, parent, prefab = null }) => {
    const f = scenePath(scene), sc = readJson(f), s = schema(), known = s.types;
    for (const c of components) { if (!c.type) throw new Error('Every component needs a "type"'); if (known.length && !known.includes(c.type)) throw new Error(`Unknown component type "${c.type}". Known: ${known.join(', ')}`); }
    const e = { id: newId(ids(sc)), name, enabled: true, tags, layer, transform: { pos, rot, scale }, components, scripts: scripts.map((x) => ({ path: x.path, attributes: x.attributes || {} })), children: [], prefab: prefab ? { path: prefab.path, overrides: prefab.overrides || {} } : null };
    if (parent) { const p = walkEntities(sc.entities, (x) => (x.id === parent ? x : null)); if (!p) throw new Error('No parent entity ' + parent); (p.children ||= []).push(e); } else sc.entities.push(e);
    writeJson(f, sc); return `Added "${name}" id ${e.id} to ${rel(f)}.`;
  });
  tool('scene_update_entity', 'Change an entity: name, enabled, tags, layer, pos/rot/scale, set_components (add or replace by type), remove_components (types), scripts (replaces the list). Unmentioned fields stay.', obj({ scene: { type: 'string' }, id: { type: 'string' }, name: { type: 'string' }, enabled: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' } }, layer: { type: 'integer' }, pos: VEC3, rot: VEC3, scale: VEC3, set_components: { type: 'array', items: { type: 'object' } }, remove_components: { type: 'array', items: { type: 'string' } }, scripts: { type: 'array', items: { type: 'object' } } }, ['id']), (a) => {
    const f = scenePath(a.scene), sc = readJson(f), e = walkEntities(sc.entities, (x) => (x.id === a.id ? x : null)); if (!e) throw new Error('No entity ' + a.id);
    for (const k of ['name', 'enabled', 'tags', 'layer']) if (a[k] !== undefined) e[k] = a[k];
    e.transform ||= { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }; for (const k of ['pos', 'rot', 'scale']) if (a[k]) e.transform[k] = a[k];
    for (const c of a.set_components || []) { const i = e.components.findIndex((x) => x.type === c.type); if (i >= 0) e.components[i] = c; else e.components.push(c); }
    if (a.remove_components) e.components = e.components.filter((c) => !a.remove_components.includes(c.type));
    if (a.scripts) e.scripts = a.scripts.map((x) => ({ path: x.path, attributes: x.attributes || {} }));
    writeJson(f, sc); return `Updated ${e.name} (${e.id}).`;
  });
  tool('scene_remove_entity', 'Remove an entity (and its children) from a scene.', obj({ scene: { type: 'string' }, id: { type: 'string' } }, ['id']), ({ scene, id }) => { const f = scenePath(scene), sc = readJson(f); const hit = walkEntities(sc.entities, (e, p, list) => { if (e.id === id) { list.splice(list.indexOf(e), 1); return e; } return null; }); if (!hit) throw new Error('No entity ' + id); writeJson(f, sc); return `Removed ${hit.name}.`; });
  tool('check_project', 'Validate the project and all scenes (ids, missing files, bad references) with `nord check`. Run after every batch of changes.', obj(), () => run(['check', ctx.projectRoot()]));
  tool('build_project', 'Build a static offline web export with `nord build` (target auto | html | web-2d | web-3d …). Output folder default dist/. Options: single_file, minify, zip, pwa, host (itch|github-pages|netlify|vercel|docker).', obj({ target: { type: 'string' }, out: { type: 'string' }, single_file: { type: 'boolean' }, minify: { type: 'boolean' }, zip: { type: 'boolean' }, pwa: { type: 'boolean' }, host: { type: 'string' } }), ({ target = 'auto', out, single_file, minify, zip, pwa, host }) => {
    const a = ['build', ctx.projectRoot(), '-t', target]; if (out) a.push('-o', jail(out, { write: true })); if (single_file) a.push('--single-file'); if (minify) a.push('--minify'); if (zip) a.push('--zip'); if (pwa) a.push('--pwa'); if (host) a.push('--host', host); return run(a);
  });
  tool('serve_start', 'Start the dev server (live reload, editor API) for the open project in the background. Open the URL in a browser to play. Returns the URL.', obj({ port: { type: 'integer', description: 'Default 4173' } }), async ({ port = 4173 }) => {
    if (ctx.server) return `Already running: http://127.0.0.1:${ctx.server.port}/`;
    const child = spawn(nordBin(), ['serve', ctx.projectRoot(), '-p', String(port)], { stdio: 'ignore', detached: false }); ctx.server = { child, port };
    child.on('exit', () => { ctx.server = null; }); await new Promise((r) => setTimeout(r, 1500)); return ctx.server ? `Serving http://127.0.0.1:${port}/ (stop with serve_stop)` : 'The dev server exited immediately (is the port in use?)';
  });
  tool('serve_stop', 'Stop the dev server started by serve_start.', obj(), () => { if (!ctx.server) return 'Not running.'; ctx.server.child.kill(); ctx.server = null; return 'Stopped.'; });
  return T;
}
