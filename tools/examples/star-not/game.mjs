import fs from 'node:fs';
import path from 'node:path';
import { E, project, camera2d, ROOT } from '../lib.mjs';
const here=path.join(ROOT,'tools/examples/star-not');
const input={p1Left:['ArrowLeft'],p1Right:['ArrowRight'],p1Thrust:['ArrowUp'],p1Brake:['ArrowDown'],p1Fire:['Space'],p1Shield:['ShiftLeft','ShiftRight'],p2Left:['KeyA'],p2Right:['KeyD'],p2Thrust:['KeyW'],p2Brake:['KeyS'],p2Fire:['KeyF'],p2Shield:['KeyG'],pause:['Escape','KeyP'],select:['Mouse0']};
export default()=>({
  name:'Star-Not',
  project:project('star-not','Star-Not','2d',{w:1024,h:720,bg:'#091923',pixelArt:false,physics:{engine:'none',gravity:[0,0,0]},input}),
  scenes:{main:{entities:[camera2d(512,360),E('Atlas source',{pos:[-999,-999,0],c:[{type:'sprite',texture:'assets/sprites/space.png',frame:0,alpha:0}]}),E('Expedition',{s:['scripts/star-not.js']})]}},
  assets:[{from:'library/apps/_kit.js',to:'scripts/sn/dom.js'},{from:'vendor/fonts/inter/inter-latin-400-normal.woff2',to:'assets/fonts/inter.woff2'},{from:'vendor/fonts/inter/LICENSE',to:'assets/fonts/LICENSE'}],
  files:Object.fromEntries(fs.readdirSync(path.join(here,'docs')).map(f=>[f,fs.readFileSync(path.join(here,'docs',f),'utf8')])),
  readme:'# Star-Not\nA complete small solar-system adventure. Earth-race, Mars-race and Venutians; eight planets and the Sun; diplomacy, resources, wrapping ship combat, planetary checkpoints, portable saves, victory and defeat. Optional shared-keyboard or P1 keyboard + P2 gamepad combat co-op.\n\nStart with `nord serve examples/star-not`, or open it in NordEditor. Read GUIDE.md for the route and controls; assets.md lists reusable original art/audio. Source: `tools/examples/star-not/`; regenerate with `node tools/gen_examples.mjs star-not`. GPL-2.0-or-later game code (small UQM normal-thrust adaptation); original assets. Crowelian 2026 + Sonnet.\n',
});
