import { SCRIPTS, clone, uid } from './model.js';
export const node=(tag,text='',parent,cls='')=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;parent?.append(e);return e;};
export const button=(parent,text,fn,cls='')=>{const e=node('button',text,parent,cls);e.type='button';e.onclick=fn;return e;};
export function field(parent,label,value,change,options){
  const row=node('label','',parent,'field');node('span',label,row);let e;
  if(options){e=node('select','',row);for(const o of options){const [v,t]=Array.isArray(o)?o:[o,o];const el=node('option',t,e);el.value=v;}e.value=String(value??'');}
  else{e=node('input','',row);e.type=typeof value==='boolean'?'checkbox':typeof value==='number'?'number':'text';if(e.type==='checkbox')e.checked=value;else e.value=value??'';if(e.type==='number')e.step='any';}
  e.onchange=()=>change(e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value);return e;
}
export class Panels {
  constructor(a){this.a=a;this.tab='Build';this.search='';this.pack='All packs';this.category='All categories';this.page=0;this.previews=[];
    const tabs=document.querySelector('#tabs');for(const name of ['Build','Items','Scripts','Level','Objects','Assets'])button(tabs,name,()=>{this.tab=name;this.left();},'tab');
    const tick=t=>{for(const [c,b,anim]of this.previews){if(!c.isConnected)continue;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const k=Math.min((c.width-8)/b.width,(c.height-8)/b.height);a.view.sprite(ctx,b,c.width/2,c.height/2,b.width*k,b.height*k,t,b.frame,anim);}requestAnimationFrame(tick);};requestAnimationFrame(tick);
  }
  left(){const a=this.a,p=document.querySelector('#palette');p.replaceChildren();this.previews=[];document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.textContent===this.tab));
    if(['Build','Items'].includes(this.tab))this.bank(p);
    if(this.tab==='Scripts'){node('h2','Ready-made scripts',p);node('p','Select an object, then attach a script. Edit values in the Inspector. Custom JS uses the same Nord API.',p);for(const[id,s]of Object.entries(SCRIPTS))button(p,'+ '+s.title,()=>a.attach(id),'full');button(p,'Attach project script…',()=>a.customScript(),'full');}
    if(this.tab==='Level')this.level(p);
    if(this.tab==='Objects')this.objects(p);
    if(this.tab==='Assets'){node('h2','Project assets',p);node('p','Import a PNG, or register an existing project image/spritesheet. Bundled sprites are copied automatically when you Save.',p);button(p,'Import PNG…',()=>a.importImage(),'full');button(p,'Register project image…',()=>a.registerImage(),'full');node('h3','Reusable items',p);for(const v of a.level.variants)button(p,v.title,()=>{a.variant=v;a.choose(a.byId.get(v.entity.asset));a.setTool('entity');},'full');node('p','Save a selected object as a reusable item in its Inspector. Variants stay inside this level file.',p);}
  }
  bank(p){const a=this.a;node('h2',this.tab==='Build'?'Sprite & tile bank':'Ready-made items',p);
    if(this.tab==='Items')field(p,'Placement role',a.role,v=>{a.role=v;a.setTool('entity');},[['decoration','Decoration'],['player','Player start'],['solid','Solid prop'],['pickup','Pickup'],['hazard','Hazard'],['exit','Exit / win'],['switch','Switch'],['door','Door (E)'],['physics','Physics prop'],['enemy','Patrolling enemy']]);
    const input=node('input','',p,'full');input.placeholder='Search sprites, terrain, characters…';input.value=this.search;let delay;input.oninput=()=>{clearTimeout(delay);delay=setTimeout(()=>{const caret=input.selectionStart;this.search=input.value;this.page=0;this.left();const n=document.querySelector('#palette input');n.focus();n.setSelectionRange(caret,caret);},140);};
    field(p,'Pack',this.pack,v=>{this.pack=v;this.page=0;this.left();},['All packs',...new Set(a.bank.map(b=>b.pack))]);field(p,'Category',this.category,v=>{this.category=v;this.page=0;this.left();},['All categories',...new Set(a.bank.map(b=>b.category))]);
    const q=this.search.toLowerCase(),list=a.bank.filter(b=>(this.pack==='All packs'||b.pack===this.pack)&&(this.category==='All categories'||b.category===this.category)&&`${b.title} ${b.id} ${b.category}`.toLowerCase().includes(q));
    const row=node('div','',p,'row');button(row,'‹',()=>{this.page=Math.max(0,this.page-1);this.left();});node('small',`${list.length} entries · page ${this.page+1}/${Math.max(1,Math.ceil(list.length/60))}`,row);button(row,'›',()=>{this.page=Math.min(Math.max(0,Math.ceil(list.length/60)-1),this.page+1);this.left();});
    const grid=node('div','',p,'bank-grid');for(const b of list.slice(this.page*60,this.page*60+60)){const card=button(grid,'',()=>{a.variant=null;a.choose(b);a.setTool(this.tab==='Items'?'entity':'brush');},'card'+(a.asset?.id===b.id?' on':''));card.title=b.title+' · '+b.pack;const c=node('canvas','',card);c.width=64;c.height=64;this.previews.push([c,b,Object.keys(b.anims??{})[0]??'']);node('span',b.title,card);}
  }
  level(p){const a=this.a,l=a.level;node('h2','Level settings',p);const set=(k,v)=>a.mutate(()=>{l[k]=v;});
    field(p,'Name',l.name,v=>set('name',v));field(p,'Mode',l.mode,v=>set('mode',v),[['platform','Side-scroller'],['topdown','Top-down']]);field(p,'Physics',l.physics??'arcade',v=>set('physics',v),[['arcade','Arcade (platform/action)'],['matter','Matter (machine/puzzle)']]);
    for(const[k,title]of [['width','Width (cells)'],['height','Height (cells)'],['tileSize','Tile size (px)'],['gravity','Gravity (px/s²)']])field(p,title,l[k],v=>{if(!Number.isFinite(v)||v<0)return;set(k,Math.min(k==='gravity'?5000:256,Math.max(k==='tileSize'?8:1,Math.round(v))));});
    field(p,'Level controller',l.hudScript||'scripts/level2d/level-hud.js',v=>set('hudScript',v));
    field(p,'Background',l.background,v=>{if(/^#[0-9a-f]{6}$/i.test(v))set('background',v);});
    field(p,'Show collision',a.showCollision,v=>{a.showCollision=v;});
    node('h3','Layers (back → front)',p);for(const layer of l.layers){const row=node('div','',p,'layer');button(row,layer.name,()=>{a.activeLayer=layer.id;this.left();},a.activeLayer===layer.id?'on':'');field(row,'',layer.visible,v=>a.mutate(()=>layer.visible=v));}
    button(p,'+ Layer',()=>{if(l.layers.length>=16)return;a.mutate(()=>{const layer={id:uid(),name:'Layer '+(l.layers.length+1),visible:true,locked:false,parallax:1,opacity:1,tiles:{}};l.layers.push(layer);a.activeLayer=layer.id;});this.left();},'full');
    const layer=a.layer();node('h3','Active layer',p);field(p,'Name',layer.name,v=>{a.mutate(()=>layer.name=v);this.left();});field(p,'Locked',layer.locked,v=>a.mutate(()=>layer.locked=v));field(p,'Parallax',layer.parallax,v=>a.mutate(()=>layer.parallax=Math.max(0,Math.min(2,v))));field(p,'Opacity',layer.opacity,v=>a.mutate(()=>layer.opacity=Math.max(0,Math.min(1,v))));
    const row=node('div','',p,'row');for(const [name,dir]of [['↓ Back',-1],['↑ Front',1]])button(row,name,()=>{a.mutate(()=>{const i=l.layers.indexOf(layer),j=i+dir;if(j<0||j>=l.layers.length)return;[l.layers[i],l.layers[j]]=[l.layers[j],l.layers[i]];});this.left();});
    button(p,'Delete layer…',async()=>{if(l.layers.length===1)return;if(await a.confirm('Delete layer and its contents?')){a.mutate(()=>{l.layers=l.layers.filter(v=>v!==layer);l.entities=l.entities.filter(e=>e.layer!==layer.id);a.activeLayer=l.layers[0].id;});this.left();}},'full');
    node('p','Save compiles this level to a normal Nord scene. “Use as game start” also applies the mode, physics, display and input settings to the project. Export with the normal Nord Export command.',p);
  }
  objects(p){const a=this.a;node('h2','Placed objects',p);const input=node('input','',p,'full');input.placeholder='Find name, tag, script…';const body=node('div','',p);const draw=()=>{body.replaceChildren();for(const e of a.level.entities.filter(e=>JSON.stringify(e).toLowerCase().includes(input.value.toLowerCase()))){const row=node('div','',body,'object');button(row,e.name,()=>{a.selected=new Set([e.id]);a.activeLayer=e.layer;a.view.x=a.view.w/2-e.x*a.view.zoom;a.view.y=a.view.h/2-e.y*a.view.zoom;a.refreshInspector();},a.selected.has(e.id)?'on':'');}};input.oninput=draw;draw();}
  inspector(){const a=this.a,p=document.querySelector('#inspector');p.replaceChildren();const e=a.level.entities.find(e=>a.selected.has(e.id));
    node('h2',e?`${a.selected.size>1?a.selected.size+' objects · ':''}Inspector`:'Selected sprite',p);
    const b=e?a.byId.get(e.asset):a.asset;if(b){const canvas=node('canvas','',p,'preview');canvas.width=240;canvas.height=130;this.previews=this.previews.filter(([c])=>c.isConnected);this.previews.push([canvas,{...b,frame:e?.frame??a.frame},e?.anim??a.anim]);node('p',b.title+' · '+b.pack,p);}
    if(!e){if(b){field(p,'Frame',a.frame,v=>{a.frame=Math.max(0,Math.floor(v));});field(p,'Animation',a.anim,v=>{a.anim=v;this.inspector();},[['','Still frame'],...Object.keys(b.anims??{})]);}node('p','Choose a sprite to paint tiles or place objects. V selects objects; drag to move. Inspector values and scripts apply to the first selected object.',p);return;}
    const edit=(k,v)=>{if(a.level.layers.find(l=>l.id===e.layer)?.locked){a.status('Layer locked');return;}a.mutate(()=>e[k]=v);};
    field(p,'Name',e.name,v=>edit('name',v));field(p,'Layer',e.layer,v=>edit('layer',v),a.level.layers.map(l=>[l.id,l.name]));
    for(const[k,title]of [['x','X (px)'],['y','Y (px)'],['w','Width'],['h','Height'],['rot','Rotation °'],['animSpeed','Animation speed ×'],['frame','Still frame']])field(p,title,e[k]??(k==='animSpeed'?1:0),v=>{if(Number.isFinite(v)&&(!['w','h'].includes(k)||v>0))edit(k,v);});
    field(p,'Flip X',e.flipX,v=>edit('flipX',v));field(p,'Animation',e.anim,v=>{edit('anim',v);this.inspector();},[['','Still frame'],...Object.keys(b?.anims??{})]);
    field(p,'Tags',e.tags.join(', '),v=>edit('tags',v.split(',').map(v=>v.trim()).filter(Boolean)));field(p,'Body',e.body,v=>{edit('body',v);this.inspector();},['none','static','dynamic','kinematic']);field(p,'Trigger',e.trigger,v=>edit('trigger',v));
    if(e.body!=='none'){field(p,'Fixed rotation',e.fixedRotation??false,v=>edit('fixedRotation',v));field(p,'Shape',e.shape??'box',v=>edit('shape',v),['box','circle']);for(const[k,label,value]of [['mass','Mass',1],['bounce','Bounce',0],['friction','Friction (Matter)',0.1],['drag','Drag',0],['gravityScale','Gravity scale',1]])field(p,label,e[k]??value,v=>{if(Number.isFinite(v)&&v>=0)edit(k,v);});}
    node('h3','Attached scripts',p);for(const [index,s]of e.scripts.entries()){
      const box=node('details','',p);box.open=true;node('summary',s.path.split('/').at(-1),box);
      for(const[k,v]of Object.entries(s.attributes)){
        if(typeof v==='object')continue;field(box,k,v,value=>a.mutate(()=>s.attributes[k]=value));
      }
      const json=node('textarea','',box);json.value=JSON.stringify(s.attributes,null,2);json.setAttribute('aria-label','Script attributes JSON');button(box,'Apply attributes JSON',()=>{try{const v=JSON.parse(json.value);if(!v||Array.isArray(v)||typeof v!=='object')throw Error('Expected an object');a.mutate(()=>s.attributes=v);this.inspector();}catch(err){a.status(err.message);}});button(box,'Remove script',()=>{a.mutate(()=>e.scripts.splice(index,1));this.inspector();});
    }
    const sel=node('select','',p,'full');for(const[id,s]of Object.entries(SCRIPTS)){const o=node('option',s.title,sel);o.value=id;}button(p,'Attach selected script',()=>a.attach(sel.value),'full');button(p,'Attach custom project script…',()=>a.customScript(),'full');
    node('h3','Reusable item',p);button(p,'Save as variant…',async()=>{const title=await a.ask('Reusable item name',e.name);if(title){a.mutate(()=>a.level.variants.push({id:uid(),title,entity:clone(e)}));a.status('Variant saved in level. Save the level to keep it.');}},'full');
    button(p,'Duplicate · Ctrl+D',()=>a.duplicate(),'full');button(p,'Delete · Del',()=>a.remove(),'full');
  }
}
