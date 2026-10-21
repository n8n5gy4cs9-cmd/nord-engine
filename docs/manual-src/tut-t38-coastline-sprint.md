---
title: T38 Coastline Sprint — code an Amiga racer with two-player split-screen
section: Tutorials
order: 38
summary: Build a complete one-course pseudo-3D racer using the supplied Amiga Lotus-style cars: keyboard solo, keyboard/gamepad split-screen, traffic, nitro, checkpoints, MP3 music and SFX. All source and assets included.
---

Build **Coastline Sprint**, a complete arcade road-racing game: accelerate down a rolling coast, steer through curves, dodge traffic, manage nitro and reach the finish before the clock expires. Two checkpoints add time. Play solo on the keyboard, or race a friend in top/bottom split-screen: **player one uses the keyboard and player two uses a gamepad**.

The reference request was ZgzInfinity/OutRun. This tutorial uses the same broad pseudo-3D racing idea, but its playable code is original Nord JavaScript, extended from Nord's own Amiga Showcase. It does not require SFML, an arcade ROM or the reference game's files. The supplied red/white sports cars and roadside sprites are Nord's original Amiga collection. There is one shared course, not an unfinished menu leading to placeholder races.

**Allow two to three hours.** [Download the complete Coastline Sprint project](assets/downloads/coastline-sprint-source.zip). It includes all code, car/scenery sheets and metadata, two original music tracks and five SFX. A standard gamepad is needed only for player two. Hardware gamepad behavior still needs testing with your particular controller/browser; the automated split-screen checks use a synthetic standard pad.

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-split.png" alt="Coastline Sprint top/bottom split-screen with independent red and white Amiga cars" loading="lazy"><figcaption>One course, two drivers and two cameras. The red car is keyboard player one; the white car is gamepad player two.</figcaption></figure>

## 1. Open and run the finished project

Extract the zip into a writable folder and open its nord.project.json in Nord. Press Play, then choose **1 player**. W/Up accelerates, S/Down brakes, A/D or Left/Right steer and Shift uses nitro. P or the Pause/Resume button pauses; Restart starts a fresh race. Choose either music track from the dropdown. Mute affects both music and SFX.

For a browser preview from the project parent folder:

```sh
nord serve coastline-sprint
```

Open the printed local URL. Click a start button to unlock browser audio. If you hear nothing, check Mute, your system output and the status line below the canvas. Missing audio files produce a visible error there instead of pretending to play.

For split-screen, connect a gamepad, press one of its buttons so the browser exposes it, then choose **2 player split**. The left stick steers, RT or A accelerates, LT or B brakes, and X uses nitro. The first connected pad belongs to P2. P1 remains keyboard-controlled. Disconnecting that pad pauses both views; reconnect it and choose Pause/Resume to continue.

**Checkpoint:** accelerate in solo, stop, then start split-screen. Keyboard input must not move the white car. Gamepad input must not move the red car.

## 2. Know which file owns each decision

| File | Responsibility |
|---|---|
| app.js | Nord HTML entry point, controls, loop, mode, pause, audio and split layout |
| track.js | Course data, driver state, input mapping and pure game rules |
| render.js | Road projection, scenery, traffic, car sprite frames and per-view HUD |
| audio.js | WebAudio unlock, decode/cache, voices, crossfade, mute and pause |
| audio-config.js | Music/SFX filenames you can replace |
| assets/sprites/ | Supplied car and roadside PNG sheets with metadata |
| assets/audio/ | Supplied original MP3 files |

This is Nord's **HTML tier**. It exports mount(root), which the generated index.html calls. There is no Scene-tab entity to attach it to; open the files in Assets/code editor, save, and restart Play. JavaScript modules separate rules from presentation without adding a framework.

For a coding-from-starter path, create an HTML project, add the listed files and copy the supplied asset folders. Keep the generated index entry importing mount from app.js. Follow the sections below, then use the complete source at the end to assemble the exact final files.

## 3. Define a finite course and independent drivers

The central course settings are deliberately small:

```js
export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
```

Distances are game-world units, not real metres. The HUD's KM/H is an arcade display conversion, not a vehicle simulation. curve(z) supplies horizontal bend and hill(z) supplies elevation. Both are smooth functions of progress, so the two players see the same course at different positions without storing duplicate maps.

`driver(index)` returns a **new object** containing lateral position x, distance z, speed, timer, nitro, checkpoint index, collision cooldown and result flags. Calling it twice matters: using the same object in both array entries would make steering one car move both.

The two drivers start slightly apart. They share traffic and the road but do not ram each other; the rival is a visible racing ghost. This keeps the tutorial's head-to-head race about driving rather than collision arbitration.

**Exercise:** lower maxSpeed and predict whether you must increase the time allowance. Change just one setting first, then Play the full course.

## 4. Turn inputs into movement, not pixels

updateDriver takes one driver, one input object, dt and the traffic list. A representative input is:

```js
{ steer: -0.5, accel: 1, brake: 0, boost: false }
```

The rules do not care whether that came from a keyboard or pad. steer is minus one to one; accel/brake are zero to one. dt is seconds. Acceleration, braking and coasting alter speed, then speed times dt advances distance.

```js
p.speed = clamp(p.speed +
  (input.accel * 2400 - input.brake * 4200 - 500) * dt,
  0, COURSE.maxSpeed * (boost ? 1.3 : 1));
p.z += p.speed * dt;
```

The final function also adds curve drift, clamps lateral bounds and slows off-road travel. Nitro drains while boosting and slowly recharges otherwise. It is a temporary speed advantage, not a toggle that makes the car permanently faster.

Return **events** such as crash, skid, checkpoint and win instead of playing sound inside the rules. That makes the same pure function easy to test and lets the app choose how a crash sounds. It also prevents a unit test from needing an AudioContext.

**Checkpoint:** release throttle and the car coasts down. Steer off the road and speed falls. Use nitro and its meter decreases, then recovers after release.

## 5. Project the road and draw back to front

The road is a sequence of projected strips, not a 3D engine scene. For a strip ahead of the player:

```js
const scale = 0.85 / distanceAhead;
const screenX = width / 2 + relativeWorldX * scale * width / 2;
const screenY = horizon + relativeHeight * scale * height / 2;
const halfWidth = roadWidth * scale * width / 2;
```

Farther geometry has a smaller scale. Camera-relative height makes hills rise or fall on screen. The renderer accumulates the curve into a lateral road centre, then draws four-point polygons between adjacent strips. Rumble strips are slightly wider than the road. Alternating world-distance bands make lane markings move with travel.

Draw distant strips first, near strips last. Then sort scenery/traffic by distance and draw far-to-near sprites. This painter-style ordering is enough for this compact course; it is not a general renderer for arbitrary bridges, intersections or overpasses.

The player car stays near the screen centre while road/camera offset reflects its lane. The renderer crops 64×40 cells from racing-cars.png: red left/back/right/front in the first row, white poses in the second. Steering chooses a discrete rear pose; it does not cycle all frames as a walk animation.

```js
g.drawImage(sheet, frame % 4 * 64, Math.floor(frame / 4) * 40,
  64, 40, destinationX, destinationY, width, height);
```

Set imageSmoothingEnabled=false so scaling preserves the pixels. The roadside sheet has eight 64×96 cells. PNG metadata ships with the project so users can inspect/reuse the sheets in other Nord projects too.

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-curve.png" alt="The same coast course viewed farther into its curved, hilly section" loading="lazy"><figcaption>Elevation and curvature come from track functions. The art is supplied; you do not need to generate a new car before following the tutorial.</figcaption></figure>

## 6. Add traffic, collision grace and a real finish

Traffic positions/speeds are generated deterministically and advance once per frame, **not once per viewport**. Calling the traffic update inside each camera draw would make split-screen traffic move twice as fast as solo.

A collision requires close forward distance and close lane position. It reduces speed, counts a hit and starts a cooldown. The cooldown prevents a single overlapping traffic car from generating dozens of crashes and sound effects in adjacent frames.

Each checkpoint is awarded once by comparing the driver's checkpoint index and distance. It adds eighteen seconds and emits checkpoint. Finish is a fixed distance; running out of time sets lost. Once a driver has finished/lost, updateDriver returns without changing that run.

In split-screen one player can finish while the other continues. Each view displays its own finish time or timeout. The race enters the overall result state only when both drivers have a result. There is no second level hidden behind the finish.

**Checkpoint:** test a crash, pass both checkpoints, finish and Restart. Verify that Restart resets timers, traffic, nitro and result flags rather than leaving a finished driver in the new run.

## 7. Map a standard gamepad and split the canvas

padInput reads axis zero and standard buttons, applies a dead zone, then produces the same input shape as the keyboard:

```js
const axis = pad?.axes?.[0] ?? 0;
const steer = Math.abs(axis) > 0.14 ? axis : 0;
const accel = Math.max(button(7), button(0));
const brake = Math.max(button(6), button(1));
```

Optional chaining handles missing devices; nullish coalescing supplies zero. A dead zone removes small stick drift. Button values can be analog, so RT/LT allow partial throttle/braking. Controller layouts vary; inspect navigator.getGamepads in the browser when adapting a non-standard pad.

The app updates all driver states, then renders each into a clipped region:

```js
const viewHeight = canvas.height / mode;
g.save();
g.rect(0, playerIndex * viewHeight, canvas.width, viewHeight);
g.clip();
g.translate(0, playerIndex * viewHeight);
drawView(g, player, cars, players, images, canvas.width, viewHeight);
g.restore();
```

A clip stops one viewport drawing over the other. Translation lets the same drawView use local coordinates. Save/restore is essential: without it, transforms accumulate and the lower view drifts off the canvas.

Pause belongs to the **whole race**, not one driver. Browser focus loss clears held keys and pauses. Pad disconnect also pauses both; the resume button refuses to resume split-screen while the pad is missing. This avoids giving the keyboard player a free win while P2's input has disappeared.

## 8. Understand the supplied music and SFX

The archive contains two original tracks, coast-drive.mp3 and coast-night.mp3, plus engine.mp3, skid.mp3, crash.mp3, checkpoint.mp3 and win.mp3. These are actual local files. The engine sound loops with playback rate tied to speed; crash/checkpoint/win are one-shots. The track selector crossfades music.

Audio starts from the start-button gesture because browsers may block autoplay. The helper creates an AudioContext, fetches each file, decodes it and caches its Promise. A decoded buffer can be reused for many sound voices without refetching every collision.

```js
const response = await fetch(path);
if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
const buffer = await context.decodeAudioData(await response.arrayBuffer());
```

A gain node controls each voice; a master gain controls mute. The helper records a visible problem if a file fails. Pausing suspends the audio context as well as the race simulation. Music and engine nodes should not be recreated every animation frame.

## 9. Add your own MP3 music and SFX with code

Put your files **inside this project's assets/audio folder**, for example:

```text
coastline-sprint/
  assets/audio/my-summer-drive.mp3
  assets/audio/my-crash.mp3
```

Open audio-config.js and change only the intended paths:

```js
export const AUDIO = {
  music: ['assets/audio/my-summer-drive.mp3', 'assets/audio/coast-night.mp3'],
  sfx: {
    engine: 'assets/audio/engine.mp3',
    crash: 'assets/audio/my-crash.mp3',
    skid: 'assets/audio/skid.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

These are project-relative URL paths with forward slashes, not desktop file paths. Keep the sfx keys: game events use those names. To change a track's displayed name, edit its option text in app.js. To add a third track, add both a music-array path and a matching dropdown option.

Save the config and restart Play to clear cached decoded audio. Then start a race and test a collision. Finally rebuild/export and test that copy. A filename typo or uppercase/lowercase mismatch may work differently on another host; keep names simple and consistent.

The helper also accepts browser-supported WAV/OGG. MP3 is convenient but may add encoder padding, so use a carefully trimmed WAV/OGG if you need a tighter engine loop. Keep one-shot SFX short; a full song used as crash.mp3 will play on every crash. Change each call's volume option or the master gain to balance loud files.

Original audio can be regenerated in the engine with `python3 tools/gen_assets.py retro-audio` using Python with numpy/Pillow and ffmpeg. The source download already includes the generated files, so tutorial readers do not need that toolchain unless regenerating them.

## 10. Test and export your finished racer

Test solo and split separately. Check steering, throttle release, nitro recharge, collision cooldown, checkpoints, independent timers, pause, pad disconnect/reconnect, both result states, Restart, music change and mute. A connected pad in one browser does not prove a different controller/OS layout works.

From the project parent folder:

```sh
nord check coastline-sprint
nord build coastline-sprint --target html --out coast-web --zip
python3 -m http.server 8004 --directory coast-web
```

Open the exported copy, click a start button and test both views there. Upload the whole folder or zip with index.html at the root. All art, audio and code are local; no separate server is required for this racer beyond ordinary static hosting.

**Extensions:** tune one corner, change the checkpoint spacing, add a lap record, add an explicit gamepad selector, or replace one sprite sheet while retaining its frame contract. Keep traffic updates outside the viewport loop and input/state separate from drawing.

## Complete game source

Every JavaScript file, generated HTML, project metadata and sprite metadata is listed below. The [full source archive](assets/downloads/coastline-sprint-source.zip) also contains every PNG and MP3 used by the finished game and its licence. The reference repository was inspected for context; no reference game artwork, soundtrack or C++ code is needed to reproduce this original Nord project.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### app.js

```js
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
```

<details>
<summary>Complete assets/sprites/racing-cars.png.meta.json</summary>

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 40,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

</details>

<details>
<summary>Complete assets/sprites/roadside.png.meta.json</summary>

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 96,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

</details>

<details>
<summary>Complete audio-config.js</summary>

```js
// Put your replacement MP3/WAV/OGG files in assets/audio and change these paths.
export const AUDIO={music:['assets/audio/coast-drive.mp3','assets/audio/coast-night.mp3'],sfx:{engine:'assets/audio/engine.mp3',crash:'assets/audio/crash.mp3',skid:'assets/audio/skid.mp3',checkpoint:'assets/audio/checkpoint.mp3',win:'assets/audio/win.mp3'}};
```

</details>

<details>
<summary>Complete audio.js</summary>

```js
// Local MP3/WAV/OGG files, decoded on first user activation. No external service.
export class RetroAudio {
  constructor(config) { this.config=config;this.cache=new Map();this.voices=new Set();this.problem='';this.muted=false; }
  async unlock() {
    this.ctx??=new AudioContext();
    if(!this.master){this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);}
    await this.ctx.resume();
  }
  async load(path) {
    if(!this.cache.has(path))this.cache.set(path,(async()=>{const response=await fetch(path);if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return this.ctx.decodeAudioData(await response.arrayBuffer());})());
    return this.cache.get(path);
  }
  async voice(path,{volume=.5,loop=false,rate=1}={}) {
    if(!this.ctx)return null;
    try {
      const buffer=await this.load(path);if(this.voices.size>24&&!loop)return null;
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=loop;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);
      const voice={source,gain};this.voices.add(voice);source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};source.start();return voice;
    }catch(error){this.problem=error.message;console.warn('[retro audio]',error);return null;}
  }
  play(name,options={}) {const path=this.config.sfx[name];return path?this.voice(path,options):Promise.resolve(null);}
  async music(index=0) {
    const old=this.song,next=await this.voice(this.config.music[index%this.config.music.length],{loop:true,volume:0});
    if(!next)return;this.song=next;next.gain.gain.linearRampToValueAtTime(.4,this.ctx.currentTime+.4);
    if(old){old.gain.gain.linearRampToValueAtTime(0,this.ctx.currentTime+.4);old.source.stop(this.ctx.currentTime+.45);}
  }
  mute() {this.muted=!this.muted;if(this.master)this.master.gain.gain.value=this.muted?0:.55;return this.muted;}
  suspend() {if(this.ctx?.state==='running')return this.ctx.suspend();}
  resume() {if(this.ctx?.state==='suspended')return this.ctx.resume();}
  async dispose() {if(this.ctx)await this.ctx.close();this.voices.clear();}
}
```

</details>

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.coastlinesprint"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coastline Sprint — Amiga road racer</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "Coastline Sprint",
  "id": "com.crowelian.coastlinesprint",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
      0
    ]
  },
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  }
}
```

</details>

<details>
<summary>Complete render.js</summary>

```js
// Extended from Nord's own Amiga Showcase road/sprite presentation.
import {curve,hill,COURSE} from './track.js';
export function drawView(g,p,cars,others,images,w,h){
 const horizon=h*.36;g.fillStyle='#82bbce';g.fillRect(0,0,w,h);g.fillStyle='#eac48d';g.fillRect(0,horizon*.65,w,h*.2);
 g.fillStyle='#657e86';g.beginPath();g.moveTo(0,horizon);for(let x=0;x<=w;x+=20)g.lineTo(x,horizon-18-Math.sin(x*.02+p.z*.00005)*12);g.lineTo(w,horizon+30);g.lineTo(0,horizon+30);g.fill();
 g.fillStyle='#487650';g.fillRect(0,horizon,w,h-horizon);
 const SEG=200,road=2000,points=[];let x=0,dx=0;
 for(let i=1;i<=180;i++){const z=p.z+i*SEG;dx+=curve(z);x+=dx;const scale=.85/(i*SEG);points.push({z,scale,x:w/2+(x-p.x*road)*scale*w/2,y:horizon+(hill(p.z)+950-hill(z))*scale*h/2,half:road*scale*w/2});}
 const quad=(a,b,ratio,color)=>{g.fillStyle=color;g.beginPath();g.moveTo(a.x-a.half*ratio,a.y);g.lineTo(a.x+a.half*ratio,a.y);g.lineTo(b.x+b.half*ratio,b.y);g.lineTo(b.x-b.half*ratio,b.y);g.closePath();g.fill();};
 for(let i=points.length-2;i>=0;i--){const a=points[i],b=points[i+1];if(b.y>=a.y||b.y>h)continue;const stripe=Math.floor(a.z/1200)%2;quad(a,b,1.08,stripe?'#eee0c4':'#9a4e45');quad(a,b,1,stripe?'#444750':'#4c4e56');if(stripe){for(const lane of [-.33,.33]){const aa={...a,x:a.x+a.half*lane,half:a.half*.014},bb={...b,x:b.x+b.half*lane,half:b.half*.014};quad(aa,bb,1,'#d7d5bb');}}
 }
 const sprite=(image,frame,fw,fh,cols,cx,cy,sw,sh)=>{g.imageSmoothingEnabled=false;g.drawImage(image,(frame%cols)*fw,Math.floor(frame/cols)*fh,fw,fh,Math.round(cx-sw/2),Math.round(cy-sh),Math.round(sw),Math.round(sh));};
 const objects=[];
 for(let i=0;i<32;i++){const z=Math.floor(p.z/1900)*1900+i*1900;objects.push({z,x:i%2?-1.45:1.45,scenery:true,id:i});}
 for(const car of [...cars,...others.filter(o=>o!==p)])if(car.z>p.z+250&&car.z<p.z+35000)objects.push(car);
 objects.sort((a,b)=>b.z-a.z);
 for(const o of objects){const depth=o.z-p.z,index=Math.round(depth/SEG)-1,point=points[index];if(!point||depth<250)continue;const xx=point.x+o.x*point.half,yy=point.y,size=Math.min(w*.4,point.scale*w*260);
  if(o.scenery)sprite(images.roadside,o.id%8,64,96,8,xx,yy,size*1.2,size*1.8);
  else sprite(images.cars,o.index===0?1:5,64,40,4,xx,yy,size,size*.625);
 }
 const carW=Math.min(w*.25,h*.6),frame=(p.index?4:0)+(p.steer<-.15?0:p.steer>.15?2:1);
 sprite(images.cars,frame,64,40,4,w/2,h*.91,carW,carW*.625);
 g.fillStyle='#101a2bdf';g.fillRect(0,0,w,37);g.fillStyle=p.index?'#f4eee2':'#ffae9b';g.font=`bold ${h<250?11:14}px monospace`;g.fillText(`P${p.index+1}  ${Math.round(p.speed/20)} KM/H  TIME ${Math.ceil(p.time)}  ${Math.round(p.z/COURSE.length*100)}%`,8,16);g.fillText(`NITRO ${Math.round(p.nitro*100)}%  CP ${p.checkpoint}/2  HITS ${p.hits}`,8,31);
 if(p.finished||p.lost){g.fillStyle='#081326dd';g.fillRect(w*.12,h*.4,w*.76,60);g.fillStyle='#ffe4a1';g.font='bold 18px monospace';g.fillText(p.finished?`FINISH ${p.elapsed.toFixed(1)}s`:'TIME UP',w*.2,h*.54);}
}
```

</details>

<details>
<summary>Complete track.js</summary>

```js
export const COURSE={length:180000,limit:65,checkpoints:[60000,120000],bonus:18,maxSpeed:4800};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function curve(z){const t=z/COURSE.length;return t<.12?0:Math.sin(z/8500)*.65*(t>.9?.3:1);}
export const hill=z=>Math.sin(z/12000)*450+Math.sin(z/4700)*90;
export function driver(index=0){return {index,x:index?.3:-.3,z:0,speed:0,time:COURSE.limit,elapsed:0,nitro:1,checkpoint:0,hits:0,cooldown:0,finished:false,lost:false,steer:0};}
export const traffic=()=>Array.from({length:24},(_,i)=>({id:i,z:7000+i*6900,x:[-.64,0,.64][i%3],speed:1350+(i%4)*210}));
export function updateDriver(p,input,dt,cars){
 if(p.finished||p.lost)return [];
 dt=Math.min(dt,.05);const events=[];p.elapsed+=dt;p.time=Math.max(0,p.time-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.skid=Math.max(0,(p.skid??0)-dt);
 const boost=input.boost&&p.nitro>0&&input.accel>0;
 p.nitro=clamp(p.nitro+(boost?-.4:.14)*dt,0,1);
 p.speed=clamp(p.speed+(input.accel*2400-input.brake*4200-500)*dt,0,COURSE.maxSpeed*(boost?1.3:1));
 p.steer=input.steer;p.x+=input.steer*dt*(.5+p.speed/COURSE.maxSpeed)*1.25-curve(p.z)*p.speed/COURSE.maxSpeed*dt*.7;
 p.x=clamp(p.x,-1.8,1.8);if(Math.abs(p.x)>1.05)p.speed=Math.max(800,p.speed-3200*dt);
 if(p.skid===0&&p.speed>1800&&((input.brake>.2&&Math.abs(input.steer)>.4)||Math.abs(p.x)>1.15)){p.skid=.8;events.push('skid');}
 p.z+=p.speed*dt;
 if(p.cooldown===0)for(const car of cars)if(Math.abs(car.z-p.z)<500&&Math.abs(car.x-p.x)<.23){p.speed*=.3;p.cooldown=1.4;p.hits++;events.push('crash');break;}
 if(p.checkpoint<COURSE.checkpoints.length&&p.z>=COURSE.checkpoints[p.checkpoint]){p.checkpoint++;p.time+=COURSE.bonus;events.push('checkpoint');}
 if(p.z>=COURSE.length){p.z=COURSE.length;p.finished=true;events.push('win');}
 else if(p.time===0){p.lost=true;events.push('crash');}
 return events;
}
export function padInput(pad){const button=i=>pad?.buttons?.[i]?.value??0;const axis=pad?.axes?.[0]??0;return {steer:Math.abs(axis)>.14?axis:0,accel:Math.max(button(7),button(0)),brake:Math.max(button(6),button(1)),boost:button(2)>.5};}
```

</details>
