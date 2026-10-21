import { NordScript } from 'nord';
// Small ready-made interactions; controllers, pickups and health reuse library/scripts.
export default class LevelActions extends NordScript {
  static attributes={action:{type:'enum',options:['hurt','win','toggle','door'],default:'hurt'},target:{type:'string',default:''},amount:{type:'number',default:1},message:{type:'string',default:'Level complete!'},requireScore:{type:'number',default:0}};
  start(){this.score=0;this.used=false;this.off=this.events.on('score',v=>{this.score+=Number(v)||0;});}
  onTriggerEnter(o){this.act(o);}
  onCollisionEnter(o){this.act(o);}
  act(o){if(!o.hasTag('player'))return;const a=this.attrs;
    if(a.action==='hurt')o.emit('damage',{amount:a.amount});
    if(a.action==='win'&&!this.used&&this.score>=a.requireScore){this.used=true;this.events.emit('level-win',a.message);}
    if(a.action==='toggle'){const t=this.scene.find(a.target);if(t)t.enabled=!t.enabled;}
  }
  update(){if(this.attrs.action!=='door')return;const p=this.scene.findByTag('player')[0];if(p&&this.input.pressed('interact')&&Math.hypot(p.pos[0]-this.entity.pos[0],p.pos[1]-this.entity.pos[1])<80)this.entity.destroy();}
  onDestroy(){this.off?.();}
}
