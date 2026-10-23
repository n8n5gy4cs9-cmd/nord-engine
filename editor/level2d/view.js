import { clone, flood } from './model.js';
import { isPanGesture, snapActive, zoomAbout } from '../common/sceneview.js';
export class MapView {
  constructor(app){
    this.app=app;this.canvas=document.querySelector('#map');this.ctx=this.canvas.getContext('2d');this.x=30;this.y=30;this.zoom=1;this.images=new Map();this.cursor=[0,0];
    new ResizeObserver(()=>this.resize()).observe(this.canvas);
    this.canvas.addEventListener('pointerenter',()=>this.hover=true);this.canvas.addEventListener('pointerleave',()=>this.hover=false);
    this.canvas.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';this.cursor=this.point(e);});
    this.canvas.addEventListener('drop',e=>this.drop(e));
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=this.canvas.getBoundingClientRect();zoomAbout(this,e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*.001));},{passive:false});
    this.canvas.addEventListener('pointerdown',e=>this.down(e));this.canvas.addEventListener('pointermove',e=>this.move(e));this.canvas.addEventListener('pointerup',e=>this.up(e));this.canvas.addEventListener('pointercancel',e=>this.up(e));
    const tick=t=>{this.draw(t);requestAnimationFrame(tick);};requestAnimationFrame(tick);
  }
  resize(){const r=this.canvas.getBoundingClientRect(),d=devicePixelRatio||1;this.canvas.width=r.width*d;this.canvas.height=r.height*d;this.w=r.width;this.h=r.height;if(this.fitPending){this.fitPending=false;this.fit();}}
  /** Shift+F: centre the view on the selected objects (all objects when nothing is selected). */
  frameSelection(){const a=this.app,ents=a.level.entities.filter(e=>a.selected.has(e.id));if(!ents.length)return this.fit();const r=this.canvas.getBoundingClientRect();let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;for(const e of ents){x0=Math.min(x0,e.x-e.w/2);x1=Math.max(x1,e.x+e.w/2);y0=Math.min(y0,e.y-e.h/2);y1=Math.max(y1,e.y+e.h/2);}this.zoom=Math.max(.1,Math.min(6,Math.min(r.width/Math.max(x1-x0,16),r.height/Math.max(y1-y0,16))*.5));this.x=r.width/2-(x0+x1)/2*this.zoom;this.y=r.height/2-(y0+y1)/2*this.zoom;}
  fit(){const r=this.canvas.getBoundingClientRect();if(r.width<=0||r.height<=0){this.fitPending=true;return;}this.fitPending=false;this.w=r.width;this.h=r.height;const l=this.app.level;this.zoom=Math.max(.1,Math.min(2,Math.min((this.w-48)/(l.width*l.tileSize),(this.h-48)/(l.height*l.tileSize))));this.x=(this.w-l.width*l.tileSize*this.zoom)/2;this.y=(this.h-l.height*l.tileSize*this.zoom)/2;}
  image(a){let im=this.images.get(a.source);if(!im){im=new Image();im.src=a.custom?'/'+a.source:'/__spritebank/'+a.source;this.images.set(a.source,im);}return im;}
  sprite(ctx,a,x,y,w,h,t,frame=a.frame??0,anim='',rot=0,flip=false){
    const im=this.image(a);if(!im.complete||!im.naturalWidth)return;
    const an=a.anims?.[anim];if(an?.frames?.length){const i=Math.floor(t/1000*(an.fps??7));frame=an.frames[an.loop===false?Math.min(i,an.frames.length-1):i%an.frames.length];}
    ctx.save();ctx.translate(x,y);ctx.rotate(rot*Math.PI/180);ctx.scale(flip?-1:1,1);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(im,frame%(a.columns??1)*a.width,Math.floor(frame/(a.columns??1))*a.height,a.width,a.height,-w/2,-h/2,w,h);ctx.restore();
  }
  draw(t){
    const c=this.ctx,a=this.app,l=a.level;if(!l)return;
    const d=devicePixelRatio||1;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,this.w,this.h);c.save();c.translate(this.x,this.y);c.scale(this.zoom,this.zoom);
    c.fillStyle=l.background;c.fillRect(0,0,l.width*l.tileSize,l.height*l.tileSize);
    for(const layer of l.layers){if(!layer.visible)continue;c.globalAlpha=layer.opacity??1;
      for(const [key,v]of Object.entries(layer.tiles)){const [x,y]=key.split(',').map(Number),b=a.byId.get(v.asset);if(!b)continue;this.sprite(c,b,(x+.5)*l.tileSize,(y+.5)*l.tileSize,l.tileSize,l.tileSize,t,v.frame,v.anim);if(v.solid&&a.showCollision){c.strokeStyle='#e7b56888';c.lineWidth=1/this.zoom;c.strokeRect(x*l.tileSize+1,y*l.tileSize+1,l.tileSize-2,l.tileSize-2);}}
      for(const e of l.entities.filter(e=>e.layer===layer.id)){const b=a.byId.get(e.asset);if(b)this.sprite(c,b,e.x,e.y,e.w,e.h,t*(e.animSpeed??1),e.frame,e.anim,e.rot,e.flipX);if(a.selected.has(e.id)){c.strokeStyle='#9bc9e6';c.lineWidth=2/this.zoom;c.strokeRect(e.x-e.w/2-2,e.y-e.h/2-2,e.w+4,e.h+4);}if(e.tags?.includes('player')){c.fillStyle='#a7e6bc';c.font=`${12/this.zoom}px system-ui`;c.fillText('PLAYER',e.x-e.w/2,e.y-e.h/2-7/this.zoom);}}
    }c.globalAlpha=1;
    if(document.querySelector('#grid').checked&&this.zoom>.3){c.beginPath();for(let x=0;x<=l.width;x++){c.moveTo(x*l.tileSize,0);c.lineTo(x*l.tileSize,l.height*l.tileSize);}for(let y=0;y<=l.height;y++){c.moveTo(0,y*l.tileSize);c.lineTo(l.width*l.tileSize,y*l.tileSize);}c.strokeStyle='#ffffff16';c.lineWidth=1/this.zoom;c.stroke();}
    if(this.drag?.kind==='rect'){const [x,y]=this.cell(this.cursor),[sx,sy]=this.drag.cell;c.strokeStyle='#9cdbb2';c.lineWidth=2/this.zoom;c.strokeRect(Math.min(x,sx)*l.tileSize,Math.min(y,sy)*l.tileSize,(Math.abs(x-sx)+1)*l.tileSize,(Math.abs(y-sy)+1)*l.tileSize);}
    if(this.hover&&a.isItemBrush()&&this.inside(this.cell(this.cursor))){const def=a.variant?.entity,b=a.byId.get(def?.asset??a.asset?.id);if(b){c.globalAlpha=.55;this.sprite(c,b,...this.cursor,def?.w??32,def?.h??32,t,def?.frame??a.frame,def?.anim??a.anim,def?.rot??0,def?.flipX);c.globalAlpha=1;}}
    c.restore();
  }
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.left-this.x)/this.zoom,(e.clientY-r.top-this.y)/this.zoom];}
  cell(p){const s=this.app.level.tileSize;return p.map(v=>Math.floor(v/s));}
  inside([x,y]){const l=this.app.level;return x>=0&&y>=0&&x<l.width&&y<l.height;}
  hit(p){const a=this.app;return [...a.level.entities].reverse().find(e=>{const layer=a.level.layers.find(l=>l.id===e.layer);if(!layer?.visible||layer.locked)return false;const r=-(e.rot??0)*Math.PI/180,dx=p[0]-e.x,dy=p[1]-e.y;return Math.abs(dx*Math.cos(r)-dy*Math.sin(r))<e.w/2&&Math.abs(dx*Math.sin(r)+dy*Math.cos(r))<e.h/2;});}
  tile(cell){if(!this.inside(cell))return;const a=this.app,layer=a.layer();if(layer.locked)return;const key=cell.join(',');if(a.tool==='erase')delete layer.tiles[key];else if(a.asset)layer.tiles[key]={asset:a.asset.id,frame:a.frame,anim:a.anim,solid:document.querySelector('#solid').checked};}
  drop(e){e.preventDefault();const a=this.app;if(a.layer().locked||!a.layer().visible){a.dragPayload=null;a.status('Active layer is locked or hidden');return;}let payload=a.dragPayload;try{payload=JSON.parse(e.dataTransfer.getData('application/x-nord-level2d')||e.dataTransfer.getData('text/plain'));}catch{}if(!payload)return;const p=this.point(e),cell=this.cell(p);if(!this.inside(cell))return;if(payload.item){const item=[...a.projectItems,...a.level.variants].find(i=>i.id===payload.item);if(!item)return;a.chooseItem(item);}else{const b=a.byId.get(payload.asset);if(!b)return;a.choose(b);a.placementMode=payload.placement;a.setTool('brush');}if(a.isItemBrush())a.mutate(()=>a.addEntity(...p));else a.mutate(()=>this.tile(cell));a.dragPayload=null;}
  stampItem(cell,point){const d=this.drag;if(!this.inside(cell)||d.seen.has(cell.join(',')))return;d.seen.add(cell.join(','));this.app.addEntity(...point);}
  down(e){
    this.canvas.focus();this.canvas.setPointerCapture(e.pointerId);const a=this.app,p=this.point(e),cell=this.cell(p);this.cursor=p;
    if(isPanGesture(e,{space:a.space,hand:a.tool==='hand'})){this.drag={kind:'pan',client:[e.clientX,e.clientY],offset:[this.x,this.y]};return;}
    if(a.tool==='pick'){const obj=this.hit(p),tile=a.layer().tiles[cell.join(',')];const id=obj?.asset??tile?.asset;if(id)a.choose(a.byId.get(id));return;}
    if(a.tool==='select'){
      const hit=this.hit(p);if(!hit){a.selected.clear();a.refreshInspector();return;}
      if(e.shiftKey){a.selected.has(hit.id)?a.selected.delete(hit.id):a.selected.add(hit.id);}else if(!a.selected.has(hit.id)){a.selected=new Set([hit.id]);}
      this.drag={kind:'move',start:p,before:clone(a.level),orig:a.level.entities.filter(e=>a.selected.has(e.id)).map(e=>[e.id,e.x,e.y])};a.refreshInspector();return;
    }
    if(a.layer().locked||!a.layer().visible){a.status('Active layer is locked or hidden');return;}
    if(a.isItemBrush()){this.drag={kind:'items',before:clone(a.level),seen:new Set(),last:cell};this.stampItem(cell,p);return;}
    if(!this.inside(cell))return;
    if(a.tool==='fill'){a.mutate(()=>flood(a.level,a.layer(),...cell,{asset:a.asset.id,frame:a.frame,anim:a.anim,solid:document.querySelector('#solid').checked}));return;}
    this.drag={kind:a.tool==='rect'?'rect':'paint',cell,before:clone(a.level),last:cell};if(this.drag.kind==='paint')this.tile(cell);
  }
  move(e){const a=this.app,p=this.point(e),cell=this.cell(p);this.cursor=p;a.status(`${Math.round(p[0])}, ${Math.round(p[1])} px · ${a.tool} · ${a.selected.size} selected`);
    const d=this.drag;if(!d)return;
    if(d.kind==='pan'){this.x=d.offset[0]+e.clientX-d.client[0];this.y=d.offset[1]+e.clientY-d.client[1];}
    if(d.kind==='move'){const step=snapActive(document.querySelector('#snap').checked,e)?a.level.tileSize/2:1;for(const[id,x,y]of d.orig){const ent=a.level.entities.find(v=>v.id===id);ent.x=Math.round((x+p[0]-d.start[0])/step)*step;ent.y=Math.round((y+p[1]-d.start[1])/step)*step;}}
    if(d.kind==='items'){const dx=cell[0]-d.last[0],dy=cell[1]-d.last[1],n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=n;i++){const c=[Math.round(d.last[0]+dx*i/(n||1)),Math.round(d.last[1]+dy*i/(n||1))];this.stampItem(c,[(c[0]+.5)*a.level.tileSize,(c[1]+.5)*a.level.tileSize]);}d.last=cell;}
    if(d.kind==='paint'){const dx=cell[0]-d.last[0],dy=cell[1]-d.last[1],n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=n;i++)this.tile([Math.round(d.last[0]+dx*i/(n||1)),Math.round(d.last[1]+dy*i/(n||1))]);d.last=cell;}
  }
  up(){const a=this.app,d=this.drag;if(!d)return;if(d.kind==='rect'){const [x,y]=this.cell(this.cursor);for(let cy=Math.max(0,Math.min(y,d.cell[1]));cy<=Math.min(a.level.height-1,Math.max(y,d.cell[1]));cy++)for(let cx=Math.max(0,Math.min(x,d.cell[0]));cx<=Math.min(a.level.width-1,Math.max(x,d.cell[0]));cx++)this.tile([cx,cy]);}if(d.before)a.record(d.before);this.drag=null;a.refreshInspector();}
}
