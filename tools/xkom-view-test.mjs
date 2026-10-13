// Browser regression: real tactical replay must keep feet above terrain, show a walk cycle and avoid camera snaps.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors, result } = await withPage(`${ROOT}/examples/xkom`, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.mode === 'tac');
  return page.evaluate(async () => {
    const h = window.__xk, t = h.tac, u = t.sel, e = t.spr.get(u.id), start = { x: u.x, y: u.y };
    const samples = [], camera = [], cameraFrames = [], frames = new Set(), original = h.tw.bind(h);
    h.tw = async cfg => {
      if (cfg.targets === e.sp) {
        camera.push([h.cam.scrollX, h.cam.scrollY]);
        const fn = cfg.onUpdate;
        cfg.onUpdate = (...args) => {
          fn?.(...args); frames.add(e.sp.frame.name); cameraFrames.push([h.cam.scrollX, h.cam.scrollY, performance.now()]);
          const covered = t.tiles.some(tile => tile.g.visible && tile.g.depth >= e.sp.depth && Math.abs(tile.g.x - e.sp.x) < 32 && Math.abs(tile.g.y + 8 - (e.sp.y - 2)) < 16);
          samples.push(covered);
        };
      }
      return original(cfg);
    };
    const events = [0, 1, 2].map(i => ({ t: 'move', id: u.id, x0: start.x + i, y0: start.y, x: start.x + i + 1, y: start.y }));
    const before = [h.cam.scrollX, h.cam.scrollY]; t.busy = true; await t.replay(events); t.busy = false;
    const shortCamera = [...camera]; cameraFrames.length = 0;
    t.busy = true; await t.replay(Array.from({ length: 14 }, (_, i) => ({ t: 'move', id: u.id, x0: start.x + i, y0: start.y, x: start.x + i + 1, y: start.y }))); t.busy = false;
    const maxPanSpeed = Math.max(...cameraFrames.slice(1).map((p, i) => Math.hypot(p[0] - cameraFrames[i][0], p[1] - cameraFrames[i][1]) / Math.max(8, p[2] - cameraFrames[i][2])));
    return { terrainCoversUnit: samples.some(Boolean), frames: [...frames], camera: shortCamera, before, maxPanSpeed, didPan: cameraFrames.some(p => p[0] !== before[0] || p[1] !== before[1]), errors: h.game.errors.map(x => x.err?.message) };
  });
}, { path: '/?start=tac&seed=42', viewport: { width: 960, height: 600 } });
console.log(JSON.stringify(result));
assert.deepEqual(errors, []); assert.deepEqual(result.errors, []);
assert.equal(result.terrainCoversUnit, false, 'ground tiles must never cover a walking unit');
assert.ok(result.frames.includes(0) && result.frames.includes(1), 'walking must alternate idle and stride frames');
assert.deepEqual(result.camera[0], result.before, 'camera must not snap before a walk step');
for (let i = 1; i < result.camera.length; i++) assert.ok(Math.hypot(...result.camera[i].map((v, k) => v - result.camera[i - 1][k])) < 1, 'short on-screen walks keep the camera still');
assert.equal(result.didPan, true, 'off-screen walks pan into view'); assert.ok(result.maxPanSpeed <= 0.4, 'camera follows without abrupt per-step jumps, allowing for headless frame timing');
console.log('PASS X-KOM movement layering, visible walk cycle and stable camera');
