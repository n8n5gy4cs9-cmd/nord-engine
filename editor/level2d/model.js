// 2D authoring model and compiler. Output uses the existing Nord/Phaser scene format.
export const clone = v => JSON.parse(JSON.stringify(v));
export const uid = () => 'd'+Math.random().toString(36).slice(2,9);
export const SCRIPTS = {
  platformer2d: { title:'Platform player', attrs:{speed:180,jumpForce:420,coyoteTime:0.1,jumpBuffer:0.12,dash:false} },
  topdown: { title:'Top-down player', attrs:{speed:150,accel:1200,fourWay:false,faceMovement:false} },
  pickup: { title:'Pickup', attrs:{kind:'score',value:10,tag:'player',magnet:0,bob:0} },
  health: { title:'Health', attrs:{max:5,invulnTime:0.8,destroyOnDeath:false} },
  'ai-patrol': { title:'Patrol', attrs:{speed:50,distance:96,pause:0.5,ledgeCheck:true} },
  'level-actions': { title:'Hazard / exit / switch / door', attrs:{action:'hurt',target:'',amount:1,message:'Level complete!',requireScore:0} },
  'level-animate': {title:'Movement animation / facing',attrs:{run:'run',south:'run-south',east:'run-east',north:'run-north',west:'run-west',idleFrame:-1}},
  'level-hud': { title:'Score, health and restart HUD', attrs:{} },
};
export function newLevel(mode='platform') {
  return {format:'nord-level2d/1',name:mode==='platform'?'Platform workshop':'Top-down workshop',mode,
    physics:'arcade',width:40,height:24,tileSize:32,background:'#192631',gravity:mode==='platform'?900:0,
    layers:[{id:uid(),name:'Background',visible:true,locked:false,parallax:0.5,opacity:1,tiles:{}},
      {id:uid(),name:'World',visible:true,locked:false,parallax:1,opacity:1,tiles:{}}],entities:[],variants:[],custom:[]};
}
export function validate(l, bank) {
  const errors=[];
  if(l?.format!=='nord-level2d/1') return ['Not a Nord 2D level'];
  if(l.hudScript&&(!/^scripts\/[a-zA-Z0-9_./-]+\.js$/.test(l.hudScript)||l.hudScript.split('/').includes('..')))errors.push('Invalid level controller script');
  if(!['platform','topdown'].includes(l.mode)) errors.push('Unknown game mode');
  if(!Number.isInteger(l.width)||l.width<1||l.width>256||!Number.isInteger(l.height)||l.height<1||l.height>256) errors.push('Map dimensions must be 1–256 cells');
  if(!Number.isFinite(l.tileSize)||l.tileSize<8||l.tileSize>256) errors.push('Tile size must be 8–256 pixels');
  if(!Array.isArray(l.layers)||!l.layers.length||l.layers.length>16) errors.push('Use 1–16 layers');
  const known = new Map(bank.map(b=>[b.id,b]));
  for(const layer of l.layers??[]) for(const [key,t] of Object.entries(layer.tiles??{})) {
    const [x,y]=key.split(',').map(Number);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=l.width||y>=l.height) errors.push('Tile outside map: '+key);
    if(!known.has(t.asset)) errors.push('Missing sprite: '+t.asset);
    if(t.solid && layer.parallax!==1) errors.push('Collision layer must have parallax 1: '+layer.name);
  }
  const ids=new Set();
  for(const e of l.entities??[]) {
    if(ids.has(e.id)) errors.push('Duplicate entity id: '+e.id); ids.add(e.id);
    if(!known.has(e.asset)) errors.push('Missing sprite: '+e.asset);
    if(!l.layers.some(a=>a.id===e.layer)) errors.push('Missing layer: '+e.name);
    if(![e.x,e.y,e.w,e.h,e.rot??0].every(Number.isFinite)||e.w<=0||e.h<=0) errors.push('Invalid transform: '+e.name);
    for(const s of e.scripts??[]) if(!/^scripts\/[a-zA-Z0-9_./-]+\.js$/.test(s.path)||s.path.split('/').includes('..')) errors.push('Use a project-relative script path: '+s.path);
  }
  if(!(l.entities??[]).some(e=>e.tags?.includes('player'))) errors.push('Place a Player start (Items → Platform / Top-down player)');
  return [...new Set(errors)];
}
export function place(l,asset,x,y,layer,role='decoration') {
  const h=role==='player'?48:32,w=Math.max(8,h*asset.width/asset.height);
  const e={id:uid(),name:role==='player'?'Player':asset.title,asset:asset.id,x,y,w,h,rot:0,flipX:false,frame:asset.frame??0,anim:Object.keys(asset.anims??{})[0]??'',layer,
    tags:role==='player'?['player']:[],body:role==='player'?'dynamic':role==='solid'?'static':'none',trigger:['pickup','hazard','exit','switch'].includes(role),scripts:[]};
  if(e.trigger)e.body='static';
  const attach=(id,attrs={})=>e.scripts.push({path:'scripts/level2d/'+id+'.js',attributes:{...clone(SCRIPTS[id].attrs),...attrs}});
  if(role==='player'){e.fixedRotation=true;attach(l.mode==='platform'?'platformer2d':'topdown');attach('health');if(Object.keys(asset.anims??{}).length)attach('level-animate');}
  if(role==='pickup')attach('pickup');
  if(['hazard','exit','switch','door'].includes(role))attach('level-actions',{action:role==='hazard'?'hurt':role==='exit'?'win':role==='switch'?'toggle':'door'});
  if(role==='door')e.body='static';
  if(role==='physics'){e.body='dynamic';e.mass=1;e.bounce=.4;e.friction=.2;e.shape='box';}
  if(role==='enemy'){e.body='dynamic';attach('ai-patrol',{distance:160,pause:.5,ledgeCheck:true});attach('level-actions',{action:'hurt'});}
  l.entities.push(e);return e;
}
// Adapted from LDtk Tool.hx _floodFillImpl (MIT), Sébastien Benard / Deepnight Games.
// Pinned source and full licence: editor/level2d/LDtk-LICENSE.txt and THIRD_PARTY.md.
export function flood(l,layer,x,y,value) {
  const old=JSON.stringify(layer.tiles[`${x},${y}`]??null), next=JSON.stringify(value??null);
  if(old===next)return;
  const seen=new Set(),pending=[];
  const check=(cx,cy)=>{const key=`${cx},${cy}`;if(cx>=0&&cy>=0&&cx<l.width&&cy<l.height&&!seen.has(key)&&JSON.stringify(layer.tiles[key]??null)===old){seen.add(key);pending.push([cx,cy]);}};
  check(x,y);
  while(pending.length){const [cx,cy]=pending.pop(),key=`${cx},${cy}`;check(cx-1,cy);check(cx+1,cy);check(cx,cy-1);check(cx,cy+1);if(value)layer.tiles[key]=clone(value);else delete layer.tiles[key];}
}
export class History {
  constructor(){this.undo=[];this.redo=[];}
  push(before,after){if(JSON.stringify(before)===JSON.stringify(after))return;this.undo.push(clone(before));if(this.undo.length>60)this.undo.shift();this.redo=[];}
  step(current,redo=false){const from=redo?this.redo:this.undo,to=redo?this.undo:this.redo;if(!from.length)return current;to.push(clone(current));return from.pop();}
}
export function compile(l,bank) {
  const errors=validate(l,bank);if(errors.length)throw Error(errors.join('\n'));
  const byId=new Map(bank.map(a=>[a.id,a])),used=new Set(),entities=[];
  const make=(id,name,x,y,z,components,scripts=[],tags=[],scale=[1,1,1],rot=0)=>({id,name,enabled:true,tags,layer:z,transform:{pos:[x,y,z],rot:[0,0,rot],scale},components,scripts,children:[],prefab:null});
  const visual=(a,frame,anim,layer)=>({type:anim?'animatedSprite':'sprite',texture:a.source,frame:frame??a.frame??0,...(anim?{anim}:{}),origin:[0.5,0.5],alpha:layer.opacity??1,scrollFactor:[layer.parallax??1,layer.parallax??1]});
  const body=(mode,w,h,trigger=false,e={})=>[{type:'rigidbody',mode,fixedRotation:e.fixedRotation??false,mass:e.mass??1,bounce:e.bounce??0,friction:e.friction??.1,drag:e.drag??0,gravityScale:e.gravityScale??1},{type:'collider',shape:e.shape??'box',radius:Math.min(w,h)/2,size:[w,h],trigger}];
  l.layers.forEach((layer,z)=>{
    if(!layer.visible)return;
    for(const [key,t] of Object.entries(layer.tiles)){
      const [x,y]=key.split(',').map(Number),a=byId.get(t.asset);used.add(a.id);
      entities.push(make('t'+z+'x'+x+'y'+y,layer.name+' tile', (x+0.5)*l.tileSize,(y+0.5)*l.tileSize,z*10,
        [visual(a,t.frame,t.anim,layer),...(t.solid?body('static',l.physics==='matter'?l.tileSize:a.width,l.physics==='matter'?l.tileSize:a.height):[])],[],[],[l.tileSize/a.width,l.tileSize/a.height,1]));
    }
    for(const e of l.entities.filter(e=>e.layer===layer.id)){
      const a=byId.get(e.asset);used.add(a.id);const v=visual(a,e.frame,e.anim,layer);v.flipX=!!e.flipX;v.speed=e.animSpeed??1;
      entities.push(make(e.id,e.name,e.x,e.y,z*10+1,[v,...(e.body!=='none'?body(e.body,l.physics==='matter'?e.w:a.width,l.physics==='matter'?e.h:a.height,e.trigger,e):[])],clone(e.scripts??[]),e.tags??[],[e.w/a.width,e.h/a.height,1],e.rot));
    }
  });
  entities.push(make('d2camera','Camera',320,180,100,[{type:'camera',follow:'Player',lerp:0.15,bounds:[0,0,l.width*l.tileSize,l.height*l.tileSize]}],[{path:l.hudScript||'scripts/level2d/level-hud.js',attributes:clone(l.hudAttributes??{})}]));
  const layers={};l.layers.forEach((layer,z)=>{for(const i of [z*10,z*10+1])layers[i]={visible:layer.visible,opacity:1,parallax:[layer.parallax,layer.parallax]};});
  return {scene:{format:1,name:l.name,settings:{layers,layoutSize:{width:l.width*l.tileSize,height:l.height*l.tileSize}},entities},assets:[...used]};
}
export function projectSettings(l){return {display:{width:960,height:540,scale:'fit',pixelArt:true,background:l.background},physics:{engine:l.physics??'arcade',gravity:[0,l.mode==='platform'?l.gravity:0,0]},input:{actions:{left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],jump:['Space'],dash:['ShiftLeft'],interact:['KeyE','Enter']}}};}
