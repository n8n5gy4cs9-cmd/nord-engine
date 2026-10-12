// Helpers for tools/gen_examples.mjs. Each game lives in tools/examples/<id>/game.mjs and returns a spec; this writes a Nord project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ID = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
let seq = 0;
const sid = () => (++seq).toString(36).padStart(8, 'e');

/** Entity JSON. o: { pos, rot, scale, tags, c: components[], s: scripts[], kids } */
export const E = (name, o = {}) => ({
  id: sid(), name, enabled: o.enabled !== false, tags: o.tags ?? [], layer: 0,
  transform: { pos: o.pos ?? [0, 0, 0], rot: o.rot ?? [0, 0, 0], scale: o.scale ?? [1, 1, 1] },
  components: o.c ?? [], scripts: (o.s ?? []).map((x) => (typeof x === 'string' ? { path: x, attributes: {} } : { path: x[0], attributes: x[1] ?? {} })), children: o.kids ?? [], prefab: null,
});
/** Solid colour rectangle (tinted white square sprite). */
export const rect = (name, x, y, w, h, color, o = {}) => E(name, { pos: [x, y, o.z ?? 0], tags: o.tags, s: o.s, c: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint: color, alpha: o.alpha ?? 1 }, ...(o.c ?? [])] });
export const circle = (name, x, y, d, color, o = {}) => E(name, { pos: [x, y, o.z ?? 0], tags: o.tags, s: o.s, c: [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [d, d], tint: color }, ...(o.c ?? [])] });
export const img = (name, x, y, tex, o = {}) => E(name, { pos: [x, y, o.z ?? 0], tags: o.tags, s: o.s, scale: o.scale, c: [{ type: 'sprite', texture: tex, size: o.size, tint: o.tint }, ...(o.c ?? [])] });
export const text = (name, x, y, t, o = {}) => E(name, { pos: [x, y, o.z ?? 50], tags: o.tags, s: o.s, c: [{ type: 'text', text: t, size: o.size ?? 20, color: o.color ?? '#eceff4', origin: o.origin }] });
export const camera2d = (x, y, o = {}) => E('Camera', { pos: [x, y, 0], c: [{ type: 'camera', zoom: o.zoom ?? 1, ...(o.cam ?? {}) }], s: o.s });
export const keys = (extra = {}) => ({ left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], jump: ['Space', 'KeyW', 'ArrowUp'], fire: ['Space', 'Mouse0'], interact: ['KeyE', 'Enter'], ...extra });

export function project(id, name, type, o = {}) {
  const is3 = type === '3d';
  return {
    format: 1, name, id: `com.crowelian.${id.replace(/\W/g, '')}`, type, engineVersion: '0.1.0', startScene: 'scenes/main.scene.json',
    display: { width: o.w ?? (is3 ? 1280 : 640), height: o.h ?? (is3 ? 720 : 360), scale: 'fit', pixelArt: o.pixelArt ?? false, background: o.bg ?? '#2e3440' },
    physics: o.physics ?? { engine: is3 ? 'havok' : 'none', gravity: is3 ? [0, -9.81, 0] : [0, 0, 0] },
    input: { actions: o.input ?? keys() }, plugins: ['ui', 'audio'], ui: { skin: 'cyber', theme: o.theme ?? 'nord' },
  };
}

const PAGE2D = (name) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>html,body{margin:0;height:100%;background:#101418;overflow:hidden}#stage{position:relative;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"nord":"/runtime/core/index.js"}}</script></head>
<body><div id="stage"></div>
<script src="/vendor/phaser/phaser.min.js"></script>
<script type="module">
import { boot } from '/runtime/phaser/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage') });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
`;
const PAGE3D = (name) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>html,body{margin:0;height:100%;background:#101418;overflow:hidden}#stage{position:relative;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"nord":"/runtime/core/index.js"}}</script></head>
<body><div id="stage"></div>
<script src="/vendor/babylonjs/babylon.js"></script>
<script src="/vendor/babylonjs-loaders/babylonjs.loaders.min.js"></script>
<script src="/vendor/babylonjs-gui/babylon.gui.min.js"></script>
<script src="/vendor/havok/HavokPhysics_umd.js"></script>
<script type="module">
import { boot } from '/runtime/babylon/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage'), preserveDrawingBuffer: true });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
`;
const PAGEHTML = (name, mod, bootJs) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './${mod}';
try { mount(document.getElementById('app')${bootJs ?? ''}); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
`;

const wj = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

/**
 * spec: { id, name, type, project:{…}, scenes:{ main: {settings, entities}, … }, prefabs:{ 'prefabs/x.prefab.json': entity }, scripts:{ 'a.js': 'own' } (files from tools/examples/<id>/scripts),
 *   lib:[names of library/scripts to copy under scripts/], assets:[repo-relative asset paths or {from,to}], readme, html?:{module,bootJs} }
 */
export function writeProject(spec, outDir, srcDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const t = spec.project.type;
  if (t === 'html') {
    fs.writeFileSync(path.join(outDir, 'index.html'), PAGEHTML(spec.name, spec.html.module, spec.html.bootJs));
    for (const m of spec.html.files) copy(path.join(ROOT, m.from), path.join(outDir, m.to));
  } else {
    fs.writeFileSync(path.join(outDir, 'index.html'), (t === '3d' ? PAGE3D : PAGE2D)(spec.name));
    for (const [n, s] of Object.entries(spec.scenes)) wj(path.join(outDir, `scenes/${n}.scene.json`), { format: 1, name: n, settings: s.settings ?? {}, entities: s.entities });
    for (const [p, root] of Object.entries(spec.prefabs ?? {})) wj(path.join(outDir, p), { format: 1, root });
    const sdir = path.join(srcDir, 'scripts');
    if (fs.existsSync(sdir)) for (const f of fs.readdirSync(sdir)) copy(path.join(sdir, f), path.join(outDir, 'scripts', f));
    fs.mkdirSync(path.join(outDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'scripts/mk.js'), MK_JS);
    for (const n of spec.lib ?? []) copy(path.join(ROOT, 'library/scripts', `${n}.js`), path.join(outDir, 'scripts', `${n}.js`));
    for (const a of spec.assets ?? []) { const [from, to] = typeof a === 'string' ? [a, a] : [a.from, a.to]; const src = path.join(ROOT, from); if (!fs.existsSync(src)) throw new Error(`${spec.id}: missing asset ${from}`); copy(src, path.join(outDir, to)); if (fs.existsSync(src + '.meta.json')) copy(src + '.meta.json', path.join(outDir, to + '.meta.json')); }
  }
  wj(path.join(outDir, 'nord.project.json'), spec.project);
  fs.writeFileSync(path.join(outDir, 'README.md'), spec.readme);
}
export const MK_JS = `// Tiny helpers to spawn coloured rectangles / circles / text at runtime (placeholder art). Generated by tools/gen_examples.mjs.
const base = (name, x, y, z, tags, comps) => ({ name, tags: tags ?? [], transform: { pos: [x, y, z ?? 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], children: [] });
export const rectData = (name, x, y, w, h, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint: color, alpha: o.alpha ?? 1 }]);
export const circleData = (name, x, y, d, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [d, d], tint: color, alpha: o.alpha ?? 1 }]);
export const textData = (name, x, y, t, o = {}) => base(name, x, y, o.z ?? 50, o.tags, [{ type: 'text', text: t, size: o.size ?? 20, color: o.color ?? '#eceff4' }]);
export const rect = (scene, ...a) => scene.spawnData(rectData(...a));
export const circle = (scene, ...a) => scene.spawnData(circleData(...a));
export const label = (scene, ...a) => scene.spawnData(textData(...a));
export const aabb = (a, b) => Math.abs(a.pos[0] - b.pos[0]) * 2 < a.w + b.w && Math.abs(a.pos[1] - b.pos[1]) * 2 < a.h + b.h;
`;
export const SQUARE = [{ from: 'assets/particles/square.png', to: 'assets/sprites/square.png' }, { from: 'assets/particles/circle.png', to: 'assets/sprites/circle.png' }];
