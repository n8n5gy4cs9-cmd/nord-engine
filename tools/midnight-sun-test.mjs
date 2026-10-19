#!/usr/bin/env node
// Headless test for the Midnight Sun Tour example: loads scripts/game/*.js through the real CommonJS loader with stubbed
// Draw2D/Input/Audio, checks the tycoon rules, then fuzzes the whole game (random key presses) for N frames looking for exceptions.
// usage: node tools/midnight-sun-test.mjs [frames=40000] [seed=1]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadModules } from './examples/midnight-sun-tour/scripts/nordscrap/compat.js';
import { ROOT } from './examples/lib.mjs';

const dir = path.join(ROOT, 'tools/examples/midnight-sun-tour/scripts/game');
const assetConstants=fs.readFileSync(path.join(dir,'game_constants.js'),'utf8');
for(const [,asset] of assetConstants.matchAll(/"(assets\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(ROOT,'tools/examples/midnight-sun-tour',asset)),'referenced asset exists: '+asset);
const frames = Number(process.argv[2] ?? 40000);
let seed = Number(process.argv[3] ?? 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
globalThis.fetch = async (url) => { const f = path.join(ROOT, 'tools/examples/midnight-sun-tour', url); return fs.existsSync(f) ? { ok: true, status: 200, text: async () => fs.readFileSync(f, 'utf8') } : { ok: false, status: 404 }; };

const down = new Set(), held = new Set();
const norm = (n) => String(n).toLowerCase();
const noop = () => {};
const store = new Map();
const music = new Set(), musicEvents=[];
const painted=new Set();
const globals = {
  Math: Object.assign(Object.create(Math), { random: rnd }),
  Draw2D: { drawRegion: (x,y,w,h,asset) => painted.add(asset), fillRect: noop, drawRect: noop, drawCircle: noop, drawLine: noop, drawImage: noop, drawText: noop, drawTextAligned: noop, measureText: (t) => String(t).length * 5 },
  Input: { getKey: (n) => held.has(norm(n)), getKeyDown: (n) => down.has(norm(n)), getKeyUp: () => false },
  Audio: { play: noop, playMusic: (p) => {music.add(p);musicEvents.push(p);}, stopMusic: noop },
  Scene: { getSceneName: () => 'Title Screen', load: noop }, Screen: { getWidth: () => 640, getHeight: () => 360, getPlatform: () => 'web' },
  Time: { getTime: () => performance.now() / 1000 }, Camera: { getPrimary: () => 1, getClearColor: () => ({ r: 0, g: 0, b: 0, a: 1 }), setClearColor: noop },
  Style: { addEffect: noop, configure: noop }, GameObject: { findByTag: () => 1, destroy: noop },
  Model3D: { createPrimitive: () => 1, setColor: noop, render: noop }, Transform: { setPosition: noop, setRotation: noop, setScale: noop },
  SaveLoad: { save: (k, v) => store.set(k, JSON.stringify(v)), load: (k) => (store.has(k) ? JSON.parse(store.get(k)) : null), exists: (k) => store.has(k), delete: (k) => store.delete(k) },
};
const modules = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
const host = fs.readFileSync(path.join(ROOT, 'tools/examples/midnight-sun-tour/scripts/midnight_sun_tour.js'), 'utf8');
const listed = [...host.match(/const MODULES = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.deepEqual([...listed].sort(), [...modules].sort(), 'MODULES list in midnight_sun_tour.js must match scripts/game/*.js');
const require = await loadModules('scripts/game', modules, globals);
const Tycoon = require('mg_tycoon');
const Game = require('midnight_sun');

// ---- tycoon rules ----
const mk = () => ({ resources: { cash: 1000, food: 5, morale: 70, hype: 20 }, bus: { gas: 50, max_gas: 80, condition: 100 }, band: [{ present: true }, { present: true }, { present: false }], inventory: [{ id: 'merch_box' }], journey: { day: 1 } });
{
  const gs = mk(); Tycoon.ensure(gs);
  assert.equal(Tycoon.stockCapacity(gs), 80);
  gs.inventory = []; assert.equal(Tycoon.stockCapacity(gs), 24);
  Tycoon.open(gs, { id: 'x', name: 'X', services: ['mechanic'], gig_available: true, gig_fee_max: 600 });
  Tycoon.buyUpgrade(Tycoon.UPGRADES[0]); assert.equal(Tycoon.level(gs, 'engine'), 1); assert.equal(gs.resources.cash, 700);
  assert.ok(Math.abs(Tycoon.gasMul(gs) - 0.88) < 1e-9);
  Tycoon.buyUpgrade(Tycoon.UPGRADES[2]); assert.equal(gs.bus.max_gas, 100);
  Tycoon.buyStock(Tycoon.MERCH[0]); assert.equal(gs.tycoon.merch.shirts, 10);
  const before = gs.resources.cash;
  const r = Tycoon.afterGig(gs, { gig_fee_max: 600 }, 0.9, 400);
  assert.ok(r.revenue > 0 && gs.resources.cash === before + r.revenue, 'merch sells after a good gig');
  assert.ok(gs.tycoon.fame > 0 && gs.tycoon.income.gigs === 400);
  gs.resources.cash = 5; Tycoon.onLeg(gs); assert.equal(gs.resources.cash, 0); assert.ok(gs.resources.morale < 70, 'unpaid wages hurt morale');
  gs.tycoon.merch.records = 5; const f = Tycoon.festivalMerch(gs); assert.ok(f.revenue >= 5 * 55);
  assert.equal(Tycoon.ensure({ resources: { cash: 1 } }).fame, 0, 'old saves get tycoon state');
}

// Results must be presentation only; the orchestrator owns rewards.
{
  const gs = mk(), runner = require('mg_runner');
  runner.start(gs); runner.phase = 'results'; runner.dead = true;
  const before = JSON.stringify(gs);
  for (let i = 0; i < 120; i++) runner.draw(640, 360);
  assert.equal(JSON.stringify(gs), before, 'waiting on runner results must not change resources');
  for (const [name, fields] of [['mg_fuel', {totalFuel: 10}], ['mg_space', {score: 100}], ['mg_race', {playerAhead: true}], ['mg_kickoff', {}], ['mg_tent', {tentProgress: 1}]]) {
    const m = require(name); m.start(gs); Object.assign(m, fields, {phase: 'results'});
    const snapshot = JSON.stringify(gs); down.add('return'); m.update(1 / 60); down.clear();
    assert.equal(JSON.stringify(gs), snapshot, name + ' must return rewards without applying them twice');
  }
}

// ---- fuzz the full game ----
const game = new Game();
game.onStart();
down.add('return');game.onUpdate(1/60);down.clear();
const baseline=JSON.parse(JSON.stringify(game.state.game));
// Play the rewritten runner with a simple look-ahead jump policy: the complete course must be reachable.
{
 const r=require('mg_runner');r.start(structuredClone(baseline));r.phase='running';
 for(let frame=0;frame<6000&&r.phase!=='results';frame++){
  down.clear();
  if(r.onGround&&r.obstacles.some(o=>!o.hit&&o.x>100&&o.x<145))down.add('space');
  r.update(1/60);r.draw(640,360);
 }
 down.clear();assert.equal(r.phase,'results');assert.equal(r.dead,false,'runner course must be completable');assert.ok(r.distance>=500);
}
// Each formerly legacy view must actually consume the new artwork, not just ship unused PNGs.
for(const name of ['mg_gearpack','mg_moosedodge','mg_fuel','mg_soundcheck','mg_gig','mg_tent','mg_trail','mg_race','mg_night','mg_space','mg_starfox']){
 const m=require(name),gs=structuredClone(baseline),city={id:'test',name:'Test',gig_fee_min:200,gig_fee_max:500};
 if(name==='mg_gig')m.start(gs,city,1,1);else if(name==='mg_gearpack')m.start(gs,baseline.inventory);else m.start(gs,city);
 painted.clear();m.draw(640,360);
 assert.ok([...painted].some(p=>p.includes('retro_')),name+' uses new native-pixel artwork');
 if(name==='mg_moosedodge')assert.ok(painted.has('assets/sprites/retro_objects.png'),'bus and wildlife art is wired into Moose Run');
}
// The two reported games must be playable successfully without cheats.
{
 const m=require('mg_moosedodge'),gs=structuredClone(baseline);m.start(gs,{});m.phase='playing';
 for(let frame=0;frame<1500&&m.phase!=='results';frame++){
  down.clear();held.clear();
  const danger=m.obstacles.filter(o=>o.y>130&&o.y<315&&!o.hit);
  if(danger.some(o=>o.lane===m.lane)){
   const safe=[0,1,2].filter(l=>!danger.some(o=>o.lane===l)).sort((a,b)=>Math.abs(a-m.lane)-Math.abs(b-m.lane))[0];
   const crossingBlocked=m.obstacles.some(o=>o.y>220&&o.y<315&&!o.hit&&o.lane>=Math.min(safe,m.lane)&&o.lane<=Math.max(safe,m.lane));
   if(!crossingBlocked){if(safe<m.lane)held.add('left');if(safe>m.lane)held.add('right');}
  }
  m.update(1/60);
 }
 assert.equal(m.phase,'results');assert.equal(m.hits,0,'telegraphed hazards always leave a reachable safe lane');
 const f=require('mg_fuel');f.start(gs);f.phase='pumping';
 for(let frame=0;frame<6000&&f.phase!=='results';frame++){
  down.clear();held.clear();const next=f.needle+f.direction*f.speed/60;
  if(f.phase==='pumping'&&Math.abs(next-f.target)<0.012)down.add('space');f.update(1/60);
 }
 assert.equal(f.phase,'results');assert.equal(f.perfectCount,5);assert.ok(f.totalFuel>=70,'accurate pump stops earn a full-sized refill');
 down.clear();held.clear();
}
// Countersteering and acceleration can beat the rival without setting progress or money.
{
 const m=require('mg_race');m.start(structuredClone(baseline));m.phase='playing';
 for(let frame=0;frame<3000&&m.phase!=='results';frame++){
  held.clear();held.add('up');if(m.offset>4)held.add('left');if(m.offset<-4)held.add('right');m.update(1/60);
 }
 assert.equal(m.phase,'results');assert.equal(m.playerAhead,true,'a clean driving policy can win both laps');held.clear();
}
// Play the complete published note chart through its real input/update path.
{
 const m=require('mg_gig'),gs=structuredClone(baseline);m.start(gs,{id:'test',name:'Test stage',gig_fee_min:200,gig_fee_max:500},1,1);m.phase='performance';
 for(let frame=0;frame<1400&&m.phase!=='results';frame++){
  down.clear();for(const p of m.prompts)if(p.result==='none'&&Math.abs(p.time-(m.timer+1/60))<1/120)down.add(p.key);
  m.handleInput(1/60);
 }
 assert.equal(m.phase,'results');assert.equal(m.score,m.maxScore,'every note can be hit at its displayed crossing time');
 const after=JSON.stringify(gs);for(let i=0;i<120;i++)m.draw(640,360);assert.equal(JSON.stringify(gs),after,'stage/results rendering never pays twice');down.clear();
}
// Customers follow a connected path network, buy services, queue and leave at closing.
{
 const v=require('festival_visitors'), facilities={food:2,toilets:2,merch:2,stage:1,camp:1};
 const a=v.create(100,1991),b=v.create(100,1991);
 for(let i=0;i<7200;i++){
  if(i===6000){a.closing=true;b.closing=true;}
  v.update(a,1/30,facilities,true);v.update(b,1/30,facilities,true);
  for(const p of a.agents){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=60&&p.x<=560&&p.y>=145&&p.y<=240);}
 }
 assert.equal(JSON.stringify(a),JSON.stringify(b),'same seed and inputs reproduce customer traffic');
 assert.equal(a.agents.length,60);assert.ok(a.served>0&&a.income>0,'customers actually purchase services');assert.ok(a.exited>0,'customers leave through gate at closing');
 const empty=v.create(40,1991);for(let i=0;i<3600;i++)v.update(empty,1/30,{food:0,toilets:0,merch:0,stage:0,camp:0},true);
 assert.equal(empty.income,0);assert.ok(empty.lost>0,'closed facilities cause abandoned queues');
}
// Festival accounting and all three management days through real input transitions.
{
 const f=require('mg_festival'), gs=structuredClone(baseline);gs.resources.cash=15000;f.start(gs);
 const press=k=>{down.clear();down.add(k);f.update(1/30);down.clear();};
 for(let i=0;i<5;i++)press('enter');
 assert.equal(f.state.phase,'book');
 // Combined affordability must include the current selection.
 press('g');assert.equal(f.state.phase,'grounds');
 const funds=f.state.budget;press('return');
 assert.equal(f.state.facilities.food,1);assert.equal(f.state.budget,funds-600);
 f.state.budget=0;press('return');assert.equal(f.state.facilities.food,1,'unaffordable upgrade rejected');
 press('escape');assert.equal(f.state.phase,'book');
 const available=f.state.offered;f.state.budget=available[0].cost;f.state.selected=[0];f.state.cursor=1;
 press('enter');assert.deepEqual(f.state.selected,[0],'cannot overbook the combined festival budget');
 f.state.budget=15000;f.state.selected=[];
 for(let day=1;day<=3;day++){
  const start=f.state.budget;f.state.cursor=0;press('enter');
  const cost=f.state.offered[0].cost;f.state.cursor=f.state.offered.length;press('enter');
  assert.equal(f.state.phase,'staff');assert.equal(f.state.budget,start-cost);
  press('tab');press('enter');assert.equal(f.state.phase,'simulate');
  const expense=f.state.dayCosts;
  assert.equal(musicEvents.at(-1),f.state.dayLineup[0].music,'booked artist recording starts with its set');
  press('n');assert.equal(musicEvents.at(-1),require('game_constants').MUSIC.GIG,'Mikko set replaces the booked artist recording');
  for(let i=0;i<Math.ceil(f.state.simDuration*30);i++)f.update(1/30);
  assert.equal(f.state.phase,'report');assert.equal(f.state.budget,start+f.state.dayRevenue-expense,'acts charged exactly once');
  press('enter');
 }
 assert.equal(f.state.phase,'results');assert.ok(Number.isFinite(f.state.finalScore));assert.equal(f.state.facilities.food,1,'facilities persist across all three days');
}
// Construction remains interactive while the live crowd and artist schedule continue.
{
 const f=require('mg_festival'),gs=structuredClone(baseline);gs.resources.cash=10000;f.start(gs);f.cheat('simulate',1,false);
 const press=k=>{down.clear();down.add(k);f.update(1/30);down.clear();};
 press('g');assert.equal(f.state.phase,'grounds');f.state.buildCursor=2;
 const funds=f.state.budget,costs=f.state.dayCosts,time=f.state.simTimer;
 press('return');assert.equal(f.state.phase,'grounds','building must not close the festival day');
 assert.equal(f.state.budget,funds-750);assert.equal(f.state.dayCosts,costs+60,'new live facility incurs one daily upkeep');
 for(let i=0;i<60;i++)f.update(1/30);
 assert.ok(f.state.simTimer>time&&f.state.visitors.agents.length>0,'crowd and schedule continue during construction');
 press('g');assert.equal(f.state.phase,'simulate');
}
// Every activity gets its own real start/update/draw loop, rather than relying on random menu coverage.
const trials=['mg_jobs','mg_kickoff','mg_space','mg_trail','mg_race','mg_tent','mg_fuel','mg_night','mg_starfox','mg_soundcheck','mg_gig','mg_moosedodge','mg_festival'];
for(const name of trials){
 const m=require(name), gs=structuredClone(baseline),city={id:'test',name:'Test venue',gig_fee_min:200,gig_fee_max:500};
 if(name==='mg_moosedodge')m.start(gs,{road_type:'highway',distance_km:120,hazard_rate:0.3});
 else if(name==='mg_gig')m.start(gs,city,1,1);
 else if(name==='mg_jobs')m.start(gs,1);
 else m.start(gs,city);
 for(let frame=0;frame<6000;frame++){
  down.clear();held.clear();
  if(frame%30===0)down.add('return');
  if(frame%11===0)down.add('space');
  if(frame%80<40)held.add('right');else held.add('left');
  if(frame%17===0)down.add('1');
  const result=m.update?m.update(1/30):m.handleInput(1/30);m.draw(640,360);
  for(const [key,v] of Object.entries(gs.resources))assert.ok(Number.isFinite(v),name+' finite '+key);
  assert.ok(gs.resources.food>=0&&gs.resources.food<=10,name+' consistent food scale');
  if(result&&result.done)break;
 }
}
down.clear();held.clear();
{
 game.command('new');game.command('god on');game.command('rich');game.command('gear');
 for(const destination of ['gearpack','soundcheck','gig','moosedodge','kickoff','space','trail','race','tent','fuel','runner','night','starfox','delivery','harbor','festival']){
  game.command('goto '+destination);game.onUpdate(1/30);game.command('win');game.onUpdate(1/30);down.add('return');game.onUpdate(1/30);down.clear();
  assert.ok(Number.isFinite(game.state.game.resources.cash),'cheat result remains finite: '+destination);
 }
 for(const phase of ['intro','book','grounds','staff','simulate','report','results']){
  game.command('festival '+phase+' 2');game.onUpdate(1/30);assert.equal(game.state.scene,'festival');
 }
 game.command('city tampere');game.command('save');game.command('city turku');game.command('load');
 assert.equal(game.state.game.journey.current_city,'tampere');assert.equal(game.state.scene,'overworld');
 game.command('set condition 0');game.onUpdate(1/30);assert.equal(game.state.game.bus.condition,100,'god protects bus');
 game.command('god off');game.command('freeze on');game.command('set days 10');game.state.game.journey.days_until_festival=2;game.onUpdate(1/30);assert.equal(game.state.game.journey.days_until_festival,10);
 game.command('freeze off');
 assert.throws(()=>game.command('set cash nan'));
 assert.throws(()=>game.command('goto arbitrary'));
 assert.throws(()=>game.command('eval alert(1)'));
 game.command('new');
}
down.clear();held.clear();
// Drive every real road leg, resolving encounters/minigames with the documented win cheat.
{
 game.command('new');game.command('god on');game.command('gear');
 const itinerary=['kajaani','iisalmi','kuopio','jyvaskyla','tampere','hameenlinna','turku'];
 for(let leg=0;leg<itinerary.length;leg++){
  game.command('goto overworld');game.onUpdate(1/30);
  if(leg>0){down.add('down');game.onUpdate(1/30);down.clear();}
  down.add('return');game.onUpdate(1/30);down.clear();
  for(let frame=0;frame<1200;frame++){
   const scene=game.state.scene;
   if(scene==='city'||scene==='festival')break;
   if(!['overworld','encounter'].includes(scene))game.command('win');
   if(frame%20===0)down.add('return');
   game.onUpdate(1/30);down.clear();
  }
  assert.equal(game.state.game.journey.current_city,itinerary[leg],'real bus route reaches '+itinerary[leg]);
 }
 assert.equal(game.state.scene,'festival');assert.equal(game.state.game.journey.km_traveled,850);
 game.command('god off');game.command('new');
}
const keys = ['return', 'return', 'space', 'escape', 'up', 'down', 'left', 'right', 'w', 'a', 's', 'd', 'tab', 'r', 'q', 'e', 'x', 'z', '1', '2', '3', '4', '5', '6', 'o'];
const seen = new Set();
const log = console.log; console.log = noop;
try {
  for (let i = 0; i < frames; i++) {
    down.clear();
    if (rnd() < 0.35) { const k = keys[Math.floor(rnd() * keys.length)]; down.add(k); held.add(k); }
    if (rnd() < 0.2) held.clear();
    game.onUpdate(1 / 30);
    if (i % 500 === 0) seen.add(globalThis.__scene);
  }
} catch (e) { console.log = log; console.error(`FUZZ FAILED:`, e); process.exit(1); }
console.log = log;
console.log(`ok: tycoon rules + ${frames} fuzzed frames, ${modules.length} modules, ${music.size} distinct music tracks reached: ${[...music].map((m) => m.split('/').pop().replace('.mp3', '')).join(' ')}`);
