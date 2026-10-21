export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function newFlight(){return {time:0,distance:0,x:0,y:0,hp:100,score:0,roll:0,shield:0,fire:0,spawn:0,gate:18,cell:8,bossHP:48,bossZ:130,bossFire:1,boss:false,won:false,lost:false,enemies:[],shots:[],hostile:[],gates:[],cells:[],serial:0};}
export function tick(s,input,dt){
 if(s.won||s.lost)return [];dt=Math.min(.05,dt);const events=[];s.time+=dt;s.distance+=22*dt;
 s.x=clamp(s.x+input.x*12*dt,-9,9);s.y=clamp(s.y+input.y*9*dt,-4.4,5.2);
 s.roll=Math.max(0,s.roll-dt);s.shield=Math.max(0,s.shield-dt);s.fire-=dt;s.spawn-=dt;s.gate-=dt;s.cell-=dt;
 if(input.roll&&s.roll===0){s.roll=3;s.shield=.75;events.push('shield');}
 if(input.fire&&s.fire<=0){s.fire=.16;s.shots.push({x:s.x,y:s.y,z:3});events.push('laser');}
 if(s.time<63&&s.spawn<=0){s.spawn=Math.max(.7,2-s.time/70);const id=s.serial++;s.enemies.push({id,x:Math.sin(id*2.3)*7,y:Math.cos(id*1.7)*3,z:130,hp:2,fire:1.5+(id%3)*.3});}
 if(s.gate<=0&&s.time<65){s.gate=12;s.gates.push({x:Math.sin(s.serial)*3,y:0,z:150});}
 if(s.cell<=0&&s.time<65){s.cell=11;s.cells.push({x:Math.sin(s.time)*5,y:Math.cos(s.time)*2,z:110});}
 const damage=n=>{if(s.shield>0)return;s.hp=Math.max(0,s.hp-n);s.shield=1.2;events.push('crash');if(s.hp===0)s.lost=true;};
 for(const e of s.enemies){e.z-=24*dt;e.fire-=dt;if(e.fire<=0&&e.z>10){e.fire=2.8;s.hostile.push({x:e.x,y:e.y,z:e.z,vx:(s.x-e.x)*.3,vy:(s.y-e.y)*.3});}if(Math.abs(e.z)<2&&Math.hypot(e.x-s.x,e.y-s.y)<2){damage(18);e.hp=0;}}
 if(s.time>=65){s.boss=true;s.bossZ=Math.max(48,s.bossZ-14*dt);s.bossFire-=dt;if(s.bossFire<=0){s.bossFire=1;for(let i=-2;i<=2;i++)s.hostile.push({x:i*2,y:Math.sin(s.time)*2,z:s.bossZ,vx:i*.8,vy:0});}}
 for(const shot of s.shots){shot.z+=110*dt;for(const e of s.enemies)if(e.hp>0&&Math.abs(shot.z-e.z)<4&&Math.hypot(shot.x-e.x,shot.y-e.y)<1.7){e.hp--;shot.z=999;if(e.hp===0){s.score+=100;events.push('explosion');}break;}
  if(!s.won&&s.boss&&Math.abs(shot.z-s.bossZ)<5&&Math.abs(shot.x)<5&&Math.abs(shot.y)<2.6){s.bossHP--;shot.z=999;events.push('checkpoint');if(s.bossHP<=0){s.won=true;s.score+=2500;events.push('win');}}
 }
 for(const bullet of s.hostile){bullet.z-=46*dt;bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;if(Math.abs(bullet.z)<2&&Math.hypot(bullet.x-s.x,bullet.y-s.y)<1){damage(12);bullet.z=-20;}}
 for(const gate of s.gates){gate.z-=22*dt;if(Math.abs(gate.z)<1&&(!gate.passed)){gate.passed=true;if(Math.abs(s.x-gate.x)>3||Math.abs(s.y)>2.8)damage(24);else{s.score+=150;events.push('checkpoint');}}}
 for(const cell of s.cells){cell.z-=22*dt;if(Math.abs(cell.z)<2&&Math.hypot(cell.x-s.x,cell.y-s.y)<1.7){cell.z=-20;s.hp=Math.min(100,s.hp+20);s.score+=50;events.push('shield');}}
 s.enemies=s.enemies.filter(e=>e.hp>0&&e.z>-8);s.shots=s.shots.filter(b=>b.z<180);s.hostile=s.hostile.filter(b=>b.z>-10);s.gates=s.gates.filter(g=>g.z>-10);s.cells=s.cells.filter(c=>c.z>-10);
 if(s.time>=110&&!s.won)s.lost=true;return events;
}
