// FPS Creator runtime — public API. Used by the Nord level script (scripts/fpsc/level-script.js), the editor play-test (editor/fpsc/play.html) and exported games.
//   const run = await runLevel({ B: BABYLON, canvas, container, level, bank });   run.stop();            // own engine + loop (stand-alone page)
//   const run = await attachLevel({ B, scene, engine, canvas, container, level, bank });  run.update(dt);  // inside an existing Babylon scene (Nord)
export { createBank, resolveScripts } from './bank.js';
export { FpsGame } from './game.js';
export { newLevel, normalize, validate, paintRoom, setCell, setEdge, CELL, STORY } from './level.js';
import { FpsGame } from './game.js';
import { createBank } from './bank.js';
import { normalize } from './level.js';

/** Build the bank from a project's fpsc/bank.json given by `getJson(path)` (resolves to the parsed file or null). */
export async function loadBankFrom(getJson, opts = {}) {
  let custom = {}; try { custom = (await getJson('fpsc/bank.json')) ?? {}; } catch { /* no custom bank */ }
  return createBank(custom, opts);
}

/** Fetch-based bank loader for pages served from the project root (`base` = URL prefix of the project, default "/"). */
export async function loadBank(base = '/', opts = {}) {
  const root = new URL(base, location.href);
  return loadBankFrom(async (p) => { const r = await fetch(new URL(p, root), { cache: 'no-store' }); return r.ok ? r.json() : null; }, { importer: (p) => import(/* @vite-ignore */ new URL(p, root).href), urlOf: (p) => new URL(p, root).href, ...opts });
}

export async function fetchLevel(path, base = '/') { const r = await fetch(new URL(path, new URL(base, location.href)), { cache: 'no-store' }); if (!r.ok) throw new Error(`level ${path}: HTTP ${r.status}`); return normalize(await r.json()); }

/**
 * Start a level in an existing scene. opts: { B, scene, engine?, canvas, container, level, bank, playtest?, autostart?, noLock?, onWin, onNext, onQuit, onLog, onGame }
 * Returns { game, update(dt), restart(o), stop() }. The host renders the scene.
 */
export async function attachLevel(opts) {
  const B = opts.B ?? globalThis.BABYLON; if (!B) throw new Error('BABYLON not loaded');
  const run = { game: null, stopped: false };
  const make = async (extra = {}) => {
    run.game?.dispose();
    const game = new FpsGame({ ...opts, ...extra, B, onRestart: (o) => make({ useCheckpoint: !!o?.checkpoint, autostart: true }) });
    run.game = game; await game.start(); opts.onGame?.(game); return game;
  };
  await make();
  run.update = (dt) => { if (run.stopped || !run.game) return; try { run.game.update(dt); opts.onFrame?.(dt, run.game); } catch (e) { console.error('[fpsc] frame error', e); opts.onLog?.('error', String(e?.message ?? e)); } };
  run.restart = (o) => make(o);
  run.stop = () => { run.stopped = true; run.game?.dispose(); };
  return run;
}

/** Stand-alone: create engine + scene on `opts.canvas`, run the level and the render loop. Returns the same object plus { engine, scene }. */
export async function runLevel(opts) {
  const B = opts.B ?? globalThis.BABYLON; if (!B) throw new Error('BABYLON not loaded');
  const engine = opts.engine ?? new B.Engine(opts.canvas, true, { stencil: true, adaptToDeviceRatio: true, preserveDrawingBuffer: !!opts.preserve });
  const scene = opts.scene ?? new B.Scene(engine);
  const run = await attachLevel({ ...opts, B, engine, scene });
  run.engine = engine; run.scene = scene;
  let last = performance.now();
  engine.runRenderLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; run.update(dt); scene.render(); });
  const rs = () => engine.resize(); window.addEventListener('resize', rs);
  const stop = run.stop; run.stop = () => { stop(); window.removeEventListener('resize', rs); engine.stopRenderLoop(); scene.dispose(); engine.dispose(); };
  return run;
}
