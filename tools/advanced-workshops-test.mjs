import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createVaultServer } from './examples/circuit-vault/src/server.mjs';
import { withPage, waitReady, loadPlaywright, nonBlank, ROOT } from './e2e-lib.mjs';
if(process.env.PW_CHROMIUM){const {chromium}=loadPlaywright(),launch=chromium.launch.bind(chromium);chromium.launch=o=>launch({...o,executablePath:process.env.PW_CHROMIUM});}
const projects=process.env.NORD_ADVANCED_PROJECTS ?? `${ROOT}/examples`;
const {errors}=await withPage(`${projects}/prism-relay`,async page=>{
  await waitReady(page);await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>window.__nord.errors.map(e=>e.err.message)),[]);
  assert(await page.evaluate(()=>{const g=window.__nord;return g.scene.find('PrismFX').scripts[0].material.isReady(g.scene.find('Start').getComponent('mesh').mesh);}),'GLSL compiles on actual GPU backend');
  await page.keyboard.down('KeyF');await page.waitForFunction(()=>window.__nord.scene.find('PrismFX').scripts[0].attrs.frequency===16);await page.keyboard.up('KeyF');
  await page.keyboard.down('KeyG');await page.waitForFunction(()=>window.__nord.scene.find('PrismFX').scripts[0].attrs.intensity===0.5);await page.keyboard.up('KeyG');
  const attrs=await page.evaluate(()=>window.__nord.scene.find('PrismFX').scripts[0].attrs);assert.equal(attrs.frequency,16);assert.equal(attrs.intensity,0.5);
  await page.keyboard.down('ShiftLeft');await page.waitForTimeout(250);await page.keyboard.up('ShiftLeft');
  assert(await page.evaluate(()=>window.__nord.scene.find('Player').scripts.find(s=>'energy'in s).energy<1));
  await page.screenshot({path:`${ROOT}/docs/screenshots/ed-advanced-prism-relay.png`});
  // Destroy/rebuild the actual shared ShaderMaterial without retaining the old resource.
  await page.evaluate(()=>window.__nord.restart());await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>window.__nord.errors.map(e=>e.err.message)),[]);
});assert.deepEqual(errors,[]);console.log('prism shader compile, controls, sprint and restart OK');
const server=createVaultServer({root:`${projects}/circuit-vault`,random:()=>0});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
try{
 const post=(route,body)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/server.mjs')).status,404);
 assert.equal((await fetch(base+'/api/board',{headers:{origin:'https://example.com'}})).status,403);
 const started=await (await post('/api/start',{name:'<b>Pilot</b>'})).json();
 assert.equal((await post('/api/step',{id:started.id,tile:9})).status,400);
 for(let round=1;round<=6;round++)for(let i=0;i<round;i++)assert.equal((await post('/api/step',{id:started.id,tile:0})).status,200);
 await post('/api/step',{id:started.id,tile:0});assert.equal((await (await fetch(base+'/api/board')).json()).board.length,1);
 const {errors}=await withPage(`${projects}/circuit-vault`,async page=>{
  await waitReady(page);await page.locator('#api').fill(base);await page.locator('#start').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Stage 1/6'));
  for(let round=1;round<=6;round++){
   for(let i=0;i<round;i++){await page.locator('[data-tile="0"]').click();await page.waitForTimeout(40);}
   if(round<6)await page.waitForFunction(r=>document.querySelector('#status').textContent.includes('Stage '+r+'/6'),round+1);
  }
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('VAULT OPEN'));
  assert.equal(await page.locator('#board b').count(),0,'leaderboard uses text, never player HTML');
  await page.screenshot({path:`${ROOT}/docs/screenshots/ed-advanced-circuit-vault.png`});
 });assert.deepEqual(errors,[]);console.log('Node HTTP validation, real cross-origin UI requests, six-stage win and leaderboard OK');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
if(process.env.NORD_SALVAGE_EXPORT){
 const {errors}=await withPage(process.env.NORD_SALVAGE_EXPORT,async page=>{
  await page.waitForTimeout(2000);await page.locator('canvas').click();
  await page.keyboard.down('KeyD');await page.waitForTimeout(300);await page.keyboard.up('KeyD');await page.keyboard.press('Space');
  const press=async key=>{await page.keyboard.down(key);await page.waitForTimeout(150);await page.keyboard.up(key);await page.waitForTimeout(100);};
  await press('KeyR');await press('KeyP');
  const frozen=await page.screenshot({clip:{x:120,y:0,width:700,height:45}});
  await page.waitForTimeout(1200);
  assert(frozen.equals(await page.screenshot({clip:{x:120,y:0,width:700,height:45}})),'WASM pause freezes the actual HUD clock');
  await press('KeyP');await press('KeyR');
  const shot=await page.screenshot({path:`${ROOT}/docs/screenshots/ed-advanced-rust-salvage.png`});
  assert(await nonBlank(page,shot)>8,'compiled game renders a nonblank arena');
 });assert.deepEqual(errors.filter(e=>!e.includes('register_plugin is not defined')),[]);console.log('Rust/WASM actual export boot and keyboard/dash/pause/restart OK');
}
if(process.argv.includes('--manual')) for(const [slug,lang] of [
 ['tut-t35-advanced-prism-shaders','glsl'],['tut-t36-advanced-node-vault','js'],['tut-t37-advanced-rust-wasm','rust']]){
 const {errors}=await withPage(`${ROOT}/docs/manual`,async page=>{
  assert(await page.locator('.code-frame').count()>8);
  const frame=page.locator('.code-frame').filter({has:page.locator('.code-bar span',{hasText:lang})}).first();
  await frame.scrollIntoViewIfNeeded();await frame.locator('.cm-editor').waitFor();
  const detail=page.locator('details').filter({has:page.locator('summary',{hasText:'Complete '})}).first();
  await detail.locator('summary').click();await detail.locator('.code-frame').scrollIntoViewIfNeeded();await detail.locator('.cm-editor').waitFor();
  const href=await page.locator('a[href$="source.zip"]').first().getAttribute('href');
  const archive=await page.request.get(new URL(href,page.url()).href);assert.equal(archive.status(),200);assert.equal((await archive.body()).subarray(0,2).toString(),'PK');
  await page.locator('figure.shot img').evaluateAll(imgs=>Promise.all(imgs.map(i=>{i.loading='eager';return i.decode();})));
  await frame.scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/${slug}-code.png`});
 },{path:`/nord/tutorials/${slug}.html`});assert.deepEqual(errors,[]);console.log(slug,'CodeMirror/full source/image/download OK');
}
