// Event sheet ahead-of-time compiler (M10-03): turns every expression of a sheet into a JavaScript function and emits one ES module
//   export const exprs = { "score * 2": (env) => num(env.name("score")) * 2, … };
// The runner (sheet.js) uses `exprs[text]` instead of parsing the text at load time; anything not in the table (hot reload, expressions
// built at runtime) still goes through the interpreter, which stays the reference implementation. The module carries a standard source map
// (generated line → line of the event in the sheet JSON) so browser dev tools and stack traces point at the event.
// Used by `tools/compile-sheets.mjs` and `nord build`. No eval at runtime: the module is a normal script.
import { parse, BUILTINS } from './expr.js';

const q = JSON.stringify;
const num = (s) => `num(${s})`;

/** AST → JavaScript expression source (uses `env`, `num`, `B`). Mirrors expr.js `ev` exactly. */
export function toJS(n) {
  switch (n.k) {
    case 'lit': return q(n.v);
    case 'neg': return `-${num(toJS(n.e))}`;
    case 'not': return `(${toJS(n.e)} ? 0 : 1)`;
    case 'if': return `(${toJS(n.c)} ? ${toJS(n.a)} : ${toJS(n.b)})`;
    case 'bin': {
      const l = toJS(n.l), r = toJS(n.r);
      switch (n.op) {
        case '&&': return `(${l} && ${r} ? 1 : 0)`;
        case '||': return `(${l} || ${r} ? 1 : 0)`;
        case '&': return `\`\${${l}}\${${r}}\``;
        case '+': case '-': case '*': case '/': case '%': return `(${num(l)} ${n.op} ${num(r)})`;
        case '^': return `(${num(l)} ** ${num(r)})`;
        case '=': return `(${l} == ${r} ? 1 : 0)`; // same loose equality as the interpreter
        case '!=': return `(${l} != ${r} ? 1 : 0)`;
        case '<': case '<=': case '>': case '>=': return `(${l} ${n.op} ${r} ? 1 : 0)`;
      }
      throw new Error(`bad operator ${n.op}`);
    }
    case 'name': return `env.name(${q(n.name)})`;
    case 'call': {
      const a = n.args.map(toJS).join(', ');
      if (n.name === 'random' || n.name === 'Random') return `env.random(${a})`;
      if (BUILTINS[n.name.toLowerCase()]) return `B[${q(n.name.toLowerCase())}](${a})`;
      return `env.call(${q(n.name)}, [${a}])`;
    }
    case 'member': {
      const o = n.of;
      const idx = (c) => (c.k === 'call' && c.args.length ? toJS(c.args[0]) : 'null');
      if (o.k === 'member' && (o.of.k === 'name' || o.of.k === 'call')) return `env.bprop(${q(o.of.name)}, ${idx(o.of)}, ${q(o.name)}, ${q(n.name)})`;
      if (o.k === 'name') return `env.prop(${q(o.name)}, null, ${q(n.name)})`;
      if (o.k === 'call') return `env.prop(${q(o.name)}, ${idx(o)}, ${q(n.name)})`;
      throw new Error(`cannot read '.${n.name}'`);
    }
    case 'method': {
      const o = n.of, a = n.args.map(toJS).join(', ');
      if (o.k === 'member' && o.of.k === 'name') return `env.bmethod(${q(o.of.name)}, ${q(o.name)}, ${q(n.name)}, [${a}])`;
      if (o.k !== 'name') throw new Error(`cannot call '.${n.name}()'`);
      return `env.method(${q(o.name)}, ${q(n.name)}, [${a}])`;
    }
  }
  throw new Error(`bad node ${n.k}`);
}

/** Every expression string of a sheet (params of conditions/actions, function-block defaults, variable values that are expressions), with the
 *  event path ("2.0.1") it belongs to. Raw params are text, not expressions: they are collected too but compile errors on them are ignored. */
export function collectExpressions(events, prefix = '', out = []) {
  events.forEach((ev, i) => {
    const path = prefix + i;
    for (const list of [ev.conditions, ev.actions]) for (const c of list ?? []) for (const v of Object.values(c.params ?? {})) if (typeof v === 'string') out.push({ src: v, path });
    for (const p of ev.params ?? []) if (typeof p.initialValue === 'string') out.push({ src: p.initialValue, path });
    if (ev.children) collectExpressions(ev.children, `${path}.`, out);
  });
  return out;
}

// ---- tiny source map v3 writer (one segment per generated line)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(n) {
  let v = n < 0 ? ((-n) << 1) | 1 : n << 1, s = '';
  do { let d = v & 31; v >>>= 5; if (v) d |= 32; s += B64[d]; } while (v);
  return s;
}

/**
 * @param data parsed sheet JSON (includes already flattened, as the loader does)
 * @param file name of the sheet file, e.g. "events/main.events.json" (goes into the source map)
 * @param opts { engineImport: path of expr.js as seen from the generated module }
 * @returns { code, map, count, skipped } — skipped = expression texts that did not parse (left to the interpreter, which reports them)
 */
export function compileSheet(data, file, { engineImport = '../runtime/core/eventsheet/expr.js' } = {}) {
  const jsonText = JSON.stringify(data, null, 2);
  const lineOfPath = new Map(); // event path -> 0-based line in the pretty-printed JSON
  {
    // walk the structure in the same order JSON.stringify does to find each event's first line
    const lines = jsonText.split('\n');
    let cursor = 0;
    const walk = (events, prefix, depthIndent) => events.forEach((ev, i) => {
      const marker = `${' '.repeat(depthIndent)}{`;
      while (cursor < lines.length && lines[cursor] !== marker) cursor++;
      lineOfPath.set(prefix + i, cursor);
      cursor++;
      if (ev.children) { while (cursor < lines.length && !lines[cursor].startsWith(`${' '.repeat(depthIndent + 2)}"children"`)) cursor++; walk(ev.children, `${prefix + i}.`, depthIndent + 6); }
    });
    walk(data.events ?? [], '', 4);
  }
  const seen = new Map(); // src -> { js, path }
  const skipped = [];
  for (const { src, path } of collectExpressions(data.events ?? [])) {
    if (seen.has(src)) continue;
    try { seen.set(src, { js: toJS(parse(src)), path }); } catch { skipped.push(src); }
  }
  const header = [`// Generated by nord event sheet compiler from ${file}. Do not edit.`, `import { num, BUILTINS as B } from '${engineImport}';`, 'export const exprs = {'];
  const body = [], mappings = [];
  let prevSrcLine = 0;
  for (const [src, { js, path }] of seen) {
    body.push(`  ${q(src)}: (env) => ${js},`);
    const srcLine = lineOfPath.get(path) ?? 0;
    mappings.push(`AAA${vlq(srcLine - prevSrcLine)}A`); // [genCol 0, source 0, srcLine delta, srcCol 0]
    prevSrcLine = srcLine;
  }
  const lines = [...header, ...body, '};', `export const compiledFrom = ${q(file)};`];
  // mapping lines: header lines have no segments (empty), then one per expression
  const map = { version: 3, file: `${file}.compiled.js`, sources: [file], sourcesContent: [jsonText], names: [], mappings: [...header.map(() => ''), ...mappings, '', ''].join(';') };
  const code = `${lines.join('\n')}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`;
  return { code, map, count: seen.size, skipped };
}
