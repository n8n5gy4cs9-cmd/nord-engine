#!/usr/bin/env node
// Original quiet ambient loop, local mono PCM WAV; no external audio library.
import fs from 'node:fs';
import path from 'node:path';
const rate=22050,seconds=16,n=rate*seconds,b=Buffer.alloc(44+n*2);let random=1492,filtered=0;
b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
for(let i=0;i<n;i++){const t=i/rate;random=(random*1664525+1013904223)>>>0;filtered+=(random/4294967296*2-1-filtered)*.03;const fade=Math.min(1,t/.25,(seconds-t)/.25),value=(Math.sin(2*Math.PI*110*t)*.09+Math.sin(2*Math.PI*165*t)*.04+Math.sin(2*Math.PI*220*t)*.025+filtered*.035)*fade*(.8+.2*Math.sin(2*Math.PI*t/8));b.writeInt16LE(Math.round(value*32767),44+i*2);}
const file=path.join(import.meta.dirname,'examples/shader-terrain/assets/audio/ambience.wav');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);
console.log('Generated original 16-second terrain ambience WAV.');
