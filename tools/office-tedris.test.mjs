import test from 'node:test';
import assert from 'node:assert/strict';
import {newGrid,action,cells,fits,garbage,tickGrid} from './examples/jengatedris/src/rules.js';
import {newOffice,addPlayer,startShift,tickOffice,beginJob,jobStep,prank,pathTo,walkable,PUZZLES} from './examples/nord-office/src/rules.js';
import {createBattleServer} from '../examples/jengatedris/server.mjs';
import {createOfficeServer} from '../examples/nord-office/server.mjs';
test('grid: deterministic bag, blocked rotation, hold gate, row compaction, garbage and top out',()=>{
 const a=newGrid(42),b=newGrid(42),bag=[];for(let i=0;i<7;i++){bag.push(a.active.type);assert.equal(a.active.type,b.active.type);a.board=a.board.map(r=>r.map(()=>0));b.board=b.board.map(r=>r.map(()=>0));action(a,'drop');action(b,'drop');}assert.equal(new Set(bag).size,7);
 const s=newGrid();const type=s.active.type;action(s,'hold');assert.equal(s.hold,type);const held=s.active.type;action(s,'hold');assert.equal(s.active.type,held);
 s.board=s.board.map(r=>r.map(()=>0));s.active={type:0,x:3,y:17,r:0};s.board[19]=Array(10).fill(1);for(let x=3;x<7;x++)s.board[19][x]=0;action(s,'drop');assert.equal(s.lines,1);assert.equal(s.board[19].every(v=>v===0),true);
 s.active={type:0,x:0,y:1,r:0};garbage(s,2);assert.equal(s.board[19].filter(v=>v===0).length,1);assert.equal(s.board[18].filter(v=>v===8).length,9);
 s.board[0].fill(1);garbage(s);assert(s.over);
 const wall=newGrid();wall.active.x=-4;assert(!fits(wall,wall.active));assert.equal(cells(wall.active).length,4);
 const t=newGrid();t.board=t.board.map(r=>r.fill(1));tickGrid(t,1);action(t,'drop');assert(t.over);
});
test('office: collisions, nearby ownership, correct/wrong work, coffee timing, pranks, AI navigation and shift end',()=>{
 const s=newOffice(),p=addPlayer(s,'p','Pilot'),q=addPlayer(s,'q','Friend');startShift(s);assert(!beginJob(s,p,0));
 p.x=3.5;p.y=5.5;assert(beginJob(s,p,0));q.x=p.x;q.y=p.y;assert(!beginJob(s,q,0));
 for(const v of [...p.job.sequence])assert(jobStep(s,p,v));assert.equal(s.score,1);assert(!s.jobs[0].broken);assert(prank(s,p));assert(!prank(s,p));
 p.x=10.5;p.y=5.5;assert(beginJob(s,p,1));const bad=(PUZZLES[p.job.puzzle].answer+1)%3;assert(!jobStep(s,p,bad));assert.equal(p.job,null);
 p.x=17.5;p.y=5.5;assert(beginJob(s,p,2));s.time+=1.6;assert(jobStep(s,p,0));assert.equal(s.score,2);
 p.x=1.3;p.y=1.3;p.dx=-1;p.dy=-1;for(let i=0;i<20;i++)tickOffice(s,.05);assert(p.x>=1.22&&p.y>=1.22);
 const route=pathTo(p,s.jobs[1]);assert(route.length>0);assert(route.every(([x,y])=>walkable(x,y)));
 const ai=addPlayer(s,'ai','Ada',true);let done=false;for(let i=0;i<2000&&s.phase==='playing';i++){tickOffice(s,.05);if(ai.done){done=true;break;}}assert(done,'AI reaches and completes a real job');
 s.morale=0;tickOffice(s,.05);assert.equal(s.phase,'lost');startShift(s);s.score=11;p.x=3.5;p.y=5.5;assert(beginJob(s,p,0));for(const v of [...p.job.sequence])jobStep(s,p,v);assert.equal(s.phase,'won');
});
async function session(create,fn){const server=create({port:null});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,b)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return {status:r.status,data:await r.json()};};
 try{await fn(post,base);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
test('battle HTTP: joins, cap, synchronized seed, authoritative drops, state and invalid actions',async()=>session(createBattleServer,async(post,base)=>{
 const a=(await post('join',{room:'TEST',name:'A'})).data,b=(await post('join',{room:'TEST',name:'B'})).data;assert.equal((await post('join',{room:'TEST'})).status,409);
 await post('ready',{id:a.id});const ready=(await post('ready',{id:b.id})).data;assert.equal(ready.phase,'playing');assert.equal(ready.players[0].grid.active.type,ready.players[1].grid.active.type);
 const old=ready.players[0].grid.active;const moved=(await post('action',{id:a.id,action:'drop',score:999999})).data;assert(moved.players[0].grid.board.some(r=>r.some(Boolean)));assert(moved.players[0].grid.score<999999);assert.notDeepEqual(moved.players[0].grid.active,old);
 assert.equal((await post('action',{id:a.id,action:'hack'})).status,400);assert.equal((await post('ready',{id:'no'})).status,404);assert.equal((await fetch(base+'/server.mjs')).status,404);
}));
test('office HTTP: shared room, host-only start, server-owned movement and stale input stop',async()=>session(createOfficeServer,async(post,base)=>{
 const a=(await post('join',{room:'TEAM',name:'A'})).data,b=(await post('join',{room:'TEAM',name:'B'})).data;assert.equal(b.players.filter(p=>!p.bot).length,2);
 assert.equal((await post('start',{id:b.you})).status,403);await post('start',{id:a.you});
 await post('input',{id:a.you,dx:1,dy:0,x:9999,score:9999});await new Promise(r=>setTimeout(r,200));const state=await(await fetch(base+'/api/state?id='+a.you)).json();const p=state.players.find(p=>p.id===a.you);assert(p.x>11.5&&p.x<13);assert.equal(state.score,0);
 await new Promise(r=>setTimeout(r,450));const one=await(await fetch(base+'/api/state?id='+a.you)).json();await new Promise(r=>setTimeout(r,150));const two=await(await fetch(base+'/api/state?id='+a.you)).json();assert.equal(one.players.find(p=>p.id===a.you).x,two.players.find(p=>p.id===a.you).x);
 assert.equal((await post('input',{id:a.you,dx:'oops',dy:0})).status,400);assert.equal((await post('work',{id:a.you,job:0})).data.players.find(p=>p.id===a.you).job,null);
}));
