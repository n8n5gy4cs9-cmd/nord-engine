// Event-sheet expression language (Construct-style): numbers, "strings", + - * / % ^, = != < <= > >=, & (concat),
// && || !, a ? b : c, name, Obj.Prop, Obj(i).Prop, Obj.Count, fn(args), Functions.Name(args). No eval — compiled to closures.
const TOK = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|("(?:[^"\\]|\\.)*")|([A-Za-z_][\w]*)|(&&|\|\||!=|<=|>=|[-+*\/%^=<>!&?:(),.]))/y;

function lex(src) {
  const out = [];
  TOK.lastIndex = 0;
  let m;
  while (TOK.lastIndex < src.length && (m = TOK.exec(src))) {
    if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'str', v: JSON.parse(m[2]) });
    else if (m[3] !== undefined) out.push({ t: 'id', v: m[3] });
    else out.push({ t: 'op', v: m[4] });
  }
  if (src.slice(TOK.lastIndex).trim()) throw new Error(`bad expression near '${src.slice(TOK.lastIndex).trim().slice(0, 12)}' in: ${src}`);
  return out;
}

const PREC = [['||'], ['&&'], ['=', '!='], ['<', '<=', '>', '>='], ['&'], ['+', '-'], ['*', '/', '%']];

export function parse(src) {
  const toks = lex(String(src));
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => toks[i]?.t === 'op' && toks[i].v === v;
  const eat = (v) => { if (!isOp(v)) throw new Error(`expected '${v}' in: ${src}`); i++; };

  function ternary() {
    const c = binary(0);
    if (isOp('?')) { i++; const a = ternary(); eat(':'); const b = ternary(); return { k: 'if', c, a, b }; }
    return c;
  }
  function binary(level) {
    if (level >= PREC.length) return power();
    let l = binary(level + 1);
    while (toks[i]?.t === 'op' && PREC[level].includes(toks[i].v)) {
      const op = toks[i++].v;
      l = { k: 'bin', op, l, r: binary(level + 1) };
    }
    return l;
  }
  function power() {
    const b = unary();
    if (isOp('^')) { i++; return { k: 'bin', op: '^', l: b, r: power() }; }
    return b;
  }
  function unary() {
    if (isOp('-')) { i++; return { k: 'neg', e: unary() }; }
    if (isOp('+')) { i++; return unary(); }
    if (isOp('!')) { i++; return { k: 'not', e: unary() }; }
    return postfix();
  }
  function args() {
    const a = [];
    if (!isOp(')')) { a.push(ternary()); while (isOp(',')) { i++; a.push(ternary()); } }
    eat(')');
    return a;
  }
  function postfix() {
    let n = primary();
    for (;;) {
      if (isOp('(') && n.k === 'name') { i++; n = { k: 'call', name: n.name, args: args() }; }
      else if (isOp('.')) {
        i++;
        const t = toks[i++];
        if (t?.t !== 'id') throw new Error(`expected name after '.' in: ${src}`);
        if (isOp('(')) { i++; n = { k: 'method', of: n, name: t.v, args: args() }; } else n = { k: 'member', of: n, name: t.v };
      } else return n;
    }
  }
  function primary() {
    const t = toks[i++];
    if (!t) throw new Error(`unexpected end of expression: ${src}`);
    if (t.t === 'num' || t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'id') return { k: 'name', name: t.v };
    if (t.v === '(') { const e = ternary(); eat(')'); return e; }
    throw new Error(`unexpected '${t.v}' in: ${src}`);
  }
  const ast = ternary();
  if (i < toks.length) throw new Error(`unexpected '${toks[i].v}' in: ${src}`);
  return ast;
}

const BUILTINS = {
  abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round, sqrt: Math.sqrt, sin: (d) => Math.sin(d * Math.PI / 180), cos: (d) => Math.cos(d * Math.PI / 180),
  tan: (d) => Math.tan(d * Math.PI / 180), asin: (v) => Math.asin(v) * 180 / Math.PI, acos: (v) => Math.acos(v) * 180 / Math.PI, atan: (v) => Math.atan(v) * 180 / Math.PI,
  atan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI, exp: Math.exp, ln: Math.log, log10: Math.log10, min: Math.min, max: Math.max, int: Math.trunc,
  sign: Math.sign, pow: Math.pow, clamp: (v, a, b) => Math.min(Math.max(v, a), b), lerp: (a, b, t) => a + (b - a) * t, distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, anglediff: (a, b) => Math.abs(((b - a + 540) % 360) - 180), unlerp: (a, b, v) => (v - a) / (b - a),
  qarp: (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c, cubic: (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d,
  // strings
  len: (s) => String(s).length, left: (s, n) => String(s).slice(0, n), right: (s, n) => String(s).slice(-n || undefined), mid: (s, i, n) => String(s).substr(i, n),
  find: (s, f) => String(s).indexOf(f), replace: (s, a, b) => String(s).split(a).join(b), uppercase: (s) => String(s).toUpperCase(), lowercase: (s) => String(s).toLowerCase(),
  trim: (s) => String(s).trim(), newline: () => '\n', zeropad: (n, w) => String(Math.trunc(n)).padStart(w, '0'), tonumber: (s) => parseFloat(s) || 0, tostring: (v) => String(v),
  float: (v) => parseFloat(v) || 0, choose: (...a) => a[0] === undefined ? 0 : a[Math.floor(Math.random() * a.length)],
};
const trunc2 = (n) => n;

/** Compile source to `(env) => value`. env: { vars(name) -> {has,get}, objects, rng, game, ... } supplied by the runner. */
export function compile(src) {
  const ast = typeof src === 'object' ? src : parse(src);
  return (env) => ev(ast, env);
}

function ev(n, env) {
  switch (n.k) {
    case 'lit': return n.v;
    case 'neg': return -num(ev(n.e, env));
    case 'not': return ev(n.e, env) ? 0 : 1;
    case 'if': return ev(n.c, env) ? ev(n.a, env) : ev(n.b, env);
    case 'bin': {
      if (n.op === '&&') return ev(n.l, env) && ev(n.r, env) ? 1 : 0;
      if (n.op === '||') return ev(n.l, env) || ev(n.r, env) ? 1 : 0;
      const l = ev(n.l, env), r = ev(n.r, env);
      switch (n.op) {
        case '&': return `${l}${r}`;
        case '+': return num(l) + num(r);
        case '-': return num(l) - num(r);
        case '*': return num(l) * num(r);
        case '/': return num(l) / num(r);
        case '%': return num(l) % num(r);
        case '^': return num(l) ** num(r);
        case '=': return l == r ? 1 : 0; // eslint-disable-line eqeqeq
        case '!=': return l != r ? 1 : 0; // eslint-disable-line eqeqeq
        case '<': return l < r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '>': return l > r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
      }
      throw new Error(`bad operator ${n.op}`);
    }
    case 'name': return env.name(n.name);
    case 'call': {
      const f = BUILTINS[n.name.toLowerCase()];
      const a = n.args.map((x) => ev(x, env));
      if (n.name === 'random') return env.random(...a);
      if (n.name === 'Random') return env.random(...a);
      if (f) return f(...a);
      return env.call(n.name, a); // system expression (dt, time, ...) or object instance index handled via member
    }
    case 'member': {
      const o = n.of;
      if (o.k === 'name') return env.prop(o.name, null, n.name);
      if (o.k === 'call') return env.prop(o.name, o.args.length ? ev(o.args[0], env) : null, n.name);
      throw new Error(`cannot read '.${n.name}'`);
    }
    case 'method': {
      const o = n.of;
      if (o.k !== 'name') throw new Error(`cannot call '.${n.name}()'`);
      return env.method(o.name, n.name, n.args.map((x) => ev(x, env)));
    }
  }
  throw new Error(`bad node ${n.k}`);
}
const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0);
export { BUILTINS, trunc2 };
