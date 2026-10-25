#!/usr/bin/env node
// Execute the exact beginner documentation files with real core types and a small physics/input fixture.
// Checks arithmetic and callback handoff; collision/backend integration is covered by the engine suites.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as nord from '../../runtime/core/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') + path.sep;
const compile=code=>new Function('nord',code.replace(/import \{([^}]+)\} from 'nord';/g,(_,x)=>'const {'+x.replace(/(\w+) as (\w+)/g,'$1: $2')+'} = nord;').replace('export default class','return class'))(nord);
const blocks=file=>[...fs.readFileSync(root+'docs/manual-src/'+file,'utf8').matchAll(/```js\n([\s\S]*?)```/g)].map(m=>m[1]);
let velocity=[0,30], grounded=true;
const down=new Set();
const game={project:{type:'2d',input:{}},time:{delta:.5,elapsed:1},log:()=>{},input:{actions:{jump:['Space']},key:k=>down.has(k),stick:[0,0],pressed:a=>a==='jump'&&down.has('Space')},physics:{velocity:()=>velocity,setVelocity:(_e,x,y)=>{velocity=[x,y]},isGrounded:()=>grounded}};
const old=nord.Game.current;nord.Game.current=game;
const entity=()=>new nord.Entity({id:'test',name:'Test'},{game,backend:{}});
try{
 const [Walk2,Body,Walk3]=blocks('ex-input-movement.md').map(compile);
 down.add('KeyD');let e=entity();new Walk2(e,{speed:200}).Update();assert.equal(e.pos[0],100);
 down.add('KeyW');e=entity();new Walk2(e,{speed:200}).Update();assert.ok(Math.abs(Math.hypot(e.pos[0],e.pos[1])-100)<1e-9);assert.ok(e.pos[1]<0);
 game.project.type='3d';e=entity();new Walk3(e,{speed:5}).Update();assert.ok(Math.abs(Math.hypot(e.pos[0],e.pos[2])-2.5)<1e-9);assert.ok(e.pos[2]<0);
 game.project.type='2d';down.clear();down.add('KeyD');e=entity();e.getComponent=type=>type==='rigidbody'?{type,data:{mode:'dynamic'}}:null;
 const body=new Body(e,{speed:200,jumpSpeed:420});body.Start();body.FixedUpdate();assert.deepEqual(velocity,[200,30]);
 down.add('Space');body.Update();down.delete('Space');body.FixedUpdate();assert.deepEqual(velocity,[200,-420]);assert.equal(body.jumpRequested,false);
 grounded=false;down.add('Space');body.Update();velocity=[0,15];body.FixedUpdate();assert.deepEqual(velocity,[200,15]);
 const Player=compile(blocks('37-unity-scripting.md')[0]);down.clear();down.add('KeyD');e=entity();const player=new Player(e,{speed:200});player.Start();player.Update();assert.equal(e.pos[0],100);assert.equal(e.enabled,true);
 const Spin=compile(blocks('ex-first-script.md')[0]);e=entity();new Spin(e,{speed:90}).Update();assert.equal(e.rot[2],45);
 console.log('PASS: exact documented Player/Spin/2D/3D movement files; diagonal limits, direction, velocity preservation, queued grounded jump and airborne rejection');
}finally{nord.Game.current=old;}
