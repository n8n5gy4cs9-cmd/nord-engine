import {newLevel,place} from './model.js';
export function starter(mode,bank){
  const app={bank,byId:new Map(bank.map(b=>[b.id,b]))};
  const l=newLevel(mode==='topdown'?'topdown':'platform');l.physics=mode==='physics'?'matter':'arcade';const layer=l.layers[1],grass=app.byId.get(mode==='topdown'?'amiga-topdown-tiles-0':'amiga-platform-tiles-16-1')??app.bank[0];
  for(let x=0;x<l.width;x++)for(let y=mode==='topdown'?0:18;y<l.height;y++)layer.tiles[`${x},${y}`]={asset:mode==='topdown'&&(x===0||y===0||x===l.width-1||y===l.height-1)?'amiga-topdown-tiles-2':mode!=='topdown'&&y>18?'amiga-platform-tiles-16-3':grass.id,frame:mode==='topdown'&&(x===0||y===0||x===l.width-1||y===l.height-1)?2:mode!=='topdown'&&y>18?3:grass.frame,solid:mode!=='topdown'||x===0||y===0||x===l.width-1||y===l.height-1};
  const hero=app.byId.get(mode==='topdown'?'amiga-soccer-overhead':'amiga-adventurer-run')??app.bank[0];place(l,hero,128,mode==='topdown'?160:480,layer.id,'player');
  const coin=app.bank.find(b=>b.title==='coinGold')??app.bank[0];for(let i=0;i<4;i++)place(l,coin,230+i*64,mode==='topdown'?200:520,layer.id,'pickup');
  if(mode==='physics'){const box=app.bank.find(b=>/boxCrate/.test(b.title))??coin;for(let i=0;i<5;i++){const e=place(l,box,430+i*34,300-i*35,layer.id,'physics');e.shape=i%2?'circle':'box';e.bounce=.55;e.mass=1;e.friction=.3;}l.name='Machine workshop';}
  const exit=place(l,app.bank.find(b=>b.id==='kenney-platformer-pack-remastered-png-tiles-dooropen-mid')??coin,980,mode==='topdown'?320:520,layer.id,'exit');exit.w=48;exit.h=80;
  return l;
}
