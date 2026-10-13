// Plain-HTML Nord example: the owner's exact GLSL + small WebGL2 host and GPU terrain probes.
import { h } from './_kit.js';
export async function mount(root) {
  const css=h('link',{rel:'stylesheet',href:new URL('style.css',import.meta.url).href});document.head.append(css);
  const canvas=h('canvas',{'aria-label':'Synthwave terrain. Click visible ground to drop a cube.'}),overlay=h('canvas',{class:'terrain-overlay'});
  const status=h('span',{role:'status'},'Click the terrain to drop a cube.');
  const audio=new Audio(new URL('assets/audio/ambience.wav',import.meta.url));audio.loop=true;audio.volume=1;
  let audioContext,analyser,audioSource,audioGain;
  async function startAudio(){
    if(!audioContext){audioContext=new AudioContext();analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.65;audioSource=audioContext.createMediaElementSource(audio);audioGain=audioContext.createGain();audioGain.gain.value=.22;audioSource.connect(analyser);analyser.connect(audioGain);audioGain.connect(audioContext.destination);}
    await audioContext.resume();await audio.play();
  }
  let sound=false,frozen=false,time=0,last=performance.now(),raf=0,cube=null,dead=false;
  const pause=h('button',{},'Freeze terrain');pause.onclick=()=>{frozen=!frozen;pause.textContent=frozen?'Resume terrain':'Freeze terrain';if(!frozen)cube=null;};
  const soundButton=h('button',{},'Enable audio');soundButton.onclick=async()=>{try{if(sound){audio.pause();sound=false;}else{await startAudio();sound=true;}soundButton.textContent=sound?'Mute audio':'Enable audio';}catch{status.textContent='Audio could not start. Click Enable audio again.';}};
  const drop=h('button',{},'Drop cube');
  const view=h('div',{class:'terrain-view'},canvas,overlay);
  root.replaceChildren(h('div',{class:'terrain-app'},h('header',{},h('div',{},h('strong',{},'SYNTHWAVE / TERRAIN LAB'),h('small',{},'A shader is a picture. A matching height probe makes it interactive.')),drop,pause,soundButton),view,h('footer',{},status,h('span',{},'Click ground · scene freezes for contact · Crowelian 2026 + Sonnet'))));
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});
  if(!gl){status.textContent='WebGL2 is required for this shader.';return{destroy(){css.remove();root.replaceChildren();}};}
  const original=await(await fetch(new URL('terrain.glsl',import.meta.url))).text();
  // Preserve terrain.glsl on disk; enable its existing audio branch only for compilation.
  const reactive=original.replace(/^#define disable_sound_texture_sampling[^\n]*$/m,'');
  const vertex='#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}';
  const prefix='#version 300 es\nprecision highp float;\nuniform vec3 iResolution;uniform float iTime;uniform float iTimeDelta;uniform sampler2D iChannel0;uniform vec3 iChannelResolution[1];out vec4 result;\n';
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}return s;}
  function program(tail){const p=gl.createProgram(),v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,prefix+reactive+'\n'+tail);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  let drawProgram,queryProgram;
  try{
    drawProgram=program('void main(){mainImage(result,gl_FragCoord.xy);}');
    queryProgram=program(`uniform int queryMode;uniform vec2 queryXZ;uniform vec2 queryPixel;
      vec4 encodeValue(float value,bool hit){float n=floor(clamp(value,0.,1.)*65535.+.5);return vec4(floor(n/256.),mod(n,256.),hit?255.:0.,255.)/255.;}
      void main(){jTime=mod(iTime,4000.);if(queryMode==0){result=encodeValue((2.*trinoise(queryXZ).x+.25)/2.5,true);return;}
        vec2 uv=(2.*queryPixel-iResolution.xy)/iResolution.y;vec3 ro=vec3(0.,1.,-20000.+jTime*speed);vec3 rd=normalize(vec3(uv,4./3.));vec2 hit=intersect(ro,rd);result=encodeValue(max(hit.x,0.)/150.,hit.x>=0.);}`);
  }catch(error){status.textContent='Shader error: '+error.message;return{destroy(){if(drawProgram)gl.deleteProgram(drawProgram);css.remove();root.replaceChildren();}};}
  const locations=p=>Object.fromEntries(['iResolution','iTime','iTimeDelta','iChannel0','iChannelResolution[0]','queryMode','queryXZ','queryPixel'].map(n=>[n,gl.getUniformLocation(p,n)]));
  const draw=locations(drawProgram),query=locations(queryProgram),buffer=gl.createFramebuffer(),texture=gl.createTexture(),pixel=new Uint8Array(4);
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  // Shadertoy sound layout: row 0 = 512 FFT bins, row 1 = 512 waveform samples.
  const soundTexture=gl.createTexture(),soundPixels=new Uint8Array(512*2),fft=new Uint8Array(512),wave=new Uint8Array(1024);
  gl.bindTexture(gl.TEXTURE_2D,soundTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,512,2,0,gl.RED,gl.UNSIGNED_BYTE,soundPixels);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  function updateSound(){
    if(frozen)return; // Hold the same sound snapshot used by the cube's height probes.
    if(sound&&analyser){analyser.getByteFrequencyData(fft);analyser.getByteTimeDomainData(wave);soundPixels.set(fft);for(let i=0;i<512;i++)soundPixels[512+i]=wave[i*2];}
    else soundPixels.fill(0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,soundTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,512,2,gl.RED,gl.UNSIGNED_BYTE,soundPixels);
  }
  const common=(uniforms)=>{gl.uniform3f(uniforms.iResolution,canvas.width,canvas.height,1);gl.uniform1f(uniforms.iTime,time);gl.uniform1f(uniforms.iTimeDelta,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,soundTexture);gl.uniform1i(uniforms.iChannel0,0);gl.uniform3f(uniforms['iChannelResolution[0]'],512,2,1);};
  function probe(mode,x,z){gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.viewport(0,0,1,1);gl.useProgram(queryProgram);common(query);gl.uniform1i(query.queryMode,mode);gl.uniform2f(query.queryXZ,x,z);gl.uniform2f(query.queryPixel,x,z);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return{value:(pixel[0]*256+pixel[1])/65535,hit:pixel[2]>0};}
  const height=(x,z)=>probe(0,x,z).value*2.5-.25;
  // Match the float arithmetic of the original GLSL camera, which travels along Z at audio-mode speed 5.
  const cameraZ=()=>Math.fround(-20000+Math.fround(Math.fround(time%4000)*5));
  function dropAt(x,z,distance=12){
    frozen=true;pause.textContent='Resume terrain';const half=Math.min(.8,Math.max(.25,distance*.02));
    const ground=Math.max(height(x,z),height(x-half,z-half),height(x+half,z-half),height(x-half,z+half),height(x+half,z+half));
    cube={x,z,y:ground+half+3,vy:0,ground,half,landed:false};status.textContent=`Cube falling. Sampled terrain height: ${ground.toFixed(3)}. Scene frozen for a stable contact.`;
  }
  drop.onclick=()=>dropAt(3,cameraZ()+12);
  const pick=event=>{const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=canvas.height-(event.clientY-rect.top)*canvas.height/rect.height;const hit=probe(1,x,y);if(!hit.hit){status.textContent='That is sky. Click terrain below the horizon, or use Drop cube.';return;}const distance=hit.value*150,uvX=(2*x-canvas.width)/canvas.height,uvY=(2*y-canvas.height)/canvas.height;const length=Math.hypot(uvX,uvY,4/3);dropAt(distance*uvX/length,cameraZ()+distance*(4/3)/length,distance);};
  canvas.addEventListener('pointerdown',pick);
  const context=overlay.getContext('2d');
  function project(x,y,z){const depth=z-cameraZ();if(depth<=.1)return null;const scale=canvas.height*2/3/depth;return[canvas.width/2+x*scale,canvas.height/2-(y-1)*scale];}
  function drawCube(){
    context.clearRect(0,0,overlay.width,overlay.height);if(!cube)return;
    const vertices=[];for(const z of[-1,1])for(const y of[-1,1])for(const x of[-1,1])vertices.push(project(cube.x+x*cube.half,cube.y+y*cube.half,cube.z+z*cube.half));if(vertices.some(p=>!p))return;
    const faces=[{ids:[0,1,3,2],fill:'#fa8f58'},{ids:[1,5,7,3],fill:'#ca5eae'},{ids:[2,3,7,6],fill:'#ffe7a5'}];
    for(const face of faces){context.beginPath();face.ids.forEach((id,i)=>i?context.lineTo(...vertices[id]):context.moveTo(...vertices[id]));context.closePath();context.fillStyle=face.fill;context.fill();context.strokeStyle='#fff3cd';context.lineWidth=1.5;context.stroke();}
    const contact=project(cube.x,cube.ground,cube.z);if(contact){context.strokeStyle=cube.landed?'#b8ffdc':'#ffe7a5';context.beginPath();context.ellipse(contact[0],contact[1],14,4,0,0,Math.PI*2);context.stroke();}
  }
  function resize(){const rect=view.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(rect.width));canvas.height=Math.max(1,Math.floor(rect.height));overlay.width=canvas.width;overlay.height=canvas.height;}
  const observer=new ResizeObserver(resize);observer.observe(view);resize();
  function frame(now){if(dead)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!frozen)time+=dt;updateSound();
    if(cube&&!cube.landed){cube.vy-=9.8*dt;cube.y+=cube.vy*dt;if(cube.y-cube.half<=cube.ground){cube.y=cube.ground+cube.half;cube.vy=0;cube.landed=true;status.textContent=`Contact: cube bottom = ${cube.ground.toFixed(3)}, sampled terrain height = ${cube.ground.toFixed(3)}. Click another point to drop again.`;}}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(drawProgram);common(draw);gl.drawArrays(gl.TRIANGLES,0,3);drawCube();raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return{destroy(){dead=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',pick);audio.pause();audio.src='';audioSource?.disconnect();analyser?.disconnect();audioGain?.disconnect();if(audioContext)void audioContext.close();gl.deleteTexture(soundTexture);gl.deleteFramebuffer(buffer);gl.deleteTexture(texture);gl.deleteProgram(drawProgram);gl.deleteProgram(queryProgram);css.remove();root.replaceChildren();}};
}
