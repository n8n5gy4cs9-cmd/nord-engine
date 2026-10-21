import {test} from 'node:test';import assert from 'node:assert/strict';import {MapView} from './view.js';
test('fit works before ResizeObserver has initialized cached canvas dimensions',()=>{const view={canvas:{getBoundingClientRect:()=>({width:800,height:600})},app:{level:{width:26,height:17,tileSize:32}}};MapView.prototype.fit.call(view);assert([view.x,view.y,view.zoom].every(Number.isFinite));assert(view.zoom>0);assert(view.x>=0);});
test('zero-size native pane defers fit until it has real bounds',()=>{let width=0;const view={x:30,y:30,zoom:1,canvas:{getBoundingClientRect:()=>({width,height:600})},app:{level:{width:26,height:17,tileSize:32}}};MapView.prototype.fit.call(view);assert.equal(view.fitPending,true);assert.equal(view.zoom,1);width=800;MapView.prototype.fit.call(view);assert.equal(view.fitPending,false);assert([view.x,view.y,view.zoom].every(Number.isFinite));});
for (const state of ['locked','hidden']) test(`palette drops cannot modify a ${state} layer`,()=>{
  let mutations=0,choices=0;const layer={locked:state==='locked',visible:state!=='hidden'};
  const app={layer:()=>layer,status:()=>{},dragPayload:{asset:'tile',placement:'tile'},byId:new Map([['tile',{}]]),choose:()=>choices++,setTool:()=>{},isItemBrush:()=>false,mutate:fn=>{mutations++;fn();}};
  const view={app,point:()=>[16,16],cell:()=>[0,0],inside:()=>true,tile:()=>{}};
  MapView.prototype.drop.call(view,{preventDefault(){},dataTransfer:{getData:()=>''}});
  assert.equal(mutations,0);assert.equal(choices,0);
});
test('palette drop still paints a visible unlocked layer and records one mutation',()=>{
  let mutations=0,painted=0;const asset={id:'tile'};
  const app={layer:()=>({locked:false,visible:true}),byId:new Map([['tile',asset]]),choose:b=>assert.equal(b,asset),setTool:t=>assert.equal(t,'brush'),isItemBrush:()=>false,mutate:fn=>{mutations++;fn();}};
  const view={app,point:()=>[16,16],cell:()=>[0,0],inside:()=>true,tile:cell=>{assert.deepEqual(cell,[0,0]);painted++;}};
  MapView.prototype.drop.call(view,{preventDefault(){},dataTransfer:{getData:type=>type==='application/x-nord-level2d'?JSON.stringify({asset:'tile',placement:'tile'}):''}});
  assert.equal(mutations,1);assert.equal(painted,1);assert.equal(app.dragPayload,null);
});
