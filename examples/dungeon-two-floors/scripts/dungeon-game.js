// GPL-3.0-or-later. Small, editable Shattered Pixel Dungeon adaptation; see SOURCE.md.
import {NordScript} from 'nord';import{strike,distance,nextStep,visible}from'./dungeon-rules.js';
export default class DungeonGame extends NordScript{
 static attributes={floor:{type:'number',default:1},tileSize:{type:'number',default:32},viewRadius:{type:'number',default:7},firstScene:{type:'string',default:'scenes/floor1.scene.json'}};
 start(){
  this.game.paused=false;this.wasR=this.input.key('KeyR');this.size=this.attrs.tileSize;this.width=Math.round(this.scene.settings.layoutSize.width/this.size);this.height=Math.round(this.scene.settings.layoutSize.height/this.size);this.blocked=new Set();this.objects=[];this.tiles=[];
  for(const e of this.scene.all()){const c=e.getComponent('collider');if(c&&!c.data.trigger)this.blocked.add(this.cell(e).join(','));if(e.id.startsWith('t'))this.tiles.push(e);const s=e.scripts.find(s=>s.attrs?.kind);if(s){const a=s.attrs,[x,y]=this.cell(e);this.objects.push({entity:e,id:e.id,kind:a.kind,x,y,hp:a.hp,max:a.hp,accuracy:a.accuracy,defense:a.defense,damage:[a.damageMin,a.damageMax],armor:a.armor,value:a.value,next:a.next,alive:true});}}
  this.hero=this.objects.find(o=>o.kind==='hero');if(!this.hero)throw Error('Dungeon needs a hero object');
  const old=this.game.dungeonCampaign;this.stats=old&&this.attrs.floor>1?old:{hp:this.hero.hp,max:this.hero.hp,potions:2,gold:0,keys:0,turn:0};this.game.dungeonCampaign=this.stats;this.log=['Two floors. Find a key, descend, recover the relic.'];this.ended=false;this.cooldown=0;this.seen=new Set();
  this.panel=document.createElement('div');Object.assign(this.panel.style,{position:'absolute',left:'12px',bottom:'12px',right:'12px',padding:'12px 16px',background:'#101c2dee',border:'1px solid #667f9a',borderRadius:'8px',color:'#e1e8ed',font:'14px monospace',zIndex:100});document.getElementById('stage').append(this.panel);this.fog();this.hud();this.game.dungeon=this;
 }
 cell(e){return[Math.floor(e.pos[0]/this.size),Math.floor(e.pos[1]/this.size)];}
 say(m){this.log.push(m);this.log=this.log.slice(-3);}
 hud(){this.panel.textContent=`TWO FLOORS · floor ${this.attrs.floor}/2 · HP ${this.stats.hp}/${this.stats.max} · potion ${this.stats.potions} · gold ${this.stats.gold} · keys ${this.stats.keys} · turn ${this.stats.turn}\n${this.log.join('  |  ')}\nArrows/WASD move or bump-attack · Space wait · H potion · E stairs · R restart`;this.panel.style.whiteSpace='pre-wrap';}
 at(x,y){return this.objects.find(o=>o.alive&&o!==this.hero&&o.x===x&&o.y===y);}
 move(dx,dy){if(this.ended)return;const h=this.hero,x=h.x+dx,y=h.y+dy,k=`${x},${y}`;if(this.blocked.has(k)||x<0||y<0||x>=this.width||y>=this.height){this.say('Wall. Paint a gap in the 2D editor to change this route.');this.hud();return;}
  const o=this.at(x,y);if(o&&['rat','guard'].includes(o.kind)){this.animate(h,'attack');const damage=strike(()=>this.rng.next(),h,o);o.hp-=damage;this.say(damage?`Hit ${o.kind} for ${damage}.`:'Your attack missed.');if(o.hp<=0){o.alive=false;o.entity.enabled=false;this.stats.gold+=2;this.say(`${o.kind} defeated.`);}this.turn();return;}
  if(o?.kind==='door'){if(this.stats.keys<1){this.say('Locked door — find the key.');this.hud();return;}this.stats.keys--;this.remove(o);this.say('Door unlocked.');}
  this.animate(h,'walk');h.x=x;h.y=y;h.entity.pos=[(x+.5)*this.size,(y+.5)*this.size,h.entity.pos[2]];
  if(o?.alive){if(o.kind==='potion'){this.stats.potions+=o.value;this.remove(o);this.say('Healing potion collected.');}if(o.kind==='gold'){this.stats.gold+=o.value;this.remove(o);this.say('Gold collected.');}if(o.kind==='key'){this.stats.keys+=o.value;this.remove(o);this.say('Key collected.');}if(o.kind==='trap'){this.stats.hp-=o.value;this.remove(o);this.say(`Trap! Lost ${o.value} HP.`);}if(o.kind==='relic'){this.remove(o);this.ended=true;this.say('Victory! Relic recovered from the second floor. R to replay.');this.fog();this.hud();return;}}
  this.turn();
 }
 animate(o,name){const c=o.entity.getComponent('animatedSprite');if(c){c.play(name,{restart:true});this.after(.18,()=>{if(o.alive)c.play('idle');});}}
 remove(o){o.alive=false;o.entity.enabled=false;}
 potion(){if(this.ended||this.stats.potions<1)return;this.stats.potions--;this.stats.hp=Math.min(this.stats.max,this.stats.hp+12);this.say('Potion restores up to 12 HP.');this.turn();}
 descend(){if(this.ended)return;const stairs=this.objects.find(o=>o.kind==='stairs'&&o.alive&&distance(o,this.hero)<=1);if(!stairs){this.say('Stand next to the stairs and press E.');this.hud();return;}this.loading=true;this.game.loadScene(stairs.next).catch(e=>{this.loading=false;this.say(e.message);this.hud();});}
 turn(){this.stats.turn++;const occupied=new Set(this.objects.filter(o=>o.alive&&['rat','guard','door'].includes(o.kind)).map(o=>`${o.x},${o.y}`));for(const o of this.objects){if(!o.alive||!['rat','guard'].includes(o.kind)||!visible(o,this.hero,this.blocked,this.attrs.viewRadius))continue;if(distance(o,this.hero)<=1){this.animate(o,'attack');const dmg=strike(()=>this.rng.next(),o,this.hero);this.stats.hp-=dmg;this.say(dmg?`${o.kind} hits for ${dmg}.`:`${o.kind} misses.`);}else{occupied.delete(`${o.x},${o.y}`);const p=nextStep(o,this.hero,this.blocked,occupied,this.width,this.height);if(p&&distance(p,this.hero)>0){o.x=p.x;o.y=p.y;o.entity.pos=[(o.x+.5)*this.size,(o.y+.5)*this.size,o.entity.pos[2]];}occupied.add(`${o.x},${o.y}`);}}
  if(this.stats.hp<=0){this.stats.hp=0;this.ended=true;this.say('You fell in the dungeon. R restarts both floors.');}this.fog();this.hud();
 }
 fog(){const h=this.hero;for(const e of this.tiles){const[x,y]=this.cell(e),v=visible(h,{x,y},this.blocked,this.attrs.viewRadius),k=`${x},${y}`;if(v)this.seen.add(k);e.set('sprite','alpha',v?1:this.seen.has(k)?.25:.025);}for(const o of this.objects)if(o!==h)o.entity.enabled=o.alive&&visible(h,o,this.blocked,this.attrs.viewRadius);}
 update(dt){if(this.loading)return;const r=this.input.key('KeyR'),restart=r&&!this.wasR;this.wasR=r;if(restart){this.loading=true;this.game.dungeonCampaign=null;this.game.loadScene(this.attrs.firstScene);return;}if(this.ended)return;this.cooldown-=dt;
  if(this.input.pressed('interact')){this.descend();return;}
  if(this.input.key('KeyH')&&!this.heldH){this.potion();this.cooldown=.18;}this.heldH=this.input.key('KeyH');
  if(this.cooldown>0)return;let acted=false;for(const[code,dx,dy]of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])if(this.input.down(code)){this.move(dx,dy);acted=true;break;}if(this.input.pressed('jump')){this.turn();acted=true;}if(acted)this.cooldown=.18;}

 onDestroy(){this.panel?.remove();if(this.game.dungeon===this)this.game.dungeon=null;}
}
