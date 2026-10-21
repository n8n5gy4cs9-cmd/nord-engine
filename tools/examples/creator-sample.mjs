// Shared publication of authored 2D sample levels. Art and scripts stay in each project.
import fs from 'node:fs';import path from 'node:path';
import {ROOT,project} from './lib.mjs';import {compile,projectSettings} from '../../editor/level2d/model.js';
export const builtins=JSON.parse(fs.readFileSync(path.join(ROOT,'editor/level2d/bank.json'))).entries;
export function customSprite(id,title,source,w,h,columns=1,frame=0,anims={}){return{id,title,source,width:w,height:h,columns,frame,anims,custom:true,pack:'Project',category:'Game pieces'};}
export function sampleSpec(id,title,levels,custom,art,files={}){
 const bank=[...builtins,...custom],scenes={},used=new Set();for(const[name,l]of Object.entries(levels)){l.custom=custom;const out=compile(l,bank);scenes[name]=out.scene;out.assets.forEach(a=>used.add(a));files[`levels/${name}.level2d.json`]=l;}
 const assets=[...art],license=new Set();for(const id of used){const a=bank.find(b=>b.id===id);if(a.custom)continue;assets.push(a.source);license.add(a.source.startsWith('assets/packs/nord-amiga/')?'assets/packs/nord-amiga/README.md':a.source.split('/').slice(0,4).join('/')+'/LICENSE.md');}assets.push(...license);
 for(const id of ['platformer2d','topdown','pickup','health','ai-patrol'])assets.push({from:'library/scripts/'+id+'.js',to:'scripts/level2d/'+id+'.js'});
 for(const id of ['level-actions','level-hud','level-animate'])assets.push({from:'runtime/level2d/'+id+'.js',to:'scripts/level2d/'+id+'.js'});
 return{name:title,project:{...project(id,title,'2d'),...projectSettings(Object.values(levels)[0]),startScene:`scenes/${Object.keys(levels)[0]}.scene.json`},scenes,assets,files,readme:`# ${title}\n\nOpen the 2D Level tab; editable levels are in levels/*.level2d.json. Save compiles normal Nord scenes. Use as game start before Play/export. Read GUIDE.md and the illustrated HTML tutorial in the manual. Crowelian 2026 + Sonnet.\n`,template:{id,title,description:title+' — editable 2D Level Creator game with ready scripts and tutorial.'}};
}
