// Grid mode has no physics bodies. Board values are colour indices, zero means empty.
export const W=10,H=20;
export const SHAPES=[[[0,1],[1,1],[2,1],[3,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[0,1],[1,1],[2,1]],[[2,0],[0,1],[1,1],[2,1]]];
export const COLORS=['#122130','#55dcf4','#f7d774','#c18aff','#72dda2','#fa7894','#789ef5','#f6aa66','#637485'];
export function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
function next(s){if(!s.bag.length){s.bag=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}}return s.bag.pop();}
export function cells(p){let pts=SHAPES[p.type].map(v=>[...v]);for(let r=0;r<p.r;r++)pts=pts.map(([x,y])=>[3-y,x]);return pts.map(([x,y])=>[p.x+x,p.y+y]);}
export function fits(s,p){return cells(p).every(([x,y])=>x>=0&&x<W&&y<H&&(y<0||!s.board[y][x]));}
function spawn(s,type=s.next,advance=true){s.active={type,x:3,y:-1,r:0};if(advance)s.next=next(s);s.fall=0;if(!fits(s,s.active))s.over=true;}
export function newGrid(seed=12345){const s={seed,board:Array.from({length:H},()=>Array(W).fill(0)),bag:[],next:0,active:null,hold:null,held:false,score:0,lines:0,level:1,fall:0,over:false,won:false,lastClear:0};s.next=next(s);spawn(s);return s;}
export function move(s,dx,dy){const p={...s.active,x:s.active.x+dx,y:s.active.y+dy};if(!fits(s,p))return false;s.active=p;return true;}
export function rotate(s){if(s.active.type===1)return;for(const dx of[0,-1,1,-2,2]){const p={...s.active,x:s.active.x+dx,r:(s.active.r+1)%4};if(fits(s,p)){s.active=p;return;}}}
function lock(s){const pts=cells(s.active);if(pts.some(([,y])=>y<0)){s.over=true;return;}
 for(const[x,y]of pts)s.board[y][x]=s.active.type+1;
 const kept=s.board.filter(row=>row.some(v=>!v)),cleared=H-kept.length;
 s.lastClear=cleared;s.lines+=cleared;s.score+=[0,100,300,500,800][cleared]*s.level;s.level=1+Math.floor(s.lines/5);
 s.board=[...Array.from({length:cleared},()=>Array(W).fill(0)),...kept];s.held=false;spawn(s);
 if(s.lines>=20){s.won=true;s.over=true;}
}
export function action(s,name){if(s.over)return;s.lastClear=0;
 if(name==='left')move(s,-1,0);if(name==='right')move(s,1,0);if(name==='rotate')rotate(s);
 if(name==='down'){if(move(s,0,1))s.score++;else lock(s);}
 if(name==='drop'){let n=0;while(move(s,0,1))n++;s.score+=n*2;lock(s);}
 if(name==='hold'&&!s.held){const t=s.active.type;if(s.hold===null){s.hold=t;spawn(s);}else{const h=s.hold;s.hold=t;spawn(s,h,false);}s.held=true;}
}
export function tickGrid(s,dt){s.lastClear=0;if(s.over)return;s.fall+=Math.min(.1,dt);const delay=Math.max(.09,.72-(s.level-1)*.08);if(s.fall>=delay){s.fall=0;if(!move(s,0,1))lock(s);}}
export function garbage(s,count=1){if(s.over)return;for(let n=0;n<count;n++){if(s.board[0].some(Boolean)){s.over=true;return;}s.board.shift();const hole=Math.floor(random(s)*W);s.board.push(Array.from({length:W},(_,x)=>x===hole?0:8));}if(!fits(s,s.active))s.over=true;}
export function ghost(s){const p={...s.active};while(fits(s,{...p,y:p.y+1}))p.y++;return p;}
