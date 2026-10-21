import assert from 'node:assert/strict';
import {withPage,waitReady,loadPlaywright,ROOT} from './e2e-lib.mjs';
if(process.env.PW_CHROMIUM){const{chromium}=loadPlaywright(),launch=chromium.launch.bind(chromium);chromium.launch=o=>launch({...o,executablePath:process.env.PW_CHROMIUM});}
const projects=process.env.NORD_RETRO_PROJECTS??`${ROOT}/examples`;
{
 const{errors}=await withPage(`${projects}/coastline-sprint`,async page=>{
  await page.addInitScript(()=>{window.__testPad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>window.__testPad?[window.__testPad]:[]});});await page.reload();await waitReady(page);
  await page.getByRole('button',{name:'1 player',exact:true}).click();await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>window.__coast.players[0].speed>1000);await page.keyboard.up('KeyW');
  await page.getByRole('button',{name:'Pause / Resume',exact:true}).click();const z=await page.evaluate(()=>window.__coast.players[0].z);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__coast.players[0].z),z);await page.getByRole('button',{name:'Pause / Resume',exact:true}).click();
  await page.evaluate(()=>window.__testPad={id:'Standard test pad',connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))});
  await page.getByRole('button',{name:'2 player split',exact:true}).click();await page.waitForTimeout(150);
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__coast.players[0].z>100);await page.keyboard.up('KeyW');assert.equal(await page.evaluate(()=>window.__coast.players[1].z),0);
  await page.evaluate(()=>{window.__testPad.axes[0]=.6;window.__testPad.buttons[7]={value:1,pressed:true};});await page.waitForFunction(()=>window.__coast.players[1].z>100);
  assert(await page.evaluate(()=>window.__coast.players[1].x>.3));
  await page.waitForFunction(()=>window.__coast.sound.ctx?.state==='running'&&window.__coast.sound.cache.size>=2);
  await page.screenshot({path:`${ROOT}/docs/screenshots/ed-retro-coast-split.png`});
  await page.evaluate(()=>window.__testPad=null);await page.waitForFunction(()=>window.__coast.paused);await page.evaluate(()=>window.__testPad={id:'Reconnected test pad',connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))});await page.getByRole('button',{name:'Pause / Resume',exact:true}).click();await page.waitForFunction(()=>!window.__coast.paused);
  await page.getByRole('button',{name:'1 player',exact:true}).click();await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__coast.players[0].speed>1300);await page.keyboard.up('KeyW');
  await page.evaluate(()=>{const p=window.__coast.players[0];p.z=45000;p.speed=4200;p.x=0;});await page.waitForTimeout(100);await page.screenshot({path:`${ROOT}/docs/screenshots/ed-retro-coast-curve.png`});
  await page.evaluate(()=>{const p=window.__coast.players[0];p.z=179999;p.speed=3000;});await page.waitForFunction(()=>window.__coast.players[0].finished);
  await page.getByRole('button',{name:'Restart',exact:true}).click();assert.equal(await page.evaluate(()=>window.__coast.players[0].finished),false);
  await page.screenshot({path:`${ROOT}/docs/screenshots/ed-retro-coast-solo.png`});assert.equal(await page.evaluate(()=>window.__coast.sound.problem),'');
 });assert.deepEqual(errors,[]);console.log('Coast: real keyboard, independent synthetic gamepad/split, disconnect pause, decoded audio, finish/retry OK');
}
{
 const{errors}=await withPage(`${projects}/vector-patrol`,async page=>{
  await waitReady(page);await page.waitForTimeout(700);
  const read=()=>page.evaluate(()=>{const f=window.__nord.scene.find('FlightGame').scripts[0];return {hp:f.state.hp,score:f.state.score,won:f.state.won,time:f.state.time,materials:f.view.materials.size,retro:f.view.retro};});
  assert((await read()).materials>=5,'imported GLB palette survives Nord model loading');
  assert.deepEqual(await page.evaluate(()=>window.__nord.errors.map(e=>e.err.message)),[]);
  await page.getByRole('button',{name:'Launch patrol',exact:true}).click();await page.keyboard.down('Space');
  await page.evaluate(()=>{const f=window.__nord.scene.find('FlightGame').scripts[0];f.state.enemies=[{id:999,x:0,y:0,z:12,hp:1,fire:99}];});await page.waitForFunction(()=>window.__nord.scene.find('FlightGame').scripts[0].state.score>=100);await page.keyboard.up('Space');
  await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>window.__nord.scene.find('FlightGame').scripts[0].state.roll>2);await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('KeyC');await page.waitForFunction(()=>!window.__nord.scene.find('FlightGame').scripts[0].view.retro);await page.keyboard.up('KeyC');await page.waitForFunction(()=>!window.__nord.input.down('retro'));await page.keyboard.down('KeyC');await page.waitForFunction(()=>window.__nord.scene.find('FlightGame').scripts[0].view.retro);await page.keyboard.up('KeyC');
  await page.getByRole('button',{name:'Pause / Resume',exact:true}).click();const frozen=(await read()).time;await page.waitForTimeout(200);assert.equal((await read()).time,frozen);await page.getByRole('button',{name:'Pause / Resume',exact:true}).click();
  await page.evaluate(()=>{const f=window.__nord.scene.find('FlightGame').scripts[0];f.state.time=65;f.state.bossZ=55;f.state.roll=0;f.state.shield=0;f.state.enemies=[{id:22,x:-5,y:2,z:45,hp:2,fire:99},{id:23,x:6,y:1,z:65,hp:2,fire:99}];});await page.waitForTimeout(150);
  await page.screenshot({path:`${ROOT}/docs/screenshots/ed-retro-vector-boss.png`});
  await page.evaluate(()=>{const f=window.__nord.scene.find('FlightGame').scripts[0];f.state.bossHP=1;f.state.bossZ=48;});await page.keyboard.down('Space');await page.waitForFunction(()=>window.__nord.scene.find('FlightGame').scripts[0].state.won);await page.keyboard.up('Space');assert((await read()).score>=2500);
  await page.getByRole('button',{name:'Restart',exact:true}).click();await page.waitForTimeout(600);assert.equal((await read()).won,false);assert((await read()).materials>=5);
  await page.getByRole('button',{name:'Launch patrol',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:`${ROOT}/docs/screenshots/ed-retro-vector-flight.png`});
  assert.deepEqual(await page.evaluate(()=>window.__nord.errors.map(e=>e.err.message)),[]);assert.equal(await page.evaluate(()=>window.__nord.scene.find('FlightGame').scripts[0].sound.problem),'');
 });assert.deepEqual(errors,[]);console.log('Vector: Blocksmith palette, real firing hit, roll, PS1 toggle, pause, boss win/save, restart/audio OK');
}
