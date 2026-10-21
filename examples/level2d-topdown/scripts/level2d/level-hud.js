import { NordScript } from 'nord';
export default class LevelHud extends NordScript {
  start(){
    this.score=0;this.hp=5;this.message='';this.offs=[];
    this.el=document.createElement('div');Object.assign(this.el.style,{position:'absolute',top:'12px',left:'12px',padding:'10px 16px',color:'#fff',background:'#111c',font:'15px monospace',pointerEvents:'none',zIndex:100});
    (this.game.ui?.container??document.getElementById('stage')??document.body).append(this.el);
    this.offs.push(this.events.on('score',v=>{this.score+=Number(v)||0;}),this.events.on('level-win',m=>{this.message=m;this.game.paused=true;}),this.events.on('died',()=>{this.message='Game over — R to restart';this.game.paused=true;}));
    this.key=e=>{if(e.code==='KeyR'){this.game.paused=false;this.game.restart();}if(e.code==='Escape')this.game.paused=!this.game.paused;};window.addEventListener('keydown',this.key);
    this.timer=setInterval(()=>{const p=this.scene.findByTag('player')[0];const h=p?.scripts?.find?.(s=>s.hp!==undefined);if(p&&p.pos[1]>(this.scene.settings.layoutSize?.height??10000)+256){this.message='Fell out of the level — R to restart';this.game.paused=true;}this.el.textContent=this.message||`HP ${h?.hp??'—'} · Score ${this.score} · WASD / arrows · Space jump · E use · Esc pause · R restart`;},100);
  }
  onDestroy(){clearInterval(this.timer);this.el?.remove();this.offs.forEach(f=>f?.());window.removeEventListener('keydown',this.key);}
}
