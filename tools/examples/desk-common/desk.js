export async function loadScript(src){if(document.querySelector(`script[data-local="${src}"]`))return;await new Promise((ok,no)=>{const el=document.createElement('script');el.src=src;el.dataset.local=src;el.onload=ok;el.onerror=()=>no(Error('Cannot load '+src));document.head.append(el);});}
export async function createDesk(canvas,{physics=true}={}){
 await loadScript('vendor/babylonjs/babylon.js');const B=window.BABYLON;
 const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}),scene=new B.Scene(engine);scene.clearColor=B.Color4.FromHexString('#101b2bff');
 const camera=new B.ArcRotateCamera('Orbit',-Math.PI/2,.67,28,new B.Vector3(0,0,0),scene);camera.attachControl(canvas,true);camera.lowerRadiusLimit=4;camera.upperRadiusLimit=70;camera.wheelPrecision=25;camera.minZ=.1;
 const fill=new B.HemisphericLight('Sky',new B.Vector3(0,1,0),scene);fill.intensity=.65;
 const light=new B.DirectionalLight('Sun',new B.Vector3(-.4,-1,.5),scene);light.position.set(8,18,-8);light.intensity=1.2;
 const shadows=new B.ShadowGenerator(1024,light);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=16;
 const mat=new B.StandardMaterial('Desk surface',scene);mat.diffuseColor=B.Color3.FromHexString('#253a46');mat.specularColor=new B.Color3(.1,.1,.1);
 const desk=B.MeshBuilder.CreateBox('Desk',{width:45,depth:35,height:.6},scene);desk.position.y=-.45;desk.material=mat;desk.receiveShadows=true;
 const aggregates=[];
 if(physics){await loadScript('vendor/havok/HavokPhysics_umd.js');const havok=await window.HavokPhysics({locateFile:name=>'vendor/havok/'+name});scene.enablePhysics(new B.Vector3(0,-9.81,0),new B.HavokPlugin(true,havok));aggregates.push(new B.PhysicsAggregate(desk,B.PhysicsShapeType.BOX,{mass:0,restitution:.2},scene));}
 const paper=(name,width,height,paint)=>{const mesh=B.MeshBuilder.CreatePlane(name,{width,height,sideOrientation:B.Mesh.DOUBLESIDE},scene);mesh.rotation.x=Math.PI/2;
  const texture=new B.DynamicTexture(name+' texture',{width:1024,height:768},scene,false);const material=new B.StandardMaterial(name+' material',scene);material.emissiveTexture=texture;material.emissiveColor=B.Color3.White();material.disableLighting=true;material.diffuseColor=B.Color3.Black();material.specularColor=B.Color3.Black();material.backFaceCulling=false;mesh.material=material;shadows.addShadowCaster(mesh);mesh.receiveShadows=true;paint?.(texture.getContext());texture.update();return {mesh,texture,material};};
 const box=(name,pos,color='#f6d675',mass=.2)=>{const mesh=B.MeshBuilder.CreateBox(name,{width:1.1,height:.13,depth:.9},scene);mesh.position.copyFromFloats(...pos);const material=new B.StandardMaterial(name+' paint',scene);material.diffuseColor=B.Color3.FromHexString(color);mesh.material=material;shadows.addShadowCaster(mesh);
  const aggregate=physics?new B.PhysicsAggregate(mesh,B.PhysicsShapeType.BOX,{mass,restitution:.55,friction:.45},scene):null;if(aggregate)aggregates.push(aggregate);return {mesh,aggregate};};
 const update=new Set(),render=()=>{for(const fn of update)fn(Math.min(.05,engine.getDeltaTime()/1000));scene.render();};engine.runRenderLoop(render);const resize=()=>engine.resize();window.addEventListener('resize',resize);
 return {B,engine,scene,camera,shadows,paper,box,update,resize,setActive(on){engine.stopRenderLoop(render);if(on)engine.runRenderLoop(render);},dispose(){window.removeEventListener('resize',resize);for(const a of aggregates)a.dispose();scene.dispose();engine.dispose();}};
}
export function download(name,content,type='application/json'){const blob=content instanceof Blob?content:new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
