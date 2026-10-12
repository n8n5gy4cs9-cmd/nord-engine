import fs from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { suites, loadPlaywright, ROOT } from '../e2e-lib.mjs';

// Edit viewport (editor/viewport/*) against the real `nord serve` (Hub: SSE down, POST /api/ipc up).
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

async function withServe(project, fn) {
  const bin = `${ROOT}/target/debug/nord`;
  if (!fs.existsSync(bin)) throw new Error('build first: cargo build -p nord-cli');
  const port = await freePort();
  const proc = spawn(bin, ['serve', project, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/project'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const ipc = async () => (await fetch(base + '/api/ipc')).json();
    const cmd = (m) => fetch(base + '/__edit/cmd', { method: 'POST', headers: { 'x-nord': '1' }, body: JSON.stringify(m) });
    const sceneMsg = (selection = []) => ({
      t: 'scene', rev: 1, selection,
      project: JSON.parse(fs.readFileSync(`${project}/nord.project.json`, 'utf8')),
      scene: JSON.parse(fs.readFileSync(`${project}/scenes/main.scene.json`, 'utf8')),
    });
    const result = await fn({ page, base, ipc, cmd, sceneMsg, errors });
    return { errors, result };
  } finally { await browser.close(); proc.kill(); }
}

const waitFor = async (f, ms = 15000) => { const t = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + f); await new Promise((r) => setTimeout(r, 100)); } };

suites['edit-viewport-2d'] = async () => {
  const project = `${ROOT}/examples/conformance-2d`;
  const { errors, result } = await withServe(project, async ({ page, base, ipc, cmd, sceneMsg }) => {
    await page.goto(`${base}/__edit?mode=2d`);
    await page.waitForFunction(() => window.__nord_edit_ready === true);
    await waitFor(async () => (await ipc()).some((m) => m.t === 'ready'));
    await cmd(sceneMsg());
    await page.waitForFunction(() => window.__nordEdit.state.scene?.entities?.length > 0);
    await page.waitForTimeout(500); // images
    const api = () => page.evaluate(() => window.__nordEdit.backend.api.items());
    const items = await api();
    const hero = JSON.parse(fs.readFileSync(`${project}/scenes/main.scene.json`, 'utf8')).entities.find((e) => e.name === 'Hero');
    const sp = await page.evaluate((id) => window.__nordEdit.backend.api.screenOf(id), hero.id);
    // click selects
    const box = await page.locator('#c').boundingBox();
    await page.mouse.click(box.x + sp[0], box.y + sp[1]);
    const sel = await waitFor(async () => (await ipc()).filter((m) => m.t === 'select').at(-1));
    // drag moves (move tool, snap on 8px)
    await cmd({ t: 'settings', tool: 'move', snap: true, snapMove: 8, snapRot: 15, snapScale: 0.1, grid: true });
    await page.waitForTimeout(200);
    const before = await page.evaluate((id) => window.__nordEdit.state.scene.entities.find((e) => e.id === id).transform.pos, hero.id);
    await page.mouse.move(box.x + sp[0], box.y + sp[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + sp[0] + 45, box.y + sp[1] + 10, { steps: 6 });
    await page.mouse.up();
    const tf = await waitFor(async () => (await ipc()).filter((m) => m.t === 'transform' && m.final).at(-1));
    // zoom with wheel changes camera zoom; pan with middle drag
    const z0 = await page.evaluate(() => window.__nordEdit.backend.api.cam.zoom);
    await page.mouse.wheel(0, -300);
    const z1 = await page.evaluate(() => window.__nordEdit.backend.api.cam.zoom);
    // rotate + scale tools
    await cmd({ t: 'settings', tool: 'rotate', snap: true, snapMove: 8, snapRot: 15, snapScale: 0.1, grid: true });
    await page.waitForTimeout(150);
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/edit-2d.png` });
    // keyboard forwarding
    await page.keyboard.press('KeyE');
    const key = await waitFor(async () => (await ipc()).find((m) => m.t === 'key' && m.key === 'e'));
    return { n: items.length, selId: sel.id === hero.id, before, tf, z0, z1, key: !!key, shotBytes: shot.length };
  });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.n < 5 || !result.selId) throw new Error('2D scene/picking failed: ' + JSON.stringify(result));
  if (result.tf.pos[0] === result.before[0] || result.tf.pos[0] % 8 !== 0 || result.tf.pos[1] % 8 !== 0) throw new Error('2D drag/snap failed: ' + JSON.stringify(result.tf));
  if (!(result.z1 > result.z0)) throw new Error('wheel zoom failed');
};

suites['edit-viewport-3d'] = async () => {
  const project = `${ROOT}/examples/conformance-3d`;
  const { errors, result } = await withServe(project, async ({ page, base, ipc, cmd, sceneMsg }) => {
    await page.goto(`${base}/__edit?mode=3d`);
    await page.waitForFunction(() => window.__nord_edit_ready === true, null, { timeout: 30000 });
    await waitFor(async () => (await ipc()).some((m) => m.t === 'ready'));
    await cmd(sceneMsg());
    await page.waitForFunction(() => window.__nordEdit.backend.api.nodes.size > 0, null, { timeout: 20000 });
    const scene = JSON.parse(fs.readFileSync(`${project}/scenes/main.scene.json`, 'utf8'));
    const withMesh = scene.entities.find((e) => e.components?.some((c) => c.type === 'mesh' && c.shape !== 'ground'));
    await page.waitForTimeout(800);
    // click on an entity's projected position selects it
    const sp = await page.evaluate((id) => window.__nordEdit.backend.api.screenOf(id), withMesh.id);
    const box = await page.locator('#c').boundingBox();
    await page.mouse.click(box.x + sp[0], box.y + sp[1]);
    const sel = await waitFor(async () => (await ipc()).filter((m) => m.t === 'select').at(-1));
    // gizmo drag end -> transform (synthetic: move the node then fire the gizmo's drag-end observable)
    await cmd({ t: 'select', ids: [withMesh.id] });
    await cmd({ t: 'settings', tool: 'move', snap: true, snapMove: 0.5, snapRot: 15, snapScale: 0.1, grid: true });
    await page.waitForTimeout(300);
    await page.evaluate((id) => {
      const a = window.__nordEdit.backend.api, n = a.nodes.get(id).node;
      n.position.x += 2; a.gizmos().positionGizmo.onDragEndObservable.notifyObservers({});
    }, withMesh.id);
    const tf = await waitFor(async () => (await ipc()).filter((m) => m.t === 'transform' && m.final).at(-1));
    const snap = await page.evaluate(() => window.__nordEdit.backend.api.gizmos().positionGizmo.snapDistance);
    // focus command moves the camera target onto the entity
    await cmd({ t: 'focus' });
    await page.waitForTimeout(200);
    const tgt = await page.evaluate((id) => { const a = window.__nordEdit.backend.api; const p = a.nodes.get(id).node.getAbsolutePosition(); return a.camera.getTarget().subtract(p).length(); }, withMesh.id);
    // model thumbnail rendering (offscreen) -> server writes .nord-cache/thumbs/<sha>.png
    const sha = 'abc123def456';
    await cmd({ t: 'thumbs', items: [{ path: 'assets/models/cube_spin.glb', sha }] });
    const thumb = await waitFor(async () => (await ipc()).find((m) => m.t === 'thumb'), 30000);
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/edit-3d.png` });
    return { nodes: await page.evaluate(() => window.__nordEdit.backend.api.nodes.size), selOk: sel.id === withMesh.id, tf, snap, tgt, thumb: thumb.path, thumbFile: fs.existsSync(`${project}/.nord-cache/thumbs/${sha}.png`), shot: shot.length };
  });
  fs.rmSync(`${project}/.nord-cache/thumbs/abc123def456.png`, { force: true });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (!result.selOk) throw new Error('3D picking failed: ' + JSON.stringify(result));
  if (!result.tf || Math.abs(result.tf.pos[0] - 0) < 0.01 && result.tf.pos.every((v) => v === 0)) throw new Error('3D gizmo transform not sent');
  if (result.snap !== 0.5) throw new Error('snap not applied to gizmo');
  if (result.tgt > 0.01) throw new Error('focus failed');
  if (!result.thumbFile) throw new Error('model thumbnail was not written');
};

suites['game-log-bridge'] = async () => {
  // console output of a served game page reaches /api/log (editor Console panel source)
  const project = `${ROOT}/examples/html-lite`;
  const { errors, result } = await withServe(project, async ({ page, base }) => {
    await page.goto(base + '/');
    await page.evaluate(() => { console.warn('hello-from-game'); setTimeout(() => { throw new Error('boom'); }, 0); });
    const logs = await waitFor(async () => { const l = await (await fetch(base + '/api/log')).json(); return l.some((x) => x.text.includes('boom')) ? l : null; });
    return logs;
  });
  if (!result.some((l) => l.level === 'warn' && l.text.includes('hello-from-game'))) throw new Error('warn not forwarded: ' + JSON.stringify(result));
  if (!result.some((l) => l.level === 'error' && l.text.includes('boom'))) throw new Error('error not forwarded');
  void errors;
};

// A project made by the editor's hub / `nord new` must run in Play without edits (index.html + empty scene).
for (const kind of ['2d', '3d']) {
  suites[`new-project-plays-${kind}`] = async () => {
    const { execFileSync } = await import('node:child_process');
    const dir = `${ROOT}/target/e2e/newproj-${kind}`;
    fs.rmSync(dir, { recursive: true, force: true });
    execFileSync(`${ROOT}/target/debug/nord`, ['new', dir, '-t', kind]);
    const { errors } = await withServe(dir, async ({ page, base }) => {
      await page.goto(base + '/');
      await page.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout: 30000 });
      const err = await page.evaluate(() => window.__nord_error);
      if (err) throw new Error(err);
    });
    if (errors.length) throw new Error(errors.join('\n'));
  };
}
