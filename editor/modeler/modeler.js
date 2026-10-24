// Nord 3D Modeler: polygon mesh editor + pixel texture painter + UV editor for small asset changes.
// Mesh editing core ported from BlockSmith (src/mesh-editor.js, shared/mesh-model.js); texture painter and UV editor are new.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {edgeKey,edgesOf,normal,unwrap,pack,triangles,geometry,primitive,validate,weld,obj} from './mesh-model.js';

const root=document.getElementById('app');
root.innerHTML=`<header id="top"><strong>3D Modeler</strong><input id="mesh-name" value="mesh" spellcheck="false" aria-label="Mesh name (file name in models/)"><button data-action="new">New</button><button data-action="open-project">Open…</button><button data-action="save" class="pri">Save</button><span class="sep"></span><button data-action="undo">Undo</button><button data-action="redo">Redo</button><span class="sep"></span><button data-action="open">Import file</button><span class="spacer" id="mesh-where">models/mesh.mesh.json</span></header>
<div class="layout"><aside class="mesh-tools">
 <h3>Create</h3><div class="mesh-buttons">${['Cube','Plane','Cylinder','Sphere'].map(v=>`<button data-primitive="${v.toLowerCase()}">${v}</button>`).join('')}</div><button data-action="draw">Draw polygon on grid</button><button data-action="finish">Finish polygon</button><button data-action="vertex">Add vertex at X/Y/Z</button><button data-action="fill">Add face / fill boundary</button><button data-action="importobj">Import OBJ…</button><p>Draw: click the ground grid, then finish. Faces need 3+ ordered vertices.</p>
 <h3>Selection</h3><select aria-label="Selection mode" id="mesh-mode"><option value="face">Face</option><option value="edge">Edge</option><option value="vertex">Vertex</option></select><div class="mesh-buttons"><button data-action="all">Select all</button><button data-action="invert">Invert</button><button data-action="none">Deselect</button><button data-action="loop">Edge loop</button></div><p>Click to select, Shift-click to extend. Orbit: drag · Pan: right-drag · Zoom: scroll.</p>
 <h3>Transform</h3><select id="mesh-transform" aria-label="Transform"><option value="translate">Move</option><option value="rotate">Rotate (degrees)</option><option value="scale">Scale (factor)</option></select><div class="mesh-xyz">${['X','Y','Z'].map(a=>`<label>${a}<input id="mesh-${a.toLowerCase()}" type="number" value="0" step="0.1"></label>`).join('')}</div><button data-action="transform">Apply numeric transform</button><label><span>Grid snap</span><input id="mesh-snap" type="checkbox"></label><label><span>Grid step</span><input id="mesh-step" type="number" value="0.25" min="0.001" step="0.05"></label>
 <h3>Edit mesh</h3><label><span>Amount</span><input id="mesh-amount" type="number" value="0.25" step="0.05"></label><div class="mesh-buttons">${[['extrude','Extrude'],['inset','Inset'],['loopcut','Loop cut'],['cut','Split edge'],['edge','Add edge / cut face'],['split','Detach faces'],['merge','Merge vertices'],['weld','Weld / doubles'],['optimize','Optimize'],['delete','Delete'],['flip','Flip normal'],['triangulate','Triangulate'],['bevel','Face bevel'],['subdivide','Subdivide all'],['mirrorx','Mirror X'],['mirrory','Mirror Y'],['mirrorz','Mirror Z'],['ground','Center on ground']].map(([a,b])=>`<button data-action="${a}">${b}</button>`).join('')}</div><p>Subdivide splits every face into quads. Mirror duplicates the mesh across the origin plane and welds the seam. Inset / face bevel amount: 0–0.49. Weld amount: distance tolerance. Loop cut starts from one quad edge.</p>
</aside><div class="mesh-center"><div class="mesh-viewbar"><div class="tabs"><button data-view="3d" class="on">3D</button><button data-view="uv">UV editor</button><button data-view="tex">Texture</button></div><label><input id="mesh-wire" type="checkbox"> Wireframe</label><label><input id="mesh-grid" type="checkbox" checked> Grid</label><button data-action="fit">Fit</button><label title="Left-drag paints the texture straight onto the model (Texture tab colour and tool)"><input id="paint3d" type="checkbox"> Paint on model</label><span id="mesh-count"></span></div>
<div class="mesh-stage"><div class="mesh-viewport"></div>
<div class="pane" id="uvpane"><div class="bar"><label>Drag <select id="uvmode"><option value="face">faces</option><option value="point">points</option></select></label><label><input id="uvsnap" type="checkbox"> snap to texel</label><button data-action="uvflipu">Flip U</button><button data-action="uvflipv">Flip V</button><button data-action="uvrot90">Rotate 90°</button><button data-action="uvfit">Fit to 0–1</button><button data-action="island">Select island</button><button data-action="unwrap">Auto unwrap</button><button data-action="pack">Pack</button></div><div class="canvasbox"><canvas id="uvbig" width="640" height="640"></canvas></div><p>Click a face to select (Shift extends), drag to move the selection. “points” moves single UV corners. Selection is shared with the 3D view.</p></div>
<div class="pane" id="texpane"><div class="bar"><button data-tool="pencil" class="on">Pencil</button><button data-tool="eraser">Eraser</button><button data-tool="fill">Fill</button><button data-tool="pick">Picker</button><input id="texcolor" type="color" value="#a8c980"><label>Size <input id="texbrush" type="number" value="1" min="1" max="16" style="width:56px"></label><label><input id="texmirror" type="checkbox"> Mirror X</label><label><input id="texuv" type="checkbox" checked> UV overlay</label></div>
<div class="bar"><label>Texture <select id="texsize"><option>16</option><option>32</option><option selected>64</option><option>128</option><option>256</option><option>512</option></select></label><button data-action="texnew">New blank</button><button data-action="texfill">Fill with colour</button><button data-action="texpng">Save PNG to project</button><button data-action="texpick">Load project PNG…</button><button data-action="texload">Load image file</button><button data-action="cleartexture">Remove texture</button></div>
<div class="canvasbox"><canvas id="texview" width="64" height="64"></canvas><canvas id="texoverlay" width="640" height="640" style="pointer-events:none"></canvas></div><div class="swatches" id="swatches"></div></div></div></div>
<aside class="mesh-side">
 <h3>Material</h3><label><span>Solid colour</span><input type="color" id="mesh-color" value="#a8c980"></label><button data-action="color">Apply solid colour</button><button data-action="paint">Paint selected vertices</button><label><span>Checker preview</span><input type="checkbox" id="mesh-checker"></label><p>Flat shading is always on. Vertex paint multiplies the solid colour; use white for pure vertex colours.</p>
 <h3>UV mapping</h3><div class="mesh-buttons"><button data-action="seam">Mark seam</button><button data-action="clearseam">Clear seam</button></div><canvas class="mesh-uv" width="256" height="256" aria-label="UV layout; click to select a face island"></canvas><label><span>UV move U</span><input id="mesh-u" type="number" value="0" step="0.05"></label><label><span>UV move V</span><input id="mesh-v" type="number" value="0" step="0.05"></label><label><span>UV rotate °</span><input id="mesh-uv-angle" type="number" value="0" step="15"></label><label><span>UV scale</span><input id="mesh-uv-scale" type="number" value="1" step="0.1"></label><button data-action="uv">Transform selected UVs</button>
 <h3>Export</h3><label><span>Up axis</span><select id="mesh-axis"><option value="y">Y up</option><option value="z">Z up (baked)</option></select></label><label><span>Scale</span><input id="mesh-export-scale" type="number" value="1" min="0.0001" step="0.1"></label><div class="mesh-buttons"><button data-action="glb">GLB</button><button data-action="gltf">glTF</button><button data-action="obj">OBJ + MTL</button></div><p>Exports go to <code>models/</code> in the project (or download when run outside the editor). GLB/glTF include texture and vertex colours.</p>
</aside></div><div id="mesh-status" role="status">Add a primitive or draw a polygon to begin.</div>
<input type="file" id="mesh-file" accept=".json" hidden><input type="file" id="mesh-obj" accept=".obj" hidden><input type="file" id="mesh-image" accept="image/png,image/jpeg,image/webp" hidden>`;
const $=s=>root.querySelector(s),status=t=>$('#mesh-status').textContent=t;
let model={format:'nord-mesh-1',vertices:[],faces:[],colors:[],seams:[],color:'#a8c980',texture:null};
try{const saved=localStorage.getItem('nord.mesh-draft');if(saved)model=validate(JSON.parse(saved));}catch{status('Local draft could not be read. Open a saved mesh to restore it.');}

 let selection=new Set(),mode='face',drawing=false,drawIds=[],undo=[],redo=[],mesh=null,markers=null,lines=null,highlight=null,texture=null,disposed=false,dragStart=null;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#202724');scene.add(new THREE.HemisphereLight(0xffffff,0x556655,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(5,9,6);scene.add(light);const grid=new THREE.GridHelper(100,100,0x779977,0x384438);scene.add(grid);
 const view=$('.mesh-viewport'),renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));view.append(renderer.domElement);const camera=new THREE.PerspectiveCamera(45,1,.01,10000);camera.position.set(6,5,7);const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;
 const pivot=new THREE.Object3D();scene.add(pivot);const control=new TransformControls(camera,renderer.domElement);scene.add(control.getHelper());
 const checkerCanvas=document.createElement('canvas');checkerCanvas.width=checkerCanvas.height=128;const cc=checkerCanvas.getContext('2d');for(let y=0;y<8;y++)for(let x=0;x<8;x++){cc.fillStyle=(x+y)%2?'#eee':'#555';cc.fillRect(x*16,y*16,16,16);}const checker=new THREE.CanvasTexture(checkerCanvas);checker.colorSpace=THREE.SRGBColorSpace;checker.wrapS=checker.wrapT=THREE.RepeatWrapping;
 const selectedVertices=()=>{const ids=new Set();for(const id of selection){if(mode==='vertex')ids.add(+id);else if(mode==='edge'){id.split(':').map(Number).forEach(i=>ids.add(i));}else model.faces[id]?.v.forEach(i=>ids.add(i));}return [...ids];};
 const selectedFaces=()=>mode==='face'?[...selection].filter(i=>model.faces[i]):[];
 const checkpoint=()=>{undo.push(JSON.stringify(model));while(undo.length>1&&(undo.length>80||undo.reduce((n,s)=>n+s.length,0)>32*1024*1024))undo.shift();redo=[];};
 function saveLocal(){try{localStorage.setItem('nord.mesh-draft',JSON.stringify(model));}catch{status('Draft exceeds local storage. Use Save mesh to keep a portable copy.');}}
 function dispose(obj){if(!obj)return;scene.remove(obj);obj.geometry?.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material])m?.dispose();}
 function paintUV(){drawUVs();}
 function rebuild(){dispose(mesh);dispose(markers);dispose(lines);dispose(highlight);mesh=new THREE.Mesh(geometry(model),new THREE.MeshStandardMaterial({color:model.color,flatShading:true,side:THREE.DoubleSide,wireframe:$('#mesh-wire').checked,vertexColors:true,map:$('#mesh-checker').checked?checker:texture}));scene.add(mesh);
 const verts=selectedVertices(),set=new Set(verts),positions=model.vertices.flat(),colors=model.vertices.flatMap((_,i)=>set.has(i)?[1,1,.1]:[.5,.85,1]);const points=new THREE.BufferGeometry();points.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));points.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));markers=new THREE.Points(points,new THREE.PointsMaterial({size:8,sizeAttenuation:false,vertexColors:true,depthTest:false}));markers.visible=mode==='vertex';markers.renderOrder=3;scene.add(markers);
 const ep=[],ec=[];for(const [key,e]of edgesOf(model)){const color=mode==='edge'&&selection.has(key)?[1,1,.1]:model.seams.includes(key)?[1,.3,.3]:[.12,.2,.16];e.v.forEach(v=>{ep.push(...model.vertices[v]);ec.push(...color);});}const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));eg.setAttribute('color',new THREE.Float32BufferAttribute(ec,3));lines=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.7}));lines.renderOrder=2;scene.add(lines);
 const selectedModel={...model,faces:selectedFaces().map(i=>model.faces[i])};highlight=new THREE.Mesh(geometry(selectedModel),new THREE.MeshBasicMaterial({color:0xd8ff63,side:THREE.DoubleSide,transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));scene.add(highlight);
 if(!control.dragging){control.detach();if(verts.length){pivot.position.set(0,0,0);verts.forEach(i=>pivot.position.add(new THREE.Vector3(...model.vertices[i])));pivot.position.divideScalar(verts.length);pivot.quaternion.identity();pivot.scale.set(1,1,1);pivot.updateMatrixWorld();control.attach(pivot);}}
 $('#mesh-count').textContent=`${model.vertices.length} vertices · ${edgesOf(model).size} edges · ${model.faces.length} faces · ${mesh.geometry.userData.faceIds.length} triangles`;paintUV();}
 const value=id=>{const n=Number($(id).value);if(!Number.isFinite(n))throw Error('Enter finite numeric values.');return n;};
 function syncSnap(){const step=value('#mesh-step');if(step<=0)throw Error('Grid step must be positive.');const enabled=$('#mesh-snap').checked;control.setTranslationSnap(enabled?step:null);control.setRotationSnap(enabled?THREE.MathUtils.degToRad(15):null);control.setScaleSnap(enabled ? .1 : null);}
 control.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(e.value){checkpoint();pivot.updateMatrixWorld();dragStart={inverse:pivot.matrixWorld.clone().invert(),vertices:selectedVertices().map(i=>[i,new THREE.Vector3(...model.vertices[i])])};}else{dragStart=null;rebuild();saveLocal();}});
 control.addEventListener('objectChange',()=>{if(!dragStart)return;pivot.updateMatrixWorld();const matrix=pivot.matrixWorld.clone().multiply(dragStart.inverse);for(const [i,p]of dragStart.vertices)model.vertices[i]=p.clone().applyMatrix4(matrix).toArray();rebuild();});
 function fit(){if(!model.vertices.length)return;const box=new THREE.Box3().setFromPoints(model.vertices.map(p=>new THREE.Vector3(...p))),center=box.getCenter(new THREE.Vector3()),size=Math.max(box.getSize(new THREE.Vector3()).length(),1);orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.8,1).normalize().multiplyScalar(size*1.6));orbit.update();}
 const observer=new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(view);
 let frame;function animate(){if(disposed)return;frame=requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera);}animate();
 const ray=new THREE.Raycaster();let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(busy||paintingOn()||!down||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||control.axis||control.dragging)return;const rect=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);
 if(drawing){const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!p)return;if($('#mesh-snap').checked){const step=value('#mesh-step');if(step<=0)return;p.toArray().forEach((v,a)=>p.setComponent(a,Math.round(v/step)*step));}checkpoint();drawIds.push(model.vertices.length);model.vertices.push(p.toArray());rebuild();saveLocal();status(`${drawIds.length} polygon points. Click Finish polygon when ready.`);return;}
 let id;if(mode==='vertex'){let distance=12;model.vertices.forEach((p,i)=>{const q=new THREE.Vector3(...p).project(camera);if(q.z< -1||q.z>1)return;const d=Math.hypot((q.x-mouse.x)*rect.width/2,(q.y-mouse.y)*rect.height/2);if(d<distance){distance=d;id=i;}});}else if(mode==='edge'){let distance=10;for(const [key,edge]of edgesOf(model)){const points=edge.v.map(i=>new THREE.Vector3(...model.vertices[i]).project(camera));if(points.some(p=>p.z< -1||p.z>1))continue;const [a,b]=points.map(p=>new THREE.Vector2((p.x-mouse.x)*rect.width/2,(p.y-mouse.y)*rect.height/2));const ab=b.clone().sub(a),t=THREE.MathUtils.clamp(-a.dot(ab)/(ab.lengthSq()||1),0,1),d=a.clone().addScaledVector(ab,t).length();if(d<distance){distance=d;id=key;}}}else{const hit=ray.intersectObject(mesh)[0];if(hit)id=mesh.geometry.userData.faceIds[hit.faceIndex];}if(!e.shiftKey)selection.clear();if(id!==undefined){if(selection.has(id))selection.delete(id);else selection.add(id);}rebuild();});
 function island(seed){const result=new Set([seed]),queue=[seed],edges=edgesOf(model);while(queue.length){const f=model.faces[queue.pop()];f.v.forEach((a,i)=>{const key=edgeKey(a,f.v[(i+1)%f.v.length]);if(model.seams.includes(key))return;for(const next of edges.get(key).faces){if(result.has(next))continue;const other=model.faces[next],b=f.v[(i+1)%f.v.length];const same=[a,b].every(v=>{const u=f.uv[f.v.indexOf(v)],w=other.uv[other.v.indexOf(v)];return Math.hypot(u[0]-w[0],u[1]-w[1])<1e-6;});if(same){result.add(next);queue.push(next);}}});}return result;}
 $('.mesh-uv').onclick=e=>{const rect=e.target.getBoundingClientRect(),p=new THREE.Vector2((e.clientX-rect.left)/rect.width,1-(e.clientY-rect.top)/rect.height);let found;model.faces.forEach((f,i)=>{if(triangles(model,f).some(t=>{const [a,b,c]=t.map(j=>new THREE.Vector2(...f.uv[j]));const cross=(x,y,z)=>(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x);const v=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];return v.every(n=>n>=0)||v.every(n=>n<=0);}))found=i;});if(found!==undefined){mode='face';$('#mesh-mode').value=mode;selection=island(found);rebuild();}};
 $('#mesh-mode').onchange=e=>{mode=e.target.value;selection.clear();drawing=false;rebuild();};$('#mesh-transform').onchange=e=>{control.setMode(e.target.value);for(const a of ['x','y','z'])$(`#mesh-${a}`).value=e.target.value==='scale'?1:0;};$('#mesh-snap').onchange=$('#mesh-step').onchange=()=>{try{syncSnap();}catch(e){status(e.message);}};$('#mesh-wire').onchange=$('#mesh-checker').onchange=rebuild;$('#mesh-grid').onchange=e=>grid.visible=e.target.checked;
 function addFace(v,uv){if(v.length>=3)model.faces.push({v,uv:uv||v.map(()=>[0,0])});}
 function extrude(inset=false,bevel=false){const ids=selectedFaces();if(!ids.length)throw Error('Select faces first.');const amount=value('#mesh-amount');if(inset&&(amount<=0||amount>=.5))throw Error('Inset / face bevel requires an amount between 0 and 0.5.');for(const id of ids){const f=model.faces[id],n=normal(model,f),center=new THREE.Vector3();f.v.forEach(v=>center.add(new THREE.Vector3(...model.vertices[v])));center.divideScalar(f.v.length);const next=f.v.map(v=>{const p=new THREE.Vector3(...model.vertices[v]);if(inset)p.lerp(center,amount);if(!inset||bevel)p.addScaledVector(n,amount);model.vertices.push(p.toArray());const ni=model.vertices.length-1;model.colors[ni]=model.colors[v]||[1,1,1];return ni;});f.v.forEach((v,j)=>{const k=(j+1)%f.v.length;addFace([v,f.v[k],next[k],next[j]],[[0,0],[1,0],[1,1],[0,1]]);});f.v=next;}}
 function splitEdges(keys){const midpoints=new Map();for(const key of keys){const [a,b]=key.split(':').map(Number),index=model.vertices.length;model.vertices.push(model.vertices[a].map((v,i)=>(v+model.vertices[b][i])/2));model.colors[index]=(model.colors[a]||[1,1,1]).map((v,i)=>(v+(model.colors[b]||[1,1,1])[i])/2);midpoints.set(key,index);}for(const f of model.faces){const v=[],uv=[];f.v.forEach((a,i)=>{const j=(i+1)%f.v.length,key=edgeKey(a,f.v[j]);v.push(a);uv.push(f.uv[i]);if(midpoints.has(key)){v.push(midpoints.get(key));uv.push(f.uv[i].map((n,k)=>(n+f.uv[j][k])/2));}});f.v=v;f.uv=uv;}model.seams=model.seams.flatMap(k=>midpoints.has(k)?k.split(':').map(Number).map(v=>edgeKey(v,midpoints.get(k))):[k]);return midpoints;}
 function loopcut(){if(mode!=='edge'||selection.size!==1)throw Error('Select one edge of a quad to start a loop cut.');const edges=edgesOf(model),queue=[...selection],cut=new Set(queue),quads=new Map();while(queue.length){const key=queue.pop();for(const id of edges.get(key)?.faces||[]){const f=model.faces[id];if(f.v.length!==4||quads.has(id))continue;const j=f.v.findIndex((v,i)=>edgeKey(v,f.v[(i+1)%4])===key),opposite=edgeKey(f.v[(j+2)%4],f.v[(j+3)%4]);quads.set(id,[key,opposite]);if(!cut.has(opposite)){cut.add(opposite);queue.push(opposite);}}}if(!quads.size)throw Error('Loop cut needs quad faces.');const mids=splitEdges(cut);for(const [id,[a,b]]of quads){const f=model.faces[id],ia=f.v.indexOf(mids.get(a)),ib=f.v.indexOf(mids.get(b));const path=(start,end)=>{const v=[],uv=[];for(let i=start;;i=(i+1)%f.v.length){v.push(f.v[i]);uv.push(f.uv[i]);if(i===end)break;}return {v,uv};};model.faces[id]=path(ia,ib);model.faces.push(path(ib,ia));}}
 function boundaryFace(){if(mode==='vertex'){const ids=[...selection];if(ids.length<3)throw Error('Select 3+ vertices in boundary order.');addFace(ids);unwrap(model,[model.faces.length-1],false);return;}if(mode!=='edge'||selection.size<3)throw Error('Select an entire boundary edge loop or 3+ ordered vertices.');const edges=edgesOf(model),keys=new Set(selection),first=edges.get([...keys][0]);if([...keys].some(k=>edges.get(k)?.faces.length!==1))throw Error('Fill needs boundary edges with exactly one adjacent face.');const source=model.faces[first.faces[0]],j=source.v.findIndex((v,i)=>edgeKey(v,source.v[(i+1)%source.v.length])===[...keys][0]);const v=[source.v[(j+1)%source.v.length],source.v[j]];keys.delete([...keys][0]);while(keys.size){const next=[...keys].find(k=>edges.get(k).v.includes(v.at(-1)));if(!next)throw Error('Select one connected closed boundary.');const pair=edges.get(next).v,end=pair.find(i=>i!==v.at(-1));keys.delete(next);if(end===v[0]){if(keys.size)throw Error('Select only one boundary loop.');break;}if(v.includes(end))throw Error('Boundary branches or intersects itself.');v.push(end);}if(!edges.has(edgeKey(v.at(-1),v[0])))throw Error('Boundary is not closed.');addFace(v);unwrap(model,[model.faces.length-1],false);}

// ---------- project files (models/ in the open project, via the jailed /api/fpsc/save) ----------
const base=()=>$('#mesh-name').value.trim().replace(/\.mesh\.json$|\.json$/,'').replace(/[^\w-]+/g,'_')||'mesh';
const updateWhere=()=>$('#mesh-where').textContent=`models/${base()}.mesh.json`;
$('#mesh-name').oninput=updateWhere;
function download(data,name,type='application/octet-stream'){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function output(file,data,type){
 try{const r=await fetch('/api/fpsc/save?path='+encodeURIComponent('models/'+file),{method:'POST',headers:{'x-nord-fpsc':'1'},body:data});if(r.ok){status('Saved models/'+file);return true;}}catch{}
 download(data,file,type);status(`Downloaded ${file} (the project save API is not available here).`);return false;
}
const canvasBlob=c=>new Promise((ok,bad)=>c.toBlob(b=>b?ok(b):bad(Error('Could not encode PNG.')),'image/png'));
async function listModels(ext){try{const r=await fetch('/api/fpsc/ls?dir=models');if(!r.ok)return [];return (await r.json()).filter(e=>!e.dir&&e.name.endsWith(ext)).map(e=>e.name);}catch{return [];}}
function pick(title,names){return new Promise(resolve=>{const back=document.createElement('div');back.className='modal';back.innerHTML='<div class="box"><strong></strong><div class="list"></div><button>Cancel</button></div>';back.querySelector('strong').textContent=title;const list=back.querySelector('.list'),done=v=>{back.remove();resolve(v);};if(!names.length)list.textContent='Nothing found in models/ yet.';for(const n of names){const b=document.createElement('button');b.textContent=n;b.onclick=()=>done(n);list.append(b);}back.querySelector('.box>button').onclick=()=>done(null);document.body.append(back);});}
const readDataUrl=blob=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>bad(Error('Could not read the image.'));r.readAsDataURL(blob);});
async function adopt(data,name){checkpoint();model=data;selection.clear();drawing=false;drawIds=[];if(name)$('#mesh-name').value=name;updateWhere();await loadTexture();fit();saveLocal();}

// ---------- texture painter (2D canvas, pixel art) ----------
const texCanvas=$('#texview'),tctx=texCanvas.getContext('2d',{willReadFrequently:true}),texOverlay=$('#texoverlay'),uvBig=$('#uvbig');
let tool='pencil',strokeLast=null,stroking=false,paintOnModel=false;
const loadImage=url=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>bad(Error('Could not read the image.'));im.src=url;});
function makeTexture(){const t=new THREE.CanvasTexture(texCanvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.NearestFilter;return t;}
async function loadTexture(){
 texture?.dispose();texture=null;
 if(model.texture){const im=await loadImage(model.texture);texCanvas.width=im.width;texCanvas.height=im.height;tctx.clearRect(0,0,im.width,im.height);tctx.drawImage(im,0,0);$('#texsize').value=[16,32,64,128,256,512].includes(im.width)?String(im.width):$('#texsize').value;texture=makeTexture();}
 else tctx.clearRect(0,0,texCanvas.width,texCanvas.height);
 if(!disposed){$('#mesh-color').value=model.color;rebuild();}
}
function ensureTexture(){if(model.texture)return;model.texture=texCanvas.toDataURL('image/png');texture=makeTexture();rebuild();}
function commitTexture(){model.texture=texCanvas.toDataURL('image/png');if(texture)texture.needsUpdate=true;saveLocal();drawUVs();}
const hexRgb=hex=>{const c=parseInt(hex.slice(1),16);return [c>>16,(c>>8)&255,c&255];};
function dab(x,y){
 const n=Math.max(1,Math.min(16,+$('#texbrush').value|0)),h=Math.floor(n/2),spots=[x-h];if($('#texmirror').checked)spots.push(texCanvas.width-1-(x-h)-(n-1));
 tctx.fillStyle=$('#texcolor').value;for(const sx of spots){if(tool==='eraser')tctx.clearRect(sx,y-h,n,n);else tctx.fillRect(sx,y-h,n,n);}
}
function strokeLine(a,b){let [x0,y0]=a;const [x1,y1]=b,dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;for(;;){dab(x0,y0);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}}
function floodFill(x,y){
 const w=texCanvas.width,h=texCanvas.height;if(x<0||y<0||x>=w||y>=h)return;const img=tctx.getImageData(0,0,w,h),d=img.data,i0=(y*w+x)*4,[tr,tg,tb,ta]=[d[i0],d[i0+1],d[i0+2],d[i0+3]],[r,g,b]=hexRgb($('#texcolor').value);
 if(tr===r&&tg===g&&tb===b&&ta===255)return;const stack=[x,y];
 while(stack.length){const cy=stack.pop(),cx=stack.pop();if(cx<0||cy<0||cx>=w||cy>=h)continue;const i=(cy*w+cx)*4;if(d[i]!==tr||d[i+1]!==tg||d[i+2]!==tb||d[i+3]!==ta)continue;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;stack.push(cx+1,cy,cx-1,cy,cx,cy+1,cx,cy-1);}
 tctx.putImageData(img,0,0);
}
function pickColor(x,y){if(x<0||y<0||x>=texCanvas.width||y>=texCanvas.height)return;const [r,g,b,a]=tctx.getImageData(x,y,1,1).data;if(a)$('#texcolor').value='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}
function strokeStart(x,y){if(tool==='pick'){pickColor(x,y);return false;}checkpoint();ensureTexture();stroking=true;strokeLast=[x,y];if(tool==='fill')floodFill(x,y);else dab(x,y);if(texture)texture.needsUpdate=true;return true;}
function strokeMove(x,y,far){if(!stroking||tool==='fill'||tool==='pick')return;if(far)dab(x,y);else strokeLine(strokeLast,[x,y]);strokeLast=[x,y];if(texture)texture.needsUpdate=true;}
function strokeEnd(){if(!stroking)return;stroking=false;commitTexture();status('Painted. Save to keep the texture in the mesh; “Save PNG to project” writes a separate file.');}
const texPos=e=>{const r=texCanvas.getBoundingClientRect();return [Math.floor((e.clientX-r.left)/r.width*texCanvas.width),Math.floor((e.clientY-r.top)/r.height*texCanvas.height)];};
texCanvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const [x,y]=texPos(e);if(strokeStart(x,y))texCanvas.setPointerCapture(e.pointerId);});
texCanvas.addEventListener('pointermove',e=>{const [x,y]=texPos(e);strokeMove(x,y,false);});
texCanvas.addEventListener('pointerup',strokeEnd);texCanvas.addEventListener('pointercancel',strokeEnd);
root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;root.querySelectorAll('[data-tool]').forEach(o=>o.classList.toggle('on',o===b));});
for(const c of ['#000000','#ffffff','#7f7f7f','#bf616a','#d08770','#ebcb8b','#a3be8c','#88c0d0','#5e81ac','#b48ead','#8b5a2b','#3b4252','#a8c980','#f4a261','#2a9d8f','#e76f51']){const i=document.createElement('i');i.style.background=c;i.onclick=()=>$('#texcolor').value=c;$('#swatches').append(i);}
// painting straight onto the model: raycast gives the UV under the cursor
const paintUV3=e=>{const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const uv=ray.intersectObject(mesh)[0]?.uv;if(!uv)return null;const w=texCanvas.width,h=texCanvas.height,fx=((uv.x%1)+1)%1,fy=((uv.y%1)+1)%1;return [Math.min(w-1,Math.floor(fx*w)),Math.min(h-1,Math.floor((1-fy)*h))];};
const paintingOn=()=>$('#paint3d').checked;
renderer.domElement.addEventListener('pointerdown',e=>{if(!paintingOn()||e.button!==0||control.axis||busy)return;const p=paintUV3(e);if(!p)return;orbit.enabled=false;paintOnModel=true;if(!strokeStart(...p)){paintOnModel=false;orbit.enabled=true;}},true);
window.addEventListener('pointermove',e=>{if(!paintOnModel)return;const p=paintUV3(e);if(!p)return;strokeMove(p[0],p[1],Math.hypot(p[0]-strokeLast[0],p[1]-strokeLast[1])>texCanvas.width/4);});
window.addEventListener('pointerup',()=>{if(!paintOnModel)return;paintOnModel=false;orbit.enabled=true;strokeEnd();});

// ---------- UV editor ----------
function drawUVCanvas(canvas,kind){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
 if(kind!=='overlay'){ctx.fillStyle='#101a14';ctx.fillRect(0,0,W,H);}
 if(kind==='big'&&model.texture){ctx.globalAlpha=.55;ctx.imageSmoothingEnabled=false;ctx.drawImage(texCanvas,0,0,W,H);ctx.globalAlpha=1;}
 model.faces.forEach((f,i)=>{const sel=mode==='face'&&selection.has(i);ctx.beginPath();f.uv.forEach(([u,v],j)=>ctx[j?'lineTo':'moveTo'](u*W,(1-v)*H));ctx.closePath();if(sel){ctx.fillStyle='rgba(231,255,101,.25)';ctx.fill();}ctx.strokeStyle=sel?'#e7ff65':kind==='overlay'?'rgba(255,255,255,.75)':'#799b8a';ctx.stroke();});
 if(kind==='big'&&$('#uvmode').value==='point'){ctx.fillStyle='#88c0d0';for(const f of model.faces)for(const [u,v] of f.uv)ctx.fillRect(u*W-2,(1-v)*H-2,5,5);}
}
function drawUVs(){
 drawUVCanvas($('.mesh-uv'),'small');
 if($('#uvpane').classList.contains('show'))drawUVCanvas(uvBig,'big');
 if($('#texpane').classList.contains('show')&&$('#texuv').checked)drawUVCanvas(texOverlay,'overlay');else texOverlay.getContext('2d').clearRect(0,0,texOverlay.width,texOverlay.height);
}
const inTri=(a,b,c,p)=>{const cr=(x,y,z)=>(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x),v=[cr(a,b,p),cr(b,c,p),cr(c,a,p)];return v.every(n=>n>=0)||v.every(n=>n<=0);};
function faceAt(p){let found;model.faces.forEach((f,i)=>{if(triangles(model,f).some(t=>inTri(...t.map(j=>new THREE.Vector2(...f.uv[j])),p)))found=i;});return found;}
const uvPos=e=>{const r=uvBig.getBoundingClientRect();return [(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height];};
let uvDrag=null;
uvBig.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;const [u,v]=uvPos(e);
 if($('#uvmode').value==='point'){
  const tol=8/uvBig.getBoundingClientRect().width;let best=null,bd=tol;
  for(const f of model.faces)for(const p of f.uv){const d=Math.hypot(p[0]-u,p[1]-v);if(d<bd){bd=d;best=p;}}
  if(!best)return;const ref=[...best],targets=[];
  for(const f of model.faces)f.uv.forEach((p,ci)=>{if(Math.hypot(p[0]-ref[0],p[1]-ref[1])<1e-5)targets.push([f,ci,[...p]]);});
  uvDrag={targets,start:[u,v],moved:false};
 }else{
  const hit=faceAt(new THREE.Vector2(u,v));
  if(hit===undefined){if(!e.shiftKey&&selection.size){selection.clear();rebuild();}return;}
  if(mode!=='face'){mode='face';$('#mesh-mode').value='face';selection.clear();}
  if(!selection.has(hit)){if(!e.shiftKey)selection.clear();selection.add(hit);rebuild();}
  uvDrag={targets:[...selection].flatMap(i=>model.faces[i].uv.map((p,ci)=>[model.faces[i],ci,[...p]])),start:[u,v],moved:false};
 }
 uvBig.setPointerCapture(e.pointerId);
});
uvBig.addEventListener('pointermove',e=>{
 if(!uvDrag)return;const [u,v]=uvPos(e);let du=u-uvDrag.start[0],dv=v-uvDrag.start[1];
 if($('#uvsnap').checked){du=Math.round(du*texCanvas.width)/texCanvas.width;dv=Math.round(dv*texCanvas.height)/texCanvas.height;}
 if(!uvDrag.moved){if(!du&&!dv)return;checkpoint();uvDrag.moved=true;}
 for(const [f,ci,o] of uvDrag.targets)f.uv[ci]=[o[0]+du,o[1]+dv];
 rebuild();
});
const uvEnd=()=>{if(uvDrag?.moved)saveLocal();uvDrag=null;};
uvBig.addEventListener('pointerup',uvEnd);uvBig.addEventListener('pointercancel',uvEnd);
$('#uvmode').onchange=drawUVs;$('#texuv').onchange=drawUVs;

// ---------- view tabs ----------
function setView(v){
 root.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
 $('#uvpane').classList.toggle('show',v==='uv');$('#texpane').classList.toggle('show',v==='tex');
 $('.mesh-viewport').style.display=v==='3d'?'':'none';drawUVs();
}
root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

// ---------- actions that do not touch the mesh topology ----------
async function extra(name){
 if(name==='open-project'){const n=await pick('Open mesh from models/',await listModels('.mesh.json'));if(!n)return true;const r=await fetch('/models/'+encodeURIComponent(n),{cache:'no-store'});if(!r.ok)throw Error('Could not read models/'+n);await adopt(validate(await r.json()),n.replace(/\.mesh\.json$/,''));status('Opened models/'+n);return true;}
 if(name==='texnew'||name==='texfill'){
  const size=name==='texnew'?+$('#texsize').value:texCanvas.width;
  if(model.texture&&name==='texnew'&&!await askYes('Replace the current texture with a new blank one?','Replace'))return true;
  checkpoint();texCanvas.width=texCanvas.height=size;tctx.fillStyle=$('#texcolor').value;tctx.fillRect(0,0,size,size);model.texture=texCanvas.toDataURL('image/png');await loadTexture();saveLocal();status(`Texture ${size}×${size} filled. Paint in this tab or with “Paint on model”.`);return true;
 }
 if(name==='texpng'){if(!model.texture)throw Error('Paint or load a texture first.');await output(base()+'.png',await canvasBlob(texCanvas));return true;}
 if(name==='texpick'){const n=await pick('Load texture from models/',await listModels('.png'));if(!n)return true;const r=await fetch('/models/'+encodeURIComponent(n),{cache:'no-store'});if(!r.ok)throw Error('Could not read models/'+n);const blob=await r.blob();if(blob.size>8*1024*1024)throw Error('Choose a texture smaller than 8 MB.');checkpoint();model.texture=await readDataUrl(blob);await loadTexture();saveLocal();return true;}
 if(name==='importobj'){$('#mesh-obj').click();return true;}
 if(name==='texload'){$('#mesh-image').click();return true;}
 return false;
}

 async function action(name){
 if(await extra(name))return;
 if(name==='new'){checkpoint();model={format:'nord-mesh-1',vertices:[],faces:[],colors:[],seams:[],color:'#ffffff',texture:null};selection.clear();drawIds=[];drawing=false;await loadTexture();saveLocal();status('New empty mesh. The previous draft can be recovered with Undo.');return;}
 if(name==='save'&&(ctx.file||ctx.entity)){await saveForScene();return;}if(name==='save'){await output(base()+'.mesh.json',JSON.stringify(model,null,2),'application/json');return;}if(name==='open'){$('#mesh-file').click();return;}if(name==='texture'){$('#mesh-image').click();return;}if(name==='fit'){fit();return;}
 if(!['draw','finish'].includes(name)){drawing=false;drawIds=[];}
 if(name==='undo'||name==='redo'){const source=name==='undo'?undo:redo,target=name==='undo'?redo:undo;if(!source.length)return;target.push(JSON.stringify(model));model=JSON.parse(source.pop());selection.clear();drawIds=[];drawing=false;await loadTexture();saveLocal();return;}
 if(name==='all'||name==='invert'||name==='none'){const ids=mode==='vertex'?model.vertices.map((_,i)=>i):mode==='face'?model.faces.map((_,i)=>i):[...edgesOf(model).keys()];selection=name==='none'?new Set():new Set(ids.filter(i=>name==='all'||!selection.has(i)));rebuild();return;}
 if(name==='draw'){drawing=true;drawIds=[];status('Click the ground grid to place ordered polygon vertices, then Finish polygon.');return;}
 if(name==='loop'){if(mode!=='edge'||!selection.size)throw Error('Select an edge first.');const edges=edgesOf(model),queue=[...selection];while(queue.length){const key=queue.pop(),edge=edges.get(key);for(const vertex of edge.v){const incident=[...edges].filter(([k,e])=>k!==key&&e.v.includes(vertex));if(incident.length!==3)continue;const opposite=incident.filter(([,e])=>!e.faces.some(f=>edge.faces.includes(f)));if(opposite.length===1&&!selection.has(opposite[0][0])){selection.add(opposite[0][0]);queue.push(opposite[0][0]);}}}rebuild();status('Extended along regular quad vertices; stopped at poles / boundaries.');return;}
 if(name==='island'){if(mode!=='face'||!selection.size)throw Error('Select a face or click an island in the UV view.');selection=island([...selection][0]);rebuild();return;}
 if(['obj','glb','gltf'].includes(name)){if(!model.faces.length)throw Error('Create some faces first.');const out=structuredClone(model),scale=value('#mesh-export-scale'),b=base();if(scale<=0)throw Error('Export scale must be positive.');out.vertices=out.vertices.map(([x,y,z])=>$('#mesh-axis').value==='z'?[x*scale,-z*scale,y*scale]:[x*scale,y*scale,z*scale]);
 if(name==='obj'){const color=new THREE.Color(out.color),mtl=`newmtl Mesh\nKd ${color.convertLinearToSRGB().toArray().join(' ')}\n${out.texture?`map_Kd ${b}.png\n`:''}`;await output(b+'.obj',obj(out,{mtl:b+'.mtl'}));await output(b+'.mtl',mtl);if(out.texture)await output(b+'.png',await canvasBlob(texCanvas));}
 else{const g=geometry(out),m=new THREE.MeshStandardMaterial({color:out.color,vertexColors:true,flatShading:true,side:THREE.DoubleSide,map:texture}),object=new THREE.Mesh(g,m);try{const data=await new GLTFExporter().parseAsync(object,{binary:name==='glb'});await output(b+'.'+name,name==='glb'?data:JSON.stringify(data),name==='glb'?'model/gltf-binary':'model/gltf+json');}finally{g.dispose();m.dispose();}}return;}
 checkpoint();
 if(name==='finish'){if(drawIds.length<3)throw Error('Place at least 3 polygon points.');addFace([...drawIds].reverse());unwrap(model,[model.faces.length-1],false);drawing=false;drawIds=[];}
 else if(name==='vertex'){model.vertices.push(['x','y','z'].map(a=>value('#mesh-'+a)));}
 else if(name==='fill')boundaryFace();
 else if(name==='transform'){const ids=selectedVertices();if(!ids.length)throw Error('Select mesh components first.');const values=['x','y','z'].map(a=>value('#mesh-'+a)),center=new THREE.Vector3();ids.forEach(i=>center.add(new THREE.Vector3(...model.vertices[i])));center.divideScalar(ids.length);const kind=$('#mesh-transform').value,euler=new THREE.Euler(...values.map(THREE.MathUtils.degToRad));for(const i of ids){const p=new THREE.Vector3(...model.vertices[i]);if(kind==='translate')p.add(new THREE.Vector3(...values));else{p.sub(center);if(kind==='rotate')p.applyEuler(euler);else p.multiply(new THREE.Vector3(...values));p.add(center);}if($('#mesh-snap').checked&&kind==='translate'){const step=value('#mesh-step');if(step<=0)throw Error('Grid step must be positive.');['x','y','z'].forEach(a=>p[a]=Math.round(p[a]/step)*step);}model.vertices[i]=p.toArray();}}
 else if(name==='extrude'){if(mode==='edge'){if(!selection.size)throw Error('Select boundary edges.');const edges=edgesOf(model),ids=new Map(),amount=value('#mesh-amount');for(const key of selection){if(edges.get(key).faces.length!==1)throw Error('Edge extrusion needs boundary edges.');}for(const key of selection){const edge=edges.get(key),f=model.faces[edge.faces[0]],j=f.v.findIndex((v,i)=>edgeKey(v,f.v[(i+1)%f.v.length])===key),a=f.v[j],b=f.v[(j+1)%f.v.length];for(const v of [a,b])if(!ids.has(v)){ids.set(v,model.vertices.length);model.vertices.push(model.vertices[v].map((p,i)=>p+(i===1?amount:0)));}addFace([b,a,ids.get(a),ids.get(b)],[[0,0],[1,0],[1,1],[0,1]]);}selection.clear();}else extrude();}
 else if(name==='inset'||name==='bevel')extrude(true,name==='bevel');
 else if(name==='loopcut'){loopcut();selection.clear();}
 else if(name==='cut'){if(mode!=='edge'||!selection.size)throw Error('Select edges to split at their midpoint.');splitEdges(selection);selection.clear();}
 else if(name==='edge'){if(mode!=='vertex'||selection.size!==2)throw Error('Select two non-adjacent vertices on one polygon.');const [a,b]=[...selection],index=model.faces.findIndex(f=>f.v.includes(a)&&f.v.includes(b));if(index<0)throw Error('Both vertices must belong to the same polygon.');const f=model.faces[index],ia=f.v.indexOf(a),ib=f.v.indexOf(b),n=f.v.length;if((ia+1)%n===ib||(ib+1)%n===ia)throw Error('These vertices already share an edge.');const path=(start,end)=>{const v=[],uv=[];for(let i=start;;i=(i+1)%n){v.push(f.v[i]);uv.push(f.uv[i]);if(i===end)break;}return {v,uv};};model.faces[index]=path(ia,ib);model.faces.push(path(ib,ia));selection.clear();}
 else if(name==='split'){const ids=selectedFaces();if(!ids.length)throw Error('Select faces to detach.');const map=new Map();for(const id of ids)model.faces[id].v=model.faces[id].v.map(v=>{if(!map.has(v)){const next=model.vertices.length;map.set(v,next);model.vertices.push([...model.vertices[v]]);model.colors[next]=model.colors[v]||[1,1,1];}return map.get(v);});}
 else if(name==='merge'){if(mode!=='vertex'||selection.size<2)throw Error('Select at least two vertices.');const ids=[...selection],keep=ids[0],center=[0,1,2].map(a=>ids.reduce((n,i)=>n+model.vertices[i][a],0)/ids.length);ids.forEach(i=>model.vertices[i]=[...center]);const set=new Set(ids);model.faces.forEach(f=>{f.v=f.v.map(i=>set.has(i)?keep:i);});weld(model,0);selection.clear();}
 else if(name==='optimize'){weld(model,.00001);const used=new Set(model.faces.flatMap(f=>f.v)),map=new Map(),vertices=[],colors=[];model.vertices.forEach((p,i)=>{if(used.has(i)){map.set(i,vertices.length);vertices.push(p);colors.push(model.colors[i]||[1,1,1]);}});model.faces.forEach(f=>f.v=f.v.map(v=>map.get(v)));model.seams=model.seams.map(s=>s.split(':').map(Number)).filter(e=>e.every(v=>map.has(v))).map(([a,b])=>edgeKey(map.get(a),map.get(b)));model.vertices=vertices;model.colors=colors;selection.clear();}
 else if(name==='weld'){const amount=value('#mesh-amount');if(amount<0)throw Error('Weld tolerance cannot be negative.');weld(model,amount);selection.clear();}
 else if(name==='delete'){if(!selection.size)throw Error('Select components to delete.');if(mode==='face')model.faces=model.faces.filter((_,i)=>!selection.has(i));if(mode==='edge')model.faces=model.faces.filter(f=>!f.v.some((v,i)=>selection.has(edgeKey(v,f.v[(i+1)%f.v.length]))));if(mode==='vertex'){const map=new Map(),vertices=[],colors=[];model.vertices.forEach((v,i)=>{if(!selection.has(i)){map.set(i,vertices.length);vertices.push(v);colors.push(model.colors[i]||[1,1,1]);}});model.faces=model.faces.filter(f=>f.v.every(v=>map.has(v))).map(f=>({...f,v:f.v.map(v=>map.get(v))}));model.seams=model.seams.map(s=>s.split(':').map(Number)).filter(e=>e.every(v=>map.has(v))).map(([a,b])=>edgeKey(map.get(a),map.get(b)));model.vertices=vertices;model.colors=colors;}selection.clear();}
 else if(name==='flip'){if(!selectedFaces().length)throw Error('Select faces first.');for(const i of selectedFaces()){model.faces[i].v.reverse();model.faces[i].uv.reverse();}}
 else if(name==='triangulate'){const ids=new Set(selectedFaces());if(!ids.size)throw Error('Select faces to triangulate.');model.faces=model.faces.flatMap((f,i)=>ids.has(i)?triangles(model,f).map(t=>({v:t.map(j=>f.v[j]),uv:t.map(j=>f.uv[j])})):[f]);selection.clear();}
 else if(name==='seam'||name==='clearseam'){if(mode!=='edge'||!selection.size)throw Error('Select edges first.');model.seams=name==='seam'?[...new Set([...model.seams,...selection])]:model.seams.filter(k=>!selection.has(k));}
 else if(name==='unwrap')unwrap(model);
 else if(name==='pack')pack(model);
 else if(name==='uv'){const ids=selectedFaces();if(!ids.length)throw Error('Select faces / islands first.');const u=value('#mesh-u'),v=value('#mesh-v'),angle=THREE.MathUtils.degToRad(value('#mesh-uv-angle')),scale=value('#mesh-uv-scale'),points=ids.flatMap(i=>model.faces[i].uv),center=[0,1].map(a=>points.reduce((n,p)=>n+p[a],0)/points.length);for(const id of ids)model.faces[id].uv=model.faces[id].uv.map(p=>{const x=(p[0]-center[0])*scale,y=(p[1]-center[1])*scale;return [center[0]+x*Math.cos(angle)-y*Math.sin(angle)+u,center[1]+x*Math.sin(angle)+y*Math.cos(angle)+v];});}
 else if(['uvflipu','uvflipv','uvrot90','uvfit'].includes(name)){const ids=selectedFaces();if(!ids.length)throw Error('Select faces / islands first.');const pts=ids.flatMap(i=>model.faces[i].uv),min=[0,1].map(a=>pts.reduce((n,p)=>Math.min(n,p[a]),Infinity)),max=[0,1].map(a=>pts.reduce((n,p)=>Math.max(n,p[a]),-Infinity)),c=[(min[0]+max[0])/2,(min[1]+max[1])/2],s=Math.max(max[0]-min[0],max[1]-min[1],1e-8);for(const id of ids)model.faces[id].uv=model.faces[id].uv.map(p=>name==='uvflipu'?[2*c[0]-p[0],p[1]]:name==='uvflipv'?[p[0],2*c[1]-p[1]]:name==='uvrot90'?[c[0]-(p[1]-c[1]),c[1]+(p[0]-c[0])]:[(p[0]-min[0])/s,(p[1]-min[1])/s]);}
 else if(name==='subdivide'){if(!model.faces.length)throw Error('Create some faces first.');if(model.faces.length>20000)throw Error('Mesh is too large to subdivide again.');splitEdges(new Set(edgesOf(model).keys()));const faces=[];for(const f of model.faces){const n=f.v.length/2,c=model.vertices.length;model.vertices.push([0,1,2].map(a=>f.v.reduce((t,i)=>t+model.vertices[i][a],0)/f.v.length));model.colors[c]=[0,1,2].map(a=>f.v.reduce((t,i)=>t+(model.colors[i]||[1,1,1])[a],0)/f.v.length);const cuv=[0,1].map(a=>f.uv.reduce((t,p)=>t+p[a],0)/f.uv.length);for(let i=0;i<n;i++){const p=(2*i+2*n-1)%(2*n);faces.push({v:[f.v[2*i],f.v[2*i+1],c,f.v[p]],uv:[f.uv[2*i],f.uv[2*i+1],cuv,f.uv[p]]});}}model.faces=faces;selection.clear();}
 else if(name==='mirrorx'||name==='mirrory'||name==='mirrorz'){if(!model.faces.length)throw Error('Create some faces first.');const ax='xyz'.indexOf(name[6]),off=model.vertices.length,n0=model.faces.length;model.colors=model.vertices.map((_,i)=>model.colors[i]||[1,1,1]);model.vertices.push(...model.vertices.map(p=>p.map((v,i)=>i===ax?-v:v)));model.colors.push(...model.colors.slice(0,off));model.faces.push(...model.faces.slice(0,n0).map(f=>({v:f.v.map(i=>i+off).reverse(),uv:f.uv.map(p=>[...p]).reverse()})));weld(model,0);selection.clear();}
 else if(name==='ground'){if(!model.vertices.length)throw Error('Create some faces first.');const min=[0,1,2].map(a=>Math.min(...model.vertices.map(p=>p[a]))),max=[0,1,2].map(a=>Math.max(...model.vertices.map(p=>p[a]))),d=[-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2];model.vertices=model.vertices.map(p=>p.map((v,i)=>v+d[i]));}
 else if(name==='color')model.color=$('#mesh-color').value;
 else if(name==='paint'){const ids=selectedVertices();if(!ids.length)throw Error('Select components to paint.');const color=new THREE.Color($('#mesh-color').value).toArray();ids.forEach(i=>model.colors[i]=[...color]);}
 else if(name==='cleartexture'){model.texture=null;await loadTexture();}
 rebuild();saveLocal();$('#mesh-color').value=model.color;status('Applied '+name+'. Save to keep your changes in models/.');
 }
 root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>run(()=>action(b.dataset.action)));
 let busy=false;
 async function run(fn){if(busy)return;busy=true;const before=JSON.stringify(model),selectionBefore=new Set(selection),undoBefore=[...undo],redoBefore=[...redo];control.enabled=false;try{await fn();}catch(e){model=JSON.parse(before);selection=selectionBefore;undo=undoBefore;redo=redoBefore;rebuild();status(e.message);}finally{busy=false;control.enabled=true;}}
 root.querySelectorAll('[data-primitive]').forEach(b=>b.onclick=()=>run(()=>{drawing=false;drawIds=[];checkpoint();primitive(model,b.dataset.primitive);selection.clear();rebuild();fit();saveLocal();status('Added '+b.dataset.primitive+'.');}));
 $('#mesh-file').onchange=()=>run(async()=>{const file=$('#mesh-file').files[0];if(!file)return;if(file.size>30*1024*1024)throw Error('Mesh file exceeds 30 MB.');const data=validate(JSON.parse(await file.text()));await adopt(data,file.name.replace(/\.mesh\.json$|\.json$/,''));$('#mesh-file').value='';});
 $('#mesh-image').onchange=()=>run(async()=>{const file=$('#mesh-image').files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('Choose a texture smaller than 8 MB.');const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');if(bitmap.width>8192||bitmap.height>8192){bitmap.close();throw Error('Texture dimensions must be 8192 or smaller.');}canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();checkpoint();model.texture=canvas.toDataURL('image/png');await loadTexture();saveLocal();$('#mesh-image').value='';});
 document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();run(()=>action(e.shiftKey?'redo':'undo'));}else if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();run(()=>action('save'));}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();run(()=>action('delete'));}});

// ---------- OBJ import ----------
function parseObj(text){
 const vs=[],vts=[],faces=[];
 for(const raw of text.split('\n')){const l=raw.trim();if(l.startsWith('v ')){const p=l.split(/\s+/).slice(1,4).map(Number);if(p.length===3&&p.every(Number.isFinite))vs.push(p);}else if(l.startsWith('vt ')){const p=l.split(/\s+/).slice(1,3).map(Number);vts.push(p.every(Number.isFinite)&&p.length===2?p:[0,0]);}
  else if(l.startsWith('f ')){const idx=(t,n)=>{const k=parseInt(t,10);return k<0?n+k:k-1;};const v=[],uv=[];let hasUv=true;for(const c of l.split(/\s+/).slice(1)){const [a,b]=c.split('/'),vi=idx(a,vs.length);if(!(vi>=0&&vi<vs.length))throw Error('OBJ face uses a missing vertex.');if(v.at(-1)===vi||v.includes(vi))continue;v.push(vi);const ti=b?idx(b,vts.length):-1;if(ti>=0&&ti<vts.length)uv.push(vts[ti]);else{hasUv=false;uv.push([0,0]);}}if(v.length>=3)faces.push({v,uv,hasUv});}}
 if(!vs.length||!faces.length)throw Error('No mesh found in this OBJ.');
 if(vs.length>100000||faces.length>100000)throw Error('OBJ exceeds 100,000 vertices or faces.');
 const m={format:'nord-mesh-1',vertices:vs,faces:faces.map(({v,uv})=>({v,uv})),colors:[],seams:[],color:'#ffffff',texture:null};
 const bare=faces.map((f,i)=>f.hasUv?-1:i).filter(i=>i>=0);if(bare.length){unwrap(m,bare,false);pack({faces:bare.map(i=>m.faces[i])});}
 return m;
}
$('#mesh-obj').onchange=()=>run(async()=>{const file=$('#mesh-obj').files[0];if(!file)return;if(file.size>30*1024*1024)throw Error('OBJ file exceeds 30 MB.');const m=parseObj(await file.text());await adopt(m,file.name.replace(/\.obj$/i,''));$('#mesh-obj').value='';status(`Imported ${m.vertices.length} vertices, ${m.faces.length} faces. Texture is not imported: use Texture ▸ Load image file.`);});


// ---------- scene models: open a .glb/.gltf as is (mesh + texture), save back with "overwrite / new / prefab / variant" ----------
const params=new URLSearchParams(location.search);
const ctx={file:params.get('file')||'',entity:params.get('entity')||'',prefab:params.get('prefab')||'',mesh:params.get('mesh')||'',ename:params.get('ename')||''};
const ipc=m=>fetch('/api/ipc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m)}).catch(()=>{});
window.addEventListener('message',e=>{if(e.data?.t==='ctx'){ctx.file=e.data.file||'';ctx.entity=e.data.entity||'';ctx.prefab=e.data.prefab||'';$('#mesh-name').value=ctx.file.split('/').pop().replace(/\.[^.]+$/,'');updateWhere();status('Now editing '+ctx.file);}});

// A scene `mesh` primitive (box, sphere, cylinder, plane/ground, capsule, torus) as editable geometry; sizes match runtime/babylon/components.js.
function meshFromShape(shape,size,seg){
 const m={format:'nord-mesh-1',vertices:[],faces:[],colors:[],seams:[],color:'#ffffff',texture:null};
 const [sx,sy,sz]=size.length>=3?size:[size[0]||1,size[1]||1,size[2]??size[0]??1];
 if(shape==='torus'){const R=sx/2,r=(sy||.3)/2,a=Math.max(8,Math.min(48,seg||24)),b=12;for(let i=0;i<a;i++)for(let j=0;j<b;j++){const u=i/a*Math.PI*2,v=j/b*Math.PI*2,c=R+r*Math.cos(v);m.vertices.push([c*Math.cos(u),r*Math.sin(v),c*Math.sin(u)]);m.colors.push([1,1,1]);}
  for(let i=0;i<a;i++)for(let j=0;j<b;j++){const n=(i+1)%a,k=(j+1)%b;m.faces.push({v:[i*b+j,n*b+j,n*b+k,i*b+k],uv:[[0,0],[0,0],[0,0],[0,0]]});}unwrap(m,m.faces.map((_,i)=>i),true);return m;}
 const kind={box:'cube',sphere:'sphere',cylinder:'cylinder',capsule:'cylinder',plane:'plane',ground:'plane'}[shape]||'cube';
 const ids=primitive(m,kind),k={cube:[sx,sy,sz],sphere:[sx,sx,sx],cylinder:[sx,sy,sx],plane:[sx,1,shape==='ground'?(sz||sy):sz],}[kind];
 for(const i of ids){m.vertices[i]=m.vertices[i].map((v,a)=>v*k[a]/2);}
 while(m.colors.length<m.vertices.length)m.colors.push([1,1,1]);
 return m;}
async function importGlb(buf,path){
 const dir=path.includes('/')?'/'+path.slice(0,path.lastIndexOf('/')+1):'/';
 const gltf=await new GLTFLoader().parseAsync(buf,dir);gltf.scene.updateMatrixWorld(true);
 const m={format:'nord-mesh-1',vertices:[],faces:[],colors:[],seams:[],color:'#ffffff',texture:null},mats=new Set(),maps=new Set(),v=new THREE.Vector3();let image=null,skinned=false;
 gltf.scene.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;if(o.isSkinnedMesh)skinned=true;
  const g=o.geometry,pos=g.attributes.position,uv=g.attributes.uv,col=g.attributes.color,idx=g.index,mat=Array.isArray(o.material)?o.material[0]:o.material,base=m.vertices.length;
  mats.add(mat);if(mat?.map?.image){maps.add(mat.map.image);if(!image)image=mat.map.image;}const tint=!mat?.map&&mat?.color?mat.color:null;
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);m.vertices.push([v.x,v.y,v.z]);m.colors.push(col?[col.getX(i)*(tint?tint.r:1),col.getY(i)*(tint?tint.g:1),col.getZ(i)*(tint?tint.b:1)]:tint?[tint.r,tint.g,tint.b]:[1,1,1]);}
  const n=idx?idx.count:pos.count,at=k=>idx?idx.getX(k):k;
  for(let t=0;t+2<n;t+=3){const ids=[at(t),at(t+1),at(t+2)];if(new Set(ids).size<3)continue;m.faces.push({v:ids.map(i=>base+i),uv:ids.map(i=>uv?[uv.getX(i),1-uv.getY(i)]:[0,0])});}
  if(m.faces.length>100000)throw Error('Model has more than 100,000 faces: too big for the Modeler.');});
 if(!m.faces.length)throw Error('No triangle meshes found in '+path);
 weld(m,0);
 if(image){const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight,k=Math.min(1,1024/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));c.getContext('2d').drawImage(image,0,0,c.width,c.height);m.texture=c.toDataURL('image/png');}
 const notes=[];if(maps.size>1)notes.push(maps.size+' textures: only the first is kept; plain material colours became vertex colours');if(gltf.animations?.length||skinned)notes.push('animations / skeleton are not kept when you save');
 ctx.lossy=notes.length>0;status(`Opened ${path}: ${m.vertices.length} vertices, ${m.faces.length} faces${m.texture?', with texture':''}.${notes.length?' Note: '+notes.join('; ')+'.':''}`);
 return m;
}
async function glbBytes(){const g=geometry(model),mat=new THREE.MeshStandardMaterial({color:model.color,vertexColors:true,flatShading:true,side:THREE.DoubleSide,map:model.texture?texture:null});try{return await new GLTFExporter().parseAsync(new THREE.Mesh(g,mat),{binary:true});}finally{g.dispose();mat.dispose();}}
function saveChoice(){return new Promise(resolve=>{
 const inModels=/^models\//.test(ctx.file),cur=(ctx.file?ctx.file.split('/').pop().replace(/\.[^.]+$/,''):base()),isPrefab=!!ctx.prefab,hasEntity=!!ctx.entity;
 const opts=[];
 if(inModels)opts.push({mode:'overwrite',title:'Overwrite the model',text:`Replaces ${ctx.file}: EVERY entity${isPrefab?', prefab instance':''} using this model changes${ctx.lossy?' (animations / skeleton are lost)':''}.`});
 if(hasEntity&&isPrefab)opts.push({mode:'variant',title:'Save as a new prefab variant',text:'New model file + a variant of the prefab that uses it. The selected object switches to the variant; the original prefab and other instances stay as they are.',name:true});
 else if(hasEntity){opts.push({mode:'new',title:'Save as a new model for the selected object',text:'New model file; only the selected scene object uses it. Other entities keep the old model.',name:true});opts.push({mode:'prefab',title:'Save as a new prefab',text:'New model file + a new prefab made from the selected object (it becomes an instance of it).',name:true});}
 else opts.push({mode:'new',title:'Save as a new model file',text:'Writes a new file in models/; nothing in the scene changes.',name:true});
 const back=document.createElement('div');back.className='modal';back.innerHTML='<div class="box"><strong>Save model</strong><div class="list"></div><label>New model name <input class="nm" spellcheck="false"></label><button class="cancel">Cancel</button></div>';
 const list=back.querySelector('.list'),nm=back.querySelector('.nm'),done=v=>{back.remove();resolve(v);};nm.value=cur+'-edit';
 for(const o of opts){const b=document.createElement('button'),t=document.createElement('strong'),d=document.createElement('div');t.textContent=o.title;d.textContent=o.text;d.style.fontSize='11px';d.style.opacity='.75';b.append(t,d);b.onclick=()=>done({mode:o.mode,name:o.name?nm.value.trim().replace(/\.(glb|gltf)$/i,'').replace(/[^\w-]+/g,'_')||cur+'-edit':null});list.append(b);}
 back.querySelector('.cancel').onclick=()=>done(null);document.body.append(back);});}
async function saveForScene(){
 if(!model.faces.length)throw Error('Nothing to save: the mesh has no faces.');
 const c=await saveChoice();if(!c)return;
 let file=ctx.file.replace(/^models\//,'');
 if(c.mode!=='overwrite'){const taken=new Set(await listModels('.glb'));let n=c.name,i=2;while(taken.has(n+'.glb'))n=c.name+'-'+i++;file=n+'.glb';}
 const ok=await output(file,await glbBytes(),'model/gltf-binary');if(!ok)return;
 await output(file.replace(/\.glb$/,'.mesh.json'),JSON.stringify(model,null,2),'application/json');
 ipc({t:'model-saved',mode:c.mode,file:'models/'+file,entity:ctx.entity,prefab:ctx.prefab});
 if(c.mode!=='overwrite'){ctx.file='models/'+file;$('#mesh-name').value=file.replace(/\.glb$/,'');updateWhere();}
}

// ---------- start ----------
if(!ctx.file&&ctx.mesh){try{const size=(params.get('size')||'1,1,1').split(',').map(Number),seg=Number(params.get('seg'))||24;model=meshFromShape(ctx.mesh,size,seg);$('#mesh-name').value=(ctx.ename||ctx.mesh).replace(/[^\w-]+/g,'_');status(`Opened the ${ctx.mesh} mesh of the scene object as editable geometry. Save to put it on the object; closing without saving changes nothing.`);}catch(e){status('Could not build the mesh: '+e.message);}}
{const q=ctx.file;if(q){try{const r=await fetch('/'+q.replace(/^\/+/,''),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);if(/\.(glb|gltf)$/i.test(q)){model=await importGlb(await r.arrayBuffer(),q);}else model=validate(await r.json());$('#mesh-name').value=q.split('/').pop().replace(/\.mesh\.json$|\.json$|\.glb$|\.gltf$/i,'');}catch(e){status('Could not open '+q+': '+e.message);}}}
updateWhere();setView('3d');$('#mesh-color').value=model.color;await loadTexture();fit();
