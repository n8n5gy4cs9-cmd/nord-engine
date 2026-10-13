import { NordScript } from 'nord';
import { mountTouchControls } from './sn/touch.js';
import { h } from './sn/dom.js';
import { PLANETS, RACES, WIDTH, HEIGHT, ARENA, planet, freshCampaign, travelCost, missionReady, record, validCampaign } from './sn/data.js';
import { moveShip, gamepadControls, shortestTurn, wrappedDelta, wrap } from './sn/flight.js';

const ATLAS = 'assets/sprites/space.png';
const icon = index => {
  // Original busts are taller than resource symbols; crop each row without editing the PNG.
  const rows = [[62,304],[384,267],[668,264],[950,280]], [y,height] = rows[Math.floor(index/4)];
  return h('span', { class:'sn-icon', 'aria-hidden':true, style:{backgroundSize:`400% ${1254/height*100}%`,backgroundPosition:`${index%4*100/3}% ${y/(1254-height)*100}%`} });
};
const button = (label,fn,primary=false,index) => h('button',{class:'sn-button'+(primary?' primary':''),onclick:fn},...(index===undefined?[]:[icon(index)]),label);
const spriteData=(name,frame,x,y,size,z=3)=>({name,transform:{pos:[x,y,z],rot:[0,0,0],scale:[1,1,1]},components:[{type:'sprite',texture:ATLAS,frame,size:[size,size]}],scripts:[],children:[]});
const textData=(name,text,x,y,size=13,color='#b7cdd6')=>({name,transform:{pos:[x,y,10]},components:[{type:'text',text,size,color,font:'Inter,system-ui,sans-serif'}]});

export default class StarNot extends NordScript {
  start() {
    this.mode='loading';this.coop='solo';this.touchEnabled=matchMedia('(pointer:coarse)').matches;this.c=freshCampaign();this.view=[];this.bullets=[];this.effects=[];this.clock=0;this.muted=false;
    this.hud=this.ui.panel({w:WIDTH,h:HEIGHT,style:{background:'transparent',border:'0',padding:'0',boxShadow:'none',pointerEvents:'none'}});this.hud.el.classList.add('sn-shell');
    this.hud.el.append(h('div',{class:'sn-load'},'Preparing the solar chart…'));
    this.resize=()=>{const r=this.ui.root.getBoundingClientRect(),s=Math.min(r.width/WIDTH,r.height/HEIGHT);Object.assign(this.hud.el.style,{left:`${(r.width-WIDTH*s)/2}px`,top:`${(r.height-HEIGHT*s)/2}px`,transformOrigin:'0 0',transform:`scale(${s})`});};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(this.ui.root);this.resize();
    this.onBlur=()=>{this.input.held.clear();if(this.mode==='combat'&&!this.paused)this.pause();};window.addEventListener('blur',this.onBlur);
    this.prepare().catch(error=>this.game.reportError(error,this,'start'));
  }
  async prepare() {
    const css=await this.game.loader.text('assets/ui/game.css');this.style=document.createElement('style');this.style.textContent=css;document.head.append(this.style);
    const make=async(data)=>{const e=await this.scene.spawnData(data);this.view.push(e);return e;};
    this.sun=await make(spriteData('Sun',4,350,376,105,-3));
    this.planetViews=[];
    for(const p of PLANETS){const e=await make(spriteData(p.name,p.frame,p.x,p.y,p.size));const label=await make(textData(p.name+' label',p.name,p.x,p.y+p.size*.35,12));this.planetViews.push({p,e,label});}
    this.marker=await make(spriteData('Mission ship',0,0,0,45,8));
    this.shipViews=[];for(let i=0;i<3;i++){const e=await make(spriteData('Combat ship '+i,i===1?0:i,0,0,61,8));e.enabled=false;this.shipViews.push(e);}
    this.shots=[];for(let i=0;i<54;i++){const e=await make(spriteData('Pulse '+i,14,0,0,24,7));e.enabled=false;this.shots.push(e);}
    this.bursts=[];for(let i=0;i<8;i++){const e=await make(spriteData('Burst '+i,15,0,0,70,9));e.enabled=false;this.bursts.push(e);}
    this.title();
  }
  toast(text){this.toastEl?.remove();this.toastEl=h('div',{class:'sn-toast',role:'status'},text);this.hud.el.append(this.toastEl);clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toastEl?.remove(),3500);}
  sfx(name){this.audio.play(`assets/audio/sfx/${name}.wav`,{volume:.5});}
  music(name){this.audio.music(`assets/audio/music/${name}.wav`,{fade:.45,volume:.32}).catch(error=>this.game.warn(error.message));}
  saveCheckpoint(){try{this.game.save.set('campaign',structuredClone(this.c));}catch{this.toast('Local save unavailable. Use Export save.');}}
  saved(){const c=this.game.save.get('campaign',null);return validCampaign(c)?c:null;}
  coopSelect(){const select=h('select',{class:'sn-select','aria-label':'Second pilot'});for(const [value,label]of[['solo','Solo pilot'],['keyboard','Co-op · shared keyboard'],['gamepad','Co-op · P2 gamepad']])select.append(h('option',{value,selected:value===this.coop},label));select.onchange=()=>{this.coop=select.value;this.toast(this.coop==='solo'?'Solo selected.':'Player 2 joins the next combat encounter.');};return select;}
  setMapVisible(on){this.sun.enabled=on;for(const v of this.planetViews){v.e.enabled=on;v.label.enabled=on;}this.marker.enabled=on;}
  clearCombat(){this.touch?.destroy();this.touch=null;for(const e of [...this.shipViews,...this.shots,...this.bursts])e.enabled=false;this.bullets=[];this.effects=[];this.fighters=[];this.input.held.clear();}
  title(){this.clearCombat();this.mode='title';this.setMapVisible(true);this.marker.enabled=false;this.hud.el.replaceChildren();
    const dialog=h('div',{class:'sn-dialog'},h('div',{class:'sn-eyebrow'},'A small adventure in our solar system'),h('h1',{},'STAR-NOT'),h('p',{},'Earth-race. Mars-race. Venutians.\nOne solar system, three peoples, and a relay that must bring them together before day 40.'),h('p',{},'Recover relay cores from Mercury, Saturn and Neptune. Win Mars’s trust, bring clean ice to Venus, then return to Earth. Co-op adds a wingmate in combat.'),h('div',{class:'sn-controls'},'Pilots',this.coopSelect()));
    const actions=h('div',{class:'sn-actions'},button('New expedition',async()=>{if(this.saved()&&!confirm('Start a new expedition and replace the saved campaign?'))return;await this.audio.unlock();this.c=freshCampaign();this.saveCheckpoint();this.map();},true,12),button('How to play',()=>this.help()));const saved=this.saved();if(saved)actions.append(button('Continue',async()=>{await this.audio.unlock();this.c=saved;this.c.won||this.c.lost?this.ending():this.map();}));dialog.append(actions,h('p',{class:'sn-warning'},'Progress is saved at planets. Loading during a battle restarts from the planet checkpoint.'));this.hud.el.append(h('div',{class:'sn-modal'},dialog));
  }
  baseHUD(){this.hud.el.replaceChildren();this.status=h('div',{class:'sn-top'},h('div',{class:'sn-brand'},'STAR-NOT',h('small',{},'SOLAR RELAY EXPEDITION')),h('span',{class:'sn-stat'},icon(3),`Day ${this.c.day}/40`),h('span',{class:'sn-stat'},icon(4),`Fuel ${this.c.fuel}/14`),h('span',{class:'sn-stat'},icon(5),`Crew ${this.c.crew}/24`),h('span',{class:'sn-stat'},icon(6),`Scrap ${this.c.scrap}`),button('Menu',()=>this.pause()));
    this.hud.el.append(this.status,h('div',{class:'sn-footer'},h('span',{},this.mode==='combat'?'P1 arrows · Space fire · Shift shield | P2 WASD · F fire · G shield':'Select a planet on the chart or in the destination list. Distances are diagrammatic.'),h('span',{},'Crowelian 2026 + Sonnet')));
  }
  map(selected=this.c.location){this.clearCombat();this.mode='map';this.paused=false;this.setMapVisible(true);this.selected=selected;this.baseHUD();this.music('cruise');const here=planet(this.c.location);this.marker.pos=[here.x+24,here.y-22,8];
    for(const p of PLANETS)this.hud.el.prepend(h('div',{class:'sn-orbit',style:{left:`${350-p.radius}px`,top:`${376-p.radius}px`,width:`${p.radius*2}px`,height:`${p.radius*2}px`}}));
    this.hud.el.append(h('div',{class:'sn-caption'},'Our solar system · select a destination'));
    const p=planet(selected),atHome=selected===this.c.location;
    const side=h('section',{class:'sn-side'},h('div',{class:'sn-eyebrow'},atHome?'Currently in orbit':'Destination'),h('h2',{},p.name),h('p',{},p.description));
    const destinations=h('select',{class:'sn-select','aria-label':'Destination planet'});for(const world of PLANETS)destinations.append(h('option',{value:world.id,selected:world.id===selected},world.name));destinations.onchange=()=>this.map(destinations.value);side.append(destinations);
    const actions=h('div',{class:'sn-actions',style:{marginTop:'12px'}});
    if(!atHome){const cost=travelCost(this.c.location,selected);const travel=button(`Travel · ${cost.fuel} fuel / ${cost.days} days`,()=>this.travel(selected),true);travel.disabled=this.c.fuel<cost.fuel;actions.append(travel);}else this.planetActions(actions,p);
    const convert=button('Convert scrap → 3 fuel',()=>{if(this.c.scrap<1||this.c.fuel>=14)return;this.c.scrap--;this.c.fuel=Math.min(14,this.c.fuel+3);record(this.c,'Converted scrap into fuel.');this.saveCheckpoint();this.map();});convert.disabled=this.c.scrap<1||this.c.fuel>=14;actions.append(convert);
    actions.append(button('Emergency tow to Earth · +3 days',()=>{this.c.location='earth';this.c.day+=3;this.c.fuel=14;this.c.crew=Math.max(6,this.c.crew-2);record(this.c,'Returned to Earth by emergency tow.');this.saveCheckpoint();this.checkEnding();}));
    side.append(actions,h('hr'),h('div',{class:'sn-eyebrow'},'Mission checklist'),h('div',{class:'sn-objectives'},`${this.c.cores.includes('mercury')?'✓':'○'} Mercury core\n${this.c.cores.includes('saturn')?'✓':'○'} Saturn core\n${this.c.cores.includes('neptune')?'✓':'○'} Neptune core\n${this.c.accords.mars?'✓':'○'} Mars accord\n${this.c.accords.venus?'✓':'○'} Venutian accord`));side.querySelector('.sn-objectives').style.whiteSpace='pre-line';side.append(h('div',{class:'sn-journal'},this.c.journal.slice(-3).join('\n')));this.hud.el.append(side);
  }
  travel(id){const cost=travelCost(this.c.location,id);if(this.c.fuel<cost.fuel)return;this.c.fuel-=cost.fuel;this.c.day+=cost.days;this.c.location=id;record(this.c,`Arrived at ${planet(id).name}.`);this.sfx('travel');this.saveCheckpoint();this.checkEnding();}
  checkEnding(){if(this.c.lost||this.c.won)this.ending();else this.map();}
  planetActions(actions,p){
    const add=(name,fn,enabled=true)=>{const b=button(name,fn,true);b.disabled=!enabled;actions.append(b);};
    const commit=text=>{record(this.c,text);this.sfx('confirm');this.saveCheckpoint();this.checkEnding();};
    if(p.id==='earth'){
      add('Dock · free fuel and repairs',()=>{this.c.fuel=14;this.c.crew=24;commit('Earth dock refuelled and repaired the expedition.');});
      add(this.c.upgraded?'Weapon upgraded':'Upgrade weapon · 2 scrap',()=>{this.c.scrap-=2;this.c.upgraded=true;commit('Installed a stronger pulse cannon.');},this.c.scrap>=2&&!this.c.upgraded);
      add('Activate solar relay · finish mission',()=>{this.c.won=true;commit('Three relay cores and three peoples reunited the solar network.');},missionReady(this.c));
      add('Talk to Earth-race',()=>this.talk('earth'));
    }else if(p.id==='mars'){
      add('Talk to Mars-race',()=>this.talk('mars'));
      add('Trade 2 scrap for Mars accord',()=>{this.c.scrap-=2;this.c.accords.mars=true;commit('The Mars-race signed the relay accord.');},this.c.scrap>=2&&!this.c.accords.mars);
      add('Friendly duel for Mars accord',()=>this.battle('mars','accord'),!this.c.accords.mars);
      add('Mars dock · refuel and repair',()=>{this.c.fuel=14;this.c.crew=24;commit('Mars dock supplied the allied expedition.');},this.c.accords.mars);
    }else if(p.id==='venus'){
      add('Talk to Venutians',()=>this.talk('venus'));
      add('Deliver ice · Venutian accord',()=>{this.c.ice=false;this.c.accords.venus=true;commit('The Venutians accepted the clean ice and signed.');},this.c.ice&&!this.c.accords.venus);
      add('Venus dock · refuel and repair',()=>{this.c.fuel=14;this.c.crew=24;commit('Venus dock supplied the allied expedition.');},this.c.accords.venus);
    }else if(p.id==='mercury')add('Salvage core + 2 scrap',()=>{this.c.cores.push('mercury');this.c.scrap+=2;this.c.visits.mercury=true;commit('Recovered Mercury’s relay core and two scrap.');},!this.c.visits.mercury);
    else if(p.id==='jupiter')add('Collect clean ice + 2 scrap',()=>{this.c.ice=true;this.c.scrap+=2;this.c.visits.jupiter=true;commit('Collected Jupiter-orbit clean ice and two scrap.');},!this.c.visits.jupiter);
    else if(p.id==='uranus')add('Recover fuel and repair supplies',()=>{this.c.fuel=14;this.c.crew=24;this.c.scrap+=2;this.c.visits.uranus=true;commit('Recovered the Uranus buoy’s emergency supplies.');},!this.c.visits.uranus);
    else if(p.id==='saturn')add('Challenge patrol · recover core',()=>this.battle('mars','saturn'),!this.c.cores.includes('saturn'));
    else if(p.id==='neptune')add('Challenge patrol · recover core',()=>this.battle('venus','neptune'),!this.c.cores.includes('neptune'));
  }
  modal(title,text,actions,portrait){this.modalEl?.remove();const box=h('div',{class:'sn-dialog'},...(portrait===undefined?[]:[Object.assign(icon(portrait),{className:'sn-icon sn-portrait'})]),h('h2',{},title),h('p',{},text),h('div',{class:'sn-actions'},actions));this.modalEl=h('div',{class:'sn-modal'},box);this.hud.el.append(this.modalEl);return box;}
  closeModal(){this.modalEl?.remove();this.modalEl=null;this.input.held.clear();}
  talk(race){const r=RACES[race];this.modal(`${r.captain} · ${r.name}`,r.greeting,[button('Return to orbit',()=>this.closeModal(),true)],r.portrait);this.sfx('hail');}
  help(){const box=this.modal('How to play','You command an Earth-race explorer. Turn and thrust to fly; inertia keeps your ship moving. Arena edges wrap around.\n\nGoal: recover Mercury, Saturn and Neptune cores; make accords with Mars and Venus; activate the relay at Earth by day 40. Dock to refill fuel and crew. If stranded, an emergency tow costs time.\n\nCo-op: choose shared keyboard or P2 gamepad before combat. P2 helps fight and does not control travel. If either ally survives and defeats the patrol, you win the encounter.',[button('Back',()=>this.closeModal(),true)]);box.insertBefore(h('table',{class:'sn-help-table'},h('tr',{},h('th',{},'Action'),h('th',{},'P1 keyboard'),h('th',{},'P2 keyboard'),h('th',{},'P2 gamepad')), ...[['Turn','← / →','A / D','Left stick X'],['Thrust','↑','W','Stick up / RT'],['Brake','↓','S','B / Circle'],['Fire','Space','F','A / Cross'],['Shield','Shift','G','X / Square'],['Pause','Esc / P','Shared','Start / Menu']].map(row=>h('tr',{},row.map(t=>h('td',{},t))))),box.lastChild);}
  pause(){if(this.mode==='title'){this.help();return;}this.paused=true;
    const box=this.modal('Expedition menu','Campaign saves remember the current planet. A combat load starts that encounter again from orbit.',[button('Resume',()=>{this.paused=false;this.closeModal();},true),button('Save checkpoint',()=>{this.saveCheckpoint();this.toast('Planet checkpoint saved.');}),button('Export save',()=>this.exportSave()),button('Import save',()=>this.importSave()),button(this.muted?'Enable audio':'Mute audio',()=>{this.muted=!this.muted;this.audio.mute('master',this.muted);this.toast(this.muted?'Audio muted':'Audio enabled');}),button('Title screen',()=>{this.paused=false;this.title();})]);
    if(this.mode!=='combat'){box.insertBefore(h('div',{class:'sn-controls'},'Pilots',this.coopSelect()),box.lastChild);const touch=button(this.touchEnabled?'Touch controls: on':'Touch controls: off',()=>{this.touchEnabled=!this.touchEnabled;touch.textContent=this.touchEnabled?'Touch controls: on':'Touch controls: off';});box.lastChild.append(touch);}else box.insertBefore(h('p',{},this.coop==='gamepad'?'P2 gamepad: press a button to connect it. The second ship is already in the arena.':'P2 keyboard uses WASD, F and G. Pilot mode changes apply to the next encounter.'),box.lastChild);
  }
  exportSave(){const url=URL.createObjectURL(new Blob([JSON.stringify(this.c,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='star-not-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  importSave(){const file=document.createElement('input');file.type='file';file.accept='.json';file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>32000)throw new Error('Save is too large.');const c=JSON.parse(await f.text());if(!validCampaign(c))throw new Error('This is not a valid Star-Not save.');if(!confirm('Replace the current expedition with this save?'))return;this.c=c;this.paused=false;this.saveCheckpoint();this.checkEnding();}catch(error){this.toast(error.message);}};file.click();}
  battle(enemyRace,reward){if(this.c.lost||this.c.won)return;this.closeModal();this.saveCheckpoint();this.clearCombat();this.mode='combat';this.paused=false;this.reward=reward;this.setMapVisible(false);this.baseHUD();this.music('combat');
    const create=(race,x,y,index,team,hp)=>({spec:{...RACES[race],shot:RACES[race].shot+(team==='ally'&&this.c.upgraded?1:0)},x,y,angle:team==='ally'?Math.PI/2:-Math.PI/2,vx:0,vy:0,hp,maxHp:hp,team,cooldown:0,shield:0,shieldWait:0,view:this.shipViews[index],pilot:index});
    this.fighters=[create('earth',170,330,0,'ally',Math.max(6,this.c.crew))];if(this.coop!=='solo')this.fighters.push(create('earth',180,470,1,'ally',16));this.fighters.push(create(enemyRace,590,365,2,'enemy',RACES[enemyRace].hp+(this.coop==='solo'?0:7)));
    for(const s of this.fighters){s.view.enabled=true;s.view.set('sprite','frame',s.spec.ship);s.view.set('sprite','tint',s.pilot===1?'#a4e0ba':'#ffffff');}
    this.fleetHUD=h('div',{class:'sn-fleet'});this.hud.el.append(this.fleetHUD,h('div',{class:'sn-flight-help'},'Rotate, thrust, fire. Shift/G/X shield blocks hits for 1 second, then recharges for 5. Esc pauses.'));
    const side=h('div',{class:'sn-side'},h('div',{class:'sn-eyebrow'},reward==='accord'?'Friendly duel':'Relay recovery'),icon(RACES[enemyRace].portrait),h('h2',{},RACES[enemyRace].name),h('p',{},reward==='accord'?'Win this duel to earn the Mars accord. A defeat lets you repair and try again.':'A rogue patrol is holding the relay core. Disable its ship; the surviving crew will withdraw.'),h('hr'),h('div',{class:'sn-eyebrow'},'Wingmate'),h('p',{},this.coop==='solo'?'Solo pilot. Choose co-op in the orbit menu before the next encounter.':this.coop==='keyboard'?'P2 is in the second Earth ship. WASD moves, F fires, G shields.':'P2 uses a gamepad. Press a button to activate it. Left stick turns/thrusts; A fires, B brakes, X shields.'),button('Retreat · +2 days',()=>this.finishBattle(false,'Retreated from the patrol.')));this.hud.el.append(side);if(this.touchEnabled)this.touch=mountTouchControls(this.input,this.hud.el,{left:'p1Left',right:'p1Right',up:'p1Thrust',down:'p1Brake',fire:'p1Fire',shield:'p1Shield',rightInset:340,bottomInset:100});this.paintFighters();
  }
  fire(ship){if(ship.cooldown>0)return;const view=this.shots.find(e=>!e.enabled);if(!view)return;ship.cooldown=ship.spec.cooldown;view.enabled=true;const dx=Math.sin(ship.angle),dy=-Math.cos(ship.angle);this.bullets.push({x:ship.x+dx*27,y:ship.y+dy*27,vx:dx*410+ship.vx,vy:dy*410+ship.vy,team:ship.team,damage:ship.spec.shot,life:1.5,view});this.sfx('laser');}
  burst(x,y){const view=this.bursts.find(e=>!e.enabled);if(!view)return;view.enabled=true;this.effects.push({view,x,y,life:.4});}
  finishBattle(won,reason){if(this.mode!=='combat')return;const p1=this.fighters.find(s=>s.pilot===0);this.c.crew=won?Math.max(6,Math.min(24,Math.ceil(p1.hp))):Math.max(6,this.c.crew-6);this.c.day+=won?1:2;
    if(won){if(this.reward==='accord')this.c.accords.mars=true;else if(!this.c.cores.includes(this.reward))this.c.cores.push(this.reward);this.c.scrap+=2;this.c.fuel=Math.min(14,this.c.fuel+3);}
    record(this.c,reason||(won?'The patrol withdrew; mission reward recovered.':'The fleet escaped. Repair at Earth, Mars or Venus and try again.'));this.saveCheckpoint();this.clearCombat();this.sfx(won?'victory':'defeat');this.mode='map';
    if(this.c.lost){this.ending();return;}this.map();this.modal(won?'Encounter complete':'Fleet recovered',won?(this.reward==='accord'?'Mars has signed the accord.':'A relay core is now safely aboard.')+' Two scrap and fuel were recovered.':(reason||'Both ships were disabled. Rescue crews returned you to orbit. You can repair and try again.'),[button('Back to the solar chart',()=>this.closeModal(),true)]);
  }
  paintFighters(){for(const s of this.fighters){s.view.enabled=s.hp>0;if(s.hp<=0)continue;s.view.pos=[s.x,s.y,8];s.view.rot=[0,0,s.angle*180/Math.PI];s.view.set('sprite','alpha',s.shield>0?.5:1);}this.fleetHUD.replaceChildren(...this.fighters.map(s=>h('div',{class:'sn-health'},`${s.team==='enemy'?s.spec.name:'P'+(s.pilot+1)} · ${Math.max(0,Math.ceil(s.hp))}/${s.maxHp}${s.shield>0?' · SHIELD':''}`)));}
  ending(){this.clearCombat();this.mode='ending';this.setMapVisible(true);this.baseHUD();this.music(this.c.won?'victory':'cruise');this.modal(this.c.won?'ONE SYSTEM. THREE PEOPLES.':'THE SOLAR WINDOW CLOSED',this.c.won?'Earth-race, Mars-race and Venutians restore the relay together. Messages and supplies move freely again. Your expedition is complete.': 'Day 40 has passed before the relay was restored. Start a new expedition: use friendly docks and emergency supplies to plan a shorter route.',[button('New expedition',()=>{this.c=freshCampaign();this.saveCheckpoint();this.map();},true),button('Title screen',()=>this.title())]);}
  update(dt){if(this.mode==='loading')return;this.clock+=dt;const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);const start=!!pad?.buttons?.[9]?.pressed;
    if(this.mode!=='title'&&(this.input.pressed('pause')||(this.coop==='gamepad'&&start&&!this.padStart))){if(this.paused){this.paused=false;this.closeModal();}else this.pause();}this.padStart=start;
    if(this.mode==='map'&&!this.paused&&!this.modalEl?.isConnected&&this.input.pressed('select')){const p=this.input.pointer;const hit=this.planetViews.find(v=>Math.hypot(p.worldX-v.p.x,p.worldY-v.p.y)<v.p.size*.4);if(hit)this.map(hit.p.id);}
    if(this.mode!=='combat'||this.paused)return;dt=Math.min(dt,.04);
    const live=this.fighters.filter(s=>s.hp>0);const allies=live.filter(s=>s.team==='ally');const enemy=live.find(s=>s.team==='enemy');if(!enemy){this.finishBattle(true);return;}if(!allies.length){this.finishBattle(false);return;}
    for(const s of live){let controls;
      if(s.team==='enemy'){const target=allies.reduce((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)<Math.hypot(b.x-s.x,b.y-s.y)?a:b);const dx=wrappedDelta(s.x,target.x,ARENA.right-ARENA.left),dy=wrappedDelta(s.y,target.y,ARENA.bottom-ARENA.top),angle=Math.atan2(dx,-dy),turn=shortestTurn(s.angle,angle);controls={turn:Math.max(-1,Math.min(1,turn*2)),thrust:Math.hypot(dx,dy)>180?1:.35,brake:false,fire:Math.abs(turn)<.35,shield:false};}
      else if(s.pilot===1&&this.coop==='gamepad')controls=gamepadControls(pad);
      else {const prefix=s.pilot===0?'p1':'p2';controls={turn:this.input.axis(prefix+'Left',prefix+'Right'),thrust:this.input.down(prefix+'Thrust')?1:0,brake:this.input.down(prefix+'Brake'),fire:this.input.down(prefix+'Fire'),shield:this.input.down(prefix+'Shield')};}
      moveShip(s,controls,dt,ARENA);if(controls.fire)this.fire(s);
    }
    for(const b of this.bullets){b.life-=dt;if(b.life<=0){b.view.enabled=false;continue;}b.x=wrap(b.x+b.vx*dt,ARENA.left,ARENA.right);b.y=wrap(b.y+b.vy*dt,ARENA.top,ARENA.bottom);
      for(const s of live){if(s.team===b.team||s.hp<=0)continue;const dx=wrappedDelta(b.x,s.x,ARENA.right-ARENA.left),dy=wrappedDelta(b.y,s.y,ARENA.bottom-ARENA.top);if(Math.hypot(dx,dy)<21){b.life=0;if(s.shield<=0){s.hp=Math.max(0,s.hp-b.damage);this.sfx('hit');this.burst(s.x,s.y);if(s.hp===0)this.sfx('explosion');}break;}}
      b.view.enabled=b.life>0;b.view.pos=[b.x,b.y,7];
    }
    this.bullets=this.bullets.filter(b=>b.life>0);for(const fx of this.effects){fx.life-=dt;fx.view.enabled=fx.life>0;fx.view.pos=[fx.x,fx.y,9];fx.view.scale=[1+(.4-fx.life)*2,1+(.4-fx.life)*2,1];fx.view.set('sprite','alpha',Math.max(0,fx.life/.4));}this.effects=this.effects.filter(fx=>fx.life>0);this.paintFighters();
  }
  onDestroy(){this.touch?.destroy();this.observer?.disconnect();window.removeEventListener('blur',this.onBlur);this.style?.remove();this.hud?.remove();clearTimeout(this.toastTimer);this.audio.stopMusic({fade:0});}
}
