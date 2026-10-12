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
    input: { actions: o.input ?? (is3 ? keys({ jump: ['Space'] }) : keys()) }, plugins: ['ui', 'audio'], ui: { skin: 'cyber', theme: o.theme ?? 'nord' },
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
const PAGEHTML = (name, mod, bootJs, id) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="${id}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './${mod}';
try { await mount(document.getElementById('app')${bootJs ?? ''}); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
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
    fs.writeFileSync(path.join(outDir, 'index.html'), PAGEHTML(spec.name, spec.html.module, spec.html.bootJs, spec.project.id));
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
    for (const [to, content] of Object.entries(spec.files ?? {})) { fs.mkdirSync(path.dirname(path.join(outDir, to)), { recursive: true }); fs.writeFileSync(path.join(outDir, to), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n'); }
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

// ---- 3D helpers ----
export const env3 = (sky = 'day') => [
  E('Sun', { pos: [0, 10, 0], rot: [50, -30, 0], c: [{ type: 'light', kind: 'directional', intensity: 1.4, castShadows: true, color: '#fff4e0' }] }),
  E('Ambient', { c: [{ type: 'light', kind: 'hemispheric', intensity: 0.55, color: '#b0c0ff' }] }),
  E('Sky', { c: [{ type: 'skybox', path: `assets/skybox/${sky}` }] }),
];
export const SKY = (n) => ['px', 'py', 'pz', 'nx', 'ny', 'nz'].map((f) => `assets/skybox/${n}/${f}.png`);
/** Static (or dynamic) box with a colour or texture material and a matching collider. */
export const box3 = (name, [x, y, z], [w, h, d], o = {}) => E(name, { pos: [x, y, z], rot: o.rot, tags: o.tags, s: o.s, c: [
  { type: 'mesh', shape: o.shape ?? 'box', size: [w, h, d] },
  { type: 'material', ...(o.texture ? { texture: o.texture, uvScale: o.uv ?? [Math.max(1, w / 2), Math.max(1, d / 2)] } : { color: o.color ?? '#c8ccd4' }), roughness: o.rough ?? 0.8, metallic: o.metal ?? 0 },
  ...(o.body === false ? [] : [{ type: 'rigidbody', mode: o.body ?? 'static', mass: o.mass ?? 1, bounce: o.bounce ?? 0, fixedRotation: !!o.fixedRotation }, { type: 'collider', shape: o.colShape ?? (o.shape === 'sphere' ? 'sphere' : 'box'), size: o.colSize ?? [w, h, d], trigger: !!o.trigger }]),
  ...(o.c ?? [])] });
export const ground3 = (size = 60, tex = 'assets/textures/grass.png') => E('Ground', { c: [{ type: 'mesh', shape: 'ground', size: [size, 0.2, size] }, { type: 'material', texture: tex, uvScale: [size / 4, size / 4], roughness: 1 }, { type: 'rigidbody', mode: 'static' }, { type: 'collider', shape: 'box', size: [size, 0.2, size], offset: [0, -0.1, 0] }] });
export const hud3 = (name, x, y, t, size = 22) => E(name, { c: [{ type: 'uiLabel', text: t, x, y, size }] });
export const tex3 = (names) => names.map((n) => `assets/textures/${n}.png`);

/** Plain-HTML example/template that mounts one of library/apps/*.js (no engine runtime needed). */
export const appSpec = (id, name, kit, o = {}) => ({
  name, project: { ...project(id, name, 'html', {}), startScene: '' },
  html: { module: 'app.js', bootJs: o.bootJs, files: [{ from: `library/apps/${kit}.js`, to: 'app.js' }, { from: 'library/apps/_kit.js', to: '_kit.js' }, ...(o.files ?? [])] },
  readme: `# ${name}\nPlain HTML + ES modules, no build step and no engine runtime. The app is \`library/apps/${kit}.js\` (copied to \`app.js\`): \`mount(rootElement)\`.\nOpen with \`nord serve .\` or export with \`nord export . --target html\`.\n${o.note ?? ''}`,
  template: o.template, example: o.example,
});

/** Desktop app (M9): an `appSpec` plus the desktop client, CodeMirror bundle (if asked) and a `desktop.permissions` manifest. */
export const desktopAppSpec = (id, name, kit, { permissions, cm = false, singleInstance = false, bootJs, template, example, note } = {}) => {
  const s = appSpec(id, name, kit, { template, example, bootJs, note });
  s.html.files.push({ from: 'runtime/desktop/nord-desktop.js', to: 'nord-desktop.js' }, { from: 'runtime/desktop/nord-desktop.d.ts', to: 'nord-desktop.d.ts' });
  if (cm) s.html.files.push({ from: 'vendor/codemirror/cm.bundle.js', to: 'cm.bundle.js' });
  s.project.desktop = { permissions, singleInstance };
  s.project.display = { ...s.project.display, width: 1100, height: 700 };
  s.readme = `# ${name}\nA Nord **desktop app**: plain HTML + ES modules using \`window.nord.desktop\` (files, dialogs, menus, ...). Permissions are declared in \`nord.project.json\` → \`desktop.permissions\` (least privilege; see docs/DESKTOP_APPS.md).\n\n- Develop: \`nord serve .\` (open the URL; the dev server provides the same desktop API with the same permission checks).\n- Native window: \`nord export . --target html\`, then run the player: \`nord-player <export folder>\` (\`nord bundle-mac\` makes a .app).\n- In a plain browser the app falls back to browser storage where it can.\n${note ?? ''}`;
  return s;
};
