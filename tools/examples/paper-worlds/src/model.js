export const WIDTH=1200,HEIGHT=850;
export function newBoards(){return Array.from({length:10},(_,i)=>({id:i,title:['Launch plan','Build ideas','Sketchbook','Links & doors','Tiny maze','Release notes','Experiments','Garden','Roadmap','Portfolio'][i],shapes:i===0?[{kind:'text',x:90,y:90,text:'Make something worth exploring.',color:'#23384b'},{kind:'sticky',x:110,y:190,w:230,h:160,text:'Draw. Zoom out. Play.',color:'#f5d889'},{kind:'rect',x:650,y:230,w:240,h:330,text:'door',color:'#6a9cff'},{kind:'pen',color:'#32a7a0',points:[[100,620],[210,540],[330,590],[460,420],[610,490],[760,350],[1000,470]]}]:[]}));}
export function paint(ctx,board,{background=true}={}){ctx.clearRect(0,0,WIDTH,HEIGHT);if(background){ctx.fillStyle='#faf7ed';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#d5d9d6';for(let y=25;y<HEIGHT;y+=25)for(let x=25;x<WIDTH;x+=25)ctx.fillRect(x,y,1,1);}
 for(const s of board.shapes){ctx.strokeStyle=s.color||'#23384b';ctx.fillStyle=s.color||'#23384b';ctx.lineWidth=4;ctx.lineJoin='round';ctx.lineCap='round';
  if(s.kind==='pen'){ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  if(s.kind==='rect'){ctx.strokeRect(s.x,s.y,s.w,s.h);if(s.text==='door'){ctx.fillStyle='#6a9cff22';ctx.fillRect(s.x,s.y,s.w,s.h);}}
  if(s.kind==='circle'){ctx.beginPath();ctx.arc(s.x,s.y,Math.max(4,Math.abs(s.w)),0,7);ctx.stroke();}
  if(s.kind==='sticky'){ctx.shadowColor='#21364b33';ctx.shadowBlur=12;ctx.shadowOffsetY=6;ctx.fillRect(s.x,s.y,s.w,s.h);ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#26384b';}
  if(s.text){ctx.font=s.kind==='text'?'32px system-ui':'24px system-ui';String(s.text).split('\n').slice(0,8).forEach((line,i)=>ctx.fillText(line.slice(0,60),s.x+12,s.y+36+i*30));}
 }
}
export function validateBoards(data){
 const num=v=>Number.isFinite(v)&&Math.abs(v)<=40000;
 const valid=s=>s&&['pen','rect','circle','sticky','text'].includes(s.kind)&&(!s.color||/^#[0-9a-f]{6}$/i.test(s.color))&&(!s.text||typeof s.text==='string'&&s.text.length<=10000)&&(s.kind==='pen'?Array.isArray(s.points)&&s.points.length<=10000&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(num)):num(s.x)&&num(s.y)&&(s.kind==='text'||num(s.w)&&num(s.h)));
 return Array.isArray(data)&&data.length===10&&data.every(b=>b&&typeof b.title==='string'&&b.title.length<=200&&Array.isArray(b.shapes)&&b.shapes.length<=1000&&b.shapes.every(valid));
}
