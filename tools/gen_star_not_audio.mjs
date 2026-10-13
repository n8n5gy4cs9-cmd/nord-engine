#!/usr/bin/env node
// Original Star-Not music/SFX. Synth/WAV-writing approach reused from gen_xkom_audio.mjs.
// Explicitly running this replaces only tools/examples/star-not/assets/audio/*.wav.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './examples/lib.mjs';
const SR=22050,OUT=path.join(ROOT,'tools/examples/star-not/assets/audio');
const mk=seconds=>new Float32Array(Math.floor(seconds*SR));
let seed=88271;const noise=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)*2-1;
const wave={sine:p=>Math.sin(p*2*Math.PI),tri:p=>4*Math.abs(p%1-.5)-1,square:p=>p%1<.5?1:-1,noise};
function tone(buffer,start,duration,frequency,{shape='sine',volume=.3,decay=4,attack=.008}={}){
  const length=Math.floor(duration*SR),offset=Math.floor(start*SR);let phase=0;
  for(let i=0;i<length&&offset+i<buffer.length;i++){const k=i/length,f=Array.isArray(frequency)?frequency[0]+(frequency[1]-frequency[0])*k:frequency;phase+=f/SR;const envelope=Math.min(1,i/(attack*SR))*Math.exp(-decay*k)*Math.min(1,(length-i)/(SR*.01));buffer[offset+i]+=wave[shape](phase)*envelope*volume;}
}
function save(folder,name,buffer){
  let peak=0;for(const sample of buffer)peak=Math.max(peak,Math.abs(sample));const gain=peak>.85?.85/peak:1;
  const b=Buffer.alloc(44+buffer.length*2);b.write('RIFF',0);b.writeUInt32LE(36+buffer.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(buffer.length*2,40);buffer.forEach((v,i)=>b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(v*gain*32767))),44+i*2));
  fs.mkdirSync(path.join(OUT,folder),{recursive:true});fs.writeFileSync(path.join(OUT,folder,name+'.wav'),b);
}
const midi=n=>440*2**((n-69)/12);
const effects={
  laser:b=>{tone(b,0,.15,[1550,480],{shape:'tri',volume:.4,decay:6});tone(b,0,.08,2350,{volume:.15});},
  hit:b=>{tone(b,0,.23,[180,55],{volume:.5});tone(b,0,.12,0,{shape:'noise',volume:.25,decay:10});},
  explosion:b=>{tone(b,0,.7,[95,30],{volume:.65,decay:3});tone(b,0,.6,0,{shape:'noise',volume:.3,decay:6});},
  travel:b=>{[220,330,440,660].forEach((f,i)=>tone(b,i*.12,.4,f,{shape:'tri',volume:.25,decay:3}));},
  hail:b=>{[523,659,523].forEach((f,i)=>tone(b,i*.15,.22,f,{volume:.25}));},
  confirm:b=>{tone(b,0,.12,660,{volume:.3});tone(b,.1,.17,990,{volume:.3});},
  victory:b=>{[60,64,67,72,76].forEach((n,i)=>tone(b,i*.18,.65,midi(n),{shape:'tri',volume:.3,decay:3}));},
  defeat:b=>{[60,58,55,48].forEach((n,i)=>tone(b,i*.25,.55,midi(n),{shape:'tri',volume:.25}));},
};
for(const[name,fn]of Object.entries(effects)){const b=mk(name==='victory'||name==='defeat'?2:.95);fn(b);save('sfx',name,b);}
function music(name,beat,beats,chords,melody){
  const b=mk(beat*beats);
  for(let i=0;i<beats;i++){const chord=chords[Math.floor(i/16)%chords.length],t=i*beat;
    if(i%8===0)for(const n of chord)tone(b,t,beat*8,midi(n),{volume:.06,decay:.65,attack:.12});
    if(i%4===0)tone(b,t,beat*3,midi(chord[0]-12),{shape:'tri',volume:.17,decay:4});
    if(i%2===0)tone(b,t,beat*1.6,midi(melody[Math.floor(i/2)%melody.length]),{shape:name==='combat'?'tri':'sine',volume:.13,decay:4});
    if(name==='combat'){if(i%4===0)tone(b,t,.15,[100,35],{volume:.28,decay:5});if(i%4===2)tone(b,t,.11,0,{shape:'noise',volume:.08,decay:8});tone(b,t,.04,0,{shape:'noise',volume:.018,decay:12});}
  }
  // Short seam fades prevent discontinuities when the Audio manager loops the track.
  for(let i=0;i<SR*.015;i++){const f=i/(SR*.015);b[i]*=f;b[b.length-1-i]*=f;}
  save('music',name,b);
}
music('cruise',.6,64,[[48,55,60,63],[44,51,56,60],[46,53,58,62],[43,50,55,59]],[72,67,75,79,74,70,67,63]);
music('combat',.3,96,[[45,52,57,60],[41,48,53,57],[43,50,55,58],[40,47,52,56]],[69,72,76,72,67,70,74,70,65,69,72,69]);
music('victory',.4,32,[[48,55,60,64],[53,60,65,69]],[72,76,79,84,79,76,74,72]);
console.log('Generated Star-Not: 8 SFX and 3 original looping music tracks.');
