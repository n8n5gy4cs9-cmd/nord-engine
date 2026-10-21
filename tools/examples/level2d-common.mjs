import fs from 'node:fs';
import path from 'node:path';
import { ROOT, project } from './lib.mjs';
import { starter } from '../../editor/level2d/starter.js';
import { compile, projectSettings, place } from '../../editor/level2d/model.js';
const bank=JSON.parse(fs.readFileSync(path.join(ROOT,'editor/level2d/bank.json'))).entries;
export function create2dSpec(mode){
  const id=mode==='physics'?'machine-workshop':'level2d-'+mode;
  const l=starter(mode,bank);l.name=mode==='physics'?'Machine Workshop':mode==='topdown'?'2D Top-down Workshop':'2D Platform Workshop';
  if(mode==='physics'){
    l.hudScript='scripts/machine.js';l.width=30;l.height=17;l.layers.forEach(v=>v.tiles={});l.entities=[];
    const layer=l.layers[1].id,ball=bank.find(b=>b.title==='ball basket1')??bank.find(b=>b.title==='coinGold'),ramp=bank.find(b=>b.title==='boxCrate')??bank.find(b=>b.id==='amiga-platform-tiles-16-1');
    const e=place(l,ball,130,70,layer,'physics');Object.assign(e,{name:'Player',tags:['player','ball'],shape:'circle',w:32,h:32,mass:1,bounce:.25,friction:.005});
    for(const[x,y,w,h,angle,name]of [[260,220,380,18,15,'Ramp A'],[640,365,340,18,15,'Ramp B'],[480,535,960,24,0,'Floor'],[850,430,20,200,0,'Basket wall'],[760,520,180,16,0,'Basket base']]){
      const e=place(l,ramp,x,y,layer,'solid');Object.assign(e,{name,w,h,rot:angle,friction:.02,bounce:.15});
    }
    const goal=place(l,bank.find(b=>b.id==='amiga-sports-equipment-6')??ball,795,485,layer,'exit');Object.assign(goal,{name:'Goal basket',w:70,h:65,anim:''});goal.scripts[0].attributes.message='Machine solved! The ball reached the basket.';
  }
  const out=compile(l,bank),camera=out.scene.entities.find(e=>e.id==='d2camera');
  if(mode==='physics'){camera.components[0].follow='';camera.transform.pos=[480,270,100];camera.scripts=[{path:'scripts/machine.js',attributes:{}}];}
  const sources=[...new Set(out.assets.map(id=>bank.find(b=>b.id===id).source))];
  const assets=[...sources];const licenses=new Set(sources.map(s=>s.startsWith('assets/packs/nord-amiga/')?'assets/packs/nord-amiga/README.md':s.split('/').slice(0,4).join('/')+'/LICENSE.md'));assets.push(...licenses);
  for(const id of ['platformer2d','topdown','pickup','health','ai-patrol'])assets.push({from:'library/scripts/'+id+'.js',to:'scripts/level2d/'+id+'.js'});
  for(const id of ['level-actions','level-hud','level-animate'])assets.push({from:'runtime/level2d/'+id+'.js',to:'scripts/level2d/'+id+'.js'});
  return {name:l.name,project:{...project(id,l.name,'2d'),...projectSettings(l)},scenes:{main:out.scene},assets,
    files:{'levels/workshop.level2d.json':l,'GUIDE.md':mode==='physics'?'# Machine Workshop\n\nOriginal Incredible Machine-style gravity puzzle; no TIM code or media. Click Release to drop the ball. Adjust Ramp A/B angles before releasing, or edit all bodies in the 2D Level Creator Inspector. Goal: guide the ball into the basket at the right. Reset restores the setup. Matter handles gravity, rotating rectangles, rolling circles, mass, bounce and friction. Start with defaults, then alter the ramps.\n':'# 2D Workshop\n\nOpen the 2D Level tab. Build paints tiles; Items places players/pickups/hazards/exits. Level manages layers and physics. Save writes a normal Nord scene. Use as game start to run/export the saved workshop. F5 tests unsaved edits.\n'},
    readme:'# '+l.name+'\n\nCrowelian 2026 + Sonnet. Use the 2D Level Creator tab to edit `levels/workshop.level2d.json`. Save and Use as game start before main Play/export. '+(mode==='physics'?'Matter physics puzzle: release the ball, tune the ramp angles, reach the basket.':'WASD/arrows move; Space jumps in platform mode; collect coins and reach the exit.')+'\n',
    template:{id,title:l.name,description:mode==='physics'?'2D Matter physics machine puzzle: editable ramps, ball, basket, mass, bounce and friction.':'2D Level Creator '+mode+' starter with sprite bank, collision, scripts and editable level.'}};
}
