import { compile, projectSettings } from './model.js';
import { boot } from '/runtime/phaser/index.js';
const dataUrl=v=>'data:application/json;base64,'+btoa(unescape(encodeURIComponent(JSON.stringify(v))));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.shiftKey){e.preventDefault();parent.postMessage({type:'level2d-stop'},location.origin);}});
window.addEventListener('message',async e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='level2d-run'||window.__started)return;window.__started=true;
  try{
    const {level,bank}=e.data,{scene}=compile(level,bank);const files={'scenes/preview.scene.json':dataUrl(scene)};
    for(const b of bank){files[b.source]=b.custom?'/'+b.source:'/__spritebank/'+b.source;files[b.source+'.meta.json']=dataUrl({type:'spritesheet',frameWidth:b.width,frameHeight:b.height,filter:'nearest',anims:b.anims});}
    const project={format:1,id:'level2d-preview',name:level.name,type:'2d',startScene:'scenes/preview.scene.json',...projectSettings(level)};
    const library=['platformer2d','topdown','pickup','health','ai-patrol'];
    window.__game=await boot(project,{container:document.querySelector('#stage'),files,importScript:async path=>{
      if(path.startsWith('scripts/level2d/')){const existing=await fetch('/'+path,{method:'HEAD'});if(existing.ok)return import('/'+path);const file=path.split('/').at(-1),id=file.replace('.js','');return import(library.includes(id)?'/__level2d-library/'+file:'/runtime/level2d/'+file);}return import('/'+path);
    }});window.__nord_ready=true;
  }catch(err){console.error(err);document.querySelector('#stage').textContent=err.stack;}
});parent.postMessage({type:'level2d-ready'},location.origin);
