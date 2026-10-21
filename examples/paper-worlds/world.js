import {createDesk} from './desk.js';
import {WIDTH,HEIGHT,paint} from './model.js';
export async function createWorld(canvas,boards,select){const d=await createDesk(canvas),{B,scene,camera}=d;const papers=[],stickies=[],portals=[];let flying=null,ride=null;
 boards.forEach((board,i)=>{const p=d.paper('Board '+i,6,4.25,ctx=>{ctx.save();ctx.scale(1024/WIDTH,768/HEIGHT);paint(ctx,board);ctx.restore();});p.mesh.position.set((i%5-2)*7,.12,(Math.floor(i/5)-.5)*6);p.mesh.metadata={board:i};papers.push(p);
  for(const s of board.shapes.filter(s=>s.kind==='sticky')){const pos=[p.mesh.position.x+(s.x/WIDTH-.5)*6,.5,p.mesh.position.z+(s.y/HEIGHT-.5)*4.25];const box=d.box('Sticky note',pos,s.color);box.mesh.metadata={sticky:true};stickies.push(box);}
  if(board.shapes.some(s=>s.kind==='rect'&&s.text==='door')){const at=p.mesh.position;const material=new B.StandardMaterial('Door glow',scene);material.emissiveColor=B.Color3.FromHexString('#4de1d0');for(const [x,y,w,h]of[[-.8,1.3,.15,2.6],[.8,1.3,.15,2.6],[0,2.6,1.75,.15]]){const frame=B.MeshBuilder.CreateBox('Drawn door',{width:w,height:h,depth:.15},scene);frame.position.set(at.x+x,y,at.z+1.4);frame.material=material;frame.metadata={door:(i+1)%10};portals.push(frame);}}
 });
 scene.onPointerObservable.add(info=>{if(info.type!==B.PointerEventTypes.POINTERPICK)return;const pick=info.pickInfo,meta=pick?.pickedMesh?.metadata;if(!meta)return;
  if(meta.sticky){const v=stickies.find(s=>s.mesh===pick.pickedMesh);v?.aggregate?.body.applyImpulse(new B.Vector3(1.7,3,-1),v.mesh.getAbsolutePosition());}
  if(meta.door!==undefined){flying={from:camera.target.clone(),to:papers[meta.door].mesh.position.clone(),t:0,id:meta.door};}
  if(meta.board!==undefined&&!flying&&!ride)select(meta.board);
 });
 d.update.add(dt=>{if(flying){flying.t+=dt;camera.setTarget(B.Vector3.Lerp(flying.from,flying.to,Math.min(1,flying.t)));camera.radius=Math.max(3,camera.radius-dt*20);if(flying.t>=1){const id=flying.id;flying=null;select(id);}}
  if(ride){ride.t+=dt*.06;const n=Math.min(ride.points.length-2,Math.floor(ride.t*(ride.points.length-1)));ride.camera.position.copyFrom(ride.points[n]).addInPlace(new B.Vector3(0,.8,0));ride.camera.setTarget(ride.points[n+1]);if(ride.t>=1){scene.activeCamera=camera;ride.camera.dispose();ride.mesh.dispose();ride=null;}}
 });
 return {...d,papers,stickies,refresh(id,source){const p=papers[id],ctx=p.texture.getContext();ctx.clearRect(0,0,1024,768);ctx.drawImage(source,0,0,1024,768);p.texture.update();},
 shake(){for(const s of stickies)s.aggregate?.body.applyImpulse(new B.Vector3((Math.random()-.5)*4,2+Math.random()*2,(Math.random()-.5)*4),s.mesh.getAbsolutePosition());},
 ride(board){if(ride)return;const line=board.shapes.filter(s=>s.kind==='pen'&&s.points.length>3).at(-1);if(!line)throw Error('Draw a pen graph with at least four points first.');const pts=line.points.filter((_,i)=>i%Math.max(1,Math.floor(line.points.length/30))===0).map(([x,y])=>new B.Vector3((x/WIDTH-.5)*26,1+(1-y/HEIGHT)*6,(x/WIDTH-.5)*14));const points=B.Curve3.CreateCatmullRomSpline(pts,8).getPoints(),mesh=B.MeshBuilder.CreateTube('Graph track',{path:points,radius:.08},scene);const mat=new B.StandardMaterial('Track teal',scene);mat.emissiveColor=B.Color3.FromHexString('#3dd4c5');mesh.material=mat;const rc=new B.FreeCamera('Coaster',points[0],scene);scene.activeCamera=rc;ride={points,camera:rc,mesh,t:0};},
 focus(id){camera.setTarget(papers[id].mesh.position);camera.radius=10;}
 };
}
