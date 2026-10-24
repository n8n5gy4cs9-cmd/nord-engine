// @nord {"id":"dev.console","title":"In-game command console (dev cheats)","category":"utilities","tier":["2d","3d"],"tags":["console","cheats","debug","commands","dev"],"description":"Drop the Dev Console prefab into a scene: press the key left of 1 (§ / `) to open a command console with autocomplete, history, help, entity tools and your own commands. Add commands with command('name', fn, {description, params}) from any script.","requires":[]}
// Nord Dev Console: in-game command line. Prefab: library "Dev Console" -> drag `prefabs/dev-console.prefab.json` into the Hierarchy.
//
//   import { command } from './dev-console.js';
//   command('heal', (amount = 10) => { player.hp += amount; return `hp ${player.hp}`; }, { description: 'Heal the player', params: 'amount:number=10' });
//
// params: a string like 'amount:number=10 target:entity mode:enum(fast|slow)=fast' or an array of { name, type, default, options }.
// types: number int bool string rest vec3 entity enum(a|b). Return a value to print it; return a Promise (async) or a generator
// (interactive: `const name = yield 'Your name?'` pauses for the next line you type).
import { NordScript } from 'nord';

const registry = new Map(); // name -> [command, ...] (overloads by argument count)
const aliases = new Map();
const macros = new Map();
let current = null; // the live console script
const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

/** Parse 'a:number=1 b:enum(x|y)' into param specs. */
function parseParams(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p.map((x) => ({ type: 'string', ...x }));
  return String(p).split(/\s+/).filter(Boolean).map((tok) => {
    const m = /^([\w-]+)(?::([\w]+)(?:\(([^)]*)\))?)?(?:=(.*))?$/.exec(tok) || [];
    const type = m[2] || 'string';
    const spec = { name: m[1] || tok, type, options: m[3] ? m[3].split('|') : undefined };
    if (m[4] !== undefined) spec.default = type === 'number' || type === 'int' ? Number(m[4]) : type === 'bool' ? m[4] === 'true' : m[4];
    return spec;
  });
}

/** Register a command (also callable at runtime, e.g. from a lambda). Same name again = an overload with another parameter list. */
export function command(name, run, { description = '', params = '', aliases: al = [], platform = 'all', hidden = false } = {}) {
  const cmd = { name, run, description, params: parseParams(params), platform, hidden };
  const list = registry.get(name) ?? [];
  registry.set(name, [...list.filter((c) => c.params.length !== cmd.params.length), cmd]);
  for (const a of al) aliases.set(a, name);
  return cmd;
}
/** Remove a command. */
export function removeCommand(name) { registry.delete(name); }
/** Expose a getter/setter as `name` (prints the value) and `name <value>` (sets it): `bindVar('god', () => player.god, (v) => (player.god = v), 'bool')`. */
export function bindVar(name, get, set, type = 'string', description = '') {
  command(name, (v) => { if (v === undefined) return `${name} = ${get()}`; set(v); return `${name} = ${get()}`; }, { description: description || `Get / set ${name}`, params: `value:${type}` });
  command(name, () => `${name} = ${get()}`, { description: description || `Get ${name}` });
}
/** Log with a [Tag] (shows in the editor Console tag filter too). */
export const log = {
  tag: (tag, ...a) => console.log(`[${tag}]`, ...a),
  if: (cond, ...a) => { if (cond) console.log(...a); },
  timed: (label, fn) => { const t = performance.now(); const r = fn(); console.log(`[Timing] ${label}: ${(performance.now() - t).toFixed(2)} ms`); return r; },
};
for (const t of ['Combat', 'UI', 'Network', 'AI', 'Player', 'Save', 'Audio', 'Physics', 'Level', 'Input', 'Scene', 'Inventory', 'Quest', 'Dialogue', 'Economy', 'Debug', 'Perf', 'Tutorial']) log[t.toLowerCase()] = (...a) => log.tag(t, ...a);

// ---------- parsing ----------
function tokenize(line) {
  const out = []; let cur = '', q = null, any = false;
  for (const ch of line) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; any = true; }
    else if (/\s/.test(ch)) { if (cur || any) out.push(cur); cur = ''; any = false; }
    else cur += ch;
  }
  if (cur || any) out.push(cur);
  return out;
}
const splitCommands = (line) => { const out = []; let cur = '', q = null; for (const ch of line) { if (q) { if (ch === q) q = null; cur += ch; } else if (ch === '"' || ch === "'") { q = ch; cur += ch; } else if (ch === ';') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()).filter(Boolean); };

function coerce(spec, toks) {
  const t = spec.type;
  if (t === 'rest') return toks.splice(0).join(' ');
  if (t === 'vec3') { const v = toks.splice(0, 3).map(Number); if (v.length < 3 || v.some(Number.isNaN)) throw new Error(`${spec.name}: expected 3 numbers`); return v; }
  const raw = toks.shift();
  if (t === 'number' || t === 'int') { const n = Number(raw); if (Number.isNaN(n)) throw new Error(`${spec.name}: "${raw}" is not a number`); return t === 'int' ? Math.trunc(n) : n; }
  if (t === 'bool') return ['1', 'true', 'on', 'yes'].includes(String(raw).toLowerCase());
  if (t === 'enum') { if (!spec.options?.includes(raw)) throw new Error(`${spec.name}: one of ${spec.options?.join(', ')}`); return raw; }
  if (t === 'entity') { const e = current?.find(raw); if (!e) throw new Error(`no object named "${raw}"`); return e; }
  return raw;
}
const usage = (c) => `${c.name} ${c.params.map((p) => (p.default !== undefined ? `[${p.name}:${p.type}=${p.default}]` : `<${p.name}:${p.type}${p.options ? `(${p.options.join('|')})` : ''}>`)).join(' ')}`.trim();

// ---------- console script ----------
export default class DevConsole extends NordScript {
  static attributes = {
    toggleKey: { type: 'string', default: 'Backquote', description: 'KeyboardEvent.code that opens the console. Backquote = the key left of 1 (§ on Nordic keyboards, ` on US). Change it with the console-key command.' },
    startOpen: { type: 'bool', default: false },
    pauseWhileOpen: { type: 'bool', default: false, description: 'Freeze the game while the console is open' },
    captureLogs: { type: 'bool', default: true, description: 'Show console.log / warn / error lines in the console' },
    allowExec: { type: 'bool', default: true, description: 'Allow the exec command (runs JavaScript). Turn off for shipped builds.' },
    persist: { type: 'bool', default: true, description: 'Keep the console across scene loads' },
  };

  init() {
    if (current && current !== this) { this.entity.destroy(); return; }
    current = this; this.lines = []; this.history = []; this.hi = 0; this.waiting = null; this.open = false;
    if (this.attrs.persist && !this.entity.behavior('Persist')) this.entity.addBehavior('Persist');
    const saved = this.game.save?.get('devConsole.key', null); if (saved) this.attrs.toggleKey = saved;
    this._build(); this._capture(); this._builtins();
    this.print('Nord Dev Console: type help. Open/close with ' + this.attrs.toggleKey + '.', 'dim');
    this.offs = [];
  }
  start() { if (this.attrs.startOpen) this.toggle(true); }
  onDestroy() {
    if (current === this) current = null;
    this.croot?.remove(); window.removeEventListener('keydown', this.kd, true);
    if (this.restore) this.restore();
  }

  // ----- api -----
  find(name) { return this.game.scene?.find(name) ?? null; }
  print(text, kind = 'out') { for (const l of String(text).split('\n')) this.lines.push({ l, kind }); if (this.lines.length > 600) this.lines.splice(0, 100); this._render(); }
  toggle(on = !this.open) {
    this.open = on; this.croot.style.display = on ? 'flex' : 'none';
    if (on) { this.cin.value = ''; setTimeout(() => this.cin.focus(), 0); if (this.attrs.pauseWhileOpen && !this.game.paused) { this.game.pause(); this.pausedByMe = true; } }
    else { this.cin.blur(); if (this.pausedByMe) { this.game.resume(); this.pausedByMe = false; } }
  }

  // ----- execution -----
  async run(line) {
    for (const part of splitCommands(line)) {
      const toks = tokenize(part); const head = toks.shift(); if (!head) continue;
      if (head === '#define') { const name = toks.shift(); macros.set(name, toks.join(' ').replace(/^=\s*/, '')); this.print(`macro ${name} = ${macros.get(name)}`, 'dim'); continue; }
      if (macros.has(head)) { await this.run(macros.get(head)); continue; }
      const name = aliases.get(head) ?? head, list = registry.get(name);
      if (!list) { this.print(`Unknown command "${head}". Type help.`, 'err'); continue; }
      const plat = isMobile() ? 'mobile' : 'desktop';
      const cmd = list.find((c) => (c.platform === 'all' || c.platform === plat) && toks.length >= c.params.filter((p) => p.default === undefined && p.type !== 'rest').length) ?? list[0];
      if (cmd.platform !== 'all' && cmd.platform !== plat) { this.print(`${name} is not available on ${plat}`, 'err'); continue; }
      try {
        const rest = [...toks], args = [];
        for (const p of cmd.params) { if (!rest.length && p.default !== undefined) args.push(p.default); else if (!rest.length && p.type === 'rest') args.push(''); else if (!rest.length) throw new Error('missing ' + p.name + ' — usage: ' + usage(cmd)); else args.push(coerce(p, rest)); }
        let r = cmd.run.call(this, ...args);
        if (r && typeof r.next === 'function' && typeof r[Symbol.iterator] === 'function') r = await this._interactive(r);
        else if (r && typeof r.then === 'function') r = await r;
        if (r !== undefined && r !== null) this.print(typeof r === 'object' ? JSON.stringify(r) : String(r));
      } catch (e) { this.print(String(e.message ?? e), 'err'); }
    }
  }
  async _interactive(gen) {
    let step = gen.next();
    while (!step.done) { this.print(String(step.value), 'prompt'); const answer = await new Promise((res) => { this.waiting = res; }); step = gen.next(answer); }
    return step.value;
  }
  complete(text) {
    const toks = text.split(/\s+/); const word = toks[toks.length - 1] ?? '';
    if (toks.length <= 1) return [...registry.keys(), ...aliases.keys(), ...macros.keys()].filter((n) => n.startsWith(word)).sort();
    const list = registry.get(aliases.get(toks[0]) ?? toks[0]); const p = list?.[0]?.params[toks.length - 2];
    if (!p) return [];
    const opts = p.type === 'enum' ? p.options : p.type === 'entity' ? [...(this.game.scene?.all() ?? [])].map((e) => e.name) : p.type === 'bool' ? ['true', 'false'] : [];
    return opts.filter((o) => o.toLowerCase().startsWith(word.toLowerCase()));
  }

  // ----- ui -----
  _build() {
    const css = (el, s) => Object.assign(el.style, s);
    this.croot = document.createElement('div');
    css(this.croot, { position: 'fixed', left: '0', right: '0', top: '0', height: '42vh', display: 'none', flexDirection: 'column', background: 'rgba(10,12,18,.93)', color: '#d8dee9', font: '13px/1.45 ui-monospace,Menlo,Consolas,monospace', zIndex: 99999, borderBottom: '2px solid #4c9aff', boxShadow: '0 8px 30px #0008' });
    this.cout = document.createElement('div'); css(this.cout, { flex: '1', overflow: 'auto', padding: '8px 12px', whiteSpace: 'pre-wrap' });
    this.csug = document.createElement('div'); css(this.csug, { padding: '0 12px', color: '#8b98a9', minHeight: '18px' });
    const row = document.createElement('div'); css(row, { display: 'flex', borderTop: '1px solid #2a3342' });
    const prompt = document.createElement('span'); prompt.textContent = ' >'; css(prompt, { color: '#4c9aff', padding: '6px 6px 6px 12px' });
    this.cin = document.createElement('input'); this.cin.spellcheck = false; this.cin.autocomplete = 'off';
    css(this.cin, { flex: '1', background: 'transparent', border: '0', outline: '0', color: '#fff', font: 'inherit', padding: '6px' });
    row.append(prompt, this.cin); this.croot.append(this.cout, this.csug, row); document.body.append(this.croot);
    // keys typed in the console must not reach the game
    for (const ev of ['keydown', 'keyup', 'keypress']) this.cin.addEventListener(ev, (e) => e.stopPropagation());
    this.cin.addEventListener('keydown', (e) => {
      if (e.code === this.attrs.toggleKey || (e.key === 'Escape')) { e.preventDefault(); this.toggle(false); return; }
      if (e.key === 'Enter') { const v = this.cin.value; this.cin.value = ''; this.csug.textContent = ''; if (this.waiting) { const r = this.waiting; this.waiting = null; this.print('> ' + v, 'echo'); r(v); return; } if (v.trim()) { this.history.push(v); this.hi = this.history.length; this.print('> ' + v, 'echo'); this.run(v); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (this.hi > 0) this.cin.value = this.history[--this.hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.hi = Math.min(this.history.length, this.hi + 1); this.cin.value = this.history[this.hi] ?? ''; }
      else if (e.key === 'Tab') { e.preventDefault(); const c = this.complete(this.cin.value); if (c.length) { const toks = this.cin.value.split(/\s+/); toks[toks.length - 1] = c[0]; this.cin.value = toks.join(' ') + (c.length === 1 ? ' ' : ''); } }
    });
    this.cin.addEventListener('input', () => { const c = this.cin.value ? this.complete(this.cin.value) : []; this.csug.textContent = c.slice(0, 12).join('   '); });
    this.kd = (e) => { if (e.code === this.attrs.toggleKey && !this.open && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); e.stopPropagation(); this.toggle(true); } };
    window.addEventListener('keydown', this.kd, true);
  }
  _render() {
    if (!this.cout) return;
    const col = { out: '#d8dee9', err: '#ff7b72', dim: '#6b7788', echo: '#7ee787', warn: '#e3b341', prompt: '#d2a8ff' };
    this.cout.textContent = '';
    for (const { l, kind } of this.lines) { const d = document.createElement('div'); d.textContent = l; d.style.color = col[kind] ?? col.out; this.cout.append(d); }
    this.cout.scrollTop = this.cout.scrollHeight;
  }
  _capture() {
    if (!this.attrs.captureLogs) return;
    const orig = { log: console.log, warn: console.warn, error: console.error }; let busy = false;
    const wrap = (k, kind) => (...a) => { orig[k](...a); if (busy) return; busy = true; try { this.print(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '), kind); } finally { busy = false; } };
    console.log = wrap('log', 'out'); console.warn = wrap('warn', 'warn'); console.error = wrap('error', 'err');
    this.restore = () => Object.assign(console, orig);
  }

  // ----- built-in commands -----
  _builtins() {
    const g = () => this.game, sc = () => this.game.scene, info = (e) => [`${e.name}  id ${e.id}  ${e.enabled ? 'enabled' : 'disabled'}  tags [${e.tags.join(', ')}]`, `pos ${JSON.stringify(e.pos)}  rot ${JSON.stringify(e.rot)}  scale ${JSON.stringify(e.scale)}`, `components: ${e.components.map((c) => c.type).join(', ') || '-'}`, `scripts: ${e.scripts.map((s) => s.constructor.name).join(', ') || '-'}`, `children: ${e.children.map((c) => c.name).join(', ') || '-'}`].join('\n');
    command('help', (name) => {
      if (name) return registry.has(aliases.get(name) ?? name) ? registry.get(aliases.get(name) ?? name).map((c) => `${usage(c)}${c.description ? '\n   ' + c.description : ''}`).join('\n') : `no command "${name}"`;
      return [...registry.entries()].filter(([, l]) => !l[0].hidden).sort(([a], [b]) => a.localeCompare(b)).map(([n, l]) => `${n.padEnd(18)}${l[0].description}`).join('\n') + '\n\nTab completes, Up/Down = history, ; chains commands, #define name = cmd; cmd makes a macro.';
    }, { description: 'List commands, or help <command>', params: 'command:string=', aliases: ['man', '?'] });
    command('clear', () => { this.lines.length = 0; this._render(); }, { description: 'Clear the output', aliases: ['cls'] });
    command('echo', (t) => t, { description: 'Print text', params: 'text:rest' });
    command('timescale', (v) => { g().timeScale = v; return `timeScale ${v}`; }, { description: 'Game speed (1 normal, 0.1 slow motion)', params: 'value:number=1' });
    command('pause', () => g().pause(), { description: 'Pause the game' });
    command('resume', () => g().resume(), { description: 'Resume the game' });
    command('restart', () => g().restart(), { description: 'Restart the current scene' });
    command('load-scene', (p) => g().loadScene(p), { description: 'Load a scene file', params: 'path:string' });
    command('entities', () => [...sc().all()].map((e) => `${e.name}${e.enabled ? '' : ' (off)'}`).join('\n'), { description: 'List all objects in the scene' });
    command('find', (t) => [...sc().all()].filter((e) => e.name.toLowerCase().includes(t.toLowerCase())).map((e) => e.name).join('\n') || 'none', { description: 'Find objects by name', params: 'text:string' });
    command('get-object-info', (e) => info(e), { description: 'Transform, components and scripts of an object', params: 'object:entity', aliases: ['info'] });
    command('set-pos', (e, p) => { e.pos = p; return `${e.name} -> ${JSON.stringify(e.pos)}`; }, { description: 'Move an object', params: 'object:entity pos:vec3' });
    command('set-active', (e, on) => { e.enabled = on; return `${e.name} ${on ? 'enabled' : 'disabled'}`; }, { description: 'Enable / disable an object', params: 'object:entity on:bool=true' });
    command('instantiate', async (path, p) => { const e = await sc().spawn(path, { pos: p }); return `spawned ${e?.name ?? path}`; }, { description: 'Spawn a prefab', params: 'prefab:string pos:vec3', aliases: ['spawn'] });
    command('instantiate', async (path) => { const e = await sc().spawn(path, {}); return `spawned ${e?.name ?? path}`; }, { description: 'Spawn a prefab at the origin', params: 'prefab:string' });
    command('destroy', (e) => { const n = e.name; e.destroy(); return `destroyed ${n}`; }, { description: 'Remove an object', params: 'object:entity' });
    command('call-instance', (e, method, args) => { const out = e.callScripts(method, ...(args ? JSON.parse(`[${args}]`) : [])); return out ?? 'called'; }, { description: 'Call a method on an object\'s scripts: call-instance Player Heal "10"', params: 'object:entity method:string args:rest' });
    command('emit', (name, data) => g().events.emit(name, data ? JSON.parse(data) : undefined), { description: 'Emit a game event: emit score {"score":5}', params: 'event:string data:rest' });
    command('save-get', (k) => JSON.stringify(g().save.get(k, null)), { description: 'Read a saved value', params: 'key:string' });
    command('save-set', (k, v) => { g().save.set(k, JSON.parse(v)); return 'saved'; }, { description: 'Write a saved value (JSON)', params: 'key:string value:rest' });
    command('fps', () => `${Math.round(1 / Math.max(0.0001, g().time.delta))} fps`, { description: 'Current frame rate' });
    command('console-key', (k) => { this.attrs.toggleKey = k; g().save?.set('devConsole.key', k); return `Console key is now ${k} (KeyboardEvent.code, e.g. Backquote, F1, KeyC)`; }, { description: 'Change the key that opens the console (saved)', params: 'code:string' });
    command('exec', (code) => { if (!this.attrs.allowExec) throw new Error('exec is disabled (allowExec)'); return new Function('game', 'scene', `return (${code})`)(g(), sc()); }, { description: 'Run a JavaScript expression with `game` and `scene`: exec scene.find("Player").pos', params: 'js:rest', platform: 'all' });
    command('macros', () => [...macros.entries()].map(([k, v]) => `${k} = ${v}`).join('\n') || 'none', { description: 'List macros (#define name = cmd; cmd)' });
    command('hello', function* () { const n = yield 'What is your name?'; return `Hello ${n}!`; }, { description: 'Interactive example: asks a question, then answers', hidden: false });
  }
}
