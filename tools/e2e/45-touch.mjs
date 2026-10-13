import { suites, serve, loadPlaywright, ROOT } from '../e2e-lib.mjs';

// nord-touch.js: on a touch device the overlay appears and its buttons arrive as keyboard events; on desktop it stays hidden.
suites['touch'] = async () => {
  const { chromium } = loadPlaywright();
  const srv = await serve(`${ROOT}/examples/html-touch`);
  const browser = await chromium.launch();
  try {
    const desk = await (await browser.newContext()).newPage();
    await desk.goto(srv.url);
    if (await desk.locator('.nt-root').count()) throw new Error('touch controls shown on a non-touch desktop');
    await desk.goto(srv.url + '/?touch=1');
    if (!(await desk.locator('.nt-root').count())) throw new Error('?touch=1 did not show the controls');

    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(srv.url);
    await page.waitForSelector('.nt-root');
    const hold = async (sel, ms) => {
      const b = await page.locator(sel).first().boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
      const o = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x, clientY: y };
      await page.locator(sel).first().dispatchEvent('pointerdown', o); await page.waitForTimeout(ms);
      await page.locator(sel).first().dispatchEvent('pointerup', o);
    };
    const x0 = await page.evaluate(() => window.__touchgame.x);
    await hold('.nt-d:has-text("▶")', 400); // right arrow
    const x1 = await page.evaluate(() => window.__touchgame.x);
    if (!(x1 > x0 + 20)) throw new Error(`D-pad right did not move the player (${x0} → ${x1})`);
    await page.waitForTimeout(100);
    const x2 = await page.evaluate(() => window.__touchgame.x);
    if (Math.abs(x2 - x1) > 1) throw new Error('key stayed down after release');
    let minY = 999; const t = Date.now();
    const poll = (async () => { while (Date.now() - t < 500) { minY = Math.min(minY, await page.evaluate(() => window.__touchgame.y)); await page.waitForTimeout(16); } })();
    await hold('.nt-b', 120); await poll; // Jump
    if (!(minY < 120)) throw new Error(`Jump button did not jump (min y ${minY})`);
    if (errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); srv.close(); }
};

// ultima-touch: a keyboard-only RPG; the touch pad must walk the hero and Act must work.
suites['touch-ultima'] = async () => {
  const { chromium } = loadPlaywright();
  const srv = await serve(`${ROOT}/examples/ultima-touch`);
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(srv.url); await page.waitForSelector('.nt-root');
    const hold = async (text, ms) => {
      const l = page.locator('.nt-d,.nt-b').filter({ hasText: text }).first(); const b = await l.boundingBox();
      const o = { pointerId: 3, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };
      await l.dispatchEvent('pointerdown', o); await page.waitForTimeout(ms); await l.dispatchEvent('pointerup', o);
    };
    const s0 = await page.evaluate(() => window.__ultima);
    await hold('▲', 700);
    const s1 = await page.evaluate(() => window.__ultima);
    if (!(s1.y < s0.y - 1)) throw new Error(`pad did not walk the hero (${s0.y} → ${s1.y})`);
    await hold('Wait', 60);
    if ((await page.evaluate(() => window.__ultima.food)) > s1.food) throw new Error('Wait button misbehaved');
    if (errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); srv.close(); }
};
