// Matter is already bundled with Nord's pinned Phaser. No CDN and no extra npm install.
import {SHAPES,COLORS} from './rules.js';
export async function createChaos(){
 if(!window.Phaser)await new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='vendor/phaser/phaser.min.js';tag.onload=resolve;tag.onerror=()=>reject(Error('Missing local vendor/phaser/phaser.min.js'));document.head.append(tag);});
 const M=window.Phaser.Physics.Matter.Matter;
 const engine=M.Engine.create();engine.gravity.y=.8;
 const walls=[M.Bodies.rectangle(150,590,320,24,{isStatic:true}),M.Bodies.rectangle(-12,300,24,600,{isStatic:true}),M.Bodies.rectangle(312,300,24,600,{isStatic:true})];M.Composite.add(engine.world,walls);
 const s={engine,M,blocks:[],active:null,count:0,over:false,won:false,time:0,settle:0};
 s.spawn=()=>{const type=s.count%7;const parts=SHAPES[type].map(([x,y])=>M.Bodies.rectangle(110+x*24,45+y*24,23,23));
  const body=M.Body.create({parts,friction:.7,restitution:.04,density:.004});body.color=COLORS[type+1];M.Composite.add(engine.world,body);s.blocks.push(body);s.active=body;s.count++;s.time=0;s.settle=0;};s.spawn();
 s.tick=(dt,keys)=>{if(s.over)return;dt=Math.min(dt,.033);s.time+=dt;const b=s.active;
  M.Body.applyForce(b,b.position,{x:((keys.has('ArrowRight')||keys.has('KeyD'))-(keys.has('ArrowLeft')||keys.has('KeyA')))*.0015,y:keys.has('ArrowDown')?.009:0});
  if(keys.has('KeyQ'))M.Body.setAngularVelocity(b,-.035);if(keys.has('KeyE'))M.Body.setAngularVelocity(b,.035);
  M.Engine.update(engine,dt*1000);
  if(s.time>1&&b.speed<.3)s.settle+=dt;else s.settle=0;
  if(s.settle>.65||s.time>7){if(s.blocks.some(v=>v.position.y<90&&v!==b)){s.over=true;return;}if(s.count>=18){s.over=true;s.won=true;}else s.spawn();}
 };
 s.draw=ctx=>{for(const b of [...walls,...s.blocks])for(const p of b.parts.length>1?b.parts.slice(1):[b]){ctx.fillStyle=b.color||'#69818b';ctx.beginPath();p.vertices.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fill();ctx.strokeStyle='#172432';ctx.stroke();}};
 s.dispose=()=>{M.Composite.clear(engine.world,false);M.Engine.clear(engine);};return s;
}
