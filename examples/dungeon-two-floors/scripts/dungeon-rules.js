// GPL-3.0-or-later. Adapted from Shattered Pixel Dungeon Char.hit and Rat stats.
// Copyright Oleg Dolya 2012–2015; Evan Debenham 2014–2026.
// Simplified JS port for this two-floor sample. Pin/provenance and full terms: SOURCE.md, LICENSE.md.
export function strike(random,attacker,defender){
 if(random()*attacker.accuracy<random()*defender.defense)return 0;
 const [min,max]=attacker.damage,roll=Math.floor((random()+random())*.5*(max-min+1))+min;
 return Math.max(0,roll-Math.floor(random()*(defender.armor+1)));
}
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function nextStep(from,to,blocked,occupied,width,height){
 const queue=[[from.x,from.y]],seen=new Set([`${from.x},${from.y}`]),prev=new Map();let end=null;
 for(let i=0;i<queue.length;i++){const[x,y]=queue[i];if(x===to.x&&y===to.y){end=[x,y];break;}for(const[dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(nx<0||ny<0||nx>=width||ny>=height||seen.has(k)||blocked.has(k)||occupied.has(k)&&!(nx===to.x&&ny===to.y))continue;seen.add(k);prev.set(k,[x,y]);queue.push([nx,ny]);}}
 if(!end)return null;while(true){const p=prev.get(end.join(','));if(!p)return null;if(p[0]===from.x&&p[1]===from.y)return{x:end[0],y:end[1]};end=p;}
}
export function visible(a,b,blocked,radius=7){
 if(Math.hypot(a.x-b.x,a.y-b.y)>radius)return false;let x=a.x,y=a.y,dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1,err=dx+dy;
 for(let i=0;i<200;i++){if(x===b.x&&y===b.y)return true;if((x!==a.x||y!==a.y)&&blocked.has(`${x},${y}`))return false;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}return false;
}
