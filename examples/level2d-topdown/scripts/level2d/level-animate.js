import { NordScript } from 'nord';
// Direction-aware presets use real sheet animations; still assets need no animation script.
export default class LevelAnimate extends NordScript {
  static attributes={run:{type:'string',default:'run'},south:{type:'string',default:'run-south'},east:{type:'string',default:'run-east'},north:{type:'string',default:'run-north'},west:{type:'string',default:'run-west'},idleFrame:{type:'number',default:-1}};
  start(){this.sprite=this.entity.getComponent('animatedSprite');this.moving=false;}
  update(){const c=this.sprite;if(!c)return;const [x,y]=this.physics.velocity(this.entity),a=this.attrs,moving=Math.hypot(x,y)>8,anims=this.game.backend.metaOf(c.data.texture)?.anims??{};
    let name=a.run;if(anims[a.south])name=Math.abs(x)>Math.abs(y)?(x<0?a.west:a.east):(y<0?a.north:a.south);
    if(moving&&anims[name]){if(!this.moving||this.name!==name)c.play(name,{restart:true});this.name=name;}
    if(!moving&&this.moving){c.stop();const frame=a.idleFrame>=0?a.idleFrame:anims[this.name]?.frames?.[0];if(frame!==undefined)c.obj.setFrame(frame);}
    this.moving=moving;
  }
}
