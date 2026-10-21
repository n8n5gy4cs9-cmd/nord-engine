import {COURSE,driver,traffic,updateDriver,padInput} from './track.js';
import {drawView} from './render.js';
import {RetroAudio} from './audio.js';
import {AUDIO} from './audio-config.js';
export async function mount(root){
 root.innerHTML=`<style>body{margin:0;background:#101b2b;color:#e3edf0;font:15px monospace}#shell{position:relative;max-width:1100px;margin:auto}canvas{display:block;width:100%;image-rendering:pixelated}#bar{padding:10px;display:flex;gap:8px;flex-wrap:wrap}button,select{font:inherit;padding:8px;background:#304a61;color:white;border:1px solid #7a9caa;border-radius:5px}#notice{padding:8px;min-height:18px}#overlay{position:absolute;top:35%;left:15%;width:70%;padding:18px;box-sizing:border-box;background:#0d172ae8;text-align:center}h1{color:#f7d89b;font-size:26px}</style>
 <div id="shell"><div id="bar"><button id="one">1 player</button><button id="two">2 player split</button><button id="pause">Pause / Resume</button><button id="restart">Restart</button><button id="mute">Mute</button><select id="track"><option>Coast Drive</option><option>Coast Night</option></select></div><canvas width="960" height="540" tabindex="0"></canvas><div id="notice"></div><div id="overlay"><h1>COASTLINE SPRINT</h1><p>One coast. Two checkpoints. Beat the clock!</p><p>P1: WASD/arrows · Shift nitro<br>P2: gamepad left stick · RT/A throttle · LT/B brake · X nitro</p><p>Choose 1 player or connect a gamepad and choose 2 player split.</p></div></div>`;
 const $=s=>root.querySelector(s),canvas=$('canvas'),g=canvas.getContext('2d'),sound=new RetroAudio(AUDIO),keys=new Set();
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Missing '+src));image.src=src;});
 const images={cars:await load('assets/sprites/racing-cars.png'),roadside:await load('assets/sprites/roadside.png')};
 let players=[driver()],cars=traffic(),mode=1,state='menu',paused=false,last=performance.now(),engine=null,starting=false;
 const pad=()=>Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
 const keyboard=()=>({steer:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),accel:keys.has('KeyW')||keys.has('ArrowUp')?1:0,brake:keys.has('KeyS')||keys.has('ArrowDown')?1:0,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')});
 async function start(count){
  if(starting)return;if(count===2&&!pad()){$('#notice').textContent='Connect a gamepad and press one of its buttons, then choose 2 player split.';return;}
  starting=true;mode=count;players=Array.from({length:mode},(_,i)=>driver(i));cars=traffic();paused=false;state='playing';keys.clear();$('#overlay').hidden=true;canvas.focus();
  try{await sound.unlock();await sound.music($('#track').selectedIndex);if(engine)engine.source.stop();engine=await sound.play('engine',{loop:true,volume:.07});}catch(error){sound.problem=error.message;}finally{starting=false;}
 }
 function togglePause(){if(state!=='playing')return;if(paused&&mode===2&&!pad())return;paused=!paused;$('#overlay').hidden=!paused;$('#overlay').innerHTML='<h1>PAUSED</h1><p>Pause / Resume continues. Connect P2 gamepad if disconnected.</p>';paused?sound.suspend():sound.resume();keys.clear();}
 $('#one').onclick=()=>start(1);$('#two').onclick=()=>start(2);$('#restart').onclick=()=>start(mode);$('#pause').onclick=togglePause;
 $('#mute').onclick=()=>{$('#mute').textContent=sound.mute()?'Unmute':'Mute';};$('#track').onchange=()=>{if(sound.ctx)sound.music($('#track').selectedIndex);};
 window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)&&state==='playing')e.preventDefault();if(e.code==='KeyP'&&!e.repeat)togglePause();keys.add(e.code);});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(state==='playing'&&!paused)togglePause();});
 function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;
  if(mode===2&&state==='playing'&&!paused&&!pad())togglePause();
  if(state==='playing'&&!paused){
   for(const car of cars)car.z+=car.speed*dt;
   for(const p of players)for(const event of updateDriver(p,p.index?padInput(pad()):keyboard(),dt,cars))sound.play(event,{volume:event==='crash'?.65:.5});
   if(players.every(p=>p.finished||p.lost)){state='result';if(engine){engine.source.stop();engine=null;}}
  }
  if(engine){engine.source.playbackRate.value=.7+(players[0].speed/COURSE.maxSpeed)*1.4;engine.gain.gain.value=paused?0:.035+players[0].speed/COURSE.maxSpeed*.075;}
  const h=canvas.height/mode;
  players.forEach((p,i)=>{g.save();g.beginPath();g.rect(0,i*h,canvas.width,h);g.clip();g.translate(0,i*h);drawView(g,p,cars,players,images,canvas.width,h);g.restore();});
  if(mode===2){g.fillStyle='#0b1424';g.fillRect(0,h-2,canvas.width,4);}
  $('#notice').textContent=sound.problem?`Audio: ${sound.problem}`:mode===2?`P2 ${pad()?.id??'GAMEPAD DISCONNECTED'} · ${state==='result'?'Restart for a new race.':'P pauses both views.'}`:'W/Up accelerates · S/Down brakes · A/D steer · Shift nitro · P pause';
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 // Read-only inspection seam used by browser checks; gameplay still runs through real inputs.
 window.__coast={get players(){return players;},get paused(){return paused;},get state(){return state;},get sound(){return sound;}};
}
