// Shared boot: wires Loader, Audio, UI and DOM input around a Game. Backends (phaser/babylon) call this, then drive game.tick(dt).
import { Game } from './game.js';
import { Loader } from './loader.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { attachDom } from './input.js';

/**
 * @param project parsed nord.project.json
 * @param opts { container: HTMLElement (position:relative), canvas, backend, files, storage, importScript, onError, seed, inlineOnly }
 */
export function createGame(project, opts = {}) {
  const loader = new Loader({ files: opts.files, inlineOnly: opts.inlineOnly });
  const game = new Game(project, {
    backend: opts.backend, storage: opts.storage, importScript: opts.importScript, onError: opts.onError, seed: opts.seed,
    fetchJSON: (p) => loader.json(p),
  });
  game.loader = loader;
  game.audio = new Audio(loader, { saveKey: `nord:${project.id}:audio`, storage: opts.storage ?? globalThis.localStorage });
  if (opts.container) {
    game.ui = new UI(opts.container, { skin: project.ui?.skin, theme: project.ui?.theme, fontBase: `${opts.libBase ?? '/vendor'}/fonts`, onSound: (n) => game.audio.play(`assets/audio/sfx/${n}.wav`, { bus: 'ui' }) });
    game.audio.attach(globalThis.window);
  }
  if (opts.canvas) game._detachInput = attachDom(game.input, opts.canvas, globalThis.window, (x, y) => game.backend?.toWorld?.(x, y) ?? [x, y]);
  game.preload = (paths) => game.backend?.preload?.(paths) ?? Promise.resolve();
  return game;
}

/** Fill `container` with a sized stage div and return it. Dev pages call this: `const stage = makeStage(document.body, project)`. */
export function makeStage(parent, project) {
  const d = project.display ?? {};
  const stage = parent.ownerDocument.createElement('div');
  stage.style.cssText = `position:relative;width:100vw;height:100vh;overflow:hidden;background:${d.background ?? '#101418'}`;
  parent.appendChild(stage);
  return stage;
}

/** Surface fatal errors on screen so a broken script or missing asset is visible, not a silent blank canvas. Hot reload clears it. */
export function errorOverlay(container) {
  const doc = container.ownerDocument;
  const box = doc.createElement('pre');
  box.className = 'nord-error';
  box.style.cssText = 'position:absolute;left:0;right:0;bottom:0;max-height:40%;overflow:auto;margin:0;padding:10px 14px;background:#bf616acc;color:#fff;font:12px/1.4 var(--nord-font-code,ui-monospace,Menlo,monospace);display:none;z-index:99;white-space:pre-wrap';
  box.addEventListener('click', () => { box.style.display = 'none'; });
  container.appendChild(box);
  return {
    show(msg) { box.textContent = msg; box.style.display = 'block'; },
    clear() { box.style.display = 'none'; box.textContent = ''; },
    el: box,
  };
}
