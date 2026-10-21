// Real runtime/browser checks for the complete coding tutorials T33/T34.
import assert from 'node:assert/strict';
import { withPage, waitReady, loadPlaywright, ROOT } from './e2e-lib.mjs';
if (process.env.PW_CHROMIUM) {
  const { chromium } = loadPlaywright(), launch = chromium.launch.bind(chromium);
  chromium.launch = options => launch({ ...options, executablePath: process.env.PW_CHROMIUM });
}
for (const id of ['coin-rush', 'crystal-relay']) {
  const { errors } = await withPage(`${process.env.NORD_WORKSHOP_PROJECTS ?? ROOT + '/examples'}/${id}`, async page => {
    await waitReady(page);
    await page.waitForTimeout(700);
    const is2 = id === 'coin-rush';
    const script = is2 ? 'Systems' : 'Player';
    const state = () => page.evaluate(name => {
      const s = window.__nord.scene.find(name).scripts.find(s => 'remaining' in s);
      return { time: s.remaining, lives: s.lives, coins: s.coins ?? s.next, score: s.score, energy: s.energy, best: s.best, ended: s.ended };
    }, script);
    const before = await state();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForTimeout(250);
    const paused = await state();
    await page.waitForTimeout(300);
    assert.equal((await state()).time, paused.time, 'pause freezes countdown');
    await page.getByRole('button', { name: is2 ? 'Resume' : 'Resume relay', exact: true }).click();
    await page.waitForTimeout(100);
    assert((await state()).time < paused.time, 'resume advances countdown');
    if (is2) {
      await page.evaluate(() => { const g = window.__nord; g.physics.teleport(g.scene.find('Hero'), ...g.scene.find('Coin0').pos); });
      await page.waitForTimeout(200);
      assert.equal((await state()).coins, 1, 'real coin collision updates objective');
      await page.evaluate(() => window.__nord.events.emit('score', 25));
      assert((await state()).score >= 60, 'rapid rewards receive combo multiplier');
      await page.evaluate(() => window.__nord.events.emit('died'));
      assert.equal((await state()).lives, before.lives - 1);
      // Drive the same events emitted by pickups/boss to check the end-state gate.
      await page.evaluate(() => { const e = window.__nord.events; e.emit('game:win'); for(let i=0;i<7;i++)e.emit('pickup',{kind:'score'}); });
    } else {
      await page.keyboard.down('ShiftLeft');await page.waitForTimeout(300);await page.keyboard.up('ShiftLeft');
      assert((await state()).energy < 1, 'sprint consumes energy');
      // A later crystal is deliberately ignored before Gem0.
      await page.evaluate(() => { const g=window.__nord;g.physics.teleport(g.scene.find('Player'),...g.scene.find('Gem2').pos); });
      await page.waitForTimeout(100);assert.equal((await state()).coins,0);
      for(let i=0;i<7;i++) {
        await page.evaluate(i => { const g=window.__nord;g.physics.teleport(g.scene.find('Player'),...g.scene.find('Gem'+i).pos); },i);
        await page.waitForTimeout(100);
        assert.equal((await state()).coins,i+1,'ordered world-space collection');
        if(i===0) {
          await page.evaluate(()=>{const g=window.__nord;g.physics.teleport(g.scene.find('Player'),0,-10,0);});
          await page.waitForTimeout(100);assert.equal((await state()).lives,before.lives-1,'fall costs a life');
          const y=await page.evaluate(()=>window.__nord.scene.find('Player').pos[1]);assert(y>0,'respawn uses crystal checkpoint');
        }
      }
    }
    assert.equal((await state()).ended,true);assert((await state()).best>0,'winning saves a record');
    const best=(await state()).best;
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.waitForTimeout(400);
    assert.equal((await state()).coins,0,'restart resets objective');assert.equal((await state()).best,best,'record survives restart');
    // Exercise timer loss and its restart, rather than only the happy path.
    await page.evaluate(name=>{const s=window.__nord.scene.find(name).scripts.find(s=>'remaining'in s);s.remaining=0.01;},script);
    await page.waitForFunction(name=>window.__nord.scene.find(name).scripts.find(s=>'remaining'in s).ended,script,{timeout:5000});
    await page.getByRole('button',{name:'Try again',exact:true}).click();await page.waitForTimeout(300);
    assert.equal((await state()).ended,false);
    assert.deepEqual(await page.evaluate(()=>window.__nord.errors.map(e=>e.err.message)),[]);
    await page.reload();await waitReady(page);await page.waitForTimeout(200);
    assert.equal((await state()).best,best,'record survives page reload');
    await page.screenshot({path:`${ROOT}/docs/screenshots/ed-code-${id}.png`});
    console.log(id,'pause/resume, collection, scoring/sprint, lives, win/save, restart, timer loss OK');
  });
  assert.deepEqual(errors,[]);
}

if (process.argv.includes('--manual')) for (const slug of ['tut-t33-code-coin-rush', 'tut-t34-code-crystal-relay']) {
  const { errors } = await withPage(`${ROOT}/docs/manual`, async page => {
    const frames = page.locator('.code-frame');
    assert(await frames.count() > 12, 'prose snippets and complete source have code frames');
    await frames.first().scrollIntoViewIfNeeded();
    await page.waitForSelector('.cm-editor');
    assert(await page.locator('.cm-editor .cm-line').count() > 0, 'CodeMirror displays actual source');
    assert(await page.locator('button[aria-label="Copy code example"]').count() > 12);
    const details = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Complete scripts/' }) });
    assert(await details.count() > 3, 'complete inherited scripts are included');
    await details.first().locator('summary').click();
    await details.first().locator('.code-frame').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('details[open]')].some(d => d.querySelector('.cm-editor')));
    const link = page.locator('a[href$="source.zip"]').first();
    const archive = await page.request.get(new URL(await link.getAttribute('href'), page.url()).href);
    assert.equal(archive.status(), 200);assert.equal((await archive.body()).subarray(0,2).toString(),'PK');
    await page.locator('figure.shot img').evaluateAll(imgs => Promise.all(imgs.map(i => { i.loading='eager';return i.decode(); })));
    await frames.first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`/tmp/${slug}-codemirror.png`});
    console.log(slug, 'CodeMirror, Copy controls, full-source disclosure, screenshot and source download OK');
  }, {path:`/nord/tutorials/${slug}.html`});
  assert.deepEqual(errors, []);
}
