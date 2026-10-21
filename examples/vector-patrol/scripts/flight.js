import {NordScript} from 'nord';
import {newFlight,tick} from './sim.js';
import {FlightView} from './view.js';
import {RetroAudio} from './retro-audio.js';
import {AUDIO} from './audio-config.js';
export default class Flight extends NordScript{
 start(){this.state=newFlight();this.started=false;this.paused=false;this.bossMusic=false;this.sound=new RetroAudio(AUDIO);this.view=new FlightView(this);this.best=this.save.get('vector-patrol.best',0);
  this.hud=this.ui.label('',{screen:'flight',x:12,y:8,size:18,style:{whiteSpace:'pre-wrap',maxWidth:'95%'}});this.ui.show('flight');
  this.ui.menu('flight-menu',[{text:'Launch patrol',onClick:()=>this.launch()},{text:'Mute / Unmute',onClick:()=>this.sound.mute()}],{x:24,y:170});
  this.ui.label('VECTOR PATROL\nOne canyon. Enemy waves. A carrier at 65 seconds.\nWASD/arrows steer · Space/J fire · Shift roll shield\nC retro/clean · P pause · clear the carrier before 110s',{screen:'flight-menu',x:24,y:52,size:19});this.ui.show('flight-menu');
  this.pauseButton=this.ui.button('Pause / Resume',()=>this.togglePause(),{screen:'flight',x:12,y:65});this.ui.button('Restart',()=>{this.game.restart();},{screen:'flight',x:180,y:65});
  this.key=e=>{if(e.code==='KeyP'&&!e.repeat)this.togglePause();};window.addEventListener('keydown',this.key);
  this.blur=()=>{if(this.started&&!this.paused&&!this.state.won&&!this.state.lost)this.togglePause();};window.addEventListener('blur',this.blur);
  this.draw();
 }
 async launch(){if(this.started)return;this.started=true;this.ui.clear('flight-menu');try{await this.sound.unlock();await this.sound.music(0);}catch(e){this.sound.problem=e.message;}}
 togglePause(){if(!this.started||this.state.won||this.state.lost)return;this.paused=!this.paused;if(this.paused){this.game.pause();this.sound.suspend();this.ui.label('PAUSED — P or Pause / Resume continues',{screen:'flight-menu',x:24,y:170,size:24});this.ui.show('flight-menu');}else{this.ui.clear('flight-menu');this.game.resume();this.sound.resume();}}
 update(dt){if(this.input.pressed('retro'))this.view.setRetro(!this.view.retro);
  if(this.started){const[x,y]=this.input.vec('left','right','down','up');const events=tick(this.state,{x,y,fire:this.input.down('fire'),roll:this.input.pressed('roll')},dt);for(const name of events)this.sound.play(name,{volume:name==='laser'?.16:.5});
   if(this.state.boss&&!this.bossMusic){this.bossMusic=true;this.sound.music(1);}
   if((this.state.won||this.state.lost)&&!this.finished){this.finished=true;if(this.state.won){this.best=Math.max(this.best,this.state.score);this.save.set('vector-patrol.best',this.best);}this.ui.label(this.state.won?'SECTOR CLEAR!':'PATROL LOST — Restart to retry',{screen:'flight-menu',x:24,y:160,size:32});this.ui.show('flight-menu');}
  }this.view.draw(this.state);this.draw();
 }
 draw(){const s=this.state;this.hud.set(`HULL ${s.hp}  SCORE ${s.score}  TIME ${s.time.toFixed(1)}  ROLL ${s.roll.toFixed(1)}  BEST ${this.best}\n${s.boss?'CARRIER '+s.bossHP+'/48':'Reach carrier at 65s'} · ${this.view.retro?'RETRO 320px + vertex snap':'CLEAN'}${this.sound.problem?' · Audio: '+this.sound.problem:''}`);}
 onDestroy(){window.removeEventListener('keydown',this.key);window.removeEventListener('blur',this.blur);this.view?.dispose();this.sound?.dispose();this.ui.clear('flight');this.ui.clear('flight-menu');this.game.resume();}
}
