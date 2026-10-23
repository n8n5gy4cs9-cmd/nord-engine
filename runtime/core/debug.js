// Debugger + profiler (M10-22/23). Off by default (zero cost): `game.enableDebug()` or open the game with `?debug` (F9 toggles the overlay).
//   pause / resume / step one frame · breakpoints on event-sheet events (by path like "2.0.1": hit when the event RUNS → game pauses)
//   live instances with editable vars/position · console: evaluate event-sheet expressions · profiler: fps, frame ms graph, objects,
//   JS heap (Chrome), draw calls (if the backend reports them), cost per top-level event/group, slow-frame markers.
//   Deep profiling (docs/PROFILER.md): per-phase time (fixed/systems/scripts/components/behaviors/late), cost per script method and per
//   component type, spike capture with the culprit, a recorder (`record(true)`) and `exportProfile()` JSON, network stats (`game.net.stats()`).
const now = () => (globalThis.performance?.now?.() ?? Date.now());
const HISTORY = 240;
const RECORD_MAX = 3600;   // frames kept while recording (~1 min at 60 fps)
const SPIKES = 30;

const top = (map, n = 12) => [...map.entries()].map(([name, c]) => ({ name, ms: c.ms, calls: c.calls })).sort((a, b) => b.ms - a.ms).slice(0, n);

export class Debugger {
  constructor(game) {
    this.game = game;
    this.paused = false; this.stepReq = false;
    this.breakpoints = new Set();
    this.ran = new Map();          // event path -> sheet tick it last ran in
    this.cost = new Map();         // top-level event/group path -> { ms, calls } over the window since reset
    this.frames = [];              // ms per frame
    this.slow = [];                // frame indexes (counter) of slow frames
    this.slowMs = 25; this.frameNo = 0;
    this.hit = null; this.t0 = 0;
    this.phases = [];              // per frame: { fixed, systems, scripts, components, behaviors, late } ms (last HISTORY frames)
    this.cur = {}; this.curScripts = new Map();
    this.scripts = new Map();      // "Class.method" -> { ms, calls } since reset
    this.components = new Map();   // component type -> { ms, calls } since reset
    this.spikes = [];              // slow frames with their breakdown and the most expensive script of that frame
    this.recording = false; this.recorded = []; this.heapSeries = [];
  }
  now() { return now(); }
  /** Called by Scene.tick: milliseconds spent in a phase of the current frame. */
  phase(name, ms) { this.cur[name] = (this.cur[name] ?? 0) + ms; }
  /** Called by Entity.callScripts: one script method took `ms`. */
  addScript(name, ms) {
    const c = this.scripts.get(name) ?? { ms: 0, calls: 0 }; c.ms += ms; c.calls++; this.scripts.set(name, c);
    this.curScripts.set(name, (this.curScripts.get(name) ?? 0) + ms);
  }
  addComponent(type, ms) { const c = this.components.get(type) ?? { ms: 0, calls: 0 }; c.ms += ms; c.calls++; this.components.set(type, c); }
  record(on = true) { this.recording = !!on; if (on) { this.recorded.length = 0; this.heapSeries.length = 0; } return this.recording; }
  // ---- frame hooks (Game.tick)
  begin(dt) {
    this.t0 = now(); this.cur = {}; this.curScripts.clear();
    if (this.paused) { if (!this.stepReq) return null; this.stepReq = false; return 1 / 60; }
    return dt;
  }
  end() {
    const ms = now() - this.t0;
    this.frameNo++;
    this.frames.push(ms); if (this.frames.length > HISTORY) this.frames.shift();
    const ph = { ...this.cur };
    this.phases.push(ph); if (this.phases.length > HISTORY) this.phases.shift();
    if (this.recording) {
      const heap = globalThis.performance?.memory ? globalThis.performance.memory.usedJSHeapSize / 1048576 : null;
      this.recorded.push({ frame: this.frameNo, ms, phases: ph, heapMB: heap, net: this.game.net?.stats?.() ?? null });
      if (this.recorded.length > RECORD_MAX) this.recorded.shift();
    }
    if (ms > this.slowMs) {
      this.slow.push({ frame: this.frameNo, ms }); if (this.slow.length > 50) this.slow.shift();
      let top = null; for (const [n, v] of this.curScripts) if (!top || v > top.ms) top = { name: n, ms: v };
      this.spikes.push({ frame: this.frameNo, ms, phases: ph, top }); if (this.spikes.length > SPIKES) this.spikes.shift();
    }
    if (this.hit) { this.paused = true; this.game.events.emit('debugBreak', { event: this.hit }); this.hit = null; }
  }
  // ---- event-sheet hooks
  onRun(ev, tick) { this.ran.set(ev._path, tick); if (this.breakpoints.has(ev._path) && !this.paused) this.hit = ev._path; }
  addCost(path, ms) { const c = this.cost.get(path) ?? { ms: 0, calls: 0 }; c.ms += ms; c.calls++; this.cost.set(path, c); }
  // ---- controls
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  step() { this.paused = true; this.stepReq = true; }
  toggleBreakpoint(path) { if (!this.breakpoints.delete(path)) this.breakpoints.add(path); return this.breakpoints.has(path); }
  resetStats() { this.cost.clear(); this.frames.length = 0; this.slow.length = 0; this.phases.length = 0; this.scripts.clear(); this.components.clear(); this.spikes.length = 0; }
  // ---- inspection
  get sheet() { return this.game.scene?.eventSheet ?? null; }
  /** Flat, JSON-friendly list of live instances. */
  instances() {
    return [...(this.game.scene?.all() ?? [])].filter((e) => !e.destroyed).map((e) => ({
      id: e.id, name: e.name, x: e.pos[0], y: e.pos[1], tags: [...e.tags], vars: { ...e.vars }, behaviors: e.behaviors.map((b) => b.type),
    }));
  }
  find(id) { return [...(this.game.scene?.all() ?? [])].find((e) => e.id === id) ?? null; }
  /** Edit an instance variable (value text is parsed as JSON when possible) or position ("x"/"y"). */
  setValue(id, field, text) {
    const e = this.find(id); if (!e) return false;
    let v = text; try { v = JSON.parse(text); } catch { /* keep as string */ }
    if (field === 'x' || field === 'y') e.pos = field === 'x' ? [Number(v), e.pos[1], e.pos[2]] : [e.pos[0], Number(v), e.pos[2]];
    else e.vars[field] = v;
    return true;
  }
  /** Console: evaluate an expression in the running sheet's context; returns { ok, value|error }. */
  evaluate(text) {
    const s = this.sheet;
    if (!s) return { ok: false, error: 'no event sheet in this scene' };
    try { return { ok: true, value: s.evalExpr(text) }; } catch (err) { return { ok: false, error: String(err.message ?? err) }; }
  }
  globals() { return this.sheet ? Object.fromEntries(this.sheet.globals) : {}; }
  setGlobal(name, text) { let v = text; try { v = JSON.parse(text); } catch { /* string */ } this.sheet?.setVar(name, v); }
  /** Short label for an event path ("2.0" → "Hero ▸ Compare X, … → Set position"), for the overlay. */
  describe(path) {
    let list = this.sheet?.events, ev = null;
    for (const i of String(path).split('.').map(Number)) { ev = list?.[i]; list = ev?.children; }
    if (!ev) return path;
    if (ev.type === 'group') return `Group "${ev.title}"`;
    const c = (ev.conditions ?? []).map((x) => `${x.object}.${x.id}`).join(' & ') || 'always';
    return `${c} → ${(ev.actions ?? []).map((x) => x.id).join(', ')}`;
  }
  stats() {
    const f = this.frames; const avg = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
    const backend = this.game.backend;
    return {
      fps: avg > 0 ? Math.min(999, 1000 / Math.max(avg, 1000 / 240)) : 0, // CPU-bound estimate; a render loop at 60 reports ~60 only when frames are cheap
      frameMs: avg, worstMs: f.length ? Math.max(...f) : 0, objects: this.instances().length,
      drawCalls: backend?.drawCalls?.() ?? null, heapMB: globalThis.performance?.memory ? globalThis.performance.memory.usedJSHeapSize / 1048576 : null,
      slowFrames: this.slow.length,
      costs: [...this.cost.entries()].map(([path, c]) => ({ path, ms: c.ms, calls: c.calls, label: this.describe(path) })).sort((a, b) => b.ms - a.ms).slice(0, 12),
      phases: this.phaseAverages(), scripts: top(this.scripts), components: top(this.components), spikes: this.spikes.slice(-8),
      net: this.game.net?.stats?.() ?? null, recording: this.recording, recorded: this.recorded.length,
    };
  }
  /** Average ms per phase over the last 120 frames. */
  phaseAverages() {
    const f = this.phases.slice(-120), sum = {};
    for (const p of f) for (const [k, v] of Object.entries(p)) sum[k] = (sum[k] ?? 0) + v;
    return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v / Math.max(f.length, 1)]));
  }
  /** Everything the profiler knows as one JSON-friendly object (what "Save profile" writes). */
  exportProfile() {
    const s = this.stats();
    return {
      format: 'nord-profile-1', at: new Date().toISOString(), project: this.game.project?.id ?? null, scene: this.game._scenePath ?? null,
      summary: { fps: s.fps, frameMs: s.frameMs, worstMs: s.worstMs, objects: s.objects, drawCalls: s.drawCalls, heapMB: s.heapMB, slowFrames: s.slowFrames },
      phases: s.phases, scripts: top(this.scripts, 50), components: top(this.components, 50), events: s.costs, spikes: this.spikes, net: s.net,
      frames: this.recording || this.recorded.length ? this.recorded : this.frames.map((ms, i) => ({ ms, phases: this.phases[i] ?? {} })),
    };
  }
}

/** Browser download of the profile JSON (the editor's Profiler window saves into the project instead). */
function downloadProfile(dbg) {
  const doc = globalThis.document; if (!doc) return;
  const a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(dbg.exportProfile())], { type: 'application/json' })); a.download = 'nord-profile.json'; a.click();
}

/** Small DOM overlay. `container` = the position:relative stage. F9 toggles. Returns { el, destroy() }. */
export function attachDebugOverlay(game, container) {
  const dbg = game.debug ?? game.enableDebug();
  const doc = container.ownerDocument;
  const el = doc.createElement('div');
  el.className = 'nord-debug';
  el.style.cssText = 'position:absolute;top:8px;right:8px;width:360px;max-height:80%;overflow:auto;z-index:98;background:#161b22ee;color:#d6dde6;font:12px/1.4 var(--nord-font-code,ui-monospace,Menlo,monospace);border:1px solid #384050;border-radius:6px;padding:8px;display:none';
  container.appendChild(el);
  let tab = 'profiler', open = false, timer = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const btn = (id, label) => `<button data-a="${id}" style="margin-right:4px">${label}</button>`;
  const graph = () => {
    const f = dbg.frames.slice(-120), max = Math.max(33, ...f);
    const bars = f.map((ms, i) => `<rect x="${i * 3}" y="${40 - (ms / max) * 40}" width="2" height="${(ms / max) * 40}" fill="${ms > dbg.slowMs ? '#bf616a' : '#88c0d0'}"/>`).join('');
    return `<svg width="360" height="40" style="background:#0d1117">${bars}</svg>`;
  };
  const render = () => {
    if (!open) return;
    const s = dbg.stats();
    let h = `<div>${btn('pause', dbg.paused ? '▶ Resume' : '⏸ Pause')}${btn('step', '⏭ Step')}${btn('reset', 'Reset stats')}<span style="float:right">${dbg.paused ? 'PAUSED' : ''}</span></div>`;
    h += `<div style="margin:4px 0">${['profiler', 'details', 'network', 'instances', 'events', 'console'].map((t) => `<a data-tab="${t}" style="cursor:pointer;margin-right:8px;${t === tab ? 'color:#88c0d0;font-weight:700' : ''}">${t}</a>`).join('')}</div>`;
    if (tab === 'profiler') {
      h += `${graph()}<div>${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(2)} ms avg · worst ${s.worstMs.toFixed(1)} ms · ${s.objects} objects${s.drawCalls != null ? ` · ${s.drawCalls} draws` : ''}${s.heapMB != null ? ` · ${s.heapMB.toFixed(1)} MB` : ''} · ${s.slowFrames} slow</div>`;
      h += s.costs.map((c) => `<div title="${esc(c.label)}">${c.ms.toFixed(2)} ms ×${c.calls} · ${esc(c.label).slice(0, 48)}</div>`).join('') || '<div style="opacity:.6">no event-sheet cost yet</div>';
    } else if (tab === 'details') {
      const bar = (rows) => rows.map((r) => `<div title="${esc(r.name)}">${r.ms.toFixed(2)} ms${r.calls != null ? ` ×${r.calls}` : ''} · ${esc(r.name).slice(0, 44)}</div>`).join('') || '<div style="opacity:.6">nothing yet</div>';
      h += `<div>${btn('rec', s.recording ? `■ Stop recording (${s.recorded})` : '● Record')}${btn('save', 'Save profile')}</div>`;
      h += `<b>Phases (avg ms/frame)</b>${bar(Object.entries(s.phases).map(([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms))}`;
      h += `<b>Scripts</b>${bar(s.scripts)}<b>Components</b>${bar(s.components)}`;
      h += `<b>Spikes (> ${dbg.slowMs} ms)</b>${s.spikes.map((p) => `<div>#${p.frame} ${p.ms.toFixed(1)} ms${p.top ? ` · ${esc(p.top.name)} ${p.top.ms.toFixed(1)} ms` : ''}</div>`).join('') || '<div style="opacity:.6">none</div>'}`;
    } else if (tab === 'network') {
      const n = s.net;
      h += n ? `<div>${n.peers} peer(s) · ${n.isHost ? 'host' : 'guest'} · ping ${n.pingMs != null ? n.pingMs.toFixed(0) + ' ms' : '–'}</div><div>out ${n.bytesOut} B (${n.msgsOut} msgs) · in ${n.bytesIn} B (${n.msgsIn} msgs)</div><div>${n.outPerSec.toFixed(0)} B/s out · ${n.inPerSec.toFixed(0)} B/s in</div><div>simulated: ${n.sim.latency} ms ±${n.sim.jitter}, ${(n.sim.loss * 100).toFixed(0)}% loss</div>` : '<div style="opacity:.6">no network (game.net)</div>';
    } else if (tab === 'instances') {
      h += dbg.instances().slice(0, 100).map((i) => `<div><b>${esc(i.name)}</b> ${i.x.toFixed(0)},${i.y.toFixed(0)} ${Object.entries(i.vars).map(([k, v]) => `<span data-edit="${esc(i.id)}|${esc(k)}" style="cursor:pointer;text-decoration:underline">${esc(k)}=${esc(JSON.stringify(v))}</span>`).join(' ')}</div>`).join('');
    } else if (tab === 'events') {
      const rows = []; const tick = dbg.sheet?.tickCount ?? 0;
      const walk = (list, prefix, depth) => (list ?? []).forEach((ev, i) => {
        const p = prefix + i; if (ev.type !== 'event' && ev.type !== 'group') return;
        const hot = tick - (dbg.ran.get(p) ?? -99) < 6, bp = dbg.breakpoints.has(p);
        rows.push(`<div data-bp="${p}" style="padding-left:${depth * 12}px;cursor:pointer;${hot ? 'background:#2e4a35' : ''}">${bp ? '🔴' : '○'} ${esc(dbg.describe(p)).slice(0, 60)}</div>`);
        walk(ev.children, p + '.', depth + 1);
      });
      walk(dbg.sheet?.events, '', 0);
      h += `<div style="opacity:.6">click a row to toggle a breakpoint; green = ran recently</div>${rows.join('') || '<div>no event sheet</div>'}`;
    } else {
      h += `<div id="nd-out" style="max-height:140px;overflow:auto;white-space:pre-wrap">${esc(dbg._out ?? '')}</div><input id="nd-in" placeholder="expression, e.g. score + Hero.X" style="width:100%;box-sizing:border-box">`;
    }
    el.innerHTML = h;
    const input = el.querySelector('#nd-in');
    if (input) { input.focus(); input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { const r = dbg.evaluate(input.value); dbg._out = `${dbg._out ?? ''}> ${input.value}\n${r.ok ? JSON.stringify(r.value) : 'error: ' + r.error}\n`; render(); } }; }
  };
  el.addEventListener('click', (e) => {
    const t = e.target;
    const a = t.dataset?.a, tabName = t.dataset?.tab, bp = t.closest?.('[data-bp]')?.dataset.bp, edit = t.dataset?.edit;
    if (a === 'pause') dbg.paused ? dbg.resume() : dbg.pause();
    else if (a === 'step') dbg.step();
    else if (a === 'reset') dbg.resetStats();
    else if (a === 'rec') dbg.record(!dbg.recording);
    else if (a === 'save') downloadProfile(dbg);
    else if (tabName) tab = tabName;
    else if (edit) { const [id, k] = edit.split('|'); const v = globalThis.prompt?.(`${k} =`, ''); if (v !== null && v !== undefined) dbg.setValue(id, k, v); }
    else if (bp) dbg.toggleBreakpoint(bp);
    render();
  });
  const setOpen = (v) => { open = v; el.style.display = v ? 'block' : 'none'; clearInterval(timer); if (v) { render(); timer = setInterval(render, 250); } };
  const key = (e) => { if (e.key === 'F9') { setOpen(!open); e.preventDefault(); } };
  globalThis.window?.addEventListener('keydown', key);
  game.events.on('debugBreak', () => { if (!open) setOpen(true); tab = 'events'; render(); });
  return { el, setOpen, destroy() { clearInterval(timer); globalThis.window?.removeEventListener('keydown', key); el.remove(); } };
}
