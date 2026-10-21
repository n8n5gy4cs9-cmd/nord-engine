// Uses the actual Blocksmith stdio MCP. Games ship the GLBs; players don't need Blocksmith.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const app=process.env.BLOCKSMITH_APP ?? '/Applications/Blocksmith.app/Contents/Resources/app';
const {Client}=await import(pathToFileURL(app+'/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'));
const {StdioClientTransport}=await import(pathToFileURL(app+'/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'));
const client=new Client({name:'nord-retro-models',version:'1.0.0'});
const transport=new StdioClientTransport({command:process.env.BLOCKSMITH_COMMAND??'/Applications/Blocksmith.app/Contents/MacOS/Blocksmith',args:[app+'/server/mcp.js'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1',BLOCKSMITH_RUNTIME_FILE:process.env.BLOCKSMITH_RUNTIME_FILE??'/Users/harriahola/Library/Application Support/Blocksmith/data/runtime.json',BLOCKSMITH_URL:process.env.BLOCKSMITH_URL??'http://127.0.0.1:65355'}});
async function call(name,args={}){const r=await client.callTool({name,arguments:args});if(r.isError)throw Error(JSON.stringify(r));return JSON.parse(r.content.find(c=>c.type==='text').text);}
const block=(name,p,s,color,assetId='primitive:cube',rotation=[0,0,0])=>({assetId,name,position:p,scale:s,color,rotation,roughness:1,metalness:0});
const models={
 fighter:[block('Hull',[0,0,0],[1.1,.55,3.4],'#c9d9df'),block('Nose',[0,0,2],[.65,1.6,.65],'#e3eaf0','primitive:cone',[90,0,0]),block('Canopy',[0,.45,.5],[.7,.45,1.3],'#168fba'),block('Left wing',[-1.7,-.05,-.3],[2.6,.14,1.3],'#dce6df','primitive:cube',[0,22,0]),block('Right wing',[1.7,-.05,-.3],[2.6,.14,1.3],'#dce6df','primitive:cube',[0,-22,0]),block('Fin',[0,.65,-1.1],[.16,.9,.9],'#29bca3'),...[-.65,.65].map(x=>block('Engine',[x,0,-1.8],[.45,.7,.45],'#ff9b42','primitive:cylinder',[90,0,0]))],
 drone:[block('Core',[0,0,0],[1.3,.7,1.2],'#bf525b'),block('Eye',[0,.1,-.7],[.6,.25,.15],'#ffca51'),...[-1,1].map(x=>block('Blade',[x,0,.15],[1.4,.16,1.7],'#644b7b','primitive:cube',[0,x*25,0]))],
 carrier:[block('Armoured spine',[0,0,0],[2,1,6],'#626785'),block('Bridge',[0,.85,1],[1.2,.7,2],'#e0bd6b'),...[-2.3,2.3].flatMap(x=>[block('Armour pod',[x,0,0],[2,1.5,4],'#45556d'),block('Reactor',[x,.1,-2.1],[1.2,.7,.2],'#ed5f4e')]),block('Front shield',[0,0,-3.1],[2,.65,.2],'#b94975')],
 gate:[...[-4,4].map(x=>block('Pylon',[x,0,0],[1,8,1.5],'#69768a')),block('Crossbar',[0,4,0],[9,1,1.5],'#a9b4c3'),...[-2,0,2].map(x=>block('Lamp',[x,3.6,-.8],[.6,.2,.15],'#34e6b4'))],
};
fs.mkdirSync('tools/art/vector-patrol',{recursive:true});
fs.writeFileSync('tools/art/vector-patrol/assemblies.json',JSON.stringify(models,null,2)+'\n');
await client.connect(transport);
try{
 let scene=await call('scene_get');console.log(`Blocksmith: ${scene.name}, ${scene.blocks.length} blocks, revision ${scene.revision}`);
 if(scene.blocks.length)throw Error('Use an empty Blocksmith scene: existing work is preserved.');
 for(const [name,parts]of Object.entries(models)){
  const commands=parts.map((b,i)=>({type:'add',block:{...b,id:'nord-'+name+'-'+i}}));
  const result=await call('scene_batch',{commands,expectedRevision:scene.revision});
  scene=await call('scene_get');
  try{
   const portable=await call('scene_save');
   fs.writeFileSync('tools/art/vector-patrol/'+name+'.blocksmith.json',JSON.stringify(portable,null,2)+'\n');
   const exported=await call('scene_export',{format:'glb'});
   let bytes;
   if(exported.downloadUrl)bytes=Buffer.from(await(await fetch(exported.downloadUrl)).arrayBuffer());
   else bytes=Buffer.from(exported.content,'base64');
   fs.writeFileSync('tools/examples/vector-patrol/assets/models/'+name+'.glb',bytes);
   for(const direction of [0,90,180,45]){
    const r=await client.callTool({name:'render_sprite',arguments:{direction,elevation:20,size:320,transparent:true}});
    if(r.isError)throw Error(JSON.stringify(r));
    const img=r.content.find(c=>c.type==='image');if(!img)throw Error('Blocksmith returned no render');
    fs.writeFileSync(`tools/art/vector-patrol/${name}-${direction}.png`,Buffer.from(img.data,'base64'));
   }
   console.log(name,parts.length,'parts,',bytes.length,'GLB bytes; four Blocksmith renders');
  }finally{
   scene=await call('scene_get');await call('scene_delete',{ids:parts.map((_,i)=>'nord-'+name+'-'+i),expectedRevision:scene.revision});scene=await call('scene_get');
  }
 }
}finally{await client.close();}
