#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withPage,waitReady,ROOT} from './e2e-lib.mjs';
fs.mkdirSync(`${ROOT}/docs/screenshots`,{recursive:true});
const {errors,result}=await withPage((process.argv[2] ?? `${ROOT}/examples/midnight-sun-tour`),async page=>{
 await waitReady(page);
 await page.waitForFunction(()=>window.__nord_msTour);
 if(await page.locator('[data-nord-start-gate]').count())await page.mouse.click(480,270);
 await page.waitForTimeout(400);
 const shot=async name=>page.screenshot({path:`${ROOT}/docs/screenshots/midnight-sun-${name}.png`});
 await shot('title');
 await page.keyboard.press('Enter');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.__nord_msTour.state.scene),'gearpack');await shot('packing');
 const launch=async index=>{
  await page.keyboard.press('o');await page.waitForTimeout(60);
  assert.equal(await page.evaluate(()=>window.__nord_msTour.state.scene),'cheat');
  for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');await page.waitForTimeout(100);
 };
 // Launch through the same arcade directory used by players.
 for(const [index,name] of [[0,'delivery'],[1,'harbor'],[9,'runner'],[3,'shootout'],[4,'space'],[11,'mixer'],[12,'gig'],[15,'festival']]){
  await launch(index);await shot(name+'-ready');
  await page.keyboard.press('Enter');await page.waitForTimeout(150);
  if(name==='gig')await page.evaluate(()=>{for(let i=0;i<70;i++)window.__nord_msTour.onUpdate(0.1);});
  await shot(name);
  assert.equal(await page.evaluate(()=>window.__nord_error??null),null);
 }
 await page.keyboard.press('p');assert.equal(await page.evaluate(()=>window.__nord_msTour.state.paused),true);
 await page.keyboard.press('p');assert.equal(await page.evaluate(()=>window.__nord_msTour.state.paused),false);
 // Console remains empty, consumes typing and freezes the canvas while open.
 await page.keyboard.press('F2');
 const input=page.locator('[data-tour-console] input'),log=page.locator('[data-tour-console] pre');
 assert.equal(await log.textContent(),'');
 await input.pressSequentially('state');assert.equal(await input.inputValue(),'state');await input.fill('');
 const frozen=await page.locator('canvas').last().evaluate(c=>c.toDataURL());
 await page.waitForTimeout(250);assert.equal(await page.locator('canvas').last().evaluate(c=>c.toDataURL()),frozen);
 const command=async text=>{await input.fill(text);await input.press('Enter');};
 await command('god on');await command('rich');await command('city tampere');await command('save');
 await command('city turku');await command('load');
 assert.equal(await page.evaluate(()=>window.__nord_msTour.state.game.journey.current_city),'tampere');
 await command('city kajaani');await page.keyboard.press('F2');await page.waitForTimeout(250);await shot('city');
 await page.keyboard.press('F2');await command('goto overworld');await page.keyboard.press('F2');await page.waitForTimeout(200);await shot('map');
 for(const [cmd,name] of [['festival book 1','booking'],['festival grounds 1','grounds'],['festival staff 1','staff'],['festival simulate 1','festival-live'],['festival report 1','report'],['festival results 3','ending']]){
  await page.keyboard.press('F2');await command(cmd);await page.keyboard.press('F2');await page.waitForTimeout(250);await shot(name);
  assert.equal(await page.evaluate(()=>window.__nord_error??null),null);
 }
 // Build services, book an actual artist, and watch real customers move and spend.
 await page.keyboard.press('F2');await command('festival grounds 1');await page.keyboard.press('F2');await page.waitForTimeout(80);
 await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await page.keyboard.press('g');await page.keyboard.press('Enter');
 for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__nord_msTour.state.festival.phase),'simulate');
 assert.ok(await page.evaluate(()=>window.__nord_msTour.state.festival.dayLineup[0].music.includes('band_music')));
 await page.evaluate(()=>{for(let i=0;i<600;i++)window.__nord_msTour.onUpdate(0.1);});
 assert.ok(await page.evaluate(()=>window.__nord_msTour.state.festival.visitors.served>0));
 assert.ok(await page.evaluate(()=>window.__nord_msTour.state.festival.stallRevenue>0));
 const before=await page.evaluate(()=>JSON.stringify(window.__nord_msTour.state.festival.visitors.agents.map(a=>[a.x,a.y])));
 await page.waitForTimeout(350);
 const after=await page.evaluate(()=>JSON.stringify(window.__nord_msTour.state.festival.visitors.agents.map(a=>[a.x,a.y])));
 assert.notEqual(after,before,'AI customers walk while the artist plays');await shot('customers');
 await page.keyboard.press('F2');await command('city kajaani');await command('goto harbor');await command('win');await page.keyboard.press('F2');
 await page.keyboard.press('Enter');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__nord_msTour.state.scene),'city');
 await page.keyboard.press('F2');await command('goto runner');await command('win');await page.keyboard.press('F2');await page.keyboard.press('Enter');
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__nord_msTour.state.scene),'city');
 // Decode every retained artist recording in the real browser audio engine.
 const tracks=['queen_live','bjm_live','aldous_harding_live','burial_dj_set','islaja_live','karhumauri_live'];
 for(const track of tracks){
  const duration=await page.evaluate(async track=>{
   const ctx=new AudioContext();try{const data=await fetch('assets/music/band_music/'+track+'.mp3').then(r=>r.arrayBuffer());return (await ctx.decodeAudioData(data)).duration;}finally{await ctx.close();}
  },track);assert.ok(duration>1,track+' decodes');
 }
 return await page.evaluate(()=>window.__nord.errors.map(e=>e.err?.message));
},{viewport:{width:1280,height:720}});
assert.deepEqual(errors,[]);assert.deepEqual(result,[]);
console.log('PASS real keyboard arcade navigation, new jobs, art loading, pause, private console, checkpoint round trip, manager phases, artist audio decoding and screenshots; external requests blocked');
