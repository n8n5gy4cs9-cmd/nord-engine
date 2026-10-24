#!/usr/bin/env node
// Screenshots (and a smoke run) of the example projects used by the Examples pages: docs/screenshots/ex-<project>-*.png.
//   NORD_BROWSER=/path/to/chromium-family-browser node tools/example-shots.mjs [coin-dash|jump-dash|star-shooter]
// Starts `nord serve` itself (target/debug/nord or NORD_BIN), drives the game through window.__nord in a headless browser.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './e2e-lib.mjs';
import { launch, sleep } from './cdp-lib.mjs';

const nord = process.env.NORD_BIN ?? ['target/release/nord', 'target/debug/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
if (!nord) throw new Error('build the CLI first: cargo build -p nord-cli');
const PRE = `const g=window.__nord;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const gm=()=>[...g.scene.all()].find(e=>e.name==='GameManager').scripts[0];const P=()=>g.scene.find('Player');`;

const SCENES = {
  'coin-dash': async (page, shot) => {
    await page.eval(`(async()=>{${PRE}for(let i=0;i<8;i++){await g.scene.spawn('prefabs/coin.prefab.json',{pos:[120+i*95,120+(i%3)*110,1]});}await g.scene.spawn('prefabs/enemy.prefab.json',{pos:[820,420,2]});await g.scene.spawn('prefabs/enemy.prefab.json',{pos:[150,430,2]});const c=g.scene.findByTag('coin')[0];P().pos=[c.pos[0]+4,c.pos[1],5];await sleep(400);gm().AddScore(4);})()`);
    await shot('play');
    await page.eval(`(()=>{${PRE}gm().AddScore(6);gm().SetLives(0);})()`);
    await sleep(600); await shot('over');
  },
  'jump-dash': async (page, shot) => {
    const R = (js) => page.eval(`(async()=>{${PRE}${js}})()`);
    await R(`P().pos=[1100,470,5];await sleep(2200);`); await shot('play');
    await R(`const goal=g.scene.findByTag('goal')[0];P().pos=[goal.pos[0],goal.pos[1],5];await sleep(900);`); await shot('won');
  },
  'star-shooter': async (page, shot) => {
    const R = (js) => page.eval(`(async()=>{${PRE}${js}})()`);
    // auto-play: aim at the nearest enemy and fire until bullets, enemies and an explosion are on screen
    await R(`g.input.setKey('Space',true);let best=0;for(let i=0;i<120;i++){const en=g.scene.findByTag('enemy');if(en[0]){g.input.pointer.worldX=en[0].pos[0];g.input.pointer.worldY=en[0].pos[1];}const b=g.scene.findByTag('bullet').filter(e=>e.enabled).length,f=g.scene.findByTag('fx').length;if(en.length>=2&&b>=2&&f>=1)break;await sleep(120);}`);
    await shot('play');
    await R(`g.input.setKey('Space',false);P().emit('damage',{amount:99});await sleep(900);`); await shot('over');
  },
};

const only = process.argv[2];
let port = 4180;
for (const name of Object.keys(SCENES)) {
  if (only && only !== name) continue;
  const server = spawn(nord, ['serve', path.join(ROOT, 'examples', name), '-p', String(port)], { stdio: 'ignore' });
  await sleep(1800);
  const page = await launch({ port: port + 100 });
  try {
    await page.goto(`http://localhost:${port}/`, 3500);
    const errs = await page.eval('window.__nord_error ?? null'); if (errs) throw new Error(name + ': ' + errs);
    await SCENES[name](page, (n) => page.shot(path.join(ROOT, 'docs/screenshots', `ex-${name}-${n}.png`)));
    const bad = await page.eval('window.__nord.errors.map((e)=>String(e.err))'); if (bad.length) throw new Error(`${name}: script errors: ${bad.slice(0, 3).join(' | ')}`);
    console.log(name, 'ok');
  } finally { page.close(); server.kill(); }
  port++;
}
