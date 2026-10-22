// Focused smoke only: two apps, one real 3D/physics path each, save/import/export plumbing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage, waitReady, loadPlaywright, ROOT } from './e2e-lib.mjs';
if (process.env.PW_CHROMIUM) {
  const { chromium } = loadPlaywright(),
    launch = chromium.launch.bind(chromium);
  chromium.launch = (o) => launch({ ...o, executablePath: process.env.PW_CHROMIUM });
}
const projects = process.env.NORD_DESK_PROJECTS ?? `${ROOT}/examples`;
const paper = await withPage(
  `${projects}/paper-worlds`,
  async (page) => {
    await waitReady(page);
    await page.waitForFunction(() => window.__paper);
    assert.equal(await page.evaluate(() => window.__paper.boards.length), 10);
    await page.locator('#tool').selectOption('sticky');
    await page.locator('#text').fill('Ship it!');
    const c = page.locator('#flat canvas'),
      r = await c.boundingBox();
    await page.mouse.click(r.x + 300, r.y + 220);
    assert(
      await page.evaluate(() =>
        window.__paper.boards[0].shapes.some((s) => s.text === 'Ship it!'),
      ),
    );
    await page.locator('#tool').selectOption('circle');
    await page.mouse.move(r.x + 400, r.y + 300);
    await page.mouse.down();
    await page.mouse.move(r.x + 445, r.y + 345);
    await page.mouse.up();
    await page.locator('#balls').click();
    assert(
      (await page.evaluate(
        () => window.__paper.flat.game.scene.getScenes(true)[0].physics.world.bodies.size,
      )) > 0,
    );
    await page.locator('#maze').click();
    assert.equal(
      await page.evaluate(
        () =>
          window.__paper.flat.game.scene.getScenes(true)[0].physics.world.bounds.width,
      ),
      1200,
    );
    await page.evaluate(() => {
      const scene = window.__paper.flat.game.scene.getScenes(true)[0],
        p = scene.children.list.find((v) => v.radius === 12);
      p.setPosition(1155, 790);
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-nord-ui]').shadowRoot.querySelector('#status').textContent.includes('MAZE COMPLETE'),
    );
    await page.locator('#stop').click();
    await page.locator('#save').click();
    await page.screenshot({
      path: `${ROOT}/docs/screenshots/ed-paper-studio.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.querySelector('[data-nord-ui]').shadowRoot.querySelector('#mode').click();
      document.querySelector('[data-nord-ui]').shadowRoot.querySelector('#mode').click();
    });
    await page.waitForFunction(() => window.__paper.in3d, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__paper.world.papers.length), 10);
    await page.waitForFunction(() => BABYLON.EngineStore.Instances.length === 1);
    assert((await page.evaluate(() => window.__paper.world.stickies.length)) >= 2);
    const y = await page.evaluate(() => window.__paper.world.stickies[0].mesh.position.y);
    await page.locator('#shake').click();
    await page.waitForTimeout(200);
    assert.notEqual(
      await page.evaluate(() => window.__paper.world.stickies[0].mesh.position.y),
      y,
    );
    await page.screenshot({
      path: `${ROOT}/docs/screenshots/ed-paper-desk.png`,
      fullPage: true,
    });
    await page.locator('#ride').click();
    await page.waitForFunction(
      () => window.__paper.world.scene.activeCamera.name === 'Coaster',
    );
    await page.locator('#mode').click();
    const download = page.waitForEvent('download');
    await page.locator('#export').click();
    const artifact = await download;
    assert.equal(artifact.suggestedFilename(), 'my-paper-desk.html');
    const html = fs.readFileSync(await artifact.path(), 'utf8'),
      data = html.match(/<script[^>]*id="desk-data"[^>]*>([\s\S]*?)<\/script>/)[1];
    assert.deepEqual(JSON.parse(data), await page.evaluate(() => window.__paper.boards));
    await page.reload();
    await page.waitForFunction(() => window.__paper);
    assert(
      await page.evaluate(() =>
        window.__paper.boards[0].shapes.some((s) => s.text === 'Ship it!'),
      ),
    );
  },
  { viewport: { width: 1360, height: 950 } },
);
assert.deepEqual(paper.errors, []);
const rss = await withPage(
  `${projects}/rss-river`,
  async (page) => {
    await waitReady(page);
    await page.waitForFunction(() => window.__rss?.articles.length >= 8);
    assert.equal(
      await page.evaluate(() => window.__rss.feeds.filter((f) => !f.demo).length),
      3,
    );
    await page.locator('.news').first().click();
    await page.getByRole('button', { name: '☆ Star', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.__rss.articles.filter((a) => a.star).length),
      1,
    );
    await page.screenshot({
      path: `${ROOT}/docs/screenshots/ed-rss-list.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.querySelector('[data-nord-ui]').shadowRoot.querySelector('#mode').click();
      document.querySelector('[data-nord-ui]').shadowRoot.querySelector('#mode').click();
    });
    await page.waitForFunction(() => window.__rss.river?.papers.length > 0, null, {
      timeout: 30000,
    });
    await page.waitForFunction(() => BABYLON.EngineStore.Instances.length === 1);
    const selected = await page.evaluate(
      () => window.__rss.articles.find((a) => a.star).id,
    );
    assert(
      await page.evaluate(
        (id) => window.__rss.river.papers.find((p) => p.article.id === id).width > 4,
        selected,
      ),
    );
    await page.getByRole('button', { name: 'Flick this paper', exact: true }).click();
    assert(
      await page.evaluate(
        (id) => window.__rss.river.papers.find((p) => p.article.id === id).dropped,
        selected,
      ),
    );
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${ROOT}/docs/screenshots/ed-rss-river.png`,
      fullPage: true,
    });
    const bad = await page.evaluate(async () => {
      const { parseFeed } = await import('./feeds.js');
      try {
        parseFeed('<bad>', { id: 'bad', url: 'https://example.org', name: 'bad' });
        return false;
      } catch {
        return true;
      }
    });
    assert(bad);
    await page.reload();
    await page.waitForFunction(() => window.__rss?.articles.some((a) => a.star));
  },
  { viewport: { width: 1450, height: 950 } },
);
assert.deepEqual(rss.errors, []);
console.log(
  'Paper studio/save/3D/Havok/ride/export and RSS cache/star/parse/3D/flick passed',
);
