// Amp Invaders: three destructible speaker barricades, timed firing and original pixel sprites.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.playerX=320;this.lives=3;this.invuln=0;this.score=0;this.wave=1;this.shots=[];this.bombs=[];this.cool=0;this.fire=0;this.covers=[6,6,6];this.makeWave();Audio.playMusic(C.MUSIC.ARCADE,true);},
 makeWave:function(){this.enemies=[];for(var y=0;y<3;y++)for(var x=0;x<5;x++)this.enemies.push({x:140+x*90,y:80+y*33,base:140+x*90,alive:true});},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='playing';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,score:this.score,cashWon:Math.floor(this.score/5)}:null;
  this.timer+=dt;this.cool-=dt;this.fire-=dt;this.invuln=Math.max(0,this.invuln-dt);
  var dir=(R.held('Right')||R.held('d')?1:0)-(R.held('Left')||R.held('a')?1:0);this.playerX=Math.max(40,Math.min(600,this.playerX+dir*230*dt));
  if((R.held('Space')||R.key('Space'))&&this.cool<=0){this.cool=0.2;this.shots.push({x:this.playerX,y:273});Audio.play(C.SFX.LASER_SHOOT,0.2);}
  var alive=this.enemies.filter(function(e){return e.alive;});
  if(this.fire<=0&&alive.length){var e=alive[Math.floor(Math.random()*alive.length)];this.bombs.push({x:e.x,y:e.y+14});this.fire=0.6/Math.sqrt(this.wave);}
  for(var i=0;i<this.enemies.length;i++){var e=this.enemies[i];e.x=e.base+Math.sin(this.timer*(0.7+this.wave*0.1))*48;}
  for(var i=0;i<this.shots.length;i++){
   var b=this.shots[i];b.y-=330*dt;
   for(var j=0;j<this.enemies.length;j++){var e=this.enemies[j];if(e.alive&&Math.abs(e.x-b.x)<21&&Math.abs(e.y-b.y)<18){e.alive=false;b.y=-99;this.score+=25;Audio.play(C.SFX.ALIEN_HIT,0.3);break;}}
  }
  for(var i=0;i<this.bombs.length;i++){
   var b=this.bombs[i];b.y+=130*dt;
   for(var j=0;j<3;j++)if(this.covers[j]>0&&Math.abs(b.x-(170+j*150))<28&&b.y>226&&b.y<250){this.covers[j]--;b.y=999;}
   if(this.invuln<=0&&Math.abs(b.x-this.playerX)<20&&b.y>270&&b.y<307){this.lives--;this.invuln=1.2;b.y=999;Audio.play(C.SFX.ALIEN_BOMB,0.4);}
  }
  this.shots=this.shots.filter(function(b){return b.y>50;});this.bombs=this.bombs.filter(function(b){return b.y<340;});
  if(!alive.length){this.wave++;this.makeWave();}
  if(this.lives<=0||this.timer>=45||this.wave>3)this.phase='results';return null;
 },
 draw:function(w,h){
  R.stars(this.timer,w,h);R.header('AMP INVADERS','LEFT / RIGHT · move    HOLD SPACE · fire    The speaker stacks take the first hits',w);
  for(var i=0;i<this.enemies.length;i++){var e=this.enemies[i];if(e.alive)R.object(9,e.x-21,e.y-15,42,30);}
  for(var i=0;i<3;i++)if(this.covers[i]>0&&R.prop){R.prop(2,144+i*150,215,52,44);R.text(158+i*150,255,''+this.covers[i],0.53);}
  for(var i=0;i<this.shots.length;i++){var b=this.shots[i];Draw2D.fillRect(b.x-2,b.y,4,10,0.5,0.9,1,1);}
  for(var i=0;i<this.bombs.length;i++){var b=this.bombs[i];Draw2D.fillRect(b.x-3,b.y,6,8,1,0.5,0.3,1);}
  if(this.invuln>2||this.invuln===0||Math.floor(this.timer*12)%2===0)R.object(8,this.playerX-22,270,44,42);
  R.box(12,316,w-24,30);R.text(24,324,'SCORE '+this.score+'    SHIPS '+this.lives+'    WAVE '+this.wave+'/3    TIME '+Math.ceil(Math.max(0,45-this.timer)),0.7);
  if(this.phase==='ready')R.result('THE PUB HAS AN ARCADE',['Clear the waves without sacrificing all the PA.','Hold SPACE to fire. Use the speaker barricades.','ENTER · insert the coin'],w,h);
  if(this.phase==='results')R.result('HIGH SCORE: '+this.score,['Tour fund +'+Math.floor(this.score/5)+' FIM','Pekka wants another go.'],w,h);
 }
};
